---
title: 'La cancellazione, verificata tabella per tabella'
type: 'chore'
created: '2026-09-28'
baseline_revision: '5540f679d7e71380376be7a368f3266836242bb8'
status: 'awaiting-operator'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      Il test di cancellazione copre solo le quattro tabelle per-utente nominate; una futura nuova tabella per-utente non agganciata alla cascata non verrebbe colta.
    evidence: |-
      PER_USER_TABLES elenca staticamente review_state/review_log/lesson_progress/user_settings (e2e/account-deletion.spec.ts). L'intento della 7.5 nomina esattamente queste quattro tabelle; una tabella per-utente aggiunta in futuro senza `on delete cascade` lascerebbe righe orfane che questo test non interroga. Un guard più forte enumererebbe le tabelle per-utente da information_schema, o imporrebbe di aggiungere la nuova tabella qui.
    location: >-
      e2e/account-deletion.spec.ts:43
    severity: low
operator_actions:
  - "Verifica che «Confirm email» sia DISATTIVATO nella console Supabase (Authentication > Providers > Email): senza, signUp restituisce session:null e il test di cancellazione non prosegue oltre la registrazione. Azione già dovuta da 7.4, ricordata qui perché la 7.5 la condivide."
  - "Verifica che i GitHub Actions secrets VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Settings > Secrets and variables > Actions) siano impostati con l'URL e la anon key pubblica del progetto Supabase reale, così i job e2e possono costruire ed eseguire la suite. Non impostare mai la service_role. Azione già dovuta da 7.4, condivisa con la 7.5."
  - "Apri una pull request e verifica che il test «cancellazione verificata tabella per tabella» (e2e/account-deletion.spec.ts) giri VERDE nel workflow «E2E (percorso principale)» contro il Supabase reale; dopo il merge su main, verifica che l'e2e di collaudo in «Migrate & deploy functions» resti verde con l'intera suite (percorso principale + cancellazione)."
---

<intent-contract>

## Intent

**Problem:** La cancellazione dell'account passa dall'Edge Function `delete-account`, che si affida alla CASCATA delle FK su `auth.users` per svuotare le tabelle per-utente. Nessun test osserva davvero l'assenza delle righe: la 7.4 verifica solo il 2xx della funzione (teardown), fidandosi implicitamente della cascata. Una regressione dello schema (una FK futura senza `on delete cascade`, una tabella nuova non agganciata) lascerebbe dati orfani di un utente cancellato — una violazione di privacy silenziosa e permanente sui dati reali dell'owner (metrica M1).

**Approach:** Aggiungere un solo e2e a livello-dati (`e2e/account-deletion.spec.ts`, supabase-js diretto, NON dal browser) contro il progetto Supabase REALE: crea un utente effimero (email unica per run), POPOLA tutte e quattro le tabelle per-utente coi write-path reali dell'app, stabilisce una baseline (≥1 riga per tabella), invoca la STESSA `delete-account`, poi interroga ESPLICITAMENTE ciascuna delle quattro tabelle verificando 0 righe — col JWT ancora valido dell'utente cancellato, NON deducendo dalla presenza del vincolo `on delete cascade` — e infine verifica che il riaccesso con le stesse credenziali fallisca. Solo test: nessun codice `src/`, schema, funzione o workflow CI toccato; il nuovo spec entra nella suite Playwright esistente (auto-raccolto), niente `service_role`.

## Boundaries & Constraints

