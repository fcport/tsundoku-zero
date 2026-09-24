import { describe, expect, it } from 'vitest';
import { alignFurigana, isKana, type FuriganaSegment } from './furigana';

// I/O Matrix di `furigana.ts` (Story 3.6, AD-21/UX-DR23): la furigana SI ALLINEA
// nel dominio. `alignFurigana(kanji, kana)` è pura, sincrona, totale, non muta
// l'input e produce segmenti con RUBY DI GRUPPO sul nucleo. Notazione della Matrix:
// `testo|ruby`, `∅` = `ruby: null`. Ogni riga qui corrisponde a una riga della
// I/O & Edge-Case Matrix dello spec.

/** Rende i segmenti nella notazione della Matrix, per asserzioni leggibili. */
function render(segs: readonly FuriganaSegment[]): string {
  return segs.map((s) => (s.ruby === null ? s.text : `${s.text}|${s.ruby}`)).join(', ');
}

describe('alignFurigana: I/O Matrix — allineamento lessicale con ruby di gruppo (AC)', () => {
  it('okurigana (suffisso kana): 難しい/むずかしい ⇒ [難|むずか, しい|∅]', () => {
    expect(alignFurigana('難しい', 'むずかしい')).toEqual([
      { text: '難', ruby: 'むずか' },
      { text: 'しい', ruby: null },
    ]);
  });

  it('verbo con okurigana: 食べる/たべる ⇒ [食|た, べる|∅]', () => {
    expect(alignFurigana('食べる', 'たべる')).toEqual([
      { text: '食', ruby: 'た' },
      { text: 'べる', ruby: null },
    ]);
  });

  it('prefisso kana: お茶/おちゃ ⇒ [お|∅, 茶|ちゃ]', () => {
    expect(alignFurigana('お茶', 'おちゃ')).toEqual([
      { text: 'お', ruby: null },
      { text: '茶', ruby: 'ちゃ' },
    ]);
  });

  it('kanji singolo: 駅/えき ⇒ [駅|えき]', () => {
    expect(alignFurigana('駅', 'えき')).toEqual([{ text: '駅', ruby: 'えき' }]);
  });

  it('jukujikun (ruby di gruppo, non separabile per carattere): 今日, 大人, 一人', () => {
    // Per jukujikun non esiste una mappa carattere→kana: un SOLO segmento con la
    // lettura sull'intero nucleo.
    expect(alignFurigana('今日', 'きょう')).toEqual([{ text: '今日', ruby: 'きょう' }]);
    expect(alignFurigana('大人', 'おとな')).toEqual([{ text: '大人', ruby: 'おとな' }]);
    expect(alignFurigana('一人', 'ひとり')).toEqual([{ text: '一人', ruby: 'ひとり' }]);
  });

  it('nucleo multi-kanji: 日本語/にほんご, 勉強/べんきょう ⇒ nucleo intero', () => {
    expect(alignFurigana('日本語', 'にほんご')).toEqual([{ text: '日本語', ruby: 'にほんご' }]);
    expect(alignFurigana('勉強', 'べんきょう')).toEqual([{ text: '勉強', ruby: 'べんきょう' }]);
  });

  it('senza kanji (vuoto): ("","そして") ⇒ [そして|∅] (un solo segmento)', () => {
    expect(alignFurigana('', 'そして')).toEqual([{ text: 'そして', ruby: null }]);
  });

  it('kanji uguale a kana: ラーメン/ラーメン ⇒ [ラーメン|∅] (un solo segmento)', () => {
    expect(alignFurigana('ラーメン', 'ラーメン')).toEqual([{ text: 'ラーメン', ruby: null }]);
  });

  it('limite noto: sokuon interno 引っ越し/ひっこし ⇒ [引っ越|ひっこ, し|∅] (っ nel nucleo)', () => {
    // Lo っ interno non è un kana di BORDO comune: finisce nel nucleo. È il limite
    // dichiarato in AD-21, comportamento ATTESO e non un difetto.
    expect(alignFurigana('引っ越し', 'ひっこし')).toEqual([
      { text: '引っ越', ruby: 'ひっこ' },
      { text: 'し', ruby: null },
    ]);
  });
});

