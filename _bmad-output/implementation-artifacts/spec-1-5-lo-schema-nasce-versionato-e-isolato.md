---
title: 'Story 1.5: Lo schema nasce versionato e isolato'
type: 'feature'
created: '2026-09-24'
status: done
baseline_revision: 'b5ebcc79faa0a3119817a4fa2c37bc39c2ee6c14'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred:
  - "Test di integrazione RLS a runtime (AC4, seconda clausola): dimostrare che l'utente A non legge né scrive le righe di B. Richiede signup con utenti reali (storia 1.6) e teardown via l'Edge Function delete-account (AD-11/AD-13, storia 1.10) con email univoca per run; il progetto vieta l'istanza locale. Non costruibile in sicurezza qui. Ciò che questa storia verifica meccanicamente è RLS abilitata + le 4 policy owner-scoped (src/migrations.test.ts). Ri-verifica RLS su tutte le tabelle per-utente già prevista in Epic 7."
  - "Robustezza sul drift dello schema (severità low, sollevata in review): supabase db push in migrate.yml non gestisce un eventuale disallineamento fra la tabella schema_migrations del progetto reale e le migrazioni versionate (nessun --include-all, nessun controllo di drift, nessun runbook). AC1 vieta modifiche dallo Studio, quindi oggi il drift è precluso per disciplina dell'operatore; ma con l'accumularsi delle migrazioni vale un controllo/runbook dedicato. Non richiesto dall'intento di questa storia."
operator_actions:
  - "In GitHub > Settings > Secrets and variables > Actions, imposta i tre repository secret usati da .github/workflows/migrate.yml: SUPABASE_ACCESS_TOKEN (generalo dalla console Supabase, Account > Access Tokens), SUPABASE_DB_PASSWORD (la password del database del progetto reale) e SUPABASE_PROJECT_REF (ytgriszwsfumheagklqj). Senza questi il job di migrate fallisce l'autenticazione (AC1/AC2)."
  - "Fai il merge di questa storia su main: il push su main scatena .github/workflows/migrate.yml, che esegue supabase link + supabase db push e applica 20260923221517_create_user_settings.sql al progetto Supabase reale. L'apply avviene SOLO al merge, mai da un ramo di PR (AD-12/AD-13)."
  - "Dopo il merge, verifica nel run di migrate.yml che 'supabase db push' sia andato a buon fine, e nello Studio Supabase che la tabella public.user_settings esista con RLS abilitata e le 4 policy owner-scoped (select/insert/update/delete), a due sole colonne user_id/locale (AC3/AC4-schema)."
---

<intent-contract>

## Intent

**Problem:** Non esiste ancora schema dati. La prima tabella per-utente deve nascere **versionata** (una migrazione in `supabase/migrations/`, mai una modifica a mano dallo Studio) e **isolata per riga** (RLS con `user_id = auth.uid()`), così che il repository possa essere pubblico senza che i dati lo diventino. Le migrazioni non devono mai raggiungere il progetto reale da un ramo di PR: i dati di studio dell'owner (metrica `M1`) non possono vedere uno schema non ancora revisionato.

