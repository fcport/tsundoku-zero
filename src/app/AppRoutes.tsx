// Livello app (AD-1): la tabella delle rotte dichiarative. Sostituisce la
// commutazione booleana di 1.7 (AuthGate) con il routing per URL, applicando
// l'UNICO guard (routeGuards.tsx) a due archi simmetrici:
//
//   /login (pubblica) sotto RedirectIfAuthenticated → AuthScreen
//   path="*" (tutto il resto) sotto RequireAuth      → AuthenticatedShell
//
// Il catch-all dietro il guard protegge OGNI path non-/login (dashboard,
// statistiche, impostazioni: non esistono ancora come rotte, arrivano in Epic
// 3/5). La sessione (3.18) è la PRIMA rotta VERA (`/studia`) che affianca il
// catch-all: dichiarata PRIMA di `path="*"` così ha precedenza, il resto ricade
// sulla shell. Coerente con «nessuna rotta prima della storia che la usa».
//
// react-router è importato SOLO nel livello app. Le schermate (features) non
// contengono controlli di auth (AC2) né stringhe di path: l'autorizzazione e il
// routing sono tutti qui.
import { Route, Routes } from 'react-router';
import { AuthScreen } from '../features/auth/AuthScreen';
import { SessionScreen } from '../features/study/SessionScreen';
import { AuthenticatedShell } from './AuthenticatedShell';
import { RedirectIfAuthenticated, RequireAuth } from './routeGuards';
import { LOGIN_PATH, STUDY_PATH } from './routes';
import type { AuthGateway } from '../domain/ports/authGateway';
import type { SettingsRepository } from '../domain/ports/settingsRepository';
import type { AccountGateway } from '../domain/ports/accountGateway';

export interface AppRoutesProps {
  readonly authenticated: boolean;
  readonly gateway: AuthGateway;
  readonly settings: SettingsRepository;
  readonly account: AccountGateway;
  /**
   * L'id dell'utente corrente (o `null` finché non risolto), inoltrato alla shell
   * protetta e da lì alla dashboard (chiave per-utente della pila, 3.12).
   */
  readonly userId: string | null;
  readonly onAuthenticated: () => void;
  readonly onSignOut: () => void;
  readonly signOutPending: boolean;
  readonly onAccountDeleted: () => void;
}

export function AppRoutes({
  authenticated,
  gateway,
  settings,
  account,
  userId,
  onAuthenticated,
  onSignOut,
  signOutPending,
  onAccountDeleted,
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
        {/* La sessione di esercizi (3.18): rotta VERA sotto il guard, PRIMA del
            catch-all così `/studia` ha precedenza. `userId` è già una prop di
            AppRoutes (chiave per-utente della pila, AD-5). */}
        <Route
          path={STUDY_PATH}
          element={<SessionScreen userId={userId} />}
        />
        <Route
          path="*"
          element={
            <AuthenticatedShell
              settings={settings}
              account={account}
              userId={userId}
              onSignOut={onSignOut}
              signOutPending={signOutPending}
              onAccountDeleted={onAccountDeleted}
            />
          }
        />
      </Route>
    </Routes>
  );
}
