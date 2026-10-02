// Livello features/lessons: il riquadro «Da ripassare» in cima alla pagina Lezioni
// (02-10-2026). Le lezioni dove sbagli di più nelle ultime due settimane
// (`weakLessons`, dominio puro), ciascuna con la regola che sbagli più spesso e la
// strada per ristudiarla: il ripasso libero, «Esercitati di più» se ha una riserva,
// il video. Senza lezioni in classifica il riquadro non c'è.
//
// Presentazionale: dati e azioni arrivano dalla pagina, che possiede le query e la
// mutazione (le stesse dell'elenco sotto).
import { resolveBilingual } from '../../domain/bilingual';
import { GRAMMAR_POINT_MEANINGS, grammarPointSegments } from '../../domain/fixed-readings';
import { exerciseReserve } from '../../domain/lesson';
import {
  WEAK_LESSONS_MIN_ANSWERS,
  WEAK_LESSONS_WINDOW_DAYS,
  type WeakLesson,
} from '../../domain/weakLessons';
import { resolveLocale, useTranslation } from '../../i18n';
import { Furigana } from '../../ui/Furigana';
import { Translation } from '../../ui/Translation';
import { ArrowIcon, ExternalIcon } from '../../ui/icons';
import { lessonNumberSegments } from '../../ui/kanjiDate';
import { FOCUS_RING, KICKER, SERVICE_LINK } from '../../ui/magazine';

export interface WeakLessonsProps {
  readonly weak: readonly WeakLesson[];
  /** Per lezione, quanti esercizi sono già in pila (`undefined` finché carica). */
  readonly active: ReadonlyMap<string, number> | undefined;
  readonly onPractice: (lessonId: string) => void;
  readonly onMore: (lessonId: string) => void;
  readonly morePending: boolean;
  /** L'esito dell'ultimo «Esercitati di più», mostrato sotto la sua lezione. */
  readonly added: { readonly lessonId: string; readonly value: number } | null;
}

const RATE_NUMBER = 'font-black leading-[0.85] font-stretch-extra-condensed text-accent';

