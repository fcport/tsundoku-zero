import { describe, expect, it } from 'vitest';
import type { LessonSummary } from './ports/contentRepository';
import type { ReviewOutcome } from './schedule';
import type { ReviewLogRecord } from './streak';
import { weakLessons } from './weakLessons';

const NOW = new Date('2026-10-02T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function lesson(ordinal: number, grammarPoints: string[]): LessonSummary {
  return { id: `l${ordinal}`, ordinal, title: { en: `L${ordinal}` }, grammarPoints, exerciseCount: 12 };
}

/** `n` risposte alla regola, di cui `wrong` sbagliate, `daysAgo` giorni fa. */
function answers(grammarPoint: string, n: number, wrong: number, daysAgo = 1): ReviewLogRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    exerciseId: `${grammarPoint}-${i}`,
    grammarPoint,
    outcome: (i < wrong ? 'again' : 'good') as ReviewOutcome,
    reviewedAt: new Date(NOW.getTime() - daysAgo * DAY),
  }));
}

const LESSONS = [lesson(1, ['a', 'b']), lesson(2, ['c']), lesson(3, ['d', 'e']), lesson(4, ['f'])];

describe('weakLessons — le lezioni dove sbagli di più', () => {
  it('ordina per tasso d’errore, al più 3, con la regola peggiore di ciascuna', () => {
    const log = [
      ...answers('a', 6, 1),
      ...answers('b', 4, 3), // l1: 4/10, peggiore b
      ...answers('c', 10, 1), // l2: 1/10
      ...answers('d', 5, 2),
      ...answers('e', 5, 2), // l3: 4/10, pari errori: vince d (prima nella lezione)
      ...answers('f', 10, 5), // l4: 5/10
    ];
    const weak = weakLessons(log, LESSONS, NOW);
    expect(weak.map((w) => w.lesson.ordinal)).toEqual([4, 1, 3]);
    expect(weak[0]).toMatchObject({ total: 10, errors: 5, errorRate: 0.5 });
    expect(weak[1]?.worstRule).toEqual({ grammarPoint: 'b', errors: 3 });
    expect(weak[2]?.worstRule).toEqual({ grammarPoint: 'd', errors: 2 });
  });

  it('contano solo le ultime 2 settimane', () => {
    const weak = weakLessons([...answers('c', 10, 9, 20), ...answers('c', 8, 1, 2)], LESSONS, NOW);
    expect(weak).toHaveLength(1);
    expect(weak[0]).toMatchObject({ total: 8, errors: 1 });
  });

  it('servono almeno 8 risposte e almeno un errore', () => {
    expect(weakLessons(answers('c', 7, 7), LESSONS, NOW)).toEqual([]);
    expect(weakLessons(answers('c', 12, 0), LESSONS, NOW)).toEqual([]);
  });

  it('una regola che nessuna lezione dichiara non conta', () => {
    expect(weakLessons(answers('orfana', 10, 10), LESSONS, NOW)).toEqual([]);
  });
});
