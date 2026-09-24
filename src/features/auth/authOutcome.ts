// Livello features/auth: la forma d'esito CONDIVISA fra registrazione e accesso
// e il suo dispatch PURO verso gli handler di presentazione. Estratto da
// signUp.ts perché accesso (signIn.ts) e registrazione (signUp.ts) producono lo
// stesso esito e commutano la vista allo stesso modo.
//
// È testabile in ambiente node, isolato dallo stato React di AuthScreen: il
// wiring dell'AC1 (successo ⇒ vista autenticata; fallimento ⇒ messaggio
// ancorato al campo) si verifica meccanicamente.
import type { AuthErrorMessage } from './authFailureMessage';

/**
 * Esito dell'orchestrazione di autenticazione, pronto per la schermata:
 * successo o fallimento con il messaggio tradotto (chiave i18n + campo
 * responsabile). Condiviso da `submitSignUp` e `submitSignIn`.
 */
export type AuthSubmitOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: AuthErrorMessage };

/**
 * Dispatch PURO dell'esito verso gli handler di presentazione: successo ⇒
 * `onAuthenticated()` (la vista commuta); fallimento ⇒ `onError(message)` (il
 * messaggio compare accanto al campo). Isolato dallo stato React di `AuthScreen`
 * così il wiring dell'AC1 è verificabile in ambiente node.
 */
export function applyAuthOutcome(
  outcome: AuthSubmitOutcome,
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
