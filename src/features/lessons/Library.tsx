// Livello features/lessons: la LIBRERIA (07-10-2026), in testa alla pagina Lezioni.
// Ogni lezione del curriculum è un dorso sullo scaffale: rosso quando è imparata (il
// colore del timbro 習得), carta con l'inchiostro che sale man mano che ne sai bene
// gli esercizi quando è sbloccata, incavato quando è ancora chiusa. I dorsi vanno a
// capo su più ripiani quando il corso cresce.
//
// Lo scaffale è decorativo (`aria-hidden`): per l'AT c'è il conteggio delle imparate,
// e ogni lezione dell'elenco qui sotto dice il suo stato a parole.
import type { CSSProperties } from 'react';
import type { LessonMastery } from '../../domain/library';
import type { ShelfEntry } from '../../domain/curriculum';
import { useTranslation } from '../../i18n';
import { Cat } from '../../ui/Cat';
import { HEADLINE, KICKER } from '../../ui/magazine';

// Le altezze dei dorsi, come libri veri (telefono; da 640px un terzo in più).
const HEIGHTS = [64, 72, 58, 68, 76, 62, 70, 60, 74, 66];

export interface LibraryProps {
  readonly shelf: readonly ShelfEntry[];
  /** La padronanza per lezione, o `null` finché non c'è la lezione di ogni esercizio. */
  readonly mastery: ReadonlyMap<string, LessonMastery> | null;
}

export function Library({ shelf, mastery }: LibraryProps) {
  const { t } = useTranslation();
  const read = shelf.filter(({ lesson }) => mastery?.get(lesson.id)?.read).length;
  // Il gatto dorme sopra l'ultima lezione imparata, appoggiato al più alto dei
  // tre libri su cui si stende.
  const lastRead = shelf.reduce(
    (last, { lesson }, i) => (mastery?.get(lesson.id)?.read ? i : last),
    -1,
  );
  const catBed =
    lastRead < 0
      ? 0
      : Math.max(
          ...shelf
            .slice(lastRead, lastRead + 3)
            .map((_, k) => HEIGHTS[(lastRead + k) % HEIGHTS.length]!),
        );

  return (
    <section className="flex flex-col gap-3 border-b-[1.5px] border-border-strong p-5 sm:p-8">
      <h3 className={KICKER}>{t('lessons.library.kicker')}</h3>
      {/* Il conteggio arriva con la lezione di ogni esercizio: prima, uno spazio
          della stessa altezza (nessun salto). */}
      <p className={`min-h-[28px] text-[28px] leading-none text-ink-primary ${HEADLINE}`}>
        {mastery === null ? null : t('lessons.library.heading', { read, total: shelf.length })}
      </p>
      <p className="max-w-[40rem] text-body text-ink-secondary">{t('lessons.library.explain')}</p>

      <ol
        aria-hidden="true"
        className={`mt-2 grid grid-cols-[repeat(auto-fill,minmax(22px,1fr))] items-end gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(30px,1fr))] ${
          lastRead < 0 ? '' : 'pt-8 sm:pt-10'
        }`}
      >
        {shelf.map(({ lesson, status }, i) => {
          const m = mastery?.get(lesson.id);
          const open = status === 'current' || status === 'unlocked';
          const isRead = m?.read === true;
          const fill = open && m && m.total > 0 ? m.known / m.total : 0;
          const tone = isRead
            ? 'border-accent bg-accent text-surface-base'
            : open
              ? 'border-ink-primary bg-surface-raised text-ink-primary'
              : 'border-border-hairline bg-surface-sunken text-ink-muted';
          return (
            <li
              key={lesson.id}
              style={i === lastRead ? ({ '--bed': `${catBed}px` } as CSSProperties) : undefined}
              className="relative flex h-full items-end border-b-[3px] border-ink-primary px-[1.5px]"
            >
              {/* Il gatto della libreria, addormentato sopra i libri (07-10-2026). */}
              {i === lastRead ? (
                <Cat
                  pose="sleeping"
                  height={28}
                  className="absolute bottom-[calc(var(--bed)+1px)] left-0 z-10 sm:bottom-[calc(var(--bed)*4/3+1px)] sm:h-[38px] sm:w-auto"
                />
              ) : null}
              <span
                style={{ '--h': `${HEIGHTS[i % HEIGHTS.length]}px` } as CSSProperties}
                className={`relative flex h-[var(--h)] w-full justify-center overflow-hidden border-[1.5px] pt-1 sm:h-[calc(var(--h)*4/3)] ${tone} ${
                  status === 'current' && !isRead ? 'border-t-[4px] border-t-accent' : ''
                }`}
              >
                {/* L'inchiostro che sale: quanti esercizi della lezione sai bene. */}
                {fill > 0 && !isRead ? (
                  <span
                    className="absolute inset-x-0 bottom-0 bg-ink-primary/25"
                    style={{ height: `${fill * 100}%` }}
                  />
                ) : null}
                <span className="relative font-mono text-[10px] font-medium leading-none [writing-mode:vertical-rl] sm:text-[11px]">
                  {String(lesson.ordinal).padStart(2, '0')}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
