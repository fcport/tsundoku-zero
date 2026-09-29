// Livello features/settings: componente PRESENTAZIONALE del selettore del tetto
// giornaliero di sblocco (storia 3.17). Nessuno stato, nessuna chiamata alla
// porta: riceve `current` e `onSelect` per props ed è reso staticamente
// (renderToStaticMarkup, ambiente node). Modello: `./LanguageOptions`.
//
// Un bottone per ciascun valore di `LESSONS_PER_DAY_OPTIONS` (unica fonte del
// registro chiuso, dominio). Il valore corrente è marcato con `aria-pressed`
// (toggle button pattern). Gruppo etichettato con un'etichetta VISIBILE (`<span>`
// + `aria-labelledby`): i vedenti leggono "Daily unlock limit/Tetto di sblocco",
// gli screen reader ottengono lo stesso nome accessibile. Il testo di ogni
// bottone viene da t() con interpolazione `{{value}}` (mai `{{count}}`, che
// innescherebbe il pluralizzatore i18next). Solo classi token del sistema di
// design (1.3): ogni interattivo con `border-strong`, nessun colore letterale.
import { useTranslation } from '../../i18n';
import { LESSONS_PER_DAY_OPTIONS } from '../../domain/unlockPace';

export interface LessonsPerDayOptionsProps {
  /** Il tetto attualmente attivo: il suo bottone è marcato `aria-pressed`. */
  readonly current: number;
  /** Invocata con il valore scelto al click di un bottone. */
  readonly onSelect: (value: number) => void;
}

export function LessonsPerDayOptions({
  current,
  onSelect,
}: LessonsPerDayOptionsProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-labelledby="lessons-per-day-label"
      className="flex flex-col gap-3"
    >
      <span id="lessons-per-day-label" className="font-mono text-label-caps uppercase text-ink-secondary">
        {t('settings.lessonsPerDay.label')}
      </span>
      {/* Cinque caselle col numero grande e condensato; la frase completa
          («2 al giorno») resta il nome accessibile, fuori schermo. */}
      <div className="grid auto-cols-fr grid-flow-col border-[1.5px] border-border-strong">
        {LESSONS_PER_DAY_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === current}
            onClick={() => onSelect(value)}
            className="min-h-[64px] border-l-[1.5px] border-border-strong bg-surface-raised text-ink-primary first:border-l-0 hover:bg-surface-sunken aria-pressed:bg-ink-primary aria-pressed:text-surface-base"
          >
            <span aria-hidden="true" className="text-[32px] font-extrabold leading-none font-stretch-condensed">
              {value}
            </span>
            <span className="sr-only">{t('settings.lessonsPerDay.option', { value })}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
