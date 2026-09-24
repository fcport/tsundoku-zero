// Edge Function `delete-account` — l'UNICO codice server del progetto (AD-11).
// Gira su Deno nel runtime di Supabase Edge Functions, FUORI dal toolchain Node
// (tsconfig include solo `src`; eslint ignora `supabase/**`; vitest raccoglie
// solo `src/**/*.test`). Perciò gli import `esm.sh`, il global `Deno` e i tipi
// Deno non toccano lint/typecheck/test/build dell'app client.
//
// Contratto: il client chiama questa funzione via `supabase.functions.invoke`,
// che allega l'Authorization di sessione (il JWT del chiamante). La funzione:
//   1. gestisce il preflight CORS `OPTIONS` (il browser lo invia SENZA JWT;
//      per questo config.toml imposta verify_jwt = false, altrimenti la
//      piattaforma respingerebbe il preflight prima del nostro codice);
//   2. legge l'header Authorization e VERIFICA il chiamante con
//      `auth.getUser(jwt)` usando un client `service_role` (401 se assente/
//      invalido, nessuna cancellazione);
//   3. cancella l'utente con `auth.admin.deleteUser(user.id)` (privilegio
//      `service_role`), che il client autenticato NON possiede — le tabelle
//      per-utente si svuotano per CASCATA su auth.users (on delete cascade,
//      storia 1.5), non tabella-per-tabella (500 su errore, 200 su successo).
//
// La chiave privilegiata (`SUPABASE_SERVICE_ROLE_KEY`) è letta dai env INIETTATI
// dalla piattaforma nel runtime della funzione: vive SOLO qui, mai nel bundle
// client né in una variabile VITE_* (imposto da src/service-role-confinement.test).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Header CORS: la funzione è chiamata dal browser (origine dell'app), quindi il
// preflight OPTIONS e la risposta reale devono dichiarare i permessi. Consentiamo
// gli header che `functions.invoke` invia (authorization, apikey, content-type).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Risposta JSON con i corsHeaders sempre allegati (il browser deve poterla leggere). */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Preflight CORS: risposta 2xx senza corpo, senza JWT. Deve precedere ogni
  //    verifica del chiamante (il browser non allega il JWT al preflight).
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Guard del metodo: l'unico endpoint distruttivo accetta SOLO POST (coerente
  // con Access-Control-Allow-Methods). Un GET/PUT/DELETE con JWT valido non deve
  // raggiungere il percorso di cancellazione — difesa in profondità ⇒ 405.
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method-not-allowed' }, 405);
  }

  // Confine TOTALE: un throw inatteso (createClient, getUser, deleteUser: rete
  // caduta, SDK) NON deve sfuggire come rejection non gestita — la piattaforma
  // risponderebbe 500 SENZA i nostri corsHeaders e il browser non potrebbe
  // leggere la risposta. Nel catch ritorniamo un 500 CON i corsHeaders.
  try {
    // Env iniettati dalla piattaforma nel runtime della funzione. La service_role
    // vive SOLO qui (mai in src/, mai in VITE_*).
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'server-misconfigured' }, 500);
    }

    // Client con privilegio service_role: unico che può leggere getUser di un JWT
    // arbitrario e cancellare via admin.deleteUser.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 2. Verifica del chiamante DAL suo JWT. `functions.invoke` allega
    //    `Authorization: Bearer <jwt di sessione>`; senza un JWT valido non c'è
    //    utente da cancellare ⇒ 401, nessuna cancellazione.
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
    if (!jwt) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const { data: userData, error: getUserError } = await admin.auth.getUser(jwt);
    if (getUserError || !userData?.user) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    // 3. Cancellazione con il privilegio service_role. La cancellazione di
    //    auth.users propaga per CASCATA a user_settings (e a ogni tabella
    //    per-utente futura), senza cancellazioni tabella-per-tabella dal server.
    const { error: deleteError } = await admin.auth.admin.deleteUser(
      userData.user.id,
    );
    if (deleteError) {
      return jsonResponse({ error: 'delete-failed' }, 500);
    }

    return jsonResponse({ ok: true }, 200);
  } catch {
    // Confine totale: ogni throw inatteso diventa un 500 con i corsHeaders.
    return jsonResponse({ error: 'server-error' }, 500);
  }
});
