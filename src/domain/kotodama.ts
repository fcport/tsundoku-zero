// Livello domain: KOTODAMA (言霊, «lo spirito delle parole»), il gioco dei kana
// (16-10-2026). Il tanuki mago combatte gli yokai: ogni parola scritta toccando i
// kana in ordine è un incantesimo che toglie vita al nemico. Due strade, hiragana e
// katakana: ogni nemico porta in campo una fila di kana nuova e tiene quelle di
// prima, quindi più si va avanti più kana ci sono e più il nemico resiste. Alla fine
// di ogni strada un boss con tutti i kana della strada; l'ultimo boss, 積読 (la pila
// di libri non letti), li vuole tutti.
//
// Qui le regole: quali kana e quali parole ha un nemico, i mattoncini di una parola,
// la battaglia mossa per mossa, il danno, i punti e il livello. Pura come il resto
// del dominio: il caso arriva come funzione `random` in [0, 1).
import { kanaRow, kanaTiles, lookalikes, scriptOf, type KanaRowId, type KanaScript } from './kana';
import { KOTODAMA_WORDS, type KotodamaWord } from './kotodama-words';

export type KotodamaTrack = 'hiragana' | 'katakana' | 'final';

export interface KotodamaEnemy {
  readonly id: string;
  readonly track: KotodamaTrack;
  /** Il nome giapponese dello yokai (dato, non interfaccia). */
  readonly jp: string;
  /** Il nome in lettere latine, uguale in ogni lingua. */
  readonly name: string;
  /** Le file di kana che questo nemico aggiunge a quelle dei nemici prima di lui. */
  readonly newRows: readonly KanaRowId[];
  readonly hp: number;
  readonly boss: boolean;
}

/** Le due strade, nell'ordine dei nemici, e l'ultimo boss. */
export const KOTODAMA_ENEMIES: readonly KotodamaEnemy[] = [
  { id: 'kodama', track: 'hiragana', jp: '木霊', name: 'Kodama', newRows: ['a'], hp: 15, boss: false },
  { id: 'bakezori', track: 'hiragana', jp: '化け草履', name: 'Bake-zōri', newRows: ['ka'], hp: 30, boss: false },
  { id: 'kasaobake', track: 'hiragana', jp: '唐傘お化け', name: 'Kasa-obake', newRows: ['sa'], hp: 45, boss: false },
  { id: 'chochin', track: 'hiragana', jp: '提灯お化け', name: 'Chōchin-obake', newRows: ['ta'], hp: 60, boss: false },
  { id: 'ittanmomen', track: 'hiragana', jp: '一反木綿', name: 'Ittan-momen', newRows: ['na'], hp: 75, boss: false },
  { id: 'kappa', track: 'hiragana', jp: '河童', name: 'Kappa', newRows: ['ha'], hp: 90, boss: false },
  { id: 'nurikabe', track: 'hiragana', jp: 'ぬりかべ', name: 'Nurikabe', newRows: ['ma'], hp: 105, boss: false },
  { id: 'hitotsume', track: 'hiragana', jp: '一つ目小僧', name: 'Hitotsume-kozō', newRows: ['ya', 'ra'], hp: 125, boss: false },
  { id: 'tengu', track: 'hiragana', jp: '天狗', name: 'Tengu', newRows: ['wa'], hp: 180, boss: true },
  { id: 'kitsune', track: 'hiragana', jp: '狐', name: 'Kitsune', newRows: ['dakuten'], hp: 150, boss: false },
  { id: 'oni', track: 'hiragana', jp: '鬼', name: 'Oni', newRows: ['small'], hp: 220, boss: true },
  { id: 'zashiki', track: 'katakana', jp: '座敷童子', name: 'Zashiki-warashi', newRows: ['a', 'ka', 'sa', 'long'], hp: 40, boss: false },
  { id: 'mokumokuren', track: 'katakana', jp: '目目連', name: 'Mokumokuren', newRows: ['ta', 'na'], hp: 70, boss: false },
  { id: 'yamabiko', track: 'katakana', jp: '山彦', name: 'Yamabiko', newRows: ['ha', 'ma'], hp: 100, boss: false },
  { id: 'nekomata', track: 'katakana', jp: '猫又', name: 'Nekomata', newRows: ['ya', 'ra', 'wa'], hp: 130, boss: false },
  { id: 'umibozu', track: 'katakana', jp: '海坊主', name: 'Umibōzu', newRows: ['dakuten'], hp: 160, boss: false },
  { id: 'gashadokuro', track: 'katakana', jp: 'がしゃどくろ', name: 'Gashadokuro', newRows: ['small', 'smallVowels'], hp: 240, boss: true },
  { id: 'tsundoku', track: 'final', jp: '積読', name: 'Tsundoku', newRows: [], hp: 400, boss: true },
];

