-- Story 3.7 — Il contenuto raggiunge il client e può essere aggiornato.
--
-- Le tabelle del CONTENUTO (lezioni ed esercizi). Nascono per soddisfare OQ-8: il
-- contenuto viaggia come RIGHE di Postgres popolate da migrazione, non nel bundle,
-- così una correzione arriva senza redeploy e senza pesare su ogni visitatore.
--
-- SOLA LETTURA a runtime: il contenuto entra SOLO per migrazione (il seed
-- generato dai file content/lessons/, vedi la migrazione *_seed_content.sql).
-- Nessuna scrittura dal client. RLS abilitata su entrambe, con UNA policy di sola
-- lettura per gli autenticati e NESSUNA policy di scrittura: con RLS attiva e
-- nessuna policy di insert/update/delete, ogni scrittura è negata per default.
--
-- Si applica SOLO al merge su main, via .github/workflows/migrate.yml
-- (supabase db push). Su una PR non si applica: è validata sintatticamente
-- offline in npm test (AD-12/AD-13: un solo progetto reale, nessuna istanza
-- locale, nessun apply da un ramo di PR).

-- Tabella `lesson`. `id` è lo SLUG derivato dal punto grammaticale primario
-- (lessonId(lesson) = deriveLessonId(grammarPoints[0]), FR2.1a): mai il numero di
-- episodio di una fonte esterna. È il seed a calcolare l'id dal dominio; qui è
-- solo la chiave primaria testuale su cui il seed fa upsert (idempotenza).
--
-- `ordinal` (= lesson.order) è l'ordine di studio interno, UNICO fra le lezioni
-- ma DEFERRABLE INITIALLY DEFERRED: un riordino delle lezioni in un unico seed
-- (più UPDATE nello stesso statement) non deve violare l'unicità a metà — il
-- vincolo si verifica a fine transazione.
--
-- `title_en` è OBBLIGATORIO, `title_it` è FACOLTATIVO (null): il titolo è bilingue
-- (bilingualText, storia «il titolo diventa bilingue») e l'italiano assente ricade
-- su en dichiarando il ripiego (FR8.5). `grammar_points` è l'array dei punti
-- insegnati (non vuoto nel contenuto; il vincolo di non-vuoto è del dominio 2.1).
create table lesson (
  id text primary key,
  ordinal int not null unique deferrable initially deferred,
  title_en text not null,
  title_it text,
  grammar_points text[] not null
);

-- Tabella `exercise`. `id` è l'UUID v5 derivato dal CONTENUTO (deriveExerciseId,
-- AD-23): stabile alla riautorazione, così un esercizio invariato conserva il
-- proprio id fra due seed e l'upsert non lo cambia. `lesson_id` referenzia
-- `lesson(id)` ON DELETE CASCADE: una lezione rimossa dal contenuto porta via i
-- suoi esercizi.
--
-- `kind` è vincolato al REGISTRO CHIUSO di AD-22 (i tre soli tipi). `payload` è il
-- JSON dei campi dipendenti dal kind (sentence, answer, e distractors solo per
-- single-select). `grammar_point` alimenta le statistiche FR7.3. `explanation_en`
-- è OBBLIGATORIO, `explanation_it` FACOLTATIVO (null, ripiego su en, FR8.5).
create table exercise (
  id uuid primary key,
  lesson_id text not null references lesson (id) on delete cascade,
  kind text not null check (kind in ('single-select', 'select-span', 'assemble')),
  payload jsonb not null,
  grammar_point text not null,
  explanation_en text not null,
  explanation_it text
);

-- Sola lettura: RLS abilitata su entrambe. Senza policy di scrittura ogni
-- insert/update/delete è negato per default; il contenuto entra solo per
-- migrazione (che gira come proprietario dello schema, non soggetto a RLS).
alter table lesson enable row level security;
alter table exercise enable row level security;

-- UNA sola policy per tabella: lettura per QUALSIASI autenticato. `using (true)`
-- perché il contenuto NON è isolato per riga (a differenza di user_settings): è
-- lo stesso curriculum per tutti. `to authenticated` esclude il visitatore
-- anonimo. Nessuna policy insert/update/delete: la scrittura resta negata.
create policy lesson_select_authenticated
  on lesson
  for select
  to authenticated
  using (true);

create policy exercise_select_authenticated
  on exercise
  for select
  to authenticated
  using (true);
