// Livello domain (5.2): la DISTRIBUZIONE degli esercizi per stadio di scheduling
// (FR7.2). Come lo streak (`./streak`) e le risposte nel tempo (`./answersOverTime`),
// SI CALCOLA dal solo `review_log` (AD-18), mai da `review_state`/`review_count`/lo
// `stage` memorizzato: quelli sarebbero un secondo numero difendibile e divergente.
//
// Perche DERIVARE e non leggere: lo stadio corrente vive in `review_state.stage`,
// ma AD-18 vieta le statistiche da `review_state`. `review_log` non porta `stage`,
// ma porta `exerciseId` + `outcome` + `reviewedAt`. Rigiocare gli esiti di un
// esercizio dallo stadio 0 attraverso la STESSA transizione che `schedule` usa
// (`nextStage`, l'unica del motore) RICOSTRUISCE lo stadio corrente — l'idempotenza
// della RPC `apply_review` tiene log e stato allineati — ma dal SOLO log.
//
// Pura come `./streak`, `./due`, `./schedule`: nessun import esterno, nessun global
// di piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Math.random()`. A differenza di streak e answersOverTime, e SENZA `now`/`timeZone`:
// lo STADIO non dipende dall'orologio (`nextStage` opera solo su `(stage, outcome)`),
// quindi la firma e a UN solo argomento (`stageDistribution.length === 1`). L'asse
// dei sei stadi DERIVA da `LEITNER_INTERVALS_DAYS.length` di `./schedule` (AD-17),
// mai da un elenco parallelo.
import { LEITNER_INTERVALS_DAYS, nextStage } from './schedule';
import type { ReviewLogRecord } from './streak';

/**
 * Il conteggio degli esercizi il cui stadio finale ricostruito e `stage`. `stage`
 * e l'indice nella scala Leitner (`0..LEITNER_INTERVALS_DAYS.length - 1`); `count`
 * e il numero di esercizi in quel bucket (>= 0: gli stadi senza esercizi compaiono
 * con `0`).
 */
export interface StageCount {
  readonly stage: number;
  readonly count: number;
}

/**
 * La distribuzione degli esercizi per stadio di scheduling, derivata dal SOLO
 * `review_log` (AD-18). PURA, sincrona, TOTALE e senza mutazione — stesso `log` ⇒
 * stessa distribuzione, sempre — e SENZA tempo (`stageDistribution.length === 1`):
 * lo stadio non dipende dall'orologio.
 *
 * Raggruppa le voci per `exerciseId`; per ogni esercizio ordina i suoi esiti per
 * `reviewedAt` crescente e ne fa la fold dallo stadio 0 attraverso `nextStage`
 * (l'unica transizione del motore), ottenendo lo stadio FINALE; conta gli esercizi
 * per stadio finale. Ritorna un `StageCount` per OGNI stadio `0..N-1` (dove
 * `N = LEITNER_INTERVALS_DAYS.length`, sei), CONTIGUO e con gli stadi a 0 inclusi;
 * l'ordine di arrivo delle voci e irrilevante (la fold e per `reviewedAt`, non per
 * ordine d'arrivo). Un esercizio conta UNA sola volta, al suo stadio finale.
 *
 * Gli esercizi MAI ripassati (assenti dal log) NON compaiono: la distribuzione
 * descrive lo studio effettivo, non l'intero catalogo (leggere `review_state` per
 * includerli e vietato, AD-18).
 *
 * Log vuoto ⇒ `[]` (nessun asse): la vista rende un placeholder testuale neutro,
 * non un riquadro di grafico vuoto (la ricca dichiarazione «cosa manca» e la 5.4).
 */
export function stageDistribution(
  log: readonly ReviewLogRecord[],
): readonly StageCount[] {
  if (log.length === 0) return [];

  // Raggruppa gli esiti per esercizio (una lista di voci per exerciseId).
  const byExercise = new Map<string, ReviewLogRecord[]>();
  for (const record of log) {
    const entries = byExercise.get(record.exerciseId);
    if (entries) entries.push(record);
    else byExercise.set(record.exerciseId, [record]);
  }

  // Per ogni esercizio: ordina per reviewedAt crescente e fa la fold degli esiti
  // da stadio 0 via nextStage; poi incrementa il bucket dello stadio finale.
  const N = LEITNER_INTERVALS_DAYS.length;
  const counts = new Array<number>(N).fill(0);
  for (const entries of byExercise.values()) {
    const sorted = [...entries].sort(
      (a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime(),
    );
    let stage = 0;
    for (const record of sorted) {
      stage = nextStage(stage, record.outcome);
    }
    counts[stage] += 1;
  }

  // L'asse: un StageCount per OGNI stadio 0..N-1 (contiguo, zeri inclusi).
  return counts.map((count, stage) => ({ stage, count }));
}
