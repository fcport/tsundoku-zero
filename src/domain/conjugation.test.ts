import { describe, expect, it } from 'vitest';
import {
  CONJUGATION_FORMS,
  conjugate,
  drillPool,
  formsOf,
  isCorrectAnswer,
  normalizeAnswer,
  pickDrill,
  romajiToKana,
  type ConjugationForm,
  type Verb,
} from './conjugation';
import { DRILL_VERBS } from './drill-verbs';
import { alignFurigana } from './furigana';

function verb(kanji: string): Verb {
  const found = DRILL_VERBS.find((v) => v.kanji === kanji);
  if (!found) throw new Error(`verbo assente: ${kanji}`);
  return found;
}

const kanjiOf = (kanji: string, form: ConjugationForm) => conjugate(verb(kanji), form).result.kanji;

describe('conjugate: godan', () => {
  it.each([
    ['書く', 'masu', '書きます'],
    ['書く', 'nai', '書かない'],
    ['書く', 'te', '書いて'],
    ['泳ぐ', 'ta', '泳いだ'],
    ['話す', 'te', '話して'],
    ['待つ', 'ta', '待った'],
    ['死ぬ', 'te', '死んで'],
    ['遊ぶ', 'ta', '遊んだ'],
    ['読む', 'teiru', '読んでいる'],
    ['作る', 'te', '作って'],
    ['買う', 'nai', '買わない'],
    ['買う', 'causative', '買わせる'],
    ['読む', 'potential', '読める'],
    ['飲む', 'volitional', '飲もう'],
    ['書く', 'passive', '書かれる'],
    ['休む', 'tai', '休みたい'],
    ['飲む', 'nakatta', '飲まなかった'],
    ['話す', 'mashita', '話しました'],
  ] as const)('%s → %s = %s', (base, form, expected) => {
    expect(kanjiOf(base, form)).toBe(expected);
  });

  it('行く fa いって/いった, non いいて', () => {
    expect(kanjiOf('行く', 'te')).toBe('行って');
    expect(kanjiOf('行く', 'ta')).toBe('行った');
    expect(conjugate(verb('行く'), 'te').rule).toBe('iku');
    expect(kanjiOf('聞く', 'te')).toBe('聞いて');
  });

  it('ある al negativo è solo ない', () => {
    const nai = conjugate(verb('ある'), 'nai');
    expect(nai.result).toEqual({ kanji: 'ない', kana: 'ない' });
    expect(nai.stem).toBeNull();
    expect(nai.rule).toBe('aru');
    expect(kanjiOf('ある', 'nakatta')).toBe('なかった');
  });

  it('i godan che sembrano ichidan sono segnalati e coniugati da godan', () => {
    const kaeru = conjugate(verb('帰る'), 'nai');
    expect(kaeru.result.kanji).toBe('帰らない');
    expect(kaeru.looksIchidan).toBe(true);
    expect(kanjiOf('走る', 'te')).toBe('走って');
    expect(kanjiOf('入る', 'masu')).toBe('入ります');
    expect(conjugate(verb('書く'), 'nai').looksIchidan).toBe(false);
    expect(conjugate(verb('食べる'), 'nai').looksIchidan).toBe(false);
  });

  it('う davanti a ない diventa わ, con la sua regola', () => {
    expect(conjugate(verb('会う'), 'nai').rule).toBe('godan-wa');
    expect(conjugate(verb('書く'), 'nai').rule).toBe('godan-a');
  });

  it('i passaggi ricompongono la forma', () => {
    const c = conjugate(verb('書く'), 'masu');
    expect(c.stem).toEqual({ kanji: '書き', kana: 'かき' });
    expect(c.ending).toBe('ます');
    expect(c.rule).toBe('godan-i');
  });
});

describe('conjugate: ichidan', () => {
  it.each([
    ['食べる', 'masu', '食べます'],
    ['食べる', 'nai', '食べない'],
    ['食べる', 'te', '食べて'],
    ['見る', 'ta', '見た'],
    ['食べる', 'potential', '食べられる'],
    ['起きる', 'volitional', '起きよう'],
    ['教える', 'causative', '教えさせる'],
    ['見る', 'passive', '見られる'],
    ['着る', 'teiru', '着ている'],
  ] as const)('%s → %s = %s', (base, form, expected) => {
    expect(kanjiOf(base, form)).toBe(expected);
  });

  it('ている si mostra come forma in て + いる', () => {
    const c = conjugate(verb('食べる'), 'teiru');
    expect(c.stem?.kanji).toBe('食べて');
    expect(c.ending).toBe('いる');
  });
});

describe('conjugate: irregolari', () => {
  it.each([
    ['する', 'nai', 'しない', 'しない'],
    ['する', 'potential', 'できる', 'できる'],
    ['する', 'causative', 'させる', 'させる'],
    ['する', 'passive', 'される', 'される'],
    ['来る', 'nai', '来ない', 'こない'],
    ['来る', 'masu', '来ます', 'きます'],
    ['来る', 'te', '来て', 'きて'],
    ['来る', 'potential', '来られる', 'こられる'],
    ['来る', 'volitional', '来よう', 'こよう'],
    ['勉強する', 'masu', '勉強します', 'べんきょうします'],
    ['勉強する', 'potential', '勉強できる', 'べんきょうできる'],
  ] as const)('%s → %s = %s (%s)', (base, form, kanji, kana) => {
    expect(conjugate(verb(base), form).result).toEqual({ kanji, kana });
  });

  it('il potenziale di する non ha radicale', () => {
    expect(conjugate(verb('する'), 'potential').stem).toBeNull();
  });
});

