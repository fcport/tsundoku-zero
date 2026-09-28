// e2e a livello-DATI (storia 7.5): la cancellazione dell'account, VERIFICATA
// TABELLA PER TABELLA. La 7.4 verifica solo il 2xx di `delete-account` (teardown),
// fidandosi IMPLICITAMENTE della cascata FK su `auth.users`. Qui invece nessuna
// asserzione deduce dall'esistenza di un `on delete cascade`: dopo la
// cancellazione il test INTERROGA esplicitamente ciascuna delle quattro tabelle
// per-utente e pretende 0 righe. Una regressione dello schema (una FK futura
// senza cascata, una tabella nuova non agganciata) lascerebbe dati orfani — una
// violazione di privacy silenziosa sui dati reali dell'owner: questo test la
// rende CI rossa.
//
// Il flusso, contro il progetto Supabase REALE (AD-12/AD-13, nessun mock né
// `supabase start`):
//
//   registrazione (email unica) → POPOLA le 4 tabelle coi write-path reali (id di
//   contenuto letti dal DB) → BASELINE (≥1 riga per tabella, prima/dopo vero) →
//   `functions.invoke('delete-account')` (2xx) → VERIFICA per-tabella (count === 0
//   col JWT ANCORA valido, senza `signOut`) → RIACCESSO fallito su client nuovo.
//
// Vincoli di questa storia, resi qui:
// - NON pilota il browser: parla col Supabase reale via `@supabase/supabase-js`
//   (la verifica interroga le tabelle Postgres, superficie che la UI non espone).
//   NON importa moduli di `src/` (nessun accoppiamento AD-1).
// - Segreti: SOLO l'anon key pubblica (via `createAnonClient`), MAI la
//   `service_role`. Email UNICA per run (`makeTestUser`), password generata.
// - Popolamento coi write-path REALI dell'app, con gli id di contenuto LETTI dal
//   DB (mai cablati): `user_settings` via upsert (contratto di
//   `src/data/settingsRepository.ts`); `lesson_progress`+`review_state` via
//   `rpc('unlock_lesson')`; `review_log` via `rpc('apply_review')`.
// - Cancellazione dalla STESSA Edge Function `delete-account` (`functions.invoke`,
//   contratto di `src/data/accountGateway.ts`).
// - `afterEach` safety-net best-effort guardato da `accountDeleted`: se il test
//   fallisce PRIMA della propria cancellazione, tenta una pulizia dell'utente
//   residuo tollerante e NON maschera il fallimento originale.
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { makeTestUser, type TestUser } from './support/testUser';
import { deleteTestUser } from './support/teardown';
import { createAnonClient } from './support/supabaseTestClient';

// Le quattro tabelle per-utente la cui ASSENZA di righe è il cuore della storia.
// Interrogate SINGOLARMENTE dopo la cancellazione (non in blocco): ciascuna deve
// tornare 0, un controllo esplicito tabella-per-tabella.
const PER_USER_TABLES = [
  'review_state',
  'review_log',
  'lesson_progress',
  'user_settings',
] as const;

// L'utente effimero del run, coniato in `beforeEach` così il safety-net lo vede
// anche quando il corpo del test fallisce a metà.
let currentUser: TestUser | null = null;
// True SOLO dopo che il test ha cancellato-e-verificato: nel percorso felice la
// sua cancellazione È la pulizia, quindi il safety-net non ritenta.
let accountDeleted = false;

test.beforeEach(() => {
  currentUser = makeTestUser();
  accountDeleted = false;
});

// Safety-net best-effort: se il test è fallito PRIMA della propria cancellazione
// (`accountDeleted === false`), tenta di rimuovere l'utente residuo invocando la
// stessa `delete-account` verificata (`deleteTestUser`). È TOLLERANTE verso un
// utente già cancellato o mai registrato (l'accesso fallisce ⇒ `deleteTestUser`
// lancia): il `.catch` ingoia l'errore di pulizia così da NON mascherare il
// fallimento ORIGINALE del test. Nel percorso felice (`accountDeleted === true`)
// non c'è nulla da pulire: la cancellazione verificata del test è la pulizia.
test.afterEach(async () => {
  const user = currentUser;
  currentUser = null;
  if (user && !accountDeleted) {
    await deleteTestUser(user).catch(() => {});
  }
});

