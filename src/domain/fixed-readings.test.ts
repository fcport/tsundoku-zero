import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GRAMMAR_POINT_MEANINGS, GRAMMAR_POINT_READINGS, grammarPointSegments } from './fixed-readings';
import { annotateKnownKanji, knownReadings, readingSegments } from './option-furigana';

const LESSONS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'lessons');

describe('GRAMMAR_POINT_READINGS — ogni punto del curriculum ha la sua lettura', () => {
  it('nessun punto grammaticale delle lezioni resta senza lettura', () => {
    const points = new Set<string>();
    for (const file of readdirSync(LESSONS).filter((f) => f.endsWith('.json'))) {
      const lesson = JSON.parse(readFileSync(resolve(LESSONS, file), 'utf8')) as { grammarPoints?: string[] };
      for (const p of lesson.grammarPoints ?? []) points.add(p);
    }
    const missing = [...points].filter((p) => !(p in GRAMMAR_POINT_READINGS));
    expect(missing, 'aggiungere la lettura in src/domain/fixed-readings.ts').toEqual([]);
  });

  it('ogni lettura si allinea al suo testo (nessun refuso fra kanji e kana)', () => {
    for (const [point, reading] of Object.entries(GRAMMAR_POINT_READINGS)) {
      const segments = typeof reading === 'string' ? readingSegments(point, reading) : reading;
      const kana =
        typeof reading === 'string' ? reading : reading.map((s) => s.ruby ?? s.text).join('');
      expect(segments.map((s) => s.text).join(''), point).toBe(point);
      // Ricomponendo (lettura dove c'è, testo altrove) si riottiene la lettura
      // intera: ogni corsa di kanji ha preso una lettura CERTA, e kana e
      // punteggiatura della lettura coincidono con quelle del testo.
      expect(segments.map((s) => s.ruby ?? s.text).join(''), point).toBe(kana);
    }
  });

  it('un punto noto ha la furigana sui kanji e non sui kana: 「が」が示す主語', () => {
    expect(grammarPointSegments('「が」が示す主語')).toEqual([
      { text: '「が」が', ruby: null },
      { text: '示', ruby: 'しめ' },
      { text: 'す', ruby: null },
      { text: '主語', ruby: 'しゅご' },
    ]);
  });

  it('un punto sconosciuto ⇒ null (testo semplice)', () => {
    expect(grammarPointSegments('未知の点')).toBeNull();
  });
});

describe('knownReadings / annotateKnownKanji — le parole delle spiegazioni', () => {
  it('le corse di kanji della frase danno la lettura alle stesse parole nel testo', () => {
    const known = knownReadings([{ kanji: '猫が魚を食べた', kana: 'ねこがさかなをたべた' }]);
    const segs = annotateKnownKanji('Here 猫 is the subject and 魚 the object.', known);
    expect(segs.filter((s) => s.ruby)).toEqual([
      { text: '猫', ruby: 'ねこ' },
      { text: '魚', ruby: 'さかな' },
    ]);
  });

  it('una corsa con due letture diverse nelle frasi è scartata', () => {
    const known = knownReadings([
      { kanji: '日が出る', kana: 'ひがでる' },
      { kanji: '日が長い', kana: 'にちがながい' },
    ]);
    expect(known.has('日')).toBe(false);
    expect(known.get('出')).toBe('で');
  });
});

describe('GRAMMAR_POINT_MEANINGS — ogni punto del curriculum ha il suo significato', () => {
  it('nessun punto grammaticale delle lezioni resta senza significato (en e it)', () => {
    for (const point of Object.keys(GRAMMAR_POINT_READINGS)) {
      const meaning = GRAMMAR_POINT_MEANINGS[point];
      expect(meaning?.en, point).toBeTruthy();
      expect(meaning?.it, point).toBeTruthy();
    }
  });
});
