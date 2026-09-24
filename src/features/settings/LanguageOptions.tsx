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
      className="flex flex-col gap-2"
    >
      <span id="language-label" className="text-label text-ink-primary">
        {t('settings.language.label')}
      </span>
      {supportedLocales.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={locale === current}
          onClick={() => onSelect(locale)}
          className="rounded-md border border-border-strong bg-surface-raised text-ink-primary p-3 text-label"
        >
          {t(LOCALE_LABEL_KEY[locale])}
        </button>
      ))}
    </div>
  );
}
