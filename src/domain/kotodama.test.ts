import { describe, expect, it } from 'vitest';
import { kanaTiles, scriptOf } from './kana';
import {
  EMPTY_PROGRESS,
  HEARTS,
  KOTODAMA_ENEMIES,
  STRIKE_AFTER,
  TILE_COUNT,
  applyBattle,
  battleXp,
  defeatedEnemies,
  enemyById,
  enemyKana,
  enemyNewKana,
  enemyWords,
  hintTile,
  isUnlocked,
  levelForXp,
  makeTiles,
  nextEnemy,
  nextWord,
  outfitFor,
  pickWord,
  power,
  pressTile,
  spellDamage,
  startBattle,
  suggestedEnemy,
  trackEnemies,
  wordDone,
  xpForLevel,
  type Battle,
} from './kotodama';
import { KOTODAMA_WORDS } from './kotodama-words';

/** Un caso ripetibile: una sequenza pseudo-casuale fissa. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const enemy = (id: string) => enemyById(id)!;

/** Tocca in ordine i mattoncini giusti della parola di adesso. */
function spell(battle: Battle): Battle {
  let b = battle;
  for (const kana of kanaTiles(b.word.kana).slice(b.typed)) {
    const index = b.tiles.findIndex((k, i) => k === kana && !b.used[i]);
    b = pressTile(b, index).battle;
  }
  return b;
}

/** Un mattoncino sbagliato per la parola di adesso. */
function wrongIndex(battle: Battle): number {
  const expected = kanaTiles(battle.word.kana)[battle.typed];
  return battle.tiles.findIndex((k) => k !== expected);
}

