// Livello features/lessons: la pagina LEZIONI. Tutto il curriculum in ordine, ogni
// lezione col suo stato (in corso, sbloccata, la prossima, bloccata), le regole che
// insegna, il video di riferimento e, per le sbloccate con esercizi, l'ingresso al
// ripasso libero. Prima una lezione passata non si poteva più riaprire: gli esercizi
// tornavano solo quando la pila li rimetteva in coda.
//
// Legge le STESSE chiavi della dashboard (`['lessons']`, `['unlocked', userId]`), così
// arriva da cache calda; lo stato di ciascuna lezione è DERIVATO (`lessonShelf`), mai
// memorizzato. Le porte arrivano da `usePorts()`, la navigazione come callback (AD-1).
import { useQuery } from '@tanstack/react-query';
import { resolveBilingual } from '../../domain/bilingual';
import { lessonShelf, type LessonStatus } from '../../domain/curriculum';
import { GRAMMAR_POINT_MEANINGS, grammarPointSegments } from '../../domain/fixed-readings';
import { RESERVED_ORDER_START } from '../../domain/lesson';
import { resolveLocale, useTranslation } from '../../i18n';
import { Furigana } from '../../ui/Furigana';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { Masthead } from '../../ui/Masthead';
import { Translation } from '../../ui/Translation';
import { ArrowIcon, ExternalIcon } from '../../ui/icons';
import { lessonNumberSegments } from '../../ui/kanjiDate';
import { FOCUS_RING, KICKER, SCREEN_TITLE, SERVICE_LINK } from '../../ui/magazine';
import { usePorts } from '../ports/PortsContext';

export interface LessonsScreenProps {
  /** L'id dell'utente corrente, o `null` finché non è risolto (scheletro). */
  readonly userId: string | null;
  /** Il ritorno alla dashboard, cablato dal livello app. */
  readonly onExit: () => void;
  /** Apre il ripasso libero della lezione indicata, cablato dal livello app. */
  readonly onPractice: (lessonId: string) => void;
}

// Le lezioni aperte: si ripassano e mostrano il video.
const OPEN: ReadonlySet<LessonStatus> = new Set(['current', 'unlocked']);

export function LessonsScreen({ userId, onExit, onPractice }: LessonsScreenProps) {
  const { t } = useTranslation();
  return (
    <MagazineFrame furiganaToggle>
      <Masthead
        start={
          <button
            type="button"
            onClick={onExit}
            className={`flex min-h-[44px] items-center gap-2 uppercase hover:underline ${FOCUS_RING}`}
          >
            <ArrowIcon className="rotate-180" />
            {t('lessons.back')}
          </button>
        }
      />
      <LessonsContent userId={userId} onPractice={onPractice} />
    </MagazineFrame>
  );
}

