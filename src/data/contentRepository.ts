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
  ExerciseContent,
  LessonSummary,
} from '../domain/ports/contentRepository';
import type { BilingualText } from '../domain/bilingual';
import { exerciseSchema } from '../domain/exercise';
import { DataError } from './dataError';

// Il nome della tabella e le colonne vivono qui una sola volta: è l'unico
// livello che conosce lo schema fisico (AD-2). Colonne di `lesson` (3.7):
// id, ordinal, title_en, title_it (nullable), grammar_points (text[]). Il count
// aggregato PostgREST della risorsa embedded `exercise` (`exercise(count)`) legge
// server-side il numero di esercizi in un solo giro, senza scaricarne i payload
// (LessonSummary snello): arriva come `exercise: [{ count: n }]`.
const LESSON_TABLE = 'lesson';
const LESSON_COLUMNS =
  'id, ordinal, title_en, title_it, grammar_points, exercise(count)';

// Colonne della tabella `exercise` (3.7): id (chiave di riga = chiave pila), kind
// (discriminante), payload jsonb (`sentence`/`answer`/`distractors`), grammar_point,
// explanation_en/explanation_it (nullable). L'`Exercise` di dominio si ricompone da
// payload + colonne e si valida con `exerciseSchema.parse` (fonte UNICA, AC1 di 2.2).
const EXERCISE_TABLE = 'exercise';
const EXERCISE_COLUMNS =
  'id, kind, payload, grammar_point, explanation_en, explanation_it';

// Forma GREZZA di una riga `lesson` come arriva da Supabase, prima della mappa in
// LessonSummary. `title_it` è nullable; `grammar_points` è un array Postgres;
// `exercise` è il count aggregato embedded (`[{ count: n }]`).
interface LessonRow {
  readonly id: unknown;
  readonly ordinal: unknown;
  readonly title_en: unknown;
  readonly title_it: unknown;
  readonly grammar_points: unknown;
  readonly exercise: unknown;
}

/** Vero se `value` è un array le cui voci sono tutte stringhe. */
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Estrae `exerciseCount` dal count aggregato embedded PostgREST. Le FORME valide
 * sono `exercise: [{ count: n }]` (numero) oppure `exercise: []` — PostgREST può
 * emettere l'array VUOTO per una lezione SENZA esercizi (nessuna riga embedded),
 * caso CENTRALE di 3.14: `[]` ⇒ `0`, non un fallimento. LANCIA se `exercise` non è
 * un array, se ha lunghezza > 1 (forma inattesa), o se `[0].count` non è un numero:
 * una forma malformata è un fallimento, non un valore degradato (mirror del
 * contratto delle altre colonne).
 */
function toExerciseCount(exercise: unknown): number {
  if (!Array.isArray(exercise)) {
    throw new DataError('listLessons', new Error('exercise count malformato'));
  }
  // Array VUOTO = nessuna riga embedded = lezione concettuale (0 esercizi): forma
  // valida per «nessun esercizio», non un fallimento.
  if (exercise.length === 0) {
    return 0;
  }
  if (exercise.length !== 1) {
    throw new DataError('listLessons', new Error('exercise count malformato'));
  }
  const entry = exercise[0];
  if (
    entry === null ||
    typeof entry !== 'object' ||
    typeof (entry as { count: unknown }).count !== 'number'
  ) {
    throw new DataError('listLessons', new Error('exercise count malformato'));
  }
  return (entry as { count: number }).count;
}

