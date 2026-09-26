import { describe, expect, it } from 'vitest';
import {
  grammarPointErrorRates,
  type GrammarPointErrorRate,
} from './grammarPointErrorRates';
import type { ReviewLogRecord } from './streak';

// Copre la I/O & Edge-Case Matrix di 5.3: il tasso d'errore per PUNTO GRAMMATICALE,
// derivato dal SOLO log (AD-18). Aggrega per `grammarPoint` DEL LOG (denormalizzato),
// NON per `exerciseId`; errore = esito `again`; `errorRate = errors/total`. Ordine
// `errorRate` desc, poi `total` desc, poi `grammarPoint` asc. Pura, totale, SENZA
// tempo (nessun `now`/`timeZone`).

/** Una voce di log completa: esercizio, punto grammaticale, esito e istante. */
function rec(
  grammarPoint: string,
  outcome: ReviewLogRecord['outcome'],
  exerciseId = 'ex-1',
  iso = '2026-09-01T10:00:00.000Z',
): ReviewLogRecord {
  return { grammarPoint, outcome, exerciseId, reviewedAt: new Date(iso) };
}

/** Il tasso del punto `grammarPoint` in un elenco, o undefined se assente. */
function rateOf(
  rates: readonly GrammarPointErrorRate[],
  grammarPoint: string,
): GrammarPointErrorRate | undefined {
  return rates.find((r) => r.grammarPoint === grammarPoint);
}

describe('grammarPointErrorRates: aggregazione per punto grammaticale (Matrix)', () => {
  it('una voce per punto con { grammarPoint, total, errors, errorRate }', () => {
    const rates = grammarPointErrorRates([
      rec('te-form', 'again'),
      rec('te-form', 'good'),
      rec('particles', 'good'),
    ]);
    expect(rateOf(rates, 'te-form')).toEqual({
      grammarPoint: 'te-form',
      total: 2,
      errors: 1,
      errorRate: 0.5,
    });
    expect(rateOf(rates, 'particles')).toEqual({
      grammarPoint: 'particles',
      total: 1,
      errors: 0,
      errorRate: 0,
    });
  });

  it('stesso punto su DUE esercizi diversi ⇒ UNA sola voce (sopravvive alla riautorazione)', () => {
    // Due exerciseId diversi, STESSO grammarPoint: contano in una voce (per punto,
    // non per esercizio). Cio che rende la statistica resistente alla riautorazione.
    const rates = grammarPointErrorRates([
      rec('te-form', 'again', 'ex-A'),
      rec('te-form', 'good', 'ex-B'),
      rec('te-form', 'again', 'ex-B'),
    ]);
    const teForm = rates.filter((r) => r.grammarPoint === 'te-form');
    expect(teForm.length).toBe(1);
    expect(teForm[0]).toEqual({
      grammarPoint: 'te-form',
      total: 3,
      errors: 2,
      errorRate: 2 / 3,
    });
  });

  it('tutti `again` per un punto ⇒ errorRate 1', () => {
    const rates = grammarPointErrorRates([
      rec('te-form', 'again'),
      rec('te-form', 'again'),
    ]);
    expect(rateOf(rates, 'te-form')?.errorRate).toBe(1);
  });

  it('nessun `again` per un punto ⇒ errorRate 0 (la voce compare comunque)', () => {
    const rates = grammarPointErrorRates([
      rec('te-form', 'good'),
      rec('te-form', 'easy'),
    ]);
    expect(rateOf(rates, 'te-form')).toEqual({
      grammarPoint: 'te-form',
      total: 2,
      errors: 0,
      errorRate: 0,
    });
  });

  it('solo `again` conta come errore: hard/good/easy NON sono errori', () => {
    // Anti-vacuita: `hard` (esito non-`again`) NON gonfia gli errori.
    const rates = grammarPointErrorRates([
      rec('te-form', 'good'),
      rec('te-form', 'hard'),
      rec('te-form', 'easy'),
      rec('te-form', 'again'),
    ]);
    expect(rateOf(rates, 'te-form')).toEqual({
      grammarPoint: 'te-form',
      total: 4,
      errors: 1,
      errorRate: 0.25,
    });
  });
});

