// Livello features/auth: container BIMODALE della schermata di Accesso. Tiene lo
// stato dei campi, dell'errore/pending e del MODO (`sign-up` default / `sign-in`),
// chiama l'orchestrazione pura selezionata da `submitForMode` con la porta
// INIETTATA (features non importa data, AD-1) e, su successo, invoca
// `onAuthenticated` — la commutazione di vista vive in app (AuthRoot).
//
// Il wiring modo→orchestratore e modo→chiavi di vista vive nel modulo PURO
// ./authMode, così è verificabile in ambiente node senza lo stato React
// (invertire la selezione modo→submit sarebbe colto da un test).
//
// Una SOLA schermata (EXPERIENCE.md §Superfici) ospita registrazione (1.6) e
// accesso (1.7): il default è `sign-up` (metrica M4 registration-first, coerente
// con 1.6). Un solo landmark <main>: contiene la sola AuthForm (che ha già la
// propria intestazione <h2>). Il branding <App/> vive SOLO sulla radice protetta
// autenticata (AuthenticatedShell), per non annidare due <main>.
import { useState } from 'react';
import type { AuthGateway } from '../../domain/ports/authGateway';
import { AuthForm, type AuthFormValues } from './AuthForm';
import { applyAuthOutcome } from './authOutcome';
import { AUTH_MODE_COPY, submitForMode, type AuthMode } from './authMode';
import type { AuthErrorMessage } from './authFailureMessage';

export interface AuthScreenProps {
  readonly gateway: AuthGateway;
  /** Invocata quando l'autenticazione va a buon fine: l'utente atterra dentro. */
  readonly onAuthenticated: () => void;
}

export function AuthScreen({ gateway, onAuthenticated }: AuthScreenProps) {
  const [values, setValues] = useState<AuthFormValues>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<AuthErrorMessage | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<AuthMode>('sign-up');

  const copy = AUTH_MODE_COPY[mode];

  return (
    <main className="flex flex-col items-center gap-6 p-6">
      <AuthForm
        values={values}
        error={error}
        pending={pending}
        titleKey={copy.titleKey}
        submitKey={copy.submitKey}
        toggleKey={copy.toggleKey}
        onChange={(field, value) =>
          setValues((prev) => ({ ...prev, [field]: value }))
        }
        onToggle={() => {
          setMode(copy.toggleTo);
          setError(null);
        }}
        onSubmit={() => {
          setPending(true);
          setError(null);
          void submitForMode(mode)(gateway, values)
            .then((outcome) =>
              applyAuthOutcome(outcome, { onAuthenticated, onError: setError }),
            )
            .finally(() => setPending(false));
        }}
      />
    </main>
  );
}
