-- Story 3.9 — Una risposta, una chiamata, nessun doppione.
--
-- La RPC `apply_review`: la SOLA via per PERSISTERE una risposta. Le tre tabelle
-- del ciclo di ripasso (storia 3.8) erano INERTI; questa funzione le scrive, e
-- nasce IDEMPOTENTE — un ritentativo su rete instabile (la coda offline di Epic 4)
-- non deve contare la stessa risposta due volte, altrimenti streak e statistiche
-- (CM2) diventano una menzogna.
--
-- La firma è quella canonica di AD-7 (7 parametri): la funzione NON ricalcola
-- niente. Riceve `outcome`, `stage` e `due_at` GIÀ CALCOLATI dal dominio sul client
-- (schedule.ts / AD-24), così una risposta data offline produce lo stesso
-- esito/scadenza che avrebbe prodotto online. NESSUNA logica di scheduling o di
-- valutazione in SQL (nessuna scala Leitner, nessun `interval`, nessuna derivazione
-- dell'esito da `used_explanation`).
--
-- Si applica SOLO al merge su main, via .github/workflows/migrate.yml
-- (supabase db push). Su una PR non si applica: è validata sintatticamente
-- offline in npm test (AD-12/AD-13: un solo progetto reale, nessuna istanza
-- locale, nessun apply da un ramo di PR). Forward-only: `create function`, non
-- `create or replace`, nessun `if not exists`, come ogni migrazione del progetto.

-- `language sql` con UNA sola istruzione: è già una transazione implicita, quindi
-- l'atomicità di AD-7 non richiede un blocco begin/end. `security invoker`: tutte
-- le scritture sono owner-scoped e le policy RLS di 3.8 le impongono (insert con
-- `with check auth.uid() = user_id`, update `using auth.uid() = user_id`);
-- l'invoker non ha bisogno di privilegi elevati né di controlli manuali (least
-- privilege, isolamento dichiarativo). `set search_path = ''` + tabelle
-- schema-qualificate (`public.*`, `auth.uid()`) evita l'iniezione di search_path.
create function public.apply_review(
  review_id uuid,
  exercise_id uuid,
  outcome text,
  stage int,
  due_at timestamptz,
  reviewed_at timestamptz,
  used_explanation boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$
  -- IDEMPOTENZA: `id = review_id` (chiave generata dal client) con
  -- `on conflict (id) do nothing`. Un ritentativo trova il conflitto e l'INSERT
  -- non produce righe. `grammar_point` è lo SNAPSHOT server-side letto da
  -- `exercise` all'istante del ripasso (AD-18/AD-23): non è nella firma, e
  -- catturarlo ora impedisce che una futura riautorazione dell'esercizio riscriva
  -- la storia già registrata. `used_explanation` finisce SOLO nel log: non deriva
  -- l'esito, che arriva già deciso dal client.
  with logged as (
    insert into public.review_log (
      id, user_id, exercise_id, grammar_point, outcome, used_explanation, reviewed_at
    )
    select
      apply_review.review_id,
      auth.uid(),
      apply_review.exercise_id,
      e.grammar_point,
      apply_review.outcome,
      apply_review.used_explanation,
      apply_review.reviewed_at
    from public.exercise e
    where e.id = apply_review.exercise_id
    on conflict (id) do nothing
    returning 1
  )
  -- GUARDIA `from logged`: l'UPDATE fa un prodotto con le righe della CTE. Prima
  -- applicazione ⇒ 1 riga ⇒ 1 update. Ritentativo ⇒ 0 righe (conflitto) ⇒ 0
  -- update, così stadio/scadenza NON riavanzano e i contatori NON si
  -- ri-incrementano (AD-7). `stage`/`due_at`/`last_reviewed_at` sono PASSTHROUGH
  -- dai parametri (nessun ricalcolo). I contatori sono bookkeeping sull'esito
  -- RICEVUTO, non valutazione: `review_count + 1` e `lapse_count + (again ? 1 : 0)`.
  update public.review_state rs
  set
    stage = apply_review.stage,
    due_at = apply_review.due_at,
    last_reviewed_at = apply_review.reviewed_at,
    review_count = rs.review_count + 1,
    lapse_count = rs.lapse_count + (case when apply_review.outcome = 'again' then 1 else 0 end)
  from logged
  where rs.user_id = auth.uid()
    and rs.exercise_id = apply_review.exercise_id;
$$;
