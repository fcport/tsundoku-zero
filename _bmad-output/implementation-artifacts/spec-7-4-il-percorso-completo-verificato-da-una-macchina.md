---
title: 'Il percorso completo, verificato da una macchina'
type: 'chore'
created: '2026-09-28'
baseline_revision: '6a4e3b2579ac9829a2c1aa8b6ab99bcc74eff5d4'
status: done
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: ['oversized']
deferred: []
operator_actions:
  - "Disattiva «Confirm email» nella console Supabase (Authentication > Providers > Email) così signUp restituisce subito una sessione e la registrazione dell'e2e prosegue senza conferma via email (cfr. src/data/authGateway.ts)."
  - "Imposta i GitHub Actions secrets VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Settings > Secrets and variables > Actions) con l'URL del progetto Supabase reale e la sua anon key pubblica, così i job e2e.yml (pull request) e il collaudo in migrate.yml (push su main) possono costruire ed eseguire l'app contro il progetto reale. Non impostare mai la service_role."
  - "Apri una pull request e verifica che il workflow «E2E (percorso principale)» esegua il test verde contro il Supabase reale; dopo il merge su main, verifica che «Migrate & deploy functions» applichi le migrazioni e poi esegua verde l'e2e di collaudo."
---

<intent-contract>

## Intent

**Problem:** Il percorso principale del prodotto — registrazione → sblocco della prima lezione → risoluzione degli esercizi → pila a zero — attraversa tutte le epiche funzionali ma non è coperto da nessun test integrato: una regressione end-to-end si scoprirebbe dall'uso, non in CI. Manca inoltre la disciplina di pipeline che leghi questa verifica al Supabase reale senza mettere a rischio i dati di studio dell'owner (metrica M1).

**Approach:** Introdurre Playwright (nuovo toolchain, isolato da `src/`) e un solo test e2e che pilota il percorso principale dal browser contro il progetto Supabase reale, con **email unica per run**, nessuna fixture condivisa, e teardown che invoca la STESSA Edge Function `delete-account`. Cablare la pipeline: un workflow su `pull_request` esegue l'e2e sullo schema corrente (senza applicare migrazioni); `migrate.yml` (su `push:main`) applica le migrazioni e POI esegue un e2e di collaudo. Nessun codice applicativo, schema o Edge Function viene toccato: la storia aggiunge solo test e cablaggio CI.

## Boundaries & Constraints

