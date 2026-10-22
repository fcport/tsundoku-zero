// Livello features/kotodama: la BATTAGLIA. In alto la parola da scrivere in romaji
// col significato; in mezzo il tanuki, la parola che si compone e il nemico con la
// sua vita; in fondo i mattoncini dei kana. Ogni kana giusto sale nella parola e la
// scia rossa avanza verso il nemico; a parola finita il tanuki lancia, il nemico
// sobbalza e compare la parola coi kanji (la furigana segue la casella del dorso).
// Le regole sono del dominio (`kotodama.ts`): qui lo stato della pagina e i tempi
// delle animazioni.
import { useEffect, useRef, useState } from 'react';
import { resolveBilingual } from '../../domain/bilingual';
import { alignFurigana } from '../../domain/furigana';
import { kanaTiles, kanaToRomaji, scriptOf } from '../../domain/kana';
import {
  HEARTS,
  STRIKE_AFTER,
  hintTile,
  nextWord,
  outfitFor,
  power,
  pressTile,
  startBattle,
  type Battle,
  type KotodamaEnemy,
} from '../../domain/kotodama';
import { resolveLocale, useTranslation } from '../../i18n';
import { Furigana } from '../../ui/Furigana';
import { Masthead } from '../../ui/Masthead';
import { ArrowIcon } from '../../ui/icons';
import { FOCUS_RING, KICKER } from '../../ui/magazine';
import { EnemyArt, TanukiWizard } from './kotodamaArt';

/** Quanto resta in vista l'incantesimo prima della parola nuova. */
export const CAST_PAUSE_MS = 1000;
/** Quanto si aspetta, a battaglia finita, prima dell'esito. */
export const END_PAUSE_MS = 1200;

/** Il moltiplicatore scritto come lo scrive chi legge: 1,5 in italiano, 1.5 in inglese. */
export function formatPower(level: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-GB', { maximumFractionDigits: 2 }).format(power(level));
}

/** Una fila di quadratini pieni e vuoti: le vite, gli sbagli verso il colpo. */
function Pips({ filled, total, tone }: { readonly filled: number; readonly total: number; readonly tone: 'ink' | 'accent' }) {
  const on = tone === 'ink' ? 'border-ink-primary bg-ink-primary' : 'border-accent bg-accent';
  const off = tone === 'ink' ? 'border-ink-primary' : 'border-accent';
  return (
    <span aria-hidden="true" className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`size-3 border-[1.5px] ${i < filled ? on : off}`} />
      ))}
    </span>
  );
}

