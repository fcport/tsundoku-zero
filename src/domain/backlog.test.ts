import { describe, expect, it } from 'vitest';
import {
  BACKLOG_PER_DAY,
  backlogBefore,
  mixByLesson,
  postponedAhead,
  spreadBacklog,
  type Postponement,
} from './backlog';
import { studyDayOrdinal, studyDayStart } from './calendarDay';
import type { ReviewState } from './schedule';

const TZ = 'Europe/Rome';
/** Le 14 a Roma del 22 ottobre 2026. */
const NOW = new Date('2026-10-22T12:00:00.000Z');
const TODAY = studyDayOrdinal(NOW, TZ);

/** Uno stato in scadenza all'inizio della giornata di studio `TODAY + offset`. */
function dueOn(id: string, offset: number): ReviewState {
  return {
    exerciseId: id,
    stage: 4,
    dueAt: studyDayStart(TODAY + offset, TZ),
    reviewCount: 5,
    lapseCount: 0,
    lastReviewedAt: null,
  };
}

/** `n` esercizi della lezione `lesson`, il k-esimo scaduto `k + 1` giorni prima di `offset`. */
function lesson(name: string, n: number, offset = -1): ReviewState[] {
  return Array.from({ length: n }, (_, k) => dueOn(`${name}-${k}`, offset - k));
}

/** La mappa esercizio → lezione (la lezione è il prefisso dell'id). */
function lessonsOf(states: readonly ReviewState[]): Map<string, string> {
  return new Map(states.map((s) => [s.exerciseId, s.exerciseId.split('-')[0] ?? '']));
}

/** I rinvii raggruppati per giornata (offset da oggi). */
function byDay(postponed: readonly Postponement[]): Map<number, string[]> {
  const days = new Map<number, string[]>();
  for (const p of postponed) {
    const offset = studyDayOrdinal(p.dueAt, TZ) - TODAY;
    days.set(offset, [...(days.get(offset) ?? []), p.exerciseId]);
  }
  return days;
}

/** Gli arretrati che restano oggi: quelli non rinviati. */
function keptToday(states: readonly ReviewState[], postponed: readonly Postponement[]): string[] {
  const moved = new Set(postponed.map((p) => p.exerciseId));
  return states
    .filter((s) => studyDayOrdinal(s.dueAt, TZ) < TODAY && !moved.has(s.exerciseId))
    .map((s) => s.exerciseId);
}

const lessonName = (id: string) => id.split('-')[0];

describe('spreadBacklog — il rientro dolce dopo una pausa', () => {
  it('il tetto è 8 arretrati al giorno', () => {
    expect(BACKLOG_PER_DAY).toBe(8);
  });

  it('fino al tetto non rinvia niente', () => {
    const states = lesson('a', 8);
    expect(spreadBacklog(states, lessonsOf(states), NOW, TZ)).toEqual([]);
  });

  it('gli esercizi che scadono oggi non sono arretrati, anche se sono tanti', () => {
    const states = Array.from({ length: 60 }, (_, i) => dueOn(`t-${i}`, 0));
    expect(spreadBacklog(states, lessonsOf(states), NOW, TZ)).toEqual([]);
  });

  it('oggi restano 8 arretrati, da 8 lezioni diverse', () => {
    const states = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].flatMap((l) => lesson(l, 5));
    const postponed = spreadBacklog(states, lessonsOf(states), NOW, TZ);

    const kept = keptToday(states, postponed);
    expect(kept).toHaveLength(8);
    expect(new Set(kept.map(lessonName)).size).toBe(8);
  });

  it('gli altri vanno ai giorni dopo, 8 per giorno, e ogni giorno è vario', () => {
    const states = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].flatMap((l) => lesson(l, 5));
    const postponed = spreadBacklog(states, lessonsOf(states), NOW, TZ);

    // 50 arretrati: 8 oggi, 42 rinviati su 6 giorni (8, 8, 8, 8, 8, 2).
    expect(postponed).toHaveLength(42);
    const days = byDay(postponed);
    expect([...days.keys()]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...days.values()].map((ids) => ids.length)).toEqual([8, 8, 8, 8, 8, 2]);
    // Con 10 lezioni nel giro, nessun giorno ne ripete una.
    for (const ids of days.values()) {
      expect(new Set(ids.map(lessonName)).size).toBe(ids.length);
    }
    // Ogni rinvio cade all'inizio di una giornata di studio.
    for (const p of postponed) {
      expect(p.dueAt.getTime()).toBe(studyDayStart(studyDayOrdinal(p.dueAt, TZ), TZ).getTime());
    }
  });

  it('dentro una lezione esce prima il più vecchio', () => {
    // Una sola lezione con 12 arretrati: restano oggi gli 8 più vecchi.
    const states = lesson('a', 12);
    const postponed = spreadBacklog(states, lessonsOf(states), NOW, TZ);
    expect(postponed.map((p) => p.exerciseId)).toEqual(['a-3', 'a-2', 'a-1', 'a-0']);
  });

  it("un altro giorno mescola le lezioni in un altro ordine", () => {
    const states = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].flatMap((l) =>
      lesson(l, 3),
    );
    const today = keptToday(states, spreadBacklog(states, lessonsOf(states), NOW, TZ));
    const later = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000);
    const shifted = states.map((s) => ({ ...s, dueAt: new Date(s.dueAt.getTime() + 3 * 86_400_000) }));
    const moved = new Set(spreadBacklog(shifted, lessonsOf(shifted), later, TZ).map((p) => p.exerciseId));
    const otherDay = shifted.filter((s) => !moved.has(s.exerciseId)).map((s) => s.exerciseId);
    expect(new Set(otherDay.map(lessonName))).not.toEqual(new Set(today.map(lessonName)));
  });

  it('un esercizio senza lezione nota fa gruppo da solo', () => {
    const states = lesson('a', 10);
    const postponed = spreadBacklog(states, new Map(), NOW, TZ);
    // Ognuno è la sua «lezione»: 8 restano, 2 rinviati, nessun errore.
    expect(postponed).toHaveLength(2);
  });

  it('è deterministica: stessi stati in ordine diverso, stessi rinvii', () => {
    const states = ['x', 'y', 'z'].flatMap((l) => lesson(l, 7));
    expect(spreadBacklog([...states].reverse(), lessonsOf(states), NOW, TZ)).toEqual(
      spreadBacklog(states, lessonsOf(states), NOW, TZ),
    );
  });

  it("un arretrato scade prima dell'inizio della giornata di studio di oggi (le 2 locali)", () => {
    expect(backlogBefore(NOW, TZ)).toEqual(new Date('2026-10-22T00:00:00.000Z'));
  });
});

