// Livello domain: la PORTA delle impostazioni utente come tipi PURI (AD-1/AD-2).
// Nessun import esterno: il dominio non conosce React, @supabase/supabase-js,
// fetch né storage. Solo src/data/ implementa questa porta; src/app/ la istanzia
// e la inietta nelle schermate di features (features NON importa data).
//
// Il locale è `string` (mirror della colonna `text` di user_settings, storia
// 1.5): il dominio NON conosce il tipo `Locale` di i18n — l'arco domain→i18n è
// vietato da AD-1. La garanzia di tipo vive al confine i18n: in scrittura il
// chiamante passa un `Locale` (assegnabile a `string`); in lettura `resolveLocale`
// valida il testo grezzo contro `supportedLocales` (fallback 'en').

/**
 * Porta della persistenza delle impostazioni utente dichiarata dal dominio
 * (AD-2). L'adattatore concreto vive in src/data/ ed è l'unico a conoscere
 * Supabase e la tabella `user_settings`.
 *
 * Confine TOTALE: nessun metodo rifiuta mai. `loadLocale` ritorna `null` quando
 * la lingua non è disponibile (nessuna sessione, riga assente, errore); il
 * confine i18n (`resolveLocale`) traduce `null` nel fallback. `saveLocale`
 * risolve `void` anche quando la scrittura fallisce.
 */
export interface SettingsRepository {
  /**
   * Legge la lingua persistita dell'utente corrente, o `null` se non
   * disponibile (nessuna sessione, riga assente, valore non-stringa, errore).
   * Non rifiuta mai.
   */
  loadLocale(): Promise<string | null>;
  /**
   * Persiste la lingua dell'utente corrente con un upsert diretto (mai via RPC).
   * Confine totale: risolve sempre `void`, mai reject. Senza sessione è un no-op.
   */
  saveLocale(locale: string): Promise<void>;

  /**
   * Legge il tetto giornaliero di sblocco persistito dell'utente corrente
   * (`user_settings.lessons_per_day`, storia 3.17), o `null` se non disponibile
   * (nessuna sessione, riga assente, valore non-numero, errore). MIRROR del
   * confine totale di `loadLocale`: non rifiuta mai. Il chiamante degrada `null`
   * al `DEFAULT_LESSONS_PER_DAY` del dominio.
   */
  loadLessonsPerDay(): Promise<number | null>;
  /**
   * Persiste il tetto giornaliero di sblocco dell'utente corrente con un upsert
   * diretto (mai via RPC). MIRROR del confine totale di `saveLocale`: risolve
   * sempre `void`, mai reject; senza sessione è un no-op. L'upsert invia solo
   * `{ user_id, lessons_per_day }`: `locale` resta invariato su conflitto.
   */
  saveLessonsPerDay(value: number): Promise<void>;
}
