// Livello domain: il MOTORE DI CONIUGAZIONE dell'allenamento libero (dominio puro —
// nessun import esterno, nessun `Math.random()`: il caso arriva iniettato).
//
// L'allenamento libero sta FUORI dalla pila: nessun esercizio autorato, nessuna
// scadenza, nessun progresso salvato. Si prende un verbo, si chiede una forma, si
// controlla la risposta. Le forme sono solo quelle che il corso ha già spiegato
// (lezioni 4, 5, 7, 8, 12, 13).
//
// La coniugazione lavora sulla LETTURA in kana e ricostruisce la grafia coi kanji:
// ogni forma cambia solo la coda del verbo, salvo 来る, dove cambia la lettura del
// kanji (来ない = こない, 来ます = きます). Il risultato porta anche i PASSAGGI
// (base → radicale + terminazione → forma) e la REGOLA usata: la schermata li
// mostra dopo la risposta, così l'errore si capisce e non solo si vede.
import type { BilingualText } from './bilingual';

export type VerbGroup = 'godan' | 'ichidan' | 'irregular';

export const VERB_GROUPS: readonly VerbGroup[] = ['godan', 'ichidan', 'irregular'];

/**
 * Le forme allenabili, nell'ordine del corso. `teiru` è la forma in て più いる
 * (lezione 4); `volitional` è il volitivo semplice in よう/おう (lezione 8).
 */
export type ConjugationForm =
  | 'masu'
  | 'masen'
  | 'mashita'
  | 'nai'
  | 'nakatta'
  | 'ta'
  | 'te'
  | 'teiru'
  | 'tai'
  | 'potential'
  | 'volitional'
  | 'causative'
  | 'passive';

export const CONJUGATION_FORMS: readonly ConjugationForm[] = [
  'masu',
  'masen',
  'mashita',
  'nai',
  'nakatta',
  'ta',
  'te',
  'teiru',
  'tai',
  'potential',
  'volitional',
  'causative',
  'passive',
];

/**
 * L'etichetta giapponese di ogni forma, mostrata accanto al nome tradotto (il
 * giapponese è dato, non passa da t()).
 */
export const FORM_MARKERS: Readonly<Record<ConjugationForm, string>> = {
  masu: '〜ます',
  masen: '〜ません',
  mashita: '〜ました',
  nai: '〜ない',
  nakatta: '〜なかった',
  ta: '〜た',
  te: '〜て',
  teiru: '〜ている',
  tai: '〜たい',
  potential: '可能形',
  volitional: '〜よう',
  causative: '〜せる',
  passive: '〜れる',
};

export interface Verb {
  /** La forma del dizionario coi kanji (uguale a `kana` se si scrive in kana). */
  readonly kanji: string;
  readonly kana: string;
  readonly group: VerbGroup;
  readonly meaning: BilingualText;
  /**
   * Le sole forme che hanno senso per questo verbo (assente ⇒ tutte). ある non ha
   * un potenziale né un volitivo; 分かる e できる non hanno passivo né causativo.
   */
  readonly forms?: readonly ConjugationForm[];
}

/**
 * La regola applicata, per la spiegazione dopo la risposta. Le regole `godan-te-*`
 * valgono per て, た, ている; `godan-a|i|e|o` dicono in quale suono passa l'ultimo
 * kana; `godan-wa` è il caso di う → わ davanti a ない, せる, れる.
 */
export type ConjugationRule =
  | 'ichidan'
  | 'godan-a'
  | 'godan-wa'
  | 'godan-i'
  | 'godan-e'
  | 'godan-o'
  | 'godan-te-small-tsu'
  | 'godan-te-n'
  | 'godan-te-i'
  | 'godan-te-gi'
  | 'godan-te-shi'
  | 'iku'
  | 'aru'
  | 'suru'
  | 'kuru';

/** Una grafia doppia: coi kanji e in kana. */
export interface Spelling {
  readonly kanji: string;
  readonly kana: string;
}

