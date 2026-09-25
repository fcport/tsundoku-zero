// Livello domain: il TESTO BILINGUE con ripiego dichiarato (AD-1, dominio puro).
//
// Nasce come forma della sola `explanation` (storia 2.5) ed è generalizzato qui
// perché il `title` di una lezione ha esattamente lo stesso problema e deve avere
// esattamente lo stesso comportamento: `en` obbligatorio, `it` facoltativo, e
// quando l'italiano manca si mostra l'inglese DICHIARANDO che la traduzione non
// c'è ancora, invece di far passare l'inglese per italiano (FR8.5).
//
// Una sola definizione, non due: duplicare la forma significherebbe che un giorno
// il ripiego del titolo e quello della spiegazione divergono. `exercise.ts`
// ri-esporta questi nomi come `explanation`/`resolveExplanation` per continuità.
import { nonEmptyString, object, optional, type Infer } from './schema';

/**
 * Un testo bilingue: `en` OBBLIGATORIO e non vuoto, `it` FACOLTATIVO. È contenuto
 * del file di lezione — prosa autorata — e non passa mai da i18n: `src/i18n`
 * traduce l'INTERFACCIA, questo è il CONTENUTO.
 */
export const bilingualText = object({
  en: nonEmptyString(),
  it: optional(nonEmptyString()),
});

/** Tipo del testo bilingue, inferito: `{ en: string; it?: string }`. */
export type BilingualText = Infer<typeof bilingualText>;

/**
 * Asse linguistico del CONTENUTO (`'en' | 'it'`), DOMAIN-LOCAL: NON è `Locale` di
 * `src/i18n` (AD-1 vieta l'arco domain→i18n). Rispecchia i due soli campi che lo
 * schema ammette; concettualmente distinto da `supportedLocales` dell'app (un
 * locale `fr` non aggiungerebbe una lingua al contenuto). Il mapping
 * app-Locale→BilingualLanguage è confine di Epic 3.
 */
export type BilingualLanguage = 'en' | 'it';

/**
 * Esito di `resolveBilingual`: il `text` LETTERALE da mostrare (mai una chiave
 * i18n), la `language` EFFETTIVAMENTE resa, e `isFallback` — il segnale che
 * l'interfaccia consuma per dichiarare «non ancora tradotta».
 */
export interface ResolvedBilingual {
  readonly text: string;
  readonly language: BilingualLanguage;
  readonly isFallback: boolean;
}

/**
 * Decide QUALE testo mostrare per una data lingua e SE è un ripiego dichiarato
 * (FR8.5). Incarna una DECISIONE del contratto: il dominio decide, Epic 3 rende.
 * PURA e TOTALE, esaustiva su `'en' | 'it'`.
 *
 * - `'en'` richiesto: sempre `{ text: en, language: 'en', isFallback: false }` —
 *   l'inglese richiesto NON è mai un ripiego, anche se `it` esiste.
 * - `'it'` richiesto con `it` presente: `{ text: it, language: 'it', isFallback: false }`.
 * - `'it'` richiesto ma `it` assente: ripiego DICHIARATO su `en`
 *   `{ text: en, language: 'en', isFallback: true }`.
 */
export function resolveBilingual(
  value: BilingualText,
  language: BilingualLanguage,
): ResolvedBilingual {
  if (language === 'it') {
    if (value.it !== undefined) {
      return { text: value.it, language: 'it', isFallback: false };
    }
    // `it` richiesto ma non ancora tradotto: ripiego DICHIARATO su `en`.
    return { text: value.en, language: 'en', isFallback: true };
  }
  return { text: value.en, language: 'en', isFallback: false };
}
