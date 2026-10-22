import { describe, expect, it } from 'vitest';
import { kanaRow, kanaTiles, kanaToRomaji, lookalikes, scriptOf, toHiragana, toKatakana } from './kana';

describe('kana: le file della tabella', () => {
  it('in hiragana ci sono i 46 kana di base, 25 con i trattini e 4 piccoli', () => {
    const base = (['a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa'] as const).flatMap((r) => kanaRow('hiragana', r));
    expect(base).toHaveLength(46);
    expect(kanaRow('hiragana', 'dakuten')).toHaveLength(25);
    expect(kanaRow('hiragana', 'small')).toEqual(['ゃ', 'ゅ', 'ょ', 'っ']);
    expect(kanaRow('hiragana', 'long')).toEqual([]);
  });

  it('in katakana la fila わ non ha ヲ, e ci sono il trattino e le vocali piccole', () => {
    expect(kanaRow('katakana', 'wa')).toEqual(['ワ', 'ン']);
    expect(kanaRow('katakana', 'ka')).toEqual(['カ', 'キ', 'ク', 'ケ', 'コ']);
    expect(kanaRow('katakana', 'long')).toEqual(['ー']);
    expect(kanaRow('katakana', 'smallVowels')).toEqual(['ァ', 'ィ', 'ゥ', 'ェ', 'ォ']);
  });

  it('passa da hiragana a katakana e ritorno, lasciando stare il trattino', () => {
    expect(toKatakana('きゃっと')).toBe('キャット');
    expect(toHiragana('ケーキ')).toBe('けーき');
  });

  it('ogni kana è un mattoncino, anche i piccoli e il trattino', () => {
    expect(kanaTiles('しゃしん')).toEqual(['し', 'ゃ', 'し', 'ん']);
    expect(kanaTiles('ケーキ')).toEqual(['ケ', 'ー', 'キ']);
  });

  it('riconosce la scrittura di una parola', () => {
    expect(scriptOf('ねこ')).toBe('hiragana');
    expect(scriptOf('ケーキ')).toBe('katakana');
    expect(scriptOf('ー')).toBe('katakana');
  });
});

describe('kana: il romaji', () => {
  it.each([
    ['ありがとう', 'arigatou'],
    ['おおきい', 'ookii'],
    ['ちかてつ', 'chikatetsu'],
    ['しゃしん', 'shashin'],
    ['きょう', 'kyou'],
    ['じゅぎょう', 'jugyou'],
    ['がっこう', 'gakkou'],
    ['ちょっと', 'chotto'],
    ['まっちゃ', 'matcha'],
    ['ふつう', 'futsuu'],
    ['きんえん', "kin'en"],
    ['ほんや', "hon'ya"],
    ['えんぴつ', 'enpitsu'],
    ['ケーキ', 'kēki'],
    ['コーヒー', 'kōhī'],
    ['パーティー', 'pātī'],
    ['フォーク', 'fōku'],
    ['ティッシュ', 'tisshu'],
    ['チェック', 'chekku'],
    ['コンピューター', 'konpyūtā'],
    ['ウェブ', 'webu'],
    ['ソファー', 'sofā'],
  ])('%s → %s', (kana, romaji) => {
    expect(kanaToRomaji(kana)).toBe(romaji);
  });
});

describe('kana: quelli che si somigliano', () => {
  it('trova le forme simili, con e senza trattini, grandi e piccole', () => {
    expect(lookalikes('ぬ')).toContain('め');
    expect(lookalikes('か')).toContain('が');
    expect(lookalikes('は')).toEqual(expect.arrayContaining(['ば', 'ぱ', 'ほ']));
    expect(lookalikes('つ')).toContain('っ');
    expect(lookalikes('シ')).toContain('ツ');
    expect(lookalikes('ソ')).toContain('ン');
    expect(lookalikes('ヤ')).toContain('ャ');
  });

  it('non mette mai il kana stesso fra quelli simili', () => {
    for (const k of ['ぬ', 'か', 'シ', 'つ']) expect(lookalikes(k)).not.toContain(k);
  });
});