describe('grammarPointErrorRates: ordine e tie-break (Matrix)', () => {
  it('ordina per errorRate DECRESCENTE (i peggiori in cima)', () => {
    // A 2/2 (1.0), B 1/4 (0.25), C 0/3 (0.0) ⇒ [A, B, C] (esempio Design Notes).
    const rates = grammarPointErrorRates([
      rec('A', 'again'),
      rec('A', 'again'),
      rec('B', 'again'),
      rec('B', 'good'),
      rec('B', 'good'),
      rec('B', 'good'),
      rec('C', 'good'),
      rec('C', 'good'),
      rec('C', 'good'),
    ]);
    expect(rates.map((r) => r.grammarPoint)).toEqual(['A', 'B', 'C']);
  });

  it('pareggio sul tasso ⇒ tie-break: total desc, poi grammarPoint asc', () => {
    // Due punti a errorRate 0.5: `beta` con total 4 precede `alpha` con total 2.
    const rates = grammarPointErrorRates([
      rec('alpha', 'again'),
      rec('alpha', 'good'),
      rec('beta', 'again'),
      rec('beta', 'again'),
      rec('beta', 'good'),
      rec('beta', 'good'),
    ]);
    expect(rates.map((r) => r.grammarPoint)).toEqual(['beta', 'alpha']);
  });

  it('pareggio su tasso E total ⇒ grammarPoint ASC (deterministico)', () => {
    // Due punti a errorRate 0.5 e total 2: ordine alfabetico su grammarPoint.
    const rates = grammarPointErrorRates([
      rec('zebra', 'again'),
      rec('zebra', 'good'),
      rec('apple', 'again'),
      rec('apple', 'good'),
    ]);
    expect(rates.map((r) => r.grammarPoint)).toEqual(['apple', 'zebra']);
  });
});

describe('grammarPointErrorRates: log vuoto (Matrix)', () => {
  it('log vuoto ⇒ [] (nessuna voce; la vista rende il placeholder)', () => {
    expect(grammarPointErrorRates([])).toEqual([]);
  });
});

describe('grammarPointErrorRates: purezza, non-mutazione, determinismo', () => {
  it('non muta il log passato', () => {
    const log: readonly ReviewLogRecord[] = [
      rec('te-form', 'again', 'ex-1'),
      rec('particles', 'good', 'ex-2'),
    ];
    const snapshot = log.map((r) => ({ ...r }));
    grammarPointErrorRates(log);
    expect(log.map((r) => r.grammarPoint)).toEqual(
      snapshot.map((r) => r.grammarPoint),
    );
    expect(log.map((r) => r.outcome)).toEqual(snapshot.map((r) => r.outcome));
  });

  it('deterministica: stesso log ⇒ stessi tassi', () => {
    const log = [rec('te-form', 'again'), rec('particles', 'good')];
    expect(grammarPointErrorRates(log)).toEqual(grammarPointErrorRates(log));
  });

  it('senza tempo: la firma prende UN solo argomento (il tasso non dipende dall orologio)', () => {
    expect(grammarPointErrorRates.length).toBe(1);
  });

  it("l'ordine di arrivo delle voci e irrilevante (stesso multiset ⇒ stesso risultato)", () => {
    const a = grammarPointErrorRates([
      rec('A', 'again'),
      rec('B', 'good'),
      rec('A', 'good'),
    ]);
    const b = grammarPointErrorRates([
      rec('A', 'good'),
      rec('A', 'again'),
      rec('B', 'good'),
    ]);
    expect(b).toEqual(a);
  });
});

describe('grammarPointErrorRates: anti-vacuita', () => {
  it('un solo `good` per un punto NON produce un errore (errorRate 0, non > 0)', () => {
    const rates = grammarPointErrorRates([rec('te-form', 'good')]);
    expect(rateOf(rates, 'te-form')?.errors).toBe(0);
    expect(rateOf(rates, 'te-form')?.errorRate).toBe(0);
  });
});
