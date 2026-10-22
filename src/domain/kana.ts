// Livello domain: i KANA come materiale da gioco (Kotodama, 16-10-2026). Le file
// della tabella (あ行, か行, …) in hiragana e katakana, il romaji di una parola e i
// kana che si somigliano. Puro: nessun import, nessun caso, nessuno storage.
//
// Ogni kana è un MATTONCINO: anche i piccoli (ゃ ゅ ょ っ, ァ ィ ゥ ェ ォ) e il
// trattino lungo ー sono mattoncini a sé, così si impara che きゃ sono due segni.

/** Le file della tabella, nell'ordine in cui si imparano. */
export type KanaRowId =
  | 'a'
  | 'ka'
  | 'sa'
  | 'ta'
  | 'na'
  | 'ha'
  | 'ma'
  | 'ya'
  | 'ra'
  | 'wa'
  | 'dakuten'
  | 'small'
  | 'long'
  | 'smallVowels';

export type KanaScript = 'hiragana' | 'katakana';

const HIRAGANA_ROWS: Readonly<Record<Exclude<KanaRowId, 'long' | 'smallVowels'>, readonly string[]>> = {
  a: ['あ', 'い', 'う', 'え', 'お'],
  ka: ['か', 'き', 'く', 'け', 'こ'],
  sa: ['さ', 'し', 'す', 'せ', 'そ'],
  ta: ['た', 'ち', 'つ', 'て', 'と'],
  na: ['な', 'に', 'ぬ', 'ね', 'の'],
  ha: ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ma: ['ま', 'み', 'む', 'め', 'も'],
  ya: ['や', 'ゆ', 'よ'],
  ra: ['ら', 'り', 'る', 'れ', 'ろ'],
  wa: ['わ', 'を', 'ん'],
  dakuten: [
    'が', 'ぎ', 'ぐ', 'げ', 'ご',
    'ざ', 'じ', 'ず', 'ぜ', 'ぞ',
    'だ', 'ぢ', 'づ', 'で', 'ど',
    'ば', 'び', 'ぶ', 'べ', 'ぼ',
    'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ',
  ],
  small: ['ゃ', 'ゅ', 'ょ', 'っ'],
};

/** Hiragana → katakana: i due blocchi Unicode distano 0x60. */
export function toKatakana(text: string): string {
  return Array.from(text, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code >= 0x3041 && code <= 0x3096 ? String.fromCodePoint(code + 0x60) : ch;
  }).join('');
}

/** Katakana → hiragana (il trattino ー resta com'è). */
export function toHiragana(text: string): string {
  return Array.from(text, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
  }).join('');
}

/**
 * I kana di una fila. In katakana la fila わ non ha ヲ (non si usa nelle parole), e
 * ci sono due file in più: il trattino lungo ー e le vocali piccole delle parole
 * straniere (ティ, ファ, チェ).
 */
export function kanaRow(script: KanaScript, row: KanaRowId): readonly string[] {
  if (script === 'hiragana') {
    if (row === 'long' || row === 'smallVowels') return [];
    return HIRAGANA_ROWS[row];
  }
  if (row === 'long') return ['ー'];
  if (row === 'smallVowels') return ['ァ', 'ィ', 'ゥ', 'ェ', 'ォ'];
  const row_ = HIRAGANA_ROWS[row].map(toKatakana);
  return row === 'wa' ? row_.filter((k) => k !== 'ヲ') : row_;
}

/** I mattoncini di una parola: un kana per mattoncino, nell'ordine. */
export function kanaTiles(word: string): readonly string[] {
  return Array.from(word);
}

/** La scrittura di una parola: katakana se contiene almeno un katakana. */
export function scriptOf(word: string): KanaScript {
  return Array.from(word).some((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code >= 0x30a1 && code <= 0x30fc;
  })
    ? 'katakana'
    : 'hiragana';
}

// --- Il romaji -----------------------------------------------------------------
//
// Hepburn come lo scrive chi digita: le vocali lunghe dell'hiragana restano scritte
// come sono (ありがとう → arigatou, おおきい → ookii), perché ogni lettera corrisponde
// a un mattoncino da toccare. Il trattino ー del katakana diventa la vocale col
// segno sopra (ケーキ → kēki): il mattoncino in più è il trattino.

const BASE: Readonly<Record<string, string>> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゔ: 'vu',
};

/** Il kana seguito da una piccola ゃ ゅ ょ: きゃ → kya, しゃ → sha, ちゃ → cha. */
const YOON: Readonly<Record<string, string>> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const YOON_STEM: Readonly<Record<string, string>> = { し: 'sh', ち: 'ch', じ: 'j', ぢ: 'j' };

/** Le combinazioni delle parole straniere: ティ → ti, ファ → fa, チェ → che. */
const FOREIGN: Readonly<Record<string, string>> = {
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  しぇ: 'she', じぇ: 'je', ちぇ: 'che',
};

