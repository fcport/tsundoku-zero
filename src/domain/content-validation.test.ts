import { describe, expect, it } from 'vitest';
import { validateLessons, type LessonFile } from './content-validation';

// Test del CANCELLO di validazione del contenuto (FR2.6, AD-25). Le fixture sono
// INLINE: nessun file reale in content/lessons/ (è storia 2.7). Un `it` per riga
// della I/O matrix della spec, più una lezione valida coi tre tipi, l'elenco
// vuoto, e la prova AC4 (una lezione conforme aggiunta all'elenco resta senza
// issue — nessun codice cambia). Asserzioni con `path.join('.')` come in
// `lesson.test.ts`.

// Una lezione valida coi TRE tipi del registro chiuso (AC1). `kana` senza kanji.
const validLesson = {
  order: 1,
  title: { en: 'Il verbo 読む' },
  grammarPoints: ['〜を読む'],
  exercises: [
    {
      kind: 'single-select',
      grammarPoint: '〜を読む',
      sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
      answer: '読む',
      distractors: ['見る', '書く'],
      explanation: { en: 'The verb to read.' },
    },
    {
      kind: 'select-span',
      grammarPoint: '〜を読む',
      sentence: { kanji: '毎日新聞を読む', kana: 'まいにちしんぶんをよむ' },
      answer: { start: 0, end: 1 },
      explanation: { en: 'Select the object.' },
    },
    {
      kind: 'assemble',
      grammarPoint: '〜を読む',
      sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
      answer: ['本', 'を', '読む'],
      explanation: { en: 'Order the tiles.' },
    },
  ],
};

/** Serializza una fixture in un `LessonFile`. */
function file(path: string, value: unknown): LessonFile {
  return { path, source: JSON.stringify(value) };
}

describe('validateLessons — conformi (AC1)', () => {
  it('tutti conformi (i tre tipi) ⇒ []', () => {
    expect(validateLessons([file('01-yomu.json', validLesson)])).toEqual([]);
  });

  it('cartella vuota (elenco vuoto) ⇒ [] (0 lezioni conforme)', () => {
    expect(validateLessons([])).toEqual([]);
  });

  it('più lezioni distinte, tutte conformi ⇒ []', () => {
    const second = {
      ...validLesson,
      order: 2,
      title: { en: 'La forma て' },
      grammarPoints: ['〜てform'],
      exercises: [
        {
          kind: 'single-select',
          grammarPoint: '〜てform',
          sentence: { kanji: '食べて', kana: 'たべて' },
          answer: 'て',
          distractors: ['た', 'る'],
          explanation: { en: 'The te-form.' },
        },
      ],
    };
    expect(
      validateLessons([file('01-yomu.json', validLesson), file('02-te.json', second)]),
    ).toEqual([]);
  });
});