function LessonsContent({
  userId,
  onPractice,
}: Pick<LessonsScreenProps, 'userId' | 'onPractice'>) {
  const { progress, content } = usePorts();
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);

  const unlockedQ = useQuery({
    queryKey: ['unlocked', userId],
    enabled: !!userId,
    queryFn: () => progress.listUnlockedLessons(),
  });
  const lessonsQ = useQuery({
    queryKey: ['lessons'],
    queryFn: () => content.listLessons(),
  });

  const header = (
    <div className="flex flex-col gap-3 border-b-[1.5px] border-border-strong p-5 sm:p-8">
      <p className={KICKER}>{t('lessons.kicker')}</p>
      <h2 className={`${SCREEN_TITLE} text-ink-primary`}>{t('lessons.title')}</h2>
      <p className="max-w-[40rem] text-body text-ink-primary">{t('lessons.intro')}</p>
    </div>
  );

  if (!userId || unlockedQ.data === undefined || lessonsQ.data === undefined) {
    return (
      <main aria-busy="true" className="flex min-h-[24rem] flex-1 flex-col">
        {header}
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[132px] border-b-[1.5px] border-border-strong bg-surface-sunken" />
        ))}
      </main>
    );
  }

  const curriculum = lessonsQ.data.filter((l) => l.ordinal < RESERVED_ORDER_START);
  const shelf = lessonShelf(
    curriculum,
    unlockedQ.data.map((u) => u.lessonId),
  );

  return (
    <main className="flex min-h-[24rem] flex-1 flex-col">
      {header}
      <ol>
        {shelf.map(({ lesson, status }) => {
          const title = resolveBilingual(lesson.title, locale);
          const open = OPEN.has(status);
          return (
            <li
              key={lesson.id}
              aria-current={status === 'current' ? 'step' : undefined}
              className={`grid grid-cols-[72px_minmax(0,1fr)] border-b-[1.5px] border-border-strong sm:grid-cols-[120px_minmax(0,1fr)] ${
                status === 'current' ? 'bg-surface-raised' : ''
              }`}
            >
              {/* Il numero della lezione, grande e condensato, col suo 第N課. */}
              <div
                className={`flex flex-col items-start gap-1 border-r-[1.5px] border-border-strong p-3 sm:p-5 ${
                  status === 'current' ? 'border-l-[6px] border-l-accent' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`text-[44px] font-black leading-[0.85] font-stretch-extra-condensed sm:text-[64px] ${
                    open ? 'text-ink-primary' : 'text-ink-secondary'
                  }`}
                >
                  {String(lesson.ordinal).padStart(2, '0')}
                </span>
                <span aria-hidden="true" lang="ja" className="whitespace-nowrap font-jp text-[11px] font-bold text-ink-secondary sm:text-[13px]">
                  <Furigana segments={lessonNumberSegments(lesson.ordinal)} />
                </span>
              </div>

              <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-6">
                <p className={`${KICKER} ${status === 'current' ? 'text-accent' : ''}`}>
                  <span className="sr-only">{t('lessons.lessonNumber', { order: lesson.ordinal })} · </span>
                  {t(`lessons.status.${status}`)}
                </p>
                <h3
                  lang={title.language}
                  className={`text-[20px] font-bold leading-snug sm:text-[24px] ${
                    open ? 'text-ink-primary' : 'text-ink-secondary'
                  }`}
                >
                  {title.text}
                </h3>

                {/* Le regole della lezione: il giapponese con la furigana, e la
                    traduzione con «Traduzioni» acceso. Anche per le bloccate: sapere
                    cosa arriva non toglie niente. */}
                <div>
                  <p className="sr-only">{t('lessons.rules')}</p>
                  <ul className="flex flex-wrap gap-x-5 gap-y-2">
                    {lesson.grammarPoints.map((point) => {
                      const meaning = GRAMMAR_POINT_MEANINGS[point];
                      const resolved = meaning ? resolveBilingual(meaning, locale) : null;
                      return (
                        <li key={point} className="flex items-baseline gap-2">
                          <span lang="ja" className={`font-jp text-[16px] font-bold ${open ? 'text-ink-primary' : 'text-ink-secondary'}`}>
                            <Furigana segments={grammarPointSegments(point) ?? [{ text: point, ruby: null }]} />
                          </span>
                          {resolved ? (
                            <Translation
                              text={resolved.text}
                              lang={resolved.language}
                              className="text-label italic text-ink-secondary"
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <p className="text-label text-ink-secondary">
                  {lesson.exerciseCount > 0
                    ? t('lessons.exercises', { value: lesson.exerciseCount })
                    : t('lessons.noExercises')}
                </p>
                {status === 'next' ? (
                  <p className="text-label font-semibold text-ink-primary">{t('lessons.nextHint')}</p>
                ) : null}

                {open ? (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    {lesson.exerciseCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => onPractice(lesson.id)}
                        aria-label={`${t('lessons.practice')}: ${t('lessons.lessonNumber', { order: lesson.ordinal })}`}
                        className={`group flex min-h-[44px] items-center gap-3 border-[1.5px] border-ink-primary bg-ink-primary px-4 text-[15px] font-extrabold uppercase font-stretch-condensed text-surface-base ${FOCUS_RING}`}
                      >
                        {t('lessons.practice')}
                        <ArrowIcon className="text-accent-on-ink transition-transform group-hover:translate-x-1" />
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
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
