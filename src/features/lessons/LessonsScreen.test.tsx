import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import type { LessonSummary } from '../../domain/ports/contentRepository';
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
  progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
  content: {
    listLessons: async () => [],
    listExercisesByIds: async () => [],
    listExercisesByLesson: async () => [],
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

function render(lessons: readonly LessonSummary[], unlocked: readonly string[]): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['lessons'], lessons);
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
