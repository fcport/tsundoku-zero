import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { AuthenticatedShell } from './AuthenticatedShell';
import { dueQueryKey } from '../domain/due';
import { PortsProvider, type Ports } from '../features/ports/PortsContext';
import type { SettingsRepository } from '../domain/ports/settingsRepository';
import type { AccountGateway } from '../domain/ports/accountGateway';

// Righe della I/O Matrix per la radice protetta (storia 1.7, aggiornata in 3.12).
// La shell autenticata ora è dashboard (<DashboardScreen>: l'unico <main>, con
// conteggio + azione primaria) + bottone Disconnetti + la superficie Impostazioni
// (un <section>) + Account (un <section>); il pending disabilita il Disconnetti.
// Con la cache seminata la dashboard rende lo stato CARICATO in modo sincrono.

const NOOP = () => {};
const UID = 'user-1';

// Porta finta inerte (nuova prop 1.9, estesa in 3.17): non invocata durante la
// resa server (le queryFn non partono con cache seminata).
const inertSettings: SettingsRepository = {
  loadLocale: async () => null,
  saveLocale: async () => {},
  loadLessonsPerDay: async () => null,
  saveLessonsPerDay: async () => {},
};
// Porta finta inerte (nuova prop 1.10): deleteAccount non è invocata da SSR.
const inertAccount: AccountGateway = {
  deleteAccount: async () => ({ ok: true }),
};
// Porte del ciclo iniettate alla dashboard (3.12): inerti con cache seminata.
const inertPorts: Ports = {
  clock: { now: () => new Date('2026-09-25T12:00:00.000Z'), timeZone: () => 'UTC' },
  review: { listDue: async () => [], listReviewLog: async () => [] },
  progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
  content: { listLessons: async () => [] },
};

function seededClient(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(dueQueryKey(UID), [
    { exerciseId: 'a', stage: 0, dueAt: new Date(0), reviewCount: 0, lapseCount: 0, lastReviewedAt: null },
  ]);
  qc.setQueryData(['streak', UID], []);
  // Stato NON di primo avvio (3.15): una lezione già sbloccata, così la dashboard
  // rende lo stato caricato con `primaryAction` (invariante del test: la shell
  // mostra la dashboard). Con `unlocked === 0` renderebbe invece il primo avvio.
  // Il read-model unico (3.17) porta anche `unlockedAt`.
  qc.setQueryData(['unlocked', UID], [
    { lessonId: 'lesson-0', unlockedAt: new Date('2026-09-25T00:00:00.000Z') },
  ]);
  qc.setQueryData(['lessons'], [
    { id: 'lesson-0', ordinal: 0, title: { en: 'L0' }, grammarPoints: [], exerciseCount: 1 },
  ]);
  // Il tetto giornaliero (3.17): seminato così la dashboard non resta sullo
  // scheletro (la query è nel cancello scheletro). `count > 0` ⇒ tetto non consultato.
  qc.setQueryData(['lessonsPerDay', UID], 1);
  return qc;
}

function render(signOutPending: boolean): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={seededClient()}>
      <PortsProvider value={inertPorts}>
        <AuthenticatedShell
          settings={inertSettings}
          account={inertAccount}
          userId={UID}
          onSignOut={NOOP}
          signOutPending={signOutPending}
          onAccountDeleted={NOOP}
        />
      </PortsProvider>
    </QueryClientProvider>,
  );
}

describe('AuthenticatedShell — dashboard + bottone Disconnetti', () => {
  const markup = render(false);

  it('rende la dashboard (azione primaria da t())', () => {
    expect(markup).toContain(en.dashboard.primaryAction);
  });

  it('rende il bottone Disconnetti da t()', () => {
    expect(markup).toContain(en.auth.signOut);
  });

  it('NON rende il form di autenticazione', () => {
    expect(markup).not.toContain('id="auth-email"');
    expect(markup).not.toContain('id="auth-password"');
  });

  it('ha un solo landmark <main> (nessun <main> annidato/duplicato)', () => {
    // La shell è <header> + <DashboardScreen> (l'UNICO <main>) + due <section>.
    // Un <main> annidato o duplicato è un difetto (single-main di 1.7/1.8).
    const opens = markup.match(/<main/g) ?? [];
    expect(opens.length).toBe(1);
  });
});

describe('AuthenticatedShell — pending disabilita Disconnetti', () => {
  it('signOutPending={true} ⇒ il bottone Disconnetti è disabled', () => {
    const markup = render(true);
    // Il Disconnetti è il PRIMO <button> del markup (nell'<header>, prima della
    // dashboard): estraiamo il suo tag di apertura.
    const buttonTag = markup.slice(
      markup.indexOf('<button'),
      markup.indexOf('>', markup.indexOf('<button')) + 1,
    );
    expect(buttonTag).toContain('disabled');
  });

  it('signOutPending={false} ⇒ il bottone Disconnetti NON è disabled', () => {
    const markup = render(false);
    const buttonTag = markup.slice(
      markup.indexOf('<button'),
      markup.indexOf('>', markup.indexOf('<button')) + 1,
    );
    expect(buttonTag).not.toContain('disabled');
  });
});
