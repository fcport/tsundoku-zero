// Livello data (AD-2): l'adattatore Supabase della porta AccountGateway del
// dominio. È uno dei soli moduli che importano @supabase/supabase-js (il client
// concreto arriva iniettato: lo STESSO client condiviso con AuthGateway e
// SettingsRepository — una sola sessione, storia 1.9).
//
// La cancellazione passa SOLO dall'unica Edge Function `delete-account` (AD-11):
// `functions.invoke('delete-account')` allega automaticamente l'Authorization di
// sessione (il client condiviso porta il JWT del chiamante), così la funzione
// riceve il JWT, verifica il chiamante e cancella l'utente con la `service_role`
// lato server. La rimozione dei dati per-utente è per CASCATA su `auth.users`,
// non cancellazioni tabella-per-tabella dal client. Nessun secret privilegiato
// entra mai qui (solo l'anon key pubblica del client condiviso).
//
// Il cuore della mappatura è una funzione PURA ed esportata
// (`accountDeletionResultFromInvoke`) che traduce l'esito di `functions.invoke`
// in un `AccountDeletionResult` di dominio — testabile senza client reale né rete.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AccountDeletionResult,
  AccountGateway,
} from '../domain/ports/accountGateway';

/** Nome dell'unica Edge Function del progetto (AD-11). */
const DELETE_ACCOUNT_FUNCTION = 'delete-account';

/**
 * Mappa PURA dell'esito di `functions.invoke('delete-account')` in un
 * `AccountDeletionResult` di dominio. Confine TOTALE, un solo `reason`:
 *
 * - errore presente (`FunctionsError` o qualunque valore truthy) ⇒
 *   `{ ok:false, reason:'unknown' }` (la funzione ha risposto non-2xx o l'SDK
 *   ha segnalato un errore di rete: nessun dettaglio grezzo attraversa il confine)
 * - nessun errore (`error` nullo/undefined) ⇒ `{ ok:true }` (la funzione ha
 *   risposto 2xx: l'utente è cancellato, la cascata ha svuotato le sue righe)
 */
export function accountDeletionResultFromInvoke(
  error: unknown,
): AccountDeletionResult {
  if (error) {
    return { ok: false, reason: 'unknown' };
  }
  return { ok: true };
}

/**
 * Costruisce l'adattatore Supabase della porta AccountGateway attorno a un
 * `SupabaseClient` INIETTATO (lo stesso client di AuthGateway/SettingsRepository:
 * la sua sessione allega il JWT del chiamante alla chiamata della funzione).
 */
export function createSupabaseAccountGateway(
  client: SupabaseClient,
): AccountGateway {
  return {
    async deleteAccount(): Promise<AccountDeletionResult> {
      // Confine TOTALE: un throw dell'SDK (rete caduta, invoke sincrono che
      // lancia) diventa `unknown`, così i livelli superiori ricevono sempre un
      // AccountDeletionResult di dominio, mai una promise rifiutata.
      try {
        const { error } = await client.functions.invoke(
          DELETE_ACCOUNT_FUNCTION,
        );
        return accountDeletionResultFromInvoke(error);
      } catch {
        return { ok: false, reason: 'unknown' };
      }
    },
  };
}
