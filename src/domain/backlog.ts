// Livello domain: il RIENTRO DOLCE (22-10-2026). Dopo una pausa gli esercizi
// scaduti nei giorni passati (gli ARRETRATI) arrivavano tutti insieme: due
// settimane via e al rientro la pila ne aveva più di 300. E un esercizio di
// grammatica non è una flashcard: 8 al giorno sono già una sessione vera.
//
// La regola: ogni giorno entrano al più `BACKLOG_PER_DAY` arretrati, VARI. Gli
// arretrati si raggruppano per lezione e si prendono a giro, uno per lezione: gli 8
// di oggi vengono da 8 lezioni diverse (quando ce ne sono), quelli di domani dalle
// lezioni successive, e così via. Dentro una lezione esce prima il più vecchio.
// L'ordine delle lezioni nel giro dipende dal giorno (hash `lezione:giorno`), così
// un altro rientro mescola in un altro modo. I primi 8 restano oggi; gli altri
// vanno ai giorni dopo, 8 per giorno, IN AGGIUNTA agli esercizi che scadono quel
// giorno (contarli farebbe slittare gli arretrati di mesi). Gli esercizi che
// scadono oggi non sono arretrati: un giorno normale non cambia.
//
// Lo stesso giro (`mixByLesson`) dà anche l'ORDINE della pila di ogni giorno: due
// esercizi di fila vengono da lezioni diverse, e il giorno dopo l'ordine è un altro.
//
// Puro come `./schedule`: nessun orologio, nessun fuso ambientale. `now` e
// `timeZone` entrano come parametri.
import { studyDayOrdinal, studyDayStart } from './calendarDay';
import { fnv1a } from './hash';
import { latestIntervalDays, type ReviewState } from './schedule';

/** Quanti arretrati al più entrano in un giorno. */
export const BACKLOG_PER_DAY = 8;

/** Un rinvio: l'esercizio e la sua nuova scadenza (l'inizio di una giornata di studio). */
export interface Postponement {
  readonly exerciseId: string;
  readonly dueAt: Date;
}

/**
 * Dati gli stati di ripasso dell'utente e la lezione di ciascun esercizio
 * (`lessonOf`; un esercizio senza lezione nota fa gruppo da solo), decide quali
 * arretrati rinviare e a quando. Fino a `perDay` arretrati ⇒ lista vuota. PURA e
 * DETERMINISTICA: a parità di stati e di giornata di studio dà sempre gli stessi
 * rinvii, così due letture quasi simultanee (dashboard e precarico) scrivono la
 * stessa cosa.
 */
export function spreadBacklog(
  states: readonly ReviewState[],
  lessonOf: ReadonlyMap<string, string>,
  now: Date,
  timeZone: string,
  perDay: number = BACKLOG_PER_DAY,
): Postponement[] {
  const today = studyDayOrdinal(now, timeZone);
  const backlog = states.filter((state) => studyDayOrdinal(state.dueAt, timeZone) < today);
  if (backlog.length <= perDay) return [];

  return mixByLesson(backlog, lessonOf, today).slice(perDay).map((state, i) => ({
    exerciseId: state.exerciseId,
    dueAt: studyDayStart(today + 1 + Math.floor(i / perDay), timeZone),
  }));
}

/**
 * Mescola gli esercizi per lezione: a giro, uno per lezione a ogni passata, così
 * due esercizi vicini vengono da lezioni diverse finché ce ne sono. Dentro una
 * lezione prima il più vecchio. L'ordine delle lezioni nel giro dipende dalla
 * giornata di studio `day` (hash `lezione:giorno`): ogni giorno un altro ordine.
 * Un esercizio senza lezione in `lessonOf` fa gruppo da solo. PURA e
 * deterministica: non dipende dall'ordine di `states`.
 */
export function mixByLesson(
  states: readonly ReviewState[],
  lessonOf: ReadonlyMap<string, string>,
  day: number,
): ReviewState[] {
  const groups = new Map<string, ReviewState[]>();
  for (const state of states) {
    const lesson = lessonOf.get(state.exerciseId) ?? state.exerciseId;
    const group = groups.get(lesson);
    if (group === undefined) groups.set(lesson, [state]);
    else group.push(state);
  }
  const lessons = [...groups.keys()].sort(
    (a, b) => fnv1a(`${a}:${day}`) - fnv1a(`${b}:${day}`) || a.localeCompare(b),
  );
  const queues = lessons.map((lesson) =>
    [...(groups.get(lesson) ?? [])].sort(
      (a, b) =>
        a.dueAt.getTime() - b.dueAt.getTime() || a.exerciseId.localeCompare(b.exerciseId),
    ),
  );

  const order: ReviewState[] = [];
  for (let round = 0; order.length < states.length; round += 1) {
    for (const queue of queues) {
      const state = queue[round];
      if (state !== undefined) order.push(state);
    }
  }
  return order;
}

/**
 * Quanti arretrati RINVIATI aspettano ancora nei giorni dopo oggi. Un rinvio si
 * riconosce dai dati, senza segnarlo: la scadenza cade più lontano di quanto
 * `schedule` avrebbe potuto mandarlo dopo l'ultimo ripasso (`latestIntervalDays`),
 * oppure l'esercizio non è mai stato ripassato (sblocco e «Esercitati di più» lo
 * mettono dovuto subito) e scade comunque in un giorno futuro. Finché ce n'è
 * almeno uno, la dashboard non offre lezioni nuove. PURA.
 */
export function postponedAhead(states: readonly ReviewState[], now: Date, timeZone: string): number {
  const today = studyDayOrdinal(now, timeZone);
  return states.filter((state) => {
    const dueDay = studyDayOrdinal(state.dueAt, timeZone);
    if (dueDay <= today) return false;
    if (state.lastReviewedAt === null) return true;
    return dueDay > studyDayOrdinal(state.lastReviewedAt, timeZone) + latestIntervalDays(state.stage);
  }).length;
}

/** Il giorno di studio di oggi comincia a quest'istante: un arretrato scade prima. */
export function backlogBefore(now: Date, timeZone: string): Date {
  return studyDayStart(studyDayOrdinal(now, timeZone), timeZone);
}
