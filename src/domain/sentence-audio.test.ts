import { describe, expect, it } from 'vitest';
import { readingKey, sentenceAudioFile, sentenceAudioPath } from './sentence-audio';

describe('sentenceAudioFile — il nome del file audio di una frase', () => {
  it('è l hash della frase in kanji, 8 cifre esadecimali (pinnato)', () => {
    expect(sentenceAudioFile('今日は日本語を勉強します')).toBe('7bd0cb88.mp3');
  });

  it('frasi diverse ⇒ file diversi', () => {
    expect(sentenceAudioFile('果物をください')).not.toBe(sentenceAudioFile('果物をください。'));
  });

  it('il percorso pubblico sta sotto /audio/', () => {
    expect(sentenceAudioPath('果物をください')).toBe(`/audio/${sentenceAudioFile('果物をください')}`);
  });
});

describe('readingKey — confronto della pronuncia, non dell ortografia', () => {
  it('hiragana e katakana coincidono', () => {
    expect(readingKey('くだものをください')).toBe(readingKey('クダモノヲクダサイ'));
  });

  it('は, へ, を particelle coincidono con la pronuncia ワ, エ, オ', () => {
    expect(readingKey('わたしはがっこうへいく')).toBe(readingKey('ワタシワガッコオエイク'));
    expect(readingKey('ほんをよむ')).toBe(readingKey('ホンオヨム'));
  });

  it('le vocali lunghe scritte o allungate con ー coincidono', () => {
    expect(readingKey('きょう')).toBe(readingKey('キョー'));
    expect(readingKey('せんせい')).toBe(readingKey('センセー'));
    expect(readingKey('ギター')).toBe(readingKey('ギタア'));
  });

  it('la punteggiatura non conta', () => {
    expect(readingKey('かりて、よみます')).toBe(readingKey('カリテヨミマス'));
  });

  it('una lettura davvero diversa resta diversa', () => {
    expect(readingKey('ふりません')).not.toBe(readingKey('オリマセン'));
    expect(readingKey('にほん')).not.toBe(readingKey('ニッポン'));
    expect(readingKey('かど')).not.toBe(readingKey('カク'));
  });
});
