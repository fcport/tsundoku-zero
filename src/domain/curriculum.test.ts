import { describe, expect, it } from 'vitest';
import type { LessonSummary } from './ports/contentRepository';
import { lastUnlockedLesson, nextLessonToUnlock } from './curriculum';

// Le righe «selettore» della I/O & Edge-Case Matrix (AC3/AC4). `nextLessonToUnlock`
// e `lastUnlockedLesson` sono PURI: nessun clock, nessuna rete. La sequenza dipende
// solo da `ordinal` e dall'insieme delle sbloccate — «la successiva in ordine, mai
// una saltata; null a curriculum esaurito» e «l'ultima sbloccata = ordinal massimo».

/** Una LessonSummary minima: solo `id`/`ordinal` contano per i selettori. */
function lesson(id: string, ordinal: number): LessonSummary {
  return { id, ordinal, title: { en: id }, grammarPoints: [], exerciseCount: 0 };
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

describe('lastUnlockedLesson — l\'ultima sbloccata = ordinal massimo sbloccato (AC4)', () => {
  it('nulla sbloccato: unlocked ∅ ⇒ null', () => {
    const lessons = [
      lesson('l1', 1),
      lesson('l2', 2),
      lesson('l3', 3),
      lesson('l4', 4),
      lesson('l5', 5),
    ];
    expect(lastUnlockedLesson(lessons, [])).toBeNull();
  });

  it('prefisso sbloccato: {ord 1,2,3} ⇒ la sbloccata più alta (ordinal 3)', () => {
    const lessons = [
      lesson('l1', 1),
      lesson('l2', 2),
      lesson('l3', 3),
      lesson('l4', 4),
      lesson('l5', 5),
    ];
    expect(lastUnlockedLesson(lessons, ['l1', 'l2', 'l3'])).toEqual(lesson('l3', 3));
  });

  it('input disordinato: ordina per ordinal DISCENDENTE, ritorna la più alta sbloccata', () => {
    // Lista NON ordinata per `ordinal`; {l1,l2} sbloccate ⇒ la più alta è `l2`
    // (ord 2): il selettore ordina, non si fida dell'ordine di arrivo.
    const lessons = [lesson('l3', 3), lesson('l1', 1), lesson('l2', 2)];
    expect(lastUnlockedLesson(lessons, ['l1', 'l2'])).toEqual(lesson('l2', 2));
  });

  it('id spurio: un id sbloccato assente dalle lezioni è ignorato ⇒ max fra i match', () => {
    // `ghost` non è fra le lezioni: nessun match, viene ignorato; fra i match
    // (l1, l2) ritorna la più alta (l2).
    const lessons = [lesson('l1', 1), lesson('l2', 2), lesson('l3', 3)];
    expect(lastUnlockedLesson(lessons, ['l1', 'l2', 'ghost'])).toEqual(lesson('l2', 2));
  });
});
