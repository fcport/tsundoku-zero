// Livello domain: il COSTRUTTORE DI FORME dell'allenamento libero (dominio puro).
//
// L'allenamento delle forme chiede un pezzo alla volta (書く → 書きたい). Qui i pezzi
// si impilano: 勉強する → 勉強したい → 勉強したかった → 勉強したかったです. Funziona
// perché quasi ogni pezzo produce una parola di un tipo già noto:
// - passivo, causativo, potenziale, ている e すぎる danno un nuovo verbo in る che si
//   coniuga come un ichidan (見られる → 見られた, 見られない, 見られたい);
// - たい e ない danno una parola in い che si coniuga come un aggettivo
//   (食べたい → 食べたかった, come 高い → 高かった).
// Si coniuga il primo pezzo con `conjugate`, poi si tratta il risultato come un
// verbo o un aggettivo nuovo e si va avanti. Ogni passaggio resta, con la sua regola:
// la correzione li mostra tutti.
//
// Le catene sono una lista SCELTA, non tutte le combinazioni possibili: solo quelle
// che si dicono davvero e che il corso ha già spiegato. Restano fuori potenziale +
// たい (食べられたかった si capisce «volevo essere mangiato»: si dice
// 食べられるようになりたかった) e causativo + passivo (食べさせられる, lezione 21).
import type { BilingualText } from './bilingual';
import {
  conjugate,
  formsOf,
  type ConjugationForm,
  type ConjugationRule,
  type Spelling,
  type Verb,
  type VerbGroup,
} from './conjugation';

/** Un pezzo della catena, nell'ordine in cui si attacca. */
export type FormPiece =
  | 'causative'
  | 'passive'
  | 'potential'
  | 'sugiru'
  | 'teiru'
  | 'tai'
  | 'negative'
  | 'past'
  | 'polite'
  | 'politePast'
  | 'politeNegativePast';

/**
 * La regola di un passaggio: quella del verbo (`ConjugationRule`) quando il pezzo si
 * attacca a un verbo, oppure una di quelle della parola in い.
 */
export type BuildRule =
  | ConjugationRule
  | 'adjective-negative'
  | 'adjective-past'
  | 'desu'
  | 'masen-deshita';

/** Un passaggio: da cosa si parte, cosa si attacca, cosa si ottiene. */
export interface BuildStep {
  readonly piece: FormPiece;
  readonly from: Spelling;
  /** Il pezzo a cui si attacca la terminazione, `null` se la forma sostituisce tutto. */
  readonly stem: Spelling | null;
  readonly ending: string;
  readonly to: Spelling;
  readonly rules: readonly BuildRule[];
  /** Vero per i godan che sembrano ichidan (帰る), solo sul primo passaggio. */
  readonly looksIchidan: boolean;
  /**
   * Il tipo della parola ottenuta, quando cambia il modo di coniugarla: `ichidan`
   * per un nuovo verbo in る, `adjective` per una parola in い. `null` se la parola
   * non prende altri pezzi o resta del tipo che era.
   */
  readonly becomes: 'ichidan' | 'adjective' | null;
}

export interface Built {
  readonly steps: readonly BuildStep[];
  readonly result: Spelling;
}

type Word =
  | { readonly type: 'verb'; readonly verb: Verb }
  | { readonly type: 'adjective'; readonly spelling: Spelling }
  | { readonly type: 'adjectivePast'; readonly spelling: Spelling }
  | { readonly type: 'end'; readonly spelling: Spelling };

function spellingOf(word: Word): Spelling {
  return word.type === 'verb' ? { kanji: word.verb.kanji, kana: word.verb.kana } : word.spelling;
}

/** Il pezzo che si attacca a un verbo, con la forma di `conjugate` che lo fa. */
const VERB_FORM: Readonly<Record<FormPiece, ConjugationForm>> = {
  causative: 'causative',
  passive: 'passive',
  potential: 'potential',
  // すぎる si attacca dove si attacca ます: al radicale in i.
  sugiru: 'masu',
  teiru: 'teiru',
  tai: 'tai',
  negative: 'nai',
  past: 'ta',
  polite: 'masu',
  politePast: 'mashita',
  politeNegativePast: 'masen',
};

