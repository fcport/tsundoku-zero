import { describe, expect, it } from 'vitest';
import { deriveLessonId, lessonId, parseLesson, type Lesson } from './lesson';

// Test di parseLesson (AC2) e della derivazione dell'identificatore (AC5). Le
// fixture sono inline: nessun file reale in content/lessons/ (è storia 2.7).

const validExercise = {
  kind: 'single-select',
  grammarPoint: '〜を読む',
  sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
  answer: '読む',
  distractors: ['見る', '書く'],
  explanation: { en: 'The verb …' },
};

const validLesson = {
  order: 1,
  title: 'Il verbo 読む',
  grammarPoints: ['〜を読む'],
  exercises: [validExercise],
};

describe('parseLesson — happy path (AC2)', () => {
  it('accetta una lezione con esercizi e ne infersce il tipo Lesson', () => {
    const result = parseLesson(validLesson);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const lesson: Lesson = result.value;
      expect(lesson.order).toBe(1);
      expect(lesson.exercises).toHaveLength(1);
    }
  });

  it('accetta una lezione SENZA esercizi — array vuoto valido (AC2)', () => {
    const result = parseLesson({ ...validLesson, exercises: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exercises).toEqual([]);
    }
  });
});

describe('parseLesson — malformati con path localizzato (AC2)', () => {
  it('rifiuta title vuoto col path title', () => {
    const bad = parseLesson({ ...validLesson, title: '' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'title')).toBe(true);
    }
  });

  it('rifiuta grammarPoints vuoto col path grammarPoints', () => {
    const bad = parseLesson({ ...validLesson, grammarPoints: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'grammarPoints')).toBe(true);
    }
  });

  it('rifiuta order non intero (1.5)', () => {
    const bad = parseLesson({ ...validLesson, order: 1.5 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'order')).toBe(true);
    }
  });

  it('rifiuta order stringa ("1")', () => {
    const bad = parseLesson({ ...validLesson, order: '1' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'order')).toBe(true);
    }
  });

  it('rifiuta order zero (< 1)', () => {
    const bad = parseLesson({ ...validLesson, order: 0 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'order')).toBe(true);
    }
  });

  it('rifiuta un tipo annidato errato col path exercises.1.kind', () => {
    const bad = parseLesson({
      ...validLesson,
      exercises: [validExercise, { ...validExercise, kind: 42 }],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'exercises.1.kind')).toBe(true);
    }
  });

  it('rifiuta un grammarPoint vuoto nell’array', () => {
    const bad = parseLesson({ ...validLesson, grammarPoints: ['ok', ''] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['grammarPoints', 1]);
    }
  });
});

describe('deriveLessonId / lessonId (AC5, FR2.1a)', () => {
  it('id IDENTICO per stesso grammarPoints[0] con order/title diversi', () => {
    const a: Lesson = { order: 1, title: 'Alfa', grammarPoints: ['〜てform'], exercises: [] };
    const b: Lesson = { order: 9, title: 'Beta', grammarPoints: ['〜てform'], exercises: [] };
    expect(lessonId(a)).toBe(lessonId(b));
  });

  it('id DIVERSO quando il punto grammaticale cambia', () => {
    const a: Lesson = { order: 1, title: 'X', grammarPoints: ['〜てform'], exercises: [] };
    const b: Lesson = { order: 1, title: 'X', grammarPoints: ['〜たform'], exercises: [] };
    expect(lessonId(a)).not.toBe(lessonId(b));
  });

  it('deriveLessonId produce uno slug: NFKC, minuscolo, non-alfanumerico in -, collasso, trim', () => {
    expect(deriveLessonId('  Verb + て  ')).toBe('verb-て');
    expect(deriveLessonId('The Ａｂｃ Point')).toBe('the-abc-point'); // fullwidth → NFKC
    expect(deriveLessonId('A---B')).toBe('a-b');
  });

  it('un punto grammaticale interamente giapponese non collassa a stringa vuota', () => {
    expect(deriveLessonId('〜たform')).not.toBe('');
    expect(deriveLessonId('です・ます')).not.toBe('');
  });

  it('un punto di sola punteggiatura produce un id NON vuoto (totale, mai "")', () => {
    // "---", "!!!", "・・・" passano nonEmptyString() (punteggiatura non-spazio) ma
    // il loro slug sarebbe vuoto: il ripiego totale deve dare un id non vuoto.
    expect(deriveLessonId('---')).not.toBe('');
    expect(deriveLessonId('!!!')).not.toBe('');
    expect(deriveLessonId('・・・')).not.toBe('');
  });

  it('due punti di sola punteggiatura DIVERSI producono id DIVERSI (nessuna collisione)', () => {
    expect(deriveLessonId('---')).not.toBe(deriveLessonId('!!!'));
    expect(deriveLessonId('・・・')).not.toBe(deriveLessonId('！！！'));
    expect(deriveLessonId('!!!')).not.toBe(deriveLessonId('!!'));
  });
});
