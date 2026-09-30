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
// La shell compone l'intestazione (nome dell'app, Impostazioni, Esci) e la
// dashboard, l'unico <main> (single-main di 1.7/1.8). Impostazioni e Account
// vivono sulla loro pagina (`SettingsPage`, rotta `SETTINGS_PATH`): in coda alla
// dashboard sommergevano l'unica cosa che conta lì, la pila da svuotare.
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
//
// Direzione «rivista» (29-09-2026): la shell è la CORNICE — il dorso verticale col
// marchio (l'<h1> della pagina) e la testata con la data di oggi a sinistra e le
// due azioni di servizio a destra. La dashboard vi compone il proprio <main>.
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { resolveLocale, useTranslation } from '../i18n';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { usePorts } from '../features/ports/PortsContext';
import { prefetchDueStack } from '../features/study/prefetchDueStack';
import { MagazineFrame } from '../ui/MagazineFrame';
import { Masthead } from '../ui/Masthead';
import { FOCUS_RING } from '../ui/magazine';
import { ABOUT_PATH, DRILL_PATH, LESSONS_PATH, SETTINGS_PATH, STATS_PATH, STUDY_PATH } from './routes';
import type { SettingsRepository } from '../domain/ports/settingsRepository';

export interface AuthenticatedShellProps {
  /** La porta delle impostazioni, inoltrata alla feature Impostazioni. */
  readonly settings: SettingsRepository;
  /** L'id dell'utente corrente (o `null` finché non risolto), passato alla dashboard. */
  readonly userId: string | null;
  readonly onSignOut: () => void;
  /** Vero durante la disconnessione: disabilita il bottone. */
  readonly signOutPending: boolean;
}

export function AuthenticatedShell({
  settings,
  userId,
  onSignOut,
  signOutPending,
}: AuthenticatedShellProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { review, content, clock } = usePorts();
  // La data della testata, nella lingua dell'interfaccia e nel fuso del Clock
  // iniettato (mai l'orologio del browser letto qui).
  const today = new Intl.DateTimeFormat(
    resolveLocale(i18n.language) === 'it' ? 'it-IT' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', timeZone: clock.timeZone() },
  ).format(clock.now());
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

  // Le azioni di servizio della testata: testo maiuscolo, nessun riempimento,
  // bersaglio alto 44px. Chiaramente non la barra d'azione della dashboard.
  const serviceAction = `min-h-[44px] px-2 uppercase hover:underline ${FOCUS_RING}`;

  return (
    <MagazineFrame brandAsHeading furiganaToggle>
      <Masthead
        start={
          <span>
            {t('dashboard.today')} · {today}
          </span>
        }
        end={
          <>
            <button
              type="button"
              onClick={() => navigate(SETTINGS_PATH)}
              className={serviceAction}
            >
              {t('dashboard.openSettings')}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              disabled={signOutPending}
              className={serviceAction}
            >
              {t('auth.signOut')}
            </button>
          </>
        }
      />
      <DashboardScreen
        userId={userId}
        settings={settings}
        onStartSession={onStartSession}
        onViewStats={onViewStats}
        onPractice={() => navigate(DRILL_PATH)}
        onViewLessons={() => navigate(LESSONS_PATH)}
        onViewAbout={() => navigate(ABOUT_PATH)}
      />
    </MagazineFrame>
  );
}
