// @vitest-environment jsdom
//
// Il ripasso libero di una lezione GUIDATO da tastiera, come la sessione: cifre per
// rispondere, `Enter` per il prossimo, fino alla chiusura col punteggio. E la prova
// che il ripasso non tocca la pila: nessuna scrittura sulle porte di ripasso.
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../../i18n';
import { answerOptions } from '../../domain/exercise-presentation';
import type { Exercise } from '../../domain/exercise';
import type { ExerciseContent, LessonSummary } from '../../domain/ports/contentRepository';
import { PortsProvider, type Ports } from '../ports/PortsContext';
import { LessonPracticeScreen } from './LessonPracticeScreen';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const UID = 'user-1';
const NOW = new Date('2026-09-30T10:00:00.000Z');

const first: Exercise = {
  kind: 'single-select',
  grammarPoint: 'wa-particle',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['を', 'が', 'に'],
  explanation: { en: 'The topic particle.' },
};
const second: Exercise = {
  kind: 'single-select',
  grammarPoint: 'ga-particle',
  sentence: { kanji: '猫が好きです', kana: 'ねこがすきです' },
  answer: 'が',
  distractors: ['を', 'は', 'に'],
  explanation: { en: 'The subject particle.' },
};
const EXERCISES: readonly ExerciseContent[] = [
  { id: 'ex-1', exercise: first },
  { id: 'ex-2', exercise: second },
];

const LESSONS: readonly LessonSummary[] = [
  { id: 'l1', ordinal: 1, title: { en: 'First lesson' }, grammarPoints: ['wa-particle'], exerciseCount: 2 },
  { id: 'l2', ordinal: 2, title: { en: 'Second lesson' }, grammarPoints: ['ga-particle'], exerciseCount: 2 },
];

let container: HTMLDivElement;
let root: Root;
let applyReview: ReturnType<typeof vi.fn>;
let unlockLesson: ReturnType<typeof vi.fn>;
let listExercisesByLesson: ReturnType<typeof vi.fn>;

function ports(): Ports {
  return {
    clock: { now: () => NOW, timeZone: () => 'UTC' },
    review: { listDue: async () => [], listReviewLog: async () => [], applyReview },
    progress: {
      listUnlockedLessons: async () => [{ lessonId: 'l1', unlockedAt: NOW }],
      unlockLesson,
    },
    content: {
      listLessons: async () => LESSONS,
      listExercisesByIds: async () => [],
      listExercisesByLesson: listExercisesByLesson as unknown as Ports['content']['listExercisesByLesson'],
    },
  };
}

async function mount(lessonId: string, onExit = vi.fn()): Promise<void> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <StrictMode>
        <QueryClientProvider client={qc}>
          <PortsProvider value={ports()}>
            {/* random 0.99 ⇒ Fisher–Yates lascia l'ordine invariato. */}
            <LessonPracticeScreen userId={UID} lessonId={lessonId} onExit={onExit} random={() => 0.99} />
          </PortsProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
  });
  // Le query risolvono in modo asincrono: si attende che lo scheletro sparisca.
  for (let i = 0; i < 20 && container.innerHTML.includes('aria-busy="true"'); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function press(key: string): void {
  act(() => {
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

function keyFor(exercise: Exercise, option: string): string {
  return String(answerOptions(exercise).indexOf(option) + 1);
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  applyReview = vi.fn(async () => {});
  unlockLesson = vi.fn(async () => {});
  listExercisesByLesson = vi.fn(async () => EXERCISES);
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('LessonPracticeScreen', () => {
  it('un giro completo da tastiera: esito, punteggio, chiusura, e la pila non si tocca', async () => {
    await mount('l1');
    expect(listExercisesByLesson).toHaveBeenCalledWith('l1');
    expect(container.innerHTML).toContain('Lezione 1');
    expect(container.innerHTML).toContain('First lesson');
    expect(container.innerHTML).toContain('0/2');

    press(keyFor(first, 'は')); // giusta
    expect(container.innerHTML).toContain('La risposta è corretta.');
    press('Enter');

    press(keyFor(second, 'を')); // sbagliata
    expect(container.innerHTML).toContain('La risposta non è corretta.');
    press('Enter');

    expect(container.innerHTML).toContain('Risposte corrette: 1 su 2. La pila non è cambiata.');
    expect(container.innerHTML).toContain('Ripassala di nuovo');
    expect(applyReview).not.toHaveBeenCalled();
    expect(unlockLesson).not.toHaveBeenCalled();

    // Un altro giro riparte da zero.
    act(() => {
      [...container.querySelectorAll('button')]
        .find((b) => b.textContent?.includes('Ripassala di nuovo'))!
        .click();
    });
    expect(container.innerHTML).toContain('0/2');
  });

  it('una lezione non sbloccata non si ripassa: lo dichiara, senza caricare esercizi', async () => {
    await mount('l2');
    expect(container.innerHTML).toContain('non è ancora sbloccata');
    expect(listExercisesByLesson).not.toHaveBeenCalled();
  });

  it('una lezione inesistente lo dichiara', async () => {
    await mount('nessuna');
    expect(container.innerHTML).toContain('Questa lezione non esiste.');
  });

  it('Esc torna alle lezioni', async () => {
    const onExit = vi.fn();
    await mount('l1', onExit);
    press('Escape');
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
