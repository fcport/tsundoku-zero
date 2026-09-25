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

/** Millisecondi in un giorno: la scala è in giorni, `dueAt` è una `Date` in ms. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Frazione dell'intervallo usata come AMPIEZZA MASSIMA della dispersione: la
 * finestra di jitter è `[base, base × (1 + DISPERSION_FRACTION))`. È PROPORZIONALE
 * all'intervallo, così un intervallo `0` produce jitter `0` senza casi speciali e
 * la dispersione non riordina mai le scadenze rispetto allo stadio.
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
 * Il MOTORE: dato uno stato, un esito e l'istante `now`, restituisce il PROSSIMO
 * stato di ripasso. PURO e TOTALE — stessa terna `(state, outcome, now)` ⇒ stesso
 * risultato, sempre — e NON MUTA l'input (ritorna un nuovo oggetto). `now` è
 * SEMPRE un parametro esplicito (il modulo non legge l'orologio, AD-1).
 *
 * Logica senza rami per gli estremi:
 * - `s = clamp(nextStageFor(stage, outcome))` in `[0, MAX_STAGE]`;
 * - `intervalMs = scala[s] × fattoreEsito × MS_PER_DAY` (stadio 0 ⇒ 0 ms);
 * - `jitter = fraction(exerciseId, s) × intervalMs × DISPERSION_FRACTION` (0 se
 *   l'intervallo è 0, quindi `dueAt === now` esatto agli estremi bassi);
 * - `dueAt = now + intervalMs + jitter`.
 * Contatori: `reviewCount += 1`, `lapseCount += (outcome === 'again' ? 1 : 0)`,
 * `lastReviewedAt = now`.
 */
export function schedule(state: ReviewState, outcome: ReviewOutcome, now: Date): ReviewState {
  const s = Math.max(0, Math.min(MAX_STAGE, nextStageFor(state.stage, outcome)));
  const intervalMs = LEITNER_INTERVALS_DAYS[s] * OUTCOME_FACTOR[outcome] * MS_PER_DAY;
  const jitter = fraction(state.exerciseId, s) * intervalMs * DISPERSION_FRACTION;

  return {
    exerciseId: state.exerciseId,
    stage: s,
    dueAt: new Date(now.getTime() + intervalMs + jitter),
    reviewCount: state.reviewCount + 1,
    lapseCount: state.lapseCount + (outcome === 'again' ? 1 : 0),
    lastReviewedAt: now,
  };
}
