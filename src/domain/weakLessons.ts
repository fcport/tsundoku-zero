// Livello domain: «Da ripassare» (02-10-2026). Le lezioni dove lo studente sbaglia
// di più negli ultimi giorni, ciascuna con la regola che sbaglia più spesso, per
// sapere cosa andare a ristudiare.
//
// Deriva dal SOLO `review_log` (AD-18), come `./grammarPointErrorRates`: si
// raggruppa sul `grammarPoint` DENORMALIZZATO del log e lo si risolve alla lezione
// con `lessonsByGrammarPoint` di `./curriculum`. Sbagliata = esito `again`, la
// stessa misura delle statistiche. Contano solo le risposte RECENTI (una lezione
// che sbagliavi un mese fa e ora sai non resta in classifica) e solo le lezioni con
// abbastanza risposte (2 su 3 sbagliate non dice niente).
//
// Pura: nessun import esterno, `now` entra come parametro (AD-1).
import { lessonsByGrammarPoint } from './curriculum';
import type { LessonSummary } from './ports/contentRepository';
import type { ReviewLogRecord } from './streak';

/** Quanti giorni all'indietro contano le risposte. */
export const WEAK_LESSONS_WINDOW_DAYS = 14;
/** Quante risposte servono, nella finestra, perché una lezione entri in classifica. */
export const WEAK_LESSONS_MIN_ANSWERS = 8;
/** Quante lezioni mostra il riquadro. */
export const WEAK_LESSONS_LIMIT = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Una lezione in classifica: il suo tasso d'errore e la regola che sbagli di più. */
export interface WeakLesson {
  readonly lesson: LessonSummary;
  readonly total: number;
  readonly errors: number;
  /** `errors / total`, in `(0, 1]`: una lezione senza errori non è in classifica. */
  readonly errorRate: number;
  /** La regola con più errori nella lezione (a pari errori, quella con più risposte). */
  readonly worstRule: { readonly grammarPoint: string; readonly errors: number };
}

/**
 * Le lezioni con il tasso d'errore più alto nelle risposte degli ultimi
 * `WEAK_LESSONS_WINDOW_DAYS` giorni, al più `WEAK_LESSONS_LIMIT`, la peggiore in
 * cima. Entrano solo lezioni con almeno `WEAK_LESSONS_MIN_ANSWERS` risposte e
 * almeno un errore. A pari tasso: più risposte prima, poi `ordinal` crescente. Le
 * risposte a una regola che nessuna lezione dichiara (contenuto riautorato) non
 * contano.
 */
export function weakLessons(
  log: readonly ReviewLogRecord[],
  lessons: readonly LessonSummary[],
  now: Date,
): readonly WeakLesson[] {
  const since = now.getTime() - WEAK_LESSONS_WINDOW_DAYS * DAY_MS;
  const lessonOf = lessonsByGrammarPoint(lessons);

  type Bucket = { lesson: LessonSummary; total: number; errors: number; rules: Map<string, { total: number; errors: number }> };
  const byLesson = new Map<string, Bucket>();
  for (const record of log) {
    if (record.reviewedAt.getTime() < since) continue;
    const lesson = lessonOf.get(record.grammarPoint);
    if (lesson === undefined) continue;
    let bucket = byLesson.get(lesson.id);
    if (bucket === undefined) {
      bucket = { lesson, total: 0, errors: 0, rules: new Map() };
      byLesson.set(lesson.id, bucket);
    }
    const wrong = record.outcome === 'again' ? 1 : 0;
    bucket.total += 1;
    bucket.errors += wrong;
    const rule = bucket.rules.get(record.grammarPoint) ?? { total: 0, errors: 0 };
    rule.total += 1;
    rule.errors += wrong;
    bucket.rules.set(record.grammarPoint, rule);
  }

  const weak: WeakLesson[] = [];
  for (const { lesson, total, errors, rules } of byLesson.values()) {
    if (total < WEAK_LESSONS_MIN_ANSWERS || errors === 0) continue;
    let worst: { grammarPoint: string; errors: number; total: number } | null = null;
    // Le regole nell'ordine della lezione: a pari errori e risposte vince la prima.
    for (const grammarPoint of lesson.grammarPoints) {
      const rule = rules.get(grammarPoint);
      if (rule === undefined) continue;
      if (
        worst === null ||
        rule.errors > worst.errors ||
        (rule.errors === worst.errors && rule.total > worst.total)
      ) {
        worst = { grammarPoint, ...rule };
      }
    }
    if (worst === null) continue;
    weak.push({
      lesson,
      total,
      errors,
      errorRate: errors / total,
      worstRule: { grammarPoint: worst.grammarPoint, errors: worst.errors },
    });
  }

  return weak
    .sort(
      (a, b) =>
        b.errorRate - a.errorRate || b.total - a.total || a.lesson.ordinal - b.lesson.ordinal,
    )
    .slice(0, WEAK_LESSONS_LIMIT);
}
