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
 * classificato. `wrong-password` è prodotto dall'accesso (storia 1.7): password
 * errata ed email inesistente collassano entrambe su `invalid_credentials`,
 * quindi sullo stesso reason — l'esistenza dell'email non è rivelata. Tutti e
 * quattro i fallimenti passano dall'unico traduttore.
 */
export type AuthFailureReason =
  | 'email-already-registered'
  | 'weak-password'
  | 'invalid-email'
  | 'wrong-password'
  | 'unknown';

/**
 * Forma CONDIVISA d'esito di un'operazione di autenticazione. Union DISCRIMINATA
 * sul campo `ok`: nel ramo di fallimento porta esclusivamente un `reason` di
 * dominio, mai un messaggio del vendor. Registrazione e accesso hanno la stessa
 * forma d'esito e la stessa classificazione degli errori.
 */
export type AuthResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: AuthFailureReason };

/** Esito di una registrazione (alias, invariato per 1.6). */
export type SignUpResult = AuthResult;

/** Esito di un accesso: identico per forma e classificazione al signup (1.7). */
export type SignInResult = AuthResult;

/**
 * Funzione di disiscrizione restituita da `onAuthStateChange`: chiamarla ferma
 * le notifiche. Tipo PURO (nessun oggetto sottoscrizione del vendor sopra data).
 */
export type Unsubscribe = () => void;

/**
 * Porta di autenticazione dichiarata dal dominio (AD-2). L'adattatore concreto
 * vive in src/data/ ed è l'unico a conoscere Supabase.
 *
 * Il dominio non vede MAI una `Session` di Supabase: lo stato autenticato è
 * esposto come `boolean`. L'id utente non serve ad alcun AC di 1.7 (lo
 * introdurranno 1.8/1.9 quando lo useranno). Ogni metodo ha confine TOTALE: la
 * porta non rifiuta mai.
 */
export interface AuthGateway {
  /** Registra un nuovo account (FR1.5, storia 1.6). */
  signUp(credentials: Credentials): Promise<SignUpResult>;
  /** Accede con un account esistente (FR1.2, storia 1.7). */
  signIn(credentials: Credentials): Promise<SignInResult>;
  /** Disconnette la sessione corrente (FR1.2). Non rifiuta mai: `void`. */
  signOut(): Promise<void>;
  /** Vero se esiste una sessione valida (FR1.3, letta al boot). */
  isAuthenticated(): Promise<boolean>;
  /**
   * Notifica ogni cambio dello stato di autenticazione come `boolean`; ritorna
   * una `Unsubscribe` per fermare le notifiche.
   */
  onAuthStateChange(listener: (authenticated: boolean) => void): Unsubscribe;
}
