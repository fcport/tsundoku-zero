import { describe, expect, it } from 'vitest';
import { isCorrectAnswer, pickDrill, type Verb } from './conjugation';
import { DRILL_VERBS } from './drill-verbs';
import {
  ORDER_EXAMPLE,
  PIECE_GROUP,
  PIECE_GROUPS,
  RECIPES,
  RECIPE_LENGTHS,
  buildForm,
  buildPool,
  pieceCount,
  recipeExample,
  recipeFits,
  type Recipe,
} from './form-builder';
import { alignFurigana } from './furigana';

function verb(kanji: string): Verb {
  const found = DRILL_VERBS.find((v) => v.kanji === kanji);
  if (!found) throw new Error(`verbo assente: ${kanji}`);
  return found;
}

function recipe(id: string): Recipe {
  const found = RECIPES.find((r) => r.id === id);
  if (!found) throw new Error(`ricetta assente: ${id}`);
  return found;
}

const built = (kanji: string, id: string) => buildForm(verb(kanji), recipe(id).pieces).result;

describe('buildForm', () => {
  it.each([
    ['勉強する', 'tai-past-polite', '勉強したかったです', 'べんきょうしたかったです'],
    ['食べる', 'tai-past', '食べたかった', 'たべたかった'],
    ['飲む', 'tai-negative', '飲みたくない', 'のみたくない'],
    ['行く', 'tai-negative-past-polite', '行きたくなかったです', 'いきたくなかったです'],
    ['褒める', 'passive-tai-past', '褒められたかった', 'ほめられたかった'],
    ['言う', 'passive-tai', '言われたい', 'いわれたい'],
    ['見る', 'passive-tai-negative-past', '見られたくなかった', 'みられたくなかった'],
    ['する', 'passive-tai-negative', 'されたくない', 'されたくない'],
    ['叱る', 'passive-past', '叱られた', 'しかられた'],
    ['呼ぶ', 'passive-negative-past', '呼ばれなかった', 'よばれなかった'],
    ['行く', 'causative-tai-negative-past', '行かせたくなかった', 'いかせたくなかった'],
    ['待つ', 'causative-past', '待たせた', 'またせた'],
    ['来る', 'causative-past', '来させた', 'こさせた'],
    ['書く', 'potential-past', '書けた', 'かけた'],
    ['来る', 'potential-negative-past', '来られなかった', 'こられなかった'],
    ['勉強する', 'potential-negative', '勉強できない', 'べんきょうできない'],
    ['食べる', 'potential-polite-negative-past', '食べられませんでした', 'たべられませんでした'],
    ['読む', 'teiru-past', '読んでいた', 'よんでいた'],
    ['行く', 'teiru-negative', '行っていない', 'いっていない'],
    ['寝る', 'teiru-polite-past', '寝ていました', 'ねていました'],
    ['飲む', 'sugiru-past', '飲みすぎた', 'のみすぎた'],
    ['遊ぶ', 'tai-garu-teiru', '遊びたがっている', 'あそびたがっている'],
    ['行く', 'tai-garu-negative', '行きたがらない', 'いきたがらない'],
    ['食べる', 'tai-garu-past', '食べたがった', 'たべたがった'],
    ['見る', 'tai-garu-teiru-past', '見たがっていた', 'みたがっていた'],
    ['勉強する', 'tai-garu-negative', '勉強したがらない', 'べんきょうしたがらない'],
    ['勉強する', 'sugiru-past', '勉強しすぎた', 'べんきょうしすぎた'],
  ])('%s + %s = %s', (base, id, kanji, kana) => {
    expect(built(base, id)).toEqual({ kanji, kana });
  });

  it('tiene ogni passaggio, con la regola e cosa diventa la parola', () => {
    const { steps } = buildForm(verb('勉強する'), recipe('tai-past-polite').pieces);
    expect(steps.map((s) => s.to.kanji)).toEqual(['勉強したい', '勉強したかった', '勉強したかったです']);
    expect(steps.map((s) => s.rules)).toEqual([['suru'], ['adjective-past'], ['desu']]);
    expect(steps[0]!.stem).toEqual({ kanji: '勉強し', kana: 'べんきょうし' });
    expect(steps[0]!.becomes).toBe('adjective');
    expect(steps[1]).toMatchObject({ stem: { kanji: '勉強した' }, ending: 'かった' });
  });

  it('dopo passivo, causativo e potenziale si coniuga come un ichidan', () => {
    const { steps } = buildForm(verb('書く'), ['passive', 'tai', 'negative', 'past']);
    expect(steps.map((s) => s.becomes)).toEqual(['ichidan', 'adjective', null, null]);
    expect(steps[0]!.rules).toEqual(['godan-a']);
    expect(steps[1]!.rules).toEqual(['ichidan']);
    expect(steps[1]!.stem).toEqual({ kanji: '書かれ', kana: 'かかれ' });
  });

  it('la trappola dei godan che sembrano ichidan vale solo sul primo passaggio', () => {
    const { steps, result } = buildForm(verb('帰る'), recipe('potential-negative').pieces);
    expect(result.kanji).toBe('帰れない');
    expect(steps.map((s) => s.looksIchidan)).toEqual([true, false]);
  });

  it('がる: la い di たい cade, e quello che resta si coniuga come un godan', () => {
    const { steps } = buildForm(verb('遊ぶ'), recipe('tai-garu-teiru').pieces);
    expect(steps.map((s) => s.to.kanji)).toEqual(['遊びたい', '遊びたがる', '遊びたがっている']);
    expect(steps.map((s) => s.becomes)).toEqual(['adjective', 'godan', 'ichidan']);
    expect(steps.map((s) => s.rules)).toEqual([['godan-i'], ['garu'], ['godan-te-small-tsu']]);
    expect(steps[1]).toMatchObject({ stem: { kanji: '遊びた' }, ending: 'がる' });
    expect(() => buildForm(verb('遊ぶ'), ['garu'])).toThrow();
  });

  it('ませんでした: la regola del verbo, poi でした', () => {
    const { steps } = buildForm(verb('書く'), ['politeNegativePast']);
    expect(steps[0]!.to.kanji).toBe('書きませんでした');
    expect(steps[0]!.rules).toEqual(['godan-i', 'masen-deshita']);
  });

  it('un pezzo dopo una forma finita è un errore', () => {
    expect(() => buildForm(verb('書く'), ['past', 'negative'])).toThrow();
    expect(() => buildForm(verb('書く'), ['tai', 'past', 'negative'])).toThrow();
  });
});

