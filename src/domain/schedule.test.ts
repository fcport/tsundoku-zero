import { describe, expect, it } from 'vitest';
import {
  LEITNER_INTERVALS_DAYS,
  schedule,
  type ReviewOutcome,
  type ReviewState,
} from './schedule';

// Copre ogni riga della I/O Matrix della spec (Story 3.1): transizioni di stadio
// per i quattro esiti, saturazione a 5 con `easy`, reset a 0 con `again`, stadio 0
// stabile con intervallo 0, `hard` che tiene lo stadio riducendo l'intervallo,
// determinismo e dispersione delle scadenze. Il jitter è deterministico ma non
// noto a priori, quindi si assertisce l'intervallo come FINESTRA
// `[base, base × (1 + DISPERSION_FRACTION))`; per l'intervallo 0 si pretende
// l'uguaglianza ESATTA `dueAt.getTime() === now.getTime()`.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Deve combaciare con `DISPERSION_FRACTION` del modulo: la finestra attesa.
const DISPERSION_FRACTION = 0.25;

/** Istante di riferimento fisso: il dominio non legge mai l'orologio (AD-1). */
const NOW = new Date('2026-09-24T12:00:00.000Z');

/** Costruisce uno stato di partenza, sovrascrivendo i campi indicati. */
function stateAt(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    exerciseId: 'ex-1',
    stage: 0,
    dueAt: new Date('2026-09-01T00:00:00.000Z'),
    reviewCount: 0,
    lapseCount: 0,
    lastReviewedAt: null,
    ...overrides,
  };
}

/**
 * Verifica che `dueAt` cada nella finestra `[base, base × (1 + DISPERSION))` a
 * partire da `now`, dove `base = intervalDays × fattore` giorni. Assorbe il jitter
 * deterministico senza doverne conoscere il valore esatto.
 */
function expectDueWindow(
  result: ReviewState,
  now: Date,
  intervalDays: number,
  factor = 1,
): void {
  const baseMs = intervalDays * factor * MS_PER_DAY;
  const deltaMs = result.dueAt.getTime() - now.getTime();
  expect(deltaMs).toBeGreaterThanOrEqual(baseMs);
  expect(deltaMs).toBeLessThan(baseMs * (1 + DISPERSION_FRACTION));
}

describe('schedule: transizioni di stadio per esito (AC2)', () => {
  it('good sotto il tetto: stage 2 → 3, intervallo 7g + jitter', () => {
    const result = schedule(stateAt({ stage: 2 }), 'good', NOW);
    expect(result.stage).toBe(3);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[3]); // 7g
  });

  it('easy sotto il tetto: stage 1 → 3, intervallo 7g + jitter', () => {
    const result = schedule(stateAt({ stage: 1 }), 'easy', NOW);
    expect(result.stage).toBe(3);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[3]); // 7g
  });

  it('hard a stadio medio: resta 3, intervallo 7g × 0.6 = 4.2g + jitter', () => {
    const result = schedule(stateAt({ stage: 3 }), 'hard', NOW);
    expect(result.stage).toBe(3);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[3], 0.6); // 4.2g
  });

  it('again da qualunque stadio: → 0, lapseCount+1, dueAt === now (intervallo 0)', () => {
    const result = schedule(stateAt({ stage: 4, lapseCount: 2 }), 'again', NOW);
    expect(result.stage).toBe(0);
    expect(result.lapseCount).toBe(3);
    expect(result.dueAt.getTime()).toBe(NOW.getTime());
  });
});

describe('schedule: saturazione agli estremi senza rami speciali (AC3)', () => {
  it('easy che satura: stage 5 resta 5 (non 7), intervallo 35g', () => {
    const result = schedule(stateAt({ stage: 5 }), 'easy', NOW);
    expect(result.stage).toBe(5);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[5]); // 35g
  });

  it('easy oltre il tetto: stage 4 → clamp a 5, intervallo 35g', () => {
    const result = schedule(stateAt({ stage: 4 }), 'easy', NOW);
    expect(result.stage).toBe(5);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[5]); // 35g
  });

  it('again a stadio 0: resta 0, dueAt === now, senza rami speciali', () => {
    const result = schedule(stateAt({ stage: 0 }), 'again', NOW);
    expect(result.stage).toBe(0);
    expect(result.dueAt.getTime()).toBe(NOW.getTime());
  });

  it('hard a stadio 0: resta 0, dueAt === now, senza rami speciali', () => {
    const result = schedule(stateAt({ stage: 0 }), 'hard', NOW);
    expect(result.stage).toBe(0);
    expect(result.dueAt.getTime()).toBe(NOW.getTime());
  });
});

