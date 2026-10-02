// Livello features/drill: l'ALLENAMENTO LIBERO sulle forme del verbo. Prima si
// sceglie cosa allenare (forme e gruppi di verbi), poi: un verbo, la forma richiesta, si scrive la risposta (kana, o romaji convertito mentre si
// scrive), poi l'esito coi passaggi e la regola. Fuori dalla pila: nessuna porta,
// nessuna scadenza, nessun salvataggio; il punteggio vive finché si resta qui.
//
// La coniugazione, il controllo e la scelta della domanda sono del dominio
// (`conjugation.ts`); qui solo lo stato della schermata e il caso (`Math.random`),
// iniettato in `pickDrill`. La navigazione arriva come callback (AD-1).
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  CONJUGATION_FORMS,
  FORM_MARKERS,
  VERB_GROUPS,
  conjugate,
  drillPool,
  isCorrectAnswer,
  normalizeAnswer,
  pickDrill,
  romajiToKana,
  type ConjugationForm,
  type ConjugationRule,
  type Drill,
  type VerbGroup,
} from '../../domain/conjugation';
import { DRILL_VERBS } from '../../domain/drill-verbs';
import { alignFurigana } from '../../domain/furigana';
import { resolveBilingual } from '../../domain/bilingual';
import { resolveLocale, useTranslation } from '../../i18n';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { Masthead } from '../../ui/Masthead';
import { Furigana } from '../../ui/Furigana';
import { Translation } from '../../ui/Translation';
import { ArrowIcon } from '../../ui/icons';
import { ACTION_BAR, FOCUS_RING, KICKER, SCREEN_TITLE } from '../../ui/magazine';
import {
  DRILL_FORMS_STORAGE_KEY,
  DRILL_GROUPS_STORAGE_KEY,
  readFormSelection,
  readGroupSelection,
  saveSelection,
  toggleValue,
} from './drillSelection';

export interface DrillScreenProps {
  /** Il ritorno alla dashboard, cablato dal livello app. */
  readonly onExit: () => void;
  /** Il caso, in [0, 1). Iniettabile per i test; predefinito `Math.random`. */
  readonly random?: () => number;
}