describe("mixByLesson — l'ordine della pila: lezioni alternate, ogni giorno diverso", () => {
  // Come arrivano dal database: raggruppati per lezione.
  const states = ['a', 'b', 'c'].flatMap((l) => lesson(l, 3));

  it('due esercizi di fila vengono da lezioni diverse', () => {
    const order = mixByLesson(states, lessonsOf(states), TODAY).map((s) => lessonName(s.exerciseId));
    for (let i = 1; i < order.length; i += 1) expect(order[i]).not.toBe(order[i - 1]);
  });

  it('dentro una lezione prima il più vecchio', () => {
    const order = mixByLesson(states, lessonsOf(states), TODAY).map((s) => s.exerciseId);
    const ofA = order.filter((id) => id.startsWith('a-'));
    expect(ofA).toEqual(['a-2', 'a-1', 'a-0']);
  });

  it('in una settimana le lezioni non partono sempre nello stesso ordine', () => {
    const firsts = new Set(
      Array.from({ length: 7 }, (_, d) =>
        mixByLesson(states, lessonsOf(states), TODAY + d)
          .slice(0, 3)
          .map((s) => lessonName(s.exerciseId))
          .join(''),
      ),
    );
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('tiene tutti gli esercizi, nessuno doppio', () => {
    const order = mixByLesson(states, lessonsOf(states), TODAY);
    expect(order.map((s) => s.exerciseId).sort()).toEqual(states.map((s) => s.exerciseId).sort());
  });
});

describe('postponedAhead — gli arretrati rinviati ancora in arrivo', () => {
  /** Uno stato allo stadio `stage`, ripassato `reviewedOffset` giorni da oggi, in scadenza a `dueOffset`. */
  function reviewed(id: string, stage: number, reviewedOffset: number, dueOffset: number): ReviewState {
    return {
      ...dueOn(id, dueOffset),
      stage,
      lastReviewedAt: new Date(studyDayStart(TODAY + reviewedOffset, TZ).getTime() + 3_600_000),
    };
  }

  it('una scadenza data dallo scheduler non è un rinvio, anche al bordo della dispersione', () => {
    // Stadio 3 (7 giorni): al più round(7 × 1,25) = 9 giorni dopo il ripasso.
    expect(postponedAhead([reviewed('a', 3, -2, 7)], NOW, TZ)).toBe(0);
  });

  it('una scadenza più lontana di quanto lo scheduler possa mandarla è un rinvio', () => {
    // Stadio 1 (1 giorno, al più 1): ripassato 10 giorni fa, scade fra 2 giorni.
    expect(postponedAhead([reviewed('a', 1, -10, 2)], NOW, TZ)).toBe(1);
  });

  it('un esercizio mai ripassato che scade in un giorno futuro è un rinvio', () => {
    expect(postponedAhead([dueOn('a', 3)], NOW, TZ)).toBe(1);
  });

  it('i dovuti di oggi o arretrati non contano: sono già in pila', () => {
    expect(postponedAhead([dueOn('a', 0), dueOn('b', -4)], NOW, TZ)).toBe(0);
  });

  it('conta esattamente quello che spreadBacklog ha rinviato', () => {
    const states = ['a', 'b', 'c', 'd'].flatMap((l) => lesson(l, 6));
    const moved = new Map(
      spreadBacklog(states, lessonsOf(states), NOW, TZ).map((p) => [p.exerciseId, p.dueAt]),
    );
    const after = states.map((s) => ({ ...s, dueAt: moved.get(s.exerciseId) ?? s.dueAt }));
    expect(postponedAhead(after, NOW, TZ)).toBe(moved.size);
    expect(moved.size).toBe(16);
  });
});
