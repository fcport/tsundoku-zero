// Livello features/lessons: l'INDICE della pagina Lezioni (08-11-2026). Una fila di
// numeri, uno per lezione, che resta in cima allo schermo mentre la pagina scorre:
// un tocco porta alla scheda della lezione. Con il corso che cresce la fila scorre
// di lato, e all'apertura si centra sulla lezione in corso.
//
// I numeri hanno i toni della libreria: rosso le imparate, inchiostro le aperte (la
// in corso piena), grigio le chiuse. Ogni link dice a parole numero e stato.
import { useEffect, useRef, type MouseEvent } from 'react';
import type { ShelfEntry } from '../../domain/curriculum';
import type { LessonMastery } from '../../domain/library';
import { useTranslation } from '../../i18n';
import { FOCUS_RING, KICKER } from '../../ui/magazine';

/** L'id della scheda di una lezione nell'elenco: il bersaglio dell'indice. */
export function lessonAnchorId(ordinal: number): string {
  return `lezione-${ordinal}`;
}

export interface LessonIndexProps {
  readonly shelf: readonly ShelfEntry[];
  readonly mastery: ReadonlyMap<string, LessonMastery> | null;
}

export function LessonIndex({ shelf, mastery }: LessonIndexProps) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);

  // All'apertura la fila mostra la lezione in corso, al centro (solo di lato: la
  // pagina non si muove).
  useEffect(() => {
    const row = rowRef.current;
    const current = currentRef.current;
    if (!row || !current) return;
    row.scrollLeft = current.offsetLeft - row.clientWidth / 2 + current.offsetWidth / 2;
  }, []);

  // Il salto alla scheda: niente voce nella cronologia (il «indietro» del browser
  // resta il ritorno alla dashboard) e il fuoco sulla scheda, per tastiera e AT.
  const jump = (event: MouseEvent<HTMLAnchorElement>, ordinal: number) => {
    const target = document.getElementById(lessonAnchorId(ordinal));
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  };

  return (
    <nav
      aria-label={t('lessons.index.label')}
      className="sticky top-0 z-20 flex items-center gap-3 border-b-[1.5px] border-border-strong bg-surface-base py-1 pl-5 sm:gap-4 sm:pl-8"
    >
      <p aria-hidden="true" className={`${KICKER} shrink-0`}>
        {t('lessons.index.kicker')}
      </p>
      {/* Il margine interno lascia posto all'anello del fuoco, che la fila taglierebbe.
          Niente barra di scorrimento: il numero tagliato sul bordo dice che continua. */}
      <ol
        ref={rowRef}
        className="relative flex min-w-0 flex-1 gap-1 overflow-x-auto p-1 pr-5 [scrollbar-width:none] sm:pr-8 [&::-webkit-scrollbar]:hidden"
      >
        {shelf.map(({ lesson, status }) => {
          const open = status === 'current' || status === 'unlocked';
          const read = open && mastery?.get(lesson.id)?.read === true;
          const tone = read
            ? 'border-accent bg-accent text-surface-base'
            : status === 'current'
              ? 'border-ink-primary bg-ink-primary text-surface-base'
              : open
                ? 'border-ink-primary text-ink-primary hover:bg-surface-sunken'
                : 'border-border-hairline text-ink-secondary hover:bg-surface-sunken';
          return (
            <li key={lesson.id} className="shrink-0">
              <a
                ref={status === 'current' ? currentRef : undefined}
                href={`#${lessonAnchorId(lesson.ordinal)}`}
                onClick={(event) => jump(event, lesson.ordinal)}
                aria-label={`${t('lessons.lessonNumber', { order: lesson.ordinal })} · ${t(`lessons.status.${status}`)}`}
                className={`flex size-11 items-center justify-center border-[1.5px] text-[20px] font-black leading-none font-stretch-extra-condensed ${tone} ${
                  status === 'current' && !read ? 'border-t-[4px] border-t-accent' : ''
                } ${FOCUS_RING}`}
              >
                {String(lesson.ordinal).padStart(2, '0')}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
