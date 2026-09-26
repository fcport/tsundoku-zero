---
title: 'Riapplicare la coda non falsa niente'
type: 'feature'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
baseline_revision: 'f4a430d863b0b5c01a3a87195929aa6518d19160'
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      Il vero e2e runtime dell'idempotenza contro il Supabase reale (la RPC
      `apply_review` che deduplica davvero su Postgres) non è esercitato: qui la
      porta è MODELLATA in memoria e il contratto SQL è provato solo
      strutturalmente.
    evidence: |-
      «Applicato esattamente una volta» = (client invia una review_id stabile) ∘
      (server deduplica su quella id). La metà client è provata a runtime in
      reviewIdempotency.test.ts; la metà server è provata strutturalmente (AST)
      in migrations.test.ts (Story 3.9) e il passthrough dell'adapter in
      reviewRepository.test.ts. Il solo anello non verificato a runtime è la RPC
      live che deduplica su Postgres reale — operator-gated per AD-12/AD-13
      (nessuna istanza locale; un solo progetto reale con i dati M1 dell'owner) e
      post-merge per SPINE-DELTA §148 (le migrazioni si applicano solo al merge
      su main, mai da un ramo di PR). Serve inoltre infrastruttura e2e (utenti
      per-run + teardown via Edge Function) oggi assente nel repo. Coerente coi
      deferred già registrati in 4.3/4.4.
    location: >-
      src/features/study/reviewIdempotency.test.ts:108 (makeModeledReviewGate)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** La catena offline è completa — la coda sopravvive alla chiusura (4.2), si drena da sola al ritorno della rete (4.3) e ha un indicatore (4.4) — ma NIENTE prova end-to-end che riapplicare la stessa coda non falsi i dati. Un drenaggio ritentato (blip di rete a metà invio, ack perso) o una coda ripresa due volte non devono produrre righe duplicate in `review_log` né far avanzare due volte lo stadio di un esercizio, altrimenti le statistiche di Epic 5 diventano un'approssimazione. L'idempotenza esiste già (RPC `apply_review` di Epic 3 + `review_id` chiave client); questa storia la VERIFICA, non la introduce.

**Approach:** Un test di simulazione end-to-end in env `node` (`reviewIdempotency.test.ts`, features/study) che compone l'INTERA catena client con la stessa superficie react-query di `reviewMutation.test.ts` (`MutationObserver` + `REVIEW_SYNC_SCOPE`, `onlineManager`, `dehydrate`/`hydrate`, `registerReviewMutationDefaults`): perdita di rete → risposte `paused` → chiusura/riapertura (dehydrate → NUOVO client con default ri-registrati PRIMA dell'hydrate) → ritorno rete → `resumePausedMutations()`. Il fatto LOAD-BEARING che questa storia prova — e che nessun test copre ancora — è che l'idempotency key `review_id` è STABILE per tutto il ciclo di vita: generata una volta, sopravvive a persist/riapertura, e viene RI-inviata IDENTICA su ogni ritentativo e su ogni ripresa. Una porta `applyReview` modellata (in memoria) rispecchia il contratto della RPC (`ON CONFLICT (id) DO NOTHING` + update dello stadio guardato dall'insert) per rendere osservabile «applicato esattamente una volta» a livello di log/stadio; il contratto SQL reale resta provato strutturalmente da `migrations.test.ts` (Story 3.9), non qui.

## Boundaries & Constraints

**Always:**
- Il test gira in env `node` (default della suite) esercitando la superficie react-query DIRETTAMENTE, come `reviewMutation.test.ts`: nessun browser, nessun IndexedDB reale, nessun DB vivo. Riusa i pattern locali di quel file (`startMutation` via `MutationObserver` con `mutationKey: [...REVIEW_MUTATION_KEY]` + `scope: REVIEW_SYNC_SCOPE`; salvataggio/ripristino di `onlineManager` in `beforeEach`/`afterEach`; `dehydrate`/`hydrate`; `registerReviewMutationDefaults`).
- Le asserzioni portanti sono CLIENT-side e REALI: (a) la stessa `review_id` raggiunge la porta su OGNI tentativo (ritentativo automatico e ri-drenaggio); (b) una mutation già risolta (`success`) NON viene ri-inviata da un secondo `resumePausedMutations()`; (c) il drenaggio è in serie e in ordine (garantito da `REVIEW_SYNC_SCOPE`).
- La riapertura ri-registra i default PRIMA dell'hydrate (`registerReviewMutationDefaults(target, …)` poi `hydrate(target, …)`), riproducendo l'ordine di bootstrap di `main.tsx`: senza, la ripresa fallirebbe con `No mutationFn found` (AD-8 vincolo 1). Quest'ordine fa parte della simulazione end-to-end.
- La porta `applyReview` modellata rispecchia FEDELMENTE il contratto della RPC: inserisce in un `review_log` in memoria (una `Map` chiavata su `review_id`) con dedup, e fa avanzare lo stadio SOLO quando l'insert produce davvero una riga (guardia); nel caso ritentativo la scrittura avviene PRIMA dello throw transitorio, così il secondo tentativo esercita il dedup reale sulla riga già presente.
- Le `Date` (`dueAt`/`reviewedAt`) e la `review_id` viaggiano fisse (costanti tipo `reviewMutation.test.ts`), mai da `Date.now()`/`crypto.randomUUID()` nel test: il determinismo è un requisito.

