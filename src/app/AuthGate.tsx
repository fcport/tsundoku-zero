// Livello app (AD-1): l'unico livello che compone tutti gli altri. AuthGate è
// PRESENTAZIONALE — la commutazione di vista come funzione PURA dello stato di
// autenticazione, resa staticamente per entrambi i booleani:
//   autenticato   ⇒ la radice protetta minima (branding <App/>, lang="ja" + tagline)
//   non autenticato ⇒ la schermata di Accesso (SignUpScreen)
//
// Fuori scope in questa storia: la persistenza della sessione (1.7) e il guard
// di rotta unico + router (1.8). Qui basta la commutazione minima.
import { App } from '../ui/App';
import { SignUpScreen } from '../features/auth/SignUpScreen';
import type { AuthGateway } from '../domain/ports/authGateway';

export interface AuthGateProps {
  readonly authenticated: boolean;
  readonly gateway: AuthGateway;
  readonly onAuthenticated: () => void;
}

export function AuthGate({
  authenticated,
  gateway,
  onAuthenticated,
}: AuthGateProps) {
  if (authenticated) {
    // Radice protetta minima: il branding esistente. La dashboard reale arriva
    // in Epic 3; nessuna storia di Epic 1 la presuppone.
    return <App />;
  }
  return <SignUpScreen gateway={gateway} onAuthenticated={onAuthenticated} />;
}
