// Livello features/drill: l'ALLENAMENTO LIBERO sulle forme del verbo. Prima si
// sceglie cosa allenare: una forma alla volta (forme e gruppi di verbi) o il
// costruttore di forme (più forme in catena, `FormBuilder.tsx`). Poi: un verbo, cosa
// produrre, si scrive la risposta (kana, o romaji convertito mentre si scrive),
// poi l'esito coi passaggi e la regola. Fuori dalla pila: nessuna porta,
// nessuna scadenza, nessun salvataggio; il punteggio vive finché si resta qui.
//
// La coniugazione, il controllo e la scelta della domanda sono del dominio
// (`conjugation.ts`, `form-builder.ts`); qui solo lo stato della schermata e il
// caso (`Math.random`), iniettato in `pickDrill`. La navigazione arriva come
// callback (AD-1).
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  CONJUGATION_FORMS,
  FORM_MARKERS,
  VERB_GROUPS,
  conjugate,
  drillPool,
  type ConjugationForm,
  type Drill,
  type VerbGroup,
} from '../../domain/conjugation';
import { DRILL_VERBS } from '../../domain/drill-verbs';
import { buildPool } from '../../domain/form-builder';
import { useTranslation } from '../../i18n';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { Masthead } from '../../ui/Masthead';
import { ArrowIcon } from '../../ui/icons';
import { ACTION_BAR, FOCUS_RING, KICKER, SCREEN_TITLE } from '../../ui/magazine';
import {
  ASK_HEADING,
  CHECKBOX,
  OPTION_LABEL,
  QuestionLoop,
  RULE_KEYS,
  Ruby,
  SECTION_HEADING,
  SMALL_ACTION,
} from './drillParts';
import {
  DRILL_FORMS_STORAGE_KEY,
  DRILL_GROUPS_STORAGE_KEY,
  DRILL_MODES,
  DRILL_RECIPES_STORAGE_KEY,
  readFormSelection,
  readGroupSelection,
  readModeSelection,
  readRecipeSelection,
  saveMode,
  saveSelection,
  toggleValue,
  type DrillMode,
} from './drillSelection';
import { BuilderTraining, RecipeOptions } from './FormBuilder';

export interface DrillScreenProps {
  /** Il ritorno alla dashboard, cablato dal livello app. */
  readonly onExit: () => void;
  /** Il caso, in [0, 1). Iniettabile per i test; predefinito `Math.random`. */
  readonly random?: () => number;
}

