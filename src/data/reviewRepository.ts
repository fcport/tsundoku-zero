// Livello data (AD-2): l'adattatore Supabase della porta ReviewRepository del
// dominio. È uno dei soli moduli che importano @supabase/supabase-js (il client
// concreto arriva iniettato: la stessa sessione condivisa con AuthGateway).
//
// LETTURA del ciclo: LANCIA un `DataError('listDue')` su errore Supabase o riga
// malformata (alimenta TanStack Query — reject, non valore degradato).
//
// La dovutezza NON è reimplementata qui: `listDue` MAPPA le righe in `ReviewState`
// e FILTRA con il predicato di dominio `isDue(state, now)` — l'UNICA autorità
// della dovutezza (AD-5). Un `.lte('due_at', now)` server-side divergerebbe dal
// confine `<=` di `isDue`; lo `review_state` di un utente è isolato ai suoi
// esercizi sbloccati (RLS), quindi fetch-poi-filtro è accettabile. `now` è
// INIETTATO dal chiamante (via Clock), mai letto dalla piattaforma.
//
// Il RIENTRO DOLCE (22-10-2026): letti tutti gli stati, `spreadBacklog` (dominio)
// decide quali arretrati oltre il tetto rinviare; l'adattatore li toglie dalla pila
// di oggi e salva i rinvii con la RPC `postpone_reviews`. Il salvataggio è
// BEST-EFFORT: se fallisce (rete, offline) la pila di oggi resta comunque nel
// tetto, e la lettura dopo riprova. La pila esce nell'ordine di `mixByLesson`:
// lezioni alternate, in un ordine diverso ogni giorno.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApplyReviewInput,
  ReviewRepository,
} from '../domain/ports/reviewRepository';
import type { ReviewState } from '../domain/schedule';
import { REVIEW_OUTCOMES, type ReviewOutcome } from '../domain/schedule';
import type { ReviewLogRecord } from '../domain/streak';
import { isDue } from '../domain/due';
import { backlogBefore, mixByLesson, postponedAhead, spreadBacklog } from '../domain/backlog';
import { studyDayOrdinal } from '../domain/calendarDay';
import { DataError } from './dataError';

// Il nome della tabella e le colonne vivono qui una sola volta (AD-2). Colonne di
// `review_state` (3.8): exercise_id, stage, due_at, review_count, lapse_count,
// last_reviewed_at (nullable). `user_id` non serve: RLS isola già la riga. La
// lezione dell'esercizio (`exercise(lesson_id)`, dalla FK `exercise_id`) serve
// solo al rientro dolce, per variare gli arretrati fra le lezioni.
const REVIEW_STATE_TABLE = 'review_state';
const REVIEW_STATE_COLUMNS =
  'exercise_id, stage, due_at, review_count, lapse_count, last_reviewed_at, exercise(lesson_id)';

// Il registro append-only dei ripassi (3.7): il canale UNICO delle statistiche
// derivate (AD-18) ora porta la riga COMPLETA. `exercise_id` (identita), `outcome`
// (esito) e `grammar_point` (il punto grammaticale denormalizzato, `not null`)
// esistono gia a DB (3.7); qui si estende solo la LETTURA — nessuna migrazione,
// nessuna modifica alla RPC. `reviewed_at` e timestamptz ⇒ stringa ISO da
// supabase-js. `user_id` non serve: RLS isola gia la riga.
const REVIEW_LOG_TABLE = 'review_log';
const REVIEW_LOG_COLUMNS = 'exercise_id, outcome, reviewed_at, grammar_point';

// La RPC transazionale della SCRITTURA (AD-7, a DB dalla 3.9): inserisce in
// `review_log` con `on conflict (review_id) do nothing` e aggiorna `review_state`
// solo se l'insert ha prodotto una riga. Riceve i valori GIÀ calcolati dal client
// (nessuna logica di valutazione/scheduling in SQL). Il nome vive qui una sola
// volta (AD-2).
const APPLY_REVIEW_FN = 'apply_review';
const POSTPONE_REVIEWS_FN = 'postpone_reviews';

// Forma GREZZA di una riga `review_log` come arriva da Supabase. La riga porta la
// proiezione COMPLETA (statistiche derivate, AD-18): l'identita dell'esercizio,
// l'esito, l'istante e il punto grammaticale denormalizzato.
interface ReviewLogRow {
  readonly exercise_id: unknown;
  readonly outcome: unknown;
  readonly reviewed_at: unknown;
  readonly grammar_point: unknown;
}

// Testimone RUNTIME dell'insieme esiti, dalla fonte UNICA di `schedule.ts`: la
// validazione dell'adattatore usa la STESSA costante da cui deriva `ReviewOutcome`,
// cosi un esito nuovo si aggiunge in un solo punto.
const OUTCOME_SET: ReadonlySet<string> = new Set(REVIEW_OUTCOMES);

