// Livello features/settings: componente PRESENTAZIONALE del selettore di lingua.
// Nessuno stato, nessuna chiamata alla porta: riceve `current` e `onSelect` per
// props ed è reso staticamente (renderToStaticMarkup, ambiente node). Modello:
// features/auth/AuthForm.tsx.
//
// Un bottone per ciascuna lingua di `supportedLocales` (unica fonte). Il testo di
// ogni bottone viene da t(LOCALE_LABEL_KEY[locale]) — nessuna stringa cablata
// (AD-14). La lingua corrente è marcata con `aria-pressed` (toggle button
// pattern): il bottone corrente ha `aria-pressed="true"`, gli altri "false".
// Gruppo etichettato con un'etichetta VISIBILE (`<span>` + `aria-labelledby`):
// i vedenti leggono "Lingua/Language", gli screen reader ottengono lo stesso
// nome accessibile — meglio di un `aria-label` invisibile. Solo classi token del
// sistema di design (1.3): ogni interattivo con `border-strong`, nessun colore
// letterale, nessuna ombra.
import { supportedLocales, useTranslation, type Locale } from '../../i18n';
import { LOCALE_LABEL_KEY } from './localeLabels';

export interface LanguageOptionsProps {
  /** La lingua attualmente attiva: il suo bottone è marcato `aria-pressed`. */
  readonly current: Locale;
  /** Invocata con la lingua scelta al click di un bottone. */
  readonly onSelect: (locale: Locale) => void;
}

export function LanguageOptions({ current, onSelect }: LanguageOptionsProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-labelledby="language-label"
      className="flex flex-col gap-3"
    >
      <span id="language-label" className="font-mono text-label-caps uppercase text-ink-secondary">
        {t('settings.language.label')}
      </span>
      {/* Le opzioni come caselle affiancate di una tabella a filetti: la scelta
          corrente si inverte in inchiostro pieno (lo stato lo porta `aria-pressed`,
          il colore lo rinforza). */}
      <div className="grid auto-cols-fr grid-flow-col border-[1.5px] border-border-strong">
        {supportedLocales.map((locale) => (
          <button
            key={locale}
            type="button"
            aria-pressed={locale === current}
            onClick={() => onSelect(locale)}
            className="min-h-[56px] border-l-[1.5px] border-border-strong bg-surface-raised px-3 text-body font-semibold text-ink-primary first:border-l-0 hover:bg-surface-sunken aria-pressed:bg-ink-primary aria-pressed:text-surface-base"
          >
            {t(LOCALE_LABEL_KEY[locale])}
          </button>
        ))}
      </div>
    </div>
  );
}
