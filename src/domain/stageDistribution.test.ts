import { describe, expect, it } from 'vitest';
import { stageDistribution, type StageCount } from './stageDistribution';
import { LEITNER_INTERVALS_DAYS } from './schedule';
import type { ReviewLogRecord } from './streak';

// Copre la I/O & Edge-Case Matrix di 5.2: la distribuzione degli esercizi per
// stadio, derivata dal SOLO log (AD-18). Lo stadio finale di un esercizio si
// RICOSTRUISCE rigiocando i suoi esiti (in ordine di reviewedAt crescente) dallo
// stadio 0 via l'unica transizione del motore (`nextStage`). L'asse ha ESATTAMENTE
// gli stadi 0..N-1 (N = LEITNER_INTERVALS_DAYS.length, sei), contiguo, zeri inclusi.
// Pura, totale, SENZA tempo (nessun `now`/`timeZone`).

const N = LEITNER_INTERVALS_DAYS.length; // 6

/** Una voce di log completa: esercizio, esito e istante. */
function rec(
  exerciseId: string,
  outcome: ReviewLogRecord['outcome'],
  iso: string,
): ReviewLogRecord {
  return { exerciseId, outcome, reviewedAt: new Date(iso) };
}

/** Il conteggio del bucket `stage` in una distribuzione. */
function countAt(dist: readonly StageCount[], stage: number): number {
  return dist.find((s) => s.stage === stage)?.count ?? -1;
}

