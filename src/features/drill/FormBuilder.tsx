// Livello features/drill: il COSTRUTTORE DI FORME, la seconda modalità
// dell'allenamento libero. Si chiede una catena di pezzi (passivo, poi たい, poi il
// passato: 褒められたかった) e dopo la risposta si mostrano i passaggi uno per uno,
// ciascuno con la sua regola e con cosa diventa la parola (un nuovo verbo ichidan,
// una parola in い). La catena e i passaggi sono del dominio (`form-builder.ts`).
import type { ReactNode } from 'react';
import { FORM_MARKERS } from '../../domain/conjugation';
import { DRILL_VERBS } from '../../domain/drill-verbs';
import {
  GROUP_PIECES,
  ORDER_EXAMPLE,
  PIECE_GROUPS,
  RECIPES,
  RECIPE_IDS,
  RECIPE_LENGTHS,
  buildForm,
  pieceCount,
  recipeExample,
  type Build,
  type BuildRule,
  type BuildStep,
  type FormPiece,
} from '../../domain/form-builder';
import { resolveBilingual } from '../../domain/bilingual';
import { resolveLocale, useTranslation } from '../../i18n';
import { ArrowIcon } from '../../ui/icons';
import { FOCUS_RING, KICKER } from '../../ui/magazine';
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
import { toggleValue } from './drillSelection';

/** Le regole della parola in い e di ませんでした, oltre a quelle del verbo. */
const BUILD_RULE_KEYS = {
  ...RULE_KEYS,
  'adjective-negative': 'drill.builder.rules.adjectiveNegative',
  'adjective-past': 'drill.builder.rules.adjectivePast',
  desu: 'drill.builder.rules.desu',
  'masen-deshita': 'drill.builder.rules.masenDeshita',
  garu: 'drill.builder.rules.garu',
} as const satisfies Record<BuildRule, string>;

/** L'etichetta giapponese di ogni pezzo, quando non si sa ancora a cosa si attacca. */
const PIECE_MARKERS: Readonly<Record<FormPiece, string>> = {
  causative: FORM_MARKERS.causative,
  passive: FORM_MARKERS.passive,
  potential: FORM_MARKERS.potential,
  sugiru: '〜すぎる',
  teiru: FORM_MARKERS.teiru,
  tai: FORM_MARKERS.tai,
  garu: '〜がる',
  negative: FORM_MARKERS.nai,
  past: FORM_MARKERS.ta,
  polite: '〜です／ます',
  politePast: FORM_MARKERS.mashita,
  politeNegativePast: '〜ませんでした',
};

/** L'etichetta di un passaggio: il cortese è です dopo una parola in い, ます dopo un verbo. */
function pieceMarker(step: BuildStep): string {
  if (step.piece === 'polite') return step.rules[0] === 'desu' ? '〜です' : FORM_MARKERS.masu;
  return PIECE_MARKERS[step.piece];
}

const CHIP =
  'flex items-baseline gap-2 border-[1.5px] border-border-strong px-3 py-1 text-label font-semibold text-ink-primary';

/**
 * Come si mettono in ordine i pezzi: la regola, i gruppi nell'ordine in cui si
 * attaccano e un esempio intero spezzato. Si apre dalla scelta e da ogni domanda.
 */
