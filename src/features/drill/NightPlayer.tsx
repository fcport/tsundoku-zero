// Livello features/drill: una NOTTE della pila, giocata. L'«edizione notturna» della
// rivista: fondo d'inchiostro, testo chiaro, una candela in alto che si accorcia a
// ogni errore e si spegne a fine notte. La storia scorre una battuta alla volta con
// «Avanti»; alle domande si sceglie cosa dire e lo si scrive nella frase. Cosa
// succede dopo lo decide il dominio (`night.ts`): qui solo lo stato della pagina.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { resolveBilingual, type BilingualText } from '../../domain/bilingual';
import { normalizeAnswer, type Spelling } from '../../domain/conjugation';
import {
  DICTATE_AFTER,
  FRAME_GAP,
  judge,
  targetForm,
  type Ask,
  type AskOption,
  type Beat,
  type Night,
  type NightStep,
} from '../../domain/night';
import { resolveLocale, useTranslation } from '../../i18n';
import { Stamp } from '../../ui/Stamp';
import { ArrowIcon } from '../../ui/icons';
import { FOCUS_RING, HEADLINE } from '../../ui/magazine';
import { KanaInput, Ruby } from './drillParts';
import { PieceChips } from './FormBuilder';
import { markNightDone } from './nightProgress';

/** Quello che compare nella pagina: le battute, le tue parole, la forma dettata. */
type Entry =
  | Beat
  | { readonly kind: 'you'; readonly text: string }
  | { readonly kind: 'dictate'; readonly option: AskOption };

interface State {
  readonly shown: readonly Entry[];
  readonly queue: readonly NightStep[];
  readonly ask: Ask | null;
  readonly option: AskOption | null;
  /** Errori sulla domanda di adesso: al terzo il tanuki detta la forma. */
  readonly wrongs: number;
  /** Errori in tutta la notte: quanto si è consumata la candela. */
  readonly burnt: number;
  readonly lit: boolean;
}

/**
 * Tira fuori dalla coda la prossima battuta da mostrare, oppure la prossima domanda.
 * Lo spegnimento della candela non è una battuta: cambia la candela e lascia passare
 * la battuta dopo.
 */
function reveal(state: State, queue: readonly NightStep[], add: readonly Entry[] = []): State {
  const shown = [...state.shown, ...add];
  let lit = state.lit;
  for (let i = 0; i < queue.length; i++) {
    const next = queue[i]!;
    if (next.kind === 'ask') {
      return {
        ...state,
        shown,
        lit,
        queue: queue.slice(i + 1),
        ask: next,
        option: next.options.length === 1 ? next.options[0]! : null,
        wrongs: 0,
      };
    }
    if (next.kind === 'candleOut') {
      lit = false;
      continue;
    }
    return { ...state, shown: [...shown, next], lit, queue: queue.slice(i + 1), ask: null, option: null };
  }
  return { ...state, shown, lit, queue: [], ask: null, option: null };
}

function start(night: Night): State {
  const empty: State = { shown: [], queue: [], ask: null, option: null, wrongs: 0, burnt: 0, lit: true };
  return reveal(empty, night.steps);
}

const NIGHT_BAR = `flex min-h-[72px] w-full items-center justify-between gap-4 border-t-[1.5px] border-surface-sunken bg-ink-primary px-5 text-left text-[28px] leading-none text-surface-base *:transition-transform hover:[&>svg]:translate-x-1.5 sm:min-h-[88px] sm:px-8 sm:text-[34px] ${HEADLINE} ${FOCUS_RING}`;

const NIGHT_KICKER = 'font-mono text-label-caps uppercase text-surface-sunken';

