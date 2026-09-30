// Livello features/dashboard: la PILA come libri (30-09-2026, mockup approvato).
// Un dorso per esercizio dovuto, impilati su una mensola nell'ordine della coda: il
// dorso in cima, rosso, è il prossimo esercizio. Sul dorso la lezione (第一課) e la
// regola in giapponese, con la furigana della casella sul dorso; la traduzione
// della regola con «Traduzioni» acceso.
//
// Quanti dorsi: 6 sul telefono, 8 fino a 1024px, 12 da 1024px; il resto si dichiara
// con «+N». Le larghezze e i rientri variano un poco, come libri veri, ma sempre
// negli stessi tre toni della rivista (carta, carta incavata, inchiostro) più il
// rosso del prossimo.
//
// Per l'AT la pila è un elenco ordinato: ogni dorso dice lezione e regola nella
// lingua dell'interfaccia (`sr-only`), e il giapponese visibile è `aria-hidden`
// (lo direbbe una seconda volta).
import type { CSSProperties } from 'react';
import { resolveBilingual } from '../../domain/bilingual';
import { GRAMMAR_POINT_MEANINGS, grammarPointSegments } from '../../domain/fixed-readings';
import type { PileBook } from '../../domain/pile';
import { resolveLocale, useTranslation } from '../../i18n';
import { Furigana } from '../../ui/Furigana';
import { Translation } from '../../ui/Translation';
import { lessonNumberSegments } from '../../ui/kanjiDate';

/** Quanti dorsi per larghezza: telefono, da 640px, da 1024px. */
const SHOWN = { base: 6, sm: 8, lg: 12 } as const;

// Larghezza (percento della colonna) e rientro di ciascun dorso, dal mockup.
const WIDTHS = [94, 86, 90, 82, 92, 88, 84, 96, 87, 91, 85, 89];
const OFFSETS = [0, 4, 1, 6, 2, 3, 5, 0, 4, 2, 6, 3];
// L'inclinazione con cui ciascun dorso cade (gradi): piccola e varia, come libri
// lasciati andare a mano. Si raddrizzano all'appoggio.
const TILTS = [-2.5, 3, -1.5, 2, -3, 1.5, -2, 2.5, -1, 3, -2.5, 1];
// Fra un dorso e il successivo: prima atterra quello in fondo, per ultimo il prossimo.
const FALL_STEP_MS = 85;
// I toni dei dorsi dopo il primo (rosso): carta, inchiostro, carta incavata.
const TONES = [
  'bg-ink-primary text-surface-base border-ink-primary',
  'bg-surface-raised text-ink-primary border-ink-primary',
  'bg-surface-sunken text-ink-primary border-ink-primary',
];
const NEXT_TONE = 'bg-accent text-surface-base border-accent';

// La visibilità del dorso i-esimo: oltre la soglia della larghezza si nasconde.
function visibility(i: number): string {
  if (i < SHOWN.base) return 'flex';
  if (i < SHOWN.sm) return 'hidden sm:flex';
  return 'hidden lg:flex';
}

export interface PileOfBooksProps {
  /** I dorsi nell'ordine della coda (il primo è il prossimo), da `pileBooks`. */
  readonly books: readonly PileBook[];
  /** Quanti esercizi sono dovuti in tutto (può superare i dorsi caricati). */
  readonly total: number;
  /** Dorsi più alti quando sono pochi. */
  readonly roomy: boolean;
}

