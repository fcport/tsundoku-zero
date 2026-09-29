// Livello domain: la PILA vista come libri (30-09-2026). Ogni esercizio dovuto è
// un dorso con la sua regola e la lezione che la insegna; la dashboard li impila
// nell'ordine della coda, così il dorso in cima è il prossimo esercizio.
//
// Puro come `./curriculum`: nessun import esterno, nessun tempo. La pila resta
// autorità di `dueQueryKey` (AD-5): qui si DERIVA solo come mostrarla.

import { lessonsByGrammarPoint } from './curriculum';
import { RESERVED_ORDER_START } from './lesson';
import type { ExerciseContent, LessonSummary } from './ports/contentRepository';

/** Un dorso della pila: l'esercizio, la sua regola e la lezione che la insegna. */
export interface PileBook {
  /** L'id di RIGA dell'esercizio (la chiave della pila). */
  readonly id: string;
  readonly grammarPoint: string;
  /** L'`ordinal` della lezione del curriculum che dichiara la regola, o `null` se nessuna. */
  readonly lessonOrdinal: number | null;
}

/**
 * I dorsi della pila nell'ordine della coda (`dueIds`, il primo è il prossimo). Un
 * id il cui contenuto non è (ancora) caricato non ha dorso. La lezione è quella del
 * CURRICULUM con `ordinal` più basso che dichiara la regola: la fascia riservata
 * (fixture, order ≥ 900) non conta, anche se condivide un punto grammaticale.
 */
export function pileBooks(
  dueIds: readonly string[],
  exercises: readonly ExerciseContent[],
  lessons: readonly LessonSummary[],
): PileBook[] {
  const byId = new Map(exercises.map((e) => [e.id, e.exercise]));
  const byPoint = lessonsByGrammarPoint(lessons.filter((l) => l.ordinal < RESERVED_ORDER_START));
  const books: PileBook[] = [];
  for (const id of dueIds) {
    const exercise = byId.get(id);
    if (exercise === undefined) continue;
    books.push({
      id,
      grammarPoint: exercise.grammarPoint,
      lessonOrdinal: byPoint.get(exercise.grammarPoint)?.ordinal ?? null,
    });
  }
  return books;
}
