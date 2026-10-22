// Livello features/kotodama: KOTODAMA (言霊), il gioco dei kana col tanuki mago
// (16-10-2026). Tre viste: la MAPPA dei nemici (le due strade, hiragana e katakana,
// e l'ultimo boss; a sinistra il tanuki col suo livello), la BATTAGLIA e l'ESITO.
// Fuori dalla pila come l'allenamento: i progressi (punti e nemici battuti) stanno
// sul dispositivo. Le regole sono del dominio (`kotodama.ts`); la navigazione arriva
// come callback (AD-1).
import { useMemo, useState } from 'react';
import { kanaRow } from '../../domain/kana';
import {
  KOTODAMA_ENEMIES,
  OUTFIT_LEVELS,
  applyBattle,
  defeatedEnemies,
  enemyById,
  enemyKana,
  enemyNewKana,
  isUnlocked,
  levelForXp,
  nextEnemy,
  outfitFor,
  suggestedEnemy,
  trackEnemies,
  xpForLevel,
  type Battle,
  type KotodamaEnemy,
  type Outfit,
} from '../../domain/kotodama';
import { resolveLocale, useTranslation } from '../../i18n';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { Masthead } from '../../ui/Masthead';
import { ArrowIcon } from '../../ui/icons';
import { FOCUS_RING, HEADLINE, KICKER, STICKY_ACTION_BAR } from '../../ui/magazine';
import { BattleResult } from './BattleResult';
import { BattleView, formatPower } from './BattleView';
import { TanukiWizard } from './kotodamaArt';
import { readProgress, saveProgress } from './kotodamaProgress';

export interface KotodamaScreenProps {
  /** Il ritorno alla dashboard, cablato dal livello app. */
  readonly onExit: () => void;
  /** Il caso, in [0, 1). Iniettabile per i test; predefinito `Math.random`. */
  readonly random?: () => number;
}

type View =
  | { readonly kind: 'map' }
  | { readonly kind: 'battle'; readonly enemy: KotodamaEnemy; readonly run: number }
  | { readonly kind: 'result'; readonly battle: Battle; readonly gained: number; readonly xpBefore: number };

/** Il nome della strada, in giapponese (dato, non interfaccia). */
const TRACK_LABEL = { hiragana: 'ひらがな', katakana: 'カタカナ' } as const;

const OUTFITS: readonly Outfit[] = ['apprentice', 'mage', 'archmage'];

/**
 * I kana nuovi di un nemico, per la riga della mappa: tutti se sono pochi,
 * altrimenti il primo di ogni fila (が ざ だ ば ぱ per i trattini).
 */
function newKanaPreview(enemy: KotodamaEnemy): string {
  const fresh = [...enemyNewKana(enemy)];
  if (fresh.length <= 10) return fresh.join(' ');
  const script = enemy.track === 'katakana' ? 'katakana' : 'hiragana';
  const heads = enemy.newRows.flatMap((row) => {
    const kana = kanaRow(script, row);
    return row === 'dakuten' ? kana.filter((_, i) => i % 5 === 0) : kana.slice(0, 1);
  });
  return `${heads.join(' ')} …`;
}

