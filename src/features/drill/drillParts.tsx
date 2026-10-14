// Livello features/drill: i pezzi COMUNI alle due modalità dell'allenamento libero
// (una forma alla volta, costruttore di forme): il ciclo domanda → risposta →
// esito, il campo della risposta, l'esito e le frasi delle regole. Ogni modalità
// porta solo come si chiede e come si spiega.
import { useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import {
  isCorrectAnswer,
  normalizeAnswer,
  pickDrill,
  romajiToKana,
  type ConjugationRule,
  type Spelling,
  type Verb,
} from '../../domain/conjugation';
import { alignFurigana } from '../../domain/furigana';
import { resolveBilingual } from '../../domain/bilingual';
import { resolveLocale, useTranslation } from '../../i18n';
import { Furigana } from '../../ui/Furigana';
import { Translation } from '../../ui/Translation';
import { ArrowIcon } from '../../ui/icons';
import { ACTION_BAR, FOCUS_RING, KICKER } from '../../ui/magazine';

/** Dalla regola del dominio alla sua frase nel catalogo. */
export const RULE_KEYS = {
  ichidan: 'drill.rules.ichidan',
  'godan-a': 'drill.rules.godanA',
  'godan-wa': 'drill.rules.godanWa',
  'godan-i': 'drill.rules.godanI',
  'godan-e': 'drill.rules.godanE',
  'godan-o': 'drill.rules.godanO',
  'godan-te-small-tsu': 'drill.rules.godanTeSmallTsu',
  'godan-te-n': 'drill.rules.godanTeN',
  'godan-te-i': 'drill.rules.godanTeI',
  'godan-te-gi': 'drill.rules.godanTeGi',
  'godan-te-shi': 'drill.rules.godanTeShi',
  iku: 'drill.rules.iku',
  aru: 'drill.rules.aru',
  suru: 'drill.rules.suru',
  kuru: 'drill.rules.kuru',
} as const satisfies Record<ConjugationRule, string>;

export const CHECKBOX = `size-5 shrink-0 accent-ink-primary ${FOCUS_RING}`;

export const OPTION_LABEL =
  'flex min-h-[44px] cursor-pointer items-center gap-3 text-label text-ink-primary';

export const SECTION_HEADING =
  'text-[22px] font-extrabold uppercase leading-tight font-stretch-condensed text-ink-primary';

export const SMALL_ACTION = `min-h-[44px] text-label font-semibold text-ink-primary underline underline-offset-4 disabled:text-ink-secondary disabled:no-underline ${FOCUS_RING}`;

/** Il titolo grande della domanda: cosa produrre (forma o catena). */
export const ASK_HEADING =
  'mt-1 flex flex-wrap items-baseline gap-x-3 text-[30px] font-extrabold uppercase leading-tight font-stretch-condensed text-ink-primary sm:text-[38px]';

/** Una forma in giapponese con la furigana. */
export function Ruby({ spelling }: { readonly spelling: Spelling }) {
  return <Furigana segments={alignFurigana(spelling.kanji, spelling.kana)} />;
}

interface Answer {
  readonly given: string;
  readonly correct: boolean;
}

/**
 * Il ciclo dell'allenamento: una domanda per volta presa a caso da `pool`, il
 * campo della risposta, l'esito. `ask` dice cosa produrre, `resultOf` la forma
 * giusta, `explain` come si fa (mostrato dopo la risposta).
 */
export function QuestionLoop<T extends { readonly verb: Verb }>({
  pool,
  random,
  masthead,
  kicker,
  resultOf,
  ask,
  explain,
}: {
  readonly pool: readonly T[];
  readonly random: () => number;
  readonly masthead: (score: { right: number; total: number }) => ReactNode;
  readonly kicker: string;
  readonly resultOf: (item: T) => Spelling;
  readonly ask: (item: T) => ReactNode;
  readonly explain: (item: T, correct: boolean) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [item, setItem] = useState<T | null>(() => pickDrill(pool, random));
  const [value, setValue] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const input = useRef<HTMLInputElement>(null);

  if (!item) return null;
  const result = resultOf(item);
  const meaning = resolveBilingual(item.verb.meaning, locale);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (answer) {
      setItem(pickDrill(pool, random, item));
      setValue('');
      setAnswer(null);
      input.current?.focus();
      return;
    }
    const given = normalizeAnswer(value);
    if (given === '') return;
    const correct = isCorrectAnswer(value, { result });
    setValue(given);
    setAnswer({ given, correct });
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <>
      {masthead(score)}
      <main className="flex min-h-[24rem] flex-1 flex-col">
        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-[56rem] flex-1 flex-col gap-6 p-5 sm:p-8">
            <p className={KICKER}>{kicker}</p>

            {/* Il verbo nella forma del dizionario: l'evento della pagina. */}
            <div>
              <p
                lang="ja"
                className="font-jp-read text-[56px] font-extrabold leading-[1.15] text-ink-primary sm:text-[88px]"
              >
                <Ruby spelling={item.verb} />
              </p>
              <Translation
                text={meaning.text}
                lang={meaning.language}
                className="mt-1 block text-body italic text-ink-secondary"
              />
            </div>

            <div className="border-t-[1.5px] border-border-strong pt-4">{ask(item)}</div>

            <label className="flex flex-col gap-2">
              <span className={KICKER}>{t('drill.inputLabel')}</span>
              <KanaInput
                inputRef={input}
                value={value}
                onValue={setValue}
                readOnly={answer !== null}
                enterKeyHint={answer ? 'next' : 'done'}
                describedBy="drill-hint"
                className={`min-h-[64px] w-full border-[1.5px] border-border-strong bg-surface-raised px-4 font-jp-read text-[28px] text-ink-primary read-only:bg-surface-sunken sm:text-[34px] ${FOCUS_RING}`}
              />
              <span id="drill-hint" className="text-label text-ink-secondary">
                {t('drill.inputHint')}
              </span>
            </label>

            <div aria-live="polite">
              {answer ? (
                <Feedback answer={answer} result={result}>
                  {explain(item, answer.correct)}
                </Feedback>
              ) : null}
            </div>
          </div>

          <button type="submit" className={ACTION_BAR}>
            <span>{answer ? t('drill.next') : t('drill.check')}</span>
            <ArrowIcon className="text-accent-on-ink" />
          </button>
        </form>
      </main>
    </>
  );
}

/**
 * Il campo della risposta in giapponese: il romaji diventa kana mentre si scrive;
 * con la tastiera giapponese si lascia lavorare la composizione e si converte alla fine.
 */
export function KanaInput({
  inputRef,
  value,
  onValue,
  readOnly = false,
  enterKeyHint,
  describedBy,
  label,
  className,
}: {
  readonly inputRef?: RefObject<HTMLInputElement | null>;
  readonly value: string;
  readonly onValue: (value: string) => void;
  readonly readOnly?: boolean;
  readonly enterKeyHint?: 'next' | 'done';
  readonly describedBy?: string;
  /** Il nome del campo, quando non sta dentro un `<label>`. */
  readonly label?: string;
  readonly className: string;
}) {
  const composing = useRef(false);
  return (
    <input
      ref={inputRef}
      lang="ja"
      value={value}
      readOnly={readOnly}
      autoFocus
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint={enterKeyHint}
      aria-describedby={describedBy}
      aria-label={label}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        onValue(romajiToKana(e.currentTarget.value));
      }}
      onChange={(e) => onValue(composing.current ? e.target.value : romajiToKana(e.target.value))}
      className={className}
    />
  );
}

