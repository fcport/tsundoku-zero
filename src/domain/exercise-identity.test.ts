import { describe, expect, it } from 'vitest';
import type { Exercise } from './exercise';
import { EXERCISE_NAMESPACE, deriveExerciseId, exerciseNaturalKey } from './exercise-identity';
import { URL_NAMESPACE, uuidv5 } from './uuid';

// Copre la I/O Matrix da «id = uuidv5(chiave, NS)» in giù, per i tre tipi:
// il pin di EXERCISE_NAMESPACE e di id concreti (prova che l'implementazione è
// stabile e corretta, non solo auto-coerente), l'INVARIANZA su
// spiegazione/distrattori/grammarPoint (AC2, AD-23), la DIFFERENZA su
// frase/risposta/tipo per ciascun tipo (AC3), l'equivalenza NFKC, e la
// RIAUTORAZIONE di un'intera lezione (AC4).

// --- Fixture tipate dei tre tipi ---------------------------------------------

const singleSelect: Exercise = {
  kind: 'single-select',
  grammarPoint: 'は vs が',
  sentence: { kanji: '猫が好きです', kana: 'ねこがすきです' },
  answer: 'が',
  distractors: ['は', 'を', 'に'],
  explanation: { en: 'Subject marker.', it: 'Marcatore del soggetto.' },
};

const selectSpan: Exercise = {
  kind: 'select-span',
  grammarPoint: 'relative clause',
  sentence: { kanji: '私が読んだ本', kana: 'わたしがよんだほん' },
  answer: { start: 0, end: 2 },
  explanation: { en: 'The relative clause modifies the noun.' },
};

const assemble: Exercise = {
  kind: 'assemble',
  grammarPoint: 'word order',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: ['私', 'は', '学生', 'です'],
  explanation: { en: 'Basic SOV order.' },
};

describe('identità dell’esercizio (AC1, AD-23)', () => {
  it('EXERCISE_NAMESPACE è derivato da URL_NAMESPACE e PINNATO', () => {
    // Non un valore magico casuale: ricalcolabile da chiunque. Il pin protegge
    // dall'auto-consistenza — l'implementazione uuidv5 non può regredire senza
    // spostare questo valore, che riscriverebbe l'identità di OGNI esercizio.
    expect(EXERCISE_NAMESPACE).toBe(uuidv5('tsundoku-zero/exercise', URL_NAMESPACE));
    expect(EXERCISE_NAMESPACE).toBe('19500004-85db-54f1-8bf3-7eb20002077b');
  });

  it('id = uuidv5(chiave naturale, EXERCISE_NAMESPACE) — pinnato per i tre tipi', () => {
    // Uguaglianza strutturale con la definizione, PIÙ un valore pinnato.
    expect(deriveExerciseId(singleSelect)).toBe(
      uuidv5(exerciseNaturalKey(singleSelect), EXERCISE_NAMESPACE),
    );
    expect(deriveExerciseId(singleSelect)).toBe('9f749b0f-8661-5ee4-8cde-c1c5fe9f3eaa');
    expect(deriveExerciseId(selectSpan)).toBe('c07eb513-fe80-5a8f-b1c5-ffa55c66c771');
    expect(deriveExerciseId(assemble)).toBe('c4adcc2c-c30d-5807-b42e-2ba8c706ad4d');
  });

  it('la chiave naturale è normalizzata NFKC', () => {
    // La chiave passa da .normalize('NFKC') ⇒ è essa stessa in forma NFKC.
    expect(exerciseNaturalKey(singleSelect)).toBe(
      exerciseNaturalKey(singleSelect).normalize('NFKC'),
    );
  });
});

describe('invarianza dell’identità: la SOSTANZA non cambia (AC2, AD-23)', () => {
  it('spiegazione corretta (en/it diversa) ⇒ id IDENTICO', () => {
    const withDifferentExplanation: Exercise = {
      ...singleSelect,
      explanation: { en: 'A totally rewritten explanation.', it: 'Spiegazione riscritta.' },
    };
    expect(deriveExerciseId(withDifferentExplanation)).toBe(deriveExerciseId(singleSelect));
  });

  it('distrattori riordinati (single-select) ⇒ id IDENTICO', () => {
    const reordered: Exercise = {
      ...singleSelect,
      distractors: ['に', 'を', 'は'],
    };
    expect(deriveExerciseId(reordered)).toBe(deriveExerciseId(singleSelect));
  });

  it('distrattori diversi (single-select) ⇒ id IDENTICO', () => {
    const otherDistractors: Exercise = {
      ...singleSelect,
      distractors: ['で', 'へ'],
    };
    expect(deriveExerciseId(otherDistractors)).toBe(deriveExerciseId(singleSelect));
  });

  it('grammarPoint diverso, stessa frase/risposta ⇒ id IDENTICO (fuori da AD-23)', () => {
    const otherGrammarPoint: Exercise = {
      ...singleSelect,
      grammarPoint: 'un punto grammaticale completamente diverso',
    };
    expect(deriveExerciseId(otherGrammarPoint)).toBe(deriveExerciseId(singleSelect));
  });
});