**Block If:** _Nessuna._ Il meccanismo è fissato da AD-7 (RPC idempotente), AD-8 (coda TanStack, ri-registrazione default), dalla RPC di Story 3.9 e dal macchinario di 4.1-4.3. Nessuna ambiguità richiede input umano.

**Never:**
- NON avviare un Supabase reale, Playwright/Cypress, pglite o qualunque database: AD-12/AD-13 vietano un'istanza locale; il vero e2e runtime contro il progetto reale (utenti per-run + teardown verificato di AD-13, e il gate «migrazioni solo al merge su main» di SPINE-DELTA §148) è operator-gated e va registrato come `deferred`, non tentato.
- NON riverificare la STRUTTURA SQL già coperta da `migrations.test.ts` (Story 3.9: `on conflict (id) do nothing`, update guardato da `from logged`, `returning` presente, nessun ricalcolo): va REFERENZIATA, duplicarla è fuori scopo.
- NON modificare codice di produzione (`reviewMutation.ts`, persister, RPC, `SessionScreen.tsx`, store): questa storia AGGIUNGE solo verifica. Un difetto d'idempotenza scoperto sarebbe un finding separato — non atteso, il macchinario esiste ed è corretto.
- NON ricalcolare outcome/`dueAt`/`reviewedAt` (il drenaggio non ricalcola — coperto da 4.3); non usare fake-timer per il backoff (sovrascrivi `retryDelay: 0` a livello observer come `startMutationNoDelay`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ritentativo dopo scrittura + ack perso | 1 risposta drenata; la porta scrive la riga poi throwa una volta (transitorio); il `retry` dei default ri-drena | 2ª chiamata con la STESSA `review_id`; `review_log` modellato = 1 riga per quella id; stadio avanzato UNA volta | ritentativo automatico, nessuna azione utente |
| Coda ripresa due volte | dopo un drenaggio riuscito, `resumePausedMutations()` chiamata di nuovo | `applyReview` NON re-invocata (0 chiamate aggiuntive): le mutation `success` non sono più `paused` | No error expected |
| Sessione offline multipla, chiusura/riapertura | N risposte offline `paused`, `review_id` distinte → dehydrate → NUOVO client + default ri-registrati → hydrate → online → resume | ogni `applyReview` chiamata esattamente una volta, in ORDINE (scope seriale), ciascuna con la propria `review_id` stabile; log modellato = N righe distinte | No error expected |
| Stabilità della chiave nel ciclo di vita | 1 risposta offline → persist → riapertura → resume, più un ritentativo | la `review_id` che raggiunge la porta a ogni tentativo è quella dell'istante della risposta: MAI rigenerata | No error expected |

</intent-contract>

## Code Map

- `src/features/study/reviewIdempotency.test.ts` -- **CREATE** (env node, features/study): la simulazione end-to-end. Helper locali sul modello di `reviewMutation.test.ts` (`startMutation`/`startMutationNoDelay` via `MutationObserver`; `onlineManager` salvato/ripristinato). Porta `applyReview` modellata da una `Map<reviewId, row>` (review_log) + `Map<exerciseId, stage>`: dedup su `review_id`, bump dello stadio solo su insert reale, scrittura-prima-dello-throw nel caso ritentativo. Copre Matrix + AC1-AC4.
- `src/features/study/reviewMutation.ts` -- READ-ONLY: `REVIEW_MUTATION_KEY` (25), `REVIEW_SYNC_SCOPE` (32), `REVIEW_SYNC_MAX_RETRIES` (39), `registerReviewMutationDefaults` (63-79), `ReviewMutationVars` (49-52). Identità della coda e default che il test pilota.
- `src/features/study/reviewMutation.test.ts` -- READ-ONLY riferimento: i pattern canonici da riusare (`startMutation`, `startMutationNoDelay` con `retryDelay: 0`, `spyReview`, round-trip `dehydrate`/`hydrate`, salva/ripristina `onlineManager`, `qc.clear()` per test).
- `src/domain/ports/reviewRepository.ts` -- READ-ONLY: `ApplyReviewInput` (`reviewId`, `exerciseId`, `outcome`, `stage`, `dueAt`, `reviewedAt`, `usedExplanation`) e `ReviewRepository`. La forma della porta che la RPC modellata implementa.
- `src/domain/schedule.ts` -- READ-ONLY: tipi `ReviewState`, `ReviewOutcome` per le variabili.
- `supabase/migrations/20260925140000_create_apply_review.sql` -- READ-ONLY: la RPC REALE (`insert … on conflict (id) do nothing … returning`, `update review_state … from logged`) il cui contratto la porta modellata rispecchia. Non modificata.
- `src/migrations.test.ts:1090-1465` -- READ-ONLY: la prova STRUTTURALE (AST) di Story 3.9 dell'idempotenza SQL — `on conflict (id) do nothing`, update guardato da `from logged`, `returning` presente, passthrough senza ricalcolo. È la metà server-side della verifica di 4.5: referenziata, non duplicata.
- `src/app/reviewPersister.ts` / `src/app/main.tsx` -- READ-ONLY: cablaggio persist/resume (`resumeReviewQueue`, `subscribeReviewQueueResume`, ordine register→provider). La simulazione riproduce l'ordine register→restore→resume via API react-query, SENZA importare `app` (nessuna violazione di confine features→app).
- `src/features/study/SessionScreen.tsx:~289` -- READ-ONLY: dove `crypto.randomUUID()` genera la `review_id` UNA volta per risposta (origine della chiave). Non modificata; il test asserisce la stabilità della chiave al confine variabili/porta, non ri-eseguendo `SessionScreen`.

## Tasks & Acceptance

**Execution:**
- `src/features/study/reviewIdempotency.test.ts` -- CREARE la simulazione end-to-end con la porta `applyReview` modellata (dedup su `review_id`, bump guardato) e i casi della Matrix. -- L'unica superficie di verifica dell'intera storia (test-only).

**Acceptance Criteria:**
- Given una coda `paused` recuperata (riaperta con default ri-registrati), when viene drenata e un ritentativo automatico ri-drena la stessa mutation (la porta ha già scritto la riga al 1º tentativo), then il `review_log` modellato contiene esattamente UNA riga per quella `review_id` (nessun doppione) e la porta ha ricevuto la STESSA `review_id` su entrambi i tentativi. (AC1)
- Given la stessa `review_id` applicata due volte (ritentativo dopo throw transitorio post-scrittura), when il secondo tentativo esegue, then lo stadio dell'esercizio modellato è avanzato ESATTAMENTE una volta (update guardato dall'insert). (AC2)
- Given una simulazione end-to-end — `onlineManager` offline → più risposte `paused` con `review_id` distinte → dehydrate → NUOVO client con default ri-registrati → hydrate → `onlineManager` online → `resumePausedMutations()` — when eseguita, then ogni risposta offline è applicata esattamente una volta (una chiamata per `review_id`), in ordine; e una SECONDA `resumePausedMutations()` non aggiunge alcuna applicazione (le mutation risolte non sono più `paused`). (AC3)
- Given l'intero ciclo di vita (persist → riapertura → resume → ritentativo), when la `review_id` raggiunge la porta a ogni tentativo, then è sempre quella dell'istante della risposta: mai rigenerata dal drenaggio né dal round-trip. (AC4)

