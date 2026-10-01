-- Una lezione nuova porta nella pila al più 12 esercizi, non tutti.
--
-- Fino a qui `unlock_lesson` materializzava OGNI esercizio della lezione, tutti
-- dovuti subito: le lezioni più ricche ne versavano 24 o 30 in un colpo, e il
-- giorno dopo tornavano tutti insieme. Da ora lo sblocco ne materializza 12, scelti
-- in modo da coprire tutte le regole e tutti i tipi di esercizio della lezione; gli
-- altri restano IN RISERVA e lo studente li aggiunge a gruppi di 6 quando vuole
-- («Esercitati di più»). La varietà resta tutta: arriva quando serve.
--
-- Cinque pezzi, in quest'ordine:
--   1. la vista `exercise_rotation`: l'ordine in cui gli esercizi di una lezione
--      entrano nella pila (la sola definizione, usata dai pezzi 2, 3 e 5);
--   2. `unlock_lesson` riscritta: stessa firma, stessa forma atomica a una sola
--      istruzione, ma materializza solo le prime 12 posizioni;
--   3. `add_lesson_exercises`: aggiunge le 6 posizioni successive non ancora in
--      pila, solo per una lezione già sbloccata; ritorna quante ne ha aggiunte;
--   4. `active_exercise_counts`: per lezione, quanti esercizi sono già in pila
--      (la pagina Lezioni mostra «12 di 24» e sa se c'è ancora una riserva);
--   5. la PULIZIA delle pile già materializzate col vecchio sblocco: gli esercizi
--      mai fatti oltre il dodicesimo tornano in riserva.
--
-- Nessuna logica di sequenza fra lezioni: quale lezione sbloccare resta una scelta
-- del dominio (`nextLessonToUnlock`). Nessuna aritmetica di scheduling: `stage = 0`
-- e `due_at` passthrough, come prima. Si applica al merge su main via migrate.yml.

-- 1. L'ordine di ingresso. Un giro alla volta su ogni regola della lezione, e dentro
-- ogni regola un giro alla volta su ogni tipo di esercizio: le prime posizioni
-- coprono tutto prima di ripetere qualcosa. A parità, l'id (derivato dal contenuto,
-- quindi stabile fra un seed e l'altro) rende l'ordine deterministico e mescolato.
-- `security_invoker`: la vista legge `exercise` coi permessi di chi la interroga
-- (la policy di lettura del contenuto resta l'unico cancello).
create view public.exercise_rotation
with (security_invoker = true)
as
select
  lesson_id,
  id,
  row_number() over (
    partition by lesson_id
    order by point_round, grammar_point, id
  )::int as position
from (
  select
    lesson_id,
    id,
    grammar_point,
    row_number() over (
      partition by lesson_id, grammar_point
      order by kind_round, kind, id
    ) as point_round
  from (
    select
      lesson_id,
      id,
      grammar_point,
      kind,
      row_number() over (
        partition by lesson_id, grammar_point, kind
        order by id
      ) as kind_round
    from public.exercise
  ) by_kind
) by_point;

-- 2. Lo sblocco: stessa firma, stessa posture e stessa forma «una sola istruzione»
-- (transazione implicita) della versione originale. Cambia solo cosa materializza:
-- le posizioni 1–12 di `exercise_rotation`. IDEMPOTENTE come prima (on conflict do
-- nothing su entrambe le insert).
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
    and r.position <= 12
  on conflict (user_id, exercise_id) do nothing;
$$;

-- 3. «Esercitati di più»: le 6 posizioni successive di una lezione GIÀ SBLOCCATA
-- (il join su `lesson_progress` dell'utente lo impone: una lezione bloccata non
-- aggiunge niente). Entrano dovute subito (`stage = 0`, `due_at` = l'istante
-- passato dal client). Ritorna quante righe ha davvero inserito: 0 quando la
-- riserva è finita.
create function public.add_lesson_exercises(
  lesson_id text,
  added_at timestamptz
)
returns int
language sql
security invoker
set search_path = ''
as $$
  with added as (
    insert into public.review_state (user_id, exercise_id, stage, due_at)
    select auth.uid(), r.id, 0, add_lesson_exercises.added_at
    from public.exercise_rotation r
    join public.lesson_progress p
      on p.lesson_id = r.lesson_id
     and p.user_id = auth.uid()
    where r.lesson_id = add_lesson_exercises.lesson_id
      and not exists (
        select 1
        from public.review_state s
        where s.user_id = auth.uid()
          and s.exercise_id = r.id
      )
    order by r.position
    limit 6
    on conflict (user_id, exercise_id) do nothing
    returning 1
  )
  select count(*)::int from added;
$$;

-- 4. Quanti esercizi di ciascuna lezione sono già nella pila dell'utente (dovuti o
-- no). Una riga per lezione, raggruppata qui: il client non deve leggere tutta
-- `review_state` per contarla.
create function public.active_exercise_counts()
returns table (lesson_id text, active int)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.lesson_id, count(*)::int
  from public.review_state s
  join public.exercise e on e.id = s.exercise_id
  where s.user_id = auth.uid()
  group by e.lesson_id;
$$;

-- 5. Le pile di oggi. Per ogni studente e ogni lezione si tengono TUTTI gli esercizi
-- già fatti almeno una volta, poi i mai fatti nell'ordine di `exercise_rotation`
-- fino a 12 in tutto. I mai fatti oltre il dodicesimo tornano in riserva: non hanno
-- storia (`review_count = 0`, nessuna riga in `review_log`), quindi toglierli non
-- cancella niente di quanto lo studente ha fatto, e «Esercitati di più» li riporta.
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
  and k.slot > 12;
