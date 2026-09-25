-- Story 3.8 — Il progresso è per-utente e resta per-utente.
--
-- Le tre tabelle PER-UTENTE del ciclo di ripasso: `review_state` (lo stato SRS
-- CORRENTE di ogni esercizio), `review_log` (la STORIA append-only, fonte unica
-- delle statistiche, AD-18) e `lesson_progress` (il curriculum SBLOCCATO).
-- Nascono ISOLATE PER RIGA (RLS con (select auth.uid()) = user_id), così che lo
-- schema pubblico non sia una porta aperta sui dati di studio altrui (AD-10),
-- modellate su `user_settings` (una policy PER OPERAZIONE, `to authenticated`, la
-- sottoquery invece di `auth.uid()` nudo per il planner).
--
-- Tabelle INERTI: nessuna logica di scheduling o valutazione in SQL. L'RPC
-- `apply_review` che ci scrive dentro è la storia 3.9; qui si crea solo la forma.
--
-- Si applica SOLO al merge su main, via .github/workflows/migrate.yml
-- (supabase db push). Su una PR non si applica: è validata sintatticamente
-- offline in npm test (AD-12/AD-13: un solo progetto reale, nessuna istanza
-- locale, nessun apply da un ramo di PR).

-- Tabella `review_state`: lo stato SRS CORRENTE, uno per (utente, esercizio).
-- `stage` è l'indice nella scala Leitner: il CHECK `between 0 and 5` NON è un
-- elenco parallelo, il limite superiore 5 = LEITNER_INTERVALS_DAYS.length - 1
-- (schedule.ts, AD-17) — un test importa la costante e pretende l'uguaglianza,
-- così estendere la scala senza toccare qui è CI rossa. `last_reviewed_at` è null
-- finché l'esercizio non è mai stato ripassato. `exercise_id` referenzia
-- `exercise (id)` ON DELETE CASCADE: lo stato corrente è legato al CONTENUTO VIVO
-- (come `lesson_progress → lesson`), quindi un esercizio rimosso porta via il suo
-- stato. Nessun created_at/updated_at né altra colonna: la minimalità è il punto
-- (come `user_settings`).
create table review_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references exercise (id) on delete cascade,
  stage int not null check (stage between 0 and 5),
  due_at timestamptz not null,
  review_count int not null default 0,
  lapse_count int not null default 0,
  last_reviewed_at timestamptz,
  primary key (user_id, exercise_id)
);

-- Tabella `review_log`: la STORIA append-only, fonte UNICA delle statistiche
-- (AD-18) e dello streak. `id` è il review_id GENERATO DAL CLIENT (idempotenza,
-- storia 3.9). L'unica FK è `user_id → auth.users`: NESSUNA FK di contenuto (né
-- su `exercise` né su altro). `grammar_point` è DENORMALIZZATO di proposito —
-- una statistica non può dipendere da dati mutabili che una riautorazione
-- riscriverebbe (AD-18/AD-23): se il punto grammaticale vivesse solo su
-- `exercise`, una riautorazione (che può cambiare l'identità dell'esercizio o
-- rimuoverlo) falserebbe la storia. Una FK cascade verso `exercise` rifarebbe
-- dipendere il log dal contenuto mutabile — l'opposto dell'intento. `outcome` è
-- vincolato dal CHECK all'insieme di REVIEW_OUTCOMES (schedule.ts): un test
-- pretende set(SQL) === set(REVIEW_OUTCOMES), così i due insiemi non divergono.
create table review_log (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null,
  grammar_point text not null,
  outcome text not null check (outcome in ('again', 'hard', 'good', 'easy')),
  used_explanation boolean not null,
  reviewed_at timestamptz not null
);

-- Tabella `lesson_progress`: il curriculum SBLOCCATO, uno per (utente, lezione).
-- `unlocked_at` è l'istante dello sblocco. `lesson_id` referenzia `lesson (id)`
-- ON DELETE CASCADE: il progresso è legato al contenuto vivo, come
-- `review_state → exercise`.
create table lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references lesson (id) on delete cascade,
  unlocked_at timestamptz not null,
  primary key (user_id, lesson_id)
);

-- Isolamento per riga: senza RLS ogni riga sarebbe leggibile da chiunque abbia
-- la chiave anonima pubblicabile (AD-10). Con RLS abilitata, in assenza di
-- policy, l'accesso è negato per default. Abilitata su TUTTE E TRE.
alter table review_state enable row level security;
alter table review_log enable row level security;
alter table lesson_progress enable row level security;

-- `review_state`: QUATTRO policy owner-scoped, una PER OPERAZIONE
-- (select/insert/update/delete), come `user_settings`. `to authenticated` esclude
-- il visitatore anonimo (auth.uid() nullo); `(select auth.uid())` fa valutare la
-- funzione una volta sola dal planner (guida performance RLS Supabase).
create policy review_state_select_own
  on review_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy review_state_insert_own
  on review_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy review_state_update_own
  on review_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy review_state_delete_own
  on review_state
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- `review_log` è APPEND-ONLY (AC1, FR5.6, AD-18): SOLO policy `select` e `insert`
-- owner-scoped, NESSUNA policy `update`/`delete`. L'immutabilità NON è imposta da
-- un trigger ma dal DEFAULT-DENY di RLS: con RLS attiva, ciò che non ha policy è
-- negato. Un utente non può riscrivere la propria storia (che falserebbe streak e
-- CM2). La cancellazione dell'account funziona lo stesso: la cascata a livello di
-- FK è un'azione referenziale del motore, non DML soggetta a RLS.
create policy review_log_select_own
  on review_log
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy review_log_insert_own
  on review_log
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- `lesson_progress`: QUATTRO policy owner-scoped, una PER OPERAZIONE, come
-- `review_state` e `user_settings`.
create policy lesson_progress_select_own
  on lesson_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy lesson_progress_insert_own
  on lesson_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy lesson_progress_update_own
  on lesson_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy lesson_progress_delete_own
  on lesson_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
