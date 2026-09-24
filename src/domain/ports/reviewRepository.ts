// Livello domain: la PORTA della pila dei dovuti come tipo PURO (AD-1/AD-2/AD-5).
// Nessun import esterno: il dominio non conosce Supabase, TanStack, fetch né SQL.
// Solo src/data/ implementa questa porta (l'adattatore concreto è la storia 3.10);
// src/app/ la istanzia e la inietta nelle schermate di features (features NON
// importa data). Qui si FISSA il canale unico di lettura prima che i consumatori
// nascano, con il contratto ancorato a `isDue` di `../due`.

import type { ReviewState } from '../schedule';

/**
 * Porta della lettura della pila dei dovuti dichiarata dal dominio (AD-2/AD-5).
 * L'adattatore concreto vive in src/data/ (storia 3.10) ed è l'unico a conoscere
 * Supabase e la tabella `review_state`.
 */
export interface ReviewRepository {
  /**
   * Legge la pila dei dovuti dell'utente corrente all'istante `now`. Restituisce
   * ESATTAMENTE gli stati per cui `isDue(state, now)` (di `../due`) è vero: la
   * porta NON reimplementa la dovutezza, la rispecchia. È l'UNICA interrogazione
   * dietro l'identità `dueQueryKey(userId)`: nessun consumatore ricalcola la
   * pila. Opera sull'utente corrente, senza parametro `userId`.
   */
  listDue(now: Date): Promise<readonly ReviewState[]>;
}
