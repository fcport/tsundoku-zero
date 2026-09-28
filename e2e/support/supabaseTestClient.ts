// Support e2e (storia 7.5): la fonte UNICA del client Supabase per gli e2e a
// livello-DATI. Prima esisteva un `requiredEnv`+`createClient` duplicato dentro
// `teardown.ts`; ora vive qui una sola volta, riusato dal teardown e dal nuovo
// spec `account-deletion.spec.ts`. DRY sulla lettura dei segreti e sulla
// creazione del client, così le due superfici non possono divergere.
//
// Segreti: SOLO `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (l'anon pubblica) —
// MAI la `service_role` né altri secret privilegiati (coerente con `.env.example`
// e `src/service-role-confinement.test`). NON importa moduli di `src/` (nessun
// accoppiamento ai confini AD-1); usa `@supabase/supabase-js` (già dipendenza del
// progetto) come il livello data.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Legge una VITE_* richiesta dall'ambiente e la restituisce non vuota, oppure
 * lancia NOMINANDO il secret mancante (idioma di `migrate.yml`/`src/app/env.ts`):
 * un errore opaco della SDK non deve mascherare una config assente. Helper
 * INTERNO al modulo (non esportato): l'unica API pubblica è `createAnonClient`,
 * suo solo consumatore.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Secret mancante: ${name}. L'e2e richiede VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (l'anon pubblica) nell'ambiente (locale in .env, in CI come GitHub Actions secrets).`,
    );
  }
  return value.trim();
}

/**
 * Crea un client `supabase-js` effimero con la SOLA anon key pubblica, SENZA
 * persistenza di sessione (`persistSession:false`/`autoRefreshToken:false`): non
 * è il browser dell'app, non deve scrivere storage né rinfrescare il token da
 * sé. Il JWT di sessione resta in memoria e viene allegato alle query/RPC/invoke
 * finché non scade — proprietà su cui il nuovo spec 7.5 poggia la verifica di
 * cancellazione (leggere le tabelle col JWT ancora valido dell'utente cancellato).
 *
 * Fonte UNICA di segreti+client per gli e2e data-layer: `teardown.ts` e
 * `account-deletion.spec.ts` la consumano, così le opzioni non divergono.
 */
export function createAnonClient(): SupabaseClient {
  const supabaseUrl = requiredEnv('VITE_SUPABASE_URL');
  const supabaseAnonKey = requiredEnv('VITE_SUPABASE_ANON_KEY');
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