export interface Conjugation {
  /** La forma giusta. */
  readonly result: Spelling;
  /**
   * Il pezzo a cui si attacca la terminazione (書き di 書きます), oppure `null`
   * quando la forma non si costruisce così (する → できる, ある → ない).
   */
  readonly stem: Spelling | null;
  /** La terminazione aggiunta (ます, ない, て…), in kana. */
  readonly ending: string;
  readonly rule: ConjugationRule;
  /**
   * Vero per i godan che sembrano ichidan (帰る, 入る, 走る: finiscono in -iru/-eru
   * ma cambiano l'ultimo kana): la trappola classica, detta a parte.
   */
  readonly looksIchidan: boolean;
}

// ---------------------------------------------------------------------------
// Le file del sillabario per l'ultimo kana dei godan.

const U_ROW = 'うくぐすつぬぶむる';
const ROWS: Readonly<Record<'a' | 'i' | 'e' | 'o', string>> = {
  a: 'わかがさたなばまら',
  i: 'いきぎしちにびみり',
  e: 'えけげせてねべめれ',
  o: 'おこごそとのぼもろ',
};

function shift(ending: string, row: keyof typeof ROWS): string {
  const index = U_ROW.indexOf(ending);
  if (index < 0) throw new Error(`Terminazione godan sconosciuta: ${ending}`);
  return ROWS[row][index]!;
}

const I_SOUNDS = 'いきぎしじちぢにひびぴみりゐ';
const E_SOUNDS = 'えけげせぜてでねへべぺめれゑ';

// ---------------------------------------------------------------------------
// La coniugazione in kana: radicale + terminazione.

interface KanaParts {
  /** Il radicale in kana, oppure `null` se la forma sostituisce l'intero verbo. */
  readonly stem: string | null;
  readonly ending: string;
  readonly rule: ConjugationRule;
}

/** La forma in て o in た di un godan: radicale e la sola て/た (o で/だ). */
function godanTe(kana: string, past: boolean): KanaParts {
  const head = kana.slice(0, -1);
  const last = kana.slice(-1);
  const [t, d] = past ? ['た', 'だ'] : ['て', 'で'];
  if (kana === 'いく') {
    return { stem: 'いっ', ending: t, rule: 'iku' };
  }
  switch (last) {
    case 'う':
    case 'つ':
    case 'る':
      return { stem: `${head}っ`, ending: t, rule: 'godan-te-small-tsu' };
    case 'む':
    case 'ぶ':
    case 'ぬ':
      return { stem: `${head}ん`, ending: d, rule: 'godan-te-n' };
    case 'く':
      return { stem: `${head}い`, ending: t, rule: 'godan-te-i' };
    case 'ぐ':
      return { stem: `${head}い`, ending: d, rule: 'godan-te-gi' };
    case 'す':
      return { stem: `${head}し`, ending: t, rule: 'godan-te-shi' };
    default:
      throw new Error(`Terminazione godan sconosciuta: ${last}`);
  }
}

/** Il radicale di un godan nella fila chiesta, con la regola che lo dice. */
function godanStem(kana: string, row: keyof typeof ROWS): Omit<KanaParts, 'ending'> {
  const last = kana.slice(-1);
  const stem = kana.slice(0, -1) + shift(last, row);
  const rule: ConjugationRule =
    row === 'a' ? (last === 'う' ? 'godan-wa' : 'godan-a') : (`godan-${row}` as const);
  return { stem, rule };
}

function conjugateGodan(kana: string, form: ConjugationForm): KanaParts {
  switch (form) {
    case 'masu':
      return { ...godanStem(kana, 'i'), ending: 'ます' };
    case 'masen':
      return { ...godanStem(kana, 'i'), ending: 'ません' };
    case 'mashita':
      return { ...godanStem(kana, 'i'), ending: 'ました' };
    case 'tai':
      return { ...godanStem(kana, 'i'), ending: 'たい' };
    case 'nai':
      if (kana === 'ある') return { stem: null, ending: 'ない', rule: 'aru' };
      return { ...godanStem(kana, 'a'), ending: 'ない' };
    case 'nakatta':
      if (kana === 'ある') return { stem: null, ending: 'なかった', rule: 'aru' };
      return { ...godanStem(kana, 'a'), ending: 'なかった' };
    case 'causative':
      return { ...godanStem(kana, 'a'), ending: 'せる' };
    case 'passive':
      return { ...godanStem(kana, 'a'), ending: 'れる' };
    case 'potential':
      return { ...godanStem(kana, 'e'), ending: 'る' };
    case 'volitional':
      return { ...godanStem(kana, 'o'), ending: 'う' };
    case 'te':
      return godanTe(kana, false);
    case 'ta':
      return godanTe(kana, true);
    case 'teiru': {
      const te = godanTe(kana, false);
      return { stem: `${te.stem}${te.ending}`, ending: 'いる', rule: te.rule };
    }
  }
}

