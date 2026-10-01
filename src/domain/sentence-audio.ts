// Livello domain: l'UNICA regola che lega una frase al suo file audio (AD-1,
// dominio puro). La usano sia `scripts/generate-audio.ts`, che scrive i file, sia
// la UI, che li riproduce: una sola sede evita due nomi che un giorno divergerebbero.
//
// L'audio è generato con VOICEVOX (voce «No.7», stile アナウンス) e servito come
// file statico da `public/audio/`.
import { fnv1a } from './hash';

/**
 * Il nome del file audio di una frase: l'hash FNV-1a della frase in kanji, in
 * esadecimale a 8 cifre. Cambiare la frase cambia il nome, quindi un audio vecchio
 * non può restare legato a una frase nuova.
 */
export function sentenceAudioFile(kanji: string): string {
  return `${fnv1a(kanji).toString(16).padStart(8, '0')}.mp3`;
}

/** Il percorso pubblico dell'audio di una frase (servito da `public/audio/`). */
export function sentenceAudioPath(kanji: string): string {
  return `/audio/${sentenceAudioFile(kanji)}`;
}

/** Vocale di ogni mora katakana (decide l'ultimo carattere: キョ → o). */
const VOWEL_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['a', 'アカサタナハマヤラワガザダバパァャヮ'],
  ['i', 'イキシチニヒミリギジヂビピィ'],
  ['u', 'ウクスツヌフムユルグズヅブプゥュヴ'],
  ['e', 'エケセテネヘメレゲゼデベペェ'],
  ['o', 'オコソトノホモヨロヲゴゾドボポォョ'],
];
const VOWEL_OF = new Map<string, string>(
  VOWEL_ROWS.flatMap(([vowel, chars]) => [...chars].map((ch) => [ch, vowel] as const)),
);
const VOWEL_KANA: Readonly<Record<string, string>> = { a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ' };

/**
 * Chiave di lettura «larga», per confrontare la PRONUNCIA e non l'ortografia.
 * VOICEVOX restituisce la pronuncia (は particella → ワ, きょう → キョー), il
 * campo `kana` del contenuto l'ortografia: si applicano a entrambi i lati le stesse
 * riduzioni (hiragana → katakana, ハ→ワ, ヘ→エ, ヲ→オ, vocali lunghe → vocale
 * ripetuta), così due letture coincidono se e solo se suonano uguali. La
 * punteggiatura non conta.
 */
export function readingKey(text: string): string {
  const katakana = text
    .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .replace(/[^ァ-ー]/g, '')
    .replace(/ハ/g, 'ワ')
    .replace(/ヘ/g, 'エ')
    .replace(/ヲ/g, 'オ')
    .replace(/ヅ/g, 'ズ')
    .replace(/ヂ/g, 'ジ');
  let out = '';
  for (const ch of katakana) {
    const previousVowel = VOWEL_OF.get(out.at(-1) ?? '');
    if (ch === 'ー' && previousVowel) out += VOWEL_KANA[previousVowel];
    else if (ch === 'ウ' && previousVowel === 'o') out += 'オ';
    else if (ch === 'イ' && previousVowel === 'e') out += 'エ';
    else out += ch;
  }
  return out;
}
