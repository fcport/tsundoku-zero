// Livello app (AD-1): la tabella delle rotte dichiarative. Sostituisce la
// commutazione booleana di 1.7 (AuthGate) con il routing per URL, applicando
// l'UNICO guard (routeGuards.tsx) a due archi simmetrici:
//
//   /login (pubblica) sotto RedirectIfAuthenticated → AuthScreen
//   path="*" (tutto il resto) sotto RequireAuth      → AuthenticatedShell
//
// Il catch-all dietro il guard protegge OGNI path non-/login (dashboard,
// sessione, statistiche, impostazioni: nessuna esiste ancora, arrivano in
// Epic 3/5). Più forte che elencare rotte future e coerente con «nessuna rotta
// prima della storia che la usa»: le rotte vere sostituiranno il catch-all.
//
// react-router è importato SOLO nel livello app. Le schermate (features) non
// contengono controlli di auth (AC2): l'autorizzazione è tutta qui.
import { Route, Routes } from 'react-router';
import { AuthScreen } from '../features/auth/AuthScreen';
import { AuthenticatedShell } from './AuthenticatedShell';
import { RedirectIfAuthenticated, RequireAuth } from './routeGuards';
import { LOGIN_PATH } from './routes';
import type { AuthGateway } from '../domain/ports/authGateway';
import type { SettingsRepository } from '../domain/ports/settingsRepository';

export interface AppRoutesProps {
  readonly authenticated: boolean;
  readonly gateway: AuthGateway;
  readonly settings: SettingsRepository;
  readonly onAuthenticated: () => void;
  readonly onSignOut: () => void;
  readonly signOutPending: boolean;
}

export function AppRoutes({
  authenticated,
  gateway,
  settings,
  onAuthenticated,
  onSignOut,
  signOutPending,
}: AppRoutesProps) {
  return (
    <Routes>
      <Route element={<RedirectIfAuthenticated authenticated={authenticated} />}>
        <Route
          path={LOGIN_PATH}
          element={
            <AuthScreen gateway={gateway} onAuthenticated={onAuthenticated} />
          }
        />
      </Route>
      <Route element={<RequireAuth authenticated={authenticated} />}>
        <Route
          path="*"
          element={
            <AuthenticatedShell
              settings={settings}
              onSignOut={onSignOut}
              signOutPending={signOutPending}
            />
          }
        />
      </Route>
    </Routes>
  );
}