export function KotodamaScreen({ onExit, random = Math.random }: KotodamaScreenProps) {
  const [progress, setProgress] = useState(() => readProgress());
  const defeated = useMemo(() => defeatedEnemies(progress), [progress]);
  const [selectedId, setSelectedId] = useState(() => suggestedEnemy(defeatedEnemies(progress)).id);
  const [view, setView] = useState<View>({ kind: 'map' });
  const level = levelForXp(progress.xp);
  const selected = enemyById(selectedId) ?? KOTODAMA_ENEMIES[0]!;

  const fight = (enemy: KotodamaEnemy) => {
    setSelectedId(enemy.id);
    setView((v) => ({ kind: 'battle', enemy, run: (v.kind === 'battle' ? v.run : 0) + 1 }));
  };

  const end = (battle: Battle) => {
    const result = applyBattle(progress, battle);
    saveProgress(result.progress);
    setProgress(result.progress);
    setView({ kind: 'result', battle, gained: result.gained, xpBefore: progress.xp });
  };

  let content;
  if (view.kind === 'battle') {
    content = (
      <BattleView
        key={view.run}
        enemy={view.enemy}
        level={level}
        random={random}
        onLeave={() => setView({ kind: 'map' })}
        onEnd={end}
      />
    );
  } else if (view.kind === 'result') {
    const following = view.battle.outcome === 'won' ? nextEnemy(view.battle.enemy) : undefined;
    const next = following && isUnlocked(following, defeated) ? following : null;
    content = (
      <BattleResult
        battle={view.battle}
        gained={view.gained}
        xpBefore={view.xpBefore}
        next={next}
        onNext={() => next && fight(next)}
        onRematch={() => fight(view.battle.enemy)}
        onMap={() => {
          setSelectedId(suggestedEnemy(defeated).id);
          setView({ kind: 'map' });
        }}
      />
    );
  } else {
    content = (
      <EnemyMap
        xp={progress.xp}
        wins={progress.wins}
        defeated={defeated}
        selected={selected}
        onSelect={setSelectedId}
        onFight={() => fight(selected)}
        onExit={onExit}
      />
    );
  }

  return <MagazineFrame furiganaToggle>{content}</MagazineFrame>;
}