export function enemyById(id: string): KotodamaEnemy | undefined {
  return KOTODAMA_ENEMIES.find((e) => e.id === id);
}

/** I nemici di una strada, nell'ordine. */
export function trackEnemies(track: KotodamaTrack): readonly KotodamaEnemy[] {
  return KOTODAMA_ENEMIES.filter((e) => e.track === track);
}

function scriptsOf(enemy: KotodamaEnemy): readonly KanaScript[] {
  return enemy.track === 'final' ? ['hiragana', 'katakana'] : [enemy.track];
}

/**
 * I kana in campo contro un nemico: le sue file nuove più quelle di tutti i nemici
 * prima di lui sulla stessa strada. L'ultimo boss li ha tutti.
 */
export function enemyKana(enemy: KotodamaEnemy): ReadonlySet<string> {
  const kana = new Set<string>();
  const enemies = enemy.track === 'final' ? KOTODAMA_ENEMIES : trackEnemies(enemy.track);
  for (const e of enemies) {
    for (const script of scriptsOf(enemy)) {
      if (e.track !== 'final' && e.track !== script) continue;
      for (const row of e.newRows) for (const k of kanaRow(script, row)) kana.add(k);
    }
    if (e.id === enemy.id) break;
  }
  return kana;
}

/** I kana NUOVI di un nemico: quelli delle file che porta lui. */
export function enemyNewKana(enemy: KotodamaEnemy): ReadonlySet<string> {
  const kana = new Set<string>();
  if (enemy.track === 'final') return kana;
  for (const row of enemy.newRows) for (const k of kanaRow(enemy.track, row)) kana.add(k);
  return kana;
}

/** Le parole che si scrivono solo coi kana in campo contro questo nemico. */
export function enemyWords(enemy: KotodamaEnemy): readonly KotodamaWord[] {
  const kana = enemyKana(enemy);
  const scripts = scriptsOf(enemy);
  return KOTODAMA_WORDS.filter(
    (w) => scripts.includes(scriptOf(w.kana)) && kanaTiles(w.kana).every((k) => kana.has(k)),
  );
}

// --- Le parole e i mattoncini ----------------------------------------------------

/** Quanti mattoncini ci sono sotto la parola: i suoi kana più quelli sbagliati. */
export const TILE_COUNT = 10;

/** Le ultime parole uscite, che per un po' non tornano. */
export const RECENT_WORDS = 8;

/** Su dieci parole, quante (circa) usano un kana nuovo del nemico. */
const NEW_KANA_SHARE = 0.65;

function pickOne<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * La prossima parola contro `enemy`: di solito una che usa i kana nuovi del nemico,
 * mai una delle ultime uscite (se ce ne sono abbastanza da scegliere).
 */
