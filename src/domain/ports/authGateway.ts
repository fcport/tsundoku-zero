// Livello domain: la PORTA di autenticazione come tipi PURI (AD-1/AD-2).
// Nessun import esterno: il dominio non conosce React, @supabase/supabase-js,
// fetch né storage. Solo src/data/ implementa questa porta; src/app/ la istanzia
// e la inietta nelle schermate di features (features NON importa data).
//
// La union chiusa `AuthFailureReason` è il contratto centrale di FR1.5: ogni
// fallimento prevedibile è uno dei suoi membri, mai una stringa grezza di
// Supabase. Il traduttore in features/auth ha per ingresso QUESTA union, perciò
// per costruzione nessun messaggio grezzo del vendor può raggiungere l'utente.

/**
 * Credenziali di accesso: sola email e password (nessuna conferma, nessun
 * onboarding, nessun questionario di livello — FR1.5).
 */
export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/**
 * Union LETTERALE chiusa dei fallimenti di autenticazione. I quattro fallimenti
 * prevedibili di FR1.5 (email già registrata, password troppo debole, email in
 * formato non valido, password errata) più `unknown` per ogni esito non
 * classificato. `wrong-password` non è prodotto dal signup (lo produrrà
 * l'accesso, storia 1.7) ma il contratto lo dichiara qui perché tutti e quattro
 * i fallimenti passano dall'unico traduttore.
 */
export type AuthFailureReason =
  | 'email-already-registered'
  | 'weak-password'
  | 'invalid-email'
  | 'wrong-password'
  | 'unknown';

/**
 * Esito di una registrazione. Union DISCRIMINATA sul campo `ok`: nel ramo di
 * fallimento porta esclusivamente un `reason` di dominio, mai un messaggio del
 * vendor.
 */
export type SignUpResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: AuthFailureReason };

/**
 * Porta di autenticazione dichiarata dal dominio (AD-2). L'adattatore concreto
 * vive in src/data/ ed è l'unico a conoscere Supabase.
 */
export interface AuthGateway {
  signUp(credentials: Credentials): Promise<SignUpResult>;
}
