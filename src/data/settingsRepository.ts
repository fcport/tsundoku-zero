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

// Il nome della tabella e della colonna vivono qui una sola volta: è l'unico
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
  };
}
