// Livello domain: la SESTA legge di Epic 3 (`AD-21`) — la furigana SI ALLINEA nel
// dominio, non nella UI. Le frasi degli esercizi (2.1, `japaneseSentence`)
// espongono `kanji` e `kana` SEPARATI proprio perché la furigana sia DERIVABILE
// qui, in un solo punto. Senza questa funzione la UI (3.11) dovrebbe rianalizzare
// testo misto e gli span di `select-span` (2.3, `segmentSpan`) resterebbero senza
// il registro di segmenti che indicizzano. Qui vive l'UNICA definizione
// dell'allineamento (`AD-21`/UX-DR23): nessun altro modulo lo ricalcola.
//
// Puro come `./due` e `./streak`: nessun import esterno (in particolare NON
// importa React, AC5), nessun global di piattaforma (`fetch`/storage/…), nessun
// `Math.random()`. Non ha input temporali: `alignFurigana(kanji, kana)` è pura,
// sincrona, TOTALE e non muta l'input — stessa coppia `(kanji, kana)` ⇒ stesso
// array (`alignFurigana.length === 2`).
//
// L'allineamento è puramente LESSICALE sui due campi già forniti: nessuna analisi
// morfologica, dizionario, rete, DB o casualità. Toglie il prefisso e il suffisso
// di kana COMUNI ai due campi e applica RUBY DI GRUPPO al nucleo rimanente (una
// sola lettura sul nucleo intero, mai spezzata per carattere — è la resa corretta
// per okurigana, prefisso kana e jukujikun). Nessuna logica di rendering
// `<ruby>`/`<rt>`/`<rp>`, nessun romaji, nessun `lang`/`aria`: quelli sono
// presentazione di 3.11.

/**
 * Un segmento allineato della frase: il `text` da mostrare e il suo `ruby` — la
 * lettura kana sopra il segmento, oppure `null` se il segmento non porta ruby
 * (è già kana, o è prefisso/suffisso comune). Ogni segmento porta SEMPRE entrambe
 * le chiavi: `ruby === null` significa «nessun ruby», così il consumatore (3.11)
 * fa `seg.ruby ? <ruby>… : seg.text` in modo uniforme, senza distinguere
 * «assente» da «vuoto». La concatenazione dei `text` di tutti i segmenti
 * ricostruisce `kanji` (o `kana` nel caso senza kanji): nessun carattere si perde
 * né si duplica.
 */
export interface FuriganaSegment {
  readonly text: string;
  readonly ruby: string | null;
}

/**
 * Vero sse `ch` è un kana: Hiragana (U+3040–U+309F) o Katakana (U+30A0–U+30FF,
 * `ー` U+30FC incluso nel range). PURO e locale al modulo: serve a decidere quali
 * caratteri di bordo si possono staccare come prefisso/suffisso comune. Un kanji,
 * uno spazio o la punteggiatura non sono kana e restano nel nucleo.
 */
export const isKana = (ch: string): boolean => {
  const o = ch.codePointAt(0) ?? 0;
  return (o >= 0x3040 && o <= 0x309f) || (o >= 0x30a0 && o <= 0x30ff);
};

/**
 * L'UNICA definizione dell'allineamento della furigana (`AD-21`/UX-DR23): data una
 * frase come `kanji` e la sua lettura `kana`, produce i segmenti allineati con
 * RUBY DI GRUPPO sul nucleo. PURA, sincrona, TOTALE e senza mutazione — stessa
 * coppia `(kanji, kana)` ⇒ stesso array, sempre.
 *
 * Algoritmo (lessicale, portato dal prototipo di planning già verificato):
 * - Se `kanji` è vuoto o coincide con `kana`, non c'è nulla da leggere: un SOLO
 *   segmento `{ text: kana, ruby: null }`.
 * - Altrimenti stacca il prefisso comune `p` (caratteri uguali in `kanji` e `kana`
 *   E kana) e il suffisso comune `s` (stessa condizione, dai due estremi, senza
 *   sconfinare oltre il prefisso). Il nucleo `kanji[p..len-s)` prende come ruby la
 *   lettura `kana[p..len-s)` INTERA — mai spezzata per carattere: per jukujikun
 *   (今日=きょう) e nuclei multi-kanji (日本語=にほんご) non esiste una mappa
 *   carattere→kana corretta, una sola lettura sul nucleo è la resa giusta.
 * - Emette i segmenti nell'ordine `prefix` (se non vuoto, `ruby: null`), `core`
 *   (se non vuoto, `ruby: reading || null`), `suffix` (se non vuoto, `ruby: null`).
 *
 * LIMITE NOTO accettato (AD-21): QUALSIASI kana interno non di bordo — sokuon
 * (引っ越し→ひっこし) ma anche una particella fra i kanji in contenuto a livello di
 * frase (本を読む→ほんをよむ, il を) — resta nel nucleo e riceve un unico ruby di
 * gruppo (es. `[引っ越|ひっこ, し|∅]`), perché non è un kana di bordo comune. È il
 * limite lessicale accettato da AD-21 (nessuna analisi morfologica), comportamento
 * ATTESO e non un difetto.
 */
export function alignFurigana(kanji: string, kana: string): FuriganaSegment[] {
  if (!kanji || kanji === kana) return [{ text: kana, ruby: null }];
  let p = 0;
  while (p < kanji.length && p < kana.length && kanji[p] === kana[p] && isKana(kanji[p]!)) p++;
  let s = 0;
  while (
    s < kanji.length - p &&
    s < kana.length - p &&
    kanji[kanji.length - 1 - s] === kana[kana.length - 1 - s] &&
    isKana(kanji[kanji.length - 1 - s]!)
  )
    s++;
  const prefix = kanji.slice(0, p);
  const core = kanji.slice(p, kanji.length - s);
  const suffix = s ? kanji.slice(kanji.length - s) : '';
  const reading = kana.slice(p, kana.length - s);
  const out: FuriganaSegment[] = [];
  if (prefix) out.push({ text: prefix, ruby: null });
  if (core) out.push({ text: core, ruby: reading || null });
  if (suffix) out.push({ text: suffix, ruby: null });
  return out;
}
