import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import type { LessonSummary } from '../../domain/ports/contentRepository';
import type { ReviewLogRecord } from '../../domain/streak';
import { PortsProvider, type Ports } from '../ports/PortsContext';
import { LessonsScreen } from './LessonsScreen';

// Ambiente `node`: la pagina alla prima resa, da cache seminata (le stesse chiavi
// della dashboard). Lo stato di ciascuna lezione è provato nel dominio
// (`lessonShelf`); qui cosa la pagina ne fa: chi si ripassa, chi mostra il video,
// chi resta chiusa.

const UID = 'user-1';
const NOW = new Date('2026-09-30T10:00:00.000Z');

const ports: Ports = {
  clock: { now: () => NOW, timeZone: () => 'UTC' },
  review: { listDue: async () => [], listReviewLog: async () => [], applyReview: async () => {} },
  progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {}, addLessonExercises: async () => 0, listActiveExerciseCounts: async () => new Map() },
  content: {
    listLessons: async () => [],
    listExercisesByIds: async () => [],
    listExercisesByLesson: async () => [], listExerciseLessons: async () => new Map(),
  },
};

function lesson(ordinal: number, extra: Partial<LessonSummary> = {}): LessonSummary {
  return {
    id: `l${ordinal}`,
    ordinal,
    title: { en: `Lesson title ${ordinal}`, it: `Titolo della lezione ${ordinal}` },
    grammarPoints: [`point-${ordinal}`],
    exerciseCount: 5,
    video: 'abcdefghij' + ordinal,
    ...extra,
  };
}

function render(
  lessons: readonly LessonSummary[],
  unlocked: readonly string[],
  active?: ReadonlyMap<string, number>,
  log?: readonly ReviewLogRecord[],
): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['lessons'], lessons);
  if (active !== undefined) qc.setQueryData(['activeExercises', UID], active);
  if (log !== undefined) qc.setQueryData(['streak', UID], log);
  qc.setQueryData(
    ['unlocked', UID],
    unlocked.map((lessonId) => ({ lessonId, unlockedAt: NOW })),
  );
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <PortsProvider value={ports}>
        <LessonsScreen userId={UID} onExit={() => {}} onPractice={() => {}} />
      </PortsProvider>
    </QueryClientProvider>,
  );
}

describe('LessonsScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('elenca tutte le lezioni del curriculum con lo stato, la fascia riservata no', () => {
    const html = render([lesson(1), lesson(2), lesson(3), lesson(4), lesson(900)], ['l1', 'l2']);
    expect(html).toContain('Le lezioni');
    for (const n of [1, 2, 3, 4]) expect(html).toContain(`Titolo della lezione ${n}`);
    expect(html).not.toContain('Titolo della lezione 900');
    expect(html).toContain('Sbloccata');
    expect(html).toContain('In corso');
    expect(html).toContain('La prossima');
    expect(html).toContain('Bloccata');
    // La lezione in corso è marcata per l'AT.
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it('solo le sbloccate si ripassano e mostrano il video', () => {
    const html = render([lesson(1), lesson(2), lesson(3)], ['l1', 'l2']);
    expect(html.match(/Ripassa gli esercizi: Lezione/g)).toHaveLength(2);
    expect(html).toContain('Ripassa gli esercizi: Lezione 1');
    expect(html).toContain('Ripassa gli esercizi: Lezione 2');
    expect(html).not.toContain('Ripassa gli esercizi: Lezione 3');
    expect(html.match(/youtube\.com/g)).toHaveLength(2);
    // La prossima dice come si sblocca.
    expect(html).toContain('Si sblocca dalla dashboard, quando la pila è vuota.');
  });

  it('una lezione solo da leggere non offre il ripasso', () => {
    const html = render([lesson(1, { exerciseCount: 0 })], ['l1']);
    expect(html).toContain('Solo da leggere, senza esercizi.');
    expect(html).not.toContain('Ripassa gli esercizi: Lezione 1');
  });

  it('una lezione aperta con esercizi in riserva dice quanti ne ha in pila e offre «Esercitati di più»', () => {
    const html = render(
      [lesson(1, { exerciseCount: 24 }), lesson(2, { exerciseCount: 12 }), lesson(3, { exerciseCount: 30 })],
      ['l1', 'l2'],
      new Map([
        ['l1', 12],
        ['l2', 12],
      ]),
    );
    expect(html).toContain('Nella pila 12 esercizi su 24');
    expect(html).toContain('Esercitati di più: Lezione 1');
    // Tutti già in pila: nessuna riserva, nessuna offerta.
    expect(html).toContain('Esercizi: 12');
    expect(html).not.toContain('Esercitati di più: Lezione 2');
    // Bloccata: niente offerta anche se ha più di 12 esercizi.
    expect(html).not.toContain('Esercitati di più: Lezione 3');
  });

  it('finché i conteggi non ci sono, nessuna offerta: solo il totale', () => {
    const html = render([lesson(1, { exerciseCount: 24 })], ['l1']);
    expect(html).toContain('Esercizi: 24');
    expect(html).not.toContain('Esercitati di più: Lezione');
  });

  it('«Da ripassare»: le lezioni aperte dove sbagli di più, con la regola peggiore', () => {
    const answers = (point: string, n: number, wrong: number): ReviewLogRecord[] =>
      Array.from({ length: n }, (_, i) => ({
        exerciseId: `${point}-${i}`,
        grammarPoint: point,
        outcome: i < wrong ? 'again' : 'good',
        reviewedAt: NOW,
      }));
    const html = render(
      [lesson(1, { exerciseCount: 24 }), lesson(2), lesson(3)],
      ['l1', 'l2'],
      new Map([['l1', 12]]),
      [...answers('point-1', 10, 4), ...answers('point-2', 3, 3)],
    );
    expect(html).toContain('Dove sbagli di più');
    expect(html).toContain('40%');
    expect(html).toContain('4 su 10 risposte');
    expect(html).toContain('Il punto debole');
    // La lezione 2 ha troppe poche risposte: fuori classifica.
    expect(html).not.toContain('100%');
    // Le azioni: ripasso libero ed «Esercitati di più» (ha una riserva), anche nel riquadro.
    expect(html.match(/Esercitati di più: Lezione 1/g)).toHaveLength(2);
  });

  it('senza errori recenti il riquadro non c’è', () => {
    const html = render([lesson(1)], ['l1'], undefined, []);
    expect(html).not.toContain('Dove sbagli di più');
  });

  it('senza dati: scheletro occupato, nessuna lezione', () => {
    const qc = new QueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <PortsProvider value={ports}>
          <LessonsScreen userId={null} onExit={() => {}} onPractice={() => {}} />
        </PortsProvider>
      </QueryClientProvider>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('Ripassa gli esercizi');
  });
});

