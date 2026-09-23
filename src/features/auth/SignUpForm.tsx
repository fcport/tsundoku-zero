// Livello features/auth: componente PRESENTAZIONALE della schermata di Accesso.
// Nessuno stato, nessuna chiamata alla porta: riceve tutto per props ed è reso
// staticamente per ciascuno stato (renderToStaticMarkup, ambiente node).
//
// L'ancoraggio del messaggio è la garanzia di FR1.5 resa nel markup: lo slot
// d'errore di un campo è reso SOLO quando `error.field` combacia con quel campo;
// l'errore a livello `form` (l'`unknown` generico) vive in uno slot in fondo,
// NON in cima alla pagina. Solo classi token del sistema di design (1.3):
// nessun colore letterale (regola ERROR su features).
import { useTranslation } from '../../i18n';
import type { AuthErrorMessage } from './authFailureMessage';

/** Valori correnti dei campi (componente controllato dal container). */
export interface SignUpFormValues {
  readonly email: string;
  readonly password: string;
}

export interface SignUpFormProps {
  readonly values: SignUpFormValues;
  /** Messaggio d'errore ancorato, oppure `null` quando non c'è errore. */
  readonly error: AuthErrorMessage | null;
  /** Vero durante l'invio: disabilita il submit. */
  readonly pending: boolean;
  readonly onSubmit: () => void;
  readonly onChange: (field: keyof SignUpFormValues, value: string) => void;
}

export function SignUpForm({
  values,
  error,
  pending,
  onSubmit,
  onChange,
}: SignUpFormProps) {
  const { t } = useTranslation();

  const emailError = error?.field === 'email' ? error : null;
  const passwordError = error?.field === 'password' ? error : null;
  const formError = error?.field === 'form' ? error : null;

  return (
    <form
      className="flex flex-col gap-5 bg-surface-raised text-ink-primary rounded-lg border border-border-hairline p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="text-display">{t('auth.title')}</h2>

      <div className="flex flex-col gap-2">
        <label className="text-label" htmlFor="auth-email">
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
          className="rounded-md border border-border-strong bg-surface-raised text-ink-primary p-3"
        />
        {emailError ? (
          <p id="auth-email-error" className="text-caption text-danger">
            {t(emailError.key)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-label" htmlFor="auth-password">
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
          className="rounded-md border border-border-strong bg-surface-raised text-ink-primary p-3"
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
        className="rounded-md border border-border-strong bg-accent text-surface-raised p-3 text-label"
      >
        {t('auth.submit')}
      </button>

      {formError ? (
        <p role="alert" className="text-caption text-danger">
          {t(formError.key)}
        </p>
      ) : null}
    </form>
  );
}