export function PileOfBooks({ books, total, roomy }: PileOfBooksProps) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const shown = books.slice(0, SHOWN.lg);
  const extra = (limit: number) => total - Math.min(limit, books.length);
  const more = [
    { n: extra(SHOWN.base), className: 'sm:hidden' },
    { n: extra(SHOWN.sm), className: 'hidden sm:inline lg:hidden' },
    { n: extra(SHOWN.lg), className: 'hidden lg:inline' },
  ];

  return (
    <div className="flex min-w-0 flex-col">
      {/* «+N»: gli esercizi oltre i dorsi mostrati, per ciascuna larghezza. */}
      <p aria-hidden="true" className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-ink-secondary sm:text-[12px]">
        {more.map(({ n, className }) =>
          n > 0 ? (
            <span key={className} className={className}>
              {t('dashboard.pileMore', { extra: n })}
            </span>
          ) : null,
        )}
      </p>
      {/* `--n`: quanti dorsi si vedono a questa larghezza, così la caduta parte
          dal dorso più basso VISIBILE senza aspettare quelli nascosti. */}
      <ol
        aria-label={t('dashboard.pileLabel')}
        style={
          {
            '--n-base': Math.min(SHOWN.base, shown.length),
            '--n-sm': Math.min(SHOWN.sm, shown.length),
            '--n-lg': shown.length,
          } as CSSProperties
        }
        className="flex flex-col gap-[3px] border-b-[3px] border-ink-primary pb-[3px] [--n:var(--n-base)] sm:[--n:var(--n-sm)] lg:[--n:var(--n-lg)]"
      >
        {shown.map((book, i) => {
          const meaning = GRAMMAR_POINT_MEANINGS[book.grammarPoint];
          const resolved = meaning ? resolveBilingual(meaning, locale) : null;
          return (
            <li
              key={book.id}
              // Sul telefono i dorsi usano quasi tutta la larghezza (la pila è stretta):
              // metà del rientro e niente accorciamento; da 640px le misure del mockup.
              style={
                {
                  '--w': `${WIDTHS[i]! - OFFSETS[i]!}%`,
                  '--o': `${OFFSETS[i]}%`,
                  '--w-m': `${100 - OFFSETS[i]! / 2}%`,
                  '--o-m': `${OFFSETS[i]! / 2}%`,
                  '--tilt': `${TILTS[i]}deg`,
                  animationDelay: `calc((var(--n) - 1 - ${i}) * ${FALL_STEP_MS}ms)`,
                } as CSSProperties
              }
              className={`${visibility(i)} motion-safe:animate-book-fall ml-[var(--o-m)] w-[var(--w-m)] items-center gap-2 overflow-hidden border-[1.5px] sm:ml-[var(--o)] sm:w-[var(--w)] sm:gap-3 ${
                i === 0 ? NEXT_TONE : TONES[(i - 1) % TONES.length]
              } ${roomy ? 'min-h-[32px] sm:min-h-[44px]' : 'min-h-[28px] sm:min-h-[36px]'}`}
            >
              {/* La lezione, separata da un filetto come l'etichetta di un dorso. */}
              {book.lessonOrdinal !== null ? (
                <span
                  aria-hidden="true"
                  lang="ja"
                  className="flex self-stretch items-center border-r-[1.5px] border-current px-1.5 font-jp sm:px-3 text-[10px] font-bold sm:text-[12px]"
                >
                  <Furigana segments={lessonNumberSegments(book.lessonOrdinal)} />
                </span>
              ) : null}
              {/* A cedere spazio è prima la traduzione, poi il giapponese; «next» mai. */}
              <span className="flex min-w-0 flex-1 items-baseline gap-2 pr-2 sm:pr-3">
                <span aria-hidden="true" lang="ja" className="min-w-0 truncate font-jp text-[12px] font-bold sm:text-[17px]">
                  <Furigana
                    segments={grammarPointSegments(book.grammarPoint) ?? [{ text: book.grammarPoint, ruby: null }]}
                  />
                </span>
                {resolved ? (
                  <span aria-hidden="true" className="min-w-0 shrink-[1000] truncate">
                    <Translation
                      text={resolved.text}
                      lang={resolved.language}
                      className="font-sans text-[11px] italic opacity-80 sm:text-[13px]"
                    />
                  </span>
                ) : null}
                {i === 0 ? (
                  <span aria-hidden="true" className="ml-auto shrink-0 font-mono text-[9px] font-medium uppercase tracking-[0.1em] sm:text-[11px]">
                    {t('dashboard.pileNext')}
                  </span>
                ) : null}
              </span>
              <span className="sr-only">
                {t('dashboard.pileBook', {
                  lesson: book.lessonOrdinal ?? '-',
                  point: resolved?.text ?? book.grammarPoint,
                })}
                {i === 0 ? ` (${t('dashboard.pileNext')})` : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