/** Dalla regola del dominio alla sua frase nel catalogo. */
const RULE_KEYS = {
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

const CHECKBOX = `size-5 shrink-0 accent-ink-primary ${FOCUS_RING}`;

const OPTION_LABEL =
  'flex min-h-[44px] cursor-pointer items-center gap-3 text-label text-ink-primary';

interface Answer {
  readonly given: string;
  readonly correct: boolean;
}

export function DrillScreen({ onExit, random = Math.random }: DrillScreenProps) {
  const { t } = useTranslation();

  // Due passi: prima si sceglie cosa allenare, poi si allena. La scelta parte
  // dall'ultima usata su questo dispositivo.
  const [forms, setForms] = useState<ConjugationForm[]>(() => readFormSelection());
  const [groups, setGroups] = useState<VerbGroup[]>(() => readGroupSelection());
  const [training, setTraining] = useState(false);
  const pool = useMemo(() => drillPool(DRILL_VERBS, forms, groups), [forms, groups]);

  const start = () => {
    if (pool.length === 0) return;
    saveSelection(DRILL_FORMS_STORAGE_KEY, forms);
    saveSelection(DRILL_GROUPS_STORAGE_KEY, groups);
    setTraining(true);
  };

  const backButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[44px] items-center gap-2 uppercase hover:underline ${FOCUS_RING}`}
    >
      <ArrowIcon className="rotate-180" />
      {label}
    </button>
  );

  return (
    <MagazineFrame furiganaToggle>
      {training ? (
        <Training
          pool={pool}
          random={random}
          masthead={(score) => (
            <Masthead
              start={backButton(t('drill.changeSelection'), () => setTraining(false))}
              end={<span>{t('drill.score', score)}</span>}
            />
          )}
        />
      ) : (
        <>
          <Masthead start={backButton(t('drill.back'), onExit)} />
          <Chooser
            forms={forms}
            groups={groups}
            count={pool.length}
            onForms={setForms}
            onGroups={setGroups}
            onStart={start}
          />
        </>
      )}
    </MagazineFrame>
  );
}

const SECTION_HEADING =
  'text-[22px] font-extrabold uppercase leading-tight font-stretch-condensed text-ink-primary';

const SMALL_ACTION = `min-h-[44px] text-label font-semibold text-ink-primary underline underline-offset-4 disabled:text-ink-secondary disabled:no-underline ${FOCUS_RING}`;

/** Il primo passo: cosa allenare, poi «Comincia». */
function Chooser({
  forms,
  groups,
  count,
  onForms,
  onGroups,
  onStart,
}: {
  readonly forms: readonly ConjugationForm[];
  readonly groups: readonly VerbGroup[];
  readonly count: number;
  readonly onForms: (forms: ConjugationForm[]) => void;
  readonly onGroups: (groups: VerbGroup[]) => void;
  readonly onStart: () => void;
}) {
  const { t } = useTranslation();
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onStart();
  };
  return (
    <main className="flex min-h-[24rem] flex-1 flex-col">
      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-8 border-b-[1.5px] border-border-strong p-5 sm:p-8">
          <div className="flex flex-col gap-3">
            <p className={KICKER}>
              {t('drill.title')} · {t('drill.kicker')}
            </p>
            <h2 className={`${SCREEN_TITLE} text-ink-primary`}>{t('drill.settingsHeading')}</h2>
            <p className="max-w-[40rem] text-body text-ink-primary">{t('drill.chooseIntro')}</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <fieldset className="flex flex-col border-t-[1.5px] border-border-strong pt-4">
              <legend className="sr-only">{t('drill.groupsLabel')}</legend>
              <p aria-hidden="true" className={`${SECTION_HEADING} mb-3`}>
                {t('drill.groupsLabel')}
              </p>
              {VERB_GROUPS.map((group) => (
                <label key={group} className={OPTION_LABEL}>
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={groups.includes(group)}
                    onChange={() => onGroups(toggleValue(groups, group, VERB_GROUPS))}
                  />
                  {t(`drill.groups.${group}`)}
                </label>
              ))}
            </fieldset>

            <fieldset className="flex flex-col border-t-[1.5px] border-border-strong pt-4">
              <legend className="sr-only">{t('drill.formsLabel')}</legend>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-5">
                <p aria-hidden="true" className={SECTION_HEADING}>
                  {t('drill.formsLabel')}
                </p>
                <div className="flex gap-5">
                  <button
                    type="button"
                    className={SMALL_ACTION}
                    disabled={forms.length === CONJUGATION_FORMS.length}
                    onClick={() => onForms([...CONJUGATION_FORMS])}
                  >
                    {t('drill.selectAll')}
                  </button>
                  <button
                    type="button"
                    className={SMALL_ACTION}
                    disabled={forms.length === 0}
                    onClick={() => onForms([])}
                  >
                    {t('drill.selectNone')}
                  </button>
                </div>
              </div>
              <div className="gap-x-8 sm:columns-2">
                {/* In colonne, non in griglia: l'ordine del corso si legge dall'alto in
                    basso (cortesi, semplici, poi le forme con un pezzo aggiunto). */}
                {CONJUGATION_FORMS.map((form) => (
                  <label key={form} className={`${OPTION_LABEL} break-inside-avoid`}>
                    <input
                      type="checkbox"
                      className={CHECKBOX}
                      checked={forms.includes(form)}
                      onChange={() => onForms(toggleValue(forms, form, CONJUGATION_FORMS))}
                    />
                    <span className="flex flex-1 items-baseline justify-between gap-2">
                      {t(`drill.forms.${form}`)}
                      <span lang="ja" className="whitespace-nowrap font-jp-read text-ink-secondary">
                        {FORM_MARKERS[form]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <p aria-live="polite" className="text-label text-ink-secondary">
            {count > 0 ? t('drill.poolSize', { value: count }) : t('drill.empty')}
          </p>
        </div>
        <button type="submit" disabled={count === 0} className={`${ACTION_BAR} disabled:bg-ink-secondary`}>
          <span>{t('drill.start')}</span>
          <ArrowIcon className="text-accent-on-ink" />
        </button>
      </form>
    </main>
  );
}

/** Il secondo passo: una domanda per volta sulle forme scelte. */
export function Training({
  pool,
  random,
  masthead,
}: {
  readonly pool: readonly Drill[];
  readonly random: () => number;
  readonly masthead: (score: { right: number; total: number }) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [drill, setDrill] = useState<Drill | null>(() => pickDrill(pool, random));
  const [value, setValue] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  if (!drill) return null;
  const conjugation = conjugate(drill.verb, drill.form);
  const meaning = resolveBilingual(drill.verb.meaning, locale);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (answer) {
      setDrill(pickDrill(pool, random, drill));
      setValue('');
      setAnswer(null);
      input.current?.focus();
      return;
    }
    const given = normalizeAnswer(value);
    if (given === '') return;
    const correct = isCorrectAnswer(value, conjugation);
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
            <p className={KICKER}>
              {t('drill.title')} · {t('drill.kicker')}
            </p>

            {/* Il verbo nella forma del dizionario: l'evento della pagina. */}
            <div>
              <p
                lang="ja"
                className="font-jp-read text-[56px] font-extrabold leading-[1.15] text-ink-primary sm:text-[88px]"
              >
                <Furigana segments={alignFurigana(drill.verb.kanji, drill.verb.kana)} />
              </p>
              <Translation
                text={meaning.text}
                lang={meaning.language}
                className="mt-1 block text-body italic text-ink-secondary"
              />
            </div>

            <div className="border-t-[1.5px] border-border-strong pt-4">
              <p className={KICKER}>{t('drill.askKicker')}</p>
              <h2 className="mt-1 flex flex-wrap items-baseline gap-x-3 text-[30px] font-extrabold uppercase leading-tight font-stretch-condensed text-ink-primary sm:text-[38px]">
                {t(`drill.forms.${drill.form}`)}
                <span lang="ja" className="font-jp-read text-[24px] font-bold normal-case text-accent sm:text-[28px]">
                  {FORM_MARKERS[drill.form]}
                </span>
              </h2>
            </div>

            <label className="flex flex-col gap-2">
              <span className={KICKER}>{t('drill.inputLabel')}</span>
              <input
                ref={input}
                lang="ja"
                value={value}
                readOnly={answer !== null}
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={answer ? 'next' : 'done'}
                aria-describedby="drill-hint"
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={(e) => {
                  composing.current = false;
                  setValue(romajiToKana(e.currentTarget.value));
                }}
                onChange={(e) =>
                  setValue(composing.current ? e.target.value : romajiToKana(e.target.value))
                }
                className={`min-h-[64px] w-full border-[1.5px] border-border-strong bg-surface-raised px-4 font-jp-read text-[28px] text-ink-primary read-only:bg-surface-sunken sm:text-[34px] ${FOCUS_RING}`}
              />
              <span id="drill-hint" className="text-label text-ink-secondary">
                {t('drill.inputHint')}
              </span>
            </label>

            <div aria-live="polite">
              {answer ? <Feedback answer={answer} drill={drill} /> : null}
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

/** L'esito: giusto/sbagliato, la forma giusta, i passaggi e la regola. */
function Feedback({ answer, drill }: { readonly answer: Answer; readonly drill: Drill }) {
  const { t } = useTranslation();
  const c = conjugate(drill.verb, drill.form);
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
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2">
          <dt className="text-label">{t('drill.yourAnswer')}</dt>
          <dd lang="ja" className="font-jp-read text-[24px] line-through">
            {answer.given}
          </dd>
          <dt className="text-label">{t('drill.rightAnswer')}</dt>
          <dd lang="ja" className="font-jp-read text-[30px] font-bold">
            <Furigana segments={alignFurigana(c.result.kanji, c.result.kana)} />
          </dd>
        </dl>
      )}
      <div className="flex flex-col gap-2">
        <p className={`font-mono text-label-caps uppercase ${answer.correct ? 'text-accent-on-ink' : 'text-ink-secondary'}`}>
          {t('drill.steps')}
        </p>
        {/* I passaggi: base → radicale ＋ terminazione → forma. */}
        <p lang="ja" className="font-jp-read text-[22px] leading-relaxed sm:text-[26px]">
          <Furigana segments={alignFurigana(drill.verb.kanji, drill.verb.kana)} />
          {' → '}
          {c.stem ? (
            <>
              <Furigana segments={alignFurigana(c.stem.kanji, c.stem.kana)} />
              {' ＋ '}
              {c.ending}
              {' → '}
            </>
          ) : null}
          <Furigana segments={alignFurigana(c.result.kanji, c.result.kana)} />
        </p>
        <p className="text-body">{t(RULE_KEYS[c.rule])}</p>
        {c.looksIchidan ? <p className="text-body font-semibold">{t('drill.rules.looksIchidan')}</p> : null}
      </div>
    </div>
  );
}
