import { describe, expect, it } from 'vitest';
import { applyResultToDue, dueQueryKey, isDue } from './due';
import { schedule, type ReviewOutcome, type ReviewState } from './schedule';

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

// applyResultToDue (3.19): l'aggiornamento OTTIMISTICO del conteggio della pila.
// I `result` NON sono costruiti a mano: li produce `schedule()` REALE, così la
// direzione del filtro («esce» a intervallo > 0, «resta» a intervallo 0) è quella
// vera del motore, provata contro la scala Leitner.
describe('applyResultToDue: rimpiazza e rifiltra con isDue (3.19)', () => {
  const NOW = new Date('2026-09-24T12:00:00.000Z');

  /** Stato di ripasso FRESCO a stadio 0 per l'id dato (come session.test.ts). */
  function stage0(exerciseId: string): ReviewState {
    return {
      exerciseId,
      stage: 0,
      dueAt: new Date('2026-09-01T00:00:00.000Z'),
      reviewCount: 0,
      lapseCount: 0,
      lastReviewedAt: null,
    };
  }

  /** Il `result` prodotto da `schedule()` reale per (id, outcome). */
  function resultOf(exerciseId: string, outcome: ReviewOutcome): ReviewState {
    return schedule(stage0(exerciseId), outcome, NOW);
  }

  it('good (dueAt > now) FA USCIRE l esercizio dalla pila', () => {
    const pile = [stage0('a'), stage0('b')];
    const result = resultOf('a', 'good');
    // schedule good a stadio 0 ⇒ stadio 1, intervallo > 0 ⇒ dueAt > now.
    expect(isDue(result, NOW)).toBe(false);
    const next = applyResultToDue(pile, result, NOW);
    expect(next.map((s) => s.exerciseId)).toEqual(['b']);
  });

  it('easy (dueAt > now) FA USCIRE l esercizio dalla pila', () => {
    const pile = [stage0('a'), stage0('b')];
    const result = resultOf('a', 'easy');
    expect(isDue(result, NOW)).toBe(false);
    const next = applyResultToDue(pile, result, NOW);
    expect(next.map((s) => s.exerciseId)).toEqual(['b']);
  });

  it('again (dueAt === now, stadio 0) MANTIENE l esercizio (conteggio invariato)', () => {
    const pile = [stage0('a'), stage0('b')];
    const result = resultOf('a', 'again');
    // schedule again ⇒ stadio 0, intervallo 0 ⇒ dueAt === now ⇒ ancora dovuto.
    expect(isDue(result, NOW)).toBe(true);
    const next = applyResultToDue(pile, result, NOW);
    expect(next.map((s) => s.exerciseId)).toEqual(['a', 'b']);
    // Lo stato è stato RIMPIAZZATO con result (stadio/dueat aggiornati).
    expect(next.find((s) => s.exerciseId === 'a')).toEqual(result);
  });

  it('hard a stadio 0 (dueAt === now) MANTIENE l esercizio', () => {
    const pile = [stage0('a')];
    const result = resultOf('a', 'hard');
    // hard a stadio 0: nextStage 0, intervallo 0 ⇒ dueAt === now.
    expect(isDue(result, NOW)).toBe(true);
    const next = applyResultToDue(pile, result, NOW);
    expect(next.map((s) => s.exerciseId)).toEqual(['a']);
  });

  it('gli altri stati restano INVARIATI (solo l esercizio del result è toccato)', () => {
    const other = stage0('b');
    const pile = [stage0('a'), other];
    const result = resultOf('a', 'again'); // 'a' resta dovuto
    const next = applyResultToDue(pile, result, NOW);
    // 'b' è lo STESSO riferimento (non rimpiazzato).
    expect(next.find((s) => s.exerciseId === 'b')).toBe(other);
  });

  it('esercizio non presente ⇒ pila invariata (per valore)', () => {
    const pile = [stage0('a'), stage0('b')];
    const result = resultOf('z', 'again'); // 'z' non è in pila
    const next = applyResultToDue(pile, result, NOW);
    expect(next.map((s) => s.exerciseId)).toEqual(['a', 'b']);
  });

  it('non muta l array né gli stati passati', () => {
    const pile = [stage0('a'), stage0('b')];
    const snapshot = pile.map((s) => s.exerciseId);
    applyResultToDue(pile, resultOf('a', 'good'), NOW);
    expect(pile.map((s) => s.exerciseId)).toEqual(snapshot);
    expect(pile.length).toBe(2);
  });

  // Anti-vacuità: verde su ENTRAMBI i lati (esce / resta), così un filtro costante
  // fallirebbe qui.
  it('anti-vacuità: good esce, again resta', () => {
    const pile = [stage0('a')];
    expect(applyResultToDue(pile, resultOf('a', 'good'), NOW)).toEqual([]);
    expect(applyResultToDue(pile, resultOf('a', 'again'), NOW).map((s) => s.exerciseId)).toEqual(['a']);
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
