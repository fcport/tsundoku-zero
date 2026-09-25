---
title: 'Il contenuto raggiunge il client e può essere aggiornato'
type: 'feature' # feature | bugfix | refactor | chore
created: '2026-09-25'
status: done # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: 'e57470eb70a4ddf32a02b1dab5b06692e09e18a9'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: []
deferred:
  - summary: >-
      La rigenerazione del seed crea un nuovo file di migrazione timestamp-ato a
      ogni esecuzione senza rimuovere o consolidare i seed precedenti, che si
      accumulano ed eseguono tutti a ogni `db push`.
    evidence: |-
      `chooseSeedTimestamp` conta di proposito i seed precedenti come «più
      recenti» e `main` scrive sempre `<timestamp>_seed_content.sql`; nulla fa
      prune/overwrite del seed precedente. Lo stato finale del DB resta corretto
      (upsert idempotente, last-write-wins), ma i file di seed orfani si
      accumulano nella cartella migrazioni. Serve una politica di
      consolidamento/prune del seed (fuori dallo scope catturato di 3.7).
    location: >-
      scripts/generate-content-seed.ts (chooseSeedTimestamp / main writeFile)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Il contenuto (lezioni ed esercizi) vive oggi solo come JSON versionato in `content/lessons/`; il client a runtime non lo può raggiungere. La decisione OQ-8 vuole che il contenuto viaggi come righe di Postgres popolate da migrazione (non nel bundle), così che una correzione arrivi senza redeploy e senza pesare su ogni visitatore.

**Approach:** Migrazioni che creano le tabelle `lesson` ed `exercise` in sola lettura (RLS: lettura per `authenticated`, nessuna policy di scrittura), più un seed idempotente (upsert su `id`) generato dai file `content/lessons/`, che riusa gli identificatori del dominio (`lessonId`, `deriveExerciseId`) per conservare l'identità degli esercizi invariati fra due esecuzioni.

## Boundaries & Constraints

**Always:**
- Il contenuto entra **solo** per migrazione; nessuna scrittura a runtime.
- RLS abilitata su `lesson` ed `exercise`; policy di **sola lettura** per `authenticated`; **nessuna** policy di insert/update/delete.
- Seed = **upsert su `id`**; un esercizio invariato conserva il proprio `id` (uuidv5 via `deriveExerciseId`, storia 2.3). `lesson.id` = `lessonId(lesson)` (slug dal punto grammaticale primario, FR2.1a).
- Convenzione migrazioni: `supabase/migrations/YYYYMMDDHHmmss_slug.sql`. Sintassi RLS come `user_settings`: policy per-operazione, `to authenticated`, `using ((select auth.uid()) = user_id)` — qui adattata alla lettura per tutti gli autenticati.
- Le migrazioni si applicano **solo al merge su `main`** (`migrate.yml`, AD-12), mai da un ramo di PR. I test validano l'SQL **offline** (pg-query-emscripten), senza Supabase locale.

**Block If:**
- **[TRIGGERED — vedi Auto Run Result]** Lo schema DB richiesto da questa storia dichiara `lesson.title_en` e `lesson.title_it` (due colonne bilingui), ma lo schema del contenuto spedito da Epic 2 espone un solo `title`. Non esiste dato en/it nel contenuto per popolare due colonne, e il seed deve nascere dai file `content/lessons/`. La direzione di riconciliazione (schema DB vs schema contenuto vs mapping del titolo) non è derivabile dall'intento e richiede una decisione umana.

