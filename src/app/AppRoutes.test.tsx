import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { AppRoutes } from './AppRoutes';
import { dueQueryKey } from '../domain/due';
import { PortsProvider, type Ports } from '../features/ports/PortsContext';
import type { AuthGateway } from '../domain/ports/authGateway';
import type { SettingsRepository } from '../domain/ports/settingsRepository';
import type { AccountGateway } from '../domain/ports/accountGateway';

// Righe di route-matching della I/O Matrix (storia 1.8, aggiornata in 3.12). Il
// route-matching è SINCRONO (nessun effetto): renderToStaticMarkup NON esegue
// useEffect, quindi <Navigate> rende null in SSR. La radice protetta ora rende la
// dashboard (3.12) invece del branding placeholder: con la cache SEMINATA le
// query risolvono in modo sincrono al primo render (stato caricato), così la
// shell mostra il conteggio + l'azione primaria. Le asserzioni restano per
// PRESENZA/ASSENZA del contenuto raggiunto (decisione del guard) e per l'unico
// <main>. Ambiente node. La navigazione reale del browser è verifica live differita.

// Il gateway è passato solo ad AuthScreen e non è invocato senza submit: un
// finto inerte COMPLETO (schema di 1.7, esteso con currentUserId in 3.12).
const inertGateway: AuthGateway = {
  signUp: async () => ({ ok: true }),
  signIn: async () => ({ ok: true }),
  signOut: async () => {},
  isAuthenticated: async () => false,
  currentUserId: async () => null,
  onAuthStateChange: () => () => {},
};
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

// Porte del ciclo iniettate alla dashboard (3.12). Con la cache seminata le
// queryFn non vengono invocate al primo render sincrono; restano inerti.
const inertPorts: Ports = {
  clock: { now: () => new Date('2026-09-25T12:00:00.000Z'), timeZone: () => 'UTC' },
  review: { listDue: async () => [], listReviewLog: async () => [] },
  progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
  content: { listLessons: async () => [], listExercisesByIds: async () => [] },
};

// L'esercizio corrente seminato per la rotta /studia: single-select, la cui chiave
// di riga combacia con l'unico dovuto seminato (exerciseId 'a', dueIds = ['a']).
const STUDY_EXERCISE = {
  id: 'a',
  exercise: {
    kind: 'single-select',
    grammarPoint: 'wa-particle',
    sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
    answer: 'は',
    distractors: ['を', 'が'],
    explanation: { en: 'The topic particle.' },
  },
} as const;

const NOOP = () => {};
const UID = 'user-1';

// Cache seminata sulle quattro chiavi per l'utente `UID`: fa risolvere le query
// in modo SINCRONO (stato caricato), così la shell protetta rende la dashboard
// popolata invece dello scheletro.
function seededClient(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(dueQueryKey(UID), [
    { exerciseId: 'a', stage: 0, dueAt: new Date(0), reviewCount: 0, lapseCount: 0, lastReviewedAt: null },
  ]);
  // La rotta /studia (3.18) legge la STESSA pila (dueIds = ['a']) e carica gli
  // esercizi sotto ['exercises', dueIds]: seminata così la SessionScreen rende la
  // card sincrona invece dello scheletro.
  qc.setQueryData(['exercises', ['a']], [STUDY_EXERCISE]);
  qc.setQueryData(['streak', UID], []);
  // Stato NON di primo avvio (3.15): una lezione già sbloccata, così la dashboard
  // rende lo stato caricato con `primaryAction`. Con `unlocked === 0` renderebbe
  // invece il primo avvio (niente `primaryAction`). Il read-model unico (3.17)
  // porta anche `unlockedAt`.
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

function renderAt(
  path: string,
  authenticated: boolean,
  userId: string | null = UID,
): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={seededClient()}>
      <PortsProvider value={inertPorts}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes
            authenticated={authenticated}
            gateway={inertGateway}
            settings={inertSettings}
            account={inertAccount}
            userId={userId}
            onAuthenticated={NOOP}
            onSignOut={NOOP}
            signOutPending={false}
            onAccountDeleted={NOOP}
          />
        </MemoryRouter>
      </PortsProvider>
    </QueryClientProvider>,
  );
}

