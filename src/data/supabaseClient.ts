// Livello data (AD-2): l'UNICO livello che importa @supabase/supabase-js. Questo
// modulo centralizza la creazione del client Supabase, così che l'app crei UN
// SOLO client (una sola sessione / un solo GoTrueClient) e lo condivida fra
// AuthGateway e SettingsRepository.
//
// Perché un solo client: l'upsert RLS ((select auth.uid()) = user_id) e la
// lettura di user_settings richiedono la STESSA sessione dell'accesso. Due
// createClient sullo stesso storage produrrebbero due GoTrueClient (warning
// ufficiale di supabase-js, race di refresh del token). Perciò il client si crea
// una sola volta in main.tsx e si inietta in entrambe le porte.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// La config di cui il client ha bisogno: solo l'endpoint e l'anon key. È il
// SOTTOINSIEME strutturale dell'AppConfig validato in src/app/env.ts; app passa
// il suo AppConfig senza che questo livello importi `app` (arco data→app vietato
// da AD-1). Il typing strutturale li riconcilia a compile-time. Nessuna
// `service_role` né alcun secret non-`VITE_*` entra qui (solo l'anon key
// pubblica).
export interface SupabaseClientConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
}

/**
 * Crea l'UNICO client Supabase dell'app. Le opzioni
 * `persistSession`/`autoRefreshToken` sono ESPLICITE: la persistenza della
 * sessione fra riavvii (FR1.3) è una decisione dichiarata, non un default
 * implicito. Il client risultante è iniettato in `createSupabaseAuthGateway` e
 * `createSupabaseSettingsRepository` (una sola sessione condivisa).
 */
export function createSupabaseClient(
  config: SupabaseClientConfig,
): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}
