// @vitest-environment jsdom
//
// AC4 — il PRECARICO della sessione osservato dalla SUPERFICIE ESTERNA (4.1): un
// click sull'azione primaria «svuota pila» esegue il precarico dell'INTERA pila
// (contenuto+spiegazioni) e SOLO dopo la sua conclusione naviga a `/study`. È
// l'unica prova che richiede di GUIDARE la componente resa (un click, non una
// funzione pura): `renderToStaticMarkup` (env `node`, il resto della suite) non
// esegue eventi né effetti, quindi questo file marca l'ambiente `jsdom` SOLO per
// sé (il docblock sopra) — l'env globale resta `node`.
//
// Nessuna testing-library: `createRoot` + `act` (da `react`, disponibile in React
// 19) + un click nativo. `MemoryRouter` fornisce il contesto di routing; un
// componente sonda cattura `useLocation().pathname` così la navigazione è
// osservabile. Le porte sono SPIE (`vi.fn`): il precarico chiama `listDue` +
// `listExercisesByIds` con gli id dovuti.
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en';
import { i18n } from '../i18n';
import { dueQueryKey } from '../domain/due';
import type { ReviewState } from '../domain/schedule';
import type { ExerciseContent } from '../domain/ports/contentRepository';
import type { Exercise } from '../domain/exercise';
import { PortsProvider, type Ports } from '../features/ports/PortsContext';
import { AuthenticatedShell } from './AuthenticatedShell';
import { STATS_PATH } from './routes';
import type { SettingsRepository } from '../domain/ports/settingsRepository';

// React 19 richiede questo flag per far girare `act` senza avvisi.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const UID = 'user-1';
const NOW = new Date('2026-09-25T12:00:00.000Z');

const anExercise: Exercise = {
  kind: 'single-select',
  grammarPoint: 'wa-particle',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['を', 'が'],
  explanation: { en: 'The topic particle.' },
};

const EXERCISES: readonly ExerciseContent[] = [
  { id: 'ex-1', exercise: anExercise },
];

function due(id: string): ReviewState {
  return {
    exerciseId: id,
    stage: 0,
    dueAt: new Date(0),
    reviewCount: 0,
    lapseCount: 0,
    lastReviewedAt: null,
  };
}

const DUE_STATES: readonly ReviewState[] = [due('ex-1')];

const inertSettings: SettingsRepository = {
  loadLocale: async () => null,
  saveLocale: async () => {},
  loadLessonsPerDay: async () => null,
  saveLessonsPerDay: async () => {},
};

let listDue: ReturnType<typeof vi.fn>;
let listExercisesByIds: ReturnType<typeof vi.fn>;

function spyPorts(): Ports {
  listDue = vi.fn(async () => DUE_STATES);
  listExercisesByIds = vi.fn(async (ids: readonly string[]) =>
    EXERCISES.filter((e) => ids.includes(e.id)),
  );
  return {
    clock: { now: () => NOW, timeZone: () => 'UTC' },
    review: {
      listDue: listDue as unknown as Ports['review']['listDue'],
      listReviewLog: async () => [],
      applyReview: async () => {},
    },
    progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
    content: {
      listLessons: async () => [],
      listExercisesByIds:
        listExercisesByIds as unknown as Ports['content']['listExercisesByIds'],
      listExercisesByLesson: async () => [],
    },
  };
}

// Cache seminata così la dashboard rende lo stato CARICATO con l'azione primaria
// (`count > 0`). La pila `['due']` NON è seminata di proposito: così il precarico
// deve chiamare `listDue` (osservabile). Le altre chiavi sono seminate perché il
// cancello scheletro della dashboard le richiede tutte. Perché la dashboard renda
// `primaryAction` (pila non vuota) serve però un conteggio > 0 dalla pila: la
// seminiamo — il precarico allora RIUSA la cache (AC3) e chiama solo il contenuto.
function seededClient(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(dueQueryKey(UID), DUE_STATES);
  qc.setQueryData(['streak', UID], []);
  qc.setQueryData(['unlocked', UID], [
    { lessonId: 'lesson-0', unlockedAt: new Date('2026-09-25T00:00:00.000Z') },
  ]);
  qc.setQueryData(['lessons'], [
    { id: 'lesson-0', ordinal: 0, title: { en: 'L0' }, grammarPoints: [], exerciseCount: 1 },
  ]);
  qc.setQueryData(['lessonsPerDay', UID], 1);
  return qc;
}