**Always:**
- Il nuovo spec vive in `e2e/account-deletion.spec.ts` (`*.spec.ts`), **fuori da `src/`**: non raccolto da Vitest (`src/**/*.test.*`) né incluso in `tsc --noEmit` (tsconfig include solo `src`/`scripts`/config). Playwright transpila i propri spec.
- È un e2e a livello-DATI: parla col Supabase reale via `@supabase/supabase-js` (già dipendenza), **NON pilota il browser** (la verifica interroga le tabelle Postgres, superficie che la UI dell'app non espone). Non importa moduli di `src/` (nessun accoppiamento ai confini AD-1).
- Segreti: SOLO `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (anon pubblica), letti da `process.env` (idioma di `teardown.ts`). MAI la `service_role` né altri secret privilegiati (coerente con `.env.example` e `src/service-role-confinement.test`).
- Ogni run crea un utente con **email unica per quel run** (`makeTestUser`); nessuna fixture condivisa, nessun utente permanente; password generata.
- Popola le quattro tabelle coi write-path REALI dell'app, con gli id di contenuto **letti dal DB** (`lesson`/`exercise`, leggibili dagli autenticati), mai cablati: `user_settings` via `.from('user_settings').upsert({ user_id, locale })` (stesso contratto di `src/data/settingsRepository.ts`); `lesson_progress` + `review_state` via `rpc('unlock_lesson', …)`; `review_log` via `rpc('apply_review', …)`.
- **Baseline PRIMA della cancellazione**: interroga ciascuna delle quattro tabelle e verifica ≥1 riga — così lo «0 righe» dopo la cancellazione è un vero prima/dopo, non un'asserzione vacua su righe mai inserite.
- **Verifica tabella-per-tabella ESPLICITA**: dopo `delete-account`, interroga SINGOLARMENTE ciascuna delle quattro tabelle (`review_state`, `review_log`, `lesson_progress`, `user_settings`) col JWT ANCORA valido dell'utente (NON fare `signOut`) e verifica 0 righe in CIASCUNA (nessun errore di query, `count === 0`). Il controllo NON deve essere dedotto dall'esistenza di un `on delete cascade`.
- La cancellazione passa dalla STESSA Edge Function `delete-account` (`functions.invoke`, stesso contratto di `src/data/accountGateway.ts`), di cui il test verifica il 2xx.
- Il **riaccesso** con le stesse credenziali su un client NUOVO deve fallire (nessuna sessione).
- **Safety-net teardown** (`afterEach`): se il test fallisce PRIMA della propria cancellazione, tenta una pulizia best-effort dell'utente residuo (tollerante verso un utente già cancellato) e NON maschera il fallimento originale. Nel percorso felice la cancellazione verificata del test È la pulizia.

**Block If:**
- Se le quattro tabelle per-utente NON risultassero tutte popolabili e interrogabili col solo client anon autenticato (es. un cambio di policy RLS o di schema rende una tabella non scrivibile/leggibile dal proprietario), OPPURE se la lettura col JWT dopo la cancellazione fosse RIFIUTATA rendendo lo «0 righe» indistinguibile da un «accesso negato»: HALT `blocked` con la lacuna. (In planning verificato: le quattro tabelle hanno policy `select`+`insert` owner-scoped `to authenticated`; `lesson`/`exercise` sono leggibili; PostgREST autorizza per FIRMA del JWT non ancora scaduto, non per esistenza dell'utente, quindi le tabelle owner-scoped tornano 0 dopo la cascata.)

**Never:**
- NON modificare codice `src/`, lo schema (`supabase/migrations`), la Edge Function `delete-account`, o i workflow CI (`e2e.yml`/`migrate.yml`): la suite auto-raccoglie il nuovo spec, nessuna modifica CI serve.
- NON usare la `service_role` o altri secret privilegiati; NON verificare la cancellazione fidandosi della cascata FK invece di interrogare le tabelle.
- NON far girare contro un Supabase locale/finto o mock del backend (AD-12/AD-13: un solo progetto reale); niente `supabase start`.
- NON re-implementare il percorso UI del prodotto (è la 7.4): questa è una verifica a livello-dati, non pilota il browser.
- NON coprire qui l'isolamento RLS A↔B fra due account vivi (obbligazione distinta, DW-21): 7.5 riguarda l'ASSENZA di righe per-tabella DOPO la cancellazione.
- NON lasciare utenti residui: il run cancella-e-verifica (percorso felice) o pulisce best-effort (fallimento).

<!-- I/O & Edge-Case Matrix omessa deliberatamente: gli scenari di questa storia (popolamento, baseline, cancellazione, verifica per-tabella, riaccesso) sono comportamenti e2e eseguibili solo contro il Supabase reale (operatore/CI), non scenari unit verificabili offline. Sono espressi integralmente come Acceptance Criteria (giudicati in review). -->

</intent-contract>

## Code Map

- `e2e/account-deletion.spec.ts` (NUOVO) -- l'e2e data-layer: signup (email unica) → popola le 4 tabelle (upsert `user_settings` + rpc `unlock_lesson` + rpc `apply_review`, id di contenuto letti dal DB) → baseline (≥1 riga per tabella) → `functions.invoke('delete-account')` (2xx) → verifica per-tabella (`count === 0` in ciascuna, col JWT vivo, senza `signOut`) → riaccesso fallito. `afterEach` safety-net best-effort guardato da un flag `accountDeleted`.
- `e2e/support/supabaseTestClient.ts` (NUOVO) -- `requiredEnv(name)` (legge la VITE_* nominando il secret mancante) + `createAnonClient()` (`createClient` con anon key, `persistSession:false`/`autoRefreshToken:false`): fonte UNICA del client e2e, riusata dallo spec e da `teardown.ts`.
- `e2e/support/teardown.ts` (MODIFICA) -- consuma `createAnonClient()` da `supabaseTestClient` al posto del proprio `requiredEnv`+`createClient` duplicati; comportamento invariato (stesse opzioni). `deleteTestUser` resta il teardown verificato riusato dal safety-net dello spec (via `.catch`).
- `e2e/support/testUser.ts` (sola lettura, RIUSO) -- `makeTestUser()` per l'email unica per run e la password generata.
- `playwright.config.ts` (sola lettura) -- `testDir:'e2e'`, `workers:1`: il nuovo spec è auto-raccolto, nessuna modifica. Il `webServer` parte ma il test data-layer non usa `page`.
- `.github/workflows/e2e.yml` + `.github/workflows/migrate.yml` (sola lettura) -- eseguono `npm run test:e2e` (= `playwright test` = intera suite), coi VITE_* come env dello STEP (quindi in `process.env` del processo che crea il client). Il nuovo spec entra senza modifiche CI.
- `supabase/migrations/20260925101500_create_review_and_progress.sql` (sola lettura) -- `review_state`/`review_log`/`lesson_progress`: FK `user_id → auth.users on delete cascade`; policy `select`/`insert` owner-scoped `to authenticated` (`(select auth.uid()) = user_id`).
- `supabase/migrations/20260923221517_create_user_settings.sql` + `20260925160000_add_lessons_per_day_to_user_settings.sql` (sola lettura) -- `user_settings(user_id PK cascade, locale not null default 'en', lessons_per_day not null default 1)`: un upsert `{ user_id, locale }` è valido.
- `supabase/migrations/20260925150000_create_unlock_lesson.sql` (sola lettura) -- `rpc unlock_lesson(lesson_id text, unlocked_at timestamptz)`: materializza `lesson_progress` (1 riga) + `review_state` (una per esercizio della lezione), owner-scoped.
- `supabase/migrations/20260925140000_create_apply_review.sql` (sola lettura) -- `rpc apply_review(review_id uuid, exercise_id uuid, outcome text, stage int, due_at timestamptz, reviewed_at timestamptz, used_explanation boolean)`: inserisce 1 riga in `review_log`.
- `supabase/migrations/20260925090000_create_lesson_and_exercise.sql` (sola lettura) -- `lesson`/`exercise`: policy `select using (true) to authenticated` ⇒ leggibili per ottenere un `lesson.id` (ordinale minimo) e un `exercise.id` reali.
- `supabase/functions/delete-account/index.ts` (sola lettura) -- `getUser(jwt)` + `admin.deleteUser` ⇒ cascata su `auth.users`; 2xx su successo. Stesso contratto dell'`invoke`.
- `src/data/settingsRepository.ts:38-40` (sola lettura) -- il contratto `.from('user_settings').upsert({ user_id, locale })` da rispecchiare.
- `src/data/accountGateway.ts` (sola lettura) -- il contratto `functions.invoke('delete-account')`.

## Tasks & Acceptance

**Execution:**
- `e2e/support/supabaseTestClient.ts` -- creare `requiredEnv(name)` e `createAnonClient()` (anon key, senza persistenza di sessione). -- fonte unica di segreti+client per gli e2e data-layer, evita la duplicazione con `teardown.ts`.
- `e2e/support/teardown.ts` -- sostituire il `requiredEnv`+`createClient` locali con `createAnonClient()` da `supabaseTestClient`; nessun cambio di comportamento. -- DRY sulla creazione del client e sulla lettura dei segreti.
- `e2e/account-deletion.spec.ts` -- implementare il test: popolamento delle 4 tabelle coi write-path reali (id letti dal DB), baseline ≥1 riga per tabella, `delete-account` 2xx, verifica per-tabella `count === 0` col JWT vivo, riaccesso fallito, `afterEach` safety-net. -- realizza AC1–AC4.

**Acceptance Criteria:**
- Given un utente autenticato con dati in tutte e quattro le tabelle (`review_state`, `review_log`, `lesson_progress`, `user_settings`), when il test le interroga PRIMA della cancellazione, then ciascuna restituisce almeno una riga (baseline stabilita).
- Given quell'utente, when il test invoca `delete-account`, then l'invocazione riesce (2xx, nessun errore).
- Given l'account cancellato, when il test interroga SINGOLARMENTE ciascuna delle quattro tabelle, then CIASCUNA restituisce zero righe — un controllo esplicito tabella-per-tabella, NON dedotto dalla presenza di un vincolo `on delete cascade`.
- Given l'account cancellato, when il test ritenta l'accesso con le stesse credenziali su un client nuovo, then l'accesso fallisce (nessuna sessione).
- Given il toolchain offline (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright test --list`), when eseguito, then resta verde e il nuovo spec è elencato senza errori di parsing (nessun `src/` toccato; e2e fuori da `tsc`/Vitest; solo anon key).

