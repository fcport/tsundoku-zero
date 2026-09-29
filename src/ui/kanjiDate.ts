// Livello ui: la data in kanji per la colonna verticale della dashboard
// (direzione «rivista»): 九月二十九日 e il giorno della settimana 火曜日, con le loro
// letture per la furigana. PURA: riceve l'istante e il fuso, niente orologio letto
// qui. Il giapponese è CONTENUTO della pagina (reso in `lang="ja"`), non
// interfaccia: per questo non passa da t().
import type { RubySegment } from './JapaneseText';

const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// Le letture NON si compongono dalle cifre: mesi e giorni hanno letture proprie
// (四月 = しがつ, 一日 = ついたち, 二十日 = はつか, 十四日 = じゅうよっか…).
const MONTH_READINGS = [
  '', 'いちがつ', 'にがつ', 'さんがつ', 'しがつ', 'ごがつ', 'ろくがつ',
  'しちがつ', 'はちがつ', 'くがつ', 'じゅうがつ', 'じゅういちがつ', 'じゅうにがつ',
];
const DAY_READINGS = [
  '', 'ついたち', 'ふつか', 'みっか', 'よっか', 'いつか', 'むいか', 'なのか',
  'ようか', 'ここのか', 'とおか', 'じゅういちにち', 'じゅうににち', 'じゅうさんにち',
  'じゅうよっか', 'じゅうごにち', 'じゅうろくにち', 'じゅうしちにち', 'じゅうはちにち',
  'じゅうくにち', 'はつか', 'にじゅういちにち', 'にじゅうににち', 'にじゅうさんにち',
  'にじゅうよっか', 'にじゅうごにち', 'にじゅうろくにち', 'にじゅうしちにち',
  'にじゅうはちにち', 'にじゅうくにち', 'さんじゅうにち', 'さんじゅういちにち',
];
const WEEKDAY_READINGS = ['にちようび', 'げつようび', 'かようび', 'すいようび', 'もくようび', 'きんようび', 'どようび'];

/** 1–99 in numerali kanji con 十: 1 → 一, 10 → 十, 12 → 十二, 29 → 二十九. */
export function kanjiNumeral(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    throw new RangeError(`kanjiNumeral: atteso un intero fra 1 e 99, ricevuto ${n}`);
  }
  const tens = Math.floor(n / 10);
  const units = n % 10;
  const tensPart = tens === 0 ? '' : tens === 1 ? '十' : `${DIGITS[tens]}十`;
  return tensPart + DIGITS[units];
}

export interface KanjiDate {
  /** Mese e giorno: «九月二十九日». */
  readonly date: string;
  /** Il giorno della settimana: «火曜日». */
  readonly weekday: string;
  /** Mese e giorno a segmenti con la lettura: [九月|くがつ, 二十九日|にじゅうくにち]. */
  readonly dateSegments: readonly RubySegment[];
  /** Il giorno della settimana con la lettura: [火曜日|かようび]. */
  readonly weekdaySegments: readonly RubySegment[];
}

/** La data di `instant` nel fuso `timeZone`, in kanji e con le letture. */
export function kanjiDate(instant: Date, timeZone: string): KanjiDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const month = Number(get('month'));
  const day = Number(get('day'));
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const monthText = `${kanjiNumeral(month)}月`;
  const dayText = `${kanjiNumeral(day)}日`;
  const weekday = `${WEEKDAYS[weekdayIndex]}曜日`;
  return {
    date: monthText + dayText,
    weekday,
    dateSegments: [
      { text: monthText, ruby: MONTH_READINGS[month]! },
      { text: dayText, ruby: DAY_READINGS[day]! },
    ],
    weekdaySegments: [{ text: weekday, ruby: WEEKDAY_READINGS[weekdayIndex]! }],
  };
}

// Il contatore 課 (lezione) raddoppia la consonante dopo 1, 6, 8 e 10: いっか, ろっか,
// はっか, じゅっか. Le decine si leggono じゅう, にじゅう…; da sole diventano じゅっ.
const UNIT_KA = ['', 'いっ', 'に', 'さん', 'よん', 'ご', 'ろっ', 'なな', 'はっ', 'きゅう'];
const TENS = ['', 'じゅう', 'にじゅう', 'さんじゅう', 'よんじゅう', 'ごじゅう', 'ろくじゅう', 'ななじゅう', 'はちじゅう', 'きゅうじゅう'];

/** «第N課» (lezione N, 1–99) a segmenti con la lettura: [第|だい, 十二課|じゅうにか]. */
export function lessonNumberSegments(n: number): readonly RubySegment[] {
  const tens = Math.floor(n / 10);
  const units = n % 10;
  const reading =
    units === 0 ? `${TENS[tens]!.slice(0, -1)}っか` : `${TENS[tens]}${UNIT_KA[units]}か`;
  return [
    { text: '第', ruby: 'だい' },
    { text: `${kanjiNumeral(n)}課`, ruby: reading },
  ];
}