describe('alignFurigana: totalità e ricostruzione (Boundaries & Constraints)', () => {
  const cases: ReadonlyArray<readonly [kanji: string, kana: string]> = [
    ['難しい', 'むずかしい'],
    ['食べる', 'たべる'],
    ['お茶', 'おちゃ'],
    ['駅', 'えき'],
    ['今日', 'きょう'],
    ['大人', 'おとな'],
    ['一人', 'ひとり'],
    ['日本語', 'にほんご'],
    ['勉強', 'べんきょう'],
    ['', 'そして'],
    ['ラーメン', 'ラーメン'],
    ['引っ越し', 'ひっこし'],
  ];

  it('ogni segmento porta SEMPRE entrambe le chiavi (text e ruby)', () => {
    for (const [kanji, kana] of cases) {
      for (const seg of alignFurigana(kanji, kana)) {
        expect(seg).toHaveProperty('text');
        expect(seg).toHaveProperty('ruby');
        expect(typeof seg.text).toBe('string');
        expect(seg.ruby === null || typeof seg.ruby === 'string').toBe(true);
      }
    }
  });

  it('la concatenazione dei text ricostruisce kanji (o kana nel caso senza kanji)', () => {
    for (const [kanji, kana] of cases) {
      const joined = alignFurigana(kanji, kana)
        .map((s) => s.text)
        .join('');
      const expected = !kanji ? kana : kanji === kana ? kana : kanji;
      expect(joined).toBe(expected);
    }
  });

  it('la ricostruzione dal lato ruby (ruby ?? text) riottiene kana senza perdite', () => {
    // Il lato TEXT ricostruisce kanji; questo controlla il lato LETTURA. Per i
    // segmenti prefisso/suffisso `ruby` è null ma il loro `text` È già kana comune;
    // per il nucleo `ruby` è la lettura; per il segmento unico `text === kana`. La
    // concatenazione di `ruby ?? text` deve quindi ricostruire ESATTAMENTE `kana`:
    // un bug nei limiti di `kana.slice(...)` (reading) — che passa il controllo sul
    // solo lato text — qui fallirebbe.
    for (const [kanji, kana] of cases) {
      const readingJoined = alignFurigana(kanji, kana)
        .map((s) => s.ruby ?? s.text)
        .join('');
      expect(readingJoined).toBe(kana);
    }
  });

  it('nessun segmento vuoto è emesso (nessun text === "")', () => {
    for (const [kanji, kana] of cases) {
      for (const seg of alignFurigana(kanji, kana)) {
        expect(seg.text.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('alignFurigana: anti-vacuità, non-mutazione, determinismo (Boundaries & Constraints)', () => {
  // Anti-vacuità: la suite è verde SIA su casi con ruby presente SIA su casi senza
  // alcun ruby, così una funzione costante (che ignora l'allineamento) fallirebbe.
  it('anti-vacuità: verde con ruby presente E senza alcun ruby', () => {
    // Con ruby: almeno un segmento porta un ruby non-null.
    const conRuby = alignFurigana('お茶', 'おちゃ');
    expect(conRuby.some((s) => s.ruby !== null)).toBe(true);
    expect(render(conRuby)).toBe('お, 茶|ちゃ');

    // Senza alcun ruby: tutti i segmenti hanno ruby null.
    const senzaRuby = alignFurigana('ラーメン', 'ラーメン');
    expect(senzaRuby.every((s) => s.ruby === null)).toBe(true);
    expect(render(senzaRuby)).toBe('ラーメン');
  });

  it('non muta gli argomenti: kanji e kana restano invariati', () => {
    const kanji = '難しい';
    const kana = 'むずかしい';
    alignFurigana(kanji, kana);
    expect(kanji).toBe('難しい');
    expect(kana).toBe('むずかしい');
  });

  it('è deterministica: stessa coppia due volte ⇒ array uguali per valore', () => {
    expect(alignFurigana('日本語', 'にほんご')).toEqual(alignFurigana('日本語', 'にほんご'));
    expect(alignFurigana('', 'そして')).toEqual(alignFurigana('', 'そして'));
  });
});

describe('isKana: range Hiragana/Katakana (helper)', () => {
  it('riconosce Hiragana e Katakana (compreso ー)', () => {
    expect(isKana('あ')).toBe(true); // Hiragana
    expect(isKana('ん')).toBe(true); // Hiragana
    expect(isKana('ア')).toBe(true); // Katakana
    expect(isKana('ー')).toBe(true); // prolungamento (U+30FC, nel range Katakana)
  });

  it('non riconosce kanji né caratteri non-kana', () => {
    expect(isKana('駅')).toBe(false); // kanji
    expect(isKana('A')).toBe(false); // latino
    expect(isKana(' ')).toBe(false); // spazio
    expect(isKana('')).toBe(false); // stringa vuota
  });
});
