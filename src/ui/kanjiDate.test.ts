import { describe, expect, it } from 'vitest';
import { kanjiDate, kanjiNumeral } from './kanjiDate';

describe('kanjiNumeral — 1–99 con 十', () => {
  it.each([
    [1, '一'],
    [9, '九'],
    [10, '十'],
    [12, '十二'],
    [20, '二十'],
    [29, '二十九'],
    [31, '三十一'],
    [99, '九十九'],
  ])('%i → %s', (n, expected) => {
    expect(kanjiNumeral(n)).toBe(expected);
  });

  it('rifiuta i valori fuori intervallo', () => {
    expect(() => kanjiNumeral(0)).toThrow(RangeError);
    expect(() => kanjiNumeral(100)).toThrow(RangeError);
    expect(() => kanjiNumeral(1.5)).toThrow(RangeError);
  });
});

describe('kanjiDate — data e giorno della settimana nel fuso dato', () => {
  it('29 settembre 2026 (martedì) a Roma', () => {
    expect(kanjiDate(new Date('2026-09-29T10:00:00Z'), 'Europe/Rome')).toMatchObject({
      date: '九月二十九日',
      weekday: '火曜日',
    });
  });

  it('usa il fuso, non UTC: le 23:30 UTC del 31/12 sono già l\'1 gennaio a Tokyo', () => {
    expect(kanjiDate(new Date('2026-12-31T23:30:00Z'), 'Asia/Tokyo')).toMatchObject({
      date: '一月一日',
      weekday: '金曜日',
    });
  });
});

describe('kanjiDate — le letture per la furigana', () => {
  it('29 settembre, martedì: くがつ, にじゅうくにち, かようび', () => {
    const d = kanjiDate(new Date('2026-09-29T10:00:00Z'), 'Europe/Rome');
    expect(d.dateSegments).toEqual([
      { text: '九月', ruby: 'くがつ' },
      { text: '二十九日', ruby: 'にじゅうくにち' },
    ]);
    expect(d.weekdaySegments).toEqual([{ text: '火曜日', ruby: 'かようび' }]);
  });

  it('le letture irregolari: 四月一日 = しがつ ついたち, 二十日 = はつか, 十四日 = じゅうよっか', () => {
    expect(kanjiDate(new Date('2026-04-01T10:00:00Z'), 'UTC').dateSegments).toEqual([
      { text: '四月', ruby: 'しがつ' },
      { text: '一日', ruby: 'ついたち' },
    ]);
    expect(kanjiDate(new Date('2026-07-20T10:00:00Z'), 'UTC').dateSegments[1]).toEqual({ text: '二十日', ruby: 'はつか' });
    expect(kanjiDate(new Date('2026-07-14T10:00:00Z'), 'UTC').dateSegments[1]).toEqual({ text: '十四日', ruby: 'じゅうよっか' });
  });
});