export function NightPlayer({
  night,
  masthead,
  onExit,
}: {
  readonly night: Night;
  readonly masthead: ReactNode;
  /** Il ritorno alla scelta dell'allenamento. */
  readonly onExit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const tr = (text: BilingualText) => resolveBilingual(text, locale);
  const [state, setState] = useState<State>(() => start(night));
  const [value, setValue] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const { shown, ask, option } = state;
  const done = ask === null && state.queue.length === 0;

  useEffect(() => {
    if (done) markNightDone(night.id);
  }, [done, night.id]);

  // L'ultima battuta resta in vista: la pagina scende con la storia.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [shown.length, ask, option]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (done) {
      onExit();
      return;
    }
    if (!ask) {
      setState((s) => reveal(s, s.queue));
      return;
    }
    if (!option) return;
    const verdict = judge(value, option);
    if (verdict.kind === 'empty') return;
    const you: Entry = { kind: 'you', text: normalizeAnswer(value) };
    setValue('');
    if (verdict.kind === 'correct') {
      setState((s) => reveal(s, [...verdict.then, ...s.queue], [you]));
      return;
    }
    const reaction =
      verdict.kind === 'mistake' ? verdict.then : verdict.kind === 'foreign' ? night.foreign : night.wrong;
    setState((s) => {
      const wrongs = s.wrongs + 1;
      const dictate: Entry[] = wrongs === DICTATE_AFTER ? [{ kind: 'dictate', option }] : [];
      return { ...s, shown: [...s.shown, you, ...reaction, ...dictate], wrongs, burnt: s.burnt + 1 };
    });
  };

  return (
    <>
      {masthead}
      <main className="flex min-h-[24rem] flex-1 flex-col bg-ink-primary text-surface-base">
        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col gap-6 p-5 sm:p-8">
            <header className="flex items-end justify-between gap-4 border-b-[1.5px] border-surface-sunken pb-4">
              <div>
                <p lang="ja" className="font-jp-read text-[22px] font-bold text-accent-on-ink">
                  {night.kanjiTitle}
                </p>
                <h2 className={`${HEADLINE} text-[34px] leading-none sm:text-[44px]`}>{tr(night.title).text}</h2>
              </div>
              <Candle lit={state.lit} burnt={state.burnt} />
            </header>

            <div aria-live="polite" className="flex flex-col gap-5">
              {shown.map((entry, index) => (
                <EntryView key={index} entry={entry} />
              ))}
            </div>

            {ask ? (
              <div className="flex flex-col gap-4 border-t-[1.5px] border-surface-sunken pt-5">
                <p className={`${HEADLINE} text-[24px] leading-tight sm:text-[28px]`}>{tr(ask.prompt).text}</p>
                {option ? (
                  <AnswerArea
                    option={option}
                    canChange={ask.options.length > 1}
                    onChange={() => setState((s) => ({ ...s, option: null }))}
                    value={value}
                    onValue={setValue}
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className={NIGHT_KICKER}>{t('drill.nights.choose')}</p>
                    {ask.options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setState((s) => ({ ...s, option: o }))}
                        className={`min-h-[56px] border-[1.5px] border-surface-sunken px-4 py-3 text-left text-body font-semibold hover:bg-surface-base hover:text-ink-primary ${FOCUS_RING}`}
                      >
                        {tr(o.label).text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {done ? (
              <div className="flex items-center gap-5 border-t-[1.5px] border-surface-sunken pt-6">
                <Stamp segments={night.stamp} meaning={tr(night.stampMeaning).text} meaningLang={tr(night.stampMeaning).language} />
                <div className="flex flex-col gap-1">
                  <p className={`${HEADLINE} text-[24px] leading-tight`}>{t('drill.nights.end', { title: night.kanjiTitle })}</p>
                  <p className="text-body text-surface-sunken">{t('drill.nights.saved')}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setState(start(night));
                      setValue('');
                    }}
                    className={`mt-2 self-start text-label font-semibold underline underline-offset-4 ${FOCUS_RING}`}
                  >
                    {t('drill.nights.again')}
                  </button>
                </div>
              </div>
            ) : null}
            <div ref={end} />
          </div>

          {ask && !option ? null : (
            <button type="submit" className={NIGHT_BAR}>
              <span>{done ? t('drill.nights.back') : ask ? t('drill.nights.answer') : t('drill.nights.next')}</span>
              <ArrowIcon className="text-accent-on-ink" />
            </button>
          )}
        </form>
      </main>
    </>
  );
}

/** La candela: si accorcia a ogni errore, la fiamma trema finché è accesa. */
function Candle({ lit, burnt }: { readonly lit: boolean; readonly burnt: number }) {
  const { t } = useTranslation();
  const height = Math.round(44 * Math.max(0.3, 1 - burnt * 0.15));
  const top = 62 - height;
  const label = !lit ? t('drill.nights.candleOut') : burnt > 0 ? t('drill.nights.candleShort') : t('drill.nights.candleLit');
  return (
    <svg role="img" aria-label={label} viewBox="0 0 24 64" className="h-16 w-6 shrink-0 sm:h-20 sm:w-8">
      {lit ? (
        <path
          d={`M12 ${top - 15} C 16 ${top - 9}, 15 ${top - 3}, 12 ${top - 1} C 9 ${top - 3}, 8 ${top - 9}, 12 ${top - 15} Z`}
          className="fill-accent-on-ink motion-safe:animate-flame"
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
        />
      ) : null}
      <line x1="12" y1={top - 2} x2="12" y2={top} strokeWidth="1.5" className="stroke-surface-sunken" />
      <rect x="7" y={top} width="10" height={height} className="fill-surface-base" />
    </svg>
  );
}

/** La punteggiatura giapponese: la furigana si allinea pezzo per pezzo, fra un segno e l'altro. */
const PUNCTUATION = /([、。…？！「」])/;

/**
 * Una frase con la furigana, spezzata sulla punteggiatura: `alignFurigana` allinea
 * kanji e kana di un pezzo senza segni, e con un 、 in mezzo perderebbe il filo.
 */
function RubyLine({ spelling }: { readonly spelling: Spelling }) {
  const kanji = spelling.kanji.split(PUNCTUATION);
  const kana = spelling.kana.split(PUNCTUATION);
  if (kanji.length !== kana.length) return <Ruby spelling={spelling} />;
  return (
    <>
      {kanji.map((piece, i) =>
        piece === '' ? null : PUNCTUATION.test(piece) ? (
          <span key={i}>{piece}</span>
        ) : (
          <Ruby key={i} spelling={{ kanji: piece, kana: kana[i]! }} />
        ),
      )}
    </>
  );
}

/** Una voce della pagina. */
function EntryView({ entry }: { readonly entry: Entry }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const tr = (text: BilingualText) => resolveBilingual(text, locale);
  switch (entry.kind) {
    case 'narration':
      return <p className="text-body leading-relaxed sm:text-[19px]">{tr(entry.text).text}</p>;
    case 'speech': {
      const text = tr(entry.text);
      return (
        <p lang={text.language} className="text-body italic leading-relaxed text-accent-on-ink sm:text-[19px]">
          «{text.text}»
        </p>
      );
    }
    case 'line': {
      const translation = tr(entry.translation);
      return (
        <figure className="flex flex-col gap-1 border-l-[3px] border-accent-on-ink pl-4">
          <figcaption className={NIGHT_KICKER}>{t(`drill.nights.speakers.${entry.speaker}`)}</figcaption>
          <p lang="ja" className="font-jp-read text-[24px] font-bold leading-relaxed sm:text-[30px]">
            <RubyLine spelling={entry.ja} />
          </p>
          <p lang={translation.language} className="text-body italic text-surface-sunken">
            {translation.text}
          </p>
        </figure>
      );
    }
    case 'you':
      return (
        <div className="flex flex-col items-end gap-1 text-right">
          <p className={NIGHT_KICKER}>{t('drill.nights.you')}</p>
          <p lang="ja" className="font-jp-read text-[24px] font-bold sm:text-[28px]">
            {entry.text}
          </p>
        </div>
      );
    case 'dictate': {
      const { result, steps } = targetForm(entry.option.target);
      return (
        <div className="flex flex-col gap-2 border-[1.5px] border-accent-on-ink p-4">
          <p className="text-body italic text-accent-on-ink">«{t('drill.nights.dictate')}»</p>
          <p lang="ja" className="font-jp-read text-[26px] font-bold sm:text-[30px]">
            <Ruby spelling={result} />
          </p>
          {steps ? <PieceChips steps={steps} inverted /> : null}
        </div>
      );
    }
    case 'candleOut':
      return null;
  }
}

/** La scelta fatta, gli aiuti, la frase con le tue parole dentro e il campo. */
function AnswerArea({
  option,
  canChange,
  onChange,
  value,
  onValue,
}: {
  readonly option: AskOption;
  readonly canChange: boolean;
  readonly onChange: () => void;
  readonly value: string;
  readonly onValue: (value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const { steps } = targetForm(option.target);
  const hint = option.hint ? resolveBilingual(option.hint, locale).text : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-body italic">«{resolveBilingual(option.label, locale).text}»</p>
        {canChange ? (
          <button
            type="button"
            onClick={onChange}
            className={`min-h-[44px] text-label font-semibold underline underline-offset-4 ${FOCUS_RING}`}
          >
            {t('drill.nights.change')}
          </button>
        ) : null}
      </div>
      {steps ? <PieceChips steps={steps} inverted /> : null}
      {hint ? (
        <p className="text-body text-surface-sunken">{hint}</p>
      ) : null}
      <Frame frame={option.frame} value={value} />
      <KanaInput
        value={value}
        onValue={onValue}
        enterKeyHint="done"
        describedBy="night-hint"
        label={t('drill.nights.yourWords')}
        className={`min-h-[60px] w-full border-[1.5px] border-surface-sunken bg-transparent px-4 font-jp-read text-[26px] text-surface-base sm:text-[30px] ${FOCUS_RING}`}
      />
      <p id="night-hint" className="text-label text-surface-sunken">
        {t('drill.inputHint')}
      </p>
    </div>
  );
}

/** La frase da completare, con quello che stai scrivendo al posto dello spazio. */
function Frame({ frame, value }: { readonly frame: Spelling; readonly value: string }) {
  const [kanjiBefore = '', kanjiAfter = ''] = frame.kanji.split(FRAME_GAP);
  const [kanaBefore = '', kanaAfter = ''] = frame.kana.split(FRAME_GAP);
  return (
    <p lang="ja" aria-hidden="true" className="font-jp-read text-[24px] font-bold leading-relaxed sm:text-[30px]">
      {kanjiBefore ? <RubyLine spelling={{ kanji: kanjiBefore, kana: kanaBefore }} /> : null}
      <span className="mx-1 inline-block min-w-[4em] border-b-[3px] border-accent-on-ink text-accent-on-ink">
        {value || ' '}
      </span>
      {kanjiAfter ? <RubyLine spelling={{ kanji: kanjiAfter, kana: kanaAfter }} /> : null}
    </p>
  );
}