export function BattleView({
  enemy,
  level,
  random,
  onLeave,
  onEnd,
}: {
  readonly enemy: KotodamaEnemy;
  readonly level: number;
  readonly random: () => number;
  /** Il ritorno alla mappa dei nemici, a battaglia in corso. */
  readonly onLeave: () => void;
  /** La battaglia è finita (vinta o persa). */
  readonly onEnd: (battle: Battle) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [battle, setBattle] = useState(() => startBattle(enemy, level, random));
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<number | null>(null);
  const [wrong, setWrong] = useState<{ readonly index: number; readonly key: number } | null>(null);
  const [hits, setHits] = useState(0);
  // L'ultima cosa successa al tanuki: ha lanciato o l'hanno colpito. `n` cambia la
  // chiave, così l'animazione riparte a ogni volta e mai da sola.
  const [fx, setFx] = useState<{ readonly kind: 'cast' | 'hurt' | 'none'; readonly n: number }>({ kind: 'none', n: 0 });
  const [live, setLive] = useState('');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  };

  const word = battle.word;
  const letters = kanaTiles(word.kana);
  const script = scriptOf(word.kana);
  const meaning = resolveBilingual(word.meaning, locale);
  const lastCast = battle.casts.at(-1);
  const outfit = outfitFor(level);

  const press = (index: number) => {
    if (busy) return;
    const { battle: next, event } = pressTile(battle, index);
    if (event === 'ignored') return;
    setBattle(next);
    setHint(null);
    if (event === 'right') {
      setWrong(null);
      setLive(t('kotodama.live.right'));
      return;
    }
    if (event === 'wrong' || event === 'struck') {
      setWrong((w) => ({ index, key: (w?.key ?? 0) + 1 }));
      if (event === 'wrong') {
        setLive(t('kotodama.live.wrong'));
        return;
      }
      setFx((f) => ({ kind: 'hurt', n: f.n + 1 }));
      setLive(t('kotodama.live.struck', { value: next.hearts, total: HEARTS }));
      if (next.outcome === 'lost') {
        setBusy(true);
        later(END_PAUSE_MS, () => onEnd(next));
      }
      return;
    }
    // L'incantesimo: il nemico sobbalza, la parola coi kanji resta in vista, poi la
    // parola nuova (o l'esito, se il nemico è a zero).
    const cast = next.casts.at(-1)!;
    setHits((n) => n + 1);
    setFx((f) => ({ kind: 'cast', n: f.n + 1 }));
    setWrong(null);
    setBusy(true);
    setLive(
      t(cast.critical ? 'kotodama.live.castCritical' : 'kotodama.live.cast', {
        word: cast.word.kanji ?? cast.word.kana,
        damage: cast.damage,
      }),
    );
    if (next.outcome === 'won') {
      later(END_PAUSE_MS, () => onEnd(next));
      return;
    }
    later(CAST_PAUSE_MS, () => {
      setBattle((b) => nextWord(b, random));
      setBusy(false);
    });
  };

  const askHint = () => {
    if (busy) return;
    const { battle: next, index } = hintTile(battle);
    setBattle(next);
    setHint(index);
  };

  const hpPercent = Math.round((battle.hp / enemy.hp) * 100);
  const trail = Math.round((battle.typed / letters.length) * 100);

  return (
    <>
      <Masthead
        start={
          <button
            type="button"
            onClick={onLeave}
            className={`flex min-h-[44px] items-center gap-2 uppercase hover:underline ${FOCUS_RING}`}
          >
            <ArrowIcon className="rotate-180" />
            {t('kotodama.changeEnemy')}
          </button>
        }
        end={
          <span className="flex items-center gap-3">
            <span>{t('kotodama.levelShort', { level, power: formatPower(level, locale) })}</span>
            <Pips filled={battle.hearts} total={HEARTS} tone="ink" />
            <span className="sr-only">{t('kotodama.hearts', { value: battle.hearts, total: HEARTS })}</span>
          </span>
        }
      />
      <main className="flex flex-1 flex-col">
        <p className="sr-only" aria-live="polite">
          {live}
        </p>

        {/* La parola da scrivere: il romaji, perché il kana va ricordato. */}
        <section className="flex flex-col items-center gap-1 border-b-[1.5px] border-border-strong px-5 py-3 text-center sm:py-6">
          <p className={KICKER}>{t(`kotodama.writeIn.${script}`)}</p>
          <p className="font-sans text-[40px] font-extrabold leading-none font-stretch-extra-condensed text-ink-primary sm:text-[64px]">
            {kanaToRomaji(word.kana)}
          </p>
          <p lang={meaning.language} className="text-reading text-ink-secondary">
            {meaning.text}
          </p>
        </section>

        <section className="grid flex-1 grid-cols-2 items-end gap-x-4 gap-y-2 border-b-[1.5px] border-border-strong px-4 pt-3 sm:gap-y-3 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)_260px] lg:grid-rows-[auto_1fr] lg:pt-6">
          {/* Il nemico: nome, vita, gli sbagli verso il suo colpo. */}
          <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1 lg:col-start-3 lg:row-start-1">
            <h2 className="flex flex-wrap items-baseline gap-x-3 font-sans text-[24px] font-extrabold uppercase leading-none font-stretch-condensed text-ink-primary sm:text-[30px] lg:flex-col lg:gap-1">
              <span lang="ja" className="order-last font-jp text-[14px] font-bold normal-case text-ink-secondary lg:order-first">
                {enemy.jp}
              </span>
              {enemy.name}
            </h2>
            <div className="flex items-center gap-3">
              <div aria-hidden="true" className="h-3.5 flex-1 border-[1.5px] border-ink-primary bg-surface-raised">
                <div
                  className="h-full bg-ink-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
              <span aria-hidden="true" className="font-mono text-label text-ink-primary">
                {battle.hp}/{enemy.hp}
              </span>
              <span className="sr-only">{t('kotodama.enemyHp', { hp: battle.hp, max: enemy.hp })}</span>
            </div>
            <div className="flex items-center gap-2 text-label text-ink-secondary">
              <Pips filled={battle.charge} total={STRIKE_AFTER} tone="accent" />
              <span aria-hidden="true">{t('kotodama.charge')}</span>
              <span className="sr-only">{t('kotodama.chargeLabel', { value: battle.charge, total: STRIKE_AFTER })}</span>
            </div>
          </div>

          {/* Il tanuki: si sporge quando lancia, trema quando lo colpiscono. */}
          <div className="col-start-1 flex justify-start pb-1 sm:pb-3 lg:row-span-2 lg:row-start-1">
            <div
              key={`tanuki-${fx.n}`}
              className={
                fx.kind === 'hurt'
                  ? 'motion-safe:animate-tile-wrong'
                  : fx.kind === 'cast'
                    ? 'motion-safe:animate-spell-cast'
                    : ''
              }
            >
              <TanukiWizard outfit={outfit} pose={busy && battle.outcome !== 'lost' ? 'cast' : 'idle'} height={100} tallHeight={200} />
            </div>
          </div>

          <div className="relative col-start-2 flex justify-end pb-1 sm:pb-3 lg:col-start-3 lg:row-start-2 lg:justify-center">
            <div key={`enemy-${hits}`} className={hits > 0 ? 'motion-safe:animate-spell-hit' : ''}>
              <EnemyArt enemy={enemy} height={100} tallHeight={200} />
            </div>
            {busy && lastCast && battle.outcome !== 'lost' ? (
              <span
                key={`damage-${hits}`}
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-0 font-sans text-[40px] font-black leading-none font-stretch-condensed text-accent motion-safe:animate-damage-float"
              >
                −{lastCast.damage}
                {lastCast.critical ? <span className="ml-1 text-[18px] uppercase">{t('kotodama.critical')}</span> : null}
              </span>
            ) : null}
          </div>

          {/* In mezzo: l'ultima parola lanciata, coi kanji; la parola di adesso; la scia. */}
          <div className="col-span-2 flex flex-col items-center gap-2 pb-3 sm:gap-4 sm:pb-6 lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            <div className="flex min-h-[44px] flex-wrap items-end justify-center gap-x-3 sm:min-h-[56px]" aria-hidden="true">
              {lastCast ? (
                <>
                  <span lang="ja" className="text-[28px] font-bold leading-none text-ink-primary sm:text-[34px]">
                    <Furigana segments={alignFurigana(lastCast.word.kanji ?? lastCast.word.kana, lastCast.word.kana)} />
                  </span>
                  <span lang={resolveBilingual(lastCast.word.meaning, locale).language} className="pb-1 text-label text-ink-secondary">
                    {resolveBilingual(lastCast.word.meaning, locale).text}
                  </span>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2.5" lang="ja">
              {letters.map((kana, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`flex h-[52px] w-[44px] items-center justify-center border-b-[3px] text-[34px] font-bold text-ink-primary sm:h-[80px] sm:w-[64px] sm:text-[48px] ${
                    i === battle.typed && !busy ? 'border-accent' : 'border-ink-primary'
                  }`}
                >
                  {i < battle.typed ? kana : ''}
                </span>
              ))}
              <span className="sr-only">{t('kotodama.wordLabel', { typed: battle.typed, total: letters.length })}</span>
            </div>
            <div aria-hidden="true" className="relative h-2.5 w-full max-w-[520px]">
              <div className="absolute inset-x-0 top-1 border-t-[1.5px] border-dashed border-border-hairline" />
              <div
                className="absolute left-0 top-0 h-2.5 bg-accent transition-[width] duration-200 ease-out"
                style={{ width: `${trail}%` }}
              />
            </div>
          </div>
        </section>

        {/* I mattoncini: si toccano in ordine. */}
        <section className="flex flex-col gap-2 bg-surface-sunken px-4 pb-4 pt-2 sm:gap-3 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <p className={KICKER}>{t('kotodama.tapInOrder')}</p>
            <p className="flex flex-wrap items-center gap-x-2 text-label">
              <button
                type="button"
                onClick={askHint}
                disabled={busy}
                className={`min-h-[44px] text-left font-semibold text-ink-primary underline underline-offset-4 disabled:opacity-60 ${FOCUS_RING}`}
              >
                {t('kotodama.hint')}
              </button>
              <span className="hidden text-ink-secondary sm:inline">{t('kotodama.hintCost')}</span>
            </p>
          </div>
          <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
            {battle.tiles.map((kana, i) => {
              const used = battle.used[i];
              const isWrong = wrong?.index === i;
              const isHint = hint === i;
              return (
                <button
                  key={`${word.kana}-${i}-${isWrong ? wrong.key : 0}`}
                  type="button"
                  lang="ja"
                  disabled={used}
                  onClick={() => press(i)}
                  aria-label={used ? t('kotodama.usedTile') : kana}
                  className={`flex h-14 items-center justify-center text-[30px] font-bold sm:h-[84px] sm:w-[76px] sm:text-[40px] ${FOCUS_RING} ${
                    used
                      ? 'border-[1.5px] border-dashed border-border-hairline'
                      : isWrong || isHint
                        ? 'border-2 border-accent bg-accent-subtle text-accent'
                        : 'border-[1.5px] border-ink-primary bg-surface-raised text-ink-primary hover:-translate-y-0.5'
                  } ${isWrong ? 'motion-safe:animate-tile-wrong' : ''} transition-transform`}
                >
                  {used ? '' : kana}
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