/** La mappa: il tanuki col suo livello, le due strade di nemici, l'ultimo boss. */
function EnemyMap({
  xp,
  wins,
  defeated,
  selected,
  onSelect,
  onFight,
  onExit,
}: {
  readonly xp: number;
  readonly wins: Readonly<Record<string, number>>;
  readonly defeated: ReadonlySet<string>;
  readonly selected: KotodamaEnemy;
  readonly onSelect: (id: string) => void;
  readonly onFight: () => void;
  readonly onExit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const level = levelForXp(xp);
  const outfit = outfitFor(level);
  const span = xpForLevel(level + 1) - xpForLevel(level);
  const progress = Math.round(((xp - xpForLevel(level)) / span) * 100);
  const final = KOTODAMA_ENEMIES.at(-1)!;

  const row = (enemy: KotodamaEnemy, n: number) => {
    const unlocked = isUnlocked(enemy, defeated);
    const isSelected = enemy.id === selected.id;
    const times = wins[enemy.id] ?? 0;
    const status = !unlocked
      ? t('kotodama.locked')
      : times > 1
        ? t('kotodama.defeatedTimes', { value: times })
        : times === 1
          ? t('kotodama.defeated')
          : t('kotodama.open');
    return (
      <li key={enemy.id}>
        <button
          type="button"
          onClick={() => onSelect(enemy.id)}
          disabled={!unlocked}
          aria-pressed={isSelected}
          className={`grid min-h-[52px] w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border-hairline px-5 py-1.5 text-left sm:px-6 ${FOCUS_RING} ${
            isSelected
              ? 'bg-ink-primary text-surface-base'
              : unlocked
                ? 'text-ink-primary hover:bg-surface-sunken'
                : 'text-ink-muted'
          }`}
        >
          <span className="font-mono text-label">{n > 0 ? String(n).padStart(2, '0') : ''}</span>
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-baseline gap-2">
              <span lang="ja" className="shrink-0 font-jp text-[17px] font-bold">
                {enemy.jp}
              </span>
              <span className="truncate text-label font-bold">{enemy.name}</span>
              {enemy.boss ? (
                <span className="shrink-0 bg-accent px-1.5 font-mono text-[10px] uppercase text-surface-raised">
                  {t('kotodama.boss')}
                </span>
              ) : null}
            </span>
            <span className={`truncate text-[12px] ${isSelected ? 'text-surface-sunken' : 'text-ink-secondary'}`}>
              {enemy.track === 'final' ? null : (
                <>
                  <span lang="ja">{newKanaPreview(enemy)}</span> ·{' '}
                </>
              )}
              {t('kotodama.kanaInPlay', { value: enemyKana(enemy).size })}
            </span>
          </span>
          <span className="text-right text-[12px] font-bold">
            {status}
            {!unlocked ? <span className="sr-only"> · {t('kotodama.lockedHint')}</span> : null}
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <Masthead
        start={
          <button
            type="button"
            onClick={onExit}
            className={`flex min-h-[44px] items-center gap-2 uppercase hover:underline ${FOCUS_RING}`}
          >
            <ArrowIcon className="rotate-180" />
            {t('kotodama.back')}
          </button>
        }
      />
      <main className="flex flex-1 flex-col">
        <div className="grid flex-1 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)_minmax(0,1fr)]">
          {/* Il tanuki: il livello, quanto colpisce, il vestito. */}
          <section className="flex flex-col gap-5 border-b-[1.5px] border-border-strong p-5 sm:p-8 lg:border-b-0 lg:border-r-[1.5px]">
            <div className="flex flex-col gap-3">
              <p className={KICKER}>
                <span lang="ja">言霊</span> · {t('kotodama.kicker')}
              </p>
              <h2 className={`${HEADLINE} text-[48px] leading-[0.9] font-stretch-extra-condensed text-ink-primary`}>
                {t('kotodama.title')}
              </h2>
              <p className="text-body text-ink-secondary">{t('kotodama.intro')}</p>
            </div>
            <div className="flex items-end gap-4">
              <TanukiWizard outfit={outfit} pose="idle" height={120} />
              <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
                <p className="font-sans text-[40px] font-extrabold leading-none font-stretch-condensed text-ink-primary">
                  {t('kotodama.level', { level })}
                </p>
                <div aria-hidden="true" className="h-3 border-[1.5px] border-ink-primary bg-surface-raised">
                  <div className="h-full bg-ink-primary" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-label text-ink-secondary">
                  {t('kotodama.xpToNext', { left: xpForLevel(level + 1) - xp, next: level + 1 })}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-label text-ink-secondary">
              <p className="font-semibold text-ink-primary">
                {t('kotodama.powerLine', { power: formatPower(level, locale) })}
              </p>
              <p>{t('kotodama.criticalLine')}</p>
              <p>{t('kotodama.xpHow')}</p>
            </div>
            <div className="flex flex-col gap-2 border-t-[1.5px] border-border-strong pt-4">
              <p className={KICKER}>{t('kotodama.outfitHeading')}</p>
              <ul className="flex flex-col gap-1.5">
                {OUTFITS.map((o) => (
                  <li
                    key={o}
                    className={`flex items-baseline justify-between gap-3 text-label ${o === outfit ? 'font-bold text-ink-primary' : 'text-ink-secondary'}`}
                  >
                    <span>{t(`kotodama.outfits.${o}`)}</span>
                    <span className="shrink-0 font-mono text-[12px]">
                      {o === outfit ? t('kotodama.outfitNow') : t('kotodama.outfitAt', { level: OUTFIT_LEVELS[o] })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {(['hiragana', 'katakana'] as const).map((track) => (
            <section
              key={track}
              className="flex flex-col border-b-[1.5px] border-border-strong lg:border-b-0 lg:border-r-[1.5px] lg:last:border-r-0"
            >
              <div className="flex items-baseline justify-between gap-3 border-b-[1.5px] border-border-strong px-5 py-4 sm:px-6">
                <h3 lang="ja" className="font-jp text-[26px] font-extrabold text-ink-primary">
                  {TRACK_LABEL[track]}
                </h3>
                <p className="font-mono text-label text-ink-secondary">
                  {t('kotodama.enemiesLabel', { value: trackEnemies(track).length })}
                </p>
              </div>
              <ol>{trackEnemies(track).map((enemy, i) => row(enemy, i + 1))}</ol>
              {/* L'ultimo boss, in fondo alla strada più corta: tutti i kana. */}
              {track === 'katakana' ? (
                <div className="mt-auto border-t-[1.5px] border-border-strong pt-3 lg:mt-6">
                  <p className={`px-5 sm:px-6 ${KICKER}`}>{t('kotodama.finalKicker')}</p>
                  <ol>{row(final, 0)}</ol>
                  <p className="px-5 py-3 text-label text-ink-secondary sm:px-6">{t('kotodama.finalBody')}</p>
                </div>
              ) : null}
            </section>
          ))}
        </div>

        <button
          type="button"
          onClick={onFight}
          disabled={!isUnlocked(selected, defeated)}
          className={STICKY_ACTION_BAR}
        >
          <span>{t('kotodama.fight', { name: selected.name })}</span>
          <ArrowIcon className="text-accent-on-ink" />
        </button>
      </main>
    </>
  );
}
