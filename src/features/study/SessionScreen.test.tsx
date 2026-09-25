import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { i18n } from '../../i18n';
import { dueQueryKey } from '../../domain/due';
import type { ReviewState } from '../../domain/schedule';
import type { ExerciseContent } from '../../domain/ports/contentRepository';
import type { Exercise } from '../../domain/exercise';
import { answerOptions } from '../../domain/exercise-presentation';
import { PortsProvider, type Ports } from '../ports/PortsContext';
import { SessionScreen } from './SessionScreen';

// AC1/AC2 + Matrix — il container della sessione. Ambiente `node`:
// renderToStaticMarkup non esegue effetti; con la cache SEMINATA le query
// risolvono in modo SINCRONO al primo render. userId null ⇒ scheletro; pila +
// esercizi seminati ⇒ card dell'esercizio CORRENTE (consegna + opzioni); pila vuota
// ⇒ neutro; un solo <main>.

const UID = 'user-1';
const NOW = new Date('2026-09-25T12:00:00.000Z');

// Porte inerti: con la cache seminata le queryFn non partono.
const inMemoryPorts: Ports = {
  clock: { now: () => NOW, timeZone: () => 'UTC' },
  review: { listDue: async () => [], listReviewLog: async () => [] },
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
 * quella che il componente costruisce: `['exercises', dueIds]` dove
 * `dueIds = due.map((s) => s.exerciseId)`.
 */
function seededClient(
  dueStates: readonly ReviewState[],
  exercises: readonly ExerciseContent[],
): QueryClient {
  const qc = freshClient();
  qc.setQueryData(dueQueryKey(UID), dueStates);
  const dueIds = dueStates.map((s) => s.exerciseId);
  qc.setQueryData(['exercises', dueIds], exercises);
  return qc;
}

function render(qc: QueryClient, userId: string | null): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <PortsProvider value={inMemoryPorts}>
        <SessionScreen userId={userId} />
      </PortsProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
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

describe('AC1/AC2 — pila + esercizi seminati ⇒ card dell esercizio CORRENTE', () => {
  const qc = seededClient(
    [due('ex-1'), due('ex-2')],
    [
      { id: 'ex-1', exercise: firstExercise },
      { id: 'ex-2', exercise: secondExercise },
    ],
  );
  const markup = render(qc, UID);

  it('rende la consegna dell esercizio corrente (il primo della coda)', () => {
    // currentExerciseId = testa della coda = ex-1 (single-select).
    expect(markup).toContain(en.session.prompt.singleSelect);
    // NON quella del secondo (assemble).
    expect(markup).not.toContain(en.session.prompt.assemble);
  });

  it('rende la frase giapponese (lang="ja")', () => {
    expect(markup).toContain('lang="ja"');
  });

  it('rende le opzioni dell esercizio corrente (1 + |distractors|)', () => {
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1 + firstExercise.distractors.length);
    for (const option of answerOptions(firstExercise)) {
      expect(markup).toContain(`>${option}<`);
    }
  });

  it('ha un solo <main>', () => {
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });
});

describe('Matrix — pila vuota (deep-link) ⇒ stato neutro senza card', () => {
  it('dueIds = [] ⇒ nessuna card, un solo <main>, nessuna consegna', () => {
    const qc = freshClient();
    qc.setQueryData(dueQueryKey(UID), []);
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.session.prompt.singleSelect);
    expect(markup).not.toContain(en.session.prompt.assemble);
    expect(markup).not.toContain(en.session.prompt.selectSpan);
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
    // Non è lo scheletro (la pila è caricata, solo vuota).
    expect(markup).not.toContain('aria-busy="true"');
  });
});

describe('Matrix — id corrente assente dal caricato ⇒ stato neutro senza card', () => {
  it('la mappa esercizi non contiene l id corrente ⇒ nessuna card', () => {
    // Pila con ex-1 ma il caricato porta solo ex-9: bordo di contenuto.
    const qc = seededClient(
      [due('ex-1')],
      [{ id: 'ex-9', exercise: firstExercise }],
    );
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.session.prompt.singleSelect);
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });
});
