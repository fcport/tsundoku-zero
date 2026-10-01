// Livello domain: il MOTORE DI SCHEDULING (scala Leitner) PURO e SATURO (AD-1).
// Prima legge del ciclo di ripasso di Epic 3: da questa costante deriveranno il
// `CHECK` SQL su `review_state.stage` e l'asse delle statistiche. Puro come
// `./uuid` e `./exercise`: nessun import esterno, nessun global di piattaforma,
// nessun `Date.now()`/`new Date()` senza argomenti, nessun `Math.random()`. Ogni
// istante temporale ENTRA come parametro `now: Date`.
//
// Chiave del design: NIENTE RAMI per gli estremi. Si sceglie lo stadio prossimo
// per esito, poi si CLAMP aritmeticamente (`Math.min`/`Math.max`); l'intervallo è
// un unico prodotto `scala[nextStage] × fattoreEsito`. Lo stadio 0 (intervallo 0)
// e lo stadio 5 saturato cadono fuori da soli, senza `if (stage === 0/5)`.
//
// L'hash della dispersione (`fnv1a`) NON è più definito qui: vive in `./hash`
// (estrazione pura, i test di questo modulo restano verdi), condiviso con l'ordine
// deterministico delle opzioni (`exercise-presentation.ts`), così non esistono due
// definizioni che un giorno divergerebbero.

import { fnv1a } from './hash';
import { studyDayOrdinal, studyDayStart } from './calendarDay';

/**
 * L'UNICA costante degli esiti SRS (AC4 di 3.8): l'insieme dei quattro gradini
 * di Anki/Leitner. Come `LEITNER_INTERVALS_DAYS`, è UNA sola definizione da cui
 * derivano sia il tipo `ReviewOutcome` sia il TESTIMONE RUNTIME che il test di
 * migrazione confronta con il `CHECK (outcome in (...))` di `review_log`:
 * aggiungere un esito è un cambiamento in un solo punto, e un `CHECK` SQL
 * disallineato diventa CI rossa. L'ordine è quello di precedenza crescente della
 * scala (`again` fallito → `easy` banale); l'insieme, non l'ordine, è ciò che il
 * test verifica.
 */
export const REVIEW_OUTCOMES = ['again', 'hard', 'good', 'easy'] as const;

/**
 * Esito SRS di un ripasso, nella scala a quattro gradini di Anki/Leitner.
 * `again` fallito (torna in fondo), `hard` faticoso (resta, intervallo ridotto),
 * `good` corretto (avanza di 1), `easy` banale (avanza di 2). DERIVATO da
 * `REVIEW_OUTCOMES`: la union resta identica, ma la fonte è la costante runtime.
 */
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

/**
 * Lo stato di ripasso di un esercizio: value object di RUNTIME (non passa dal kit
 * di `./schema`, che serve al contenuto validato dei file di lezione). `exerciseId`
 * è l'identità stabile; `stage` è l'indice nella scala Leitner; `dueAt` la prossima
 * scadenza; `reviewCount`/`lapseCount` i contatori cumulativi; `lastReviewedAt`
 * l'istante dell'ultimo ripasso (`null` se mai ripassato).
 */
export interface ReviewState {
  readonly exerciseId: string;
  readonly stage: number;
  readonly dueAt: Date;
  readonly reviewCount: number;
  readonly lapseCount: number;
  readonly lastReviewedAt: Date | null;
}

/**
 * L'UNICA costante di scala Leitner (AC1): gli INDICI sono gli stadi `0`–`5`, i
 * VALORI gli intervalli in giorni. Lo stadio massimo si DERIVA da `length - 1`,
 * non da una seconda costante: aggiungere un gradino qui basta a estendere la
 * scala senza toccare altro.
 */
export const LEITNER_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35] as const;

/** Stadio massimo, DERIVATO dalla scala (5), non una seconda costante. */
const MAX_STAGE = LEITNER_INTERVALS_DAYS.length - 1;

/**
 * Frazione dell'intervallo usata come AMPIEZZA MASSIMA della dispersione: la
 * finestra di jitter è `[base, base × (1 + DISPERSION_FRACTION))` giorni, poi
 * arrotondata al giorno intero (la scadenza cade sempre all'inizio di una giornata
 * di studio). È PROPORZIONALE all'intervallo, così un intervallo `0` produce jitter
 * `0` senza casi speciali; sugli intervalli lunghi sparge i ripassi su più giorni.
 */
const DISPERSION_FRACTION = 0.25;

/**
 * Fattore moltiplicativo dell'intervallo per esito. `hard` accorcia al 60%; gli
 * altri lasciano l'intervallo pieno dello stadio prossimo. Un `Record` esaustivo
 * su `ReviewOutcome`: un esito nuovo sarebbe errore di COMPILAZIONE.
 */