describe('le ricette', () => {
  it('hanno id unici e vanno dalla più corta alla più lunga', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    const lengths = RECIPES.map(pieceCount);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(RECIPE_LENGTHS).toEqual([2, 3, 4]);
  });

  it("rispettano l'ordine dei gruppi: azione, voglio, in corso, no, passato, cortese", () => {
    for (const r of RECIPES) {
      const ranks = r.pieces.map((piece) => PIECE_GROUPS.indexOf(PIECE_GROUP[piece]));
      expect(ranks, r.id).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it("l'esempio della spiegazione si spezza nei pezzi giusti", () => {
    const { result } = buildForm(verb(ORDER_EXAMPLE.verb), ORDER_EXAMPLE.pieces);
    expect(ORDER_EXAMPLE.segments.join('')).toBe(result.kanji);
    expect(ORDER_EXAMPLE.segments).toHaveLength(ORDER_EXAMPLE.pieces.length + 1);
  });

  it('i verbi nominati esistono e accettano il primo pezzo', () => {
    for (const r of RECIPES) {
      for (const kanji of [...(r.only ?? []), ...(r.except ?? [])]) {
        expect(DRILL_VERBS.some((v) => v.kanji === kanji), `${r.id}: ${kanji}`).toBe(true);
      }
      for (const kanji of r.only ?? []) {
        expect(recipeFits(r, verb(kanji)), `${r.id}: ${kanji}`).toBe(true);
      }
    }
  });

  it('ogni ricetta si costruisce con ogni verbo adatto, e la furigana si allinea', () => {
    for (const r of RECIPES) {
      const verbs = DRILL_VERBS.filter((v) => recipeFits(r, v));
      expect(verbs.length, r.id).toBeGreaterThan(0);
      for (const v of verbs) {
        const { result, steps } = buildForm(v, r.pieces);
        expect(result.kana, `${r.id} ${v.kanji}`).toMatch(/^[ぁ-ゖ]+$/u);
        expect(() => alignFurigana(result.kanji, result.kana)).not.toThrow();
        for (const s of steps) expect(() => alignFurigana(s.to.kanji, s.to.kana)).not.toThrow();
      }
    }
  });

  it('niente «non so» con ている, niente «troppo» per chi non si fa troppo', () => {
    expect(recipeFits(recipe('teiru-negative'), verb('知る'))).toBe(false);
    expect(recipeFits(recipe('teiru-past'), verb('知る'))).toBe(true);
    expect(recipeFits(recipe('sugiru-past'), verb('来る'))).toBe(false);
  });

  it("l'esempio usa 食べる quando può", () => {
    expect(recipeExample(recipe('tai-past'), DRILL_VERBS).kanji).toBe('食べたかった');
    expect(recipeExample(recipe('passive-tai'), DRILL_VERBS).kanji).toBe('言われたい');
  });
});

describe('buildPool e la risposta', () => {
  it('filtra per ricette e gruppi', () => {
    const pool = buildPool(DRILL_VERBS, ['passive-tai'], ['ichidan']);
    expect(pool.map((b) => b.verb.kanji)).toEqual(['褒める']);
    expect(buildPool(DRILL_VERBS, [], ['godan'])).toEqual([]);
  });

  it('pickDrill sceglie anche fra le catene', () => {
    const pool = buildPool(DRILL_VERBS, ['tai-past'], ['irregular']);
    const first = pickDrill(pool, () => 0);
    expect(first?.verb.kanji).toBe('する');
    expect(pickDrill(pool, () => 0, first)?.verb.kanji).not.toBe('する');
  });

  it('si risponde in romaji, in kana o coi kanji', () => {
    const result = built('勉強する', 'tai-past-polite');
    expect(isCorrectAnswer('benkyoushitakattadesu', { result })).toBe(true);
    expect(isCorrectAnswer('勉強したかったです', { result })).toBe(true);
    expect(isCorrectAnswer('benkyoushitaidesita', { result })).toBe(false);
  });
});
