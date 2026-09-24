// Livello features/auth: il wiring PURO modo→orchestratore e modo→chiavi di
// vista, estratto da AuthScreen così che la selezione (ciò che fa sì che
// l'accesso chiami davvero `signIn`) sia verificabile in ambiente node senza lo
// stato React. Invertire la selezione qui è colto da un test.
import type { AuthGateway, Credentials } from '../../domain/ports/authGateway';
import type {
  AuthFormSubmitKey,
  AuthFormTitleKey,
  AuthFormToggleKey,
} from './AuthForm';
import type { AuthSubmitOutcome } from './authOutcome';
import { submitSignUp } from './signUp';
import { submitSignIn } from './signIn';

/** Il modo della schermata: registrazione (default) o accesso. */
export type AuthMode = 'sign-up' | 'sign-in';

/** Le chiavi di vista per-modo più il modo verso cui alterna il toggle. */
export interface AuthModeCopy {
  readonly titleKey: AuthFormTitleKey;
  readonly submitKey: AuthFormSubmitKey;
  readonly toggleKey: AuthFormToggleKey;
  readonly toggleTo: AuthMode;
}

// Chiavi i18n e bersaglio del toggle per modo. `sign-up` mostra le chiavi di 1.6
// e alterna verso `sign-in`; `sign-in` mostra le chiavi di accesso e alterna
// verso `sign-up`. Nessuna stringa cablata: tutto passa da t() (AD-14).
export const AUTH_MODE_COPY: Record<AuthMode, AuthModeCopy> = {
  'sign-up': {
    titleKey: 'auth.title',
    submitKey: 'auth.submit',
    toggleKey: 'auth.switchToSignIn',
    toggleTo: 'sign-in',
  },
  'sign-in': {
    titleKey: 'auth.signInTitle',
    submitKey: 'auth.signInSubmit',
    toggleKey: 'auth.switchToSignUp',
    toggleTo: 'sign-up',
  },
};

/** L'orchestrazione totale (registrazione o accesso) associata a un modo. */
export type SubmitAuth = (
  gateway: AuthGateway,
  credentials: Credentials,
) => Promise<AuthSubmitOutcome>;

/**
 * Seleziona l'orchestratore secondo il modo: `submitSignUp` per la
 * registrazione, `submitSignIn` per l'accesso. È QUESTA selezione che fa sì che
 * l'accesso invochi davvero la porta `signIn` — estratta qui perché sia coperta
 * da un test (uguaglianza per riferimento).
 */
export function submitForMode(mode: AuthMode): SubmitAuth {
  return mode === 'sign-up' ? submitSignUp : submitSignIn;
}