## Spec Change Log

## Review Triage Log

### 2026-09-28 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 1: (high 0, medium 0, low 1)
- reject: 10: (high 0, medium 0, low 10)
- addressed_findings:
  - `[low]` `[patch]` Uso del global `crypto.randomUUID()` dove l'idioma del repo importa `randomUUID` da `node:crypto` (`testUser.ts`/`answers.ts`; la review di 7.4 ha patchato `testUser.ts` per la stessa consistenza). Aggiunto `import { randomUUID } from 'node:crypto'` e sostituito l'uso del global.
  - `[low]` `[patch]` `countRows`: il `return count ?? 0` silenzioso poteva produrre un FALSO VERDE sulla verifica-cardine post-cancellazione — un `count:null` con `error:null` (PostgREST che non calcola il conteggio) avrebbe reso verde `toBe(0)`. Aggiunta un'asserzione `count` non-null PRIMA del return, così quel caso è CI rossa.
  - `[low]` `[patch]` `requiredEnv` era `export`ata in `supabaseTestClient.ts` senza consumatori esterni (solo `createAnonClient` la usa). Resa privata al modulo; `createAnonClient` resta l'unica API pubblica.

I 10 finding **rigettati** (tutti low): un controllo aggiuntivo con client anonimo senza JWT (indebolirebbe il segnale — le policy `to authenticated` restituiscono comunque 0 righe all'anonimo, quindi non distinguerebbe «cancellato» da «mai esistito»; la forza del test è proprio interrogare col JWT dell'utente cancellato); asserire `del.data`/il body oltre a `del.error` per il 2xx (la funzione reale `delete-account` ritorna SOLO 200 `{ok:true}` su successo e non-2xx altrimenti, quindi `error===null ⟺ 2xx`; e le asserzioni a valle — 0 righe per tabella + riaccesso fallito — sono prova più forte dell'avvenuta cancellazione; coerente col contratto di `accountGateway`/`teardown`); `.order()` su `stateRow` (qualsiasi esercizio della lezione è valido, la determinismo non serve lì, a differenza della lezione scelta per ordinale); guardia/commento sulla finestra di scadenza del JWT (il test dura secondi contro un token di ~1h, già spiegato nelle Design Notes); `console.warn` nel `.catch(() => {})` del safety-net (idioma del repo: `teardown.ts` e l'afterEach di 7.4 ingoiano in silenzio il best-effort); messaggio più mirato sul fallimento «Confirm email» (l'asserzione su `signUp.data.session` NOMINA già la dipendenza); attribuzione «storia 7.4» nell'header di `teardown.ts` (corretta: il modulo nasce in 7.4, e la modifica 7.5 al sorgente del client è già annotata nell'header); asserzione diretta che l'upsert di `user_settings` abbia prodotto una riga (la baseline `≥1` la copre già); ordine di `accountDeleted = true` prima della verifica per-tabella (benigno e riconosciuto dal reviewer: l'utente è comunque cancellato dal 2xx, un re-invoke non rimuoverebbe righe orfane — che sono esattamente ciò che il test rende rosso).

Il rilievo dell'audit di intent-alignment (frontmatter a `in-review`, `operator_actions` assente) **non è un difetto del codice**: descriveva uno snapshot del diff preso a metà workflow, prima del passo di finalizzazione. È stato risolto in questa finalizzazione impostando `status: awaiting-operator` ed enumerando `operator_actions` nel frontmatter (stessa dinamica della finalizzazione di 7.4). Il finding sulla completezza di `PER_USER_TABLES` è stato **differito** (voce `deferred`), non rigettato: è una limitazione reale ma fuori dall'intento (che nomina esattamente quattro tabelle).

## Design Notes

**Perché la lettura col JWT «stantìo» verifica la cancellazione senza `service_role`.** Dopo `admin.auth.admin.deleteUser`, le righe per-utente spariscono per cascata FK, ma l'access token (JWT) che il test client tiene ancora in memoria resta valido fino alla scadenza (~1h): PostgREST autorizza per FIRMA del token, non per esistenza dell'utente, e la RLS filtra per `auth.uid()` = il `sub` (ormai cancellato). Così lo STESSO percorso di lettura autenticato che tornava ≥1 riga prima della cancellazione torna 0 dopo — un prima/dopo pulito, e l'UNICA via anon-key per osservare righe owner-scoped (la `service_role` è vietata). Se le righe NON fossero cascadeate, questa stessa query le vedrebbe comunque (la RLS matcha per `user_id`, non per esistenza dell'utente): il test prova davvero la cancellazione, non la mera presenza del vincolo. Il client è creato con `persistSession:false`/`autoRefreshToken:false` e NON fa `signOut` fra `delete-account` e la verifica, così il token in memoria resta allegato alle query (nessun refresh, il token non è scaduto).

**Perché popolare coi write-path reali.** `upsert(user_settings)` + `unlock_lesson` + `apply_review` producono righe come le produce il prodotto (insert owner-scoped sotto la stessa RLS), leggendo `lesson.id`/`exercise.id` dal DB (mai cablati), così la fixture non può divergere dallo schema. Ordine: `unlock_lesson` materializza `review_state` (una riga per esercizio) e `lesson_progress`; poi si legge un `exercise_id` reale da `review_state` e lo si passa ad `apply_review`, che inserisce la riga di `review_log`.

**Ambito (DW-21).** 7.5 verifica l'ASSENZA di righe per-tabella DOPO la cancellazione dell'account — NON l'isolamento RLS A↔B mentre due account sono vivi (obbligazione distinta e tuttora aperta). Questa spec non lo incorpora di proposito.

**Perché lo stato finale è `awaiting-operator`.** Come in 7.4: l'agente scrive e verifica OFFLINE lo spec, ma NON può (a) disattivare «Confirm email» nella console Supabase — senza, `signUp` torna `session:null` e il test non prosegue; (b) impostare i secret GitHub Actions `VITE_*` per i job e2e; (c) eseguire davvero l'e2e contro il Supabase reale (nessuna credenziale locale, e non si toccano i dati reali dell'owner da una macchina di build). Il verde reale vive in CI dopo le azioni dell'operatore.

## Verification

**Commands (agent-side, offline):**
- `npm run lint` -- expected: 0 errori (src intatto; override `e2e/**` già presente; nessun colore letterale).
- `npm run typecheck` -- expected: 0 errori (e2e fuori da tsconfig).
- `npm test` -- expected: verde (nessuno spec e2e raccolto da Vitest; `boundaries`/`service-role-confinement` invariati ⇒ confini AD-1 intatti).
- `npm run build` -- expected: verde.
- `npx playwright test --list` -- expected: elenca `account-deletion.spec.ts` (e `main-path.spec.ts`) senza errori di parsing/transpilazione (NON esegue: nessun Supabase reale in locale).

**Manual checks (operator/CI):**
- L'esecuzione reale dell'e2e (job PR + collaudo post-merge) e il verde avvengono in CI dopo che l'operatore ha disattivato «Confirm email» e impostato i secret `VITE_*` (le stesse azioni già dovute da 7.4), ora estese a coprire anche la verifica di cancellazione.

## Auto Run Result

Status: awaiting-operator

### Sintesi della modifica implementata

Aggiunto un solo e2e a livello-DATI (`e2e/account-deletion.spec.ts`, `@supabase/supabase-js` diretto, NON dal browser) che prova la cancellazione dell'account **tabella per tabella** contro il progetto Supabase reale: registra un utente effimero (email unica per run) → POPOLA le quattro tabelle per-utente coi write-path REALI dell'app (`user_settings` via upsert — contratto di `settingsRepository`; `lesson_progress`+`review_state` via `rpc('unlock_lesson')`; `review_log` via `rpc('apply_review')`), con gli id di contenuto LETTI dal DB (mai cablati) → BASELINE (≥1 riga per tabella, così lo «0» dopo è un vero prima/dopo) → invoca la STESSA Edge Function `delete-account` (2xx) → VERIFICA ESPLICITA per-tabella: interroga SINGOLARMENTE ciascuna delle quattro tabelle col JWT ANCORA valido dell'utente cancellato (nessun `signOut`) e pretende 0 righe — NON dedotto dalla cascata FK → RIACCESSO fallito su un client nuovo. Estratto `e2e/support/supabaseTestClient.ts` come fonte unica di segreti+client (anon key, senza persistenza), riusata dal nuovo spec e da `teardown.ts` (refactor DRY, comportamento invariato). Nessun file di `src/`, `supabase/` o CI toccato: la suite Playwright esistente auto-raccoglie il nuovo spec, che gira negli stessi job (`e2e.yml` su PR, `migrate.yml` collaudo post-merge).

L'agente ha completato tutto ciò che è realizzabile e verificabile offline. Restano azioni **solo umane** (fuori dal repo), enumerate nel frontmatter `operator_actions`: la disattivazione di «Confirm email» e l'impostazione dei secret `VITE_*` (già dovute da 7.4, condivise) e la verifica del verde del nuovo test in CI (job PR + collaudo post-merge). Per questo lo status finale è `awaiting-operator`, non `done`.

### File creati / modificati

- `e2e/account-deletion.spec.ts` (nuovo) — il test data-layer: signup, popolamento delle 4 tabelle coi write-path reali (id letti dal DB), baseline ≥1, `delete-account` 2xx, verifica per-tabella `count === 0` col JWT vivo, riaccesso fallito, `afterEach` safety-net best-effort guardato da `accountDeleted`.
- `e2e/support/supabaseTestClient.ts` (nuovo) — `requiredEnv` (interno) + `createAnonClient()` (anon key, `persistSession:false`/`autoRefreshToken:false`): fonte unica di segreti+client per gli e2e data-layer.
- `e2e/support/teardown.ts` (modifica) — consuma `createAnonClient()` al posto del `requiredEnv`+`createClient` duplicati; comportamento invariato.

### Esito della review

- Patch applicate: 3 (tutte low) — `crypto.randomUUID()` globale → import da `node:crypto`; `countRows` con asserzione `count` non-null (chiude un potenziale falso verde); `requiredEnv` reso privato al modulo.
- Deferiti: 1 (low) — completezza di `PER_USER_TABLES` verso future tabelle per-utente (vedi `deferred`).
- Rigettati: 10 (tutti low) — vedi Review Triage Log.

### Raccomandazione di review di follow-up

`false`. Patch di questo passaggio: high 0, medium 0, low 3. Punteggio `3×medium(0) + 1×low(3) = 3` (< 5) e nessun patch high ⇒ nessuna review di follow-up raccomandata.

### Verifica eseguita (offline, dopo le patch)

- `npm run lint` — 0 errori.
- `npm run typecheck` — 0 errori (e2e fuori da tsconfig).
- `npm test` — 1213 test verdi su 99 file (nessuno spec e2e raccolto da Vitest; `boundaries`/`service-role-confinement` invariati ⇒ confini AD-1 intatti).
- `npm run build` — verde (solo l'avviso preesistente di chunk-size).
- `npx playwright test --list` — elenca `account-deletion.spec.ts` e `main-path.spec.ts`, nessun errore di parsing/transpilazione.

### Rischi residui

- L'esecuzione REALE dell'e2e non è verificabile offline: il verde vero dipende dalle azioni operatore (`operator_actions`). Finché non sono fatte, i job e2e falliscono al secret-check o alla registrazione (per costruzione, con messaggi nominati).
- La verifica poggia sulla semantica «PostgREST autorizza per firma del JWT, non per esistenza dell'utente»: se il progetto reale rifiutasse il JWT dopo la cancellazione, la query di verifica fallirebbe (l'asserzione `error` nullo la renderebbe rossa, NON un falso verde) — è il Block If dello spec, verificato in planning ma misurabile solo in CI.
- Il test è scoperto verso una futura nuova tabella per-utente non agganciata alla cascata (differito): oggi copre le quattro tabelle nominate dall'intento.
