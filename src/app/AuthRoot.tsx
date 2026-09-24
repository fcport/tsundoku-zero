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
import { i18n, resolveLocale } from '../i18n';
import type { AuthGateway } from '../domain/ports/authGateway';
import type { SettingsRepository } from '../domain/ports/settingsRepository';
import type { AccountGateway } from '../domain/ports/accountGateway';

export interface AuthRootProps {
  readonly gateway: AuthGateway;
  readonly settings: SettingsRepository;
  readonly account: AccountGateway;
}

type SessionStatus = 'checking' | 'authenticated' | 'anonymous';

export function AuthRoot({ gateway, settings, account }: AuthRootProps) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [signOutPending, setSignOutPending] = useState(false);

  useEffect(() => {
    let active = true;
    // Flag EDGE-TRIGGER: la lingua si rehydrata SOLO alla transizione VERSO
    // autenticato da uno stato non autenticato (login fresco o boot già
    // autenticato), non a ogni segnale autenticato. Senza questo, un
    // TOKEN_REFRESHED che arriva dopo un cambio lingua in-sessione ricaricherebbe
    // un valore stantio e clobbererebbe la scelta dell'utente; boot e
    // subscription potrebbero anche innescarlo due volte. Un sign-out riporta il
    // flag a false, così un re-login (anche di un altro utente) rehydrata di
    // nuovo. È un booleano LOCALE del closure dell'effetto: la logica vive nei
    // corpi delle callback, MAI in un updater di setState (StrictMode li invoca
    // due volte).
    let authApplied = false;

    // Rehydrate della lingua persistita all'accesso autenticato (AC3): legge la
    // lingua dal DB (loadLocale) e la applica al singleton i18next
    // (changeLanguage), così l'utente ritrova la stessa lingua su ogni
    // dispositivo. `resolveLocale` (decisione PURA-testata) normalizza il testo
    // grezzo al fallback quando assente/non supportato. È glue d'EFFETTO
    // (load→apply), differita alla verifica live; il confine totale di loadLocale
    // non rifiuta mai. Il `.then` è guardato da `active` (coerente con la lettura
    // di boot) e `.catch` disinnesca ogni rejection (mai unhandled rejection).
    const rehydrateLocale = () => {
      void settings
        .loadLocale()
        .then((stored) => {
          if (active) i18n.changeLanguage(resolveLocale(stored));
        })
        .catch(() => {});
    };

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
        // Edge-trigger fuori dall'updater di setState (StrictMode-safe):
        // rehydrata solo alla PRIMA transizione verso autenticato.
        if (authenticated) {
          if (!authApplied) {
            authApplied = true;
            rehydrateLocale();
          }
        } else {
          authApplied = false;
        }
      }
    });

    // Subscription: ogni cambio (login/logout, refresh token, altro tab) porta
    // lo stato in sincrono senza flash del form. Imposta lo stato in modo
    // incondizionato: è la fonte di verità più aggiornata.
    const unsubscribe = gateway.onAuthStateChange((authenticated) => {
      if (active) {
        setStatus(authenticated ? 'authenticated' : 'anonymous');
        // Edge-trigger: rehydrata solo alla transizione VERSO autenticato (login
        // fresco), non sui TOKEN_REFRESHED successivi; un segnale non autenticato
        // riarma il flag per il prossimo login.
        if (authenticated) {
          if (!authApplied) {
            authApplied = true;
            rehydrateLocale();
          }
        } else {
          authApplied = false;
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway, settings]);

  // Placeholder NEUTRO durante il check: niente form né shell, così una sessione
  // persistita non fa lampeggiare il form prima di risolvere (AC3).
  if (status === 'checking') {
    return <div aria-hidden="true" />;
  }

  return (
    <AppRoutes
      authenticated={status === 'authenticated'}
      gateway={gateway}
      settings={settings}
      account={account}
      onAuthenticated={() => setStatus('authenticated')}
      signOutPending={signOutPending}
      onSignOut={() => {
        setSignOutPending(true);
        void submitSignOut(gateway)
          .then(() => setStatus('anonymous'))
          .finally(() => setSignOutPending(false));
      }}
      onAccountDeleted={() => {
        // Dopo una cancellazione riuscita la sessione remota è morta, ma il
        // token locale sopravvive: riusiamo il percorso di sign-out per
        // scaricarlo (submitSignOut, confine totale) e riportiamo lo stato ad
        // `anonymous` — l'utente torna al login (AuthRoot possiede la vista).
        void submitSignOut(gateway).finally(() => setStatus('anonymous'));
      }}
    />
  );
}
