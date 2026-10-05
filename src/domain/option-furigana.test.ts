import { describe, expect, it } from 'vitest';
import type { Exercise } from './exercise';
import { answerOptions } from './exercise-presentation';
import {
  annotateKnownKanji,
  knownReadings,
  optionFurigana,
  sentenceSegments,
} from './option-furigana';

const explanation = { en: 'x' };

/** La furigana di un'opzione per testo, in forma leggibile: "妹[いもうと]が". */
function byOption(exercise: Exercise): Record<string, string | null> {
  const options = answerOptions(exercise);
  const furigana = optionFurigana(exercise);
  return Object.fromEntries(
    options.map((o, i) => [
      o,
      furigana[i]?.map((s) => (s.ruby ? `${s.text}[${s.ruby}]` : s.text)).join('') ?? null,
    ]),
  );
}

describe('optionFurigana — assemble: le tessere dalla lettura della frase', () => {
  it('ancore kana fra le tessere ⇒ lettura per tessera', () => {
    const ex: Exercise = {
      kind: 'assemble',
      grammarPoint: 'g',
      sentence: { kanji: '弟がパンを焼く', kana: 'おとうとがパンをやく' },
      answer: ['弟が', 'パンを', '焼く'],
      explanation,
    };
    expect(byOption(ex)).toEqual({ '弟が': '弟[おとうと]が', 'パンを': null, '焼く': '焼[や]く' });
  });

  it('kanji di due tessere attaccati (毎朝|歌) ⇒ quelle due senza furigana, le altre sì', () => {
    const ex: Exercise = {
      kind: 'assemble',
      grammarPoint: 'g',
      sentence: { kanji: '妹が毎朝歌います', kana: 'いもうとがまいあさうたいます' },
      answer: ['妹が', '毎朝', '歌います'],
      explanation,
    };
    expect(byOption(ex)).toEqual({ '妹が': '妹[いもうと]が', '毎朝': null, '歌います': null });
  });

  it('tessere che non ricompongono la frase ⇒ nessuna furigana', () => {
    const ex: Exercise = {
      kind: 'assemble',
      grammarPoint: 'g',
      sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
      answer: ['本', 'を', '読んだ'],
      explanation,
    };
    expect(Object.values(byOption(ex))).toEqual([null, null, null]);
  });

  it('allineamento ambiguo ⇒ nessuna furigana (mai una lettura indovinata)', () => {
    // 画が画 su がががが: il primo 画 può essere が o がが, due allineamenti validi.
    const ex: Exercise = {
      kind: 'assemble',
      grammarPoint: 'g',
      sentence: { kanji: '画が画', kana: 'がががが' },
      answer: ['画が', '画'],
      explanation,
    };
    expect(Object.values(byOption(ex))).toEqual([null, null]);
  });
});

describe('optionFurigana — select-span: i segmenti portano già la lettura', () => {
  it('il nucleo ha la sua lettura di gruppo, il suffisso kana no', () => {
    const ex: Exercise = {
      kind: 'select-span',
      grammarPoint: 'g',
      sentence: { kanji: '妹が学生だ', kana: 'いもうとががくせいだ' },
      answer: { start: 1, end: 2 },
      explanation,
    };
    expect(byOption(ex)).toEqual({ '妹が学生': '妹が学生[いもうとががくせい]', 'だ': null });
  });
});

describe('optionFurigana — single-select: tutto o niente', () => {
  it('solo particelle kana ⇒ nessuna furigana', () => {
    const ex: Exercise = {
      kind: 'single-select',
      grammarPoint: 'g',
      sentence: { kanji: '猫が魚を食べた', kana: 'ねこがさかなをたべた' },
      gap: { kanji: '猫が魚＿食べた', kana: 'ねこがさかな＿たべた' },
      answer: 'を',
      distractors: ['が', 'の'],
      explanation,
    } as Exercise;
    expect(Object.values(byOption(ex))).toEqual([null, null, null]);
  });

  it('distrattori con gli stessi kanji della frase ⇒ furigana su tutte', () => {
    const ex: Exercise = {
      kind: 'single-select',
      grammarPoint: 'g',
      sentence: { kanji: '水が冷たい', kana: 'みずがつめたい' },
      gap: { kanji: '水が＿', kana: 'みずが＿' },
      answer: '冷たい',
      distractors: ['冷たくだ', '冷たいだ'],
      explanation,
    } as Exercise;
    expect(byOption(ex)).toEqual({
      '冷たい': '冷[つめ]たい',
      '冷たくだ': '冷[つめ]たくだ',
      '冷たいだ': '冷[つめ]たいだ',
    });
  });

  it('un distrattore con un kanji ignoto ⇒ nessuna furigana su NESSUNA opzione', () => {
    const ex: Exercise = {
      kind: 'single-select',
      grammarPoint: 'g',
      sentence: { kanji: '水が冷たい', kana: 'みずがつめたい' },
      gap: { kanji: '水が＿', kana: 'みずが＿' },
      answer: '冷たい',
      distractors: ['暑い'],
      explanation,
    } as Exercise;
    expect(Object.values(byOption(ex))).toEqual([null, null]);
  });
});