## Design Notes

**Verifica in due metà, esplicitamente ponticellate.** «Applicato esattamente una volta» = (il client invia una `review_id` STABILE) ∘ (il server deduplica su quella `review_id`). La prima metà è REALE e provata qui a livello client: la `review_id` è congelata nelle variabili della mutation (generata in `SessionScreen` con `crypto.randomUUID()`), sopravvive al round-trip `dehydrate`/`hydrate` e viene ri-inviata identica dal `retry` dei default. La seconda metà è il contratto SQL `ON CONFLICT (id) DO NOTHING` + update guardato, provato STRUTTURALMENTE da `migrations.test.ts` (Story 3.9). La porta modellata di questo test replica quel contratto solo per COMPORRE la simulazione osservabile — non è la prova del server, ed è dichiarato così per non spacciare un mock auto-avverante per verifica.

**Perché il caso ritentativo scrive-prima-di-throware.** Lo scenario reale di AC1/AC2 è: il 1º invio raggiunge il server e scrive la riga, ma l'ack si perde; il `retry` ri-invia. Modellare lo throw DOPO la scrittura fa sì che il 2º tentativo trovi la `review_id` già presente ed esca via dedup — è esattamente lì che l'idempotenza conta. Backoff neutralizzato con `retryDelay: 0` a livello observer (come `startMutationNoDelay`), il conteggio `retry` resta dai default.

