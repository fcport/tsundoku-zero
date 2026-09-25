// Livello data (AD-2): l'adattatore Supabase della porta ContentRepository del
// dominio. È uno dei soli moduli che importano @supabase/supabase-js (il client
// concreto arriva iniettato: la stessa sessione condivisa con AuthGateway).
//
// LETTURA del ciclo: a differenza degli adattatori a confine totale
// (auth/settings, che INGOIANO), questo LANCIA un `DataError` tipizzato su
// qualunque errore Supabase o riga malformata — alimenta TanStack Query, che
// esige una promise rifiutata per distinguere «errore» da «caricato, vuoto».
// Sola lettura: nessuna scrittura, coerente con la tabella `lesson` senza policy
// di scrittura (3.7).
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ContentRepository,
  LessonSummary,
} from '../domain/ports/contentRepository';
import type { BilingualText } from '../domain/bilingual';
import { DataError } from './dataError';

// Il nome della tabella e le colonne vivono qui una sola volta: è l'unico
// livello che conosce lo schema fisico (AD-2). Colonne di `lesson` (3.7):
// id, ordinal, title_en, title_it (nullable), grammar_points (text[]).
const LESSON_TABLE = 'lesson';
const LESSON_COLUMNS = 'id, ordinal, title_en, title_it, grammar_points';

// Forma GREZZA di una riga `lesson` come arriva da Supabase, prima della mappa in
// LessonSummary. `title_it` è nullable; `grammar_points` è un array Postgres.
interface LessonRow {
  readonly id: unknown;
  readonly ordinal: unknown;
  readonly title_en: unknown;
  readonly title_it: unknown;
  readonly grammar_points: unknown;
}

/** Vero se `value` è un array le cui voci sono tutte stringhe. */
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Mappa PURA di una riga grezza in `LessonSummary`. La FORMA D'ORO del titolo:
 * `title = title_it != null ? { en, it } : { en }` — l'`it` è OMESSO (non
 * `undefined` esplicito) quando la colonna è `null`, riusando `BilingualText`
 * (FR8.5: nessuna forma bilingue parallela). Su riga malformata (id/title_en non
 * stringa, ordinal non numero, grammar_points non array di stringhe) LANCIA un
 * `DataError('listLessons')`: una riga rotta è un fallimento, non un valore
 * degradato.
 */
function toLessonSummary(row: LessonRow): LessonSummary {
  // Guardia null/non-oggetto PRIMA della destrutturazione: una riga `null` o non
  // oggetto è malformata (DataError), non un `TypeError` grezzo che sfuggirebbe
  // al contratto «riga malformata ⇒ DataError».
  if (row === null || typeof row !== 'object') {
    throw new DataError('listLessons', new Error('riga lesson non è un oggetto'));
  }
  const { id, ordinal, title_en, title_it, grammar_points } = row;
  if (
    typeof id !== 'string' ||
    typeof ordinal !== 'number' ||
    typeof title_en !== 'string' ||
    !isStringArray(grammar_points) ||
    (title_it !== null && typeof title_it !== 'string')
  ) {
    throw new DataError('listLessons', new Error('riga lesson malformata'));
  }

  const title: BilingualText =
    title_it !== null ? { en: title_en, it: title_it } : { en: title_en };

  return { id, ordinal, title, grammarPoints: grammar_points };
}

/**
 * Costruisce l'adattatore Supabase della porta ContentRepository attorno a un
 * `SupabaseClient` INIETTATO (lo stesso client di AuthGateway/SettingsRepository:
 * una sola sessione condivisa).
 */
export function createSupabaseContentRepository(
  client: SupabaseClient,
): ContentRepository {
  return {
    async listLessons(): Promise<readonly LessonSummary[]> {
      // Ordinamento server-side per `ordinal`: il curriculum ha un ordine di
      // studio, non lo riordiniamo sul client. Su errore Supabase LANCIA
      // (reject), mai un valore degradato.
      const { data, error } = await client
        .from(LESSON_TABLE)
        .select(LESSON_COLUMNS)
        .order('ordinal');

      if (error) {
        throw new DataError('listLessons', error);
      }

      const rows = (data ?? []) as readonly LessonRow[];
      return rows.map(toLessonSummary);
    },
  };
}