export function pickWord(
  enemy: KotodamaEnemy,
  recent: readonly string[],
  random: () => number,
): KotodamaWord {
  const all = enemyWords(enemy);
  const fresh = all.filter((w) => !recent.includes(w.kana));
  const pool = fresh.length > 0 ? fresh : all;
  const fresh_new = enemyNewKana(enemy);
  const withNew = pool.filter((w) => kanaTiles(w.kana).some((k) => fresh_new.has(k)));
  const source = withNew.length > 0 && random() < NEW_KANA_SHARE ? withNew : pool;
  return pickOne(source, random);
}

/**
 * I mattoncini per scrivere `word`: i suoi kana (anche ripetuti) più kana sbagliati
 * fino a `TILE_COUNT`, presi prima fra quelli che somigliano ai kana della parola,
 * poi fra gli altri in campo. Tutti mescolati.
 */
export function makeTiles(word: KotodamaWord, enemy: KotodamaEnemy, random: () => number): readonly string[] {
  const needed = kanaTiles(word.kana);
  const inPlay = enemyKana(enemy);
  const script = scriptOf(word.kana);
  const usable = (k: string) => inPlay.has(k) && !needed.includes(k) && scriptOf(k) === script;
  const similar = shuffle([...new Set(needed.flatMap((k) => lookalikes(k)))].filter(usable), random);
  const others = shuffle([...inPlay].filter((k) => usable(k) && !similar.includes(k)), random);
  const missing = Math.max(3, TILE_COUNT - needed.length);
  // Metà (arrotondata per eccesso) dei mattoncini sbagliati sono kana simili.
  const fromSimilar = similar.slice(0, Math.ceil(missing / 2));
  const wrong = [...fromSimilar, ...others].slice(0, missing);
  return shuffle([...needed, ...wrong], random);
}

// --- Il danno, i punti, il livello ----------------------------------------------

/** Le vite del tanuki in una battaglia. */
export const HEARTS = 3;

/** Dopo quanti sbagli il nemico colpisce il tanuki. */
export const STRIKE_AFTER = 3;

/** Il moltiplicatore del colpo critico: la parola scritta senza sbagli e senza aiuto. */
export const CRITICAL = 1.5;

/** Quanto colpisce ogni kana a questo livello: 1 al livello 1, un quarto in più per livello. */
export function power(level: number): number {
  return 1 + 0.25 * (level - 1);
}

/** Il danno di una parola di `kanaCount` kana. */
export function spellDamage(kanaCount: number, level: number, critical: boolean): number {
  return Math.max(1, Math.round(kanaCount * power(level) * (critical ? CRITICAL : 1)));
}

/** I punti che servono per arrivare al livello `level` (0 per il livello 1). */
export function xpForLevel(level: number): number {
  return 20 * level * (level - 1);
}

/** Il livello con `xp` punti. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

/** Il vestito del tanuki: apprendista, mago dal livello 5, arcimago dal 10. */
export type Outfit = 'apprentice' | 'mage' | 'archmage';

export const OUTFIT_LEVELS: Readonly<Record<Outfit, number>> = { apprentice: 1, mage: 5, archmage: 10 };

export function outfitFor(level: number): Outfit {
  return level >= OUTFIT_LEVELS.archmage ? 'archmage' : level >= OUTFIT_LEVELS.mage ? 'mage' : 'apprentice';
}

/**
 * I punti di una battaglia: un punto per ogni kana degli incantesimi lanciati, più,
 * se il nemico è battuto, la sua vita la prima volta e un quarto le volte dopo.
 */
export function battleXp(battle: Battle, firstWin: boolean): number {
  const words = battle.casts.reduce((sum, c) => sum + kanaTiles(c.word.kana).length, 0);
  if (battle.outcome !== 'won') return words;
  return words + (firstWin ? battle.enemy.hp : Math.round(battle.enemy.hp / 4));
}

// --- Chi si può sfidare --------------------------------------------------------

/**
 * Un nemico si può sfidare se è il primo della sua strada o se quello prima è stato
 * battuto. L'ultimo boss, quando i boss in fondo alle due strade sono battuti.
 */
