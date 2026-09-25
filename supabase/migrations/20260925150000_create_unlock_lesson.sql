-- Story 3.13 — Sbloccare la lezione successiva.
--
-- La RPC `unlock_lesson`: la SOLA via per PROGREDIRE nel curriculum. Fino a qui
-- `lesson_progress` era in sola lettura (3.8/3.10) e `review_state` veniva solo
-- AGGIORNATA da `apply_review` (3.9), mai INSERITA — non esisteva alcun percorso
-- di SCRITTURA per materializzare gli esercizi di una nuova lezione. Questa
-- funzione lo apre, ed è modellata VERBATIM su `apply_review`
-- (20260925140000_create_apply_review.sql): stessa posture, stessa forma «una
-- sola istruzione», stessa idempotenza.
--
-- MATERIALIZZAZIONE ATOMICA: lo sblocco scrive DUE tabelle e deve essere ATOMICO.
-- Un insert `lesson_progress` seguito da un insert `review_state` NON atomico, se
-- il secondo fallisse, lascerebbe una lezione «sbloccata senza esercizi» —
-- indistinguibile dalla lezione concettualmente vuota di 3.14: una menzogna nel
-- read-model. Una RPC `language sql` con UNA sola istruzione è già una transazione
-- implicita (atomicità di AD-7), come `apply_review`.
--
-- NESSUNA logica di SEQUENZA in SQL: la funzione NON confronta `ordinal`, non
-- decide quale sia la successiva. Riceve un `lesson_id` GIÀ scelto dal dominio
-- (`nextLessonToUnlock`, puro e testabile a unità). Sbloccare fuori ordine
-- toccherebbe SOLO i propri dati di studio, già isolati da RLS: è una regola di
-- prodotto (la UI offre solo la successiva), non un confine di sicurezza. NESSUNA
-- aritmetica di scheduling (nessun `interval`, nessuna scala Leitner): `stage = 0`
-- e `due_at = unlocked_at` sono valori LETTERALI/passthrough, come `apply_review`
-- riceve `stage`/`due_at` già calcolati.
--
-- Si applica SOLO al merge su main, via .github/workflows/migrate.yml
-- (supabase db push). Su una PR non si applica: è validata sintatticamente
-- offline in npm test (AD-12/AD-13: un solo progetto reale, nessuna istanza
-- locale, nessun apply da un ramo di PR). L'effetto DB dal vivo è verificato
-- dall'e2e differita (come per `apply_review` di 3.9). Forward-only:
-- `create function`, non `create or replace`, nessun `if not exists`.

-- `language sql` con UNA sola istruzione: è già una transazione implicita, quindi
-- l'atomicità non richiede un blocco begin/end. `security invoker`: entrambe le
-- insert sono owner-scoped (`auth.uid()`) e le policy RLS insert di 3.8
-- (`review_state_insert_own`, `lesson_progress_insert_own`, entrambe
-- `with check (select auth.uid()) = user_id`) le impongono; l'invoker non ha
-- bisogno di privilegi elevati (least privilege). `set search_path = ''` + tabelle
-- schema-qualificate (`public.*`, `auth.uid()`) evita l'iniezione di search_path.
create function public.unlock_lesson(
  lesson_id text,
  unlocked_at timestamptz
)
returns void
language sql
security invoker
set search_path = ''
as $$
  -- CTE modificante: materializza il PROGRESSO. IDEMPOTENTE (on conflict do
  -- nothing): un doppio sblocco — doppio click o replay offline — non raddoppia la
  -- riga. Le CTE modificanti girano sempre una volta. `user_id` è `auth.uid()`
  -- (non nella firma: l'ANCORA di ownership su cui poggia la RLS insert di 3.8).
  with unlocked as (
    insert into public.lesson_progress (user_id, lesson_id, unlocked_at)
    values (auth.uid(), unlock_lesson.lesson_id, unlock_lesson.unlocked_at)
    on conflict (user_id, lesson_id) do nothing
  )
  -- MATERIALIZZA gli esercizi: una riga review_state per CIASCUN esercizio della
  -- lezione, letti SERVER-SIDE da `exercise` (come `apply_review` legge `exercise`
  -- per lo snapshot: non ci si fida di id inviati dal client). `stage = 0`
  -- (letterale) e `due_at = unlocked_at` (passthrough): con stadio 0 la scadenza è
  -- l'istante di sblocco, un solo parametro serve a entrambe le righe. Nessuna
  -- logica di sequenza né di scheduling qui: la successiva è scelta dal dominio.
  -- IDEMPOTENTE anch'essa (on conflict do nothing sulla PK (user_id, exercise_id)):
  -- un ri-tentativo non ricrea le righe già materializzate né azzera un progresso
  -- già avanzato da `apply_review`. Una lezione SENZA esercizi produce zero righe
  -- qui (solo la riga di progresso della CTE): la sua dichiarazione UI è 3.14.
  insert into public.review_state (user_id, exercise_id, stage, due_at)
  select auth.uid(), e.id, 0, unlock_lesson.unlocked_at
  from public.exercise e
  where e.lesson_id = unlock_lesson.lesson_id
  on conflict (user_id, exercise_id) do nothing;
$$;
