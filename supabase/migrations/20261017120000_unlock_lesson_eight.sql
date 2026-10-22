-- Una lezione nuova porta nella pila 8 esercizi, non più 12.
--
-- Con 12 la pila di una lezione nuova era troppo lunga per una sessione sola, e il
-- giorno dopo tornavano tutti insieme. 8 bastano a coprire tutte le regole della
-- lezione (le più ricche ne hanno 5): l'ordine di `exercise_rotation` fa un giro su
-- ogni regola prima di ripeterne una. Il resto resta in riserva, e «Esercitati di
-- più» continua ad aggiungerne 6 alla volta.
--
-- Due pezzi:
--   1. `unlock_lesson` riscritta: identica alla versione a gruppi
--      (`20261001150000_unlock_lesson_in_batches.sql`), salvo la soglia 12 → 8;
--   2. la PULIZIA delle pile di oggi: gli esercizi mai fatti oltre l'ottavo di
--      ciascuna lezione tornano in riserva.
--
-- Si applica al merge su main via migrate.yml.

-- 1. Lo sblocco: stessa firma, stessa forma «una sola istruzione», IDEMPOTENTE.
-- Cambia solo la soglia: le posizioni 1–8 di `exercise_rotation`.
create or replace function public.unlock_lesson(
  lesson_id text,
  unlocked_at timestamptz
)
returns void
language sql
security invoker
set search_path = ''
as $$
  with unlocked as (
    insert into public.lesson_progress (user_id, lesson_id, unlocked_at)
    values (auth.uid(), unlock_lesson.lesson_id, unlock_lesson.unlocked_at)
    on conflict (user_id, lesson_id) do nothing
  )
  insert into public.review_state (user_id, exercise_id, stage, due_at)
  select auth.uid(), r.id, 0, unlock_lesson.unlocked_at
  from public.exercise_rotation r
  where r.lesson_id = unlock_lesson.lesson_id
    and r.position <= 8
  on conflict (user_id, exercise_id) do nothing;
$$;

-- 2. Le pile di oggi, con la stessa regola della pulizia precedente. Per ogni
-- studente e ogni lezione si tengono TUTTI gli esercizi già fatti almeno una volta,
-- poi i mai fatti nell'ordine di `exercise_rotation` fino a 8 in tutto. I mai fatti
-- oltre l'ottavo non hanno storia (`review_count = 0`, nessuna riga in
-- `review_log`): toglierli non cancella niente, e «Esercitati di più» li riporta.
with ranked as (
  select
    s.user_id,
    s.exercise_id,
    s.review_count,
    row_number() over (
      partition by s.user_id, r.lesson_id
      order by (s.review_count > 0) desc, r.position
    ) as slot
  from public.review_state s
  join public.exercise_rotation r on r.id = s.exercise_id
)
delete from public.review_state s
using ranked k
where s.user_id = k.user_id
  and s.exercise_id = k.exercise_id
  and k.review_count = 0
  and s.last_reviewed_at is null
  and k.slot > 8;