export function isUnlocked(enemy: KotodamaEnemy, defeated: ReadonlySet<string>): boolean {
  if (enemy.track === 'final') {
    const ends = (['hiragana', 'katakana'] as const).map((t) => trackEnemies(t).at(-1)!.id);
    return ends.every((id) => defeated.has(id));
  }
  const enemies = trackEnemies(enemy.track);
  const index = enemies.findIndex((e) => e.id === enemy.id);
  return index === 0 || defeated.has(enemies[index - 1]!.id);
}

/**
 * Il nemico da proporre: il primo non ancora battuto che si può sfidare
 * (prima la strada degli hiragana), altrimenti l'ultimo boss.
 */
export function suggestedEnemy(defeated: ReadonlySet<string>): KotodamaEnemy {
  return (
    KOTODAMA_ENEMIES.find((e) => !defeated.has(e.id) && isUnlocked(e, defeated)) ??
    KOTODAMA_ENEMIES.at(-1)!
  );
}

/** Il nemico che si apre dopo `enemy` sulla sua strada (o l'ultimo boss), se c'è. */
export function nextEnemy(enemy: KotodamaEnemy): KotodamaEnemy | undefined {
  if (enemy.track === 'final') return undefined;
  const enemies = trackEnemies(enemy.track);
  return enemies[enemies.findIndex((e) => e.id === enemy.id) + 1] ?? enemyById('tsundoku');
}

// --- La battaglia ------------------------------------------------------------------

export interface Cast {
  readonly word: KotodamaWord;
  readonly damage: number;
  readonly critical: boolean;
}

export interface Battle {
  readonly enemy: KotodamaEnemy;
  readonly level: number;
  readonly hp: number;
  readonly hearts: number;
  /** Gli sbagli verso il prossimo colpo del nemico (da 0 a `STRIKE_AFTER - 1`). */
  readonly charge: number;
  readonly word: KotodamaWord;
  readonly tiles: readonly string[];
  /** Quali mattoncini sono già saliti nella parola. */
  readonly used: readonly boolean[];
  /** Quanti kana della parola sono già scritti. */
  readonly typed: number;
  /** Sbagli sulla parola di adesso: con uno solo, niente colpo critico. */
  readonly wordMistakes: number;
  /** L'aiuto chiesto sulla parola di adesso: niente colpo critico. */
  readonly hinted: boolean;
  readonly recent: readonly string[];
  readonly casts: readonly Cast[];
  readonly mistakes: number;
  /** Quante volte il nemico ha colpito il tanuki. */
  readonly struck: number;
  readonly outcome: 'fighting' | 'won' | 'lost';
}

function withWord(battle: Omit<Battle, 'word' | 'tiles' | 'used' | 'typed' | 'wordMistakes' | 'hinted'>, random: () => number): Battle {
  const word = pickWord(battle.enemy, battle.recent, random);
  const tiles = makeTiles(word, battle.enemy, random);
  return {
    ...battle,
    word,
    tiles,
    used: tiles.map(() => false),
    typed: 0,
    wordMistakes: 0,
    hinted: false,
    recent: [word.kana, ...battle.recent].slice(0, RECENT_WORDS),
  };
}

export function startBattle(enemy: KotodamaEnemy, level: number, random: () => number): Battle {
  return withWord(
    { enemy, level, hp: enemy.hp, hearts: HEARTS, charge: 0, recent: [], casts: [], mistakes: 0, struck: 0, outcome: 'fighting' },
    random,
  );
}

/** Cosa è successo toccando un mattoncino. */
export type TileEvent = 'ignored' | 'right' | 'cast' | 'wrong' | 'struck';

/**
 * Tocca il mattoncino `index`. Giusto se è il kana che viene adesso nella parola
 * (anche se è uno di due mattoncini uguali). A parola finita parte l'incantesimo: il
 * nemico perde vita e, se arriva a zero, la battaglia è vinta. Al terzo sbaglio il
 * nemico colpisce: il tanuki perde una vita, e senza vite la battaglia è persa.
 */