**Never:**
- Nessuna logica di scheduling/valutazione in SQL (il contenuto è dati inerti).
- Nessun Supabase locale nei test (AD-12/AD-13): validazione SQL solo offline.
- Nessuna modifica allo schema di dominio di Epic 2 (`src/domain/lesson.ts`, `exercise.ts`) senza direzione esplicita — Epic 2 è `done`.
- Nessuna invenzione di titoli en/it non presenti nel contenuto.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seed prima esecuzione | tabelle vuote, N file lezione | una riga `lesson` per file, una riga `exercise` per esercizio, `id` derivati dal dominio | fallisce rumorosamente se un file non valida |
| Seed seconda esecuzione (invariato) | contenuto identico | upsert su `id` non cambia gli `id`; nessun esercizio riautorato | idempotente |
| Lettura contenuto (utente autenticato) | query su `lesson`/`exercise` | legge tutte le righe | — |
| Scrittura contenuto (utente autenticato) | insert/update/delete su `lesson`/`exercise` | negata da RLS (nessuna policy di scrittura) | rifiuto RLS |
| Esercizio senza spiegazione `it` | `explanation.it` assente | `explanation_it` = NULL (ricade su en, FR8.5) | — |
| Lezione senza esercizi | `exercises: []` | riga `lesson`, nessuna riga `exercise` | — |

</intent-contract>

## Code Map

- `supabase/migrations/20260923221517_create_user_settings.sql` — **unica migrazione esistente**; modello da imitare per RLS (policy per-operazione, `to authenticated`, `(select auth.uid()) = user_id`) e per la convenzione di naming timestamp.
- `src/domain/lesson.ts:37-52` — `lessonSchema`: **un solo** `title: nonEmptyString()`, `order` (int ≥1), `grammarPoints` (non vuoto), `exercises` (può essere vuoto). `lessonId(lesson)` (:109) = `deriveLessonId(grammarPoints[0])` → slug dal punto grammaticale.
- `src/domain/exercise.ts:175-179` — `exerciseSchema` union discriminata su `kind` (`single-select`/`select-span`/`assemble`); campi: `kind`, `grammarPoint`, `sentence{kanji,kana}`, `answer` (forma per-kind), `distractors` (solo single-select), `explanation{en, it?}`.
- `src/domain/exercise-identity.ts:79` — `deriveExerciseId(exercise)` = `uuidv5(chiaveNaturale, EXERCISE_NAMESPACE)`; stabile alla riautorazione (storia 2.3). Base del comportamento upsert idempotente.
- `content/lessons/01-la-particella-wo.json` — lezione campione (storia 2.7); `"title"` è **una** stringa giapponese; esercizi con `explanation.it` a volte assente (es. `assemble`).
- `src/domain/content-validation.ts` + `scripts/validate-content.ts` — validazione pura + CLI `npm run validate-content` (vite-node); riuso per validare prima di seedare.
- `src/migrations.test.ts` — pattern di test: validazione **offline** dell'SQL (pg-query-emscripten), asserzioni strutturali via AST (colonne, RLS abilitata, policy), gate su `migrate.yml`/`ci.yml`. Il nuovo test seguirebbe questo modello per `lesson`/`exercise`.
- `.github/workflows/migrate.yml` — `supabase db push` **solo** su push:main (CLI pinnata); `ci.yml` non fa mai `db push`.
- `eslint.config.js:74-90` — confini: solo `src/data/` importa `@supabase/supabase-js`; `src/domain/` puro.
- `src/data/settingsRepository.ts` — pattern di adattatore dati esistente (upsert diretto, nessuna RPC) come riferimento per un eventuale `ContentRepository` (storia 3.10, fuori da questa).
- `_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-09-22/SPINE-DELTA.md:159-192` — schema DB canonico completo di `lesson`/`exercise` (fonte del conflitto sul titolo).

## Design Notes

