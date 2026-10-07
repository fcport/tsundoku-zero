// Livello domain: la LIBRERIA (07-10-2026). Il nome dell'app è la pila dei libri
// non letti; qui una lezione è un libro, e diventa IMPARATO quando sai bene tutti i
// suoi esercizi: ognuno è almeno al livello `KNOWN_STAGE`, cioè torna fra 16 giorni
// o più. È uno stato CORRENTE, non un premio: se un esercizio torna giù, il libro
// torna sulla pila (i traguardi, che non si perdono, sono in `./milestones`).
//
// Deriva dal SOLO `review_log` (AD-18): lo stadio di ogni esercizio si ricostruisce
// con `currentStages`, mai da `review_state`. La lezione di un esercizio arriva dal
// contenuto (`exerciseLessons`, id esercizio → id lezione): la regola grammaticale
// non basta, perché più lezioni ne condividono una. Un esercizio del log che il
// contenuto non conosce più (riautorato) non conta.
//
// Pura: nessun import esterno, nessun orologio.
import { LEITNER_INTERVALS_DAYS } from './schedule';
import type { LessonSummary } from './ports/contentRepository';
import { currentStages } from './stageDistribution';
import type { ReviewLogRecord } from './streak';

/** Da questo livello un esercizio «lo sai bene»: torna fra 16 giorni o più. */
export const KNOWN_STAGE = 4;

/** Il livello più alto della scala (5: torna fra 35 giorni). */
export const TOP_STAGE = LEITNER_INTERVALS_DAYS.length - 1;

/** A che punto è una lezione. */
export interface LessonMastery {
  /** Gli esercizi della lezione almeno al livello `KNOWN_STAGE` (al più `total`). */
  readonly known: number;
  /** Gli esercizi della lezione (`exerciseCount`). */
  readonly total: number;
  /** Imparata: ha esercizi e li sai bene tutti. */
  readonly read: boolean;
}

/**
 * La padronanza di ogni lezione passata, per id. Una lezione senza esercizi ha
 * `total` 0 e non è mai «imparata» qui: è solo da leggere, e lo dice la UI.
 */
export function lessonMastery(
  log: readonly ReviewLogRecord[],
  lessons: readonly LessonSummary[],
  exerciseLessons: ReadonlyMap<string, string>,
): ReadonlyMap<string, LessonMastery> {
  const known = new Map<string, number>();
  for (const [exerciseId, stage] of currentStages(log)) {
    if (stage < KNOWN_STAGE) continue;
    const lessonId = exerciseLessons.get(exerciseId);
    if (lessonId === undefined) continue;
    known.set(lessonId, (known.get(lessonId) ?? 0) + 1);
  }
  const mastery = new Map<string, LessonMastery>();
  for (const lesson of lessons) {
    const total = lesson.exerciseCount;
    const count = Math.min(known.get(lesson.id) ?? 0, total);
    mastery.set(lesson.id, { known: count, total, read: total > 0 && count >= total });
  }
  return mastery;
}
