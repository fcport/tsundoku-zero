// Livello domain: la SECONDA legge del ciclo di ripasso di Epic 3 (`AD-24`), puro
// complemento di `schedule()` (3.1) e consumatore della correttezza di `check()`
// (Epic 2). L'esito SI CALCOLA, non si dichiara: se lo dichiarasse l'utente, lo
// streak potrebbe mentire. Puro come `./schedule` e `./exercise`: nessun import
// esterno, nessun global di piattaforma, nessun `Date.now()`/`new Date()` senza
// argomenti, nessun `Math.random()`. L'esito NON dipende dal tempo: `outcomeOf`
// non riceve né usa `now`, così l'esito calcolato offline è IDENTICO a quello
// online (`AD-24`).
//
// Riusa i tipi canonici senza ridefinirli: `CheckOutcome` da `./exercise`
// (l'input di correttezza) e `ReviewOutcome` da `./schedule` (l'union prodotta).
// Una sola definizione di ciascun tipo. Questo modulo è l'UNICO punto del codice
// che PRODUCE un esito: la UI raccoglie i fatti, il dominio li traduce.

import type { CheckOutcome } from './exercise';
import type { ReviewOutcome } from './schedule';

/**
 * Traduce fatti già raccolti nell'esito SRS. Consuma la CORRETTEZZA
 * (`CheckOutcome` di `check()`, NON la risposta grezza né l'`Exercise`: non
 * ricalcola la validazione), se la spiegazione è stata consultata prima di
 * rispondere (`usedExplanation`) e se l'utente ha dichiarato «facile»
 * (`declaredEasy`). PURA e TOTALE: stessa terna ⇒ stesso esito, sempre; nessuna
 * mutazione; sincrona; nessuna rete.
 *
 * Precedenza fissa, che ritorna LETTERALI dell'union (così la sonda di sola
 * autorità ha qualcosa da rilevare):
 * - `again` esige solo la scorrettezza, valutata per prima: dichiarare «facile»
 *   o consultare la spiegazione non salva una risposta errata — è ciò che
 *   impedisce allo streak di mentire.
 * - `hard` se corretta ma con aiuto: la correttezza precede l'aiuto, l'aiuto
 *   declassa. Valutato prima di `easy` perché `easy` esige «senza aiuto».
 * - `easy` SOLO se corretta, senza aiuto e dichiarata: unico caso `easy`.
 * - `good` altrimenti: corretta, senza aiuto, non dichiarata — il caso base.
 */
export function outcomeOf(
  check: CheckOutcome,
  usedExplanation: boolean,
  declaredEasy: boolean,
): ReviewOutcome {
  if (!check.correct) return 'again'; // la scorrettezza domina tutto
  if (usedExplanation) return 'hard'; // corretta ma con aiuto
  if (declaredEasy) return 'easy'; // corretta, senza aiuto, dichiarata
  return 'good'; // corretta, senza aiuto
}