describe('kotodama: le parole', () => {
  it('nessuna parola doppia, ogni parola è tutta hiragana o tutta katakana', () => {
    const kana = KOTODAMA_WORDS.map((w) => w.kana);
    expect(new Set(kana).size).toBe(kana.length);
    for (const w of KOTODAMA_WORDS) {
      const pattern = scriptOf(w.kana) === 'katakana' ? /^[ァ-ー]+$/ : /^[ぁ-ゖ]+$/;
      expect(w.kana, w.kana).toMatch(pattern);
      expect(w.meaning.it, w.kana).toBeTruthy();
    }
  });

  it('ogni parola si può usare contro almeno un nemico prima dell\'ultimo boss', () => {
    const usable = new Set(
      KOTODAMA_ENEMIES.filter((e) => e.track !== 'final').flatMap((e) => enemyWords(e).map((w) => w.kana)),
    );
    expect(KOTODAMA_WORDS.filter((w) => !usable.has(w.kana)).map((w) => w.kana)).toEqual([]);
  });

  it('ogni nemico ha almeno 12 parole, e almeno 12 coi suoi kana nuovi', () => {
    for (const e of KOTODAMA_ENEMIES) {
      const words = enemyWords(e);
      expect(words.length, e.id).toBeGreaterThanOrEqual(12);
      if (e.track === 'final') continue;
      const fresh = enemyNewKana(e);
      const withNew = words.filter((w) => kanaTiles(w.kana).some((k) => fresh.has(k)));
      expect(withNew.length, e.id).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('kotodama: i nemici', () => {
  it('più si va avanti su una strada, più kana ci sono in campo e più vita ha il nemico', () => {
    for (const track of ['hiragana', 'katakana'] as const) {
      const enemies = trackEnemies(track);
      for (let i = 1; i < enemies.length; i++) {
        expect(enemyKana(enemies[i]!).size, enemies[i]!.id).toBeGreaterThan(enemyKana(enemies[i - 1]!).size);
      }
      expect(enemies.at(-1)!.boss).toBe(true);
    }
  });

  it('il primo nemico ha solo あいうえお, il Tengu tutti i 46 hiragana di base', () => {
    expect([...enemyKana(enemy('kodama'))]).toEqual(['あ', 'い', 'う', 'え', 'お']);
    expect(enemyKana(enemy('tengu')).size).toBe(46);
    expect(enemyKana(enemy('oni')).size).toBe(75);
  });

  it('l\'ultimo boss ha tutti i kana delle due strade', () => {
    const all = enemyKana(enemy('tsundoku'));
    expect(all.size).toBe(enemyKana(enemy('oni')).size + enemyKana(enemy('gashadokuro')).size);
  });

  it('si sfida il primo di ogni strada, poi uno dopo l\'altro; l\'ultimo boss dopo i due boss in fondo', () => {
    const none = new Set<string>();
    expect(isUnlocked(enemy('kodama'), none)).toBe(true);
    expect(isUnlocked(enemy('zashiki'), none)).toBe(true);
    expect(isUnlocked(enemy('bakezori'), none)).toBe(false);
    expect(isUnlocked(enemy('bakezori'), new Set(['kodama']))).toBe(true);
    expect(isUnlocked(enemy('tsundoku'), new Set(['oni']))).toBe(false);
    expect(isUnlocked(enemy('tsundoku'), new Set(['oni', 'gashadokuro']))).toBe(true);
  });

  it('propone il primo nemico non battuto, prima sulla strada degli hiragana', () => {
    expect(suggestedEnemy(new Set()).id).toBe('kodama');
    expect(suggestedEnemy(new Set(['kodama', 'bakezori'])).id).toBe('kasaobake');
    const hiragana = trackEnemies('hiragana').map((e) => e.id);
    expect(suggestedEnemy(new Set(hiragana)).id).toBe('zashiki');
    expect(nextEnemy(enemy('kodama'))?.id).toBe('bakezori');
    expect(nextEnemy(enemy('oni'))?.id).toBe('tsundoku');
    expect(nextEnemy(enemy('tsundoku'))).toBeUndefined();
  });
});

describe('kotodama: parole e mattoncini', () => {
  it('la parola usa solo i kana in campo e non ripete le ultime uscite', () => {
    const random = seeded(7);
    const recent: string[] = [];
    for (let i = 0; i < 30; i++) {
      const word = pickWord(enemy('chochin'), recent, random);
      const inPlay = enemyKana(enemy('chochin'));
      expect(kanaTiles(word.kana).every((k) => inPlay.has(k))).toBe(true);
      expect(recent.slice(0, 8)).not.toContain(word.kana);
      recent.unshift(word.kana);
    }
  });

  it('i mattoncini contengono la parola, sono dieci, e gli sbagliati sono in campo e nella stessa scrittura', () => {
    const random = seeded(3);
    for (const id of ['kodama', 'chochin', 'oni', 'zashiki', 'gashadokuro', 'tsundoku']) {
      for (let i = 0; i < 20; i++) {
        const e = enemy(id);
        const word = pickWord(e, [], random);
        const tiles = makeTiles(word, e, random);
        const needed = kanaTiles(word.kana);
        // Col primo nemico i kana in campo sono solo cinque: i mattoncini sono quelli che ci sono.
        const available = [...enemyKana(e)].filter((k) => !needed.includes(k) && scriptOf(k) === scriptOf(word.kana));
        expect(tiles.length, word.kana).toBe(
          needed.length + Math.min(available.length, Math.max(3, TILE_COUNT - needed.length)),
        );
        const rest = [...tiles];
        for (const k of needed) rest.splice(rest.indexOf(k), 1);
        expect(rest.every((k) => !needed.includes(k) && enemyKana(e).has(k) && scriptOf(k) === scriptOf(word.kana))).toBe(true);
      }
    }
  });
});

describe('kotodama: danno, punti, livello', () => {
  it('ogni livello aggiunge un quarto di danno; il colpo critico ne aggiunge metà', () => {
    expect(power(1)).toBe(1);
    expect(power(3)).toBe(1.5);
    expect(spellDamage(4, 1, false)).toBe(4);
    expect(spellDamage(4, 3, false)).toBe(6);
    expect(spellDamage(4, 3, true)).toBe(9);
  });

  it('i punti per livello crescono, e il livello si legge dai punti', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(40);
    expect(xpForLevel(3)).toBe(120);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(39)).toBe(1);
    expect(levelForXp(40)).toBe(2);
    expect(levelForXp(400)).toBe(5);
  });

  it('il vestito cambia ai livelli 5 e 10', () => {
    expect(outfitFor(4)).toBe('apprentice');
    expect(outfitFor(5)).toBe('mage');
    expect(outfitFor(10)).toBe('archmage');
  });
});

describe('kotodama: la battaglia', () => {
  it('scrivere la parola giusta lancia l\'incantesimo: critico senza sbagli', () => {
    const start = startBattle(enemy('chochin'), 3, seeded(5));
    const after = spell(start);
    const length = kanaTiles(start.word.kana).length;
    expect(wordDone(after)).toBe(true);
    expect(after.casts).toHaveLength(1);
    expect(after.casts[0]).toMatchObject({ critical: true, damage: spellDamage(length, 3, true) });
    expect(after.hp).toBe(enemy('chochin').hp - spellDamage(length, 3, true));
    const next = nextWord(after, seeded(9));
    expect(next.typed).toBe(0);
    expect(next.used.every((u) => !u)).toBe(true);
  });

  it('uno sbaglio o l\'aiuto tolgono il colpo critico', () => {
    const start = startBattle(enemy('chochin'), 1, seeded(5));
    const wrong = pressTile(start, wrongIndex(start));
    expect(wrong.event).toBe('wrong');
    expect(spell(wrong.battle).casts[0]!.critical).toBe(false);
    const hint = hintTile(start);
    expect(hint.battle.tiles[hint.index]).toBe(kanaTiles(start.word.kana)[0]);
    expect(spell(hint.battle).casts[0]!.critical).toBe(false);
  });

  it('un mattoncino già usato non conta', () => {
    const start = startBattle(enemy('chochin'), 1, seeded(5));
    const first = start.tiles.indexOf(kanaTiles(start.word.kana)[0]!);
    const once = pressTile(start, first).battle;
    expect(pressTile(once, first).event).toBe('ignored');
  });

  it('al terzo sbaglio il nemico colpisce; senza vite la battaglia è persa', () => {
    let b = startBattle(enemy('chochin'), 1, seeded(5));
    const events: string[] = [];
    for (let i = 0; i < STRIKE_AFTER * HEARTS; i++) {
      const r = pressTile(b, wrongIndex(b));
      events.push(r.event);
      b = r.battle;
    }
    expect(events.filter((e) => e === 'struck')).toHaveLength(HEARTS);
    expect(b.hearts).toBe(0);
    expect(b.outcome).toBe('lost');
    expect(pressTile(b, 0).event).toBe('ignored');
  });

  it('a vita zero la battaglia è vinta, e i punti contano la vita del nemico', () => {
    let b = startBattle(enemy('kodama'), 1, seeded(11));
    for (let i = 0; i < 50 && b.outcome === 'fighting'; i++) b = nextWord(spell(b), seeded(i + 2));
    expect(b.outcome).toBe('won');
    expect(b.hp).toBe(0);
    const kana = b.casts.reduce((s, c) => s + kanaTiles(c.word.kana).length, 0);
    expect(battleXp(b, true)).toBe(kana + enemy('kodama').hp);
    expect(battleXp(b, false)).toBe(kana + Math.round(enemy('kodama').hp / 4));
  });

  it('a un livello più alto lo stesso nemico cade con meno incantesimi', () => {
    const fight = (level: number) => {
      let b = startBattle(enemy('kasaobake'), level, seeded(4));
      for (let i = 0; i < 100 && b.outcome === 'fighting'; i++) b = nextWord(spell(b), seeded(i + 2));
      return b.casts.length;
    };
    expect(fight(5)).toBeLessThan(fight(1));
  });
});

describe('kotodama: i progressi', () => {
  it('una vittoria conta la vita del nemico la prima volta, poi un quarto', () => {
    let b = startBattle(enemyById('kodama')!, 1, seeded(11));
    for (let i = 0; i < 50 && b.outcome === 'fighting'; i++) b = nextWord(spell(b), seeded(i + 2));
    const first = applyBattle(EMPTY_PROGRESS, b);
    expect(first.firstWin).toBe(true);
    expect(first.progress.wins).toEqual({ kodama: 1 });
    expect(defeatedEnemies(first.progress)).toEqual(new Set(['kodama']));
    const again = applyBattle(first.progress, b);
    expect(again.firstWin).toBe(false);
    expect(again.gained).toBeLessThan(first.gained);
    expect(again.progress.xp).toBe(first.gained + again.gained);
  });

  it('una sconfitta lascia i punti delle parole ma non conta come vittoria', () => {
    let b = startBattle(enemyById('chochin')!, 1, seeded(5));
    b = nextWord(spell(b), seeded(3));
    for (let i = 0; i < STRIKE_AFTER * HEARTS; i++) b = pressTile(b, wrongIndex(b)).battle;
    const result = applyBattle(EMPTY_PROGRESS, b);
    expect(result.progress.wins).toEqual({});
    expect(result.gained).toBe(kanaTiles(b.casts[0]!.word.kana).length);
  });
});