**Always:**
- L'e2e vive in `e2e/` come `*.spec.ts`, **fuori da `src/`**: non è raccolto da Vitest (`src/**/*.test.*`) né incluso in `tsc --noEmit` (tsconfig include solo `src`/`scripts`/config). Playwright transpila i propri spec.
- L'e2e pilota SOLO superfici reali dell'app dal browser: rotte pubbliche/private, **ruoli accessibili + testo i18n**, e gli id già presenti `#auth-email`/`#auth-password`. Non importa moduli di `src/` (nessun accoppiamento ai confini AD-1) e non inventa `data-testid` inesistenti.
- Ogni run crea utenti con **email unica per quel run**; nessuna fixture condivisa, nessun utente di test permanente; la password è generata nel test.
- Il **teardown** invoca la STESSA Edge Function `delete-account` (via un client `supabase-js` autenticato come l'utente di test — lo stesso contratto di `src/data/accountGateway.ts`), gira SEMPRE (anche su fallimento del test) e **verifica l'esito 2xx**: pulizia verificata, non assunta.
- Le risposte corrette sono DERIVATE dal contenuto canonico `content/lessons/01-*.json`, coerenti con `answerOptions`/`composeResponse`: single-select → click sul bottone con testo = `answer`; assemble → click sui bottoni testo = token di `answer` nell'ordine; select-span → click sul bottone-segmento all'indice `answer.start`. Nessuna soluzione cablata a mano che possa divergere dal contenuto.
- Pipeline PR (`e2e.yml`, `on: pull_request`): esegue l'e2e contro il Supabase reale sullo schema **corrente**; NON applica migrazioni. Verifica fail-fast dei secret richiesti che **nomina** il secret mancante (idioma di `migrate.yml`).
- Pipeline post-merge: `migrate.yml` (`on: push:main`) applica migrazioni + deploy funzione e POI esegue un e2e di **collaudo**. L'ordine è vincolante: il collaudo gira dopo `db push`.
- Segreti: l'e2e usa SOLO `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (anon pubblica). MAI la `service_role` né altri secret privilegiati (coerente con `.env.example` e `src/service-role-confinement.test`).
- Determinismo: contesto browser pulito per test (nessuna sessione preesistente ⇒ atterraggio su `/login`); ancore testuali robuste alla lingua (regex en|it o lingua fissata prima delle asserzioni).

**Block If:**
- Se il percorso principale NON risultasse pilotabile end-to-end dalle superfici pubbliche esistenti senza introdurre nuovo codice applicativo in `src/` (es. manca un'affordance necessaria): HALT `blocked` con la lacuna. (In planning verificato pilotabile: `#auth-email`/`#auth-password` + `auth.submit`; `dashboard.startAction`; `dashboard.primaryAction` → `/studia`; opzioni-bottone per esercizio; `session.next`; `session.complete.body`.)

**Never:**
- NON modificare codice applicativo in `src/`, lo schema (`supabase/migrations`) o la Edge Function `delete-account`: solo test e2e + cablaggio CI.
- NON far girare l'e2e contro un Supabase locale/finto o mock del backend (AD-12/AD-13: un solo progetto reale); niente `supabase start`.
- NON far applicare migrazioni dalla pipeline di PR (resta di `migrate.yml`, su `push:main`).
- NON usare utenti/email di test permanenti o condivisi; NON lasciare il teardown "best-effort" senza verifica dell'esito.
- NON introdurre la `service_role` o altri secret privilegiati nella CI dell'e2e.
- NON eseguire la verifica di cancellazione tabella-per-tabella (è la storia 7.5): qui il teardown verifica solo l'esito 2xx della funzione.

<!-- I/O & Edge-Case Matrix omessa deliberatamente: gli scenari di questa storia (percorso principale, email unica, teardown, pipeline PR/post-merge) sono comportamenti e2e/CI eseguibili solo contro il Supabase reale (operatore/CI), non scenari unit verificabili offline. Sono espressi integralmente come Acceptance Criteria (giudicati in review). -->

</intent-contract>

## Code Map

- `playwright.config.ts` (NUOVO, radice) -- config Playwright: `testDir: 'e2e'`, `webServer` che avvia l'app (`vite preview` dopo `vite build`, o `vite`) con `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` dall'ambiente, `baseURL` su localhost, `projects` con il solo chromium, `retries` 0 in locale / 1 in CI. Cade nell'override eslint `*.config.{ts,js}` (globals node). FUORI da `tsconfig.include` ⇒ non toccato da `tsc --noEmit`.
- `e2e/main-path.spec.ts` (NUOVO) -- il test del percorso: registrazione (email unica) → sblocco 1ª lezione → 3 esercizi → asserzione `session.complete.body`. Teardown (fixture/`afterEach`) che invoca `delete-account` e verifica 2xx.
- `e2e/support/` (NUOVO, opzionale) -- helper: generatore di email unica per run; client `supabase-js` per il teardown; lettura di `content/lessons/*.json` per le risposte. (In alternativa inline nello spec.)
- `.github/workflows/e2e.yml` (NUOVO) -- `on: pull_request`: `npm ci`, `npx playwright install --with-deps chromium`, run e2e con secret `VITE_*`; step di verifica fail-fast dei secret (idioma di `migrate.yml`). NON su `push:main`.
- `.github/workflows/migrate.yml` (MODIFICA) -- dopo `db push` + `functions deploy`, aggiungere l'e2e di **collaudo** (Node via `.nvmrc`, `npm ci`, `playwright install`, run e2e) con gli stessi secret `VITE_*`. Mantenere l'ordine e la disciplina `concurrency` esistente.
- `eslint.config.js` (MODIFICA) -- aggiungere override `files: ['e2e/**/*.ts']` con `globals.node` (gli spec usano `process.env`); `playwright.config.ts` è già coperto da `*.config.{ts,js}`. `boundaries/include` resta `src/**/*` (l'e2e non è nel grafo AD-1).
- `package.json` (MODIFICA) -- devDependency `@playwright/test`; script `test:e2e` = `playwright test`. `@supabase/supabase-js` è già presente (usato dal teardown).
- `.env.example` (MODIFICA) -- nota che `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` servono anche all'e2e (locale e come secret GitHub Actions) e che l'e2e richiede "Confirm email" DISATTIVATO in console.
- `src/features/auth/AuthScreen.tsx:64` -- (sola lettura) default `sign-up`; id `#auth-email`/`#auth-password` in `AuthForm`; submit da `auth.submit`.
- `src/features/dashboard/DashboardScreen.tsx:220-240,306-333` -- (sola lettura) primo avvio (`unlocked===0`) `firstRunBody` + `startAction`; a `count>0` `primaryAction` → `onStartSession` (naviga a `/studia`).
- `src/features/study/SessionScreen.tsx:269-316,389-419` -- (sola lettura) risposta auto-sottomessa al completamento; `session.next`; completamento `session.complete.body`/`dismiss`.
- `src/domain/exercise-presentation.ts:56-111` -- (sola lettura) `answerOptions` (ordine/permutazione) e `composeResponse` (indice→risposta): base del match testo/indice.
- `content/lessons/01-la-particella-wo.json` -- (sola lettura) le 3 risposte: single-select `きょう`; assemble 8 token in ordine; select-span segmento `start:0`.
- `src/data/accountGateway.ts:50-68` -- (sola lettura) contratto `functions.invoke('delete-account')` = stessa funzione del teardown.
- `src/app/routes.ts` -- (sola lettura) `ROOT_PATH '/'`, `STUDY_PATH '/studia'`, rotte pubbliche `/login`,`/privacy`,`/riconoscimenti`.
- `.gitignore:30-35` -- (sola lettura) `playwright-report/`, `test-results/`, `blob-report/`, `.playwright/` già ignorati.

## Tasks & Acceptance

**Execution:**
- `package.json` -- aggiungere devDep `@playwright/test` e lo script `test:e2e`; nessun'altra dipendenza (supabase-js già presente). -- abilita il toolchain e2e senza toccare l'app.
- `playwright.config.ts` -- creare la config (testDir `e2e`, webServer con env `VITE_*`, baseURL localhost, chromium, retries 0/1). -- fondazione del run e2e.
- `e2e/main-path.spec.ts` (+ eventuali `e2e/support/*`) -- implementare il test del percorso e il teardown via `delete-account` con verifica 2xx; email unica per run; risposte derivate da `content/lessons/01-*.json`. -- realizza AC1, AC2, AC3.
- `.github/workflows/e2e.yml` -- creare il workflow `on: pull_request` con verifica dei secret, `playwright install`, run e2e contro il Supabase reale (schema corrente, nessuna migrazione). -- realizza la prima parte di AC4.
- `.github/workflows/migrate.yml` -- aggiungere l'e2e di collaudo dopo `db push`/`functions deploy`. -- realizza la seconda parte di AC4 (migrazioni solo dopo merge, seguite dal collaudo).
- `eslint.config.js` -- override `e2e/**/*.ts` con globals node. -- tiene lint verde senza allentare i confini di `src`.
- `.env.example` -- documentare l'uso dei VITE_* per l'e2e e la dipendenza "Confirm email" off. -- rende esplicita la configurazione richiesta.

**Acceptance Criteria:**
- Given la suite Playwright, when eseguita contro il progetto Supabase reale, then un test copre registrazione → sblocco della prima lezione → risoluzione degli esercizi → pila a zero (asserendo `session.complete.body`).
- Given un run e2e, when avviato, then crea utenti con email unica per quel run and non usa fixture condivise né utenti di test permanenti.
- Given un run e2e, when termina (anche se il test fallisce), then rimuove gli utenti creati invocando la stessa Edge Function `delete-account` and verifica che l'invocazione sia riuscita (2xx).
- Given la pipeline su una pull request, when eseguita, then esegue l'e2e contro il Supabase reale sullo schema corrente (nessuna migrazione applicata dalla PR) and, dopo il merge su `main`, `migrate.yml` applica le migrazioni seguite da un e2e di collaudo.
- Given il toolchain offline (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright test --list`), when eseguito, then resta verde e l'e2e è elencato senza errori di parsing (l'aggiunta non tocca `src/` né i confini AD-1; l'e2e è fuori da `tsc`/Vitest).

## Spec Change Log

## Review Triage Log

### 2026-09-28 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 1, low 5)
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[medium]` `[patch]` Corsa nel ciclo solve/advance di `main-path.spec.ts`: `nextButton.isVisible()` letto in modo sincrono poteva rientrare in `solveCurrentExercise` su una card già risposta (opzioni `disabled`) ⇒ click su bottone disabilitato ⇒ timeout. Ristrutturato con attesa deterministica `await expect(nextButton.or(completeBody)).toBeVisible()` prima di decidere; rimossi gli `isVisible().catch(() => false)` dal controllo di flusso.
  - `[low]` `[patch]` `client.auth.signOut()` del teardown non protetto: un rifiuto sulla sessione ormai invalida (post-delete) avrebbe trasformato una pulizia già verificata 2xx in un fallimento di teardown. Reso `.catch(() => {})`.
  - `[low]` `[patch]` Ramo `assemble` senza `exact` nel match del bottone-tessera: aggiunto `exact: true` (come single-select), irrobustendo contro un futuro token sottostringa di un altro.
  - `[low]` `[patch]` `answers.ts` lanciava `ENOENT`/`SyntaxError` opachi su contenuto mancante/malformato o cwd errata: aggiunti errori NOMINATI (esistenza del file, JSON valido, `exercises` è un array), idioma del repo.
  - `[low]` `[patch]` `testUser.ts`: `import { randomUUID } from 'node:crypto'` (coerenza con `answers.ts`) e correzione di due commenti imprecisi (garanzia maiuscola/minuscola/cifra dal solo prefisso `Aa1-`; il `+` è un separatore leggibile, non isolamento dei run).
  - `[low]` `[patch]` `playwright.config.ts`: `trace: 'on-first-retry'` con `retries: 0` non produce trace su un fallimento locale ⇒ cambiato in `trace: 'retain-on-failure'`.

I 14 finding **rigettati** (tutti low): isolamento del job di collaudo e `timeout-minutes` in `migrate.yml` e deduplica degli step fra i due workflow (opinioni di design su lavoro conforme alla spec, che impone esplicitamente il collaudo nello stesso job dopo `db push`; il fallimento è attribuibile per nome di step); assenza di un `e2e/README` o di un puntatore alla console nel workflow (i secret e la dipendenza «Confirm email» sono già in `.env.example`, negli header dei workflow e ora in `operator_actions`); `?? ''` sulle VITE_* in config (già coperto da: secret-check dei workflow, `requiredEnv` del teardown, e `ConfigError` nominato dell'app); transiente scheletro→«kind ignoto» (già presidiato da `expect(article).toBeVisible()`, lo scheletro non ha `<article>`); `optionIndex` di select-span fuori range (il contenuto è sempre valido; la patch #4 copre comunque il contenuto malformato); riuso di un `vite preview` stantìo su 4173 in locale (`reuseExistingServer:!CI`, caso di nicchia); fork/Dependabot PR senza secret (repo solista, nessuna config Dependabot); spiegazione `it` mancante nell'esercizio `assemble` di `content/lessons/01` (ripiego it→en **per design dichiarato** in 2.5/FR8.5 con `fallbackNotice`, non un difetto — coerente col rigetto analogo in 7.3); assenza di un test unit per `loadFirstLessonSolutions` (codice di supporto al solo e2e, esercitato in CS); drift documentale «support/ opzionale» nel Code Map (innocuo).

Il rilievo dell'audit di intent-alignment (frontmatter non a `awaiting-operator`, `operator_actions` assente) **non è un difetto del codice**: descriveva uno snapshot del diff preso a metà workflow, prima del passo di finalizzazione. È stato risolto in questa finalizzazione impostando `status: awaiting-operator` ed enumerando `operator_actions` nel frontmatter.

## Design Notes

**Perché lo stato finale è `awaiting-operator`.** L'agente può scrivere test, config e workflow e verificarli offline, ma NON può: (a) disattivare "Confirm email" nella console Supabase — senza, `signUp` torna `session: null` e la registrazione e2e non prosegue (dipendenza già dichiarata in `src/data/authGateway.ts:88-94`); (b) impostare i secret GitHub Actions `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` per il job e2e; (c) eseguire davvero l'e2e contro il Supabase reale (nessuna credenziale locale, e non si toccano i dati reali dell'owner da una macchina di build). Perciò l'esecuzione verde vive in CI dopo le azioni dell'operatore; l'agente verifica quanto è verificabile offline.

**Determinismo delle risposte (lezione 01).** Il dominio permuta le opzioni in modo stabile (`orderByHash`) ma non "risposta prima"; l'e2e resta deterministico perché deriva le risposte dal contenuto e le àncora per **testo** (single-select/assemble) o per **indice di segmento** (select-span), non per posizione permutata: single-select → bottone con testo `きょう`; assemble → gli 8 token di `answer` cliccati in ordine (una tessera scelta diventa `disabled` con badge, quindi si cliccano le rimanenti per testo); select-span → il bottone-opzione all'indice `answer.start` (0), coerente con `composeResponse` che mappa l'indice di opzione all'indice di segmento.

**Teardown robusto e "stessa funzione".** Direct-invoke (non UI): gira anche su fallimento, non dipende dallo stato UI, ed è letteralmente `delete-account`, lo stesso contratto di `accountGateway`. La cascata su `auth.users` (config.toml + storia 1.5) svuota le righe per-utente; qui basta verificare il 2xx (la verifica tabella-per-tabella è 7.5).

**Perché l'e2e sta fuori da `src` e dal toolchain unit.** `tsconfig.include` è `["src","scripts","vite.config.ts","vitest.config.ts"]` e Vitest raccoglie `src/**/*.test.*`: uno spec in `e2e/*.spec.ts` non entra in `tsc --noEmit` né in `npm test`, e non importando `src/` non viola AD-1. Playwright ha il proprio transpiler; `npx playwright test --list` è il controllo offline che lo spec compila.

## Verification

**Commands (agent-side, offline):**
- `npm run lint` -- expected: 0 errori (src intatto; nuovo override `e2e/**`; nessun colore letterale).
- `npm run typecheck` -- expected: 0 errori (e2e fuori da tsconfig).
- `npm test` -- expected: verde (nessuno spec e2e raccolto da Vitest; nessun test unit toccato).
- `npm run build` -- expected: verde.
- `npx playwright test --list` -- expected: elenca `e2e/main-path.spec.ts` senza errori di parsing/transpilazione (NON esegue: nessun Supabase reale in locale).

**Manual checks (operator/CI):**
- L'esecuzione reale dell'e2e (job PR + collaudo post-merge) e la conferma verde avvengono in CI dopo che l'operatore ha disattivato "Confirm email" e impostato i secret `VITE_*` (vedi le azioni operatore alla finalizzazione).

## Auto Run Result

Status: awaiting-operator

### Sintesi della modifica implementata

Introdotto il toolchain e2e Playwright (isolato da `src/`) e un solo test che pilota dal browser il **percorso principale** del prodotto contro il progetto Supabase reale: registrazione con **email unica per run** → sblocco della prima lezione (`dashboard.startAction`) → «svuota la pila» (`dashboard.primaryAction` → `/studia`) → risoluzione dei tre esercizi (risposte DERIVATE da `content/lessons/01-*.json`, mai cablate) → asserzione della schermata di **pila a zero** (`session.complete.body`). Il **teardown** gira sempre (anche su fallimento) e invoca la STESSA Edge Function `delete-account` verificandone l'esito 2xx (pulizia verificata, non assunta). Cablata la pipeline: `e2e.yml` (`on: pull_request`) esegue l'e2e sullo schema corrente senza applicare migrazioni; `migrate.yml` (`push:main`) applica migrazioni + deploy funzione e POI esegue un e2e di **collaudo** (ordine vincolante). Nessun file di `src/` o `supabase/` è stato toccato: solo test e2e + cablaggio CI.

L'agente ha completato tutto ciò che è realizzabile e verificabile offline. Restano tre azioni **solo umane** (fuori dal repo), enumerate nel frontmatter `operator_actions`: disattivare «Confirm email» nella console Supabase, impostare i secret GitHub Actions `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, e verificare il verde dei job e2e (PR + collaudo post-merge). Per questo lo status finale è `awaiting-operator`, non `done`.

### File creati / modificati

- `playwright.config.ts` (nuovo) — config: `testDir e2e`, `webServer` = `npm run build && vite preview` (porta 4173) con VITE_* dall'ambiente, `baseURL` localhost, solo chromium, `retries` 0/1, `trace: retain-on-failure`. Fuori da `tsconfig.include`.
- `e2e/main-path.spec.ts` (nuovo) — il test del percorso + teardown `afterEach`; ancore per ruolo accessibile + testo i18n bilingue (regex en|it); ciclo solve/advance con attesa deterministica.
- `e2e/support/testUser.ts` (nuovo) — email unica per run (`example.com`, RFC 2606) + password generata; `randomUUID` da `node:crypto`.
- `e2e/support/teardown.ts` (nuovo) — sign-in effimero + `functions.invoke('delete-account')` con verifica 2xx (stesso contratto di `accountGateway`); solo anon key; `signOut` best-effort.
- `e2e/support/answers.ts` (nuovo) — deriva le soluzioni dal contenuto canonico con errori nominati su contenuto mancante/malformato.
- `.github/workflows/e2e.yml` (nuovo) — `on: pull_request`, secret-check che nomina il mancante, `playwright install --with-deps chromium`, run e2e; solo VITE_*.
- `.github/workflows/migrate.yml` (modifica) — e2e di collaudo dopo `db push`/`functions deploy` nello stesso job (ordine vincolante), stessi secret VITE_*.
- `eslint.config.js` (modifica) — override `e2e/**/*.ts` con globals node; `boundaries/include` invariato (`src/**/*`).
- `package.json` / `package-lock.json` (modifica) — devDep `@playwright/test`; script `test:e2e`.
- `.env.example` (modifica) — documenta l'uso delle VITE_* per l'e2e (locale + secret CI) e la dipendenza «Confirm email» off.

### Esito della review

- Patch applicate: 6 (1 medium, 5 low) — corsa nel ciclo solve/advance (medium); `signOut` teardown best-effort; `exact:true` su assemble; errori nominati in `answers.ts`; `node:crypto` + correzione commenti in `testUser.ts`; `trace: retain-on-failure`.
- Deferiti: 0.
- Rigettati: 14 (tutti low) — vedi Review Triage Log.

### Raccomandazione di review di follow-up

`true`. Patch di questo passaggio: high 0, medium 1, low 5. Punteggio `3×medium(1) + 1×low(5) = 8` (≥ 5) ⇒ raccomandata una review di follow-up (opportuna dopo che l'operatore ha completato le azioni e l'e2e è eseguibile davvero in CI).

### Verifica eseguita (offline, dopo le patch)

- `npm run lint` — 0 errori.
- `npm run typecheck` — 0 errori (e2e fuori da tsconfig).
- `npm test` — 1213 test verdi su 99 file (nessuno spec e2e raccolto da Vitest; `boundaries.test.ts` e `service-role-confinement` invariati ⇒ confini AD-1 intatti).
- `npm run build` — verde (solo l'avviso preesistente di chunk-size).
- `npx playwright test --list` — elenca `main-path.spec.ts`, nessun errore di parsing/transpilazione.

### Rischi residui

- L'esecuzione REALE dell'e2e non è verificabile offline: il verde vero dipende dalle tre azioni operatore (`operator_actions`). Finché non sono fatte, i job e2e falliscono al secret-check o alla registrazione (per costruzione, con messaggi nominati).
- La derivazione delle risposte e gli ancoraggi i18n sono verificati per **corrispondenza** col codice/contenuto attuali (in planning e review), ma la loro tenuta a runtime è misurata solo in CI. Un cambio futuro dei testi i18n o del contenuto della lezione 01 richiederebbe l'aggiornamento delle ancore/soluzioni dell'e2e.
- Il ciclo assume esattamente un esercizio per `kind` nella lezione 01 (documentato nel test): un secondo esercizio dello stesso tipo richiederebbe una disambiguazione per id.

## Operator Confirmation

Confirmed 2026-09-28: the external actions this story owed were carried out.

- Disattiva «Confirm email» nella console Supabase (Authentication > Providers > Email) così signUp restituisce subito una sessione e la registrazione dell'e2e prosegue senza conferma via email (cfr. src/data/authGateway.ts).
- Imposta i GitHub Actions secrets VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Settings > Secrets and variables > Actions) con l'URL del progetto Supabase reale e la sua anon key pubblica, così i job e2e.yml (pull request) e il collaudo in migrate.yml (push su main) possono costruire ed eseguire l'app contro il progetto reale. Non impostare mai la service_role.
- Apri una pull request e verifica che il workflow «E2E (percorso principale)» esegua il test verde contro il Supabase reale; dopo il merge su main, verifica che «Migrate & deploy functions» applichi le migrazioni e poi esegua verde l'e2e di collaudo.

_Appended by the bmad-loop orchestrator (`bmad-loop confirm`, #335): a human confirmed these external actions out of band, and the story was advanced from `awaiting-operator` to `done`._