describe('optionFurigana — la lettura esplicita delle glosse', () => {
  it('copre le tessere che la frase non permette di dividere (毎晩|日記を)', () => {
    const ex: Exercise = {
      kind: 'assemble',
      grammarPoint: 'g',
      sentence: { kanji: '毎晩日記を書く', kana: 'まいばんにっきをかく' },
      answer: ['毎晩', '日記を', '書く'],
      explanation,
      glosses: [
        { text: '毎晩', reading: 'まいばん' },
        { text: '日記を', reading: 'にっきを' },
      ],
    };
    expect(byOption(ex)).toEqual({
      '毎晩': '毎晩[まいばん]',
      '日記を': '日記[にっき]を',
      '書く': '書[か]く',
    });
  });

  it('nella scelta singola completa i distrattori con kanji ignoti', () => {
    const ex = {
      kind: 'single-select',
      grammarPoint: 'g',
      sentence: { kanji: '水が冷たい', kana: 'みずがつめたい' },
      gap: { kanji: '水が＿', kana: 'みずが＿' },
      answer: '冷たい',
      distractors: ['暑い'],
      explanation,
      glosses: [{ text: '暑い', reading: 'あつい' }],
    } as Exercise;
    expect(byOption(ex)).toEqual({ '冷たい': '冷[つめ]たい', '暑い': '暑[あつ]い' });
  });
});

describe('sentenceSegments — la lettura sopra ogni kanji della frase', () => {
  it('lettura certa ⇒ una ruby per corsa di kanji, non un gruppo spalmato', () => {
    expect(sentenceSegments('子どもが部屋に入った', 'こどもがへやにはいった')).toEqual([
      { text: '子', ruby: 'こ' },
      { text: 'どもが', ruby: null },
      { text: '部屋', ruby: 'へや' },
      { text: 'に', ruby: null },
      { text: '入', ruby: 'はい' },
      { text: 'った', ruby: null },
    ]);
  });

  it('lettura ambigua ⇒ il gruppo unico, così nessun kanji resta scoperto', () => {
    const segments = sentenceSegments('妹が学生だ', 'いもうとががくせいだ');
    expect(segments.map((s) => s.ruby ?? s.text).join('')).toBe('いもうとががくせいだ');
    expect(segments.some((s) => s.ruby !== null)).toBe(true);
  });
});

describe('annotateKnownKanji — le parole giapponesi dentro un testo in prosa', () => {
  /** In forma leggibile: "出[だ]す". */
  const show = (text: string, known: ReadonlyMap<string, string>) =>
    annotateKnownKanji(text, known)
      .map((s) => (s.ruby ? `${s.text}[${s.ruby}]` : s.text))
      .join('');

  it('le corse di kanji note dalla frase prendono la lettura, il resto resta com è', () => {
    const known = knownReadings([{ kanji: '手紙を出した', kana: 'てがみをだした' }]);
    expect(show('Which part is the past ending of 出す?', known)).toBe(
      'Which part is the past ending of 出[だ]す?',
    );
    expect(show('Un 手紙, e un 本.', known)).toBe('Un 手紙[てがみ], e un 本.');
  });

  it('来 prende la lettura della sua forma, non quella della frase', () => {
    const known = knownReadings([{ kanji: '友達が来た', kana: 'ともだちがきた' }]);
    expect(known.get('来')).toBe('き');
    expect(show('What is the past of 来る?', known)).toBe('What is the past of 来[く]る?');
    expect(show('来た, 来て, 来ます', known)).toBe('来[き]た, 来[き]て, 来[き]ます');
    expect(show('来ない, 来られる, 来よう, 来させる, 来い', known)).toBe(
      '来[こ]ない, 来[こ]られる, 来[こ]よう, 来[こ]させる, 来[こ]い',
    );
  });

  it('来 senza una sillaba che decida resta senza furigana; 来年 è un altra parola', () => {
    const known = new Map([['来年', 'らいねん']]);
    expect(show('(来) e 来年', known)).toBe('(来) e 来年[らいねん]');
  });
});

describe('optionFurigana — select-span con le glosse come pezzi', () => {
  it('ogni pezzo prende la sua lettura, la desinenza kana nessuna', () => {
    const ex: Exercise = {
      kind: 'select-span',
      grammarPoint: 'g',
      sentence: { kanji: '母に花を買ってあげた', kana: 'ははにはなをかってあげた' },
      answer: { start: 1, end: 2 },
      explanation,
      glosses: [{ text: '母に花を買って', reading: 'ははにはなをかって' }, { text: 'あげた' }],
    };
    const furigana = byOption(ex);
    expect(Object.keys(furigana)).toEqual(['母に花を買って', 'あげた']);
    expect(furigana['あげた']).toBeNull();
    expect(furigana['母に花を買って']).toContain('買[か]');
  });
});