**Perché «ripresa due volte» è client-side reale.** Dopo un drenaggio riuscito la mutation è `success`, non più `isPaused`; `resumePausedMutations()` riprende solo le `paused`, quindi una seconda chiamata è un no-op per le risolte. Questa è la metà client di «drenata due volte → nessun doppione», e non dipende dal dedup della porta.

## Verification

**Commands:**
- `npm test` -- expected: suite verde, inclusi i nuovi test di `reviewIdempotency.test.ts` (AC1-AC4, Matrix) e i test 4.1-4.4 invariati.
- `npm run typecheck` -- expected: nessun errore TS (tipi `ApplyReviewInput`/`ReviewMutationVars`/`ReviewState` risolti).
- `npm run lint` -- expected: nessuna violazione di confine (features → domain / `@tanstack/react-query`; nessun import da `app`).

**Manual checks (if no CLI):**
- Confermare che il test NON apra connessioni di rete/DB e non importi da `src/app/**`, e che la porta modellata avanzi lo stadio solo su insert reale (guardia) rispecchiando la RPC.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 1: (high 0, medium 1, low 0)
- reject: 12
- addressed_findings:
  - `[low]` `[patch]` La pulizia dei QueryClient (`source.clear()/target.clear()`) era in fondo a ogni `it`, dopo gli `await`: un `expect` fallito a metà test lasciava cache e timer di backoff pendenti che potevano contaminare il singleton `onlineManager`. Introdotta una factory `makeClient()` che registra i client in un array di modulo, ripuliti in `afterEach` (anche sui percorsi di fallimento); rimosse le `clear()` per-test ridondanti.
  - `[low]` `[patch]` AC4 provava la sopravvivenza al round-trip solo di `reviewId`/`dueAt`/`reviewedAt` e l'uguaglianza tra i tentativi solo sulla `review_id`. Aggiunto `expect(restoredVars.input).toEqual(makeInput('rev-lifecycle'))` (fedeltà dell'INTERO payload pre-calcolato al dehydrate/hydrate) e `expect(calls[1][0]).toEqual(calls[0][0])` (il ritentativo ri-invia un payload value-identico, non solo la stessa id).
  - `[low]` `[patch]` Nulla documentava che `input.reviewId` (campo client) è memorizzato come `review_log.id`, la colonna target di `ON CONFLICT (id) DO NOTHING`. Aggiunto un commento sul dedup della porta modellata per evitare che un futuro lettore "corregga" la Map verso un inesistente campo `id`.

