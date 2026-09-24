// Livello app (AD-1): l'unico livello che compone tutti gli altri. AuthGate è
// PRESENTAZIONALE — la commutazione di vista come funzione PURA dello stato di
// autenticazione, resa staticamente per entrambi i booleani:
//   autenticato   ⇒ la radice protetta minima (AuthenticatedShell: branding
//                    <App/> lang="ja" + tagline + bottone Disconnetti)
//   non autenticato ⇒ la schermata di Accesso bimodale (AuthScreen)
//
// Fuori scope in questa storia: il guard di rotta unico + router (1.8). Qui
// basta la commutazione minima; lo stato di sessione reale (boot + subscription)
// vive in AuthRoot.
import { AuthScreen } from '../features/auth/AuthScreen';
import { AuthenticatedShell } from './AuthenticatedShell';
import type { AuthGateway } from '../domain/ports/authGateway';

export interface AuthGateProps {
  readonly authenticated: boolean;
  readonly gateway: AuthGateway;
  readonly onAuthenticated: () => void;
  readonly onSignOut: () => void;
  readonly signOutPending: boolean;
}

export function AuthGate({
  authenticated,
  gateway,
  onAuthenticated,
  onSignOut,
  signOutPending,
}: AuthGateProps) {
  if (authenticated) {
    return (
      <AuthenticatedShell onSignOut={onSignOut} signOutPending={signOutPending} />
    );
  }
  return <AuthScreen gateway={gateway} onAuthenticated={onAuthenticated} />;
}
