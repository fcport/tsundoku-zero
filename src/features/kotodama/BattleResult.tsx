// Livello features/kotodama: l'ESITO di una battaglia. Vinta o persa, i punti presi
// e il livello (col vestito nuovo, se è cambiato); a destra il grimorio, le parole
// della battaglia coi loro kanji, il significato e il danno. In fondo la barra
// d'azione: il nemico dopo, o riprovare.
import { resolveBilingual } from '../../domain/bilingual';
import { alignFurigana } from '../../domain/furigana';
import {
  levelForXp,
  outfitFor,
  xpForLevel,
  type Battle,
  type KotodamaEnemy,
} from '../../domain/kotodama';
import { resolveLocale, useTranslation } from '../../i18n';
import { Furigana } from '../../ui/Furigana';
import { Masthead } from '../../ui/Masthead';
import { ArrowIcon } from '../../ui/icons';
import { ACTION_BAR, FOCUS_RING, KICKER, SCREEN_TITLE, SERVICE_LINK } from '../../ui/magazine';
import { formatPower } from './BattleView';
import { TanukiWizard } from './kotodamaArt';

export function BattleResult({
  battle,
  gained,
  xpBefore,
  next,
  onNext,
  onRematch,
  onMap,
}: {
  readonly battle: Battle;
  readonly gained: number;
  readonly xpBefore: number;
  /** Il nemico che si apre dopo questo, se c'è ed è battuto. */
  readonly next: KotodamaEnemy | null;
  readonly onNext: () => void;
  readonly onRematch: () => void;
  readonly onMap: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const won = battle.outcome === 'won';
  const { enemy } = battle;
  const xpAfter = xpBefore + gained;
  const levelBefore = levelForXp(xpBefore);
  const level = levelForXp(xpAfter);
  const outfit = outfitFor(level);
  const newOutfit = outfit !== outfitFor(levelBefore);
  const span = xpForLevel(level + 1) - xpForLevel(level);
  const progress = Math.round(((xpAfter - xpForLevel(level)) / span) * 100);
  const critical = battle.casts.filter((c) => c.critical).length;

  const stats: readonly (readonly [string, number])[] = [
    [t('kotodama.statCasts'), battle.casts.length],
    [t('kotodama.statCritical'), critical],
    [t('kotodama.statStruck'), battle.struck],
  ];

  return (
    <>
      <Masthead
        start={
          <button
            type="button"
            onClick={onMap}
            className={`flex min-h-[44px] items-center gap-2 uppercase hover:underline ${FOCUS_RING}`}
          >
            <ArrowIcon className="rotate-180" />
            {t('kotodama.allEnemies')}
          </button>
        }
      />
      <main className="flex flex-1 flex-col">
        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="flex flex-col gap-6 border-b-[1.5px] border-border-strong p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8 lg:border-b-0 lg:border-r-[1.5px]">
            <TanukiWizard outfit={outfit} pose={won ? 'win' : 'idle'} height={160} tallHeight={220} className="self-center" />
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="flex flex-col gap-2">
                <p className={KICKER}>
                  <span lang="ja">{enemy.jp}</span> · {enemy.name}
                </p>
                <h2 className={`${SCREEN_TITLE} text-ink-primary`}>{won ? t('kotodama.won') : t('kotodama.lost')}</h2>
                <p className="text-reading text-ink-secondary">
                  {won ? t('kotodama.wonBody', { name: enemy.name }) : t('kotodama.lostBody', { name: enemy.name })}
                </p>
              </div>
              <dl className="grid grid-cols-3 border-y-[1.5px] border-border-strong">
                {stats.map(([label, value], i) => (
                  <div key={label} className={`flex flex-col-reverse gap-1 py-3 ${i > 0 ? 'border-l border-border-hairline pl-4' : ''}`}>
                    <dt className="text-label text-ink-secondary">{label}</dt>
                    <dd className="font-sans text-[40px] font-black leading-none font-stretch-condensed text-ink-primary">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center gap-5">
                {level > levelBefore ? (
                  <div
                    aria-hidden="true"
                    className="flex size-[84px] shrink-0 -rotate-6 flex-col items-center justify-center border-[3px] border-accent text-accent"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{t('kotodama.levelWord')}</span>
                    <span className="font-sans text-[44px] font-black leading-none font-stretch-condensed">{level}</span>
                  </div>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="text-body font-semibold text-ink-primary">
                    {t('kotodama.xpGained', { xp: gained })}
                    {level > levelBefore ? ` · ${t('kotodama.levelUp', { level, power: formatPower(level, locale) })}` : ''}
                  </p>
                  <div aria-hidden="true" className="h-3 border-[1.5px] border-ink-primary bg-surface-raised">
                    <div className="h-full bg-ink-primary" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-label text-ink-secondary">
                    {t('kotodama.xpToNext', { left: xpForLevel(level + 1) - xpAfter, next: level + 1 })}
                    {newOutfit ? ` ${t('kotodama.newOutfit', { outfit: t(`kotodama.outfits.${outfit}`) })}` : ''}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Il grimorio: le parole della battaglia, coi kanji solo adesso. */}
          <section className="flex flex-col">
            <div className="flex items-baseline justify-between gap-3 border-b-[1.5px] border-border-strong px-5 py-4 sm:px-7">
              <h3 className="font-sans text-[24px] font-extrabold uppercase leading-none font-stretch-condensed text-ink-primary">
                {t('kotodama.grimoire')}
              </h3>
              <p className="text-label text-ink-secondary">{t('kotodama.grimoireNote')}</p>
            </div>
            <ol className="flex flex-col">
              {battle.casts.map((cast, i) => {
                const meaning = resolveBilingual(cast.word.meaning, locale);
                return (
                  <li
                    key={i}
                    className="flex items-end justify-between gap-3 border-b border-border-hairline px-5 py-2 sm:px-7"
                  >
                    <span className="flex min-w-0 flex-wrap items-end gap-x-3">
                      <span lang="ja" className="text-[24px] font-bold leading-[1.6] text-ink-primary">
                        <Furigana segments={alignFurigana(cast.word.kanji ?? cast.word.kana, cast.word.kana)} />
                      </span>
                      <span lang={meaning.language} className="pb-1.5 text-label text-ink-secondary">
                        {meaning.text}
                      </span>
                    </span>
                    <span className={`shrink-0 pb-1.5 font-mono text-label ${cast.critical ? 'text-accent' : 'text-ink-secondary'}`}>
                      {t('kotodama.damage', { damage: cast.damage })}
                      {cast.critical ? ` · ${t('kotodama.critical')}` : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {won ? (
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 border-t-[1.5px] border-border-strong px-5 py-3 sm:px-8">
            <button type="button" onClick={onRematch} className={SERVICE_LINK}>
              {t('kotodama.rematch', { name: enemy.name })}
            </button>
          </div>
        ) : null}
        <button type="button" onClick={won ? (next ? onNext : onMap) : onRematch} className={ACTION_BAR}>
          <span>
            {won ? (next ? t('kotodama.next', { name: next.name }) : t('kotodama.allEnemies')) : t('kotodama.retry')}
          </span>
          <ArrowIcon className="text-accent-on-ink" />
        </button>
      </main>
    </>
  );
}