/**
 * Mappa PURA di una riga grezza di `review_log` in `ReviewLogRecord` di dominio:
 * `exercise_id` (stringa) diventa `exerciseId`; `outcome` (membro di
 * `REVIEW_OUTCOMES`) diventa `outcome`; `reviewed_at` (stringa ISO) diventa
 * `reviewedAt: Date`; `grammar_point` (stringa, come `exercise_id`) diventa
 * `grammarPoint`. Su riga non-oggetto, `exercise_id` non stringa, `outcome` fuori
 * da `REVIEW_OUTCOMES`, `reviewed_at` non stringa o timestamp non parsabile, o
 * `grammar_point` non stringa LANCIA un `DataError('listReviewLog')` — una riga
 * rotta è un fallimento, non un valore degradato (alimenta TanStack Query, che
 * esige un reject).
 */
function toReviewLogRecord(row: ReviewLogRow): ReviewLogRecord {
  if (row === null || typeof row !== 'object') {
    throw new DataError('listReviewLog', new Error('riga review_log non è un oggetto'));
  }
  const { exercise_id, outcome, reviewed_at, grammar_point } = row;
  if (typeof exercise_id !== 'string') {
    throw new DataError('listReviewLog', new Error('riga review_log malformata'));
  }
  if (typeof outcome !== 'string' || !OUTCOME_SET.has(outcome)) {
    throw new DataError('listReviewLog', new Error('outcome review_log non valido'));
  }
  if (typeof reviewed_at !== 'string') {
    throw new DataError('listReviewLog', new Error('riga review_log malformata'));
  }
  if (typeof grammar_point !== 'string') {
    throw new DataError('listReviewLog', new Error('grammar_point review_log non valido'));
  }
  const reviewedAt = new Date(reviewed_at);
  if (Number.isNaN(reviewedAt.getTime())) {
    throw new DataError('listReviewLog', new Error('timestamp review_log non valido'));
  }
  return {
    exerciseId: exercise_id,
    outcome: outcome as ReviewOutcome,
    reviewedAt,
    grammarPoint: grammar_point,
  };
}

// Forma GREZZA di una riga `review_state`. `due_at`/`last_reviewed_at` sono
// timestamptz, che supabase-js consegna come stringa ISO; `last_reviewed_at` è
// null finché l'esercizio non è mai stato ripassato.
interface ReviewStateRow {
  readonly exercise_id: unknown;
  readonly stage: unknown;
  readonly due_at: unknown;
  readonly review_count: unknown;
  readonly lapse_count: unknown;
  readonly last_reviewed_at: unknown;
  readonly exercise?: unknown;
}

/**
 * La lezione di ogni esercizio, dalle righe grezze. TOLLERANTE: una riga senza
 * lezione leggibile non entra nella mappa (il rientro dolce la tratta da sola).
 */
function lessonsOf(rows: readonly ReviewStateRow[]): ReadonlyMap<string, string> {
  const lessons = new Map<string, string>();
  for (const row of rows) {
    const exercise = row?.exercise as { lesson_id?: unknown } | null | undefined;
    if (typeof row?.exercise_id === 'string' && typeof exercise?.lesson_id === 'string') {
      lessons.set(row.exercise_id, exercise.lesson_id);
    }
  }
  return lessons;
}

/**
 * Mappa PURA di una riga grezza in `ReviewState` di dominio: `due_at` e
 * `last_reviewed_at` diventano `Date` (`last_reviewed_at` null resta `null`). Su
 * riga malformata (tipi inattesi, timestamp non parsabile) LANCIA un
 * `DataError('listDue')` — una riga rotta è un fallimento, non un valore
 * degradato.
 */
function toReviewState(row: ReviewStateRow): ReviewState {
  // Guardia null/non-oggetto PRIMA della destrutturazione: una riga `null` o non
  // oggetto è malformata (DataError), non un `TypeError` grezzo che sfuggirebbe
  // al contratto «riga malformata ⇒ DataError».
  if (row === null || typeof row !== 'object') {
    throw new DataError('listDue', new Error('riga review_state non è un oggetto'));
  }
  const {
    exercise_id,
    stage,
    due_at,
    review_count,
    lapse_count,
    last_reviewed_at,
  } = row;

  if (
    typeof exercise_id !== 'string' ||
    typeof stage !== 'number' ||
    typeof due_at !== 'string' ||
    typeof review_count !== 'number' ||
    typeof lapse_count !== 'number' ||
    (last_reviewed_at !== null && typeof last_reviewed_at !== 'string')
  ) {
    throw new DataError('listDue', new Error('riga review_state malformata'));
  }

  const dueAt = new Date(due_at);
  const lastReviewedAt =
    last_reviewed_at !== null ? new Date(last_reviewed_at) : null;
  if (
    Number.isNaN(dueAt.getTime()) ||
    (lastReviewedAt !== null && Number.isNaN(lastReviewedAt.getTime()))
  ) {
    throw new DataError('listDue', new Error('timestamp review_state non valido'));
  }

  return {
    exerciseId: exercise_id,
    stage,
    dueAt,
    reviewCount: review_count,
    lapseCount: lapse_count,
    lastReviewedAt,
  };
}