// La libreria (09-10-2026): una lezione è imparata quando lo sono tutti i suoi esercizi.
describe('LessonsScreen — la libreria', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  /** `n` risposte giuste per l'esercizio `exerciseId`, una al giorno. */
  function goods(exerciseId: string, n: number): ReviewLogRecord[] {
    return Array.from({ length: n }, (_, i) => ({
      exerciseId,
      outcome: 'good' as const,
      grammarPoint: 'point-1',
      reviewedAt: new Date(Date.UTC(2026, 8, 1 + i, 9)),
    }));
  }

  function renderWithLibrary(log: readonly ReviewLogRecord[]): string {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['lessons'], [lesson(1, { exerciseCount: 1 }), lesson(2, { exerciseCount: 2 }), lesson(3)]);
    qc.setQueryData(['streak', UID], log);
    qc.setQueryData(['unlocked', UID], ['l1', 'l2'].map((lessonId) => ({ lessonId, unlockedAt: NOW })));
    qc.setQueryData(
      ['exerciseLessons'],
      new Map([
        ['a', 'l1'],
        ['b', 'l2'],
        ['c', 'l2'],
      ]),
    );
    return renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <PortsProvider value={ports}>
          <LessonsScreen userId={UID} onExit={() => {}} onPractice={() => {}} />
        </PortsProvider>
      </QueryClientProvider>,
    );
  }

  it('conta le lezioni imparate e dice cosa vuol dire', () => {
    const html = renderWithLibrary([...goods('a', 4), ...goods('b', 4)]);
    expect(html).toContain('Lezioni imparate');
    expect(html).toContain('1 su 3');
    expect(html).toContain('Un esercizio è imparato quando');
  });

  it('la lezione imparata ha il timbro 習得; le altre dicono quanti esercizi sono imparati', () => {
    const html = renderWithLibrary([...goods('a', 4), ...goods('b', 4)]);
    expect(html).toContain('Imparata: tutti i suoi esercizi tornano solo dopo 16 giorni o più.');
    expect(html).toContain('習');
    expect(html).toContain('Esercizi imparati: 1 su 2');
  });

  it('il tanuki dorme sullo scaffale solo se c’è una lezione imparata', () => {
    expect(renderWithLibrary([...goods('a', 4)])).toContain('data-mascot="sleeping"');
    expect(renderWithLibrary([...goods('a', 3)])).not.toContain('data-mascot');
  });

  it('senza la lezione di ogni esercizio: niente conteggi', () => {
    const html = render([lesson(1), lesson(2)], ['l1'], undefined, goods('a', 4));
    expect(html).toContain('Lezioni imparate');
    expect(html).not.toContain(' su 2<');
    expect(html).not.toContain('Esercizi imparati');
  });
});