Note sui reject principali (rumore, house-style, o fuori scopo per autorità dell'intento):
- **Due entry distinte con la stessa `review_id` (double-tap) non testate**: non è un percorso di produzione — `SessionScreen` genera una `crypto.randomUUID()` PER RISPOSTA, quindi due valutazioni hanno id diverse. Lo scenario della storia («applicata due volte») è il RITENTATIVO/ri-drenaggio della stessa mutation, coperto da AC1/AC2.
- **Fallimento permanente / retry pre-scrittura / ordine sotto fallimento a metà drenaggio non testati**: il fallimento permanente online e il retry sono già coperti da `reviewMutation.test.ts` (4.3); la serializzazione dello scope è provata lì. Fuori scopo per l'idempotenza di questa storia.
- **`result` (glue di cache ottimistica) / `usedExplanation` non asseriti a parte**: la fedeltà del payload al round-trip è ora coperta dal `toEqual` completo (patch 2); `result` è materia di 4.2 (fedeltà del persister), già coperta.
- **Duplicazione degli helper con `reviewMutation.test.ts` / estrarre un test-kit condiviso**: la convenzione del repo è file di test auto-contenuti (cfr. `reviewPersister.test.ts`, `SyncIndicator.test.tsx`); estrarre un kit è un refactor separato, non nell'intento.
- **`stageByExercise.get('ex-1') === 1` coincide col letterale `input.stage`**: è ridondanza innocua — `stageBumps.get('ex-1') === 1` è l'asserzione portante che prova l'avanzamento-una-volta (e quindi la guardia che protegge anche `review_count`).
- **`Promise.resolve()` a flush singolo / cast non guardati su cache interne**: il test è deterministico e verde; i cast falliscono in modo RUMOROSO (TypeError), non silenzioso.
- **Resume su coda vuota non testato**: safety generica del resume, non un rischio d'idempotenza di questa storia.

## Auto Run Result

Status: done

**Sintesi della modifica.** Storia di sola VERIFICA (nessun codice di produzione toccato): la catena offline delle valutazioni ora ha una prova end-to-end che RIAPPLICARE la coda non falsa i dati. Un unico file di test in env `node` (`reviewIdempotency.test.ts`, features/study) compone l'intera catena client con la stessa superficie react-query di `reviewMutation.test.ts` (`MutationObserver` + `REVIEW_SYNC_SCOPE`, `onlineManager`, `dehydrate`/`hydrate`, `registerReviewMutationDefaults`) e una porta `applyReview` MODELLATA (in memoria) che rispecchia il contratto della RPC (`ON CONFLICT (id) DO NOTHING` + update dello stadio guardato dall'insert, con scrittura-prima-dello-throw per il caso ritentativo). Il fatto load-bearing, provato a runtime lato client, è che la `review_id` è STABILE per tutto il ciclo di vita (generata una volta, sopravvive a persist/riapertura, ri-inviata identica su ritentativo e ripresa). Il contratto SQL resta provato strutturalmente da `migrations.test.ts` (Story 3.9) e referenziato, non duplicato.

**File cambiati (rispetto a `f4a430d8`).**
- `src/features/study/reviewIdempotency.test.ts` (CREATE) — 5 test: AC1 (coda paused recuperata, un ritentativo ri-drena ⇒ 1 sola riga per `review_id`, stessa id su entrambi i tentativi), AC2 (stessa `review_id` due volte ⇒ stadio avanza esattamente una volta), AC3 (offline con N risposte distinte → dehydrate → NUOVO client + default → hydrate → online → resume ⇒ ognuna applicata una volta, in ordine; 2ª resume no-op), AC4 (ciclo di vita completo ⇒ `review_id` e payload mai rigenerati/alterati), Matrix (coda ripresa due volte senza ritentativo ⇒ 2ª resume no-op).
- `_bmad-output/implementation-artifacts/spec-4-5-riapplicare-la-coda-non-falsa-niente.md` (CREATE) — questa spec.

**Esito review (questo pass).** patch applicati: 3 (tutti low — pulizia robusta in `afterEach`, rinforzo fedeltà/identità del payload in AC4, commento sul mapping `review_id`↔`review_log.id`). Item differiti: 1 (medium — il vero e2e runtime contro il Supabase reale, operator-gated per AD-12/AD-13 e post-merge per SPINE-DELTA §148, con infra e2e oggi assente). Item rifiutati: 12 (rumore, house-style, o fuori scopo per autorità dell'intento — vedi Review Triage Log).

**Raccomandazione di follow-up review.** `false`. Findings di questo pass triaged `patch`: high 0, medium 0, low 3. Punteggio `3×0 + 1×3 = 3` (< 5) e nessun high ⇒ `followup_review_recommended: false`.

**Verifica eseguita.**
- `npm run typecheck` ⇒ nessun errore TS.
- `npm run lint` ⇒ nessuna violazione di confine (features → domain / `@tanstack/react-query`; nessun import da `app`).
- `npm test` ⇒ 88 file, 990 test verdi (inclusi i 5 di `reviewIdempotency.test.ts`; 4.1-4.4 invariati). Eseguito prima e dopo i patch.
- Matrix Test Audit: ogni riga della matrice I/O coperta da un test eseguito e passato (ritentativo dopo ack perso → AC1; coda ripresa due volte → Matrix; sessione offline multipla/chiusura-riapertura → AC3; stabilità della chiave → AC4; + AC2 per l'avanzamento guardato dello stadio).

**Rischi residui.** L'item `deferred` (medium): l'idempotenza è verificata a runtime solo lato client + strutturalmente lato SQL; la RPC live che deduplica su Postgres reale non è esercitata in-repo. Il ponte modello↔realtà è dichiarato esplicitamente nell'header del test e provato ai confini che l'architettura permette (adapter passthrough in `reviewRepository.test.ts`, struttura SQL in `migrations.test.ts`).