- **Il Block If è RISOLTO** (vedi `## Auto Run Result`): il commit `e57470eb70a4ddf32a02b1dab5b06692e09e18a9` («feat(content): il titolo di una lezione diventa bilingue») ha deciso la riconciliazione — **vince il bilingue** — e ha allineato dominio, contenuto, PRD FR2.1 e SPINE-DELTA. Quindi la tabella `lesson` porta **`title_en` (not null)** e **`title_it` (null)**, popolati da `lesson.title.en`/`lesson.title.it` (`bilingualText`, `src/domain/bilingual.ts`). Non si inventa nulla: il contenuto ora **contiene** en/it.
- **Schema canonico** (SPINE-DELTA §4, righe 159-176), unica fonte:
  - `lesson`: `id text pk` (= `lessonId(lesson)`), `ordinal int not null unique` (= `lesson.order`), `title_en text not null`, `title_it text` (null), `grammar_points text[] not null`.
  - `exercise`: `id uuid pk` (= `deriveExerciseId(exercise)`), `lesson_id text not null references lesson(id)` **on delete cascade**, `kind text not null check (kind in ('single-select','select-span','assemble'))` (registro chiuso AD-22), `payload jsonb not null` (i campi kind-dipendenti: `sentence`, `answer`, e `distractors` per single-select), `grammar_point text not null`, `explanation_en text not null`, `explanation_it text` (null, ripiego su en FR8.5).
- **Sola lettura**: RLS abilitata su entrambe; **una sola policy `for select to authenticated using (true)`** per tabella; **nessuna** policy insert/update/delete (con RLS attiva e nessuna policy di scrittura, ogni scrittura è negata di default).
- **Idempotenza**: seed = `insert … on conflict (id) do update set …` su OGNI colonna non-id. Gli `id` derivano dal contenuto (`lessonId`/`deriveExerciseId`), quindi un contenuto invariato riproduce gli stessi `id` e l'upsert non cambia nulla; un contenuto corretto aggiorna solo le righe cambiate. `ordinal unique` reso **`deferrable initially deferred`** così un riordino delle lezioni in un unico seed non viola l'unicità a metà statement.
- **Divisione dominio/tooling** (AD-1, come `validate-content`): la generazione dell'SQL di seed è **tooling puro** in `scripts/`, NON dominio (il dominio resta puro di persistenza). Il builder puro dell'SQL è esportato e testabile; l'I/O (glob + read + validate + write) sta in `main()`, guardato da `process.env.VITEST` come `scripts/validate-content.ts`.
- **Applicazione**: nessuna modifica a `.github/workflows/migrate.yml` — applica già TUTTE le `supabase/migrations/*.sql` solo su push:main. `ci.yml` non fa mai `db push`; valida l'SQL offline via `npm test`.

## Tasks & Acceptance

### Task 1 — Migrazione DDL: tabelle `lesson` ed `exercise` in sola lettura
- **File:** creare `supabase/migrations/20260925090000_create_lesson_and_exercise.sql` (timestamp > `20260923221517`, la sola migrazione esistente).
- **Azione:** modellare su `supabase/migrations/20260923221517_create_user_settings.sql`. Creare `lesson` ed `exercise` con lo schema canonico delle Design Notes. `alter table … enable row level security` su entrambe. Una sola `create policy … for select to authenticated using (true)` per tabella; nessuna policy di scrittura. FK `exercise.lesson_id references lesson(id) on delete cascade`. CHECK sul registro `kind`. `ordinal` `unique deferrable initially deferred`. Commenti in italiano che spiegano sola-lettura, RLS e derivazione degli `id` (come lo stile del file esistente).

