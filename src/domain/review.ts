// Livello domain: la PIPELINE di valutazione di una risposta (3.19), pura e
// composta dalle funzioni già scritte e testate di Epic 3 — `composeResponse`
// (3.19), `check` (Epic 2), `outcomeOf` (3.2), `schedule` (3.1). L'esito SI
// CALCOLA sul client, non si dichiara (AD-24): la UI raccoglie gli indici toccati,
// il dominio traduce in correttezza, esito SRS e prossimo stato di ripasso.
//
// Puro come `./outcome` e `./schedule`: nessun import esterno, nessun global di
// piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Math.random()`. L'istante `now` ENTRA come parametro (il modulo non legge
// l'orologio, AD-1); il `review_id` NON nasce qui (è glue di feature: `src/domain`
// vieta `crypto`). Questo modulo assembla la logica; `SessionScreen` monta l'input
// di persistenza attorno al risultato.
import { check } from './exercise';
import { composeResponse } from './exercise-presentation';
import { outcomeOf } from './outcome';
import { schedule, type ReviewOutcome, type ReviewState } from './schedule';
import type { Exercise } from './exercise';

/**
 * L'esito di una valutazione: la correttezza grezza (`check`), l'esito SRS
 * (`outcomeOf`) e il prossimo stato di ripasso (`schedule`, che porta `stage`
 * e `dueAt`). Un solo oggetto così il chiamante ne assembla `ApplyReviewInput`
 * senza rieseguire la pipeline.
 */
export interface AnswerEvaluation {
  readonly correct: boolean;
  readonly outcome: ReviewOutcome;
  readonly result: ReviewState;
}

/**
 * Valuta una risposta INTERAMENTE sul client (AD-24, AC4): compone la risposta
 * dagli indici toccati, la verifica, ne deriva l'esito SRS e schedula il prossimo
 * stato. PURA e TOTALE — stessa quintupla ⇒ stesso risultato, sempre — e non muta
 * l'input (`schedule` ritorna un nuovo stato).
 *
 * `declaredEasy` è HARD-WIRED `false`: nessun AC di Epic 3 introduce un controllo
 * «facile», quindi l'esito appartiene a `{again, hard, good}` (il ramo `easy`
 * resta nel dominio per completezza ma non è raggiungibile dalla UI). Non
 * aggiungere alcun controllo «facile».
 */
export function evaluateAnswer(
  exercise: Exercise,
  selected: readonly number[],
  usedExplanation: boolean,
  currentState: ReviewState,
  now: Date,
): AnswerEvaluation {
  const response = composeResponse(exercise, selected);
  const correct = check(exercise, response).correct;
  // declaredEasy sempre false in Epic 3 (nessun controllo «facile»).
  const outcome = outcomeOf({ correct }, usedExplanation, false);
  const result = schedule(currentState, outcome, now);
  return { correct, outcome, result };
}
