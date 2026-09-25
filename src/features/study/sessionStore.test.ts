import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from './sessionStore';
import {
  createSession,
  sessionReducer,
  type SessionEvent,
} from '../../domain/session';
import { schedule, type ReviewOutcome, type ReviewState } from '../../domain/schedule';

// Test COMPORTAMENTALE dello store (Vitest `node`, `useSessionStore.getState()`):
// lo store DELEGA al dominio. Non verifica la logica di coda (quella è di
// `session.test.ts`); verifica che `start` costruisca via `createSession` e che
// dopo un `dispatch` lo stato sia ESATTAMENTE `sessionReducer(before, event)` —
// la delega provata per valore, non riscritta nello store.

const NOW = new Date('2026-09-24T12:00:00.000Z');

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

function reviewed(exerciseId: string, outcome: ReviewOutcome): SessionEvent {
  return { type: 'reviewed', result: schedule(stage0(exerciseId), outcome, NOW), now: NOW };
}

// Reset: lo store è un singleton di modulo condiviso fra i test. Lo riportiamo a
// una sessione fresca (coda vuota) prima di ogni caso, così nessuno stato residuo
// di un test precedente influenza il successivo.
beforeEach(() => {
  useSessionStore.setState({ session: createSession([]), total: 0, initialIds: [] });
});

describe('useSessionStore: delega al dominio (AC5)', () => {
  it('istanza fresca: coda vuota (non persistito, AC6)', () => {
    expect(useSessionStore.getState().session.queue).toEqual([]);
  });

  it('start costruisce la coda via createSession', () => {
    useSessionStore.getState().start(['a', 'b', 'c']);
    expect(useSessionStore.getState().session).toEqual(createSession(['a', 'b', 'c']));
  });

  it('start popola total e initialIds dagli id iniziali (3.19)', () => {
    useSessionStore.getState().start(['a', 'b', 'c']);
    expect(useSessionStore.getState().total).toBe(3);
    expect(useSessionStore.getState().initialIds).toEqual(['a', 'b', 'c']);
  });

  it('total/initialIds restano FISSI mentre la coda si accorcia (3.19)', () => {
    useSessionStore.getState().start(['a', 'b', 'c']);
    useSessionStore.getState().dispatch(reviewed('a', 'good'));
    // La coda cala, ma total/initialIds no.
    expect(useSessionStore.getState().session.queue).toEqual(['b', 'c']);
    expect(useSessionStore.getState().total).toBe(3);
    expect(useSessionStore.getState().initialIds).toEqual(['a', 'b', 'c']);
  });

  it('start copia gli id: non trattiene il riferimento all array del chiamante', () => {
    const ids = ['a', 'b'];
    useSessionStore.getState().start(ids);
    ids.push('c');
    expect(useSessionStore.getState().initialIds).toEqual(['a', 'b']);
  });

  it('dispatch produce ESATTAMENTE sessionReducer(before, event) (delega per valore)', () => {
    useSessionStore.getState().start(['a', 'b', 'c']);
    const before = useSessionStore.getState().session;
    const event = reviewed('a', 'again');

    useSessionStore.getState().dispatch(event);

    expect(useSessionStore.getState().session).toEqual(sessionReducer(before, event));
  });

  it('un again riaccoda attraverso lo store: [a,b,c] → [b,c,a]', () => {
    useSessionStore.getState().start(['a', 'b', 'c']);
    useSessionStore.getState().dispatch(reviewed('a', 'again'));
    expect(useSessionStore.getState().session.queue).toEqual(['b', 'c', 'a']);
  });

  it('un good fa uscire attraverso lo store: [a,b,c] → [b,c]', () => {
    useSessionStore.getState().start(['a', 'b', 'c']);
    useSessionStore.getState().dispatch(reviewed('a', 'good'));
    expect(useSessionStore.getState().session.queue).toEqual(['b', 'c']);
  });

  it('reset riporta session/total/initialIds alla forma iniziale (3.20, AC4)', () => {
    // Sessione avviata e avanzata: total/initialIds popolati, coda accorciata.
    useSessionStore.getState().start(['a', 'b', 'c']);
    useSessionStore.getState().dispatch(reviewed('a', 'good'));

    useSessionStore.getState().reset();

    // Torna alla forma iniziale: coda vuota, total 0, initialIds [].
    expect(useSessionStore.getState().session).toEqual(createSession([]));
    expect(useSessionStore.getState().session.queue).toEqual([]);
    expect(useSessionStore.getState().total).toBe(0);
    expect(useSessionStore.getState().initialIds).toEqual([]);
  });
});
