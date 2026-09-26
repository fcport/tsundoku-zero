// Livello app (AD-1): la radice protetta minima resa quando l'utente è
// autenticato. PRESENTAZIONALE — nessuno stato, nessuna chiamata alla porta:
// riceve `onSignOut`/`signOutPending`/`userId` per props ed è reso staticamente.
//
// Compone un <header> con il bottone Disconnetti (`auth.signOut`, da t()) SOPRA
// la dashboard (<DashboardScreen>, il primo consumatore del read-model, 3.12) che
// sostituisce il branding placeholder. Solo classi token del sistema di design
// (1.3): ogni interattivo con `border-strong`, nessuna ombra, nessun verde di
// successo.
//
// La shell compone TRE feature come sibling — la dashboard (l'unico <main>),
// Impostazioni (<SettingsScreen>) e Account (<DeleteAccountSection>) — così l'app
// resta l'unico livello che le mette insieme, evitando un arco features→features
// vietato da AD-1. Impostazioni e Account sono <section>: l'unico <main> è quello
// della dashboard (single-main di 1.7/1.8).
//
// La NAVIGAZIONE alla sessione (3.18) vive qui, nel livello app: la dashboard
// riceve `onStartSession` (una callback, nessuna stringa di path né react-router
// nelle features, AD-1); la shell la cabla con `useNavigate` verso `STUDY_PATH`. La
// firma di AuthenticatedShell resta INVARIATA — la navigazione è interna.
//
// PRECARICO della sessione (4.1): prima di navigare, `onStartSession` innesca
// `prefetchDueStack` — carica in UN colpo l'intera pila dovuta PIÙ il contenuto e
// le spiegazioni (cache calda), così la sessione non perde il campo a metà. Il
// wiring vive QUI (AD-1): `usePorts()`+`useQueryClient()` sono disponibili (la
// shell è sotto `PortsProvider` di AuthRoot e `QueryClientProvider` di main.tsx),
// così la feature del precarico non importa react-router né `src/data`. Una
// guardia di re-entrancy (`useRef`) evita precarichi sovrapposti su doppio click;
// la navigazione avviene SEMPRE dopo (anche su errore: degrado grazioso).
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../i18n';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { DeleteAccountSection } from '../features/account/DeleteAccountSection';
import { usePorts } from '../features/ports/PortsContext';
import { prefetchDueStack } from '../features/study/prefetchDueStack';
import {
  ACKNOWLEDGEMENTS_PATH,
  PRIVACY_PATH,
  STATS_PATH,
  STUDY_PATH,
} from './routes';
import type { SettingsRepository } from '../domain/ports/settingsRepository';
import type { AccountGateway } from '../domain/ports/accountGateway';

export interface AuthenticatedShellProps {
  /** La porta delle impostazioni, inoltrata alla feature Impostazioni. */
  readonly settings: SettingsRepository;
  /** La porta di cancellazione account, inoltrata alla feature Account. */
  readonly account: AccountGateway;
  /** L'id dell'utente corrente (o `null` finché non risolto), passato alla dashboard. */
  readonly userId: string | null;
  readonly onSignOut: () => void;
  /** Vero durante la disconnessione: disabilita il bottone. */
  readonly signOutPending: boolean;
  /** Invocato dopo una cancellazione riuscita: torna anonimo (AuthRoot). */
  readonly onAccountDeleted: () => void;
}

export function AuthenticatedShell({
  settings,
  account,
  userId,
  onSignOut,
  signOutPending,
  onAccountDeleted,
}: AuthenticatedShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { review, content, clock } = usePorts();
  const queryClient = useQueryClient();

  // Guardia di re-entrancy (4.1): un ref (non stato — nessun re-render) impedisce
  // che un doppio click avvii due precarichi sovrapposti. `void` + `.catch(() => {})`
  // rende il rejection catturato (nessuna unhandled rejection) e `.finally` naviga
  // SEMPRE dopo — anche su errore, la sessione ripiega sul caricamento reattivo.
  const prefetching = useRef(false);
  const onStartSession = () => {
    if (prefetching.current) return;
    prefetching.current = true;
    void prefetchDueStack(queryClient, { review, content, clock }, userId)
      .catch(() => {})
      .finally(() => {
        prefetching.current = false;
        navigate(STUDY_PATH);
      });
  };

  // La navigazione alle statistiche (5.1): vive nel livello app (AD-1), la dashboard
  // riceve solo la callback. Nessun precarico: la vista riusa la cache calda di
  // `['streak', userId]` già seminata dalla dashboard stessa.
  const onViewStats = () => navigate(STATS_PATH);

  return (
    <>
      <header className="flex justify-end p-6">
        <button
          type="button"
          onClick={onSignOut}
          disabled={signOutPending}
          className="rounded-md border border-border-strong bg-surface-raised text-ink-primary p-3 text-label"
        >
          {t('auth.signOut')}
        </button>
      </header>
      <DashboardScreen
        userId={userId}
        settings={settings}
        onStartSession={onStartSession}
        onViewStats={onViewStats}
      />
      <SettingsScreen
        settings={settings}
        userId={userId}
        onViewPrivacy={() => navigate(PRIVACY_PATH)}
        onViewAcknowledgements={() => navigate(ACKNOWLEDGEMENTS_PATH)}
      />
      <DeleteAccountSection
        account={account}
        onAccountDeleted={onAccountDeleted}
      />
    </>
  );
}
