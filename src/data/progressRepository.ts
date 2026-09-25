// Livello data (AD-2): l'adattatore Supabase della porta ProgressRepository del
// dominio. È uno dei soli moduli che importano @supabase/supabase-js (il client
// concreto arriva iniettato: la stessa sessione condivisa con AuthGateway).
//
// LETTURA del ciclo: LANCIA un `DataError('listUnlockedLessons')` su errore
// Supabase o riga malformata (alimenta TanStack Query — reject, non valore
// degradato). Legge `lesson_progress` (3.8): l'insieme delle lezioni sbloccate —
// id E istante di sblocco (`unlocked_at`, il read-model UNICO di 3.17) — isolato
// per riga da RLS.
//
// SCRITTURA del ciclo (3.13): `unlockLesson` invoca la RPC ATOMICA e IDEMPOTENTE
// `unlock_lesson` (materializza progresso + stato di ripasso in una transazione).
// Su errore LANCIA `DataError('unlockLesson')`, mirror del contratto d'errore
// delle letture (reject, non valore degradato).
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ProgressRepository,
  UnlockedLesson,
} from '../domain/ports/progressRepository';
import { DataError } from './dataError';

// Il nome della tabella e le colonne vivono qui una sola volta (AD-2). `user_id`
// non serve nella select: RLS isola già la riga all'utente corrente. Il
// read-model UNICO di 3.17 porta ANCHE `unlocked_at` (per il tetto giornaliero),
// letto nella stessa select degli id (nessuna doppia lettura).
const LESSON_PROGRESS_TABLE = 'lesson_progress';
const LESSON_PROGRESS_COLUMNS = 'lesson_id, unlocked_at';

// Il nome della RPC di sblocco vive qui una sola volta (AD-2), accanto ai nomi di
// tabella. La materializzazione atomica è tutta lato SQL (vedi la migrazione
// `20260925150000_create_unlock_lesson.sql`).
const UNLOCK_LESSON_RPC = 'unlock_lesson';

// Forma GREZZA di una riga `lesson_progress`: `lesson_id` (text) e `unlocked_at`
// (timestamptz, serializzato ISO da PostgREST). Entrambi ci servono per il
// read-model unico (3.17).
interface LessonProgressRow {
  readonly lesson_id: unknown;
  readonly unlocked_at: unknown;
}

/**
 * Costruisce l'adattatore Supabase della porta ProgressRepository attorno a un
 * `SupabaseClient` INIETTATO (lo stesso client di AuthGateway: la lettura RLS
 * richiede la sessione dell'accesso).
 */
export function createSupabaseProgressRepository(
  client: SupabaseClient,
): ProgressRepository {
  return {
    async listUnlockedLessons(): Promise<readonly UnlockedLesson[]> {
      // Su errore Supabase LANCIA (reject). Mappa in `readonly UnlockedLesson[]`;
      // una riga con `lesson_id` non stringa o `unlocked_at` non parsabile a una
      // `Date` valida è malformata ⇒ DataError.
      const { data, error } = await client
        .from(LESSON_PROGRESS_TABLE)
        .select(LESSON_PROGRESS_COLUMNS);

      if (error) {
        throw new DataError('listUnlockedLessons', error);
      }

      const rows = (data ?? []) as readonly LessonProgressRow[];
      return rows.map((row) => {
        // Guardia null/non-oggetto insieme al tipo di ENTRAMBI i campi: una riga
        // `null`/non oggetto, un `lesson_id` non stringa o un `unlocked_at` non
        // stringa è malformata (DataError), non un `TypeError` grezzo che
        // sfuggirebbe al contratto «riga malformata ⇒ DataError».
        if (
          row === null ||
          typeof row !== 'object' ||
          typeof row.lesson_id !== 'string' ||
          typeof row.unlocked_at !== 'string'
        ) {
          throw new DataError(
            'listUnlockedLessons',
            new Error('riga lesson_progress malformata'),
          );
        }
        // `unlocked_at` è un timestamptz serializzato ISO: lo parsiamo a `Date`.
        // Un istante NON valido (NaN) è a sua volta una riga malformata.
        const unlockedAt = new Date(row.unlocked_at);
        if (Number.isNaN(unlockedAt.getTime())) {
          throw new DataError(
            'listUnlockedLessons',
            new Error('riga lesson_progress con unlocked_at non valido'),
          );
        }
        return { lessonId: row.lesson_id, unlockedAt };
      });
    },

    async unlockLesson(lessonId: string, now: Date): Promise<void> {
      // SCRITTURA via la sola RPC atomica/idempotente `unlock_lesson`. La materia-
      // lizzazione (progresso + review_state per esercizio, lettura server-side
      // degli esercizi) è tutta in SQL: qui si passano solo `lesson_id` e l'istante
      // di sblocco. `now` arriva dal Clock (AD-1); lo serializziamo in ISO 8601
      // (timestamptz). Su errore LANCIA (reject), mirror del contratto delle letture.
      const { error } = await client.rpc(UNLOCK_LESSON_RPC, {
        lesson_id: lessonId,
        unlocked_at: now.toISOString(),
      });

      if (error) {
        throw new DataError('unlockLesson', error);
      }
    },
  };
}
