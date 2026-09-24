// Livello features/settings: la mappa DA lingua supportata A chiave i18n della
// sua etichetta. `satisfies Record<Locale, string>` impone a `tsc` la
// COMPLETEZZA — dimenticare una lingua di `supportedLocales` è un errore di
// compilazione, non un bottone mancante a runtime. Le stringhe sono chiavi
// valide per `t()` (tipizzate da CustomTypeOptions su `en`, AD-14): una chiave
// inesistente non compila.
import type { Locale } from '../../i18n';

/**
 * Etichetta i18n di ciascuna lingua supportata. Ogni valore è una chiave del
 * ramo `settings.language.*` dei cataloghi, resa dal selettore con `t()`. La
 * completezza rispetto a `Locale` è imposta da `satisfies Record<Locale, string>`.
 */
export const LOCALE_LABEL_KEY = {
  en: 'settings.language.en',
  it: 'settings.language.it',
} as const satisfies Record<Locale, string>;