describe('ogni verbo, ogni forma ammessa', () => {
  it('produce grafie che la furigana sa allineare', () => {
    for (const v of DRILL_VERBS) {
      for (const form of formsOf(v)) {
        const { result, stem, ending } = conjugate(v, form);
        expect(result.kana).toMatch(/^[぀-ゟ]+$/);
        const segments = alignFurigana(result.kanji, result.kana);
        expect(segments.map((s) => s.text).join('')).toBe(result.kanji);
        if (stem) expect(stem.kana + ending).toBe(result.kana);
      }
    }
  });

  it('dichiara solo forme conosciute', () => {
    for (const v of DRILL_VERBS) {
      for (const form of formsOf(v)) expect(CONJUGATION_FORMS).toContain(form);
    }
  });
});

describe('drillPool e pickDrill', () => {
  it('filtra per forme e gruppi, rispettando le forme del verbo', () => {
    const pool = drillPool(DRILL_VERBS, ['potential'], ['godan']);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((d) => d.verb.group === 'godan' && d.form === 'potential')).toBe(true);
    expect(pool.some((d) => d.verb.kanji === 'ある')).toBe(false);
  });

  it('non propone combinazioni che nessuno usa', () => {
    const pool = drillPool(DRILL_VERBS, CONJUGATION_FORMS, ['godan', 'ichidan', 'irregular']);
    const has = (kanji: string, form: ConjugationForm) =>
      pool.some((d) => d.verb.kanji === kanji && d.form === form);
    expect(has('歩く', 'passive')).toBe(false);
    expect(has('寝る', 'causative')).toBe(false);
    expect(has('思う', 'tai')).toBe(false);
    expect(has('知る', 'masu')).toBe(false);
    expect(has('知る', 'teiru')).toBe(true);
    expect(has('言う', 'passive')).toBe(true);
    expect(has('待つ', 'causative')).toBe(true);
  });

  it('una scelta vuota non dà domande', () => {
    expect(pickDrill(drillPool(DRILL_VERBS, [], ['godan']), () => 0)).toBeNull();
  });

  it('usa il caso iniettato ed evita lo stesso verbo di prima', () => {
    const pool = drillPool(DRILL_VERBS, ['nai'], ['irregular']);
    const first = pickDrill(pool, () => 0)!;
    const second = pickDrill(pool, () => 0, first)!;
    expect(second.verb).not.toBe(first.verb);
    expect(pickDrill(pool, () => 0.999999)).toBe(pool.at(-1));
  });

  it('con un solo verbo lo ripropone', () => {
    const pool = drillPool([verb('する')], ['nai'], ['irregular']);
    expect(pickDrill(pool, () => 0, pool[0]!)).toBe(pool[0]);
  });
});

describe('romajiToKana', () => {
  it.each([
    ['kakimasu', 'かきます'],
    ['tabete', 'たべて'],
    ['itta', 'いった'],
    ['shinda', 'しんだ'],
    ['yonde', 'よんで'],
    ['konnichiha', 'こんにちは'],
    ['benkyoushimasu', 'べんきょうします'],
    ['tsukatte', 'つかって'],
    ['matchimasu', 'まっちます'],
    ['jisho', 'じしょ'],
    ['sinu', 'しぬ'],
    ['tutte', 'つって'],
    ['kin\'en', 'きんえん'],
    ['KAKU', 'かく'],
  ])('%s → %s', (romaji, kana) => {
    expect(romajiToKana(romaji, true)).toBe(kana);
  });

  it('mentre si scrive, la n e le sillabe a metà restano in lettere', () => {
    expect(romajiToKana('kan')).toBe('かn');
    expect(romajiToKana('kas')).toBe('かs');
    expect(romajiToKana('kan', true)).toBe('かん');
    expect(romajiToKana('honn')).toBe('ほん');
  });

  it('lascia intatti kana e kanji', () => {
    expect(romajiToKana('書きmasu')).toBe('書きます');
  });
});

describe('isCorrectAnswer', () => {
  const kaku = conjugate(verb('書く'), 'masu');

  it('accetta kana, kanji, romaji e katakana', () => {
    expect(isCorrectAnswer('かきます', kaku)).toBe(true);
    expect(isCorrectAnswer('書きます', kaku)).toBe(true);
    expect(isCorrectAnswer(' kakimasu ', kaku)).toBe(true);
    expect(isCorrectAnswer('カキマス', kaku)).toBe(true);
  });

  it('rifiuta risposte sbagliate o vuote', () => {
    expect(isCorrectAnswer('かきます。', kaku)).toBe(false);
    expect(isCorrectAnswer('かくます', kaku)).toBe(false);
    expect(isCorrectAnswer('   ', kaku)).toBe(false);
  });

  it('la n finale conta come ん', () => {
    expect(normalizeAnswer('yomimasen')).toBe('よみません');
  });
});
