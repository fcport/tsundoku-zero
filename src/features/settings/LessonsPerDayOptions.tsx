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
      className="flex flex-col gap-2"
    >
      <span id="lessons-per-day-label" className="text-label text-ink-primary">
        {t('settings.lessonsPerDay.label')}
      </span>
      {LESSONS_PER_DAY_OPTIONS.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === current}
          onClick={() => onSelect(value)}
          className="rounded-md border border-border-strong bg-surface-raised text-ink-primary p-3 text-label"
        >
          {t('settings.lessonsPerDay.option', { value })}
        </button>
      ))}
    </div>
  );
}