describe('AppRoutes — radice protetta, autenticato', () => {
  const markup = renderAt('/', true);

  it('rende AuthenticatedShell: dashboard (azione primaria) + Disconnetti', () => {
    expect(markup).toContain(en.dashboard.primaryAction);
    expect(markup).toContain(en.auth.signOut);
  });

  it('NON rende il form', () => {
    expect(markup).not.toContain('id="auth-email"');
    expect(markup).not.toContain('id="auth-password"');
  });

  it('ha un solo landmark <main> (nessun <main> annidato)', () => {
    // La dashboard dentro AuthenticatedShell fornisce l'UNICO <main>; l'<header>
    // con Disconnetti e le <section> Impostazioni/Account non ne aggiungono altri.
    const opens = markup.match(/<main/g) ?? [];
    expect(opens.length).toBe(1);
  });
});

describe('AppRoutes — deep link protetto, autenticato', () => {
  const markup = renderAt('/dashboard', true);

  it('rende la radice protetta minima (azione primaria + Disconnetti)', () => {
    expect(markup).toContain(en.dashboard.primaryAction);
    expect(markup).toContain(en.auth.signOut);
  });
});

describe('AppRoutes — radice protetta, anonimo', () => {
  const markup = renderAt('/', false);

  it('il guard blocca: né dashboard né Disconnetti (Navigate→null in SSR)', () => {
    expect(markup).not.toContain(en.dashboard.primaryAction);
    expect(markup).not.toContain(en.auth.signOut);
  });
});

describe('AppRoutes — deep link protetto, anonimo', () => {
  const markup = renderAt('/statistiche', false);

  it('il guard blocca: nessuna dashboard', () => {
    expect(markup).not.toContain(en.dashboard.primaryAction);
    expect(markup).not.toContain(en.auth.signOut);
  });
});

describe('AppRoutes — rotta di Accesso, anonimo', () => {
  const markup = renderAt('/login', false);

  it('rende il form (id="auth-email", id="auth-password")', () => {
    expect(markup).toContain('id="auth-email"');
    expect(markup).toContain('id="auth-password"');
    expect(markup).toContain(en.auth.submit);
  });

  it('ha un solo landmark <main> (nessun <main> annidato)', () => {
    // AuthScreen fornisce l'UNICO <main> (non riusa la dashboard): esattamente uno.
    const opens = markup.match(/<main/g) ?? [];
    expect(opens.length).toBe(1);
  });
});

describe('AppRoutes — rotta di Accesso, autenticato', () => {
  const markup = renderAt('/login', true);

  it('NON rende il form (rediretto; Navigate→null in SSR)', () => {
    expect(markup).not.toContain('id="auth-email"');
    expect(markup).not.toContain('id="auth-password"');
    expect(markup).not.toContain(en.auth.submit);
  });
});

describe('AppRoutes — rotta /studia, autenticato (3.18)', () => {
  const markup = renderAt('/studia', true);

  it('rende la SessionScreen: la consegna dell esercizio corrente', () => {
    expect(markup).toContain(en.session.prompt.singleSelect);
    // NON la dashboard: /studia ha precedenza sul catch-all.
    expect(markup).not.toContain(en.dashboard.primaryAction);
  });

  it('rende la frase giapponese (lang="ja") e un solo <main>', () => {
    expect(markup).toContain('lang="ja"');
    const opens = markup.match(/<main/g) ?? [];
    expect(opens.length).toBe(1);
  });
});

describe('AppRoutes — rotta /studia, anonimo (3.18)', () => {
  const markup = renderAt('/studia', false);

  it('il guard blocca: nessuna SessionScreen (Navigate→null in SSR)', () => {
    expect(markup).not.toContain(en.session.prompt.singleSelect);
    expect(markup).not.toContain('lang="ja"');
  });
});
