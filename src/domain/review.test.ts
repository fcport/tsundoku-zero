import { describe, expect, it } from 'vitest';
import { evaluateAnswer } from './review';
import { answerOptions } from './exercise-presentation';
import { isDue } from './due';
import type { ReviewState } from './schedule';
import type { Exercise } from './exercise';

// Pipeline di valutazione (3.19, AD-24): l'esito si calcola SUL CLIENT con le
// funzioni pure già testate. `evaluateAnswer` le compone: compose→check→outcomeOf→
// schedule. I `result` portano `stage`/`dueAt` dallo scheduler REALE, così la
// direzione (avanza / resta) è quella vera del motore. `declaredEasy` è hard-wired
// `false` dentro la funzione (nessun controllo «facile» in Epic 3).

const NOW = new Date('2026-09-24T12:00:00.000Z');

const singleSelect: Exercise = {
  kind: 'single-select',
  grammarPoint: 'wa-particle',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['を', 'が', 'に'],
  explanation: { en: 'The topic particle.' },
};

/** Stato di ripasso FRESCO a stadio 0 per l'esercizio corrente. */
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

/** Gli indici (nella pila) che compongono la risposta corretta / una errata. */
function correctIndex(exercise: Exercise): number {
  return answerOptions(exercise).indexOf('は');
}
function wrongIndex(exercise: Exercise): number {
  return answerOptions(exercise).findIndex((o) => o !== 'は');
}

describe('evaluateAnswer: corretta senza consulto ⇒ good, stadio avanzato', () => {
  it('correct true, outcome good, result.stage > current e da schedule', () => {
    const current = stage0('ex-1');
    const evaluation = evaluateAnswer(
      singleSelect,
      [correctIndex(singleSelect)],
      false,
      current,
      NOW,
    );
    expect(evaluation.correct).toBe(true);
    expect(evaluation.outcome).toBe('good');
    // good a stadio 0 ⇒ stadio 1 (avanzato).
    expect(evaluation.result.stage).toBe(1);
    // result porta dueAt/stage dallo scheduler: dueAt > now (intervallo > 0).
    expect(evaluation.result.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(isDue(evaluation.result, NOW)).toBe(false);
  });
});

describe('evaluateAnswer: corretta con consulto ⇒ hard', () => {
  it('usedExplanation true ⇒ outcome hard', () => {
    const evaluation = evaluateAnswer(
      singleSelect,
      [correctIndex(singleSelect)],
      true,
      stage0('ex-1'),
      NOW,
    );
    expect(evaluation.correct).toBe(true);
    expect(evaluation.outcome).toBe('hard');
  });
});

describe('evaluateAnswer: errata ⇒ again, stadio 0, riaccodo', () => {
  it('correct false, outcome again, result.stage 0 e isDue(result, now) vero', () => {
    const evaluation = evaluateAnswer(
      singleSelect,
      [wrongIndex(singleSelect)],
      false,
      stage0('ex-1'),
      NOW,
    );
    expect(evaluation.correct).toBe(false);
    expect(evaluation.outcome).toBe('again');
    expect(evaluation.result.stage).toBe(0);
    // again ⇒ intervallo 0 ⇒ dueAt === now ⇒ ancora dovuto (riaccodo).
    expect(isDue(evaluation.result, NOW)).toBe(true);
  });
});

describe('evaluateAnswer: purezza e determinismo', () => {
  it('non muta lo stato corrente passato', () => {
    const current = stage0('ex-1');
    const snapshotStage = current.stage;
    evaluateAnswer(singleSelect, [correctIndex(singleSelect)], false, current, NOW);
    expect(current.stage).toBe(snapshotStage);
  });

  it('stessa quintupla ⇒ stesso risultato per valore', () => {
    const args = [singleSelect, [correctIndex(singleSelect)], false, stage0('ex-1'), NOW] as const;
    const a = evaluateAnswer(...args);
    const b = evaluateAnswer(...args);
    expect(a.correct).toBe(b.correct);
    expect(a.outcome).toBe(b.outcome);
    expect(a.result).toEqual(b.result);
  });
});
