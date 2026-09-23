// Livello features/auth: orchestrazione PURA del signup. Riceve la porta
// AuthGateway INIETTATA (features non importa data, AD-1) e la traduce in un
// esito pronto per la presentazione: o `{ ok:true }`, o `{ ok:false }` con il
// messaggio già ancorato al campo responsabile.
//
// È testabile con un finto gateway iniettato, senza rete né Supabase: la logica
// di commutazione della vista e l'ancoraggio del messaggio si verificano
// meccanicamente.
import type { AuthGateway, Credentials } from '../../domain/ports/authGateway';
import {
  authFailureMessage,
  type AuthErrorMessage,
} from './authFailureMessage';

/**
 * Esito dell'orchestrazione del signup, pronto per la schermata: successo o
 * fallimento con il messaggio tradotto (chiave i18n + campo responsabile).
 */
export type SubmitSignUpOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: AuthErrorMessage };

/**
 * Invia le credenziali attraverso la porta e traduce l'esito. Su successo
 * l'utente atterra autenticato (la schermata invocherà `onAuthenticated`); su
 * fallimento, l'unico traduttore mappa il `reason` di dominio in un messaggio
 * ancorato al campo colpevole.
 *
 * Il confine è TOTALE: se la porta LANCIA (rete caduta, errore imprevisto che
 * auth-js rilancia), l'esito è comunque un fallimento tradotto (`unknown` a
 * livello form) invece di una promise rifiutata — mai uno stato bloccato senza
 * messaggio. Non maschera un SignUpResult risolto: cattura solo i throw.
 */
export async function submitSignUp(
  gateway: AuthGateway,
  credentials: Credentials,
): Promise<SubmitSignUpOutcome> {
  let result;
  try {
    result = await gateway.signUp(credentials);
  } catch {
    return { ok: false, message: authFailureMessage('unknown') };
  }
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, message: authFailureMessage(result.reason) };
}

/**
 * Dispatch PURO dell'esito verso gli handler di presentazione: successo ⇒
 * `onAuthenticated()` (la vista commuta); fallimento ⇒ `onError(message)` (il
 * messaggio compare accanto al campo). Isolato dallo stato React di
 * `SignUpScreen` così il wiring dell'AC1 è verificabile in ambiente node.
 */
export function applySignUpOutcome(
  outcome: SubmitSignUpOutcome,
  handlers: {
    readonly onAuthenticated: () => void;
    readonly onError: (message: AuthErrorMessage) => void;
  },
): void {
  if (outcome.ok) {
    handlers.onAuthenticated();
  } else {
    handlers.onError(outcome.message);
  }
}