/** Cosa diventa il verbo dopo il pezzo. */
const VERB_NEXT: Readonly<Record<FormPiece, 'ichidan' | 'adjective' | 'end'>> = {
  causative: 'ichidan',
  passive: 'ichidan',
  potential: 'ichidan',
  sugiru: 'ichidan',
  teiru: 'ichidan',
  tai: 'adjective',
  negative: 'adjective',
  past: 'end',
  polite: 'end',
  politePast: 'end',
  politeNegativePast: 'end',
};

function applyToVerb(verb: Verb, piece: FormPiece, first: boolean): { step: BuildStep; next: Word } {
  const c = conjugate(verb, VERB_FORM[piece]);
  let to = c.result;
  let ending = c.ending;
  const rules: BuildRule[] = [c.rule];
  if (piece === 'sugiru') {
    to = { kanji: `${c.stem!.kanji}すぎる`, kana: `${c.stem!.kana}すぎる` };
    ending = 'すぎる';
  } else if (piece === 'politeNegativePast') {
    to = { kanji: `${to.kanji}でした`, kana: `${to.kana}でした` };
    ending = 'ませんでした';
    rules.push('masen-deshita');
  }
  const kind = VERB_NEXT[piece];
  const next: Word =
    kind === 'ichidan'
      ? { type: 'verb', verb: { kanji: to.kanji, kana: to.kana, group: 'ichidan', meaning: verb.meaning } }
      : kind === 'adjective'
        ? { type: 'adjective', spelling: to }
        : { type: 'end', spelling: to };
  return {
    step: {
      piece,
      from: { kanji: verb.kanji, kana: verb.kana },
      stem: c.stem,
      ending,
      to,
      rules,
      looksIchidan: first && c.looksIchidan,
      becomes: kind === 'end' ? null : kind,
    },
    next,
  };
}

/** Toglie la い finale: 食べたい → 食べた. */
function dropI(spelling: Spelling): Spelling {
  return { kanji: spelling.kanji.slice(0, -1), kana: spelling.kana.slice(0, -1) };
}

function append(spelling: Spelling, tail: string): Spelling {
  return { kanji: spelling.kanji + tail, kana: spelling.kana + tail };
}

function applyToAdjective(
  word: Extract<Word, { type: 'adjective' | 'adjectivePast' }>,
  piece: FormPiece,
): { step: BuildStep; next: Word } {
  const from = word.spelling;
  const step = (stem: Spelling, ending: string, rule: BuildRule) => ({
    piece,
    from,
    stem,
    ending,
    to: append(stem, ending),
    rules: [rule],
    looksIchidan: false,
    becomes: null,
  });
  if (word.type === 'adjective' && piece === 'negative') {
    const s = step(dropI(from), 'くない', 'adjective-negative');
    return { step: s, next: { type: 'adjective', spelling: s.to } };
  }
  if (word.type === 'adjective' && piece === 'past') {
    const s = step(dropI(from), 'かった', 'adjective-past');
    return { step: s, next: { type: 'adjectivePast', spelling: s.to } };
  }
  if (piece === 'polite') {
    const s = step(from, 'です', 'desu');
    return { step: s, next: { type: 'end', spelling: s.to } };
  }
  throw new Error(`Il pezzo ${piece} non si attacca a ${from.kanji}`);
}

/**
 * Applica i pezzi uno dopo l'altro. PURA; una catena impossibile (un pezzo dopo
 * una forma che non ne prende altri) è un errore del chiamante: le ricette sono
 * provate nei test.
 */
export function buildForm(verb: Verb, pieces: readonly FormPiece[]): Built {
  let word: Word = { type: 'verb', verb };
  const steps: BuildStep[] = [];
  pieces.forEach((piece, index) => {
    let applied: { step: BuildStep; next: Word };
    if (word.type === 'verb') {
      applied = applyToVerb(word.verb, piece, index === 0);
    } else if (word.type === 'end') {
      throw new Error(`Il pezzo ${piece} non si attacca a ${word.spelling.kanji}`);
    } else {
      applied = applyToAdjective(word, piece);
    }
    steps.push(applied.step);
    word = applied.next;
  });
  return { steps, result: spellingOf(word) };
}

// ---------------------------------------------------------------------------
// Le ricette: quali catene si allenano.