export function WeakLessons({ weak, active, onPractice, onMore, morePending, added }: WeakLessonsProps) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  if (weak.length === 0) return null;

  return (
    <section aria-labelledby="weak-lessons-title" className="border-b-[1.5px] border-border-strong bg-surface-raised">
      <div className="flex flex-col gap-2 border-b-[1.5px] border-border-strong p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:px-8 sm:pb-5 sm:pt-7">
        <div className="flex flex-col gap-2">
          <p className={`${KICKER} text-accent`}>{t('lessons.weak.kicker', { days: WEAK_LESSONS_WINDOW_DAYS })}</p>
          <h2
            id="weak-lessons-title"
            className="text-[30px] font-extrabold uppercase leading-[0.95] font-stretch-extra-condensed text-ink-primary sm:text-[40px]"
          >
            {t('lessons.weak.title')}
          </h2>
        </div>
        <p className="max-w-[22rem] text-label text-ink-secondary sm:text-right">
          {t('lessons.weak.note', { min: WEAK_LESSONS_MIN_ANSWERS })}
        </p>
      </div>

      <ol>
        {weak.map(({ lesson, total, errors, errorRate, worstRule }, index) => {
          const title = resolveBilingual(lesson.title, locale);
          const percent = `${Math.round(errorRate * 100)}%`;
          const meaning = GRAMMAR_POINT_MEANINGS[worstRule.grammarPoint];
          const resolvedMeaning = meaning ? resolveBilingual(meaning, locale) : null;
          const reserve = exerciseReserve(lesson.exerciseCount, active?.get(lesson.id));
          const lessonLabel = t('lessons.lessonNumber', { order: lesson.ordinal });
          const rate = (size: string, barHeight: string) => (
            <div className="flex flex-col gap-2">
              <p className="flex items-baseline gap-2">
                <span className={`${RATE_NUMBER} ${size}`}>{percent}</span>
                <span className="text-label font-semibold text-ink-primary">{t('lessons.weak.wrong')}</span>
              </p>
              <div aria-hidden="true" className={`${barHeight} bg-surface-sunken`}>
                <div className={`${barHeight} bg-accent`} style={{ width: percent }} />
              </div>
              <p className="text-label text-ink-secondary">{t('lessons.weak.answers', { errors, total })}</p>
            </div>
          );
          return (
            <li
              key={lesson.id}
              className="grid grid-cols-[72px_minmax(0,1fr)] border-b-[1.5px] border-border-strong last:border-b-0 sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[120px_minmax(0,1fr)_260px]"
            >
              <div className="flex flex-col items-start gap-1 border-r-[1.5px] border-border-strong p-3 sm:p-5">
                <span className="font-mono text-[12px] text-ink-secondary">{t('lessons.weak.rank', { value: index + 1 })}</span>
                <span aria-hidden="true" className="text-[44px] font-black leading-[0.85] font-stretch-extra-condensed text-ink-primary sm:text-[64px]">
                  {String(lesson.ordinal).padStart(2, '0')}
                </span>
                <span aria-hidden="true" lang="ja" className="whitespace-nowrap font-jp text-[11px] font-bold text-ink-secondary sm:text-[13px]">
                  <Furigana segments={lessonNumberSegments(lesson.ordinal)} />
                </span>
              </div>

              <div className="flex min-w-0 flex-col gap-3 p-4 sm:px-6 sm:py-5">
                {/* Sotto 1024px la percentuale sta qui, sopra il titolo. */}
                <div className="lg:hidden">{rate('text-[44px]', 'h-[6px]')}</div>
                <h3 lang={title.language} className="text-[18px] font-bold leading-snug text-ink-primary sm:text-[22px]">
                  <span className="sr-only">{lessonLabel} · </span>
                  {title.text}
                </h3>
                <div className="flex flex-col gap-1">
                  <p className={KICKER}>{t('lessons.weak.worstRule')}</p>
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span lang="ja" className="font-jp text-[18px] font-bold text-ink-primary">
                      <Furigana segments={grammarPointSegments(worstRule.grammarPoint) ?? [{ text: worstRule.grammarPoint, ruby: null }]} />
                    </span>
                    {resolvedMeaning ? (
                      <Translation
                        text={resolvedMeaning.text}
                        lang={resolvedMeaning.language}
                        className="text-label italic text-ink-secondary"
                      />
                    ) : null}
                    <span className="text-label text-ink-secondary">
                      {worstRule.errors === 1
                        ? t('lessons.weak.ruleErrorsOne')
                        : t('lessons.weak.ruleErrors', { value: worstRule.errors })}
                    </span>
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <button
                    type="button"
                    onClick={() => onPractice(lesson.id)}
                    aria-label={`${t('lessons.practice')}: ${lessonLabel}`}
                    className={`group flex min-h-[44px] items-center gap-3 border-[1.5px] border-ink-primary bg-ink-primary px-4 text-[15px] font-extrabold uppercase font-stretch-condensed text-surface-base ${FOCUS_RING}`}
                  >
                    {t('lessons.practice')}
                    <ArrowIcon className="text-accent-on-ink transition-transform group-hover:translate-x-1" />
                  </button>
                  {reserve > 0 ? (
                    <button
                      type="button"
                      onClick={() => onMore(lesson.id)}
                      disabled={morePending}
                      aria-label={`${t('lessons.more')}: ${lessonLabel}`}
                      className={`flex min-h-[44px] items-center gap-3 border-[1.5px] border-ink-primary px-4 text-[15px] font-extrabold uppercase font-stretch-condensed text-ink-primary hover:bg-surface-sunken disabled:opacity-60 ${FOCUS_RING}`}
                    >
                      {t('lessons.more')}
                      <span aria-hidden="true" className="text-accent">+</span>
                    </button>
                  ) : null}
                  {lesson.video ? (
                    <a
                      href={`https://www.youtube.com/watch?v=${lesson.video}`}
                      target="_blank"
                      rel="noreferrer"
                      className={SERVICE_LINK}
                    >
                      {t('lessons.video')} <ExternalIcon />
                    </a>
                  ) : null}
                </div>
                {added?.lessonId === lesson.id ? (
                  <p role="status" className="text-label font-semibold text-ink-primary">
                    {added.value > 0
                      ? t('lessons.moreDone', { value: added.value })
                      : t('lessons.moreNone')}
                  </p>
                ) : null}
              </div>

              <div className="hidden flex-col justify-center border-l-[1.5px] border-border-strong px-6 py-5 lg:flex">
                {rate('text-[64px]', 'h-2')}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
