import { describe, expect, it } from 'vitest';
import {
  check,
  exerciseSchema,
  explanation,
  japaneseSentence,
  type Exercise,
  type ExerciseResponse,
} from './exercise';

// Test dei value object, della union discriminata dell'esercizio e di `check`
// per i tre tipi (AC1–AC7). Ogni riga della I/O Matrix è coperta qui.

describe('japaneseSentence', () => {
  it('accetta kanji e kana entrambi non vuoti', () => {
    const result = japaneseSentence.parse({ kanji: '本を読む', kana: 'ほんをよむ' });
    expect(result.ok).toBe(true);
  });

  it('rifiuta kana assente col path sentence.kana', () => {
    const bad = japaneseSentence.parse({ kanji: '本' }, ['sentence']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['sentence', 'kana']);
    }
  });

  it('rifiuta kana vuoto col path sentence.kana', () => {
    const bad = japaneseSentence.parse({ kanji: '本', kana: '' }, ['sentence']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['sentence', 'kana']);
    }
  });

  it('rifiuta kanji assente', () => {
    expect(japaneseSentence.parse({ kana: 'ほん' }).ok).toBe(false);
  });
});

describe('explanation (AC3)', () => {
  it('en obbligatorio, it opzionale: solo en è valido', () => {
    const result = explanation.parse({ en: 'Because …' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('it' in result.value).toBe(false);
    }
  });

  it('accetta en + it', () => {
    const result = explanation.parse({ en: 'Because …', it: 'Perché …' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.it).toBe('Perché …');
    }
  });

  it('rifiuta en assente col path explanation.en', () => {
    const bad = explanation.parse({ it: 'Perché …' }, ['explanation']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['explanation', 'en']);
    }
  });

  it('rifiuta en vuoto', () => {
    expect(explanation.parse({ en: '' }).ok).toBe(false);
  });

  it('rifiuta it presente ma vuoto', () => {
    expect(explanation.parse({ en: 'x', it: '' }).ok).toBe(false);
  });
});

// Fixture valide per ciascuna variante del registro (AC1). Campi comuni a tutti
// e tre: kind, grammarPoint, sentence, explanation. Specializzati: answer e (per
// single-select) distractors.
const validSingleSelect = {
  kind: 'single-select',
  grammarPoint: '〜を読む',
  sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
  answer: '読む',
  distractors: ['見る', '書く'],
  explanation: { en: 'The verb takes …' },
};

const validSelectSpan = {
  kind: 'select-span',
  grammarPoint: '〜てform',
  sentence: { kanji: '本を読んで', kana: 'ほんをよんで' },
  answer: { start: 5, end: 6 },
  explanation: { en: 'The te-form spans …' },
};

const validAssemble = {
  kind: 'assemble',
  grammarPoint: 'word order',
  sentence: { kanji: '私は本を読む', kana: 'わたしはほんをよむ' },
  answer: ['A', 'B', 'C'],
  explanation: { en: 'Order the tiles …' },
};

describe('exerciseSchema — registro chiuso (AC1, AD-22)', () => {
  it('accetta un single-select valido e lo tipizza come variante', () => {
    const result = exerciseSchema.parse(validSingleSelect);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === 'single-select') {
      // Narrowing sul discriminante: `distractors` esiste sulla variante.
      expect(result.value.distractors).toEqual(['見る', '書く']);
      expect(result.value.answer).toBe('読む');
    }
  });

  it('accetta un select-span valido', () => {
    const result = exerciseSchema.parse(validSelectSpan);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === 'select-span') {
      expect(result.value.answer).toEqual({ start: 5, end: 6 });
    }
  });

  it('accetta un assemble valido', () => {
    const result = exerciseSchema.parse(validAssemble);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === 'assemble') {
      expect(result.value.answer).toEqual(['A', 'B', 'C']);
    }
  });

  it('rifiuta single-select senza distractors col path …distractors', () => {
    const { distractors, ...withoutDistractors } = validSingleSelect;
    void distractors;
    const bad = exerciseSchema.parse(withoutDistractors);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'distractors')).toBe(true);
    }
  });

  it('rifiuta single-select con distractors vuoti ([]) col path …distractors', () => {
    const bad = exerciseSchema.parse({ ...validSingleSelect, distractors: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'distractors')).toBe(true);
    }
  });

  it('rifiuta un kind fuori registro col path kind (errore di schema, non ignorato)', () => {
    const bad = exerciseSchema.parse({ ...validSingleSelect, kind: 'drag-drop' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'kind')).toBe(true);
    }
  });

  it('rifiuta un kind non stringa (42) col path kind', () => {
    const bad = exerciseSchema.parse({ ...validSingleSelect, kind: 42 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'kind')).toBe(true);
    }
  });

  it('rifiuta select-span con span degenere (start === end) col path …answer', () => {
    const bad = exerciseSchema.parse({ ...validSelectSpan, answer: { start: 2, end: 2 } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'answer')).toBe(true);
    }
  });

  it('rifiuta select-span con span rovesciato (end < start) col path …answer', () => {
    const bad = exerciseSchema.parse({ ...validSelectSpan, answer: { start: 4, end: 2 } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'answer')).toBe(true);
    }
  });

  it('rifiuta select-span con indici negativi', () => {
    const bad = exerciseSchema.parse({ ...validSelectSpan, answer: { start: -1, end: 2 } });
    expect(bad.ok).toBe(false);
  });

  it('rifiuta grammarPoint assente col path grammarPoint (per ogni variante)', () => {
    for (const valid of [validSingleSelect, validSelectSpan, validAssemble]) {
      const { grammarPoint, ...withoutGrammarPoint } = valid;
      void grammarPoint;
      const bad = exerciseSchema.parse(withoutGrammarPoint);
      expect(bad.ok).toBe(false);
      if (!bad.ok) {
        expect(bad.issues.some((i) => i.path.join('.') === 'grammarPoint')).toBe(true);
      }
    }
  });

  it('propaga il path nella frase annidata (sentence.kana)', () => {
    const bad = exerciseSchema.parse({ ...validSingleSelect, sentence: { kanji: '本' } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['sentence', 'kana']);
    }
  });

  it('assemble rifiuta answer con una tessera vuota col suo indice nel path', () => {
    const bad = exerciseSchema.parse({ ...validAssemble, answer: ['A', ''] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['answer', 1]);
    }
  });
});

