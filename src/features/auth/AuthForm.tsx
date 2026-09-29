// Livello features/auth: componente PRESENTAZIONALE della schermata di Accesso,
// PARAMETRIZZATO dal modo (registrazione / accesso). Nessuno stato, nessuna
// chiamata alla porta: riceve tutto per props ed è reso staticamente per
// ciascuno stato (renderToStaticMarkup, ambiente node).
//
// Una SOLA schermata (EXPERIENCE.md §Superfici) ospita registrazione (1.6) e
// accesso (1.7): titolo, submit e toggle vengono da chiavi i18n passate dal
// container secondo il modo. Un solo `button-primary` per schermata; il
// passaggio di modo è un affordance secondario testuale (`type="button"`).
//
// L'ancoraggio del messaggio è la garanzia di FR1.5 resa nel markup: lo slot
// d'errore di un campo è reso SOLO quando `error.field` combacia con quel campo;
// l'errore a livello `form` (l'`unknown` generico) vive in uno slot in fondo,
// NON in cima alla pagina. Solo classi token del sistema di design (1.3):
// nessun colore letterale (regola ERROR su features).
import { useTranslation } from '../../i18n';
import type { AuthErrorMessage } from './authFailureMessage';
import { ACTION_BAR, FOCUS_RING, SCREEN_TITLE } from '../../ui/magazine';

/** Valori correnti dei campi (componente controllato dal container). */
export interface AuthFormValues {
  readonly email: string;
  readonly password: string;
}

/** Chiave i18n del titolo, secondo il modo. */
export type AuthFormTitleKey = 'auth.title' | 'auth.signInTitle';
/** Chiave i18n del submit primario, secondo il modo. */
export type AuthFormSubmitKey = 'auth.submit' | 'auth.signInSubmit';
/** Chiave i18n dell'affordance secondario di cambio modo. */
export type AuthFormToggleKey = 'auth.switchToSignIn' | 'auth.switchToSignUp';

export interface AuthFormProps {
  readonly values: AuthFormValues;
  /** Messaggio d'errore ancorato, oppure `null` quando non c'è errore. */
  readonly error: AuthErrorMessage | null;
  /** Vero durante l'invio: disabilita il submit. */
  readonly pending: boolean;
  readonly onSubmit: () => void;
  readonly onChange: (field: keyof AuthFormValues, value: string) => void;
  /** Chiavi i18n del modo corrente (registrazione vs accesso). */
  readonly titleKey: AuthFormTitleKey;
  readonly submitKey: AuthFormSubmitKey;
  readonly toggleKey: AuthFormToggleKey;
  /** Alterna il modo della schermata. */
  readonly onToggle: () => void;
}

export function AuthForm({
  values,
  error,
  pending,
  onSubmit,
  onChange,
  titleKey,
  submitKey,
  toggleKey,
  onToggle,
}: AuthFormProps) {
  const { t } = useTranslation();

  const emailError = error?.field === 'email' ? error : null;
  const passwordError = error?.field === 'password' ? error : null;
  const formError = error?.field === 'form' ? error : null;

  return (
    <form
      className="flex flex-col gap-6 text-ink-primary"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className={`${SCREEN_TITLE} text-ink-primary`}>
        {t(titleKey)}
      </h2>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-label-caps uppercase text-ink-secondary" htmlFor="auth-email">
          {t('auth.emailLabel')}
        </label>
        <input
          id="auth-email"
          type="email"
          required
          value={values.email}
          onChange={(event) => onChange('email', event.target.value)}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'auth-email-error' : undefined}
          className={`border-0 border-b-[1.5px] border-border-strong bg-transparent px-0 py-3 text-[20px] text-ink-primary ${FOCUS_RING}`}
        />
        {emailError ? (
          <p id="auth-email-error" className="text-caption text-danger">
            {t(emailError.key)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-label-caps uppercase text-ink-secondary" htmlFor="auth-password">
          {t('auth.passwordLabel')}
        </label>
        <input
          id="auth-password"
          type="password"
          required
          value={values.password}
          onChange={(event) => onChange('password', event.target.value)}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? 'auth-password-error' : undefined}
          className={`border-0 border-b-[1.5px] border-border-strong bg-transparent px-0 py-3 text-[20px] text-ink-primary ${FOCUS_RING}`}
        />
        {passwordError ? (
          <p id="auth-password-error" className="text-caption text-danger">
            {t(passwordError.key)}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className={ACTION_BAR}
      >
        {t(submitKey)}
      </button>

      {formError ? (
        <p role="alert" className="text-caption text-danger">
          {t(formError.key)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        className={`self-start text-label font-semibold text-ink-primary underline underline-offset-4 ${FOCUS_RING}`}
      >
        {t(toggleKey)}
      </button>
    </form>
  );
}