**Approach:** Una migrazione versionata crea `user_settings` (`user_id` PK → `auth.users on delete cascade`, `locale` con predefinito `'en'`, **e nient'altro**), abilita RLS e dichiara una policy owner-scoped per operazione. Un workflow dedicato `.github/workflows/migrate.yml`, con trigger `push` sul **solo** `main`, applica le migrazioni al progetto reale (`supabase link` + `supabase db push`, coi tre secret già documentati in `.env.example`). Su una PR le migrazioni **non si applicano** (nessun apply nel workflow di PR) ma vengono **validate sintatticamente offline** da un parser Postgres reale (`pg-query-emscripten`) dentro `npm test`. La connessione ai secret e l'applicazione al merge sono azioni dell'operatore (console vendor): la storia finalizza a `awaiting-operator`.

## Boundaries & Constraints

**Always:**
- La migrazione crea **solo** `user_settings` con **esattamente** due colonne: `user_id uuid primary key references auth.users (id) on delete cascade` e `locale text not null default 'en'`. Nessun `created_at`/`updated_at` né altra colonna (arrivano con la storia che le usa: `lessons_per_day` è Epic 3).
- RLS abilitata (`enable row level security`) con una policy per operazione (select/insert/update/delete), tutte `to authenticated` e ristrette a `(select auth.uid()) = user_id`.
- L'apply gira **soltanto** su `push` a `main`, mai su `pull_request`: `migrate.yml` non contiene mai `pull_request`, e `ci.yml` non esegue mai `supabase db push`. Questo è il gate meccanico di `AD-12/AD-13`.
- La validazione sintattica su PR è **offline**: nessuna connessione a database (né reale né locale — `AD-12/13` vieta l'istanza locale), solo il parse del testo SQL con la grammatica Postgres reale. È un gate di `npm test` (CI rossa su SQL non parsabile).
- `migrate.yml` usa i tre secret già dichiarati in `.env.example`: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` (ref del progetto reale già collegato: `ytgriszwsfumheagklqj`).
- `package-lock.json` rigenerato e committato (la CI usa `npm ci`, mai `npm install`).

**Block If:**
- _Nessun blocco._ Le parti fuori dal repository — impostare i secret Supabase in GitHub Actions e applicare al merge (console vendor) — NON sono un blocco: si finalizza a `awaiting-operator` con `operator_actions`, mai `blocked`.

**Never:**
- Nessuna colonna oltre `user_id`/`locale`; nessun vincolo `check` sul `locale` (accoppierebbe lo schema alle locale dell'app prima della storia che lo scrive, 1.9).
- Nessuna istanza Supabase locale (né in dev né in CI): il vincolo `AD-12/13` è un solo progetto reale, condiviso.
- Nessun `@supabase/supabase-js` né codice client dell'app: le porte e l'adattatore dati arrivano con le storie di autenticazione (1.6+/1.9). Questa storia è schema + pipeline, non accesso ai dati dall'app.
- Nessun `workflow_dispatch` su `migrate.yml`: dalla UI potrebbe girare su un ramo di PR e applicare uno schema non revisionato.
- **Fuori scope (differito):** il test di integrazione RLS *a runtime* (AC4, seconda clausola) — vedi Design Notes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| migrazione ben formata | i file `supabase/migrations/*.sql` | il parser Postgres li accetta senza errori | test verde |
| migrazione malformata | un typo (`creat table`) in un file di migrazione | il parser riporta un errore di sintassi | `npm test` rosso |
| schema minimo | la `create table user_settings` | l'AST espone **esattamente** le colonne `user_id`, `locale` | test rosso se ne compare una terza |
| chiave + cascata | DDL di `user_settings` | `user_id` è PK e `references auth.users (id) on delete cascade` | test rosso se manca |
| RLS + policy | DDL di `user_settings` | RLS abilitata + 4 policy owner-scoped `(select auth.uid()) = user_id` | test rosso se manca una operazione |
| apply solo su main | `migrate.yml` + `ci.yml` | `migrate.yml` gira su `push:[main]`, non contiene `pull_request`; `ci.yml` non fa `db push` | test rosso se un apply raggiunge la PR |

</intent-contract>

## Code Map

- `supabase/migrations/20260923221517_create_user_settings.sql` — **NUOVO**: la migrazione (tabella + RLS + 4 policy). Versione UTC in stile Supabase; `supabase db push` applica in ordine di versione. `supabase/**` è già in `.gitignore` solo per `.temp/`/`.branches/` — migrazioni e config sono versionate.
- `supabase/config.toml` — **NUOVO** (minimo): `project_id = "tsundoku-zero"` + commento che lo stack locale non viene mai avviato (`AD-12/13`). Esiste perché la CLI operi in modalità progetto; il ref remoto NON vive qui (è un secret). Un `config.toml` di sola `project_id` è accettato dalla CLI (verificato).
- `.github/workflows/migrate.yml` — **NUOVO**: `on: push: branches: [main]` (mai `pull_request`); job che installa la CLI (`supabase/setup-cli@v1`), fa `supabase link --project-ref $SUPABASE_PROJECT_REF -p $SUPABASE_DB_PASSWORD` (env `SUPABASE_ACCESS_TOKEN`) e `supabase db push`. Concurrency non-cancellabile (non interrompere un apply a metà).
- `.github/workflows/ci.yml` — **RIFERIMENTO**: resta lint/typecheck/test/build/contrast/graph, gira su `pull_request` e `push:[main]`; NON deve mai fare `db push`. Il test di gate lo asserisce.
- `src/migrations.test.ts` — **NUOVO**: (a) validazione sintattica di ogni `supabase/migrations/*.sql` con `pg-query-emscripten` (AC2); (b) asserzioni strutturali sulla migrazione `user_settings` — via AST il conteggio/nome colonne (AC3 «e nient'altro»), via testo cascata/RLS/4 policy (AC3/AC4-schema); (c) gate di config su `migrate.yml`/`ci.yml` (AC1/AC2 «non applicata su PR»). Legge i file via `node:fs`, come `src/deploy-config.test.ts` e `src/boundaries.test.ts`. I file `*.test.ts` sono esclusi dalle regole `boundaries` (possono importare pacchetti esterni e `node:*`).
- `package.json` + `package-lock.json` — **MODIFICA**: devDependency `pg-query-emscripten` (parser WASM puro, nessun build nativo, cross-platform; installato pulito, 0 vulnerabilità). Lock rigenerato e verificato con `npm ci`.
- `.env.example` — **RIFERIMENTO**: già dichiara i tre secret CI (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`) e che la `service_role` non è un secret di CI. Nessuna modifica necessaria.
- `supabase/.temp/linked-project.json` — **RIFERIMENTO** (gitignored): prova che il progetto reale è già collegato (ref `ytgriszwsfumheagklqj`). Impostare i secret e applicare al merge restano azioni operatore.

## Tasks & Acceptance

**Execution:**
- `supabase/config.toml` — creare minimale (`project_id` + commento no-stack-locale).
- `supabase/migrations/20260923221517_create_user_settings.sql` — creare la migrazione: tabella a due colonne, `enable row level security`, 4 policy owner-scoped `to authenticated` con `(select auth.uid()) = user_id`.
- `.github/workflows/migrate.yml` — creare la pipeline di apply, trigger `push:[main]` soltanto; `link` + `db push` coi tre secret.
- `package.json` + `package-lock.json` — aggiungere `pg-query-emscripten` (devDependency); rigenerare il lock.
- `src/migrations.test.ts` — codificare le righe della I/O Matrix: parse offline, colonne esatte via AST, cascata/RLS/policy via testo, gate `migrate.yml`/`ci.yml`.

**Acceptance Criteria:**
- Given i file in `supabase/migrations/`, when `npm test` gira, then ogni migrazione è **validata sintatticamente** dal parser Postgres reale (SQL non parsabile ⇒ CI rossa) e nessun test applica la migrazione a un database.
- Given `migrate.yml` e `ci.yml`, when i workflow sono presenti, then l'apply (`supabase db push`) è dichiarato **solo** in `migrate.yml` con trigger `push` su `main`, `migrate.yml` non contiene mai `pull_request`, e `ci.yml` non esegue mai `db push` — così le migrazioni si applicano soltanto al merge su `main` (verifica live dell'apply → operatore).
- Given la migrazione di `user_settings`, when la si ispeziona, then ha **esattamente** le colonne `user_id` (PK, `references auth.users (id) on delete cascade`) e `locale` (`text not null default 'en'`), RLS abilitata, e una policy owner-scoped per select/insert/update/delete.
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano tutti senza regressioni sulle sonde di 1.1–1.4 (confini `AD-1`, regola colore, i18n type-safe).

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 0, medium 0, low 5)
- defer: 1: (high 0, medium 0, low 1)
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[low]` `[patch]` **`config.toml` — commento fuorviante sul project ref**: il commento definiva il ref «un secret» pur scrivendone il valore e pur essendo pubblico (compare in `VITE_SUPABASE_URL`). Riscritto: il ref è fornito alla CI via il secret `SUPABASE_PROJECT_REF` come configurazione, non perché sensibile; valore grezzo rimosso dalla prosa.
  - `[low]` `[patch]` **CLI Supabase non pinnata** (`version: latest`): nell'unico workflow che muta il solo DB reale una CLI non pinnata può cambiare comportamento fra un merge e l'altro (incoerente col determinismo del progetto: `npm ci`, TS 5.9.3, `.nvmrc`). Pinnata a `2.98.2` (versione validata in locale).
  - `[low]` `[patch]` **Pre-flight fail-fast dei secret assente**: aggiunto in `migrate.yml` uno step che, prima di `link`, verifica i tre secret e fallisce NOMINANDO quello mancante (come lo schema fail-fast di `src/app/env.ts`, storia 1.2), invece di un errore opaco della CLI a valle.
  - `[low]` `[patch]` **`db push` senza `--yes`**: una CLI che chiedesse conferma appenderebbe il job non interattivo all'infinito. Aggiunto `--yes` (flag globale «answer yes to all prompts»).
  - `[low]` `[patch]` **`stripSqlComments`: assunzione non imposta**: lo strip dei commenti `--` presumeva l'assenza di `--` nei literal SQL, senza imporlo. Aggiunto un guard che ri-parsa l'SQL spogliato e asserisce parse valido + stesso conteggio di statement del grezzo: una corruzione da strip ora fallisce a voce alta (17° test).

Findings rifiutati (rappresentativi): «la migrazione non è mai eseguita contro Postgres, aggiungi un PG effimero» — un PG locale con `auth` stubbato è proprio «l'approssimazione che diverge» vietata da `AD-12/13`, e l'apply pulito è verificato al merge reale (`db push` fallisce il job se la migrazione non applica); «AC4 dichiarato risolto» — è il deferral runtime documentato; «notifica di fallimento / Sentry» — lo stato del run è già visibile in Actions ed è un'azione operatore, e un SDK di error tracking di terze parti è vietato dall'epica; «`on delete cascade` senza `on update`» — irrilevante per gli UUID immutabili di `auth.users`; «`.temp/linked-project.json` col ref» — gitignored e non sensibile; «doppio `-p` su link+push» — difensivo per la non-interattività; «diff non committato» — artefatto della presentazione in review (la finalizzazione committa); «strip YAML fragile» — i due workflow sono input controllati senza `#` nei valori; «TypeError su `parse_tree.stmts`» — infondato, `expect` interrompe il test sul fallimento; «probe negativa fissa vs mutazione», «colonna via table-constraint», «5ª policy» — già colti dalle asserzioni esatte esistenti o senza trigger realistico.

## Design Notes

**Perché la validazione sintattica è offline, non un apply.** `AD-12/13` impone un solo progetto reale e **nessuna istanza locale**: SPINE-DELTA nota che i test devono esercitare «la configurazione vera … invece di un'approssimazione che può divergere in silenzio». Quindi su PR non si applica a nessun DB (reale o effimero): si **parsa** il testo SQL con la grammatica Postgres reale (`pg-query-emscripten`, che incapsula `libpg_query`). Un parse che fallisce è CI rossa; un errore battuto a mano viene colto prima del merge, senza toccare i dati dell'owner. Forma verificata:
```js
const pg = await new PgQueryModule();
const res = pg.parse(sql);       // res.error ⇒ { message: 'syntax error …' }
// se res.error: fallisci; altrimenti cammina res.parse_tree per contare le colonne
```

**Perché quattro policy `to authenticated` e `(select auth.uid())`.** Una policy per operazione rende esplicito `with check` su insert/update (nessuno scrive righe altrui). `to authenticated` esclude il visitatore anonimo (il cui `auth.uid()` è nullo). `(select auth.uid())` invece di `auth.uid()` fa valutare la funzione una volta sola dal planner (guida ufficiale Supabase sulle performance RLS).

**Perché niente `check` sul `locale`.** AC3 chiede «`locale` con predefinito `'en'` — e nient'altro»: la minimalità è il punto. Un `check (locale in ('en','it'))` accoppierebbe lo schema all'enum dell'app; il vincolo appartiene alla storia che scrive la lingua (1.9, upsert diretto tipizzato), col suo consumatore. Il default `'en'` + `not null` è tutta la garanzia di questa storia.

**AC4 seconda clausola — il test di integrazione RLS a runtime è differito, per architettura.** «Un test di integrazione dimostra che A non legge né scrive B» richiede due utenti reali e la loro rimozione. `AD-13` dichiara che il teardown della suite avviene **via la stessa Edge Function `delete-account` di `AD-11`** (costruita nella storia 1.10), con email univoca per run, ed è «l'unica difesa fra la suite di test e i dati reali». Il progetto vieta l'istanza locale (che sarebbe l'«approssimazione che diverge»), e signup/utenti arrivano con 1.6. Perciò il test a runtime non è costruibile né eseguibile in modo sicuro in questa storia: viene **differito** a quando esistono signup (1.6) e teardown (1.10), ed è enumerato in `operator_actions`. Ciò che questa storia consegna e verifica meccanicamente: RLS abilitata + le 4 policy owner-scoped (via `src/migrations.test.ts`). La ri-verifica RLS su tutte le tabelle per-utente è comunque già prevista in Epic 7 dal contesto d'epica.

**Perché `awaiting-operator` e non `done`.** L'apply al progetto reale richiede i secret Supabase impostati in GitHub Actions (generare l'access token dalla console Supabase, recuperare la DB password: azioni umane da console vendor) e il merge su `main`. L'agente completa tutto il codice/config e i suoi gate meccanici; l'effetto sul DB reale è dell'operatore — come per la storia 1.2.

## Verification

**Commands:**
- `npm run lint` — expected: 0 errori sull'albero reale (`supabase/**` e i `*.test.ts` sono fuori dalle regole di confine; nessuna regressione).
- `npm run typecheck` — expected: `tsc` strict senza errori, nessun `any`.
- `npm test` — expected: `migrations.test.ts` verde (parse offline di ogni migrazione, colonne esatte via AST, cascata/RLS/4 policy, gate `migrate.yml`/`ci.yml`) + le sonde di 1.1–1.4 senza regressioni.
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori (la migrazione non tocca il bundle).

**Manual checks (if no CLI):**
- Ispezionare la migrazione: due sole colonne, PK+cascade su `auth.users`, `enable row level security`, 4 policy `to authenticated` con `(select auth.uid()) = user_id`.
- Ispezionare `migrate.yml`: `on: push: branches: [main]`, nessun `pull_request`, step `supabase db push`. Ispezionare `ci.yml`: nessun `db push`.

## Auto Run Result

Status: awaiting-operator

**Sommario.** La prima tabella per-utente nasce **versionata** e **isolata per riga**. Parte in-repo (agente): una migrazione versionata `20260923221517_create_user_settings.sql` che crea `user_settings` con **esattamente** `user_id uuid primary key references auth.users (id) on delete cascade` e `locale text not null default 'en'` (nient'altro), abilita RLS e dichiara **quattro** policy owner-scoped `to authenticated` con `(select auth.uid()) = user_id`; un workflow dedicato `.github/workflows/migrate.yml` che applica le migrazioni al progetto reale (`supabase link` + `supabase db push`) **soltanto** su `push` a `main` (mai `pull_request`, mai `workflow_dispatch`); e la validazione **sintattica offline** di ogni migrazione dentro `npm test` tramite `pg-query-emscripten` (grammatica Postgres reale, nessuna connessione a DB — `AD-12/13` vieta l'istanza locale). Parte fuori dal repo (operatore): impostare i tre secret Supabase in GitHub Actions e fare il merge su `main` che scatena l'apply — enumerate in `operator_actions`. Per questo lo stato finale è `awaiting-operator`, non `done`: l'agente ha completato tutto ciò che gli compete (come per la storia 1.2).

**File creati/modificati (uno per riga):**
- `supabase/migrations/20260923221517_create_user_settings.sql` — **nuovo**: la migrazione (tabella a due colonne, RLS, 4 policy owner-scoped).
- `supabase/config.toml` — **nuovo** (minimo): `project_id = "tsundoku-zero"`; lo stack locale non viene mai avviato (`AD-12/13`). Commento riscritto in review: il ref è configurazione via secret, non un valore sensibile.
- `.github/workflows/migrate.yml` — **nuovo**: apply su `push:[main]`; CLI pinnata a `2.98.2`; pre-flight fail-fast che nomina i secret mancanti; `link` + `db push --yes` coi tre secret; concurrency non cancellabile.
- `src/migrations.test.ts` — **nuovo**: 17 test — parse offline di ogni migrazione + probe negativa; colonne esatte/PK/FK-cascade via AST; RLS/4 policy/`to authenticated`/`(select auth.uid())`/`default 'en'`/assenza di `check (locale` via testo; guard di anti-corruzione dello strip; gate su `migrate.yml`/`ci.yml`.
- `src/pg-query-emscripten.d.ts` — **nuovo**: dichiarazione di tipo ambient per il pacchetto (nessun `@types`), così il test resta type-safe senza `any`.
- `package.json` + `package-lock.json` — **modifica**: devDependency `pg-query-emscripten@^5.1.0`; lock rigenerato e verificato con `npm ci`.
- `_bmad-output/implementation-artifacts/spec-1-5-...md` — questo spec: triage, Auto Run Result, `deferred`, `operator_actions`, `status: awaiting-operator`.

**Findings di review:** 5 patch applicati (tutti low: commento fuorviante di `config.toml`, CLI non pinnata, pre-flight fail-fast dei secret, `db push --yes`, guard anti-corruzione dello strip SQL), 1 deferito (low: robustezza sul drift dello schema), 0 intent_gap, 0 bad_spec, 13 rifiutati (vedi Review Triage Log).

**Follow-up review recommendation: true.** Patch di questa passata: high 0, medium 0, low 5. Punteggio `3×medium + 1×low = 0 + 5 = 5 ≥ 5` ⇒ `true` (nessun high).

**Verifica eseguita (tutta verde, rieseguita dopo i patch):** `npm run lint` (0 errori sull'albero reale; `supabase/**` e i `*.test.ts` fuori dalle regole di confine), `npm run typecheck` (`tsc` strict, nessun `any`), `npm test` (**92 test su 9 file**: 17 in `migrations.test.ts` + le sonde di 1.1–1.4 senza regressioni), `npm run build` (`tsc --noEmit` + `vite build` producono `dist/`). Matrix Test Audit: tutte e 6 le righe della I/O Matrix coperte da test che girano e passano.

**Rischi residui / azioni operatore.** (1) L'apply al DB reale e la verifica live dello schema/RLS dipendono dai tre secret Supabase in GitHub Actions e dal merge su `main`: enumerati in `operator_actions`. (2) Il **test di integrazione RLS a runtime** (AC4, seconda clausola) è **differito** per architettura a quando esistono signup (1.6) e teardown via l'Edge Function `delete-account` (1.10): registrato in `deferred`. Questa storia verifica meccanicamente RLS abilitata + le 4 policy owner-scoped. (3) La validazione su PR prova che l'SQL è ben formato, non che applica pulito: l'apply pulito è colto dal `db push` al merge reale (che fallisce il job se la migrazione non applica). (4) La robustezza sul drift dello schema è deferita (low).

## Operator Confirmation

Confirmed 2026-09-24: the external actions this story owed were carried out.

- In GitHub > Settings > Secrets and variables > Actions, imposta i tre repository secret usati da .github/workflows/migrate.yml: SUPABASE_ACCESS_TOKEN (generalo dalla console Supabase, Account > Access Tokens), SUPABASE_DB_PASSWORD (la password del database del progetto reale) e SUPABASE_PROJECT_REF (ytgriszwsfumheagklqj). Senza questi il job di migrate fallisce l'autenticazione (AC1/AC2).
- Fai il merge di questa storia su main: il push su main scatena .github/workflows/migrate.yml, che esegue supabase link + supabase db push e applica 20260923221517_create_user_settings.sql al progetto Supabase reale. L'apply avviene SOLO al merge, mai da un ramo di PR (AD-12/AD-13).
- Dopo il merge, verifica nel run di migrate.yml che 'supabase db push' sia andato a buon fine, e nello Studio Supabase che la tabella public.user_settings esista con RLS abilitata e le 4 policy owner-scoped (select/insert/update/delete), a due sole colonne user_id/locale (AC3/AC4-schema).

_Appended by the bmad-loop orchestrator (`bmad-loop confirm`, #335): a human confirmed these external actions out of band, and the story was advanced from `awaiting-operator` to `done`._
