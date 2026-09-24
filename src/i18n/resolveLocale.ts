// Livello i18n: il CONFINE di validazione della lingua persistita. La colonna
// `user_settings.locale` è `text` senza `check` (scelta deliberata di 1.5): lo
// schema non conosce l'enum dell'app. La garanzia di tipo vive QUI — un testo
// grezzo (dal DB o dall'istanza i18next) viene validato contro l'unica fonte
// delle lingue (supportedLocales) e ogni valore non supportato/assente/malformato
// degrada al fallback 'en' invece di rompere.
//
// Il fallback 'en' è coerente con `fallbackLng: 'en'` (config.ts) e con il
// default 'en' della colonna: una lingua rimossa in futuro, o un valore stantio,
// non lascia mai l'app in uno stato senza lingua.
import { supportedLocales, type Locale } from './locales';

/** La lingua di ripiego, coerente con `fallbackLng` e il default della colonna. */
export const FALLBACK_LOCALE: Locale = 'en';

/** Type guard: vero se `value` è uno dei `Locale` supportati. */
export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (supportedLocales as readonly string[]).includes(value)
  );
}

/**
 * Traduce un valore grezzo (testo dal DB, `i18n.language`, `null`/`undefined`)
 * in un `Locale` supportato. Valore supportato ⇒ quel `Locale`; qualunque altro
 * ⇒ `FALLBACK_LOCALE` ('en'). Funzione PURA, testabile senza i18next né DB.
 */
export function resolveLocale(stored: string | null | undefined): Locale {
  return isSupportedLocale(stored) ? stored : FALLBACK_LOCALE;
}