/** L'esito: giusto/sbagliato, la forma giusta, poi come si fa (`children`). */
function Feedback({
  answer,
  result,
  children,
}: {
  readonly answer: Answer;
  readonly result: Spelling;
  readonly children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-col gap-4 border-[1.5px] p-4 sm:p-5 ${
        answer.correct
          ? 'border-ink-primary bg-ink-primary text-surface-base'
          : 'border-danger bg-danger-subtle text-ink-primary'
      }`}
    >
      <p className="text-[28px] font-extrabold uppercase leading-none font-stretch-condensed">
        {answer.correct ? t('drill.correct') : t('drill.incorrect')}
      </p>
      {answer.correct ? null : (
        <dl className="grid items-baseline gap-x-4 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-2">
          <dt className="text-label">{t('drill.yourAnswer')}</dt>
          <dd lang="ja" className="mb-2 font-jp-read text-[22px] line-through sm:mb-0 sm:text-[24px]">
            {answer.given}
          </dd>
          <dt className="text-label">{t('drill.rightAnswer')}</dt>
          <dd lang="ja" className="font-jp-read text-[24px] font-bold sm:text-[30px]">
            <Ruby spelling={result} />
          </dd>
        </dl>
      )}
      <div className="flex flex-col gap-2">
        <p
          className={`font-mono text-label-caps uppercase ${answer.correct ? 'text-accent-on-ink' : 'text-ink-secondary'}`}
        >
          {t('drill.steps')}
        </p>
        {children}
      </div>
    </div>
  );
}