### Task 2 — Builder puro del seed + CLI generatore
- **File:** creare `scripts/generate-content-seed.ts` (modellato su `scripts/validate-content.ts`).
- **Azione:**
  - esportare una funzione **pura** `buildSeedSql(lessons: readonly Lesson[]): string` che emette:
    - `insert into lesson (id, ordinal, title_en, title_it, grammar_points) values … on conflict (id) do update set ordinal = excluded.ordinal, title_en = excluded.title_en, title_it = excluded.title_it, grammar_points = excluded.grammar_points;` con `id = lessonId(lesson)`, `title_it` → `null` se assente, `grammar_points` come `array[…]`;
    - `insert into exercise (id, lesson_id, kind, payload, grammar_point, explanation_en, explanation_it) values … on conflict (id) do update set …;` con `id = deriveExerciseId(exercise)`, `payload = '<json>'::jsonb` (`sentence`, `answer`, e `distractors` solo per single-select), `explanation_it` → `null` se assente;
    - escape robusto dei literal (raddoppio dell'apice singolo) per ogni stringa, così contenuto giapponese/apostrofi non rompono l'SQL;
    - una lezione con `exercises: []` produce la sua riga `lesson` e **nessuna** riga `exercise`.
  - `main()`: riusa la scoperta/lettura di `content/lessons/` e **valida** con `validateLessons` (`src/domain/content-validation.ts`); se ci sono issue, stampa e `process.exit(1)` (fallisce rumorosamente, nessun seed generato); altrimenti `parseLesson` ogni file, chiama `buildSeedSql`, e scrive `supabase/migrations/<YYYYMMDDHHmmss>_seed_content.sql` (timestamp corrente, > quello del DDL), stampando il path. Guardia entrypoint `process.env.VITEST === undefined`.
- **Confini:** lo script importa solo da `src/domain/*` e `node:*` (nessun `@supabase/supabase-js`); resta fuori da `src/`, quindi non tocca la matrice `boundaries` (come `validate-content.ts`).

### Task 3 — Migrazione di seed iniziale generata dal contenuto reale
- **Azione:** aggiungere lo script `"generate-content-seed": "vite-node scripts/generate-content-seed.ts"` a `package.json`, poi eseguirlo per generare `supabase/migrations/<timestamp>_seed_content.sql` dal `content/lessons/` reale (oggi il solo `01-la-particella-wo.json`), e **committare** il file generato. Verificare a occhio che gli `id` nel file coincidano con `lessonId`/`deriveExerciseId` e che `title_it`/`explanation_it` assenti compaiano come `null`.

### Task 4 — Test offline (pg-query-emscripten), nessun Supabase locale
- **File:** estendere `src/migrations.test.ts` e creare `src/generate-content-seed.test.ts`.
- **Azione:**
  - in `src/migrations.test.ts`, per la migrazione DDL: via AST/testo asserire che `lesson` espone esattamente `id, ordinal, title_en, title_it, grammar_points`; `exercise` espone esattamente `id, lesson_id, kind, payload, grammar_point, explanation_en, explanation_it`; RLS abilitata su entrambe; **una** policy `select` `to authenticated` per tabella e **zero** policy insert/update/delete; FK `exercise.lesson_id → lesson(id)` cascade; CHECK sul registro `kind`. Il loop generico «ogni *.sql parsa» copre già il file di seed.
  - in `src/generate-content-seed.test.ts`, importare `buildSeedSql` e, su lezioni di prova: (a) l'output **parsa** senza errori (pg-query-emscripten) — prova negativa inclusa; (b) gli `id` emessi uguagliano `lessonId`/`deriveExerciseId`; (c) entrambi gli insert usano `on conflict (id) do update`; (d) un esercizio senza `explanation.it` emette `explanation_it` = `null`; (e) una lezione senza esercizi emette la riga `lesson` e nessuna riga `exercise`; (f) un titolo senza `it` emette `title_it` = `null`.

### Acceptance Criteria (Given/When/Then)

- **AC1 — Le tabelle nascono in sola lettura.** *Given* la migrazione DDL, *When* la si parsa offline, *Then* `lesson` ed `exercise` esistono con lo schema canonico, RLS è abilitata su entrambe, esiste **una** policy `for select to authenticated` per tabella e **nessuna** policy di scrittura. *(righe matrice: «Lettura contenuto», «Scrittura contenuto»)*
- **AC2 — Gli `id` vengono dal dominio.** *Given* `buildSeedSql` su lezioni di prova, *When* si ispeziona l'SQL, *Then* ogni `lesson.id` = `lessonId(lesson)` e ogni `exercise.id` = `deriveExerciseId(exercise)`. *(riga «Seed prima esecuzione»)*
- **AC3 — Il seed è idempotente.** *Given* l'SQL di seed, *When* lo si parsa, *Then* entrambi gli insert portano `on conflict (id) do update set …`; poiché gli `id` derivano dal contenuto, un contenuto identico non cambia alcun `id`. *(riga «Seed seconda esecuzione (invariato)»)*
- **AC4 — Il ripiego linguistico diventa NULL.** *Given* un esercizio con `explanation.it` assente (es. l'`assemble` di `01-la-particella-wo.json`) o una lezione con `title.it` assente, *When* si genera il seed, *Then* `explanation_it`/`title_it` sono `null` (ripiego su en, FR8.5). *(riga «Esercizio senza spiegazione `it`»)*
- **AC5 — La lezione senza esercizi resta contenuto.** *Given* una lezione con `exercises: []`, *When* si genera il seed, *Then* c'è la sua riga `lesson` e nessuna riga `exercise`. *(riga «Lezione senza esercizi»)*
- **AC6 — Il seed nasce dal contenuto validato.** *Given* `content/lessons/` con un file non valido, *When* si esegue `npm run generate-content-seed`, *Then* fallisce rumorosamente con exit ≠ 0 e non scrive alcun seed. *(riga «Seed prima esecuzione» — colonna «fallisce rumorosamente»)*
- **AC7 — L'applicazione resta solo-su-main.** *Given* `migrate.yml`/`ci.yml`, *When* si eseguono i gate di `src/migrations.test.ts`, *Then* `db push` è solo in `migrate.yml` su push:main e mai in `ci.yml` (invariante già in essere, non regredito).

## Verification

Eseguire dalla radice del progetto; tutti devono passare:

- `npm run lint` — confini AD-1 (lo script non deve violare la matrice).
- `npm run typecheck` — `tsc --noEmit` strict.
- `npm test` — include `src/migrations.test.ts` (DDL + seed parsano; asserzioni strutturali) e `src/generate-content-seed.test.ts` (builder puro).
- `npm run validate-content` — il cancello FR2.6 sul `content/lessons/` reale resta verde.

## Auto Run Result

**Block If risolto — nessun intent gap residuo.** Il blocco registrato dalla pianificazione originale (schema DB con `title_en`/`title_it` vs contenuto Epic 2 con un solo `title`) richiedeva una decisione umana sulla direzione di riconciliazione. Quella decisione **è stata presa e implementata** prima di questo run, nel commit `e57470eb70a4ddf32a02b1dab5b06692e09e18a9` («feat(content): il titolo di una lezione diventa bilingue»):

- Direzione scelta: **il titolo diventa bilingue** (`title.en` obbligatorio, `title.it` facoltativo), per FR2.1a — ciò che l'app espone dev'essere comprensibile a chi la fonte non l'ha mai vista.
- La forma è riusata da `explanation` (storia 2.5), estratta in `src/domain/bilingual.ts` (`bilingualText`/`resolveBilingual`) e applicata al titolo; `src/domain/lesson.ts:55` ora dichiara `title: bilingualText`.
- Allineati anche `content/lessons/01-la-particella-wo.json` (titolo `{en, it}`), il PRD FR2.1 e lo SPINE-DELTA (già `title_en`/`title_it`).

Di conseguenza la tabella `lesson` di questa storia porta `title_en`/`title_it` popolati dal contenuto reale (nessuna invenzione), e la pianificazione differita è stata completata sopra (Design Notes, Tasks & Acceptance, Verification). Lo stato è tornato implementabile senza intervento umano ulteriore: run proseguito in `in-progress`.

### Esito finale

**Sommario del cambiamento.** Il contenuto (lezioni ed esercizi) ora può raggiungere il client come righe di Postgres: due tabelle in sola lettura popolate da migrazione e un generatore idempotente di seed dal contenuto versionato. Una correzione al contenuto arriva rigenerando il seed e facendo merge su `main` (upsert su `id`), senza redeploy del bundle e senza pesare sul visitatore.

**File cambiati.**
- `supabase/migrations/20260925090000_create_lesson_and_exercise.sql` — DDL: tabelle `lesson`/`exercise`, RLS abilitata, una sola policy `select` `to authenticated` per tabella e nessuna policy di scrittura, FK `exercise.lesson_id → lesson(id)` cascade, CHECK sul registro `kind`, `ordinal unique deferrable initially deferred`.
- `supabase/migrations/20260925090001_seed_content.sql` — seed iniziale generato dal `content/lessons/` reale (`insert … on conflict (id) do update`).
- `scripts/generate-content-seed.ts` — generatore: `buildSeedSql` puro (testabile) + CLI `main` che valida (`validateLessons`), genera e sceglie un timestamp che ordina dopo il DDL.
- `src/migrations.test.ts` — asserzioni strutturali offline per il DDL `lesson`/`exercise` (colonne via AST, RLS, policy, FK, CHECK, deferrable).
- `src/generate-content-seed.test.ts` — test del builder (id dal dominio, upsert, ripiego NULL, lezione senza esercizi, escaping, payload), pin anti-drift, unit test del timestamp, e loud-fail AC6.
- `package.json` — script `generate-content-seed`.

**Findings di review.** patch applicati: 3 — 1) `buildSeedSql([])` emetteva un insert `lesson` con `values` vuoto (SQL invalido), ora guardato in modo simmetrico al ramo `exercise` + test; 2) aggiunto gate offline anti-drift che rigenera dal contenuto reale e confronta col seed committato; 3) aggiunti unit test per `chooseSeedTimestamp`/`incrementTimestamp`/`migrationPrefix`. Deferiti: 1 (accumulo di seed orfani alle rigenerazioni — vedi frontmatter `deferred`). Rifiutati: 12 (RLS/idempotenza-riordino comportamentali non testabili offline — fuori scope per intento; difese-in-profondità e rami irraggiungibili; nit di qualità dei test).

