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
  title: { en: 'Il verbo 読む' },
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
  it('rifiuta un title che non è un oggetto bilingue, col path title', () => {
    // Forma sbagliata (stringa nuda invece dell'oggetto `{ en, it? }`): l'issue è
    // sul campo stesso.
    const bad = parseLesson({ ...validLesson, title: 'titolo monolingue' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'title')).toBe(true);
    }
  });

  it('rifiuta title.en vuoto col path title.en', () => {
    const bad = parseLesson({ ...validLesson, title: { en: '' } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'title.en')).toBe(true);
    }
  });

  it('rifiuta title senza en (solo it) col path title.en — l’inglese è obbligatorio', () => {
    const bad = parseLesson({ ...validLesson, title: { it: 'Solo italiano' } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'title.en')).toBe(true);
    }
  });

  it('accetta title con il solo en — `it` è facoltativo (ripiego dichiarato)', () => {
    const ok = parseLesson({ ...validLesson, title: { en: 'Only English' } });
    expect(ok.ok).toBe(true);
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

describe('FR2.4 — una lezione può non avere esercizi', () => {
  // Una lezione che riorienta il pensiero, senza risposta giusta: zero esercizi,
  // ma dichiara comunque il punto grammaticale che insegna (AC1 + AC2). Contenuto
  // giapponese realistico: «il giapponese non ha un tempo futuro» — la non-forma
  // futura è un riorientamento concettuale, non un esercizio con una risposta.
  const conceptualLesson = {
    order: 5,
    title: { en: '日本語に未来形はない' },
    grammarPoints: ['非過去形は現在と未来をともに表す'],
    exercises: [],
  };

  it('accetta la lezione concettuale con exercises: [] e la tipizza come Lesson (AC1)', () => {
    const result = parseLesson(conceptualLesson);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // L'assegnazione prova a compile-time la CONFORMITÀ del valore prodotto a
      // `Lesson` nel caso zero-esercizi. NON coglie però una regressione di
      // `exercises` a `optional` (se `Lesson.exercises` diventasse opzionale,
      // questa riga compilerebbe comunque): la garanzia RUNTIME che `exercises`
      // è chiave OBBLIGATORIA — mai optional/undefined — è ancorata dal test più
      // sotto «rifiuta la lezione con la chiave exercises ASSENTE».
      const lesson: Lesson = result.value;
      expect(lesson.exercises).toEqual([]);
    }
  });

  it('preserva i grammarPoints dichiarati proprio senza esercizi (AC2, dip. Epic 5)', () => {
    const result = parseLesson(conceptualLesson);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.grammarPoints.length).toBeGreaterThan(0);
      expect(result.value.grammarPoints).toEqual(conceptualLesson.grammarPoints);
    }
  });

  it('rifiuta la lezione senza esercizi con grammarPoints VUOTO, sul path grammarPoints (AC2)', () => {
    const bad = parseLesson({ ...conceptualLesson, grammarPoints: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      // Solo grammarPoints è malformato (order/title/exercises validi): l'UNICO
      // issue atteso è quello — asserzione forte sul SET esatto dei path.
      expect(bad.issues.map((i) => i.path.join('.'))).toEqual(['grammarPoints']);
    }
  });

  it('rifiuta la lezione senza esercizi con grammarPoints ASSENTE, sul path grammarPoints (AC2)', () => {
    const bad = parseLesson({ order: 5, title: { en: '日本語に未来形はない' }, exercises: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.map((i) => i.path.join('.'))).toEqual(['grammarPoints']);
    }
  });

  it('rifiuta la lezione con la chiave exercises ASSENTE, sul path exercises (AC1 — chiave OBBLIGATORIA)', () => {
    // Simmetrico al caso «grammarPoints ASSENTE»: omettere del tutto `exercises`
    // è RIFIUTATO, perché la chiave è obbligatoria (mai `optional`). È la prova
    // RUNTIME che àncora la decisione «exercises: array(...) obbligatorio, vuoto
    // ammesso» di FR2.4 contro una regressione a `optional`.
    const bad = parseLesson({
      order: 5,
      title: { en: '日本語に未来形はない' },
      grammarPoints: ['非過去形は現在と未来をともに表す'],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.map((i) => i.path.join('.'))).toEqual(['exercises']);
    }
  });
});

describe('deriveLessonId / lessonId (AC5, FR2.1a)', () => {
  it('id IDENTICO per stesso grammarPoints[0] con order/title diversi', () => {
    const a: Lesson = { order: 1, title: { en: 'Alpha' }, grammarPoints: ['〜てform'], exercises: [] };
    const b: Lesson = { order: 9, title: { en: 'Beta' }, grammarPoints: ['〜てform'], exercises: [] };
    expect(lessonId(a)).toBe(lessonId(b));
  });

  it('id DIVERSO quando il punto grammaticale cambia', () => {
    const a: Lesson = { order: 1, title: { en: 'X' }, grammarPoints: ['〜てform'], exercises: [] };
    const b: Lesson = { order: 1, title: { en: 'X' }, grammarPoints: ['〜たform'], exercises: [] };
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
