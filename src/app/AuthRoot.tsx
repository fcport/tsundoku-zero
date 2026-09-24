// Livello app: container che tiene lo stato di SESSIONE reale e rende la tabella
// delle rotte (AppRoutes). A differenza di 1.6 (dove lo stato nasceva a `false`),
// qui la sessione è riflessa al boot: `isAuthenticated()` letta all'avvio e
// `onAuthStateChange` tiene lo stato in sincrono (AC3/FR1.3).
//
// Tre stati: `checking` finché `isAuthenticated()` risolve — durante il quale si
// rende un PLACEHOLDER NEUTRO (niente flash del form su una sessione già valida,
// AC3) — poi `authenticated` o `anonymous`. Il booleano `authenticated` alimenta
// il guard unico dentro AppRoutes (1.8): la commutazione booleana per vista di
// 1.7 è sostituita dal routing per URL.
//
// La glue `useEffect` è sottile (come la glue interattiva di 1.6, coperta dalla
// e2e live differita); la resa iniziale (`checking`) è verificata staticamente.
import { useEffect, useState } from 'react';
import { AppRoutes } from './AppRoutes';
import { submitSignOut } from '../features/auth/signOut';
import type { AuthGateway } from '../domain/ports/authGateway';

export interface AuthRootProps {
  readonly gateway: AuthGateway;
}

type SessionStatus = 'checking' | 'authenticated' | 'anonymous';

export function AuthRoot({ gateway }: AuthRootProps) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [signOutPending, setSignOutPending] = useState(false);

  useEffect(() => {
    let active = true;

    // Sessione riflessa al boot: la prima lettura decide checking → auth/anon,
    // ma SOLO finché lo stato è ancora `checking`. Se un evento di subscription
    // è arrivato prima che questa lettura (lenta) risolva, non lo sovrascriviamo
    // con un valore stantio: l'aggiornamento funzionale è un no-op fuori da
    // `checking`.
    void gateway.isAuthenticated().then((authenticated) => {
      if (active) {
        setStatus((prev) =>
          prev === 'checking'
            ? authenticated
              ? 'authenticated'
              : 'anonymous'
            : prev,
        );
      }
    });

    // Subscription: ogni cambio (login/logout, refresh token, altro tab) porta
    // lo stato in sincrono senza flash del form. Imposta lo stato in modo
    // incondizionato: è la fonte di verità più aggiornata.
    const unsubscribe = gateway.onAuthStateChange((authenticated) => {
      if (active) {
        setStatus(authenticated ? 'authenticated' : 'anonymous');
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway]);

  // Placeholder NEUTRO durante il check: niente form né shell, così una sessione
  // persistita non fa lampeggiare il form prima di risolvere (AC3).
  if (status === 'checking') {
    return <div aria-hidden="true" />;
  }

  return (
    <AppRoutes
      authenticated={status === 'authenticated'}
      gateway={gateway}
      onAuthenticated={() => setStatus('authenticated')}
      signOutPending={signOutPending}
      onSignOut={() => {
        setSignOutPending(true);
        void submitSignOut(gateway)
          .then(() => setStatus('anonymous'))
          .finally(() => setSignOutPending(false));
      }}
    />
  );
}
