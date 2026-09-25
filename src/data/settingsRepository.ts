// Livello data (AD-2): l'adattatore Supabase della porta SettingsRepository del
// dominio. È uno dei soli moduli che importano @supabase/supabase-js (il client
// concreto arriva iniettato: una sola sessione condivisa con AuthGateway).
//
// La persistenza della lingua è un UPSERT DIRETTO su `user_settings` (mai via
// RPC, coerente con 1.5). La riga è isolata per utente da RLS ((select
// auth.uid()) = user_id): l'upsert scrive/aggiorna SOLO la riga propria, la
// select legge SOLO la riga propria. Confine TOTALE: nessun metodo rifiuta mai.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SettingsRepository } from '../domain/ports/settingsRepository';

// Il nome della tabella e delle colonne vivono qui una sola volta: è l'unico
// livello che conosce lo schema fisico (AD-2). `user_id` è la PK della tabella,
// quindi il conflitto dell'upsert cade su di essa (comportamento di default di
// supabase-js `.upsert`: onConflict sulla primary key).
const USER_SETTINGS_TABLE = 'user_settings';

/**
 * Costruisce l'adattatore Supabase della porta SettingsRepository attorno a un
 * `SupabaseClient` INIETTATO (lo stesso client di AuthGateway: la scrittura e la
 * lettura RLS richiedono la STESSA sessione dell'accesso).
 */
export function createSupabaseSettingsRepository(
  client: SupabaseClient,
): SettingsRepository {
  return {
    async saveLocale(locale: string): Promise<void> {
      // Confine TOTALE: qualunque throw dell'SDK viene ingoiato, la porta
      // risolve comunque `void` (mai reject). Senza sessione (nessun user.id)
      // è un no-op: non c'è riga da scrivere e RLS la rifiuterebbe comunque.
      try {
        const { data } = await client.auth.getSession();
        const userId = data.session?.user.id;
        if (!userId) return;

        // Upsert DIRETTO: inserisce la riga alla prima scelta di lingua, la
        // aggiorna alle successive (conflitto sulla PK user_id). Nessuna RPC.
        await client
          .from(USER_SETTINGS_TABLE)
          .upsert({ user_id: userId, locale });
      } catch {
        // Confine totale: nessuna propagazione.
      }
    },

    async loadLocale(): Promise<string | null> {
      // Confine TOTALE: ogni esito non-lettura degrada a `null` (il confine
      // i18n `resolveLocale` lo traduce nel fallback 'en'). RLS restringe la
      // select alla riga dell'utente corrente; `maybeSingle` ritorna la riga o
      // `null` senza lanciare quando è assente.
      try {
        const { data, error } = await client
          .from(USER_SETTINGS_TABLE)
          .select('locale')
          .maybeSingle();

        if (error || data === null) return null;

        // La colonna è `text`: difendiamo comunque il tipo prima di ritornarlo,
        // così un valore inatteso non-stringa non attraversa il confine.
        const value: unknown = (data as { locale: unknown }).locale;
        return typeof value === 'string' ? value : null;
      } catch {
        return null;
      }
    },

    async saveLessonsPerDay(value: number): Promise<void> {
      // MIRROR ESATTO di `saveLocale`: confine TOTALE (qualunque throw dell'SDK
      // è ingoiato, risolve `void`), no-op senza sessione. L'upsert invia SOLO
      // `{ user_id, lessons_per_day }`: su conflitto sulla PK `user_id` aggiorna
      // solo `lessons_per_day` (il `locale` esistente resta); su insert di una
      // nuova riga `locale` prende il suo default 'en'. Nessuna RPC.
      try {
        const { data } = await client.auth.getSession();
        const userId = data.session?.user.id;
        if (!userId) return;

        await client
          .from(USER_SETTINGS_TABLE)
          .upsert({ user_id: userId, lessons_per_day: value });
      } catch {
        // Confine totale: nessuna propagazione.
      }
    },

    async loadLessonsPerDay(): Promise<number | null> {
      // MIRROR di `loadLocale`: confine TOTALE, ogni esito non-lettura degrada a
      // `null` (il chiamante lo traduce nel DEFAULT_LESSONS_PER_DAY del dominio).
      // RLS restringe la select alla riga propria; `maybeSingle` ritorna la riga o
      // `null` senza lanciare quando è assente.
      //
      // Il confine di LETTURA impone l'invariante del tetto (>= 1), come
      // `resolveLocale` fa per il locale: la colonna `int` non ha un check SQL
      // (minimalità della tabella), quindi un valore fuori-range scritto out-of-band
      // (0, negativo, non intero) potrebbe attraversare. Un `cap = 0` renderebbe
      // `dailyUnlockLimitReached` sempre vero (softlock dello sblocco): perciò si
      // ritorna il numero SOLO se è un intero >= 1, altrimenti `null` (→ DEFAULT).
      try {
        const { data, error } = await client
          .from(USER_SETTINGS_TABLE)
          .select('lessons_per_day')
          .maybeSingle();

        if (error || data === null) return null;

        const value: unknown = (data as { lessons_per_day: unknown }).lessons_per_day;
        return typeof value === 'number' && Number.isInteger(value) && value >= 1
          ? value
          : null;
      } catch {
        return null;
      }
    },
  };
}
