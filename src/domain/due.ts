// Livello domain: la TERZA legge di Epic 3 (`AD-5`) — UNA SOLA definizione di
// «dovuto». La pila dei dovuti ha una sola verità: se dashboard, precarico di
// sessione e cancello di sblocco la calcolassero ciascuno per conto proprio, il
// numero mostrato e quello caricato potrebbero divergere. Qui vivono l'UNICO
// predicato di dovutezza (`isDue`) e l'UNICA identità della pila (`dueQueryKey`),
// così i consumatori futuri (3.10, 3.12+) non possano nascere divergenti.
//
// Puro come `./schedule` e `./outcome`: nessun import esterno, nessun global di
// piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Intl…resolvedOptions()`, nessun `Math.random()`. Ogni istante temporale ENTRA
// come parametro `now: Date` (`isDue.length === 2`).

import type { ReviewState } from './schedule';

/**
 * L'UNICO predicato di dovutezza (`AD-5`): dato uno stato di ripasso e l'istante
 * `now`, decide se l'esercizio è dovuto. PURO, sincrono, TOTALE e senza
 * mutazione — stessa coppia `(state, now)` ⇒ stesso booleano, sempre — e non
 * legge l'orologio: `now` è SEMPRE un parametro esplicito (AD-1).
 *
 * Confine INCLUSIVO (`<=`): un esercizio è dovuto se la sua scadenza è nel
 * passato O esattamente ora. Un intervallo `0` — un `again` o lo stadio 0, dove
 * `schedule()` produce `dueAt === now` — è quindi dovuto immediatamente
 * («di nuovo in questa sessione»).
 */
export function isDue(state: ReviewState, now: Date): boolean {
  return state.dueAt.getTime() <= now.getTime();
}

/**
 * L'identità della pila dei dovuti: la tupla `readonly` `['due', userId]`. È
 * l'UNICA definizione della chiave (`AD-5`), pura e framework-agnostica —
 * nessun consumatore la ridefinisce. Il dominio dichiara l'IDENTITÀ della pila;
 * i livelli esterni (TanStack Query in `src/data/`/`src/features/`) la useranno
 * come chiave di cache senza che il dominio conosca TanStack.
 */
export type DueQueryKey = readonly ['due', string];

/**
 * Costruisce l'identità della pila per un utente. PURA e DETERMINISTICA: stesso
 * `userId` ⇒ tuple uguali per valore; utenti diversi ⇒ secondo elemento diverso
 * (isolamento per-utente della cache).
 */
export function dueQueryKey(userId: string): DueQueryKey {
  return ['due', userId] as const;
}