const MACRON: Readonly<Record<string, string>> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

/** Il romaji di una parola in kana (hiragana o katakana). */
export function kanaToRomaji(word: string): string {
  const chars = Array.from(toHiragana(word));
  const syllables: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const next = chars[i + 1];
    if (ch === 'ー') {
      const prev = syllables.pop() ?? '';
      const last = prev.slice(-1);
      syllables.push(MACRON[last] ? prev.slice(0, -1) + MACRON[last] : prev);
      continue;
    }
    if (ch === 'っ') {
      syllables.push('っ');
      continue;
    }
    if (next && FOREIGN[ch + next]) {
      syllables.push(FOREIGN[ch + next]!);
      i++;
      continue;
    }
    if (next && YOON[next]) {
      const base = BASE[ch] ?? ch;
      const stem = YOON_STEM[ch] ?? base.slice(0, -1) + 'y';
      syllables.push(stem + YOON[next]!);
      i++;
      continue;
    }
    syllables.push(BASE[ch] ?? ch);
  }
  // っ raddoppia la consonante che segue (っち → tchi); ん davanti a vocale o y
  // prende l'apostrofo (きんえん → kin'en), come nel romaji dei dizionari.
  let out = '';
  for (let i = 0; i < syllables.length; i++) {
    const s = syllables[i]!;
    const following = syllables[i + 1] ?? '';
    if (s === 'っ') {
      out += following.startsWith('ch') ? 't' : (following[0] ?? '');
      continue;
    }
    out += s === 'n' && /^[aiueoyāīūēō]/.test(following) ? "n'" : s;
  }
  return out;
}

// --- I kana che si somigliano ----------------------------------------------------

/**
 * Gruppi di kana che si confondono a colpo d'occhio: i mattoncini sbagliati si
 * prendono prima da qui, così la scelta non è mai ovvia.
 */
const LOOKALIKES: readonly (readonly string[])[] = [
  ['ぬ', 'め', 'あ', 'お'],
  ['る', 'ろ'],
  ['わ', 'れ', 'ね'],
  ['さ', 'ち', 'き'],
  ['は', 'ほ', 'け'],
  ['い', 'り', 'こ'],
  ['に', 'た', 'こ'],
  ['う', 'つ', 'ら'],
  ['ま', 'も'],
  ['く', 'へ', 'し'],
  ['そ', 'て'],
  ['シ', 'ツ'],
  ['ソ', 'ン', 'リ'],
  ['ク', 'ケ', 'タ', 'ワ'],
  ['ウ', 'ワ', 'フ', 'ラ'],
  ['ア', 'マ', 'ム'],
  ['コ', 'ユ', 'ロ'],
  ['チ', 'テ', 'ナ'],
  ['メ', 'ノ', 'ヌ', 'ス'],
  ['ハ', 'ル'],
  ['セ', 'サ', 'ヤ'],
  ['エ', 'ニ'],
];

/** Le coppie con e senza i trattini ゛゜: か が, は ば ぱ. */
const VOICING: readonly (readonly string[])[] = (() => {
  const groups: string[][] = [];
  const voiced = HIRAGANA_ROWS.dakuten;
  const rows: readonly (readonly [readonly string[], readonly number[]])[] = [
    [HIRAGANA_ROWS.ka, [0]],
    [HIRAGANA_ROWS.sa, [5]],
    [HIRAGANA_ROWS.ta, [10]],
    [HIRAGANA_ROWS.ha, [15, 20]],
  ];
  for (const [row, offsets] of rows) {
    row.forEach((kana, i) => groups.push([kana, ...offsets.map((o) => voiced[o + i]!)]));
  }
  return groups;
})();

/** Le coppie grande e piccola: や ゃ, つ っ, あ ぁ. */
const SIZE_PAIRS: readonly (readonly string[])[] = [
  ['や', 'ゃ'], ['ゆ', 'ゅ'], ['よ', 'ょ'], ['つ', 'っ'],
  ['あ', 'ぁ'], ['い', 'ぃ'], ['う', 'ぅ'], ['え', 'ぇ'], ['お', 'ぉ'],
];

/**
 * I kana che somigliano a `kana`: lo stesso gruppo di forme simili, la versione con
 * o senza ゛゜, la grande o la piccola. Vale per hiragana e katakana.
 */
export function lookalikes(kana: string): readonly string[] {
  const found = new Set<string>();
  for (const group of LOOKALIKES) if (group.includes(kana)) for (const k of group) found.add(k);
  const katakana = scriptOf(kana) === 'katakana';
  const plain = toHiragana(kana);
  for (const group of [...VOICING, ...SIZE_PAIRS]) {
    if (group.includes(plain)) for (const k of group) found.add(katakana ? toKatakana(k) : k);
  }
  found.delete(kana);
  return [...found];
}