export function DrillScreen({ onExit, random = Math.random }: DrillScreenProps) {
  const { t } = useTranslation();

  // Due passi: prima si sceglie cosa allenare, poi si allena. La scelta parte
  // dall'ultima usata su questo dispositivo.
  const [mode, setMode] = useState<DrillMode>(() => readModeSelection());
  const [forms, setForms] = useState<ConjugationForm[]>(() => readFormSelection());
  const [recipes, setRecipes] = useState<string[]>(() => readRecipeSelection());
  const [groups, setGroups] = useState<VerbGroup[]>(() => readGroupSelection());
  const [training, setTraining] = useState(false);
  const formPool = useMemo(() => drillPool(DRILL_VERBS, forms, groups), [forms, groups]);
  const recipePool = useMemo(() => buildPool(DRILL_VERBS, recipes, groups), [recipes, groups]);
  const count = mode === 'forms' ? formPool.length : recipePool.length;

  const start = () => {
    if (count === 0) return;
    saveMode(mode);
    saveSelection(DRILL_FORMS_STORAGE_KEY, forms);
    saveSelection(DRILL_RECIPES_STORAGE_KEY, recipes);
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

  const masthead = (score: { right: number; total: number }) => (
    <Masthead
      start={backButton(t('drill.changeSelection'), () => setTraining(false))}
      end={<span>{t('drill.score', score)}</span>}
    />
  );

  return (
    <MagazineFrame furiganaToggle>
      {!training ? (
        <>
          <Masthead start={backButton(t('drill.back'), onExit)} />
          <Chooser
            mode={mode}
            forms={forms}
            recipes={recipes}
            groups={groups}
            count={count}
            onMode={setMode}
            onForms={setForms}
            onRecipes={setRecipes}
            onGroups={setGroups}
            onStart={start}
          />
        </>
      ) : mode === 'forms' ? (
        <Training pool={formPool} random={random} masthead={masthead} />
      ) : (
        <BuilderTraining pool={recipePool} random={random} masthead={masthead} />
      )}
    </MagazineFrame>
  );
}

/** Il primo passo: come allenarsi, cosa allenare, poi «Comincia». */
function Chooser({
  mode,
  forms,
  recipes,
  groups,
  count,
  onMode,
  onForms,
  onRecipes,
  onGroups,
  onStart,
}: {
  readonly mode: DrillMode;
  readonly forms: readonly ConjugationForm[];
  readonly recipes: readonly string[];
  readonly groups: readonly VerbGroup[];
  readonly count: number;
  readonly onMode: (mode: DrillMode) => void;
  readonly onForms: (forms: ConjugationForm[]) => void;
  readonly onRecipes: (recipes: string[]) => void;
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
          </div>

          {/* Le due modalità: una forma alla volta, o più forme in catena. */}
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">{t('drill.modeLabel')}</legend>
            {DRILL_MODES.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer gap-3 border-[1.5px] border-border-strong p-4 text-ink-primary has-[:checked]:bg-ink-primary has-[:checked]:text-surface-base"
              >
                <input
                  type="radio"
                  name="drill-mode"
                  className={`mt-1 ${CHECKBOX}`}
                  checked={mode === option}
                  onChange={() => onMode(option)}
                />
                <span className="flex flex-col gap-1">
                  <span className="text-[22px] font-extrabold uppercase leading-tight font-stretch-condensed">
                    {t(`drill.modes.${option}.name`)}
                  </span>
                  <span className="text-label">{t(`drill.modes.${option}.hint`)}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="max-w-[40rem] text-body text-ink-primary">
            {t(`drill.modes.${mode}.intro`)}
          </p>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <fieldset className="flex flex-col self-start border-t-[1.5px] border-border-strong pt-4">
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

            {mode === 'forms' ? (
              <FormOptions forms={forms} onForms={onForms} />
            ) : (
              <RecipeOptions recipes={recipes} onRecipes={onRecipes} />
            )}
          </div>

          <p aria-live="polite" className="text-label text-ink-secondary">
            {count > 0
              ? t(mode === 'forms' ? 'drill.poolSize' : 'drill.builder.poolSize', { value: count })
              : t(mode === 'forms' ? 'drill.empty' : 'drill.builder.empty')}
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

/** La scelta delle forme singole. */
function FormOptions({
  forms,
  onForms,
}: {
  readonly forms: readonly ConjugationForm[];
  readonly onForms: (forms: ConjugationForm[]) => void;
}) {
  const { t } = useTranslation();
  return (
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
  );
}

/** Il secondo passo, una forma alla volta: una domanda per volta sulle forme scelte. */
export function Training({
  pool,
  random,
  masthead,
}: {
  readonly pool: readonly Drill[];
  readonly random: () => number;
  readonly masthead: (score: { right: number; total: number }) => ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <QuestionLoop
      pool={pool}
      random={random}
      masthead={masthead}
      kicker={`${t('drill.title')} · ${t('drill.kicker')}`}
      resultOf={(d) => conjugate(d.verb, d.form).result}
      ask={(d) => (
        <>
          <p className={KICKER}>{t('drill.askKicker')}</p>
          <h2 className={ASK_HEADING}>
            {t(`drill.forms.${d.form}`)}
            <span lang="ja" className="font-jp-read text-[24px] font-bold normal-case text-accent sm:text-[28px]">
              {FORM_MARKERS[d.form]}
            </span>
          </h2>
        </>
      )}
      explain={(d) => <FormSteps drill={d} />}
    />
  );
}

/** I passaggi di una forma: base → radicale ＋ terminazione → forma, e la regola. */
function FormSteps({ drill }: { readonly drill: Drill }) {
  const { t } = useTranslation();
  const c = conjugate(drill.verb, drill.form);
  return (
    <>
      <p lang="ja" className="font-jp-read text-[22px] leading-relaxed sm:text-[26px]">
        <Ruby spelling={drill.verb} />
        {' → '}
        {c.stem ? (
          <>
            <Ruby spelling={c.stem} />
            {' ＋ '}
            {c.ending}
            {' → '}
          </>
        ) : null}
        <Ruby spelling={c.result} />
      </p>
      <p className="text-body">{t(RULE_KEYS[c.rule])}</p>
      {c.looksIchidan ? <p className="text-body font-semibold">{t('drill.rules.looksIchidan')}</p> : null}
    </>
  );
}