export function pressTile(battle: Battle, index: number): { readonly battle: Battle; readonly event: TileEvent } {
  if (battle.outcome !== 'fighting' || battle.used[index] || index < 0 || index >= battle.tiles.length) {
    return { battle, event: 'ignored' };
  }
  const expected = kanaTiles(battle.word.kana)[battle.typed];
  if (expected === undefined) return { battle, event: 'ignored' };
  if (battle.tiles[index] !== expected) {
    const charge = battle.charge + 1;
    const strikes = charge >= STRIKE_AFTER;
    const hearts = strikes ? battle.hearts - 1 : battle.hearts;
    return {
      battle: {
        ...battle,
        charge: strikes ? 0 : charge,
        hearts,
        mistakes: battle.mistakes + 1,
        wordMistakes: battle.wordMistakes + 1,
        struck: battle.struck + (strikes ? 1 : 0),
        outcome: hearts <= 0 ? 'lost' : 'fighting',
      },
      event: strikes ? 'struck' : 'wrong',
    };
  }
  const used = battle.used.map((u, i) => u || i === index);
  const typed = battle.typed + 1;
  if (typed < kanaTiles(battle.word.kana).length) {
    return { battle: { ...battle, used, typed }, event: 'right' };
  }
  const critical = battle.wordMistakes === 0 && !battle.hinted;
  const damage = spellDamage(typed, battle.level, critical);
  const hp = Math.max(0, battle.hp - damage);
  return {
    battle: {
      ...battle,
      used,
      typed,
      hp,
      casts: [...battle.casts, { word: battle.word, damage, critical }],
      outcome: hp === 0 ? 'won' : 'fighting',
    },
    event: 'cast',
  };
}

/** Dopo l'incantesimo, la parola nuova (se la battaglia continua). */
export function nextWord(battle: Battle, random: () => number): Battle {
  if (battle.outcome !== 'fighting') return battle;
  return withWord(battle, random);
}

/** L'aiuto: quale mattoncino viene adesso. La parola non farà colpo critico. */
export function hintTile(battle: Battle): { readonly battle: Battle; readonly index: number } {
  const expected = kanaTiles(battle.word.kana)[battle.typed];
  const index = battle.tiles.findIndex((k, i) => k === expected && !battle.used[i]);
  return { battle: { ...battle, hinted: true }, index };
}

/** La parola è finita: l'incantesimo è partito e si aspetta la parola nuova. */
export function wordDone(battle: Battle): boolean {
  return battle.typed >= kanaTiles(battle.word.kana).length;
}

// --- I progressi ---------------------------------------------------------------

export interface KotodamaProgress {
  /** Tutti i punti presi, da cui si legge il livello. */
  readonly xp: number;
  /** Quante volte è stato battuto ogni nemico, per id. */
  readonly wins: Readonly<Record<string, number>>;
}

export const EMPTY_PROGRESS: KotodamaProgress = { xp: 0, wins: {} };

/** I nemici battuti almeno una volta. */
export function defeatedEnemies(progress: KotodamaProgress): ReadonlySet<string> {
  return new Set(Object.keys(progress.wins).filter((id) => (progress.wins[id] ?? 0) > 0));
}

/** Registra una battaglia finita: i punti presi e, se vinta, una vittoria in più. */
export function applyBattle(
  progress: KotodamaProgress,
  battle: Battle,
): { readonly progress: KotodamaProgress; readonly gained: number; readonly firstWin: boolean } {
  const firstWin = battle.outcome === 'won' && !(progress.wins[battle.enemy.id] ?? 0);
  const gained = battleXp(battle, firstWin);
  const wins =
    battle.outcome === 'won'
      ? { ...progress.wins, [battle.enemy.id]: (progress.wins[battle.enemy.id] ?? 0) + 1 }
      : progress.wins;
  return { progress: { xp: progress.xp + gained, wins }, gained, firstWin };
}
