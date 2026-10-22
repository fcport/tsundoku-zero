import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import { kanaTiles, kanaToRomaji } from '../../domain/kana';
import { enemyById, nextWord, pressTile, startBattle, type Battle } from '../../domain/kotodama';
import { BattleResult } from './BattleResult';
import { BattleView } from './BattleView';
import { KotodamaScreen } from './KotodamaScreen';
import { KOTODAMA_STORAGE_KEY, readProgress } from './kotodamaProgress';

// Ambiente `node`: `renderToStaticMarkup` non esegue eventi. Le regole del gioco
// (parole, mattoncini, danno, punti) sono provate nel dominio (kotodama.test); qui
// le tre viste alla prima resa e la lettura dei progressi.

function storage(values: Record<string, string>): Pick<Storage, 'getItem'> {
  return { getItem: (key) => values[key] ?? null };
}

/** Una battaglia vinta: ogni parola scritta giusta finché il nemico è a zero. */
function wonBattle(id: string, level: number): Battle {
  let b = startBattle(enemyById(id)!, level, () => 0.3);
  for (let i = 0; i < 60 && b.outcome === 'fighting'; i++) {
    for (const kana of kanaTiles(b.word.kana).slice(b.typed)) {
      b = pressTile(b, b.tiles.findIndex((k, j) => k === kana && !b.used[j])).battle;
    }
    b = nextWord(b, () => (i * 0.37) % 1);
  }
  return b;
}

describe('KotodamaScreen: la mappa', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('al primo avvio propone il Kodama, apre le due strade e chiude il resto', () => {
    const html = renderToStaticMarkup(<KotodamaScreen onExit={() => {}} random={() => 0} />);
    expect(html).toContain('Kotodama');
    expect(html).toContain('ひらがな');
    expect(html).toContain('カタカナ');
    expect(html).toContain('Combatti: Kodama');
    expect(html).toContain('Livello 1');
    expect(html).toContain('Ogni kana delle tue parole toglie 1 di vita al nemico.');
    // Si sfidano solo i primi delle due strade: 18 nemici, 2 aperti.
    expect(html.match(/aria-pressed=/g)).toHaveLength(18);
    expect(html.match(/>Chiuso</g)).toHaveLength(16);
    expect(html.match(/>Da battere</g)).toHaveLength(2);
  });

  it('mostra i kana nuovi di ogni nemico, e quanti ce ne sono in campo', () => {
    const html = renderToStaticMarkup(<KotodamaScreen onExit={() => {}} random={() => 0} />);
    expect(html).toContain('た ち つ て と');
    expect(html).toContain('Kana in campo: 20');
    // Coi trattini i kana nuovi sono 25: il primo di ogni fila.
    expect(html).toContain('が ざ だ ば ぱ …');
  });
});

describe('KotodamaScreen: la battaglia', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('chiede la parola in romaji, mostra il nemico e i mattoncini', () => {
    const enemy = enemyById('chochin')!;
    const html = renderToStaticMarkup(
      <BattleView enemy={enemy} level={3} random={() => 0.5} onLeave={() => {}} onEnd={() => {}} />,
    );
    const battle = startBattle(enemy, 3, () => 0.5);
    expect(html).toContain('Scrivi in hiragana');
    expect(html).toContain(kanaToRomaji(battle.word.kana));
    expect(html).toContain('Chōchin-obake');
    expect(html).toContain('Vita del nemico: 60 su 60');
    expect(html).toContain('Livello 3 · danno ×1,5');
    expect(html).toContain('Vite: 3 su 3');
    expect(html.match(/lang="ja" aria-label=/g)).toHaveLength(battle.tiles.length);
  });

  it('coi katakana lo dice', () => {
    const html = renderToStaticMarkup(
      <BattleView enemy={enemyById('zashiki')!} level={1} random={() => 0.5} onLeave={() => {}} onEnd={() => {}} />,
    );
    expect(html).toContain('Scrivi in katakana');
  });
});

describe('KotodamaScreen: l\'esito', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('a battaglia vinta: i punti, il livello nuovo, il grimorio e il prossimo nemico', () => {
    const battle = wonBattle('kodama', 1);
    expect(battle.outcome).toBe('won');
    const html = renderToStaticMarkup(
      <BattleResult
        battle={battle}
        gained={45}
        xpBefore={0}
        next={enemyById('bakezori')!}
        onNext={() => {}}
        onRematch={() => {}}
        onMap={() => {}}
      />,
    );
    expect(html).toContain('Battuto');
    expect(html).toContain('+45 punti');
    expect(html).toContain('Sei al livello 2');
    expect(html).toContain('Il grimorio');
    expect(html).toContain('Prossimo nemico: Bake-zōri');
    expect(html).toContain('Sfida di nuovo Kodama');
    expect(html.match(/<li /g)).toHaveLength(battle.casts.length);
  });

  it('a battaglia persa: i punti restano e si riprova', () => {
    const lost: Battle = { ...startBattle(enemyById('chochin')!, 1, () => 0.5), hearts: 0, struck: 3, outcome: 'lost' };
    const html = renderToStaticMarkup(
      <BattleResult battle={lost} gained={0} xpBefore={10} next={null} onNext={() => {}} onRematch={() => {}} onMap={() => {}} />,
    );
    expect(html).toContain('Ti ha battuto');
    expect(html).toContain('I punti delle parole che hai scritto restano.');
    expect(html).toContain('Riprova');
    expect(html).not.toContain('Sei al livello');
  });
});

describe('kotodamaProgress', () => {
  it('legge i progressi salvati e scarta quello che non torna', () => {
    expect(readProgress(storage({}))).toEqual({ xp: 0, wins: {} });
    expect(readProgress(storage({ [KOTODAMA_STORAGE_KEY]: 'non json' }))).toEqual({ xp: 0, wins: {} });
    expect(
      readProgress(storage({ [KOTODAMA_STORAGE_KEY]: JSON.stringify({ xp: 130.7, wins: { kodama: 2, x: 'a', y: -1 } }) })),
    ).toEqual({ xp: 130, wins: { kodama: 2 } });
  });
});