export interface Recipe {
  readonly id: string;
  readonly pieces: readonly FormPiece[];
  /** Cosa vuol dire, con «…» al posto del verbo. */
  readonly meaning: BilingualText;
  /** Solo questi verbi (per kanji): dove la catena ha senso solo per alcuni. */
  readonly only?: readonly string[];
  /** Tutti tranne questi verbi (per kanji). */
  readonly except?: readonly string[];
}

/** «Voglio essere …»: chi si vuole sentir dire, chiamare, lodare. */
const PASSIVE_WISH = ['言う', '思う', '呼ぶ', '褒める'];

/**
 * «Non voglio essere …» o «non voglio che mi …»: quello che non si vuole subire
 * (見られたくない, non voglio che mi vedano; 取られたくない, che me lo prendano).
 */
const PASSIVE_AVOID = [
  '言う',
  '思う',
  '見る',
  '聞く',
  '読む',
  '書く',
  '叱る',
  '忘れる',
  '取る',
  '食べる',
  '呼ぶ',
  '使う',
  '開ける',
  'する',
];

/** «Ho … troppo»: solo quello che si può fare troppo. */
const TOO_MUCH = [
  '食べる',
  '飲む',
  '寝る',
  '働く',
  '遊ぶ',
  '買う',
  '言う',
  '考える',
  '使う',
  '歩く',
  '話す',
  '勉強する',
  '走る',
  '泳ぐ',
  '書く',
  '読む',
  '休む',
  '作る',
  '見る',
  'する',
  '電話する',
  '持つ',
  '借りる',
  '歌う',
];

/** Le ricette, dalle più corte alle più lunghe. */
export const RECIPES: readonly Recipe[] = [
  // Due pezzi.
  { id: 'tai-past', pieces: ['tai', 'past'], meaning: { it: 'volevo …', en: 'I wanted to …' } },
  { id: 'tai-negative', pieces: ['tai', 'negative'], meaning: { it: 'non voglio …', en: "I don't want to …" } },
  { id: 'tai-polite', pieces: ['tai', 'polite'], meaning: { it: 'voglio … (cortese)', en: 'I want to … (polite)' } },
  { id: 'potential-negative', pieces: ['potential', 'negative'], meaning: { it: 'non posso …', en: "I can't …" } },
  {
    id: 'potential-past',
    pieces: ['potential', 'past'],
    meaning: { it: 'ho potuto …', en: 'I was able to …' },
    // 思えた non è «ho potuto pensare».
    except: ['思う'],
  },
  { id: 'teiru-past', pieces: ['teiru', 'past'], meaning: { it: 'stavo …ndo', en: 'I was …ing' } },
  {
    id: 'teiru-negative',
    pieces: ['teiru', 'negative'],
    meaning: { it: 'non sto …ndo, non ho ancora …', en: "I'm not …ing, I haven't … yet" },
    // «Non so» è 知らない, mai 知っていない.
    except: ['知る'],
  },
  { id: 'teiru-polite-past', pieces: ['teiru', 'politePast'], meaning: { it: 'stavo …ndo (cortese)', en: 'I was …ing (polite)' } },
  { id: 'passive-past', pieces: ['passive', 'past'], meaning: { it: 'è stato … (da qualcuno)', en: 'it was …ed (by someone)' } },
  { id: 'passive-tai', pieces: ['passive', 'tai'], meaning: { it: 'voglio essere …', en: 'I want to be …ed' }, only: PASSIVE_WISH },
  { id: 'causative-past', pieces: ['causative', 'past'], meaning: { it: 'ho fatto (o lasciato) … qualcuno', en: 'I made (or let) someone …' } },
  { id: 'causative-tai', pieces: ['causative', 'tai'], meaning: { it: 'voglio far (o lasciar) …', en: 'I want to make (or let) someone …' } },
  { id: 'sugiru-past', pieces: ['sugiru', 'past'], meaning: { it: 'ho … troppo', en: 'I … too much' }, only: TOO_MUCH },
  // Tre pezzi.
  { id: 'tai-negative-past', pieces: ['tai', 'negative', 'past'], meaning: { it: 'non volevo …', en: "I didn't want to …" } },
  { id: 'tai-past-polite', pieces: ['tai', 'past', 'polite'], meaning: { it: 'volevo … (cortese)', en: 'I wanted to … (polite)' } },
  { id: 'potential-negative-past', pieces: ['potential', 'negative', 'past'], meaning: { it: 'non ho potuto …', en: "I couldn't …" } },
  {
    id: 'potential-polite-negative-past',
    pieces: ['potential', 'politeNegativePast'],
    meaning: { it: 'non ho potuto … (cortese)', en: "I couldn't … (polite)" },
  },
  { id: 'passive-negative-past', pieces: ['passive', 'negative', 'past'], meaning: { it: 'non è stato …', en: "it wasn't …ed" } },
  { id: 'passive-tai-past', pieces: ['passive', 'tai', 'past'], meaning: { it: 'volevo essere …', en: 'I wanted to be …ed' }, only: PASSIVE_WISH },
  { id: 'passive-tai-negative', pieces: ['passive', 'tai', 'negative'], meaning: { it: 'non voglio essere …, non voglio che mi …', en: "I don't want to be …ed, or to have it …ed" }, only: PASSIVE_AVOID },
  { id: 'causative-negative-past', pieces: ['causative', 'negative', 'past'], meaning: { it: 'non ho fatto (o lasciato) … nessuno', en: "I didn't make (or let) anyone …" } },
  { id: 'causative-tai-past', pieces: ['causative', 'tai', 'past'], meaning: { it: 'volevo far (o lasciar) …', en: 'I wanted to make (or let) someone …' } },
  // Quattro pezzi.
  { id: 'tai-negative-past-polite', pieces: ['tai', 'negative', 'past', 'polite'], meaning: { it: 'non volevo … (cortese)', en: "I didn't want to … (polite)" } },
  { id: 'passive-tai-past-polite', pieces: ['passive', 'tai', 'past', 'polite'], meaning: { it: 'volevo essere … (cortese)', en: 'I wanted to be …ed (polite)' }, only: PASSIVE_WISH },
  { id: 'passive-tai-negative-past', pieces: ['passive', 'tai', 'negative', 'past'], meaning: { it: 'non volevo essere …, non volevo che mi …', en: "I didn't want to be …ed, or to have it …ed" }, only: PASSIVE_AVOID },
  { id: 'causative-tai-negative-past', pieces: ['causative', 'tai', 'negative', 'past'], meaning: { it: 'non volevo far (o lasciar) …', en: "I didn't want to make (or let) anyone …" } },
];