describe('schedule: contatori e ultimo ripasso', () => {
  it('reviewCount incrementa e lastReviewedAt = now su ogni esito', () => {
    for (const outcome of ['again', 'hard', 'good', 'easy'] as ReviewOutcome[]) {
      const result = schedule(stateAt({ stage: 2, reviewCount: 5 }), outcome, NOW);
      expect(result.reviewCount).toBe(6);
      expect(result.lastReviewedAt).not.toBeNull();
      expect(result.lastReviewedAt?.getTime()).toBe(NOW.getTime());
    }
  });

  it('lapseCount incrementa SOLO su again', () => {
    for (const outcome of ['hard', 'good', 'easy'] as ReviewOutcome[]) {
      const result = schedule(stateAt({ stage: 2, lapseCount: 4 }), outcome, NOW);
      expect(result.lapseCount).toBe(4);
    }
    const lapsed = schedule(stateAt({ stage: 2, lapseCount: 4 }), 'again', NOW);
    expect(lapsed.lapseCount).toBe(5);
  });
});

describe('schedule: purezza — nessuna mutazione dell input', () => {
  it('non muta lo stato passato (ritorna un nuovo oggetto)', () => {
    const input = stateAt({ stage: 2, reviewCount: 5, lapseCount: 1 });
    const snapshot: ReviewState = {
      exerciseId: input.exerciseId,
      stage: input.stage,
      dueAt: new Date(input.dueAt.getTime()),
      reviewCount: input.reviewCount,
      lapseCount: input.lapseCount,
      lastReviewedAt: input.lastReviewedAt,
    };
    const result = schedule(input, 'good', NOW);

    // Il risultato è un oggetto DIVERSO.
    expect(result).not.toBe(input);
    // Conserva l'identità stabile dell'input: `exerciseId` è la chiave su cui la
    // persistenza futura si aggancerà, quindi non deve mai cambiare (una
    // regressione tipo `exerciseId: ''` sarebbe altrimenti invisibile).
    expect(result.exerciseId).toBe(input.exerciseId);
    expect(result.exerciseId).toBe('ex-1');
    // L'input è rimasto identico allo snapshot.
    expect(input.stage).toBe(snapshot.stage);
    expect(input.reviewCount).toBe(snapshot.reviewCount);
    expect(input.lapseCount).toBe(snapshot.lapseCount);
    expect(input.dueAt.getTime()).toBe(snapshot.dueAt.getTime());
    expect(input.lastReviewedAt).toBe(snapshot.lastReviewedAt);
  });
});

describe('schedule: determinismo e dispersione delle scadenze (AC5)', () => {
  it('ricalcolo identico: stessa terna ⇒ stessa dueAt esatta', () => {
    const a = schedule(stateAt({ stage: 2 }), 'good', NOW);
    const b = schedule(stateAt({ stage: 2 }), 'good', NOW);
    expect(a.dueAt.getTime()).toBe(b.dueAt.getTime());
  });

  it('dispersione: due exerciseId diversi (stesso stage/now/outcome, intervallo > 0) ⇒ dueAt diversi', () => {
    const one = schedule(stateAt({ exerciseId: 'ex-A', stage: 2 }), 'good', NOW);
    const two = schedule(stateAt({ exerciseId: 'ex-B', stage: 2 }), 'good', NOW);
    // Stesso stadio risultante, stesso intervallo base: a distinguerli resta solo
    // l'exerciseId (AC5).
    expect(one.stage).toBe(two.stage);
    expect(one.dueAt.getTime()).not.toBe(two.dueAt.getTime());
  });

  it('dispersione deterministica: ricalcolo per lo stesso exerciseId dà date identiche', () => {
    const first = schedule(stateAt({ exerciseId: 'ex-A', stage: 2 }), 'good', NOW);
    const again = schedule(stateAt({ exerciseId: 'ex-A', stage: 2 }), 'good', NOW);
    expect(first.dueAt.getTime()).toBe(again.dueAt.getTime());
  });
});