/**
 * Costruisce l'adattatore Supabase della porta ReviewRepository attorno a un
 * `SupabaseClient` INIETTATO (lo stesso client di AuthGateway: la lettura RLS
 * richiede la sessione dell'accesso).
 */
export function createSupabaseReviewRepository(
  client: SupabaseClient,
): ReviewRepository {
  return {
    async listDue(now: Date, timeZone: string): Promise<readonly ReviewState[]> {
      // Su errore Supabase LANCIA (reject). Poi mappa OGNI riga in ReviewState e
      // ritorna SOLO quelle per cui `isDue(state, now)` (autorità di dominio,
      // AD-5), meno gli arretrati che `spreadBacklog` rinvia ai giorni dopo.
      const { data, error } = await client
        .from(REVIEW_STATE_TABLE)
        .select(REVIEW_STATE_COLUMNS);

      if (error) {
        throw new DataError('listDue', error);
      }

      const rows = (data ?? []) as readonly ReviewStateRow[];
      const states = rows.map(toReviewState);
      const lessons = lessonsOf(rows);
      const postponed = spreadBacklog(states, lessons, now, timeZone);
      if (postponed.length > 0) {
        // Best-effort: l'esito non conta, un errore non rompe la pila (vedi in testa).
        try {
          await client.rpc(POSTPONE_REVIEWS_FN, {
            exercise_ids: postponed.map((p) => p.exerciseId),
            due_ats: postponed.map((p) => p.dueAt.toISOString()),
            still_due_before: backlogBefore(now, timeZone).toISOString(),
          });
        } catch {
          // La lettura dopo riprova.
        }
      }
      const moved = new Set(postponed.map((p) => p.exerciseId));
      const due = states.filter((state) => isDue(state, now) && !moved.has(state.exerciseId));
      return mixByLesson(due, lessons, studyDayOrdinal(now, timeZone));
    },

    async countPostponed(now: Date, timeZone: string): Promise<number> {
      // Stessa lettura di `listDue` (RLS isola le righe dell'utente); il conteggio
      // è del dominio (`postponedAhead`). Su errore LANCIA come `listDue`.
      const { data, error } = await client
        .from(REVIEW_STATE_TABLE)
        .select(REVIEW_STATE_COLUMNS);

      if (error) {
        throw new DataError('countPostponed', error);
      }

      const rows = (data ?? []) as readonly ReviewStateRow[];
      return postponedAhead(rows.map(toReviewState), now, timeZone);
    },

    async listReviewLog(): Promise<readonly ReviewLogRecord[]> {
      // Canale unico delle statistiche derivate (AD-18): legge TUTTO il log (RLS
      // per-utente, poche righe) senza filtro `isDue` — la dovutezza non c'entra
      // col log delle risposte. Porta la riga COMPLETA (exercise_id/outcome/
      // reviewed_at/grammar_point): lo streak legge solo l'istante, 5.2 deriva lo
      // stadio, 5.3 aggrega per punto grammaticale. Su errore Supabase LANCIA
      // (reject); ogni riga passa da `toReviewLogRecord`, che LANCIA su
      // riga/esito/timestamp/punto malformato.
      const { data, error } = await client
        .from(REVIEW_LOG_TABLE)
        .select(REVIEW_LOG_COLUMNS);

      if (error) {
        throw new DataError('listReviewLog', error);
      }

      const rows = (data ?? []) as readonly ReviewLogRow[];
      return rows.map(toReviewLogRecord);
    },

    async applyReview(input: ApplyReviewInput): Promise<void> {
      // SCRITTURA del ciclo (AD-7): UNA chiamata idempotente alla RPC transazionale
      // `apply_review`. Mappa camel→snake e `Date`→ISO (timestamptz), trasportando i
      // valori GIÀ calcolati dal client — nessun ricalcolo qui né in SQL. Su errore
      // Supabase LANCIA `DataError('applyReview')` (reject): alimenta il retry di
      // TanStack, che con lo STESSO `review_id` è idempotente (`on conflict do nothing`).
      const { error } = await client.rpc(APPLY_REVIEW_FN, {
        review_id: input.reviewId,
        exercise_id: input.exerciseId,
        outcome: input.outcome,
        stage: input.stage,
        due_at: input.dueAt.toISOString(),
        reviewed_at: input.reviewedAt.toISOString(),
        used_explanation: input.usedExplanation,
      });

      if (error) {
        throw new DataError('applyReview', error);
      }
    },
  };
}
