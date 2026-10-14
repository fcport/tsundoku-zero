// Livello domain: le NOTTI della pila, la modalità a storia dell'allenamento libero
// (dominio puro). Una notte è una sequenza di battute (racconto, parole dette in
// giapponese, voce del tanuki) interrotta da domande: si sceglie cosa dire, lo si
// costruisce, e la storia reagisce a quello che si è scritto.
//
// Nessun modello linguistico: le reazioni sono scritte in anticipo. Per non ridurre
// tutto a «giusto/sbagliato», ogni domanda prevede
// - più cose da dire (scelte), ciascuna col suo seguito;
// - forme giuste diverse con reazioni diverse (semplice o cortese);
// - gli errori tipici, ciascuno con la sua scena (たい + でした, つめたい per
//   つまらない…);
// - un ripiego per le parole in italiano e per tutto il resto.
// La forma giusta, quando è una catena di pezzi, la costruisce `buildForm`: così i
// passaggi da mostrare sono gli stessi del costruttore.
import type { BilingualText } from './bilingual';
import { normalizeAnswer, type Spelling, type Verb } from './conjugation';
import { DRILL_VERBS } from './drill-verbs';
import { buildForm, type BuildStep, type FormPiece } from './form-builder';

/** Chi parla. */
export type Speaker = 'tanuki' | 'book' | 'diary';

export type Beat =
  /** Il racconto. */
  | { readonly kind: 'narration'; readonly text: BilingualText }
  /** Una battuta in giapponese, con la traduzione. */
  | {
      readonly kind: 'line';
      readonly speaker: Speaker;
      readonly ja: Spelling;
      readonly translation: BilingualText;
    }
  /** Una battuta nella lingua di chi gioca (il tanuki che sussurra). */
  | { readonly kind: 'speech'; readonly speaker: Speaker; readonly text: BilingualText }
  /** La candela si spegne: la notte finisce. */
  | { readonly kind: 'candleOut' };

/** Una risposta prevista che non è quella canonica, con la sua reazione. */
export interface Variant {
  /** Le risposte, in kana (o coi kanji), senza punteggiatura. */
  readonly answers: readonly string[];
  readonly then: readonly Beat[];
}

/** La risposta giusta: una catena del costruttore, oppure scritta per intero. */
export type Target =
  | { readonly verb: string; readonly pieces: readonly FormPiece[] }
  | { readonly answers: readonly Spelling[] };

/** Una cosa che si può dire a una domanda. */
export interface AskOption {
  readonly id: string;
  /** Cosa si vuole dire, nella lingua di chi gioca. */
  readonly label: BilingualText;
  /** Un aiuto accanto alla frase (una parola che non si conosce ancora). */
  readonly hint?: BilingualText;
  /** La frase con lo spazio da riempire (`＿`), in kanji e in kana. */
  readonly frame: Spelling;
  readonly target: Target;
  /** Altre risposte giuste (la forma semplice al posto della cortese): reazione, poi `then`. */
  readonly alsoAccepted?: readonly Variant[];
  /** Gli errori tipici di questa scelta, ciascuno con la sua scena. */
  readonly mistakes?: readonly Variant[];
  /** Il seguito della storia dopo la risposta giusta. */
  readonly then: readonly Beat[];
}

export interface Ask {
  readonly kind: 'ask';
  readonly prompt: BilingualText;
  /** Una o più cose da dire; con più di una, prima si sceglie. */
  readonly options: readonly AskOption[];
}

export type NightStep = Beat | Ask;

export interface Night {
  readonly id: string;
  /** Il titolo giapponese (第一夜) e quello tradotto. */
  readonly kanjiTitle: string;
  readonly title: BilingualText;
  readonly steps: readonly NightStep[];
  /** Il timbro della notte, con la furigana. */
  readonly stamp: readonly { readonly text: string; readonly ruby: string }[];
  readonly stampMeaning: BilingualText;
  /** Le reazioni di ripiego: parole non giapponesi, e tutto il resto. */
  readonly foreign: readonly Beat[];
  readonly wrong: readonly Beat[];
}