const OUTCOME_FACTOR: Record<ReviewOutcome, number> = {
  again: 1,
  hard: 0.6,
  good: 1,
  easy: 1,
};

/**
 * Sceglie lo stadio prossimo per esito, PRIMA del clamp: `again` azzera, `hard`
 * tiene, `good` avanza di 1, `easy` di 2. Nessun ramo per gli estremi: il clamp
 * del chiamante porta un `stage + 2` oltre il tetto a `MAX_STAGE` e un `hard` a
 * stadio 0 resta 0. Totale ed esaustiva su `ReviewOutcome`.
 */
function nextStageFor(stage: number, outcome: ReviewOutcome): number {
  switch (outcome) {
    case 'again':
      return 0;
    case 'hard':
      return stage;
    case 'good':
      return stage + 1;
    case 'easy':
      return stage + 2;
  }
}

/**
 * L'UNICA transizione di STADIO del motore, esposta pura e totale: dato uno stadio
 * e un esito, restituisce lo stadio PROSSIMO gia CLAMPATO in `[0, MAX_STAGE]`
 * (`Math.max(0, Math.min(MAX_STAGE, nextStageFor(...)))`). Incapsula sia la scelta
 * per esito (`nextStageFor`) sia il clamp aritmetico che `schedule` applicava
 * inline, cosi non esistono due definizioni della transizione: `schedule` la usa
 * per lo stato prossimo e `stageDistribution` (5.2) la usa per RICOSTRUIRE lo
 * stadio corrente rigiocando gli esiti dal log (AD-18), senza duplicare ne la
 * logica ne i valori della scala. Senza tempo: lo stadio non dipende dall'orologio.
 */
export function nextStage(stage: number, outcome: ReviewOutcome): number {
  return Math.max(0, Math.min(MAX_STAGE, nextStageFor(stage, outcome)));
}

/**
 * Frazione DETERMINISTICA in `[0, 1)` derivata da `exerciseId` e dallo stadio
 * risultante `s` (Design Notes): FNV-1a su `` `${exerciseId}:${s}` `` diviso per
 * `2**32`. A parità di `stage`/`now`/`outcome` due esercizi differiscono solo per
 * `exerciseId`, quindi ricevono scadenze diverse (AC5); ripetere il calcolo dà
 * esattamente la stessa frazione. Pura e sincrona come `uuidv5`.
 */
function fraction(exerciseId: string, stage: number): number {
  return fnv1a(`${exerciseId}:${stage}`) / 2 ** 32;
}

/**
 * Il MOTORE: dato uno stato, un esito, l'istante `now` e il fuso dello studente,
 * restituisce il PROSSIMO stato di ripasso. PURO e TOTALE — stessa quaterna ⇒
 * stesso risultato, sempre — e NON MUTA l'input (ritorna un nuovo oggetto). `now` e
 * `timeZone` sono SEMPRE parametri espliciti (il modulo non legge l'orologio, AD-1).
 *
 * - `s = clamp(nextStageFor(stage, outcome))` in `[0, MAX_STAGE]`;
 * - `giorni = scala[s] × fattoreEsito`, più il jitter
 *   `fraction(exerciseId, s) × giorni × DISPERSION_FRACTION`, arrotondato al giorno
 *   intero e mai sotto 1 (un intervallo positivo non torna nella stessa giornata);
 * - intervallo 0 (stadio 0) ⇒ `dueAt === now`: l'esercizio resta in sessione;
 * - altrimenti `dueAt` = l'INIZIO di quella giornata di studio (le 2 locali, vedi
 *   `studyDayStart`), così la pila si riempie tutta insieme invece di gocciolare
 *   durante il giorno.
 * Contatori: `reviewCount += 1`, `lapseCount += (outcome === 'again' ? 1 : 0)`,
 * `lastReviewedAt = now`.
 */
export function schedule(
  state: ReviewState,
  outcome: ReviewOutcome,
  now: Date,
  timeZone: string,
): ReviewState {
  const s = nextStage(state.stage, outcome);
  const intervalDays = LEITNER_INTERVALS_DAYS[s] * OUTCOME_FACTOR[outcome];
  const jitterDays = fraction(state.exerciseId, s) * intervalDays * DISPERSION_FRACTION;
  const days = intervalDays > 0 ? Math.max(1, Math.round(intervalDays + jitterDays)) : 0;
  const dueAt =
    days === 0 ? now : studyDayStart(studyDayOrdinal(now, timeZone) + days, timeZone);

  return {
    exerciseId: state.exerciseId,
    stage: s,
    dueAt,
    reviewCount: state.reviewCount + 1,
    lapseCount: state.lapseCount + (outcome === 'again' ? 1 : 0),
    lastReviewedAt: now,
  };
}
