// Support e2e (storia 7.4): il TEARDOWN VERIFICATO. Rimuove l'utente effimero
// creato dal run invocando la STESSA Edge Function `delete-account` — lo stesso
// contratto di `src/data/accountGateway.ts` (`functions.invoke('delete-account')`
// col JWT di sessione allegato dal client autenticato). Direct-invoke, non via
// UI: gira anche se il test fallisce, non dipende dallo stato del browser.
//
// La pulizia è VERIFICATA, non assunta: `invoke` ritorna `{ error }` e un errore
// non nullo (non-2xx o errore di rete dell'SDK) fa FALLIRE il teardown. La
// cascata su `auth.users` (config.toml + storia 1.5) svuota le righe per-utente;
// qui basta verificare il 2xx della funzione (la verifica tabella-per-tabella è
// la storia 7.5, fuori scopo).
//
// Segreti: SOLO `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (l'anon pubblica) —
// MAI la `service_role` né altri secret privilegiati (coerente con `.env.example`
// e `src/service-role-confinement.test`). NON importa moduli di `src/` (AD-1);
// il client (anon key, senza persistenza di sessione) arriva da
// `createAnonClient()` — la fonte UNICA condivisa con `account-deletion.spec.ts`
// (storia 7.5), che elimina la duplicazione di `requiredEnv`+`createClient`.
import { createAnonClient } from './supabaseTestClient';
import type { TestUser } from './testUser';

/**
 * Cancella l'utente di test invocando `delete-account` come lui stesso, e
 * VERIFICA l'esito 2xx (nessun `error`). Autentica un client `supabase-js`
 * effimero con le credenziali del run (stessa forma dell'accesso dell'app), così
 * `functions.invoke` allega il JWT del chiamante — esattamente ciò che la
 * funzione verifica prima di cancellare con la `service_role` lato server.
 *
 * Lancia se: i secret mancano, l'accesso fallisce (nessun JWT da allegare), o la
 * funzione risponde non-2xx / la rete cade. Chiamato dal teardown che gira SEMPRE
 * (anche su fallimento del test): pulizia verificata, non best-effort.
 */
export async function deleteTestUser(user: TestUser): Promise<void> {
  // Client effimero, SENZA persistenza di sessione (non è il browser dell'app,
  // non deve scrivere storage): serve solo a portare il JWT del test user
  // all'invoke della funzione. Stessa anon key pubblica del client dell'app,
  // stesse opzioni: `createAnonClient()` è la fonte unica di segreti+client.
  const client = createAnonClient();

  const signIn = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (signIn.error || !signIn.data.session) {
    throw new Error(
      `Teardown: impossibile autenticarsi come l'utente di test (${user.email}) per invocare delete-account. ${signIn.error?.message ?? 'nessuna sessione restituita'}`,
    );
  }

  // La STESSA chiamata di `src/data/accountGateway.ts`: la sessione del client
  // allega l'Authorization, la funzione riceve il JWT e cancella con la
  // service_role lato server.
  const { error } = await client.functions.invoke('delete-account');
  if (error) {
    throw new Error(
      `Teardown: delete-account non ha risposto 2xx per ${user.email}: ${error.message}`,
    );
  }

  // Chiude la sessione locale del client effimero, best-effort: dopo che
  // `delete-account` ha cancellato l'utente la sessione remota è morta, quindi un
  // signOut che rifiuta NON deve trasformare una pulizia GIÀ verificata (il 2xx
  // sopra) in un fallimento di teardown. Il rejection è catturato e ingoiato.
  await client.auth.signOut().catch(() => {});
}