describe('mutamento dell’identità: la SOSTANZA cambia (AC3)', () => {
  it('frase modificata (kanji diverso) ⇒ id DIVERSO — per ciascun tipo', () => {
    const ss: Exercise = { ...singleSelect, sentence: { ...singleSelect.sentence, kanji: '犬が好きです' } };
    const sp: Exercise = { ...selectSpan, sentence: { ...selectSpan.sentence, kanji: '君が読んだ本' } };
    const as: Exercise = { ...assemble, sentence: { ...assemble.sentence, kanji: '僕は学生です' } };
    expect(deriveExerciseId(ss)).not.toBe(deriveExerciseId(singleSelect));
    expect(deriveExerciseId(sp)).not.toBe(deriveExerciseId(selectSpan));
    expect(deriveExerciseId(as)).not.toBe(deriveExerciseId(assemble));
  });

  it('frase modificata (kana diverso) ⇒ id DIVERSO — per ciascun tipo', () => {
    const ss: Exercise = { ...singleSelect, sentence: { ...singleSelect.sentence, kana: 'いぬがすきです' } };
    const sp: Exercise = { ...selectSpan, sentence: { ...selectSpan.sentence, kana: 'きみがよんだほん' } };
    const as: Exercise = { ...assemble, sentence: { ...assemble.sentence, kana: 'ぼくはがくせいです' } };
    expect(deriveExerciseId(ss)).not.toBe(deriveExerciseId(singleSelect));
    expect(deriveExerciseId(sp)).not.toBe(deriveExerciseId(selectSpan));
    expect(deriveExerciseId(as)).not.toBe(deriveExerciseId(assemble));
  });

  it('risposta corretta modificata ⇒ id DIVERSO — per ciascun tipo', () => {
    // single-select: choice diverso.
    const ss: Exercise = { ...singleSelect, answer: 'は' };
    // select-span: span diverso (start/end diversi).
    const sp: Exercise = { ...selectSpan, answer: { start: 1, end: 3 } };
    // assemble: ordine diverso (stesse tessere, sequenza diversa).
    const as: Exercise = { ...assemble, answer: ['学生', '私', 'は', 'です'] };
    expect(deriveExerciseId(ss)).not.toBe(deriveExerciseId(singleSelect));
    expect(deriveExerciseId(sp)).not.toBe(deriveExerciseId(selectSpan));
    expect(deriveExerciseId(as)).not.toBe(deriveExerciseId(assemble));
  });

  it('tipo diverso, stessa frase/risposta plausibile ⇒ id DIVERSO', () => {
    // Il kind è parte della chiave: due esercizi con la stessa frase ma tipo
    // diverso hanno identità distinte.
    const asSingle: Exercise = {
      kind: 'single-select',
      grammarPoint: 'x',
      sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
      answer: '私',
      distractors: ['は'],
      explanation: { en: 'x' },
    };
    const asAssemble: Exercise = {
      kind: 'assemble',
      grammarPoint: 'x',
      sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
      answer: ['私'],
      explanation: { en: 'x' },
    };
    expect(deriveExerciseId(asSingle)).not.toBe(deriveExerciseId(asAssemble));
  });
});

describe('equivalenza NFKC nella chiave (AC1)', () => {
  it('frasi NFKC-equivalenti (半角↔全角) ⇒ id IDENTICO', () => {
    const halfwidth: Exercise = {
      kind: 'single-select',
      grammarPoint: 'x',
      sentence: { kanji: 'ｱ', kana: 'ｱ' }, // katakana halfwidth
      answer: 'A', // latin
      distractors: ['B'],
      explanation: { en: 'x' },
    };
    const fullwidth: Exercise = {
      kind: 'single-select',
      grammarPoint: 'x',
      sentence: { kanji: 'ア', kana: 'ア' }, // katakana fullwidth
      answer: 'Ａ', // fullwidth latin
      distractors: ['B'],
      explanation: { en: 'x' },
    };
    // Le forme half/full collassano sotto NFKC ⇒ stessa chiave ⇒ stesso id.
    expect(deriveExerciseId(halfwidth)).toBe(deriveExerciseId(fullwidth));
  });
});

describe('riautorazione di una lezione (AC4)', () => {
  it('lezione riautorata senza modifiche sostanziali ⇒ TUTTI gli id coincidono', () => {
    // «Prima»: gli esercizi della lezione, con i loro id.
    const before = [singleSelect, selectSpan, assemble];
    const idsBefore = before.map(deriveExerciseId);

    // «Dopo»: la stessa lezione riautorata DA CAPO — nuovi oggetti, spiegazioni
    // ritoccate, distrattori riordinati, grammarPoint rivisti, ma frase/tipo/
    // risposta INVARIATI. L'ordine degli esercizi nell'array è pure cambiato.
    const reauthored: Exercise[] = [
      {
        kind: 'assemble',
        grammarPoint: 'ordine delle parole (riformulato)',
        sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
        answer: ['私', 'は', '学生', 'です'],
        explanation: { en: 'Rewritten SOV explanation.', it: 'Spiegazione SOV riscritta.' },
      },
      {
        kind: 'single-select',
        grammarPoint: 'particelle (riformulato)',
        sentence: { kanji: '猫が好きです', kana: 'ねこがすきです' },
        answer: 'が',
        distractors: ['に', 'は', 'を'], // riordinati
        explanation: { en: 'Rewritten subject-marker note.' },
      },
      {
        kind: 'select-span',
        grammarPoint: 'clausole relative (riformulato)',
        sentence: { kanji: '私が読んだ本', kana: 'わたしがよんだほん' },
        answer: { start: 0, end: 2 },
        explanation: { en: 'Rewritten relative-clause note.', it: 'Nota riscritta.' },
      },
    ];
    const idsAfter = reauthored.map(deriveExerciseId);

    // Ogni esercizio riautorato ritrova ESATTAMENTE il proprio id precedente,
    // indipendentemente dalla posizione: nessun progresso utente andrebbe perso.
    expect(new Set(idsAfter)).toEqual(new Set(idsBefore));
    expect(deriveExerciseId(reauthored[0])).toBe(deriveExerciseId(assemble));
    expect(deriveExerciseId(reauthored[1])).toBe(deriveExerciseId(singleSelect));
    expect(deriveExerciseId(reauthored[2])).toBe(deriveExerciseId(selectSpan));
  });
});
