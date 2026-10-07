// Livello domain: il RIEPILOGO di una sessione (07-10-2026), per la schermata dello
// zero. Non «hai risposto a 20 domande» (il volume non dice niente), ma cosa è
// cambiato davvero: quanti esercizi sono saliti di livello, quanti sono arrivati in
// cima, quali lezioni sono diventate imparate, quali traguardi sono arrivati.
//
// La sessione è tutto ciò che nel log ha `reviewedAt >= since`; lo stato «prima» è
// il log fino a `since`. Deriva dal SOLO log (AD-18). Pura.
import { lessonMastery, TOP_STAGE } from './library';
import { milestones, type Milestone } from './milestones';
import type { LessonSummary } from './ports/contentRepository';
import { currentStages } from './stageDistribution';
import type { ReviewLogRecord } from './streak';

export interface SessionRecap {
  /** Le risposte date nella sessione. */
  readonly answers: number;
  /** Gli esercizi che a fine sessione sono più in alto di prima. */
  readonly levelUps: number;
  /** Gli esercizi arrivati nella sessione al livello più alto. */
  readonly reachedTop: number;
  /** Le lezioni imparate adesso e non prima, in ordine di `ordinal`. */
  readonly lessonsRead: readonly LessonSummary[];
  /** I traguardi superati nella sessione. */
  readonly newMilestones: readonly Milestone[];
}

export function sessionRecap(
  log: readonly ReviewLogRecord[],
  since: Date,
  lessons: readonly LessonSummary[],
  exerciseLessons: ReadonlyMap<string, string>,
  timeZone: string,
): SessionRecap {
  const start = since.getTime();
  const before = log.filter((record) => record.reviewedAt.getTime() < start);
  const session = log.filter((record) => record.reviewedAt.getTime() >= start);

  const stagesBefore = currentStages(before);
  const stagesAfter = currentStages(log);
  let levelUps = 0;
  let reachedTop = 0;
  for (const exerciseId of new Set(session.map((record) => record.exerciseId))) {
    const from = stagesBefore.get(exerciseId) ?? 0;
    const to = stagesAfter.get(exerciseId) ?? 0;
    if (to > from) levelUps += 1;
    if (to === TOP_STAGE && from < TOP_STAGE) reachedTop += 1;
  }

  const masteryBefore = lessonMastery(before, lessons, exerciseLessons);
  const masteryAfter = lessonMastery(log, lessons, exerciseLessons);
  const lessonsRead = [...lessons]
    .filter((lesson) => masteryAfter.get(lesson.id)?.read && !masteryBefore.get(lesson.id)?.read)
    .sort((a, b) => a.ordinal - b.ordinal);

  const newMilestones = milestones(log, lessons, exerciseLessons, timeZone)
    .flatMap((track) => track.milestones)
    .filter((milestone) => milestone.achievedAt !== null && milestone.achievedAt.getTime() >= start);

  return { answers: session.length, levelUps, reachedTop, lessonsRead, newMilestones };
}
