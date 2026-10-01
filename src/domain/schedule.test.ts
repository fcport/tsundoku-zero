import { describe, expect, it } from 'vitest';
import {
  LEITNER_INTERVALS_DAYS,
  nextStage,
  REVIEW_OUTCOMES,
  schedule,
  type ReviewOutcome,
  type ReviewState,
} from './schedule';
import { studyDayOrdinal, studyDayStart } from './calendarDay';

// Copre ogni riga della I/O Matrix della spec (Story 3.1): transizioni di stadio
// per i quattro esiti, saturazione a 5 con `easy`, reset a 0 con `again`, stadio 0
// stabile con intervallo 0, `hard` che tiene lo stadio riducendo l'intervallo,
// determinismo e dispersione delle scadenze. Una scadenza positiva cade sempre
// all'INIZIO di una giornata di studio (le 2 locali): il jitter è deterministico ma
// non noto a priori, quindi si pretende che `dueAt` sia l'inizio di uno dei giorni
// della FINESTRA `[base, base × (1 + DISPERSION_FRACTION)]` arrotondata; per
// l'intervallo 0 si pretende l'uguaglianza ESATTA `dueAt.getTime() === now.getTime()`.

/** Il fuso dello studente nei test: Roma, con ora legale e solare. */
const TZ = 'Europe/Rome';
// Deve combaciare con `DISPERSION_FRACTION` del modulo: la finestra attesa.
const DISPERSION_FRACTION = 0.25;

/** Istante di riferimento fisso (le 14 a Roma): il dominio non legge mai l'orologio (AD-1). */
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

/** L'ora locale (HH:MM) di un istante nel fuso dei test. */
function localTime(instant: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant);
}

/**
 * Verifica che `dueAt` sia l'inizio (le 2 locali) di una giornata di studio fra
 * `round(base)` e `round(base × (1 + DISPERSION))` giorni dopo quella di `now`, dove
 * `base = intervalDays × fattore`, mai prima del giorno dopo. Assorbe il jitter
 * deterministico senza doverne conoscere il valore esatto.
 */
function expectDueWindow(
  result: ReviewState,
  now: Date,
  intervalDays: number,
  factor = 1,
): void {
  const base = intervalDays * factor;
  const today = studyDayOrdinal(now, TZ);
  const allowed: number[] = [];
  for (
    let d = Math.max(1, Math.round(base));
    d <= Math.round(base * (1 + DISPERSION_FRACTION));
    d += 1
  ) {
    allowed.push(studyDayStart(today + d, TZ).getTime());
  }
  expect(allowed).toContain(result.dueAt.getTime());
  expect(localTime(result.dueAt)).toBe('02:00');
}

describe('schedule: transizioni di stadio per esito (AC2)', () => {
  it('good sotto il tetto: stage 2 → 3, intervallo 7g + jitter', () => {
    const result = schedule(stateAt({ stage: 2 }), 'good', NOW, TZ);
    expect(result.stage).toBe(3);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[3]); // 7g
  });

  it('easy sotto il tetto: stage 1 → 3, intervallo 7g + jitter', () => {
    const result = schedule(stateAt({ stage: 1 }), 'easy', NOW, TZ);
    expect(result.stage).toBe(3);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[3]); // 7g
  });

  it('hard a stadio medio: resta 3, intervallo 7g × 0.6 = 4.2g + jitter', () => {
    const result = schedule(stateAt({ stage: 3 }), 'hard', NOW, TZ);
    expect(result.stage).toBe(3);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[3], 0.6); // 4.2g
  });

  it('again da qualunque stadio: → 0, lapseCount+1, dueAt === now (intervallo 0)', () => {
    const result = schedule(stateAt({ stage: 4, lapseCount: 2 }), 'again', NOW, TZ);
    expect(result.stage).toBe(0);
    expect(result.lapseCount).toBe(3);
    expect(result.dueAt.getTime()).toBe(NOW.getTime());
  });
});

