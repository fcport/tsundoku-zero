// Livello domain: i TRAGUARDI (07-10-2026). Pochi, rari, e solo su ciò che dice
// davvero che stai imparando: lezioni imparate (`./library`), esercizi arrivati al
// livello più alto, e la serie (`./streak`). Mai sul volume (risposte date), che
// premierebbe il macinare.
//
// Un traguardo, una volta preso, RESTA: si ricostruisce rigiocando il `review_log`
// in ordine di tempo e annotando l'istante in cui ogni soglia è stata superata la
// prima volta. Niente si memorizza (AD-18): stesso log ⇒ stessi traguardi.
//
// Pura: `timeZone` entra come parametro (serve alla serie), nessun orologio.
import { KNOWN_STAGE, TOP_STAGE } from './library';
import type { LessonSummary } from './ports/contentRepository';
import { nextStage } from './schedule';
import { streakHistory, type ReviewLogRecord } from './streak';

/** Le famiglie di traguardi. */
export type MilestoneFamily = 'lessonsRead' | 'topLevel' | 'streak';

/** Le soglie di ciascuna famiglia, dalla più bassa. */
export const MILESTONE_THRESHOLDS: Readonly<Record<MilestoneFamily, readonly number[]>> = {
  lessonsRead: [1, 5, 10, 20],
  topLevel: [1, 25, 100, 250],
  streak: [7, 30, 100, 365],
};

/** L'ordine in cui le famiglie si mostrano. */
export const MILESTONE_FAMILIES: readonly MilestoneFamily[] = ['lessonsRead', 'topLevel', 'streak'];

/** Un traguardo: una soglia di una famiglia, e quando l'hai superata. */
export interface Milestone {
  readonly family: MilestoneFamily;
  readonly threshold: number;
  /** L'istante della risposta che l'ha fatto superare, o `null` se non ancora. */
  readonly achievedAt: Date | null;
}

/** Una famiglia: il massimo raggiunto finora e le sue soglie. */
export interface MilestoneTrack {
  readonly family: MilestoneFamily;
  /** Il massimo mai raggiunto: lezioni imparate, esercizi al livello 5, giorni di serie. */
  readonly best: number;
  readonly milestones: readonly Milestone[];
}

/** Per ogni soglia, il primo istante in cui `value` l'ha raggiunta. */
function track(
  family: MilestoneFamily,
  steps: readonly { readonly value: number; readonly at: Date }[],
): MilestoneTrack {
  let best = 0;
  for (const step of steps) best = Math.max(best, step.value);
  return {
    family,
    best,
    milestones: MILESTONE_THRESHOLDS[family].map((threshold) => ({
      family,
      threshold,
      achievedAt: steps.find((step) => step.value >= threshold)?.at ?? null,
    })),
  };
}

/**
 * I traguardi, una traccia per famiglia nell'ordine di `MILESTONE_FAMILIES`.
 * - `lessonsRead`: quante lezioni sono state imparate almeno una volta (una lezione
 *   imparata che poi torna giù resta contata);
 * - `topLevel`: quanti esercizi diversi sono arrivati almeno una volta al livello
 *   più alto;
 * - `streak`: la serie più lunga (`streakHistory`).
 */
export function milestones(
  log: readonly ReviewLogRecord[],
  lessons: readonly LessonSummary[],
  exerciseLessons: ReadonlyMap<string, string>,
  timeZone: string,
): readonly MilestoneTrack[] {
  const totals = new Map(lessons.map((lesson) => [lesson.id, lesson.exerciseCount]));
  const stages = new Map<string, number>();
  const known = new Map<string, number>();
  const read = new Set<string>();
  const top = new Set<string>();
  const readSteps: { value: number; at: Date }[] = [];
  const topSteps: { value: number; at: Date }[] = [];

  const ordered = [...log].sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime());
  for (const record of ordered) {
    const before = stages.get(record.exerciseId) ?? 0;
    const after = nextStage(before, record.outcome);
    stages.set(record.exerciseId, after);

    const lessonId = exerciseLessons.get(record.exerciseId);
    const total = lessonId === undefined ? undefined : totals.get(lessonId);
    if (lessonId !== undefined && total !== undefined) {
      const delta = (after >= KNOWN_STAGE ? 1 : 0) - (before >= KNOWN_STAGE ? 1 : 0);
      const count = (known.get(lessonId) ?? 0) + delta;
      known.set(lessonId, count);
      if (total > 0 && count >= total && !read.has(lessonId)) {
        read.add(lessonId);
        readSteps.push({ value: read.size, at: record.reviewedAt });
      }
    }

    if (after === TOP_STAGE && !top.has(record.exerciseId)) {
      top.add(record.exerciseId);
      topSteps.push({ value: top.size, at: record.reviewedAt });
    }
  }

  const streakSteps = streakHistory(log, timeZone).map((point) => ({
    value: point.days,
    at: point.reachedAt,
  }));

  return [
    track('lessonsRead', readSteps),
    track('topLevel', topSteps),
    track('streak', streakSteps),
  ];
}
