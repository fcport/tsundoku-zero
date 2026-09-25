import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { i18n } from '../../i18n';
import { dueQueryKey } from '../../domain/due';
import { createSession } from '../../domain/session';
import type { ReviewState } from '../../domain/schedule';
import type { ExerciseContent } from '../../domain/ports/contentRepository';
import type { Exercise } from '../../domain/exercise';
import { answerOptions } from '../../domain/exercise-presentation';
import { PortsProvider, type Ports } from '../ports/PortsContext';
import { useSessionStore } from './sessionStore';
import { SessionScreen } from './SessionScreen';

// AC1/AC2/AC5 + Matrix — il container della sessione (3.19). Ambiente `node`:
// renderToStaticMarkup non esegue effetti; i test SEMINANO lo store (l `start` è un
// effetto guardato, verificato live) e la cache. Con lo store seminato la corrente
// viene dallo store; la query esercizi è ancorata a `initialIds` (dallo store); la
// barra deriva total − remainingCount. Gli stati post-risposta restano coperti dai
// test di componente (ExerciseCard/ExplanationPanel/ProgressMeter).

const UID = 'user-1';
const NOW = new Date('2026-09-25T12:00:00.000Z');

// Porte inerti: con la cache seminata le queryFn non partono.
const inMemoryPorts: Ports = {
  clock: { now: () => NOW, timeZone: () => 'UTC' },
  review: { listDue: async () => [], listReviewLog: async () => [], applyReview: async () => {} },
  progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
  content: { listLessons: async () => [], listExercisesByIds: async () => [] },
};

const firstExercise: Exercise = {
  kind: 'single-select',
  grammarPoint: 'wa-particle',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['を', 'が', 'に'],
  explanation: { en: 'The topic particle.' },
};

const secondExercise: Exercise = {
  kind: 'assemble',
  grammarPoint: 'word-order',
  sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
  answer: ['本', 'を', '読む'],
  explanation: { en: 'Subject object verb.' },
};

/** Stato di ripasso minimo: la sessione usa solo `exerciseId`. */
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

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Semina la pila e gli esercizi. La chiave degli esercizi DEVE combaciare con
 * quella che il componente costruisce: `['exercises', initialIds]` dove
 * `initialIds` sono gli id seminati nello store.
 */
function seededClient(
  dueStates: readonly ReviewState[],
  exercises: readonly ExerciseContent[],
): QueryClient {
  const qc = freshClient();
  qc.setQueryData(dueQueryKey(UID), dueStates);
  const ids = dueStates.map((s) => s.exerciseId);
  qc.setQueryData(['exercises', ids], exercises);
  return qc;
}

/** Semina lo store con gli id INIZIALI (l `start` di produzione è un effetto). */
function seedStore(ids: readonly string[]): void {
  useSessionStore.getState().start(ids);
}

const NOOP = () => {};

function render(qc: QueryClient, userId: string | null): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <PortsProvider value={inMemoryPorts}>
        <SessionScreen userId={userId} onExit={NOOP} />
      </PortsProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  // Store fresco: il singleton di modulo è condiviso fra i test.
  useSessionStore.setState({ session: createSession([]), total: 0, initialIds: [] });
});
afterEach(async () => {
  await i18n.changeLanguage('en');
  useSessionStore.setState({ session: createSession([]), total: 0, initialIds: [] });
});

describe('Caricamento — userId null / pila pending ⇒ scheletro', () => {
  it('userId null ⇒ scheletro aria-busy, nessuna consegna', () => {
    const markup = render(freshClient(), null);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain(en.session.prompt.singleSelect);
  });

  it('pila non seminata (query pending) ⇒ scheletro aria-busy', () => {
    const markup = render(freshClient(), UID);
    expect(markup).toContain('aria-busy="true"');
  });

  it('lo scheletro non contiene uno spinner', () => {
    const markup = render(freshClient(), null);
    expect(markup.toLowerCase()).not.toContain('spinner');
    expect(markup).not.toContain('role="status"');
  });
});

describe('AC1/AC2/AC5 — store + esercizi seminati ⇒ card dell esercizio CORRENTE + barra', () => {
  function setup(): string {
    seedStore(['ex-1', 'ex-2']);
    const qc = seededClient(
      [due('ex-1'), due('ex-2')],
      [
        { id: 'ex-1', exercise: firstExercise },
        { id: 'ex-2', exercise: secondExercise },
      ],
    );
    return render(qc, UID);
  }

  it('rende la consegna dell esercizio corrente (la testa della coda dello store)', () => {
    const markup = setup();
    expect(markup).toContain(en.session.prompt.singleSelect);
    expect(markup).not.toContain(en.session.prompt.assemble);
  });

  it('rende la frase giapponese (lang="ja")', () => {
    expect(setup()).toContain('lang="ja"');
  });

  it('rende le opzioni dell esercizio corrente (1 + |distractors|)', () => {
    const markup = setup();
    for (const option of answerOptions(firstExercise)) {
      expect(markup).toContain(`>${option}<`);
    }
  });

  it('ha un solo <main>', () => {
    const mains = setup().match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });

  it('rende la ProgressMeter con attributi ARIA coerenti (0 completati su total)', () => {
    const markup = setup();
    expect(markup).toContain('role="progressbar"');
    // Nessuna risposta ancora: 0 completati su 2.
    expect(markup).toContain('aria-valuenow="0"');
    expect(markup).toContain('aria-valuemax="2"');
    expect(markup).toContain('aria-valuemin="0"');
    // aria-label dalla i18n.
    expect(markup).toContain(en.session.progress.label);
  });

  it('rende l affordance «esci» nel ramo sessione-attiva (AC2)', () => {
    expect(setup()).toContain(en.session.exit);
  });
});

describe('Matrix — pila vuota (deep-link) ⇒ stato neutro senza card, nessuna barra', () => {
  it('store vuoto + pila vuota ⇒ nessuna card, nessuna barra, un solo <main>', () => {
    const qc = freshClient();
    qc.setQueryData(dueQueryKey(UID), []);
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.session.prompt.singleSelect);
    expect(markup).not.toContain(en.session.prompt.assemble);
    expect(markup).not.toContain(en.session.prompt.selectSpan);
    // Barra non resa a total 0.
    expect(markup).not.toContain('role="progressbar"');
    // Affordance «esci» assente: non c'è sessione attiva da abbandonare (AC2).
    expect(markup).not.toContain(en.session.exit);
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
    // Non è lo scheletro (la pila è caricata, solo vuota).
    expect(markup).not.toContain('aria-busy="true"');
  });
});

describe('Matrix — id corrente assente dal caricato ⇒ stato neutro senza card', () => {
  it('la mappa esercizi non contiene l id corrente ⇒ nessuna card', () => {
    seedStore(['ex-1']);
    const qc = freshClient();
    qc.setQueryData(dueQueryKey(UID), [due('ex-1')]);
    // initialIds = ['ex-1'], ma il caricato porta solo ex-9: bordo di contenuto.
    qc.setQueryData(['exercises', ['ex-1']], [{ id: 'ex-9', exercise: firstExercise }]);
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.session.prompt.singleSelect);
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });
});
