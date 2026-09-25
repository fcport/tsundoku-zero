// Livello data (AD-2): l'UNICO livello che importa @supabase/supabase-js (la
// regola boundaries/external lo vieta a domain/ui/features tramite la sonda di
// confine; qui l'import è ammesso). Implementa la porta AuthGateway del dominio
// e mappa gli errori Supabase nella union chiusa `AuthFailureReason`.
//
// Il cuore della garanzia di FR1.5 è STRUTTURALE: due funzioni PURE ed esportate
// (`classifyAuthError`, `authResultFromResponse`) traducono la risposta di
// Supabase in un `AuthResult` di dominio. Sono CONDIVISE fra registrazione e
// accesso (stessa forma, stessa classificazione: `invalid_credentials →
// wrong-password`) e testabili senza client reale né rete: nessuna stringa
// grezza del vendor esce da qui verso i livelli superiori.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthFailureReason,
  AuthGateway,
  AuthResult,
  Credentials,
  SignInResult,
  SignUpResult,
  Unsubscribe,
} from '../domain/ports/authGateway';

// Forma MINIMA dell'errore Supabase che ci interessa classificare: il solo
// `code` stringa (ErrorCode di auth-js). Non dipendiamo dalla classe concreta
// AuthError — un oggetto con un `code` stringa basta, il che rende `classify`
// testabile con letterali semplici.
interface ClassifiableError {
  readonly code?: string | undefined;
}

// Forma MINIMA della risposta di auth.signUp / auth.signInWithPassword che ci
// interessa: la sessione (per distinguere "autenticato" da "nessun errore ma
// sessione assente") e l'errore. La stessa forma vale per registrazione e
// accesso.
interface AuthLikeResponse {
  readonly data: { readonly session: unknown } | null;
  readonly error: ClassifiableError | null;
}

/** Vero se `value` è un oggetto con un campo `code` di tipo stringa. */
function hasStringCode(value: unknown): value is ClassifiableError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}

/**
 * Mappa PURA `error → AuthFailureReason`, CONDIVISA fra registrazione e accesso.
 * I code Supabase noti diventano i `reason` di dominio; ogni code o forma
 * sconosciuta ⇒ `'unknown'` (mai una stringa grezza del vendor).
 *
 * - `user_already_exists` / `email_exists` ⇒ email già registrata
 * - `weak_password`                        ⇒ password troppo debole
 * - `validation_failed` / `email_address_invalid` ⇒ email in formato non valido
 * - `invalid_credentials`                  ⇒ password errata (accesso, 1.7):
 *   password errata ed email inesistente collassano entrambe qui, quindi sullo
 *   stesso reason — l'esistenza dell'email non è rivelata (AC2 strutturale).
 */
export function classifyAuthError(error: unknown): AuthFailureReason {
  if (!hasStringCode(error)) return 'unknown';

  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'email-already-registered';
    case 'weak_password':
      return 'weak-password';
    case 'validation_failed':
    case 'email_address_invalid':
      return 'invalid-email';
    case 'invalid_credentials':
      return 'wrong-password';
    default:
      return 'unknown';
  }
}

/**
 * Mappa PURA della risposta di `auth.signUp` / `auth.signInWithPassword` in un
 * `AuthResult` di dominio. Condivisa fra registrazione e accesso: entrambi
 * ritornano la stessa forma `{ data:{ session }, error }`.
 *
 * - errore presente        ⇒ `{ ok:false, reason: classify(error) }`
 * - nessun errore, sessione ⇒ `{ ok:true }` (l'utente atterra autenticato)
 * - nessun errore, NESSUNA sessione ⇒ `{ ok:false, reason:'unknown' }`
 *
 * L'ultimo caso rende visibile la dipendenza dall'operatore: con la conferma
 * email attiva, `signUp` ritorna `session: null` e l'utente non sarebbe
 * autenticato; l'AC richiede "nessuna conferma via email". Finché l'operatore
 * non disabilita la conferma nella console Supabase, questo è un errore generico
 * (`unknown`) — mai uno stato silente rotto.
 */
