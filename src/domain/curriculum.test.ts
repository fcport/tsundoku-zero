import { describe, expect, it } from 'vitest';
import type { LessonSummary } from './ports/contentRepository';
import {
  lastUnlockedLesson,
  lessonsByGrammarPoint,
  nextLessonToUnlock,
} from './curriculum';

// Le righe «selettore» della I/O & Edge-Case Matrix (AC3/AC4). `nextLessonToUnlock`
// e `lastUnlockedLesson` sono PURI: nessun clock, nessuna rete. La sequenza dipende
// solo da `ordinal` e dall'insieme delle sbloccate — «la successiva in ordine, mai
// una saltata; null a curriculum esaurito» e «l'ultima sbloccata = ordinal massimo».

/** Una LessonSummary minima: solo `id`/`ordinal` contano per i selettori. */
function lesson(id: string, ordinal: number): LessonSummary {
  return { id, ordinal, title: { en: id }, grammarPoints: [], exerciseCount: 0 };
}

/** Una LessonSummary con i suoi punti grammaticali (per lessonsByGrammarPoint). */
function lessonWithPoints(
  id: string,
  ordinal: number,
  grammarPoints: readonly string[],
): LessonSummary {
  return { id, ordinal, title: { en: id }, grammarPoints, exerciseCount: 0 };
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

describe('lessonsByGrammarPoint — join puro punto -> lezione (5.3)', () => {
  it('una lezione con PIU punti ⇒ tutti mappati a quella lezione', () => {
    const l = lessonWithPoints('l1', 1, ['te-form', 'particles', 'counters']);
    const map = lessonsByGrammarPoint([l]);
    expect(map.get('te-form')).toBe(l);
    expect(map.get('particles')).toBe(l);
    expect(map.get('counters')).toBe(l);
    expect(map.size).toBe(3);
  });

  it('piu lezioni ⇒ ogni punto mappato alla propria lezione', () => {
    const l1 = lessonWithPoints('l1', 1, ['te-form']);
    const l2 = lessonWithPoints('l2', 2, ['particles']);
    const map = lessonsByGrammarPoint([l1, l2]);
    expect(map.get('te-form')).toBe(l1);
    expect(map.get('particles')).toBe(l2);
  });

  it('collisione (stesso punto in due lezioni) ⇒ vince l ordinal piu basso', () => {
    // `shared` compare in l2 (ord 2) e l1 (ord 1): il primo occupante in ordine
    // crescente e l1, che vince. L'input arriva disordinato per provare l'ordinamento.
    const l2 = lessonWithPoints('l2', 2, ['shared']);
    const l1 = lessonWithPoints('l1', 1, ['shared']);
    const map = lessonsByGrammarPoint([l2, l1]);
    expect(map.get('shared')).toBe(l1);
  });

  it('lista vuota ⇒ mappa vuota', () => {
    expect(lessonsByGrammarPoint([]).size).toBe(0);
  });

  it('una lezione senza punti ⇒ non contribuisce alla mappa', () => {
    const map = lessonsByGrammarPoint([lessonWithPoints('l1', 1, [])]);
    expect(map.size).toBe(0);
  });
});
