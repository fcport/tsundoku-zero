import { describe, expect, it } from 'vitest';
import { dueQueryKey, isDue } from './due';
import type { ReviewState } from './schedule';

// I/O Matrix di `due.ts` (Story 3.3, AD-5): l'UNICO predicato di dovutezza e
// l'UNICA identità della pila. `isDue` è pura, sincrona, totale, non muta lo
// stato e usa un confine INCLUSIVO su `now`; `dueQueryKey` è la tupla readonly
// `['due', userId]`, deterministica e isolata per-utente.

/**
 * Costruisce uno `ReviewState` con `dueAt` esplicito. Gli altri campi sono
 * riempiti con valori inerti: `isDue` decide SOLO su `dueAt`, quindi il resto
 * non influenza il risultato (lo verifichiamo implicitamente non variandolo).
 */
function stateWithDueAt(dueAt: Date): ReviewState {
  return {
    exerciseId: 'ex-1',
    stage: 0,
    dueAt,
    reviewCount: 0,
    lapseCount: 0,
    lastReviewedAt: null,
  };
}

describe('isDue: predicato di dovutezza inclusivo (AC1, AC2)', () => {
  const now = new Date('2026-09-24T12:00:00.000Z');

  it('scaduto nel passato (dueAt = now − 1ms) ⇒ true', () => {
    const state = stateWithDueAt(new Date(now.getTime() - 1));
    expect(isDue(state, now)).toBe(true);
  });

  it('dovuto esatto (dueAt = now, intervallo 0) ⇒ true (confine inclusivo)', () => {
    const state = stateWithDueAt(new Date(now.getTime()));
    expect(isDue(state, now)).toBe(true);
  });

  it('non ancora dovuto (dueAt = now + 1ms) ⇒ false', () => {
    const state = stateWithDueAt(new Date(now.getTime() + 1));
    expect(isDue(state, now)).toBe(false);
  });

  it('sblocco fresco a stadio 0 (dueAt = istante di sblocco ≤ now) ⇒ true', () => {
    // schedule() produce dueAt === now per un again/stadio 0 (intervallo 0):
    // un tale esercizio deve risultare dovuto immediatamente.
    const unlockInstant = new Date(now.getTime());
    const state = stateWithDueAt(unlockInstant);
    expect(isDue(state, now)).toBe(true);
  });

  // Anti-vacuità: `isDue` è verde su ENTRAMBI i lati del confine `now`, così un
  // predicato costante (sempre true o sempre false) fallirebbe qui.
  it('anti-vacuità: verde su entrambi i lati del confine now', () => {
    expect(isDue(stateWithDueAt(new Date(now.getTime() - 1)), now)).toBe(true);
    expect(isDue(stateWithDueAt(new Date(now.getTime() + 1)), now)).toBe(false);
  });

  it('non muta lo stato passato', () => {
    const dueAt = new Date(now.getTime() - 5);
    const state = stateWithDueAt(dueAt);
    const snapshot = {
      exerciseId: state.exerciseId,
      stage: state.stage,
      dueAtMs: state.dueAt.getTime(),
      reviewCount: state.reviewCount,
      lapseCount: state.lapseCount,
      lastReviewedAt: state.lastReviewedAt,
    };
    isDue(state, now);
    expect(state.exerciseId).toBe(snapshot.exerciseId);
    expect(state.stage).toBe(snapshot.stage);
    expect(state.dueAt.getTime()).toBe(snapshot.dueAtMs);
    expect(state.reviewCount).toBe(snapshot.reviewCount);
    expect(state.lapseCount).toBe(snapshot.lapseCount);
    expect(state.lastReviewedAt).toBe(snapshot.lastReviewedAt);
  });

  it('è deterministica: stessa coppia (state, now) ⇒ stesso booleano', () => {
    const state = stateWithDueAt(new Date(now.getTime() - 10));
    expect(isDue(state, now)).toBe(isDue(state, now));
  });
});

describe('dueQueryKey: identità della pila (AC4)', () => {
  it('produce la tupla ["due", userId]', () => {
    expect(dueQueryKey('u1')).toEqual(['due', 'u1']);
  });

  it('è deterministica per valore: stesso userId ⇒ tuple uguali', () => {
    expect(dueQueryKey('u1')).toEqual(dueQueryKey('u1'));
  });

  it('isola per-utente: userId diversi ⇒ secondo elemento diverso', () => {
    const a = dueQueryKey('u1');
    const b = dueQueryKey('u2');
    expect(a[1]).not.toBe(b[1]);
    expect(a[0]).toBe(b[0]); // il namespace resta 'due'
  });
});