/**
 * Mappa PURA di una riga grezza in `LessonSummary`. La FORMA D'ORO del titolo:
 * `title = title_it != null ? { en, it } : { en }` — l'`it` è OMESSO (non
 * `undefined` esplicito) quando la colonna è `null`, riusando `BilingualText`
 * (FR8.5: nessuna forma bilingue parallela). `exerciseCount` deriva dal count
 * embedded (`exercise[0].count`, `0` = lezione concettuale). Su riga malformata
 * (id/title_en non stringa, ordinal non numero, grammar_points non array di
 * stringhe, `exercise` non array o `count` non numero) LANCIA un
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
  const { id, ordinal, title_en, title_it, grammar_points, exercise } = row;
  if (
    typeof id !== 'string' ||
    typeof ordinal !== 'number' ||
    typeof title_en !== 'string' ||
    !isStringArray(grammar_points) ||
    (title_it !== null && typeof title_it !== 'string')
  ) {
    throw new DataError('listLessons', new Error('riga lesson malformata'));
  }

  const exerciseCount = toExerciseCount(exercise);

  const title: BilingualText =
    title_it !== null ? { en: title_en, it: title_it } : { en: title_en };

  return { id, ordinal, title, grammarPoints: grammar_points, exerciseCount };
}

// Forma GREZZA di una riga `exercise` come arriva da Supabase, prima della mappa
// in ExerciseContent. `payload` è jsonb (l'oggetto con `sentence`/`answer`/
// `distractors`); `explanation_it` è nullable.
interface ExerciseRow {
  readonly id: unknown;
  readonly kind: unknown;
  readonly payload: unknown;
  readonly grammar_point: unknown;
  readonly explanation_en: unknown;
  readonly explanation_it: unknown;
}

/**
 * Mappa PURA di una riga grezza `exercise` in `ExerciseContent`. Ricompone il
 * CANDIDATO `Exercise` = payload jsonb (`sentence`/`answer`/`distractors`) PIÙ
 * `kind` (colonna), `grammarPoint` (da `grammar_point`) ed `explanation`
 * (`{ en, it? }` — l'`it` è OMESSO quando `explanation_it` è `null`, forma d'oro di
 * FR8.5), poi valida via `exerciseSchema.parse` (fonte UNICA di validazione, AC1
 * di 2.2). Su riga malformata (`id`/`grammar_point`/`explanation_en` non stringa,
 * `payload` non oggetto) o `parse` `ok: false` LANCIA `DataError('listExercisesByIds')`:
 * una riga rotta è un fallimento, non un valore degradato (mirror di `toLessonSummary`).
 */
function toExerciseContent(row: ExerciseRow): ExerciseContent {
  // Guardia null/non-oggetto PRIMA della destrutturazione (come toLessonSummary).
  if (row === null || typeof row !== 'object') {
    throw new DataError(
      'listExercisesByIds',
      new Error('riga exercise non è un oggetto'),
    );
  }
  const { id, kind, payload, grammar_point, explanation_en, explanation_it } = row;
  if (
    typeof id !== 'string' ||
    typeof grammar_point !== 'string' ||
    typeof explanation_en !== 'string' ||
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    (explanation_it !== null && typeof explanation_it !== 'string')
  ) {
    throw new DataError('listExercisesByIds', new Error('riga exercise malformata'));
  }

  const explanation: BilingualText =
    explanation_it !== null
      ? { en: explanation_en, it: explanation_it }
      : { en: explanation_en };

  // Il candidato = payload (sentence/answer/distractors) PIÙ le colonne. `kind`
  // resta grezzo (unknown dal DB): `exerciseSchema.parse` verifica che sia uno dei
  // tre letterali del registro chiuso e localizza l'errore sul discriminante.
  const candidate = {
    ...(payload as Record<string, unknown>),
    kind,
    grammarPoint: grammar_point,
    explanation,
  };

  const parsed = exerciseSchema.parse(candidate);
  if (!parsed.ok) {
    throw new DataError(
      'listExercisesByIds',
      new Error('esercizio non valido secondo exerciseSchema'),
    );
  }

  return { id, exercise: parsed.value };
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

    async listExercisesByIds(
      ids: readonly string[],
    ): Promise<readonly ExerciseContent[]> {
      // `ids` vuoto ⇒ `[]` SENZA query: `.in('id', [])` è un filtro degenere, e
      // non c'è nulla da caricare. Corto-circuito prima di toccare la rete.
      if (ids.length === 0) {
        return [];
      }

      // Filtro `.in('id', ids)` sui soli id richiesti (le chiavi della pila). Su
      // errore Supabase LANCIA (reject), mai un valore degradato. L'ordine del
      // risultato non è garantito: il consumatore mappa per id (nessun `.order`).
      const { data, error } = await client
        .from(EXERCISE_TABLE)
        .select(EXERCISE_COLUMNS)
        .in('id', ids);

      if (error) {
        throw new DataError('listExercisesByIds', error);
      }

      const rows = (data ?? []) as readonly ExerciseRow[];
      return rows.map(toExerciseContent);
    },
  };
}
