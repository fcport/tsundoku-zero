// Livello features/stats: il CALENDARIO (07-10-2026). Una casella per giorno, una
// colonna per settimana dal lunedì, l'ultima è quella di oggi: più risposte, più
// inchiostro. I giorni liberi della serie sono a righe, come nella dashboard. Sopra,
// il mese dove comincia.
//
// Il disegno è decorativo (`aria-hidden`): per l'AT c'è la frase riassuntiva, e i
// numeri esatti degli ultimi giorni sono nell'elenco che segue nella schermata.
import type { CalendarDay } from '../../domain/answersOverTime';
import { useTranslation } from '../../i18n';

/** I toni d'inchiostro, dal giorno con meno risposte al più pieno. */
const TIERS = ['bg-ink-primary/25', 'bg-ink-primary/50', 'bg-ink-primary/75', 'bg-ink-primary'];
const FREE =
  'border-[1.5px] border-ink-primary bg-[repeating-linear-gradient(135deg,var(--color-ink-primary)_0_1.5px,transparent_1.5px_4px)]';
const EMPTY = 'bg-surface-sunken';

function tone(day: CalendarDay, max: number, free: boolean): string {
  if (day.future) return '';
  if (day.count === 0) return free ? FREE : EMPTY;
  const tier = Math.min(TIERS.length - 1, Math.ceil((day.count / max) * TIERS.length) - 1);
  return TIERS[tier]!;
}

export interface CalendarHeatmapProps {
  readonly weeks: readonly (readonly CalendarDay[])[];
  /** I giorni liberi (`YYYY-MM-DD`), da `freeDaysInHistory`. */
  readonly freeDays: ReadonlySet<string>;
  /** Il locale BCP 47 per i nomi dei mesi. */
  readonly dateLocale: string;
}

export function CalendarHeatmap({ weeks, freeDays, dateLocale }: CalendarHeatmapProps) {
  const { t } = useTranslation();
  const past = weeks.flat().filter((day) => !day.future);
  const max = Math.max(1, ...past.map((day) => day.count));
  const activeDays = past.filter((day) => day.count > 0).length;
  const answers = past.reduce((sum, day) => sum + day.count, 0);
  const month = new Intl.DateTimeFormat(dateLocale, { month: 'short', timeZone: 'UTC' });
  // Il mese sopra la colonna in cui comincia, e sopra la prima colonna. Un nome di
  // mese è largo circa tre colonne su un telefono: se la colonna etichettata prima è
  // più vicina, l'etichetta salta (vince il mese che comincia davvero lì).
  const startsMonth = weeks.map((week) => week.some((day) => day.date.endsWith('-01')));
  const MONTH_LABEL_COLUMNS = 3;
  const labelledAt = startsMonth.flatMap((starts, i) => (starts ? [i] : []));
  if (labelledAt[0] !== 0 && (labelledAt[0] ?? Infinity) >= MONTH_LABEL_COLUMNS) labelledAt.unshift(0);
  const monthLabels = weeks.map((week, i) =>
    labelledAt.includes(i) ? month.format(new Date(`${week[week.length - 1]!.date}T12:00:00Z`)) : '',
  );
  const columns = { gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` };

  return (
    <div className="flex flex-col gap-2">
      <p className="sr-only">
        {t('stats.calendar.summary', { weeks: weeks.length, days: activeDays, answers })}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-1">
        <div className="grid gap-[2px]" style={columns}>
          {monthLabels.map((label, i) => (
            <span
              key={i}
              className="overflow-visible whitespace-nowrap font-mono text-[10px] font-medium uppercase leading-none text-ink-secondary"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-[2px]" style={columns}>
          {weeks.flat().map((day) => (
            <span
              key={day.date}
              className={`aspect-square ${tone(day, max, freeDays.has(day.date))}`}
            />
          ))}
        </div>
      </div>
      {/* La legenda: dal meno al più, e il giorno libero. */}
      <div
        aria-hidden="true"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase text-ink-secondary"
      >
        <span className="flex items-center gap-1.5">
          {t('stats.calendar.less')}
          {[EMPTY, ...TIERS].map((cls) => (
            <span key={cls} className={`size-3 ${cls}`} />
          ))}
          {t('stats.calendar.more')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`size-3 ${FREE}`} />
          {t('stats.calendar.freeDay')}
        </span>
      </div>
    </div>
  );
}
