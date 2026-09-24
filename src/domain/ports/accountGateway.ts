// Livello domain: la PORTA di cancellazione account come tipi PURI (AD-1/AD-2).
// Nessun import esterno: il dominio non conosce React, @supabase/supabase-js,
// fetch né storage. Solo src/data/ implementa questa porta; src/app/ la istanzia
// e la inietta nelle schermate di features (features NON importa data).
//
// La cancellazione passa dall'unica Edge Function `delete-account` (AD-11):
// l'adattatore in data invoca la funzione, che verifica il chiamante dal suo JWT
// e cancella l'utente con la `service_role`. Le tabelle per-utente si svuotano
// per CASCATA su `auth.users` (on delete cascade, storia 1.5), non con
// cancellazioni tabella-per-tabella dal client. Il dominio non vede nulla di
// tutto ciò: espone solo l'esito.

/**
 * Forma d'esito di una cancellazione account. Union DISCRIMINATA sul campo `ok`,
 * modellata come `AuthResult` (authGateway.ts). Confine TOTALE: la porta non
 * rifiuta mai — ogni fallimento (funzione in errore, throw dell'SDK, rete) è
 * `{ ok:false, reason:'unknown' }`, mai una promise rifiutata o un messaggio
 * grezzo del vendor. Un solo `reason` perché la superficie non distingue le
 * cause: la cancellazione è riuscita o va ritentata.
 */
export type AccountDeletionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unknown' };

/**
 * Porta di cancellazione account dichiarata dal dominio (AD-2). L'adattatore
 * concreto vive in src/data/ ed è l'unico a conoscere Supabase e la Edge
 * Function. Confine TOTALE: `deleteAccount` non rifiuta mai.
 */
export interface AccountGateway {
  /**
   * Cancella l'account dell'utente corrente attraverso l'Edge Function
   * autenticata (FR1.4, AD-11). Non rifiuta mai: ritorna sempre un
   * `AccountDeletionResult` di dominio.
   */
  deleteAccount(): Promise<AccountDeletionResult>;
}
