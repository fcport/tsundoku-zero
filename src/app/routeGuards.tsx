// Livello app (AD-1): l'UNICO guard di rotta del progetto (FR1.6). Nessun
// controllo di auth vive nelle schermate (features/ui, AC2): l'autorizzazione
// delle rotte è concentrata qui più la tabella in AppRoutes.tsx.
//
// Entrambe le guardie sono funzioni PURE prop→elemento: nessun hook, nessuna
// lettura di stato interna. La DECISIONE (quale elemento restituire) è quindi
// verificabile invocandole DIRETTAMENTE in un test — si asserisce tipo e props
// dell'elemento (bersaglio del redirect + `replace`), senza jsdom né effetti.
//
// Il redirect stesso è "glue" d'effetto: <Navigate> naviga in un useEffect, che
// renderToStaticMarkup NON esegue (rende null in SSR). Perciò il route-matching
// è la parte SINCRONA verificata con MemoryRouter, mentre la navigazione reale
// nel browser è coperta dalla verifica live differita (come la glue di AuthRoot).
//
// react-router è importato SOLO nel livello app (boundaries/external ammette
// l'esterno per app; il funnel i18n non è toccato).
import { Navigate, Outlet } from 'react-router';
import { LOGIN_PATH, ROOT_PATH } from './routes';

export interface GuardProps {
  readonly authenticated: boolean;
}

/**
 * IL guard delle rotte private: autenticato ⇒ rende le rotte figlie (<Outlet/>);
 * non autenticato ⇒ redirect alla schermata di Accesso, con `replace` per non
 * inquinare la cronologia. Copre OGNI rotta privata (radice + deep link).
 */
export function RequireAuth({ authenticated }: GuardProps) {
  return authenticated ? <Outlet /> : <Navigate to={LOGIN_PATH} replace />;
}

/**
 * Contraltare simmetrico sulla sola rotta pubblica di Accesso: autenticato ⇒
 * redirect alla radice protetta (chi è già dentro non rivede il form); anonimo
 * ⇒ rende la rotta figlia (il form). `replace` per non inquinare la cronologia.
 */
export function RedirectIfAuthenticated({ authenticated }: GuardProps) {
  return authenticated ? <Navigate to={ROOT_PATH} replace /> : <Outlet />;
}
