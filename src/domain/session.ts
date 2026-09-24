// Livello domain: la QUARTA legge di Epic 3 (`AD-6`) — la coda di una sessione di
// esercizi ha UNA SOLA verità su chi resta e chi esce. Se lo decidesse la UI (FR5.4
// «intervallo 0 = in fondo alla coda»), la stessa risposta produrrebbe code diverse
// a seconda della schermata, e una sessione potrebbe «finire» con esercizi ancora
// sbagliati. Qui la coda è un RIDUTTORE PURO: uno store (3.4) che la ospita non fa
// che delegare, e nessuna schermata futura (3.18+) può metterci logica.
//
// Puro come `./schedule` e `./due`: nessun import esterno, nessun global di
// piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Intl…resolvedOptions()`, nessun `Math.random()`. L'istante `now` ENTRA dentro
// l'evento (`sessionReducer.length === 2`), mai letto dall'orologio.
//
// La decisione requeue-o-esci è DELEGATA a `isDue` (`AD-5`): l'intervallo è 0 se e
// solo se `dueAt === now`, cioè se e solo se `isDue(result, now)`. Così la coda di
// sessione e la pila della dashboard non possono mai divergere su cosa è «dovuto».

import type { ReviewState } from './schedule';
import { isDue } from './due';

/**
 * Lo stato di una sessione: la coda ORDINATA degli id degli esercizi ancora da
 * valutare. `readonly` a ogni livello — il riduttore non muta mai, ritorna sempre
 * un nuovo stato. La forma interna (array ordinato) è un SEGRETO del dominio: i
 * consumatori leggono `currentExerciseId`/`isComplete`, non indicizzano `queue[0]`.
 */
export type SessionState = { readonly queue: readonly string[] };

/**
 * Un evento che il riduttore consuma. Oggi ce n'è uno solo: `reviewed`, l'esito di
 * una valutazione (`result = schedule(state, outcome, now)`) con l'istante `now` in
 * cui è avvenuta. `now` viaggia DENTRO l'evento perché il dominio non legge mai
 * l'orologio (`AD-1`): il chiamante cattura l'istante e lo passa.
 */
export type SessionEvent = { type: 'reviewed'; result: ReviewState; now: Date };

/**
 * Costruisce una sessione dalla lista ordinata degli id. PURA: copia gli id in una
 * nuova coda (non trattiene il riferimento all'array del chiamante). Una lista
 * vuota produce una sessione già completa (`isComplete` true, `currentExerciseId`
 * null).
 */
export function createSession(ids: readonly string[]): SessionState {
  return { queue: [...ids] };
}

/**
 * L'UNICO punto che decide chi resta e chi esce dalla coda (`AD-6`). PURO,
 * sincrono, TOTALE e senza mutazione — stessa coppia `(state, event)` ⇒ stesso
 * `SessionState` nuovo, sempre (`sessionReducer.length === 2`).
 *
 * Su `reviewed`: rimuove l'id valutato dalla coda; se era presente E l'esito è
 * ancora dovuto adesso (`isDue(result, now)` — intervallo risultante 0, cioè un
 * `again` o un `hard` a stadio 0), lo RIACCODA in fondo; altrimenti resta rimosso
 * (intervallo > 0, l'esercizio è superato per questa sessione). Un id non in coda
 * lascia lo stato invariato. La dovutezza NON è reimplementata qui: la stabilisce
 * `isDue` di `../due`, l'unica definizione di «dovuto» (`AD-5`).
 */
export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'reviewed': {
      const id = event.result.exerciseId;
      const remaining = state.queue.filter((qid) => qid !== id);
      const wasQueued = remaining.length !== state.queue.length;
      // intervallo 0 ⇔ ancora dovuto adesso ⇔ resta in sessione (in fondo)
      return wasQueued && isDue(event.result, event.now)
        ? { queue: [...remaining, id] }
        : { queue: remaining };
    }
  }
  // Union chiusa: aggiungere un tipo di SessionEvent senza gestirlo qui
  // diventa un errore di COMPILAZIONE (`event.type` non è più `never`).
  const _exhaustive: never = event.type;
  void _exhaustive;
  return state;
}

/**
 * La sessione è completa quando la coda è vuota: nessun esercizio resta ancora
 * dovuto. Superficie di LETTURA della coda — le schermate leggono «è finita?» da
 * qui, non da `state.queue.length`.
 */
export function isComplete(state: SessionState): boolean {
  return state.queue.length === 0;
}

/**
 * L'esercizio corrente è la testa della coda, `null` se la sessione è completa.
 * Superficie di LETTURA — le schermate leggono «l'esercizio corrente» da qui, non
 * indicizzando `state.queue[0]`: la forma interna resta un segreto del dominio.
 */
export function currentExerciseId(state: SessionState): string | null {
  return state.queue[0] ?? null;
}
