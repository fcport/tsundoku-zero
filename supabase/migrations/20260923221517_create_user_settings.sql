-- Story 1.5 — Lo schema nasce versionato e isolato.
--
-- Prima tabella per-utente. Nasce VERSIONATA (questo file, mai una modifica a
-- mano dallo Studio) e ISOLATA PER RIGA (RLS con user_id = auth.uid()), così che
-- il repository possa essere pubblico senza che i dati lo diventino (AD-10).
--
-- Si applica SOLO al merge su main, via .github/workflows/migrate.yml
-- (supabase db push). Su una PR non si applica: è validata sintatticamente
-- offline in npm test (AD-12/AD-13: un solo progetto reale, nessuna istanza
-- locale, nessun apply da un ramo di PR).

-- Esattamente due colonne. Nessun created_at/updated_at né altra colonna: la
-- minimalità è il punto (AC3 «e nient'altro»). lessons_per_day arriva con la
-- storia che lo usa (Epic 3). Nessun check sul locale: accoppierebbe lo schema
-- all'enum dell'app prima della storia che scrive la lingua (1.9); il default
-- 'en' + not null è tutta la garanzia di questa storia.
create table user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'en'
);

-- Isolamento per riga: senza RLS ogni riga sarebbe leggibile da chiunque abbia
-- la chiave anonima pubblicabile (AD-10). Con RLS abilitata, in assenza di
-- policy, l'accesso è negato per default.
alter table user_settings enable row level security;

-- Una policy PER OPERAZIONE (select/insert/update/delete): rende esplicito il
-- with check su insert/update (nessuno scrive righe altrui). `to authenticated`
-- esclude il visitatore anonimo (il cui auth.uid() è nullo). `(select
-- auth.uid())` invece di `auth.uid()` fa valutare la funzione una volta sola dal
-- planner (guida ufficiale Supabase sulle performance RLS).
create policy user_settings_select_own
  on user_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_settings_insert_own
  on user_settings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_settings_update_own
  on user_settings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_settings_delete_own
  on user_settings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