export const RECIPE_IDS: readonly string[] = RECIPES.map((r) => r.id);

/** ませんでした conta come due pezzi: ません, poi でした. */
export function pieceCount(recipe: Recipe): number {
  return recipe.pieces.reduce((n, piece) => n + (piece === 'politeNegativePast' ? 2 : 1), 0);
}

/** Le lunghezze delle ricette, dalla più corta: le sezioni della scelta. */
export const RECIPE_LENGTHS: readonly number[] = [...new Set(RECIPES.map(pieceCount))].sort(
  (a, b) => a - b,
);

/** Se la ricetta vale per il verbo: il primo pezzo deve essere fra le sue forme. */
export function recipeFits(recipe: Recipe, verb: Verb): boolean {
  if (recipe.only && !recipe.only.includes(verb.kanji)) return false;
  if (recipe.except?.includes(verb.kanji)) return false;
  return formsOf(verb).includes(VERB_FORM[recipe.pieces[0]!]);
}

export interface Build {
  readonly verb: Verb;
  readonly recipe: Recipe;
}

/** Tutte le coppie verbo/ricetta ammesse dalla scelta di ricette e gruppi. */
export function buildPool(
  verbs: readonly Verb[],
  recipeIds: readonly string[],
  groups: readonly VerbGroup[],
): Build[] {
  const pool: Build[] = [];
  for (const recipe of RECIPES) {
    if (!recipeIds.includes(recipe.id)) continue;
    for (const verb of verbs) {
      if (groups.includes(verb.group) && recipeFits(recipe, verb)) pool.push({ verb, recipe });
    }
  }
  return pool;
}

/** L'esempio della ricetta per la scelta: con 食べる se si può, se no col primo verbo adatto. */
export function recipeExample(recipe: Recipe, verbs: readonly Verb[]): Spelling {
  const verb = verbs.find((v) => v.kanji === '食べる' && recipeFits(recipe, v)) ??
    verbs.find((v) => recipeFits(recipe, v));
  if (!verb) throw new Error(`Nessun verbo per la ricetta ${recipe.id}`);
  return buildForm(verb, recipe.pieces).result;
}
