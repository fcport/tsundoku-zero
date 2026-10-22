-- La scala più lunga e il rientro dolce.
--
-- Fino a qui la scala Leitner si fermava a 35 giorni: un esercizio saputo tornava
-- ogni 35–44 giorni per sempre, e il carico di ogni giorno cresceva con le lezioni
-- senza mai scendere. E dopo una pausa tutti gli arretrati arrivavano lo stesso
-- giorno (300 e più dopo due settimane).
--
-- Due pezzi:
--   1. il CHECK su `review_state.stage` si allarga a 0–7: la scala del dominio
--      (`LEITNER_INTERVALS_DAYS` in schedule.ts) aggiunge i gradini 70 e 140
--      giorni. Un test pretende che il limite superiore dell'ULTIMO CHECK su stage
--      sia `LEITNER_INTERVALS_DAYS.length - 1`;
--   2. la RPC `postpone_reviews`: sposta più avanti la scadenza di alcuni
--      esercizi dell'utente corrente. Il CALCOLO di quali e a quando è del dominio
--      (`spreadBacklog` in backlog.ts, sul client, come `schedule`); qui si
--      trasportano solo i valori, senza logica di scheduling.
--
-- Si applica al merge su main via migrate.yml.

-- 1. Il CHECK nasce inline nella `create table` (nome di default
-- `review_state_stage_check`): si sostituisce con lo stesso nome. Le righe di oggi
-- hanno stage 0–5, quindi il nuovo vincolo vale già per tutte.
alter table public.review_state
  drop constraint review_state_stage_check,
  add constraint review_state_stage_check check (stage between 0 and 7);

-- 2. Il rinvio. `exercise_ids[i]` va a `due_ats[i]`. Tocca SOLO righe che sono
-- ancora arretrate (`due_at < still_due_before`, l'inizio della giornata di studio
-- in cui il client ha deciso): un esercizio ripassato nel frattempo ha già una
-- scadenza nuova e non si sposta. Ritorna quante righe ha spostato.
-- `security invoker`: la policy di update di `review_state` (owner-scoped) è
-- l'unico cancello, come per `apply_review`.
create function public.postpone_reviews(
  exercise_ids uuid[],
  due_ats timestamptz[],
  still_due_before timestamptz
)
returns int
language sql
security invoker
set search_path = ''
as $$
  with moved as (
    update public.review_state s
    set due_at = u.due_at
    from unnest(postpone_reviews.exercise_ids, postpone_reviews.due_ats)
      as u(exercise_id, due_at)
    where s.user_id = auth.uid()
      and s.exercise_id = u.exercise_id
      and s.due_at < postpone_reviews.still_due_before
    returning 1
  )
  select count(*)::int from moved;
$$;