export function OrderGuide() {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const verb = DRILL_VERBS.find((v) => v.kanji === ORDER_EXAMPLE.verb)!;
  const labels = [
    resolveBilingual(verb.meaning, locale).text,
    ...ORDER_EXAMPLE.pieces.map((piece) => t(`drill.builder.pieces.${piece}`)),
  ];
  return (
    <details className="group border-[1.5px] border-border-strong">
      <summary
        className={`flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-label font-semibold text-ink-primary [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}
      >
        {t('drill.builder.order.title')}
        <ArrowIcon className="shrink-0 rotate-90 transition-transform group-open:-rotate-90" />
      </summary>
      <div className="flex flex-col gap-5 border-t-[1.5px] border-border-strong p-4 text-ink-primary">
        <p className="text-body">{t('drill.builder.order.rule')}</p>
        <ol className="flex flex-col gap-4">
          {PIECE_GROUPS.map((group, index) => (
            <li key={group} className="flex flex-col gap-2">
              <p className="text-[20px] font-extrabold uppercase leading-tight font-stretch-condensed">
                {index + 1}. {t(`drill.builder.order.groups.${group}.name`)}
              </p>
              <ul className="flex flex-wrap gap-2">
                {GROUP_PIECES[group].map((piece) => (
                  <li key={piece} className={CHIP}>
                    {t(`drill.builder.pieces.${piece}`)}
                    <span lang="ja" className="font-jp-read font-bold text-accent">
                      {PIECE_MARKERS[piece]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-body">{t(`drill.builder.order.groups.${group}.text`)}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 border-t-[1.5px] border-border-strong pt-4">
          <p className={KICKER}>{t('drill.builder.order.example')}</p>
          {/* Ogni pezzo sopra il suo nome: si legge da sinistra a destra in giapponese,
              da destra a sinistra in italiano. */}
          <ol className="flex flex-wrap gap-x-4 gap-y-3">
            {ORDER_EXAMPLE.segments.map((segment, index) => (
              <li key={index} className="flex flex-col items-center gap-1">
                <span lang="ja" className="font-jp-read text-[24px] font-bold leading-none sm:text-[28px]">
                  {segment}
                </span>
                <span className="text-[12px] text-ink-secondary">{labels[index]}</span>
              </li>
            ))}
          </ol>
          <p className="text-body">{t('drill.builder.order.exampleText')}</p>
        </div>
      </div>
    </details>
  );
}

const LENGTH_KEYS: Readonly<Record<number, 'drill.builder.length2' | 'drill.builder.length3' | 'drill.builder.length4'>> = {
  2: 'drill.builder.length2',
  3: 'drill.builder.length3',
  4: 'drill.builder.length4',
};

/** La scelta delle catene, divise per quanti pezzi hanno. */
export function RecipeOptions({
  recipes,
  onRecipes,
}: {
  readonly recipes: readonly string[];
  readonly onRecipes: (recipes: string[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  return (
    <fieldset className="flex flex-col border-t-[1.5px] border-border-strong pt-4">
      <legend className="sr-only">{t('drill.builder.recipesLabel')}</legend>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-5">
        <p aria-hidden="true" className={SECTION_HEADING}>
          {t('drill.builder.recipesLabel')}
        </p>
        <div className="flex gap-5">
          <button
            type="button"
            className={SMALL_ACTION}
            disabled={recipes.length === RECIPE_IDS.length}
            onClick={() => onRecipes([...RECIPE_IDS])}
          >
            {t('drill.selectAll')}
          </button>
          <button
            type="button"
            className={SMALL_ACTION}
            disabled={recipes.length === 0}
            onClick={() => onRecipes([])}
          >
            {t('drill.selectNone')}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {RECIPE_LENGTHS.map((length) => (
          <div key={length}>
            <p className={`${KICKER} mb-1`}>{t(LENGTH_KEYS[length]!)}</p>
            <div className="gap-x-8 sm:columns-2">
              {RECIPES.filter((r) => pieceCount(r) === length).map((recipe) => (
                <label key={recipe.id} className={`${OPTION_LABEL} break-inside-avoid`}>
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={recipes.includes(recipe.id)}
                    onChange={() => onRecipes(toggleValue(recipes, recipe.id, RECIPE_IDS))}
                  />
                  <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-2">
                    {resolveBilingual(recipe.meaning, locale).text}
                    <span lang="ja" className="whitespace-nowrap font-jp-read text-ink-secondary">
                      {recipeExample(recipe, DRILL_VERBS).kanji}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/** Le catene da costruire, una domanda per volta. */
export function BuilderTraining({
  pool,
  random,
  masthead,
}: {
  readonly pool: readonly Build[];
  readonly random: () => number;
  readonly masthead: (score: { right: number; total: number }) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const built = (b: Build) => buildForm(b.verb, b.recipe.pieces);
  return (
    <QuestionLoop
      pool={pool}
      random={random}
      masthead={masthead}
      kicker={`${t('drill.title')} · ${t('drill.builder.name')}`}
      resultOf={(b) => built(b).result}
      ask={(b) => (
        <>
          <p className={KICKER}>{t('drill.builder.askKicker')}</p>
          <h2 className={ASK_HEADING}>{resolveBilingual(b.recipe.meaning, locale).text}</h2>
          {/* I pezzi, nell'ordine in cui si attaccano. */}
          <ol
            aria-label={t('drill.builder.piecesLabel')}
            className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2"
          >
            {built(b).steps.map((step, index) => (
              <li key={index} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-ink-secondary">
                    →
                  </span>
                ) : null}
                <span className={CHIP}>
                  {t(`drill.builder.pieces.${step.piece}`)}
                  <span lang="ja" className="font-jp-read font-bold text-accent">
                    {pieceMarker(step)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <OrderGuide />
          </div>
        </>
      )}
      explain={(b, correct) => <BuildSteps steps={built(b).steps} correct={correct} />}
    />
  );
}

/** I passaggi: da dove si parte, cosa si attacca, cosa si ottiene, perché. */
function BuildSteps({
  steps,
  correct,
}: {
  readonly steps: readonly BuildStep[];
  readonly correct: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li
            key={index}
            className={`flex flex-col gap-1 ${index > 0 ? `border-t pt-3 ${correct ? 'border-surface-base/30' : 'border-border-strong'}` : ''}`}
          >
            <p className="text-label font-semibold">
              {index + 1}. {t(`drill.builder.pieces.${step.piece}`)}
            </p>
            {/* Da dove si parte (solo al primo passaggio: poi è la riga sopra),
                cosa si attacca, cosa si ottiene. Si va a capo solo fra i blocchi,
                mai dentro una parola. */}
            <p lang="ja" className="font-jp-read text-[22px] leading-relaxed sm:text-[26px]">
              {index === 0 ? (
                <>
                  <span className="inline-block whitespace-nowrap">
                    <Ruby spelling={step.from} />
                    {' →'}
                  </span>{' '}
                </>
              ) : null}
              {step.stem ? (
                <>
                  <span className="inline-block whitespace-nowrap">
                    <Ruby spelling={step.stem} />
                  </span>{' '}
                  <span className="inline-block whitespace-nowrap">
                    {'＋ '}
                    {step.ending}
                    {' →'}
                  </span>{' '}
                </>
              ) : null}
              <span className="inline-block whitespace-nowrap">
                <Ruby spelling={step.to} />
              </span>
            </p>
            {step.rules.map((rule) => (
              <p key={rule} className="text-body">
                {t(BUILD_RULE_KEYS[rule])}
              </p>
            ))}
            {step.looksIchidan ? (
              <p className="text-body font-semibold">{t('drill.rules.looksIchidan')}</p>
            ) : null}
            {!last && step.becomes ? (
              <p className="text-body font-semibold">{t(`drill.builder.becomes.${step.becomes}`)}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