const ICHIDAN_ENDINGS: Readonly<Record<ConjugationForm, string>> = {
  masu: 'ます',
  masen: 'ません',
  mashita: 'ました',
  nai: 'ない',
  nakatta: 'なかった',
  ta: 'た',
  te: 'て',
  teiru: 'いる',
  tai: 'たい',
  potential: 'られる',
  volitional: 'よう',
  causative: 'させる',
  passive: 'られる',
};

function conjugateIchidan(kana: string, form: ConjugationForm): KanaParts {
  // ている si legge come «forma in て + いる», come per i godan: 着て + いる.
  const stem = kana.slice(0, -1) + (form === 'teiru' ? 'て' : '');
  return { stem, ending: ICHIDAN_ENDINGS[form], rule: 'ichidan' };
}

/** する: radicale し, さ o せ a seconda della forma; il potenziale è できる. */
const SURU: Readonly<Record<ConjugationForm, KanaParts>> = {
  masu: { stem: 'し', ending: 'ます', rule: 'suru' },
  masen: { stem: 'し', ending: 'ません', rule: 'suru' },
  mashita: { stem: 'し', ending: 'ました', rule: 'suru' },
  nai: { stem: 'し', ending: 'ない', rule: 'suru' },
  nakatta: { stem: 'し', ending: 'なかった', rule: 'suru' },
  ta: { stem: 'し', ending: 'た', rule: 'suru' },
  te: { stem: 'し', ending: 'て', rule: 'suru' },
  teiru: { stem: 'して', ending: 'いる', rule: 'suru' },
  tai: { stem: 'し', ending: 'たい', rule: 'suru' },
  potential: { stem: null, ending: 'できる', rule: 'suru' },
  volitional: { stem: 'し', ending: 'よう', rule: 'suru' },
  causative: { stem: 'さ', ending: 'せる', rule: 'suru' },
  passive: { stem: 'さ', ending: 'れる', rule: 'suru' },
};

/** 来る: la vocale del kanji cambia (こ, き); la coda segue gli ichidan. */
const KURU: Readonly<Record<ConjugationForm, KanaParts>> = {
  masu: { stem: 'き', ending: 'ます', rule: 'kuru' },
  masen: { stem: 'き', ending: 'ません', rule: 'kuru' },
  mashita: { stem: 'き', ending: 'ました', rule: 'kuru' },
  nai: { stem: 'こ', ending: 'ない', rule: 'kuru' },
  nakatta: { stem: 'こ', ending: 'なかった', rule: 'kuru' },
  ta: { stem: 'き', ending: 'た', rule: 'kuru' },
  te: { stem: 'き', ending: 'て', rule: 'kuru' },
  teiru: { stem: 'きて', ending: 'いる', rule: 'kuru' },
  tai: { stem: 'き', ending: 'たい', rule: 'kuru' },
  potential: { stem: 'こ', ending: 'られる', rule: 'kuru' },
  volitional: { stem: 'こ', ending: 'よう', rule: 'kuru' },
  causative: { stem: 'こ', ending: 'させる', rule: 'kuru' },
  passive: { stem: 'こ', ending: 'られる', rule: 'kuru' },
};

// ---------------------------------------------------------------------------
// Dalla lettura alla grafia coi kanji.

/**
 * Divide il verbo in «testa» (la parte coi kanji) e coda in kana comune alle due
 * grafie: 書く/かく ⇒ 書/か; 勉強する/べんきょうする ⇒ 勉強/べんきょう + する.
 */
function splitHead(verb: Verb, tailLength: number): { kanjiHead: string; kanaHead: string } {
  return {
    kanjiHead: verb.kanji.slice(0, verb.kanji.length - tailLength),
    kanaHead: verb.kana.slice(0, verb.kana.length - tailLength),
  };
}