export function authResultFromResponse(response: AuthLikeResponse): AuthResult {
  if (response.error) {
    return { ok: false, reason: classifyAuthError(response.error) };
  }
  if (response.data?.session) {
    return { ok: true };
  }
  return { ok: false, reason: 'unknown' };
}

/**
 * Mappa PURA `session → boolean`: vero se una sessione è presente (AD-1: il
 * dominio non vede mai la `Session` del vendor, solo il booleano). `null` /
 * `undefined` ⇒ nessuna sessione. Rende testabile la subscription come mappa.
 */
export function hasSession(session: unknown): boolean {
  return session != null;
}

/**
 * Costruisce l'adattatore Supabase della porta AuthGateway attorno a un
 * `SupabaseClient` INIETTATO. Il client è creato UNA SOLA VOLTA nella
 * composition root (src/data/supabaseClient.ts, invocato da main.tsx) e
 * condiviso con SettingsRepository: una sola sessione / un solo GoTrueClient
 * (storia 1.9). Questo modulo non crea più il client né legge `import.meta.env`.
 *
 * Le funzioni PURE `classifyAuthError`/`authResultFromResponse`/`hasSession`
 * restano invariate: non toccano il client, perciò il refactor da `config` a
 * `client` non ne cambia il comportamento né i test.
 */
export function createSupabaseAuthGateway(client: SupabaseClient): AuthGateway {
  return {
    async signUp(credentials: Credentials): Promise<SignUpResult> {
      // La porta non RIFIUTA mai: auth-js rilancia i fallimenti non-AuthError
      // (es. rete caduta). Un throw diventa `unknown`, così i livelli superiori
      // ricevono sempre un AuthResult di dominio, mai una promise rifiutata.
      try {
        const response = await client.auth.signUp({
          email: credentials.email,
          password: credentials.password,
        });
        return authResultFromResponse(response);
      } catch {
        return { ok: false, reason: 'unknown' };
      }
    },

    async signIn(credentials: Credentials): Promise<SignInResult> {
      // Gemello di signUp sulla porta: stessa forma d'esito, stessa mappa pura.
      // Confine totale: un throw dell'SDK diventa `unknown`.
      try {
        const response = await client.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
        return authResultFromResponse(response);
      } catch {
        return { ok: false, reason: 'unknown' };
      }
    },

    async signOut(): Promise<void> {
      // Confine totale: qualunque throw dell'SDK viene ingoiato, la porta
      // risolve comunque `void` (mai reject). Lo stato torna `anonymous` a cura
      // del chiamante.
      try {
        await client.auth.signOut();
      } catch {
        // Confine totale: nessuna propagazione.
      }
    },

    async isAuthenticated(): Promise<boolean> {
      // Confine totale: un throw dell'SDK diventa `false`.
      try {
        const { data } = await client.auth.getSession();
        return hasSession(data.session);
      } catch {
        return false;
      }
    },

    async currentUserId(): Promise<string | null> {
      // Mirror di isAuthenticated: legge la stessa sessione ma ne estrae l'id
      // (mai la Session, che il dominio non vede). Confine TOTALE: la catena
      // opzionale `session?.user?.id` copre sessione assente, `user` assente o
      // `id` assente (⇒ `null`); un throw dell'SDK è intercettato dal `catch`.
      try {
        const { data } = await client.auth.getSession();
        return data.session?.user?.id ?? null;
      } catch {
        return null;
      }
    },

    onAuthStateChange(
      listener: (authenticated: boolean) => void,
    ): Unsubscribe {
      // Confine TOTALE anche sul setup della subscription: se l'SDK lancia in
      // modo sincrono, non lasciamo sfuggire l'eccezione (crash al boot in
      // AuthRoot). Su throw degradiamo a un Unsubscribe no-op: nessun
      // aggiornamento live, ma la lettura di boot (isAuthenticated) resta valida.
      try {
        // La `Session` del vendor è mappata a `boolean` da hasSession: il
        // dominio non la vede mai. Ritorniamo l'Unsubscribe che disiscrive.
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          listener(hasSession(session));
        });
        return () => data.subscription.unsubscribe();
      } catch {
        return () => {};
      }
    },
  };
}
