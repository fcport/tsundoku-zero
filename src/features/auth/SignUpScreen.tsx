// Livello features/auth: container della schermata di Accesso. Tiene lo stato dei
// campi e dell'errore/pending, chiama l'orchestrazione pura `submitSignUp` con la
// porta INIETTATA (features non importa data, AD-1) e, su successo, invoca
// `onAuthenticated` — la commutazione di vista vive in app (AuthRoot).
//
// Un solo landmark <main>: contiene la sola SignUpForm (che ha già la propria
// intestazione <h2>). Il branding <App/> vive SOLO sulla radice protetta
// autenticata (AuthGate), per non annidare due <main>.
import { useState } from 'react';
import type { AuthGateway } from '../../domain/ports/authGateway';
import { SignUpForm, type SignUpFormValues } from './SignUpForm';
import { applySignUpOutcome, submitSignUp } from './signUp';
import type { AuthErrorMessage } from './authFailureMessage';

export interface SignUpScreenProps {
  readonly gateway: AuthGateway;
  /** Invocata quando il signup va a buon fine: l'utente atterra autenticato. */
  readonly onAuthenticated: () => void;
}

export function SignUpScreen({ gateway, onAuthenticated }: SignUpScreenProps) {
  const [values, setValues] = useState<SignUpFormValues>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<AuthErrorMessage | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="flex flex-col items-center gap-6 p-6">
      <SignUpForm
        values={values}
        error={error}
        pending={pending}
        onChange={(field, value) =>
          setValues((prev) => ({ ...prev, [field]: value }))
        }
        onSubmit={() => {
          setPending(true);
          setError(null);
          void submitSignUp(gateway, values)
            .then((outcome) =>
              applySignUpOutcome(outcome, { onAuthenticated, onError: setError }),
            )
            .finally(() => setPending(false));
        }}
      />
    </main>
  );
}