/** Riporta sulla grafia coi kanji un pezzo in kana che comincia con la testa. */
function toKanji(verb: Verb, kanaPiece: string, tailLength: number): string {
  const { kanjiHead, kanaHead } = splitHead(verb, tailLength);
  if (!kanaPiece.startsWith(kanaHead)) return kanaPiece;
  return kanjiHead + kanaPiece.slice(kanaHead.length);
}

/**
 * La forma `form` di `verb`. PURA e totale sulle forme ammesse dal verbo; una forma
 * esclusa da `verb.forms` è un errore del chiamante (la scelta della domanda le
 * scarta prima).
 */
export function conjugate(verb: Verb, form: ConjugationForm): Conjugation {
  const looksIchidan =
    verb.group === 'godan' &&
    verb.kana.endsWith('る') &&
    verb.kana.length >= 2 &&
    (I_SOUNDS.includes(verb.kana.at(-2)!) || E_SOUNDS.includes(verb.kana.at(-2)!));

  if (verb.group === 'irregular' && verb.kana.endsWith('くる')) {
    // 来る (anche in composti come 持って来る): il kanji resta, cambia la lettura.
    const parts = KURU[form];
    const kanjiPrefix = verb.kanji.slice(0, verb.kanji.length - 2);
    const kanaPrefix = verb.kana.slice(0, verb.kana.length - 2);
    const kanjiStem = `${kanjiPrefix}来${parts.stem!.slice(1)}`;
    const kanaStem = `${kanaPrefix}${parts.stem!}`;
    return {
      result: { kanji: kanjiStem + parts.ending, kana: kanaStem + parts.ending },
      stem: { kanji: kanjiStem, kana: kanaStem },
      ending: parts.ending,
      rule: 'kuru',
      looksIchidan: false,
    };
  }

  if (verb.group === 'irregular') {
    // する e i composti con する (勉強する): la testa resta, する si coniuga.
    const parts = SURU[form];
    const kanjiPrefix = verb.kanji.slice(0, verb.kanji.length - 2);
    const kanaPrefix = verb.kana.slice(0, verb.kana.length - 2);
    const stem =
      parts.stem === null && kanjiPrefix === ''
        ? null
        : {
            kanji: kanjiPrefix + (parts.stem ?? ''),
            kana: kanaPrefix + (parts.stem ?? ''),
          };
    return {
      result: {
        kanji: kanjiPrefix + (parts.stem ?? '') + parts.ending,
        kana: kanaPrefix + (parts.stem ?? '') + parts.ending,
      },
      stem,
      ending: parts.ending,
      rule: 'suru',
      looksIchidan: false,
    };
  }

  const parts =
    verb.group === 'ichidan' ? conjugateIchidan(verb.kana, form) : conjugateGodan(verb.kana, form);
  // La coda in kana comune alle due grafie: l'ultimo kana per i godan (書|く), る
  // per gli ichidan (食べ|る); tutto il verbo se si scrive solo in kana.
  const tailLength = verb.kanji === verb.kana ? verb.kana.length : 1;
  const kanaResult = (parts.stem ?? '') + parts.ending;
  return {
    result: { kanji: toKanji(verb, kanaResult, tailLength), kana: kanaResult },
    stem:
      parts.stem === null
        ? null
        : { kanji: toKanji(verb, parts.stem, tailLength), kana: parts.stem },
    ending: parts.ending,
    rule: parts.rule,
    looksIchidan,
  };
}

// ---------------------------------------------------------------------------
// La domanda e il controllo della risposta.

export interface Drill {
  readonly verb: Verb;
  readonly form: ConjugationForm;
}

/** Le forme ammesse da un verbo. */
export function formsOf(verb: Verb): readonly ConjugationForm[] {
  return verb.forms ?? CONJUGATION_FORMS;
}

/** Tutte le coppie verbo/forma ammesse dalla scelta di forme e gruppi. */
export function drillPool(
  verbs: readonly Verb[],
  forms: readonly ConjugationForm[],
  groups: readonly VerbGroup[],
): Drill[] {
  const pool: Drill[] = [];
  for (const verb of verbs) {
    if (!groups.includes(verb.group)) continue;
    for (const form of formsOf(verb)) {
      if (forms.includes(form)) pool.push({ verb, form });
    }
  }
  return pool;
}