describe('stageDistribution: asse dei sei stadi derivato dalla scala (AC)', () => {
  it('log NON vuoto ⇒ un StageCount per OGNI stadio 0..N-1, contiguo', () => {
    const dist = stageDistribution([rec('ex-1', 'good', '2026-09-01T10:00:00.000Z')]);
    expect(dist.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(dist.length).toBe(N);
  });

  it('gli stadi senza esercizi compaiono con count 0 (zeri inclusi)', () => {
    // Un solo esercizio, un solo `good` ⇒ stadio finale 1: gli altri stadi a 0.
    const dist = stageDistribution([rec('ex-1', 'good', '2026-09-01T10:00:00.000Z')]);
    expect(countAt(dist, 1)).toBe(1);
    expect(countAt(dist, 0)).toBe(0);
    expect(countAt(dist, 2)).toBe(0);
    expect(countAt(dist, 5)).toBe(0);
  });

  it("l'asse deriva da LEITNER_INTERVALS_DAYS.length, non da un elenco parallelo", () => {
    const dist = stageDistribution([rec('ex-1', 'good', '2026-09-01T10:00:00.000Z')]);
    // L'ultimo stadio dell'asse e length-1: se la scala cambiasse, l'asse la segue.
    expect(dist[dist.length - 1]?.stage).toBe(LEITNER_INTERVALS_DAYS.length - 1);
  });
});

describe('stageDistribution: esercizi a stadi diversi (Matrix)', () => {
  it('conta gli esercizi per stadio finale', () => {
    const dist = stageDistribution([
      // ex-A: good ⇒ stadio 1.
      rec('ex-A', 'good', '2026-09-01T10:00:00.000Z'),
      // ex-B: good, good ⇒ stadio 2.
      rec('ex-B', 'good', '2026-09-01T10:00:00.000Z'),
      rec('ex-B', 'good', '2026-09-02T10:00:00.000Z'),
      // ex-C: easy ⇒ stadio 2.
      rec('ex-C', 'easy', '2026-09-01T10:00:00.000Z'),
    ]);
    expect(countAt(dist, 1)).toBe(1); // ex-A
    expect(countAt(dist, 2)).toBe(2); // ex-B, ex-C
    expect(countAt(dist, 0)).toBe(0);
  });
});

describe('stageDistribution: un esercizio con piu risposte conta UNA volta (Matrix)', () => {
  it('conta una sola volta, allo stadio finale della fold cronologica', () => {
    const dist = stageDistribution([
      rec('ex-1', 'good', '2026-09-01T10:00:00.000Z'), // 0 -> 1
      rec('ex-1', 'good', '2026-09-02T10:00:00.000Z'), // 1 -> 2
      rec('ex-1', 'good', '2026-09-03T10:00:00.000Z'), // 2 -> 3
    ]);
    // Un solo esercizio nel totale, allo stadio 3.
    const total = dist.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(1);
    expect(countAt(dist, 3)).toBe(1);
  });

  it('esempio delle Design Notes: [good, good, again, good] ⇒ stadio finale 1', () => {
    const dist = stageDistribution([
      rec('ex-1', 'good', '2026-09-01T10:00:00.000Z'), // 0 -> 1
      rec('ex-1', 'good', '2026-09-02T10:00:00.000Z'), // 1 -> 2
      rec('ex-1', 'again', '2026-09-03T10:00:00.000Z'), // 2 -> 0
      rec('ex-1', 'good', '2026-09-04T10:00:00.000Z'), // 0 -> 1
    ]);
    expect(countAt(dist, 1)).toBe(1);
    expect(dist.reduce((sum, s) => sum + s.count, 0)).toBe(1);
  });

  it('hard in mezzo TIENE lo stadio: [good, hard, good] ⇒ stadio finale 2', () => {
    // Esercita il quarto esito della Matrix (`hard`): distingue `hard` (tiene) sia
    // da `good` (che darebbe 3) sia da `again` (che darebbe 0).
    const dist = stageDistribution([
      rec('ex-1', 'good', '2026-09-01T10:00:00.000Z'), // 0 -> 1
      rec('ex-1', 'hard', '2026-09-02T10:00:00.000Z'), // 1 -> 1 (tiene)
      rec('ex-1', 'good', '2026-09-03T10:00:00.000Z'), // 1 -> 2
    ]);
    expect(countAt(dist, 2)).toBe(1);
    expect(dist.reduce((sum, s) => sum + s.count, 0)).toBe(1);
  });
});

describe('stageDistribution: again resetta lo stadio (Matrix)', () => {
  it('[good, good, again] ⇒ stadio finale 0', () => {
    const dist = stageDistribution([
      rec('ex-1', 'good', '2026-09-01T10:00:00.000Z'), // 0 -> 1
      rec('ex-1', 'good', '2026-09-02T10:00:00.000Z'), // 1 -> 2
      rec('ex-1', 'again', '2026-09-03T10:00:00.000Z'), // 2 -> 0
    ]);
    expect(countAt(dist, 0)).toBe(1);
    expect(dist.reduce((sum, s) => sum + s.count, 0)).toBe(1);
  });
});

describe('stageDistribution: saturazione, clamp a N-1 (Matrix)', () => {
  it('molti easy/good oltre lo stadio massimo ⇒ bucket N-1, mai un bucket N', () => {
    const dist = stageDistribution([
      rec('ex-1', 'easy', '2026-09-01T10:00:00.000Z'), // 0 -> 2
      rec('ex-1', 'easy', '2026-09-02T10:00:00.000Z'), // 2 -> 4
      rec('ex-1', 'easy', '2026-09-03T10:00:00.000Z'), // 4 -> 5 (clamp)
      rec('ex-1', 'easy', '2026-09-04T10:00:00.000Z'), // 5 -> 5 (clamp)
      rec('ex-1', 'good', '2026-09-05T10:00:00.000Z'), // 5 -> 5 (clamp)
    ]);
    expect(countAt(dist, N - 1)).toBe(1);
    // Nessun bucket oltre N-1.
    expect(dist.some((s) => s.stage >= N)).toBe(false);
    expect(dist.length).toBe(N);
  });
});

describe('stageDistribution: ordine di input irrilevante (Matrix)', () => {
  it('stesse voci in ordine sparso ⇒ stessa distribuzione (fold per reviewedAt)', () => {
    const ordered = stageDistribution([
      rec('ex-1', 'good', '2026-09-01T10:00:00.000Z'), // 0 -> 1
      rec('ex-1', 'good', '2026-09-02T10:00:00.000Z'), // 1 -> 2
      rec('ex-1', 'again', '2026-09-03T10:00:00.000Z'), // 2 -> 0
    ]);
    const shuffled = stageDistribution([
      rec('ex-1', 'again', '2026-09-03T10:00:00.000Z'),
      rec('ex-1', 'good', '2026-09-01T10:00:00.000Z'),
      rec('ex-1', 'good', '2026-09-02T10:00:00.000Z'),
    ]);
    expect(shuffled).toEqual(ordered);
    // La fold e per reviewedAt: l'ultima risposta e `again` ⇒ stadio 0.
    expect(countAt(shuffled, 0)).toBe(1);
  });
});

describe('stageDistribution: log vuoto (Matrix)', () => {
  it('log vuoto ⇒ [] (nessun asse; la vista rende il placeholder)', () => {
    expect(stageDistribution([])).toEqual([]);
  });
});

describe('stageDistribution: purezza, non-mutazione, determinismo', () => {
  it('non muta il log passato', () => {
    const log: readonly ReviewLogRecord[] = [
      rec('ex-1', 'good', '2026-09-02T10:00:00.000Z'),
      rec('ex-1', 'good', '2026-09-01T10:00:00.000Z'),
    ];
    const snapshot = log.map((r) => ({ ...r }));
    stageDistribution(log);
    // L'input e rimasto identico (nessun sort in-place della lista passata).
    expect(log.map((r) => r.reviewedAt.getTime())).toEqual(
      snapshot.map((r) => r.reviewedAt.getTime()),
    );
    expect(log.map((r) => r.exerciseId)).toEqual(snapshot.map((r) => r.exerciseId));
  });

  it('deterministica: stesso log ⇒ stessa distribuzione', () => {
    const log = [
      rec('ex-1', 'good', '2026-09-01T10:00:00.000Z'),
      rec('ex-2', 'easy', '2026-09-01T10:00:00.000Z'),
    ];
    expect(stageDistribution(log)).toEqual(stageDistribution(log));
  });

  it('senza tempo: la firma prende UN solo argomento (lo stadio non dipende dall orologio)', () => {
    expect(stageDistribution.length).toBe(1);
  });
});

describe('stageDistribution: anti-vacuita', () => {
  it('un good da stadio 0 NON finisce nel bucket 0 (transizione applicata davvero)', () => {
    const dist = stageDistribution([rec('ex-1', 'good', '2026-09-01T10:00:00.000Z')]);
    expect(countAt(dist, 0)).toBe(0);
    expect(countAt(dist, 1)).toBe(1);
  });
});