// Conta le righe di una tabella owner-scoped col client autenticato passato.
// `head:true` + `count:'exact'` chiede a PostgREST SOLO il conteggio (nessun
// corpo): l'RLS restringe già alla riga dell'utente (`auth.uid()`), quindi il
// conteggio è quello dell'owner corrente. Un errore di query è FATALE: uno «0
// righe» non deve essere indistinguibile da un «accesso negato» (Block If dello
// spec), perciò si asserisce `error` nullo prima di leggere `count`.
async function countRows(
  client: ReturnType<typeof createAnonClient>,
  table: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true });
  expect(error, `Query di conteggio su "${table}" non deve fallire`).toBeNull();
  // Il conteggio deve essere NUMERICO: un `count:null` con `error:null`
  // (PostgREST che non restituisce il conteggio) renderebbe il `?? 0` un FALSO
  // VERDE sulla verifica-cardine post-cancellazione (`toBe(0)` passerebbe su un
  // conteggio mai calcolato). Asserirlo qui rende quel caso CI rossa.
  expect(count, `Il conteggio esatto su "${table}" deve essere numerico`).not.toBeNull();
  return count ?? 0;
}

test('cancellazione verificata tabella per tabella: baseline, delete-account, zero righe, riaccesso fallito', async () => {
  const user = currentUser;
  if (!user) throw new Error('Utente di test non coniato.');

  const client = createAnonClient();

  // 1) REGISTRAZIONE con email unica. Con «Confirm email» disattivato in console
  //    (azione operatore, come 7.4) `signUp` torna una sessione: il JWT resta in
  //    memoria (persistSession:false) e viene allegato a query/RPC/invoke.
  const signUp = await client.auth.signUp({
    email: user.email,
    password: user.password,
  });
  expect(
    signUp.error,
    'La registrazione dell\'utente di test non deve fallire',
  ).toBeNull();
  expect(
    signUp.data.session,
    'signUp deve restituire una sessione (Confirm email disattivato in console, come 7.4)',
  ).not.toBeNull();
  const userId = signUp.data.user?.id;
  expect(userId, 'signUp deve restituire l\'id dell\'utente').toBeTruthy();

  // 2) POPOLAMENTO coi write-path REALI, con gli id di contenuto LETTI dal DB.

  // 2a) `user_settings`: upsert `{ user_id, locale }` — lo STESSO contratto di
  //     `src/data/settingsRepository.ts` (conflitto sulla PK `user_id`).
  const upsertSettings = await client
    .from('user_settings')
    .upsert({ user_id: userId, locale: 'en' });
  expect(
    upsertSettings.error,
    'L\'upsert su user_settings (contratto di settingsRepository) non deve fallire',
  ).toBeNull();

  // 2b) Un `lesson.id` REALE letto dal DB (ordinale minimo, mai cablato): `lesson`
  //     è leggibile da ogni autenticato (`select using (true)`). L'ordinale minimo
  //     dà una lezione DETERMINISTICA e con esercizi (la prima del curriculum).
  const lessonRow = await client
    .from('lesson')
    .select('id')
    .order('ordinal', { ascending: true })
    .limit(1)
    .maybeSingle();
  expect(
    lessonRow.error,
    'La lettura di una lezione reale (per l\'id) non deve fallire',
  ).toBeNull();
  const lessonId = lessonRow.data?.id as string | undefined;
  expect(
    lessonId,
    'Deve esistere almeno una lezione nel contenuto (per popolare lesson_progress/review_state)',
  ).toBeTruthy();

  // 2c) `rpc('unlock_lesson')`: materializza `lesson_progress` (1 riga) e
  //     `review_state` (una per esercizio della lezione). `unlocked_at` è un
  //     istante reale (l'RPC lo usa come `due_at`, passthrough). Owner-scoped:
  //     l'RPC scrive con `auth.uid()`, imposto dalle policy insert di 3.8.
  const unlockedAt = new Date().toISOString();
  const unlock = await client.rpc('unlock_lesson', {
    lesson_id: lessonId,
    unlocked_at: unlockedAt,
  });
  expect(
    unlock.error,
    'La rpc unlock_lesson (che materializza lesson_progress + review_state) non deve fallire',
  ).toBeNull();

  // 2d) Un `exercise_id` REALE, letto da `review_state` appena materializzata
  //     (mai cablato): la lezione con esercizi ha prodotto ≥1 riga di stato, il
  //     cui `exercise_id` è un esercizio valido di quella lezione.
  const stateRow = await client
    .from('review_state')
    .select('exercise_id')
    .limit(1)
    .maybeSingle();
  expect(
    stateRow.error,
    'La lettura di review_state (per un exercise_id reale) non deve fallire',
  ).toBeNull();
  const exerciseId = stateRow.data?.exercise_id as string | undefined;
  expect(
    exerciseId,
    'unlock_lesson deve aver materializzato almeno un review_state (lezione con esercizi)',
  ).toBeTruthy();

  // 2e) `rpc('apply_review')`: inserisce 1 riga in `review_log` (e aggiorna la
  //     review_state corrispondente). `review_id` è generato dal client (chiave di
  //     idempotenza); `outcome`/`stage`/`due_at` sono valori validi dai vincoli
  //     dello schema (outcome ∈ {again,hard,good,easy}; stage ∈ [0,5]).
  const reviewId = randomUUID();
  const reviewedAt = new Date().toISOString();
  const applyReview = await client.rpc('apply_review', {
    review_id: reviewId,
    exercise_id: exerciseId,
    outcome: 'good',
    stage: 1,
    due_at: reviewedAt,
    reviewed_at: reviewedAt,
    used_explanation: false,
  });
  expect(
    applyReview.error,
    'La rpc apply_review (che inserisce review_log) non deve fallire',
  ).toBeNull();

  // 3) BASELINE PRIMA della cancellazione: ciascuna delle 4 tabelle ha ≥1 riga.
  //    Così lo «0 righe» dopo è un vero PRIMA/DOPO, non un'asserzione vacua su
  //    righe mai inserite.
  for (const table of PER_USER_TABLES) {
    const rows = await countRows(client, table);
    expect(
      rows,
      `Baseline: "${table}" deve avere ≥1 riga prima della cancellazione`,
    ).toBeGreaterThan(0);
  }

  // 4) CANCELLAZIONE dalla STESSA Edge Function `delete-account` (contratto di
  //    `src/data/accountGateway.ts`): il client allega il JWT del chiamante, la
  //    funzione verifica e cancella con la service_role lato server. Verifica 2xx
  //    (nessun `error`). NON facciamo `signOut`: il JWT in memoria deve restare
  //    allegato alle query di verifica al passo 5.
  const del = await client.functions.invoke('delete-account');
  expect(
    del.error,
    'delete-account deve rispondere 2xx (nessun errore)',
  ).toBeNull();
  // La cancellazione verificata del test È la pulizia: il safety-net non ritenta.
  accountDeleted = true;

  // 5) VERIFICA per-tabella ESPLICITA, col JWT ANCORA valido dell'utente
  //    cancellato (nessun `signOut`, nessun refresh: il token non è scaduto).
  //    PostgREST autorizza per FIRMA del JWT, non per esistenza dell'utente, e la
  //    RLS filtra per `auth.uid()` = il `sub` ormai cancellato: la STESSA query
  //    che tornava ≥1 riga prima torna 0 ora. Se le righe NON fossero cascadeate,
  //    questa stessa query le vedrebbe comunque (matcha per `user_id`, non per
  //    esistenza dell'utente): il test prova la CANCELLAZIONE, non la mera
  //    presenza del vincolo. Ogni tabella è interrogata SINGOLARMENTE.
  for (const table of PER_USER_TABLES) {
    const rows = await countRows(client, table);
    expect(
      rows,
      `Dopo delete-account: "${table}" deve avere 0 righe (verifica esplicita, NON dedotta dalla cascata)`,
    ).toBe(0);
  }

  // 6) RIACCESSO fallito: su un client NUOVO (nessuna sessione preesistente) le
  //    stesse credenziali non devono più autenticare — l'utente non esiste più.
  const freshClient = createAnonClient();
  const reSignIn = await freshClient.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  expect(
    reSignIn.error,
    'Il riaccesso con le credenziali dell\'utente cancellato deve FALLIRE',
  ).not.toBeNull();
  expect(
    reSignIn.data.session,
    'Nessuna sessione deve essere stabilita dopo la cancellazione',
  ).toBeNull();
});