**Raccomandazione di follow-up review: `true`.** Patch di questo pass per severità: high 0, medium 2, low 1. Punteggio `3×2 + 1×1 = 7 ≥ 5` ⇒ `true`.

**Verifica eseguita.** `npm run lint` pulito; `npm run typecheck` pulito; `npm test` **586 passati** (59 file); `npm run validate-content` OK. **Matrix Test Audit:** tutte e 6 le righe della I/O Matrix sono coperte da almeno un test che è girato ed è passato (inclusa la riga «fallisce rumorosamente» via il test CLI AC6).

**Rischi residui.**
- La negazione RLS delle scritture, l'esclusione dell'anonimo, e l'idempotenza del seed su un **riordino** di `ordinal` sono garantite in modo **strutturale** (RLS abilitata + zero policy di scrittura; `unique deferrable initially deferred` + la transazione con cui `db push` applica ogni migrazione), ma non sono verificate **a runtime**: l'intento vieta Supabase locale e ammette solo validazione SQL offline. Confermabili in un e2e contro il progetto reale (AD-13) quando disponibile.
- Le rigenerazioni del seed accumulano file di migrazione orfani (deferito): lo stato finale del DB resta corretto per idempotenza, ma serve una politica di consolidamento/prune.

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 2, low 1)
- defer: 1: (high 0, medium 1, low 0)
- reject: 12: (high 0, medium 2, low 10)
- addressed_findings:
  - `[medium]` `[patch]` `buildSeedSql` con `lessons` vuoto emetteva un insert `lesson` con `values` vuoto (SQL invalido): guardato in modo simmetrico al ramo `exercise` + test `buildSeedSql([])`.
  - `[medium]` `[patch]` nessun gate anti-drift del seed committato: aggiunto pin offline che rigenera da `content/lessons/` reale e confronta col seed committato (fallisce se il contenuto cambia senza rigenerare).
  - `[low]` `[patch]` `chooseSeedTimestamp`/`incrementTimestamp`/`migrationPrefix` senza unit test: aggiunti (clock avanti/indietro/pari, rollover di secondo/giorno/mese/anno, estrazione prefisso).

