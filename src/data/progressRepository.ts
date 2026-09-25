// Livello data (AD-2): l'adattatore Supabase della porta ProgressRepository del
// dominio. È uno dei soli moduli che importano @supabase/supabase-js (il client
// concreto arriva iniettato: la stessa sessione condivisa con AuthGateway).
//
// LETTURA del ciclo: LANCIA un `DataError('listUnlockedLessonIds')` su errore
// Supabase o riga malformata (alimenta TanStack Query — reject, non valore
// degradato). Legge `lesson_progress` (3.8): l'insieme delle lezioni sbloccate,
// isolato per riga da RLS.
//
// SCRITTURA del ciclo (3.13): `unlockLesson` invoca la RPC ATOMICA e IDEMPOTENTE
// `unlock_lesson` (materializza progresso + stato di ripasso in una transazione).
// Su errore LANCIA `DataError('unlockLesson')`, mirror del contratto d'errore
// delle letture (reject, non valore degradato).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProgressRepository } from '../domain/ports/progressRepository';
import { DataError } from './dataError';

// Il nome della tabella e la colonna vivono qui una sola volta (AD-2). `user_id`
// non serve nella select: RLS isola già la riga all'utente corrente.
const LESSON_PROGRESS_TABLE = 'lesson_progress';
const LESSON_PROGRESS_COLUMNS = 'lesson_id';

// Il nome della RPC di sblocco vive qui una sola volta (AD-2), accanto ai nomi di
// tabella. La materializzazione atomica è tutta lato SQL (vedi la migrazione
// `20260925150000_create_unlock_lesson.sql`).
const UNLOCK_LESSON_RPC = 'unlock_lesson';

// Forma GREZZA di una riga `lesson_progress`: solo `lesson_id` (text) ci serve.
interface LessonProgressRow {
  readonly lesson_id: unknown;
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
    async listUnlockedLessonIds(): Promise<readonly string[]> {
      // Su errore Supabase LANCIA (reject). Mappa in `readonly string[]`; una
      // riga con `lesson_id` non stringa è malformata ⇒ DataError.
      const { data, error } = await client
        .from(LESSON_PROGRESS_TABLE)
        .select(LESSON_PROGRESS_COLUMNS);

      if (error) {
        throw new DataError('listUnlockedLessonIds', error);
      }

      const rows = (data ?? []) as readonly LessonProgressRow[];
      return rows.map((row) => {
        // Guardia null/non-oggetto insieme al tipo di `lesson_id`: una riga
        // `null` o non oggetto è malformata (DataError), non un `TypeError`
        // grezzo che sfuggirebbe al contratto «riga malformata ⇒ DataError».
        if (row === null || typeof row !== 'object' || typeof row.lesson_id !== 'string') {
          throw new DataError(
            'listUnlockedLessonIds',
            new Error('riga lesson_progress malformata'),
          );
        }
        return row.lesson_id;
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