describe('validateLessons — malformati con issue localizzato', () => {
  it('JSON non valido ⇒ 1 issue path [], salta gli altri controlli del file', () => {
    const issues = validateLessons([{ path: 'broken.json', source: '{ not json' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe('broken.json');
    expect(issues[0].path).toEqual([]);
    expect(issues[0].message).toMatch(/JSON non valido/);
  });

  it('kind fuori registro ⇒ issue sul path exercises.<i>.kind (AC2, AD-22)', () => {
    const bad = {
      ...validLesson,
      exercises: [{ ...validLesson.exercises[0], kind: 'foo' }],
    };
    const issues = validateLessons([file('01.json', bad)]);
    expect(issues.some((i) => i.file === '01.json' && i.path.join('.') === 'exercises.0.kind')).toBe(
      true,
    );
  });

  it('spiegazione en assente ⇒ issue sul path …explanation.en', () => {
    const bad = {
      ...validLesson,
      exercises: [
        {
          kind: 'single-select',
          grammarPoint: '〜を読む',
          sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
          answer: '読む',
          distractors: ['見る'],
          explanation: {}, // en mancante
        },
      ],
    };
    const issues = validateLessons([file('01.json', bad)]);
    expect(
      issues.some((i) => i.path.join('.') === 'exercises.0.explanation.en'),
    ).toBe(true);
  });

  it('spiegazione en vuota ("") ⇒ issue sul path …explanation.en', () => {
    const bad = {
      ...validLesson,
      exercises: [{ ...validLesson.exercises[0], explanation: { en: '' } }],
    };
    const issues = validateLessons([file('01.json', bad)]);
    expect(
      issues.some((i) => i.path.join('.') === 'exercises.0.explanation.en'),
    ).toBe(true);
  });

  it('kana con kanji ⇒ issue di coerenza sul path …sentence.kana', () => {
    const bad = {
      ...validLesson,
      exercises: [
        {
          ...validLesson.exercises[0],
          // La lettura contiene un Han: non è una lettura valida.
          sentence: { kanji: '本を読む', kana: '本をよむ' },
        },
      ],
    };
    const issues = validateLessons([file('01.json', bad)]);
    const kanaIssues = issues.filter(
      (i) => i.path.join('.') === 'exercises.0.sentence.kana',
    );
    expect(kanaIssues).toHaveLength(1);
    expect(kanaIssues[0].message).toMatch(/kanji|Han/);
  });

  it('katakana, ー, ・, cifre e latino in kana NON sono Han ⇒ nessun issue', () => {
    const ok = {
      ...validLesson,
      exercises: [
        {
          ...validLesson.exercises[0],
          sentence: { kanji: 'コーヒー・3杯', kana: 'コーヒー・3ばい' },
        },
      ],
    };
    // kanji contiene Han (è normale), ma la lettura kana no.
    const issues = validateLessons([file('01.json', ok)]).filter(
      (i) => i.path.join('.') === 'exercises.0.sentence.kana',
    );
    expect(issues).toEqual([]);
  });

  it('lessonId duplicato ⇒ issue che NOMINA i due file', () => {
    // Stesso grammarPoints[0] ⇒ stesso lessonId, con order/title diversi.
    const a = { ...validLesson, order: 1, title: { en: 'A' } };
    const b = { ...validLesson, order: 2, title: { en: 'B' } };
    const issues = validateLessons([file('a.json', a), file('b.json', b)]);
    const dup = issues.filter((i) => i.message.includes('lessonId duplicato'));
    expect(dup).toHaveLength(1);
    expect(dup[0].message).toContain('a.json');
    expect(dup[0].message).toContain('b.json');
  });

  it('exerciseId duplicato ⇒ issue che nomina i due file/indici', () => {
    // Stessa chiave naturale (kind + frase + risposta) ⇒ stesso deriveExerciseId,
    // in due lezioni DISTINTE (lessonId diverso) così l'unico duplicato è l'id
    // dell'esercizio. La spiegazione differisce: è ESCLUSA dall'identità (AD-23).
    const shared = {
      kind: 'single-select',
      grammarPoint: '〜を読む',
      sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
      answer: '読む',
      distractors: ['見る'],
      explanation: { en: 'A.' },
    };
    // `grammarPoints[0]` differisce (lessonId diverso), ma entrambe DICHIARANO il
    // punto portato dall'esercizio condiviso: il controllo (e) non deve sporcare
    // un test che riguarda solo l'unicità degli id.
    const a = {
      order: 1,
      title: { en: 'A' },
      grammarPoints: ['punto-a', '〜を読む'],
      exercises: [shared],
    };
    const b = {
      order: 2,
      title: { en: 'B' },
      grammarPoints: ['punto-b', '〜を読む'],
      exercises: [{ ...shared, explanation: { en: 'B (refuso corretto).' } }],
    };
    const issues = validateLessons([file('a.json', a), file('b.json', b)]);
    const dup = issues.filter((i) => i.message.includes('exerciseId duplicato'));
    expect(dup).toHaveLength(1);
    expect(dup[0].message).toContain('a.json');
    expect(dup[0].message).toContain('b.json');
    // Nessun lessonId duplicato: i due punti grammaticali sono diversi.
    expect(issues.some((i) => i.message.includes('lessonId duplicato'))).toBe(false);
  });
});

describe('validateLessons — unicità di order (d)', () => {
  it('due lezioni con lo STESSO order ⇒ issue che NOMINA i due file', () => {
    // `lessonId` non copre questo caso: deriva da `grammarPoints[0]`, qui diverso,
    // quindi le due lezioni hanno id distinti e collidono SOLO sulla posizione.
    const a = { ...validLesson, order: 1, title: { en: 'A' }, grammarPoints: ['punto-a', '〜を読む'] };
    const b = { ...validLesson, order: 1, title: { en: 'B' }, grammarPoints: ['punto-b', '〜を読む'] };
    const issues = validateLessons([file('a.json', a), file('b.json', b)]);
    const dup = issues.filter((i) => i.message.includes('order duplicato'));
    expect(dup).toHaveLength(1);
    expect(dup[0].path.join('.')).toBe('order');
    expect(dup[0].message).toContain('a.json');
    expect(dup[0].message).toContain('b.json');
    // La collisione è SOLO di posizione: gli id restano distinti.
    expect(issues.some((i) => i.message.includes('lessonId duplicato'))).toBe(false);
  });

  it('due lezioni con order DIVERSI ⇒ nessun issue di order', () => {
    const a = { ...validLesson, order: 1, grammarPoints: ['punto-a', '〜を読む'] };
    const b = { ...validLesson, order: 2, grammarPoints: ['punto-b', '〜を読む'] };
    const issues = validateLessons([file('a.json', a), file('b.json', b)]);
    expect(issues.some((i) => i.message.includes('order duplicato'))).toBe(false);
  });
});

describe('validateLessons — coerenza del punto grammaticale (e)', () => {
  it('esercizio con un punto NON dichiarato ⇒ issue sul path exercises.<i>.grammarPoint', () => {
    // FR7.3 aggrega le statistiche per punto grammaticale: un esercizio che porta
    // un punto fuori dai `grammarPoints` della lezione sposta quella statistica
    // fuori dal curriculum.
    const bad = {
      ...validLesson,
      grammarPoints: ['〜を読む'],
      exercises: [
        { ...validLesson.exercises[0], grammarPoint: '可能形' },
        validLesson.exercises[1],
      ],
    };
    const issues = validateLessons([file('01.json', bad)]);
    const hit = issues.filter((i) => i.path.join('.') === 'exercises.0.grammarPoint');
    expect(hit).toHaveLength(1);
    expect(hit[0].message).toContain('可能形');
    // L'esercizio coerente non produce issue.
    expect(issues.some((i) => i.path.join('.') === 'exercises.1.grammarPoint')).toBe(false);
  });

  it('punto DICHIARATO e non ancora esercitato ⇒ nessun issue (contenimento a senso unico)', () => {
    const ok = { ...validLesson, grammarPoints: ['〜を読む', '可能形'] };
    expect(validateLessons([file('01.json', ok)])).toEqual([]);
  });

  it('lezione SENZA esercizi che dichiara punti ⇒ nessun issue (il caso di 2.4)', () => {
    const vuota = { ...validLesson, grammarPoints: ['〜を読む'], exercises: [] };
    expect(validateLessons([file('01.json', vuota)])).toEqual([]);
  });
});

describe('validateLessons — AC4: scoperta per glob, nessun codice cablato', () => {
  it('una lezione conforme AGGIUNTA all’elenco resta senza issue (nessun codice cambia)', () => {
    // Prova AC4: aggiungere una lezione conforme all'elenco (ciò che il glob dello
    // script produrrebbe) non richiede modifiche al codice — resta [].
    const nuova = {
      order: 3,
      title: { en: 'Il potenziale' },
      grammarPoints: ['可能形'],
      exercises: [
        {
          kind: 'assemble',
          grammarPoint: '可能形',
          sentence: { kanji: '食べられる', kana: 'たべられる' },
          answer: ['食べ', 'られる'],
          explanation: { en: 'The potential form.' },
        },
      ],
    };
    expect(
      validateLessons([file('01-yomu.json', validLesson), file('03-potential.json', nuova)]),
    ).toEqual([]);
  });
});
