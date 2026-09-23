// Livello features/auth: l'UNICO traduttore `reason → { key, field }` (AD-1,
// FR1.5). Il suo ingresso è la union CHIUSA di dominio (AuthFailureReason),
// perciò per costruzione nessuna stringa grezza di Supabase può passare di qui
// all'utente: la garanzia è strutturale, non una promessa.
//
// Ogni reason ha una chiave i18n DEDICATA e DISTINTA e il campo responsabile
// corretto. Il campo ancora il messaggio: `email`/`password` accanto al campo,
// `form` a livello form (l'`unknown` generico non ha un campo colpevole).
import type { AuthFailureReason } from '../../domain/ports/authGateway';

/**
 * Union letterale delle chiavi `auth.error.*`. È il sottoinsieme delle chiavi
 * tipizzate di 1.4 compatibile con `t()`: usarne una assente sarebbe un errore
 * di compilazione `tsc`.
 */
export type AuthErrorKey =
  | 'auth.error.emailAlreadyRegistered'
  | 'auth.error.invalidEmail'
  | 'auth.error.weakPassword'
  | 'auth.error.wrongPassword'
  | 'auth.error.unknown';

/** Il campo responsabile a cui ancorare il messaggio. */
export type AuthErrorField = 'email' | 'password' | 'form';

/** Messaggio d'errore tradotto: chiave i18n + campo responsabile. */
export interface AuthErrorMessage {
  readonly key: AuthErrorKey;
  readonly field: AuthErrorField;
}

// Mappa esaustiva reason → messaggio. Il tipo Record garantisce a compile-time
// che ogni membro della union sia coperto: aggiungere un reason senza mapparlo
// è un errore `tsc`. Ogni chiave è distinta (nessuna riusata).
const MESSAGES: Record<AuthFailureReason, AuthErrorMessage> = {
  'email-already-registered': {
    key: 'auth.error.emailAlreadyRegistered',
    field: 'email',
  },
  'invalid-email': { key: 'auth.error.invalidEmail', field: 'email' },
  'weak-password': { key: 'auth.error.weakPassword', field: 'password' },
  'wrong-password': { key: 'auth.error.wrongPassword', field: 'password' },
  unknown: { key: 'auth.error.unknown', field: 'form' },
};

/**
 * Traduce un `AuthFailureReason` di dominio nella sua chiave i18n dedicata e nel
 * campo responsabile. Unico punto in features/auth che trasforma un fallimento
 * in messaggio utente.
 */
export function authFailureMessage(
  reason: AuthFailureReason,
): AuthErrorMessage {
  return MESSAGES[reason];
}
