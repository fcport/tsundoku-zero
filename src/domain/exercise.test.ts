import { describe, expect, it } from 'vitest';
import { exerciseSchema, explanation, japaneseSentence } from './exercise';

// Test dei value object e della forma base dell'esercizio (AC3, AC4). Le righe
// della I/O Matrix su frase ed esplicazione sono verificate qui.

describe('japaneseSentence (AC4)', () => {
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

describe('exerciseSchema (forma base, AC3)', () => {
  const valid = {
    kind: 'single-select',
    sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
    answer: '読む',
    explanation: { en: 'The verb takes …' },
  };

  it('accetta un esercizio base valido senza distractors', () => {
    expect(exerciseSchema.parse(valid).ok).toBe(true);
  });

  it('accetta distractors opzionali quando presenti', () => {
    const result = exerciseSchema.parse({ ...valid, distractors: ['見る', '書く'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.distractors).toEqual(['見る', '書く']);
    }
  });

  it('rifiuta kind vuoto col path kind', () => {
    const bad = exerciseSchema.parse({ ...valid, kind: '' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'kind')).toBe(true);
    }
  });

  it('rifiuta answer assente col path answer', () => {
    const withoutAnswer = {
      kind: valid.kind,
      sentence: valid.sentence,
      explanation: valid.explanation,
    };
    const bad = exerciseSchema.parse(withoutAnswer);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.path.join('.') === 'answer')).toBe(true);
    }
  });

  it('propaga il path nella frase annidata (sentence.kana)', () => {
    const bad = exerciseSchema.parse({ ...valid, sentence: { kanji: '本' } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['sentence', 'kana']);
    }
  });

  it('rifiuta un distractor vuoto col suo indice nel path', () => {
    const bad = exerciseSchema.parse({ ...valid, distractors: ['ok', ''] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['distractors', 1]);
    }
  });
});
