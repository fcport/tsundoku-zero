import { describe, expect, it } from 'vitest';
import { answerOptions } from './exercise-presentation';
import { alignFurigana } from './furigana';
import type { Exercise } from './exercise';

// L'ordine delle opzioni è DOMINIO (AC2): conteggio dal tipo, determinismo a
// chiamate ripetute, permutazione dipendente dall'identità. I fixture sono
// `Exercise` validi (union chiusa 2.2). Il caso select-span usa 難しい (むずかしい),
// che `alignFurigana` spezza in 2 segmenti (難 + しい), così il conteggio > 1 prova
// che le opzioni sono i segmenti in ordine naturale.

const singleSelect: Exercise = {
  kind: 'single-select',
  grammarPoint: 'wa-particle',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['を', 'が', 'に'],
  explanation: { en: 'The topic particle.' },
};

const assemble: Exercise = {
  kind: 'assemble',
  grammarPoint: 'word-order',
  sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
  answer: ['本', 'を', '読む'],
  explanation: { en: 'Subject object verb.' },
};

const selectSpan: Exercise = {
  kind: 'select-span',
  grammarPoint: 'i-adjective',
  sentence: { kanji: '難しい', kana: 'むずかしい' },
  answer: { start: 0, end: 1 },
  explanation: { en: 'An i-adjective.' },
};

describe('answerOptions — conteggio DERIVATO dal tipo (AC2)', () => {
  it('single-select: 1 + |distractors| opzioni (non fisso)', () => {
    expect(answerOptions(singleSelect)).toHaveLength(
      1 + singleSelect.distractors.length,
    );
    // Include la risposta E tutti i distrattori.
    expect([...answerOptions(singleSelect)].sort()).toEqual(
      ['は', 'を', 'が', 'に'].sort(),
    );
  });

  it('assemble: |answer| opzioni (le tessere)', () => {
    expect(answerOptions(assemble)).toHaveLength(assemble.answer.length);
    // Include tutte le tessere.
    expect([...answerOptions(assemble)].sort()).toEqual([...assemble.answer].sort());
  });

  it('select-span: |segmenti| opzioni (i text di alignFurigana)', () => {
    const segments = alignFurigana(
      selectSpan.sentence.kanji,
      selectSpan.sentence.kana,
    );
    expect(segments.length).toBeGreaterThan(1); // 難 + しい
    expect(answerOptions(selectSpan)).toHaveLength(segments.length);
    // In ordine NATURALE: i text dei segmenti così come emessi.
    expect(answerOptions(selectSpan)).toEqual(segments.map((s) => s.text));
  });
});

describe('answerOptions — determinismo (AC2)', () => {
  it('stessa sequenza a chiamate ripetute per ogni kind', () => {
    for (const ex of [singleSelect, assemble, selectSpan]) {
      expect(answerOptions(ex)).toEqual(answerOptions(ex));
    }
  });
});

describe('answerOptions — permutazione seminata dall identità (AC2)', () => {
  it('single-select: NON necessariamente in ordine di input (permutato per hash)', () => {
    // La permutazione dipende da deriveExerciseId: raramente coincide con
    // l input, ma qui prova che le posizioni sono deterministiche.
    const options = answerOptions(singleSelect);
    // La risposta esiste ed è a una posizione DETERMINISTICA (ripetibile).
    expect(options.indexOf('は')).toBe(answerOptions(singleSelect).indexOf('は'));
  });

  it('assemble: NON in ordine di risposta (la sequenza corretta non è regalata di norma)', () => {
    // Fixture scelta perché la permutazione seminata differisce dall ordine
    // risposta: prova che assemble non rende `answer` verbatim.
    expect(answerOptions(assemble)).not.toEqual(assemble.answer);
  });

  it('esercizi diversi ⇒ in genere ordine diverso (identità diversa)', () => {
    // Due single-select con le STESSE opzioni ma frasi diverse: identità diversa
    // ⇒ hash diverso ⇒ (in genere) ordine diverso.
    const other: Exercise = {
      ...singleSelect,
      sentence: { kanji: '君は先生です', kana: 'きみはせんせいです' },
    };
    const a = answerOptions(singleSelect);
    const b = answerOptions(other);
    // Stesso insieme di opzioni.
    expect([...a].sort()).toEqual([...b].sort());
    // Ma ordine (quasi certamente) diverso per queste due identità.
    expect(a).not.toEqual(b);
  });
});