describe('check — single-select (AC3)', () => {
  const parsed = exerciseSchema.parse(validSingleSelect);
  if (!parsed.ok) throw new Error('fixture single-select non valida');
  const exercise = parsed.value;

  it('corretto se choice === answer', () => {
    expect(check(exercise, { kind: 'single-select', choice: '読む' })).toEqual({
      correct: true,
    });
  });

  it('sbagliato se choice è un distrattore', () => {
    expect(check(exercise, { kind: 'single-select', choice: '見る' })).toEqual({
      correct: false,
    });
  });
});

describe('check — select-span (AC4: confini dei segmenti, non caratteri)', () => {
  const parsed = exerciseSchema.parse(validSelectSpan);
  if (!parsed.ok) throw new Error('fixture select-span non valida');
  const exercise = parsed.value;

  it('corretto se lo span combacia sui confini dei segmenti', () => {
    expect(check(exercise, { kind: 'select-span', span: { start: 5, end: 6 } })).toEqual({
      correct: true,
    });
  });

  it('sbagliato se lo span differisce sui confini', () => {
    expect(check(exercise, { kind: 'select-span', span: { start: 4, end: 6 } })).toEqual({
      correct: false,
    });
    expect(check(exercise, { kind: 'select-span', span: { start: 5, end: 7 } })).toEqual({
      correct: false,
    });
  });
});

describe('check — assemble (AC5: dipende dall’ordine)', () => {
  const parsed = exerciseSchema.parse(validAssemble);
  if (!parsed.ok) throw new Error('fixture assemble non valida');
  const exercise = parsed.value;

  it('corretto se stesse tessere nello stesso ordine', () => {
    expect(check(exercise, { kind: 'assemble', order: ['A', 'B', 'C'] })).toEqual({
      correct: true,
    });
  });

  it('sbagliato se le stesse tessere sono in ordine diverso', () => {
    expect(check(exercise, { kind: 'assemble', order: ['B', 'A', 'C'] })).toEqual({
      correct: false,
    });
  });

  it('sbagliato se il numero di tessere differisce', () => {
    expect(check(exercise, { kind: 'assemble', order: ['A', 'B'] })).toEqual({
      correct: false,
    });
  });

  it('sbagliato se order è più lungo della answer (prefisso corretto)', () => {
    // Il controllo di lunghezza è l'unica guardia contro tessere in eccesso:
    // answer.every() itera solo sugli indici di answer e non vedrebbe la 'D'.
    expect(check(exercise, { kind: 'assemble', order: ['A', 'B', 'C', 'D'] })).toEqual({
      correct: false,
    });
  });
});

describe('check — totale su kind sbagliato (AD-22, non lancia)', () => {
  it('esercizio single-select con risposta select-span ⇒ { correct: false }', () => {
    const exercise = exerciseSchema.parse(validSingleSelect);
    if (exercise.ok) {
      const response: ExerciseResponse = { kind: 'select-span', span: { start: 0, end: 1 } };
      expect(() => check(exercise.value, response)).not.toThrow();
      expect(check(exercise.value, response)).toEqual({ correct: false });
    }
  });

  it('esercizio assemble con risposta single-select ⇒ { correct: false }', () => {
    const exercise = exerciseSchema.parse(validAssemble);
    if (exercise.ok) {
      const response: ExerciseResponse = { kind: 'single-select', choice: 'A' };
      expect(check(exercise.value, response)).toEqual({ correct: false });
    }
  });
});

describe('grammarPoint sull’esercizio, non nel kind (AC7)', () => {
  it('varianti diverse possono condividere lo stesso grammarPoint', () => {
    // Il kind dice COME si risponde; il grammarPoint COSA si esercita. Sono
    // ortogonali: due esercizi di kind diverso possono esercitare lo stesso punto.
    const a = exerciseSchema.parse({ ...validSingleSelect, grammarPoint: '〜てform' });
    const b = exerciseSchema.parse({ ...validSelectSpan, grammarPoint: '〜てform' });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.grammarPoint).toBe(b.value.grammarPoint);
      expect(a.value.kind).not.toBe(b.value.kind);
    }
  });

  it('il narrowing su kind funziona nei consumatori (Exercise è una union)', () => {
    const exercise: Exercise = {
      kind: 'single-select',
      grammarPoint: '〜を読む',
      sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
      answer: '読む',
      distractors: ['見る'],
      explanation: { en: 'x' },
    };
    if (exercise.kind === 'single-select') {
      // TypeScript restringe: `distractors` è accessibile senza cast.
      expect(exercise.distractors).toEqual(['見る']);
    }
  });
});