/**
 * La prossima domanda. `random` restituisce un numero in [0, 1) ed è iniettato
 * (il dominio non tira dadi da sé). Evita lo stesso verbo della domanda prima
 * quando c'è altro da scegliere. `null` ⇒ la scelta non lascia nessuna domanda.
 */
export function pickDrill(
  pool: readonly Drill[],
  random: () => number,
  previous: Drill | null = null,
): Drill | null {
  const fresh = previous ? pool.filter((d) => d.verb !== previous.verb) : pool;
  const from = fresh.length > 0 ? fresh : pool;
  if (from.length === 0) return null;
  const index = Math.min(from.length - 1, Math.floor(random() * from.length));
  return from[index]!;
}

/** Katakana → hiragana: chi scrive カキマス con la tastiera giapponese non sbaglia. */
function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

/** La risposta ripulita: niente spazi, romaji convertito, katakana in hiragana. */
export function normalizeAnswer(input: string): string {
  // `\s` comprende anche lo spazio a tutta larghezza della tastiera giapponese.
  return toHiragana(romajiToKana(input.replace(/\s/g, ''), true));
}

/** Giusta se coincide con la forma in kana o con quella coi kanji. */
export function isCorrectAnswer(input: string, conjugation: Conjugation): boolean {
  const answer = normalizeAnswer(input);
  if (answer === '') return false;
  return answer === conjugation.result.kana || answer === conjugation.result.kanji;
}

// ---------------------------------------------------------------------------
// Romaji → hiragana, per scrivere senza la tastiera giapponese.

const ROMAJI: Readonly<Record<string, string>> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ',
  za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を', "n'": 'ん',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ', she: 'しぇ',
  sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', je: 'じぇ',
  jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
  zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', che: 'ちぇ',
  tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
  la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
  xtu: 'っ', ltu: 'っ', xtsu: 'っ', ltsu: 'っ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ',
  '-': 'ー',
};

const VOWELS = 'aeiou';

/**
 * Converte il romaji in hiragana lasciando intatto tutto il resto (kana, kanji).
 * Hepburn e kunrei insieme (shi/si, tsu/tu, ji/zi); consonante doppia ⇒ っ;
 * «n» davanti a consonante ⇒ ん. Mentre si scrive (`final` falso) una «n» o una
 * sillaba a metà in fondo restano in lettere: diventano kana alla lettera dopo.
 * A risposta data (`final` vero) la «n» finale diventa ん.
 */
export function romajiToKana(input: string, final = false): string {
  const text = input.toLowerCase();
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    const next = text[i + 1];
    // Consonante doppia (kka, tte, cchi): piccola っ, la seconda resta per la sillaba.
    if (next === ch && /[bcdfghjklmpqrstvwxyz]/.test(ch) && ch !== 'n') {
      out += 'っ';
      i += 1;
      continue;
    }
    if (ch === 't' && next === 'c' && text[i + 2] === 'h') {
      out += 'っ';
      i += 1;
      continue;
    }
    let matched = false;
    for (const length of [4, 3, 2, 1]) {
      const piece = text.slice(i, i + length);
      const kana = ROMAJI[piece];
      if (kana !== undefined) {
        out += kana;
        i += length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (ch === 'n') {
      // «nn» non seguita da vocale ⇒ una sola ん (honn ⇒ ほん, ma konnichi ⇒ こんにち).
      const after = text[i + 2];
      if (next === 'n' && (after === undefined || !(VOWELS.includes(after) || after === 'y'))) {
        out += 'ん';
        i += 2;
        continue;
      }
      // «n» davanti a consonante (non y) ⇒ ん; in fondo resta finché non si sa.
      if (next === undefined) {
        out += final ? 'ん' : 'n';
      } else if (!VOWELS.includes(next) && next !== 'y' && /[a-z]/.test(next)) {
        out += 'ん';
      } else {
        out += 'n';
      }
      i += 1;
      continue;
    }
    // Una lettera che non fa ancora sillaba (k, sh, ch…) o qualunque altro
    // carattere (kana già scritti, kanji) passa così com'è.
    out += input[i]!;
    i += 1;
  }
  return out;
}
