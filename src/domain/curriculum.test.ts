import { describe, expect, it } from 'vitest';
import type { LessonSummary } from './ports/contentRepository';
import { nextLessonToUnlock } from './curriculum';

// Le cinque righe «selettore» della I/O & Edge-Case Matrix (AC3). `nextLessonToUnlock`
// è PURO: nessun clock, nessuna rete. La sequenza dipende solo da `ordinal` e
// dall'insieme delle sbloccate — «la successiva in ordine, mai una saltata; null a
// curriculum esaurito».

/** Una LessonSummary minima: solo `id`/`ordinal` contano per il selettore. */
function lesson(id: string, ordinal: number): LessonSummary {
  return { id, ordinal, title: { en: id }, grammarPoints: [] };
}

describe('nextLessonToUnlock — autorità sequenziale dello sblocco (AC3)', () => {
  it('prima lezione: nessuna sbloccata ⇒ ritorna la ordinal più bassa', () => {
    const lessons = [
      lesson('l1', 1),
      lesson('l2', 2),
      lesson('l3', 3),
      lesson('l4', 4),
      lesson('l5', 5),
    ];
    expect(nextLessonToUnlock(lessons, [])).toEqual(lesson('l1', 1));
  });

  it('prefisso sbloccato: {ord 1,2} ⇒ ritorna la successiva (ordinal 3)', () => {
    const lessons = [
      lesson('l1', 1),
      lesson('l2', 2),
      lesson('l3', 3),
      lesson('l4', 4),
      lesson('l5', 5),
    ];
    expect(nextLessonToUnlock(lessons, ['l1', 'l2'])).toEqual(lesson('l3', 3));
  });

  it('esaurito: tutte sbloccate ⇒ null', () => {
    const lessons = [lesson('l1', 1), lesson('l2', 2), lesson('l3', 3)];
    expect(nextLessonToUnlock(lessons, ['l1', 'l2', 'l3'])).toBeNull();
  });

  it('input disordinato: ordina per ordinal, ritorna la più bassa non sbloccata', () => {
    // Lista NON ordinata per `ordinal`; `l2` (ord 2) già sbloccata ⇒ la successiva
    // in ordine è `l1` (ord 1), non `l3`: il selettore ordina, non si fida
    // dell'ordine di arrivo.
    const lessons = [lesson('l3', 3), lesson('l1', 1), lesson('l2', 2)];
    expect(nextLessonToUnlock(lessons, ['l2'])).toEqual(lesson('l1', 1));
  });

  it('nessuna lezione: lista vuota ⇒ null', () => {
    expect(nextLessonToUnlock([], [])).toBeNull();
  });
});
