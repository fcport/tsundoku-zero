import { describe, expect, it } from 'vitest';
import type { Exercise } from './exercise';
import type { LessonSummary } from './ports/contentRepository';
import { pileBooks } from './pile';

const exercise = (grammarPoint: string): Exercise => ({
  kind: 'single-select',
  grammarPoint,
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['が'],
  explanation: { en: 'x' },
});

const lesson = (ordinal: number, grammarPoints: string[]): LessonSummary => ({
  id: `l${ordinal}`,
  ordinal,
  title: { en: 'x' },
  grammarPoints,
  exerciseCount: 1,
});

describe('pileBooks — la pila come dorsi di libri', () => {
  const lessons = [lesson(900, ['を']), lesson(2, ['ゼロ代名詞', 'を']), lesson(1, ['が'])];
  const exercises = [
    { id: 'a', exercise: exercise('が') },
    { id: 'b', exercise: exercise('を') },
    { id: 'c', exercise: exercise('ゼロ代名詞') },
  ];

  it("segue l'ordine della coda: il primo dorso è il prossimo esercizio", () => {
    expect(pileBooks(['c', 'a', 'b'], exercises, lessons).map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  it('la lezione è quella del curriculum che dichiara la regola, mai la fixture riservata', () => {
    expect(pileBooks(['a', 'b'], exercises, lessons)).toEqual([
      { id: 'a', grammarPoint: 'が', lessonOrdinal: 1 },
      { id: 'b', grammarPoint: 'を', lessonOrdinal: 2 },
    ]);
  });

  it('un id senza contenuto caricato non ha dorso; una regola orfana ha lezione null', () => {
    const orphan = [...exercises, { id: 'd', exercise: exercise('orfana') }];
    expect(pileBooks(['x', 'd'], orphan, lessons)).toEqual([
      { id: 'd', grammarPoint: 'orfana', lessonOrdinal: null },
    ]);
  });
});
