import { describe, expect, it } from 'vitest';
import {
  createSession,
  currentExerciseId,
  isComplete,
  sessionReducer,
  type SessionEvent,
} from './session';
import { schedule, type ReviewOutcome, type ReviewState } from './schedule';

// I/O Matrix di `session.ts` (Story 3.4, AD-6): la coda di sessione è un RIDUTTORE
// PURO con UN SOLO posto che decide chi resta e chi esce. I `result` NON sono
// costruiti a mano: li produce `schedule()` REALE, così la distinzione «resta»
// (intervallo 0 ⇒ `again`/`hard`-a-stadio-0) vs «esce» (intervallo > 0 ⇒
// `good`/`easy`) è quella vera del motore, e la decisione requeue delega a `isDue`.

/** Istante di riferimento fisso: il dominio non legge mai l'orologio (AD-1). */
const NOW = new Date('2026-09-24T12:00:00.000Z');

/**
 * Costruisce uno stato di ripasso FRESCO a stadio 0 per l'id dato. È lo stato di
 * uno «sblocco fresco»: `schedule(stage0, 'again'|'hard', NOW)` produce intervallo
 * 0 (resta in sessione), `schedule(stage0, 'good'|'easy', NOW)` intervallo > 0
 * (esce). I campi inerti non influenzano né `schedule` né la coda.
 */
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

/** Un evento `reviewed` con il `result` prodotto da `schedule()` reale. */
function reviewed(exerciseId: string, outcome: ReviewOutcome): SessionEvent {
  return { type: 'reviewed', result: schedule(stage0(exerciseId), outcome, NOW), now: NOW };
}

describe('createSession: costruzione della coda iniziale', () => {
  it('coda iniziale: preserva l ordine, currente = testa, non completa', () => {
    const s = createSession(['a', 'b', 'c']);
    expect(s.queue).toEqual(['a', 'b', 'c']);
    expect(currentExerciseId(s)).toBe('a');
    expect(isComplete(s)).toBe(false);
  });

  it('coda vuota: currente null, completa', () => {
    const s = createSession([]);
    expect(s.queue).toEqual([]);
    expect(currentExerciseId(s)).toBeNull();
    expect(isComplete(s)).toBe(true);
  });

  it('copia gli id: non trattiene il riferimento all array del chiamante', () => {
    const ids = ['a', 'b'];
    const s = createSession(ids);
    ids.push('c');
    expect(s.queue).toEqual(['a', 'b']);
  });
});

describe('sessionReducer: intervallo 0 ⇒ l esercizio torna in fondo (AC1)', () => {
  it('again a stadio 0: a torna in fondo → [b, c, a]', () => {
    const s = createSession(['a', 'b', 'c']);
    const next = sessionReducer(s, reviewed('a', 'again'));
    expect(next.queue).toEqual(['b', 'c', 'a']);
  });

  it('hard a stadio 0: a torna in fondo → [b, a]', () => {
    const s = createSession(['a', 'b']);
    const next = sessionReducer(s, reviewed('a', 'hard'));
    expect(next.queue).toEqual(['b', 'a']);
  });
});

describe('sessionReducer: intervallo > 0 ⇒ l esercizio esce (AC2)', () => {
  it('good a stadio 0: a esce → [b, c]', () => {
    const s = createSession(['a', 'b', 'c']);
    const next = sessionReducer(s, reviewed('a', 'good'));
    expect(next.queue).toEqual(['b', 'c']);
  });

  it('easy sull ultimo: esce → [], sessione completa', () => {
    const s = createSession(['a']);
    const next = sessionReducer(s, reviewed('a', 'easy'));
    expect(next.queue).toEqual([]);
    expect(isComplete(next)).toBe(true);
  });
});

describe('sessionReducer: ultimo esercizio, dovuto vs superato', () => {
  it('ultimo ancora dovuto (again): resta [a], non completa', () => {
    const s = createSession(['a']);
    const next = sessionReducer(s, reviewed('a', 'again'));
    expect(next.queue).toEqual(['a']);
    expect(isComplete(next)).toBe(false);
  });

  it('ultimo superato (good): [], completa', () => {
    const s = createSession(['a']);
    const next = sessionReducer(s, reviewed('a', 'good'));
    expect(next.queue).toEqual([]);
    expect(isComplete(next)).toBe(true);
  });
});

describe('sessionReducer: AC2 dell epica — sblocco fresco che si svuota', () => {
  it('ogni esercizio valutato con intervallo > 0 (good/easy) ⇒ coda vuota, isComplete', () => {
    let s = createSession(['a', 'b', 'c']);
    s = sessionReducer(s, reviewed('a', 'good'));
    s = sessionReducer(s, reviewed('b', 'easy'));
    s = sessionReducer(s, reviewed('c', 'good'));
    expect(s.queue).toEqual([]);
    expect(isComplete(s)).toBe(true);
  });
});

describe('sessionReducer: casi di frontiera', () => {
  it('id non in coda: stato invariato', () => {
    const s = createSession(['a', 'b']);
    const next = sessionReducer(s, reviewed('z', 'again'));
    expect(next.queue).toEqual(['a', 'b']);
  });

  it('non muta lo stato passato (nuova coda, input intatto)', () => {
    const s = createSession(['a', 'b', 'c']);
    const snapshot = [...s.queue];
    const next = sessionReducer(s, reviewed('a', 'again'));
    expect(next).not.toBe(s);
    expect(next.queue).not.toBe(s.queue);
    expect([...s.queue]).toEqual(snapshot);
  });

  it('è deterministico: stessa (state, event) due volte ⇒ risultati uguali per valore', () => {
    const s = createSession(['a', 'b', 'c']);
    const event = reviewed('a', 'again');
    expect(sessionReducer(s, event).queue).toEqual(sessionReducer(s, event).queue);
  });
});

// Anti-vacuità: la decisione requeue è VERDE su ENTRAMBI i lati (resta / esce), così
// un riduttore costante (sempre requeue o mai requeue) fallirebbe qui.
describe('sessionReducer: anti-vacuità sui due lati della decisione requeue', () => {
  it('again (intervallo 0) riaccoda, good (intervallo > 0) fa uscire', () => {
    const s = createSession(['a', 'b']);
    expect(sessionReducer(s, reviewed('a', 'again')).queue).toEqual(['b', 'a']);
    expect(sessionReducer(s, reviewed('a', 'good')).queue).toEqual(['b']);
  });
});