/** Gli errori dopo i quali il tanuki detta la forma giusta. */
export const DICTATE_AFTER = 3;

/** Il carattere dello spazio da riempire nella cornice. */
export const FRAME_GAP = '＿';

function verbOf(kanji: string): Verb {
  const verb = DRILL_VERBS.find((v) => v.kanji === kanji);
  if (!verb) throw new Error(`Verbo assente dall'allenamento: ${kanji}`);
  return verb;
}

/** La risposta canonica, e i passaggi quando è una catena del costruttore. */
export function targetForm(target: Target): { result: Spelling; steps: readonly BuildStep[] | null } {
  if ('verb' in target) {
    const built = buildForm(verbOf(target.verb), target.pieces);
    return { result: built.result, steps: built.steps };
  }
  return { result: target.answers[0]!, steps: null };
}

/** La risposta ripulita: niente spazi né punteggiatura, romaji in kana. */
export function cleanAnswer(input: string): string {
  return normalizeAnswer(input.replace(/[。、．，.,!?！？「」『』…]/g, ''));
}

/**
 * Toglie dalla risposta i pezzi della frase già scritti: chi ricopia tutta la frase
 * (はい、よみたい al posto di よみたい) ha risposto lo stesso.
 */
function withoutFrame(answer: string, frame: Spelling): string {
  let rest = answer;
  for (const spelling of [frame.kana, frame.kanji]) {
    const [before = '', after = ''] = spelling.split(FRAME_GAP).map(cleanAnswer);
    if (before && rest.startsWith(before) && rest.length > before.length) rest = rest.slice(before.length);
    if (after && rest.endsWith(after) && rest.length > after.length) rest = rest.slice(0, -after.length);
  }
  return rest;
}

function matches(answer: string, candidates: readonly string[]): boolean {
  return candidates.some((c) => cleanAnswer(c) === answer);
}

export type Verdict =
  | { readonly kind: 'correct'; readonly then: readonly Beat[] }
  | { readonly kind: 'mistake'; readonly then: readonly Beat[] }
  | { readonly kind: 'foreign' }
  | { readonly kind: 'wrong' }
  | { readonly kind: 'empty' };

/**
 * Come reagisce la storia. Giusta (canonica o una variante prevista) ⇒ la reazione
 * e il seguito; un errore previsto ⇒ la sua scena; lettere rimaste dopo la
 * conversione del romaji ⇒ parole non giapponesi; altrimenti sbagliata.
 */
export function judge(input: string, option: AskOption): Verdict {
  const answer = withoutFrame(cleanAnswer(input), option.frame);
  if (answer === '') return { kind: 'empty' };
  const { result } = targetForm(option.target);
  const canonical = 'verb' in option.target
    ? [result.kana, result.kanji]
    : option.target.answers.flatMap((a) => [a.kana, a.kanji]);
  if (matches(answer, canonical)) return { kind: 'correct', then: option.then };
  const variant = option.alsoAccepted?.find((v) => matches(answer, v.answers));
  if (variant) return { kind: 'correct', then: [...variant.then, ...option.then] };
  const mistake = option.mistakes?.find((v) => matches(answer, v.answers));
  if (mistake) return { kind: 'mistake', then: mistake.then };
  if (/[a-z]/i.test(answer)) return { kind: 'foreign' };
  return { kind: 'wrong' };
}

/** Tutte le risposte che una scelta accetta come giuste, ripulite. */
export function acceptedAnswers(option: AskOption): string[] {
  const { result } = targetForm(option.target);
  const canonical = 'verb' in option.target
    ? [result.kana, result.kanji]
    : option.target.answers.flatMap((a) => [a.kana, a.kanji]);
  return [...canonical, ...(option.alsoAccepted ?? []).flatMap((v) => v.answers)].map(cleanAnswer);
}