describe('schedule: saturazione agli estremi senza rami speciali (AC3)', () => {
  it('easy che satura: stage 5 resta 5 (non 7), intervallo 35g', () => {
    const result = schedule(stateAt({ stage: 5 }), 'easy', NOW, TZ);
    expect(result.stage).toBe(5);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[5]); // 35g
  });

  it('easy oltre il tetto: stage 4 → clamp a 5, intervallo 35g', () => {
    const result = schedule(stateAt({ stage: 4 }), 'easy', NOW, TZ);
    expect(result.stage).toBe(5);
    expectDueWindow(result, NOW, LEITNER_INTERVALS_DAYS[5]); // 35g
  });

  it('again a stadio 0: resta 0, dueAt === now, senza rami speciali', () => {
    const result = schedule(stateAt({ stage: 0 }), 'again', NOW, TZ);
    expect(result.stage).toBe(0);
    expect(result.dueAt.getTime()).toBe(NOW.getTime());
  });

  it('hard a stadio 0: resta 0, dueAt === now, senza rami speciali', () => {
    const result = schedule(stateAt({ stage: 0 }), 'hard', NOW, TZ);
    expect(result.stage).toBe(0);
    expect(result.dueAt.getTime()).toBe(NOW.getTime());
  });
});

describe('schedule: contatori e ultimo ripasso', () => {
  it('reviewCount incrementa e lastReviewedAt = now su ogni esito', () => {
    for (const outcome of ['again', 'hard', 'good', 'easy'] as ReviewOutcome[]) {
      const result = schedule(stateAt({ stage: 2, reviewCount: 5 }), outcome, NOW, TZ);
      expect(result.reviewCount).toBe(6);
      expect(result.lastReviewedAt).not.toBeNull();
      expect(result.lastReviewedAt?.getTime()).toBe(NOW.getTime());
    }
  });

  it('lapseCount incrementa SOLO su again', () => {
    for (const outcome of ['hard', 'good', 'easy'] as ReviewOutcome[]) {
      const result = schedule(stateAt({ stage: 2, lapseCount: 4 }), outcome, NOW, TZ);
      expect(result.lapseCount).toBe(4);
    }
    const lapsed = schedule(stateAt({ stage: 2, lapseCount: 4 }), 'again', NOW, TZ);
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
    const result = schedule(input, 'good', NOW, TZ);

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

describe('nextStage: la transizione di stadio pura e clampata (export 5.2)', () => {
  const MAX_STAGE = LEITNER_INTERVALS_DAYS.length - 1; // 5

  it('good avanza di 1 sotto il tetto', () => {
    expect(nextStage(2, 'good')).toBe(3);
  });

  it('easy avanza di 2 sotto il tetto', () => {
    expect(nextStage(1, 'easy')).toBe(3);
  });

  it('hard tiene lo stadio', () => {
    expect(nextStage(3, 'hard')).toBe(3);
  });

  it('again azzera da qualunque stadio', () => {
    expect(nextStage(4, 'again')).toBe(0);
    expect(nextStage(0, 'again')).toBe(0);
  });

  it('clamp in alto: easy oltre il tetto satura a MAX_STAGE (non 6/7)', () => {
    expect(nextStage(MAX_STAGE, 'easy')).toBe(MAX_STAGE);
    expect(nextStage(MAX_STAGE - 1, 'easy')).toBe(MAX_STAGE);
    expect(nextStage(MAX_STAGE, 'good')).toBe(MAX_STAGE);
  });

  it('clamp in basso: hard/again a stadio 0 restano 0 (mai negativi)', () => {
    expect(nextStage(0, 'hard')).toBe(0);
    expect(nextStage(0, 'again')).toBe(0);
  });

  it('coincide con lo `stage` risultante di `schedule` (unica transizione)', () => {
    for (const outcome of REVIEW_OUTCOMES) {
      for (let stage = 0; stage <= MAX_STAGE; stage += 1) {
        const scheduled = schedule(stateAt({ stage }), outcome, NOW, TZ);
        expect(scheduled.stage).toBe(nextStage(stage, outcome));
      }
    }
  });
});

describe('schedule: determinismo e dispersione delle scadenze (AC5)', () => {
  it('ricalcolo identico: stessa terna ⇒ stessa dueAt esatta', () => {
    const a = schedule(stateAt({ stage: 2 }), 'good', NOW, TZ);
    const b = schedule(stateAt({ stage: 2 }), 'good', NOW, TZ);
    expect(a.dueAt.getTime()).toBe(b.dueAt.getTime());
  });

  it('dispersione: sugli intervalli lunghi exerciseId diversi cadono su giorni diversi', () => {
    // Stesso stadio risultante (5, 35 giorni), stesso istante: a distinguerli resta
    // solo l'exerciseId (AC5), che sparge le scadenze su più giornate.
    const days = new Set(
      Array.from({ length: 20 }, (_, i) =>
        schedule(stateAt({ exerciseId: `ex-${i}`, stage: 4 }), 'good', NOW, TZ).dueAt.getTime(),
      ),
    );
    expect(days.size).toBeGreaterThan(1);
  });

  it('dispersione deterministica: ricalcolo per lo stesso exerciseId dà date identiche', () => {
    const first = schedule(stateAt({ exerciseId: 'ex-A', stage: 2 }), 'good', NOW, TZ);
    const again = schedule(stateAt({ exerciseId: 'ex-A', stage: 2 }), 'good', NOW, TZ);
    expect(first.dueAt.getTime()).toBe(again.dueAt.getTime());
  });
});

describe('schedule: la pila si riempie tutta alle 2 di notte', () => {
  it('risposte date a ore diverse dello stesso giorno tornano tutte alle 2 del giorno dopo', () => {
    const tomorrowAt2 = new Date('2026-09-25T00:00:00.000Z'); // 02:00 a Roma (ora legale)
    for (const at of ['2026-09-24T06:00:00.000Z', '2026-09-24T12:00:00.000Z', '2026-09-24T21:30:00.000Z']) {
      for (const exerciseId of ['ex-A', 'ex-B', 'ex-C']) {
        const result = schedule(stateAt({ exerciseId }), 'good', new Date(at), TZ);
        expect(result.dueAt.getTime()).toBe(tomorrowAt2.getTime());
      }
    }
  });

  it("all'una di notte si è ancora nel giorno prima: torna alle 2, un'ora dopo", () => {
    const at1 = new Date('2026-09-24T23:00:00.000Z'); // 01:00 del 25 a Roma
    const result = schedule(stateAt(), 'good', at1, TZ);
    expect(result.dueAt.toISOString()).toBe('2026-09-25T00:00:00.000Z');
  });

  it('alle 2 in punto comincia il giorno nuovo: torna alle 2 del giorno dopo', () => {
    const at2 = new Date('2026-09-25T00:00:00.000Z'); // 02:00 del 25 a Roma
    const result = schedule(stateAt(), 'good', at2, TZ);
    expect(result.dueAt.toISOString()).toBe('2026-09-26T00:00:00.000Z');
  });

  it("hard a stadio 1 (0,6 giorni) non torna nella stessa giornata", () => {
    const result = schedule(stateAt({ stage: 1 }), 'hard', NOW, TZ);
    expect(result.dueAt.toISOString()).toBe('2026-09-25T00:00:00.000Z');
  });

  it("col cambio all'ora solare le 2 restano le 2 (01:00 UTC d'inverno)", () => {
    // A Roma l'ora legale finisce il 25-10-2026.
    const result = schedule(stateAt(), 'good', new Date('2026-10-25T12:00:00.000Z'), TZ);
    expect(result.dueAt.toISOString()).toBe('2026-10-26T01:00:00.000Z');
    expect(localTime(result.dueAt)).toBe('02:00');
  });

  it("il giorno in cui le 2 non esistono (fine marzo) cade alle 3", () => {
    // Il 28-03-2027 a Roma si passa dalle 02:00 alle 03:00.
    const result = schedule(stateAt(), 'good', new Date('2027-03-27T13:00:00.000Z'), TZ);
    expect(result.dueAt.toISOString()).toBe('2027-03-28T01:00:00.000Z');
    expect(localTime(result.dueAt)).toBe('03:00');
  });

  it('vale nel fuso dello studente, non in quello di Roma', () => {
    const ny = 'America/New_York';
    const result = schedule(stateAt(), 'good', new Date('2026-09-24T16:00:00.000Z'), ny);
    expect(result.dueAt.toISOString()).toBe('2026-09-25T06:00:00.000Z'); // 02:00 a New York
  });
});