// Sonda: cattura il pathname corrente in un contenitore osservabile dopo il render.
let currentPath = '';
function LocationProbe() {
  currentPath = useLocation().pathname;
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(qc: QueryClient, ports: Ports): void {
  act(() => {
    root.render(
      <StrictMode>
        <QueryClientProvider client={qc}>
          <PortsProvider value={ports}>
            <MemoryRouter initialEntries={['/']}>
              <AuthenticatedShell
                settings={inertSettings}
                userId={UID}
                onSignOut={() => {}}
                signOutPending={false}
              />
              <LocationProbe />
            </MemoryRouter>
          </PortsProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
  });
}

/** Trova il bottone dell'azione primaria «svuota pila» per il suo testo da t(). */
function primaryButton(): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll('button'));
  const button = buttons.find(
    (b) => b.textContent?.trim() === en.dashboard.primaryAction,
  );
  if (!button) throw new Error('azione primaria «svuota pila» non trovata');
  return button as HTMLButtonElement;
}

/** Trova l'affordance secondaria «vedi statistiche» per il suo testo da t(). */
function viewStatsButton(): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll('button'));
  const button = buttons.find(
    (b) => b.textContent?.trim() === en.dashboard.viewStats,
  );
  if (!button) throw new Error('affordance «vedi statistiche» non trovata');
  return button as HTMLButtonElement;
}

/** Lascia risolvere il precarico asincrono (microtask) dentro `act`. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  currentPath = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await i18n.changeLanguage('en');
});

describe('AuthenticatedShell — precarico all avvio sessione (4.1, AC4)', () => {
  it('parte su / (nessuna navigazione prima del click)', () => {
    mount(seededClient(), spyPorts());
    expect(currentPath).toBe('/');
  });

  it('un click su «svuota pila» precarica il contenuto dovuto e naviga a /study', async () => {
    mount(seededClient(), spyPorts());

    act(() => {
      primaryButton().click();
    });
    await flush();

    // Il precarico ha caricato il contenuto per gli id dovuti (AC4). `['due']` è
    // seminata (come dopo il conteggio della dashboard) ⇒ riuso della cache (AC3),
    // quindi `listDue` NON è richiamata; `listExercisesByIds` sì, con gli id dovuti.
    expect(listExercisesByIds).toHaveBeenCalledTimes(1);
    expect(listExercisesByIds).toHaveBeenCalledWith(['ex-1']);
    // La navigazione avviene DOPO il precarico.
    expect(currentPath).toBe('/study');
  });

  it('un doppio click non avvia due precarichi sovrapposti (guardia di re-entrancy)', async () => {
    mount(seededClient(), spyPorts());

    act(() => {
      const b = primaryButton();
      b.click();
      b.click();
    });
    await flush();

    // La guardia `useRef` blocca il secondo click finché il primo precarico è in
    // volo: il contenuto è caricato UNA sola volta.
    expect(listExercisesByIds).toHaveBeenCalledTimes(1);
    expect(currentPath).toBe('/study');
  });

  it('un errore nel precarico NON blocca la navigazione: naviga COMUNQUE a /study (degrado grazioso, AC5)', async () => {
    // `['due']` è seminata (il bottone richiede conteggio > 0) ⇒ il precarico la
    // RIUSA e fallisce al passo contenuto: `listExercisesByIds` rigetta. La `.catch`
    // del wiring inghiotte il reject (nessuna unhandled rejection) e `.finally`
    // naviga comunque — la sessione ripiega poi sul caricamento reattivo.
    const failing: Ports = {
      clock: { now: () => NOW, timeZone: () => 'UTC' },
      review: {
        listDue: async () => DUE_STATES,
        listReviewLog: async () => [],
        applyReview: async () => {},
      },
      progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
      content: {
        listLessons: async () => [],
        listExercisesByIds: async () => {
          throw new Error('network');
        },
        listExercisesByLesson: async () => [],
      },
    };
    mount(seededClient(), failing);

    act(() => {
      primaryButton().click();
    });
    await flush();

    expect(currentPath).toBe('/study');
  });
});

describe('AuthenticatedShell — navigazione alle statistiche (5.1)', () => {
  // La SOLA porta di ingresso alla StatsScreen dalla dashboard: un click su «vedi
  // statistiche» deve portare a `/stats`. La navigazione è una callback
  // cablata dalla shell (AD-1) — osservata qui dalla superficie esterna (un click,
  // il pathname della sonda), non da un'asserzione statica sul markup. Nessun
  // precarico: l'affordance naviga e basta.
  it('un click su «vedi statistiche» naviga a /stats', () => {
    mount(seededClient(), spyPorts());
    expect(currentPath).toBe('/');

    act(() => {
      viewStatsButton().click();
    });

    expect(currentPath).toBe(STATS_PATH);
  });
});
