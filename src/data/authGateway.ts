// Livello data (AD-2): l'UNICO livello che importa @supabase/supabase-js (la
// regola boundaries/external lo vieta a domain/ui/features tramite la sonda di
// confine; qui l'import è ammesso). Implementa la porta AuthGateway del dominio
// e mappa gli errori Supabase nella union chiusa `AuthFailureReason`.
//
// Il cuore della garanzia di FR1.5 è STRUTTURALE: due funzioni PURE ed esportate
// (`classifySignUpError`, `signUpResultFromResponse`) traducono la risposta di
// Supabase in un `SignUpResult` di dominio. Sono testabili senza client reale né
// rete: nessuna stringa grezza del vendor esce da qui verso i livelli superiori.
import { createClient } from '@supabase/supabase-js';
import type {
  AuthFailureReason,
  AuthGateway,
  Credentials,
  SignUpResult,
} from '../domain/ports/authGateway';

// La config di cui l'adattatore ha bisogno: solo l'endpoint e l'anon key. È il
// SOTTOINSIEME strutturale dell'AppConfig validato in src/app/env.ts; app passa
// il suo AppConfig senza che questo livello importi `app` (arco data→app vietato
// da AD-1). Il typing strutturale li riconcilia a compile-time.
export interface SupabaseAuthConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
}

// Forma MINIMA dell'errore Supabase che ci interessa classificare: il solo
// `code` stringa (ErrorCode di auth-js). Non dipendiamo dalla classe concreta
// AuthError — un oggetto con un `code` stringa basta, il che rende `classify`
// testabile con letterali semplici.
interface ClassifiableError {
  readonly code?: string | undefined;
}

// Forma MINIMA della risposta di auth.signUp che ci interessa: la sessione (per
// distinguere "autenticato" da "nessun errore ma sessione assente") e l'errore.
interface SignUpLikeResponse {
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
 * Mappa PURA `error → AuthFailureReason`. I code Supabase noti diventano i
 * `reason` di dominio; ogni code o forma sconosciuta ⇒ `'unknown'` (mai una
 * stringa grezza del vendor).
 *
 * - `user_already_exists` / `email_exists` ⇒ email già registrata
 * - `weak_password`                        ⇒ password troppo debole
 * - `validation_failed` / `email_address_invalid` ⇒ email in formato non valido
 * - `invalid_credentials`                  ⇒ password errata (prodotto dall'accesso, 1.7)
 */
export function classifySignUpError(error: unknown): AuthFailureReason {
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
 * Mappa PURA della risposta di `auth.signUp` in un `SignUpResult` di dominio.
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
export function signUpResultFromResponse(
  response: SignUpLikeResponse,
): SignUpResult {
  if (response.error) {
    return { ok: false, reason: classifySignUpError(response.error) };
  }
  if (response.data?.session) {
    return { ok: true };
  }
  return { ok: false, reason: 'unknown' };
}

/**
 * Costruisce l'adattatore Supabase della porta AuthGateway. La config è quella
 * validata dal livello app (src/app/env.ts, `AppConfig`) e iniettata da lì:
 * questo modulo non legge mai `import.meta.env`. Nessuna `service_role` né alcun
 * secret non-`VITE_*` entra nel client (solo l'anon key pubblica).
 */
export function createSupabaseAuthGateway(
  config: SupabaseAuthConfig,
): AuthGateway {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey);

  return {
    async signUp(credentials: Credentials): Promise<SignUpResult> {
      // La porta non RIFIUTA mai: auth-js rilancia i fallimenti non-AuthError
      // (es. rete caduta). Un throw diventa `unknown`, così i livelli superiori
      // ricevono sempre un SignUpResult di dominio, mai una promise rifiutata.
      try {
        const response = await client.auth.signUp({
          email: credentials.email,
          password: credentials.password,
        });
        return signUpResultFromResponse(response);
      } catch {
        return { ok: false, reason: 'unknown' };
      }
    },
  };
}
