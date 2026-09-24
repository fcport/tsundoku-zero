import { describe, expect, it } from 'vitest';
import { outcomeOf } from './outcome';
import type { CheckOutcome } from './exercise';
import type { ReviewOutcome } from './schedule';

// Copre TUTTE E OTTO le righe della I/O Matrix della spec (Story 3.2): l'intero
// cubo booleano `correct × usedExplanation × declaredEasy`. La precedenza è
// fissa (`AD-24`): la scorrettezza domina (`again`), poi l'aiuto (`hard`), poi
// la dichiarazione «facile» (`easy` solo senza aiuto), altrimenti `good`.
// Verifica inoltre che l'input `CheckOutcome` non venga mutato e che l'esito
// appartenga sempre all'union.

/** L'insieme canonico dei valori dell'union, per l'assertion di appartenenza. */
const OUTCOMES: readonly ReviewOutcome[] = ['again', 'hard', 'good', 'easy'];

/**
 * Ogni riga della I/O Matrix: la terna d'input e l'esito atteso, con la nota
 * della spec che ne giustifica la precedenza.
 */
const CASES: ReadonlyArray<{
  correct: boolean;
  usedExplanation: boolean;
  declaredEasy: boolean;
  expected: ReviewOutcome;
  note: string;
}> = [
  { correct: false, usedExplanation: false, declaredEasy: false, expected: 'again', note: 'la scorrettezza domina' },
  { correct: false, usedExplanation: false, declaredEasy: true, expected: 'again', note: 'dichiarare «facile» non salva una risposta errata' },
  { correct: false, usedExplanation: true, declaredEasy: false, expected: 'again', note: 'la correttezza precede l\'aiuto' },
  { correct: false, usedExplanation: true, declaredEasy: true, expected: 'again', note: 'tutto subordinato alla scorrettezza' },
  { correct: true, usedExplanation: false, declaredEasy: false, expected: 'good', note: 'caso base' },
  { correct: true, usedExplanation: false, declaredEasy: true, expected: 'easy', note: 'unico caso easy' },
  { correct: true, usedExplanation: true, declaredEasy: false, expected: 'hard', note: 'l\'aiuto declassa a hard' },
  { correct: true, usedExplanation: true, declaredEasy: true, expected: 'hard', note: 'easy richiede «senza aiuto»: l\'aiuto vince' },
];

describe('outcomeOf: il cubo booleano della I/O Matrix (Story 3.2, AD-24)', () => {
  it('copre tutte e 8 le combinazioni (anti-vacuità)', () => {
    // Il cubo `2 × 2 × 2` ha esattamente 8 vertici: se ne mancasse uno la matrice
    // non sarebbe satura.
    expect(CASES).toHaveLength(8);
    const keys = new Set(
      CASES.map((c) => `${c.correct}:${c.usedExplanation}:${c.declaredEasy}`),
    );
    expect(keys.size).toBe(8);
  });

  for (const { correct, usedExplanation, declaredEasy, expected, note } of CASES) {
    it(`{correct:${correct}}, used:${usedExplanation}, declared:${declaredEasy} => ${expected} (${note})`, () => {
      const result = outcomeOf({ correct }, usedExplanation, declaredEasy);
      expect(result).toBe(expected);
      // L'esito appartiene SEMPRE all'union.
      expect(OUTCOMES).toContain(result);
    });
  }

  it('la scorrettezza domina: `again` per ogni combinazione di aiuto/dichiarazione', () => {
    // Riformula l'AC «`check.correct === false` => `again` indipendentemente da
    // `usedExplanation` e `declaredEasy`» come proprietà, non solo come righe.
    for (const usedExplanation of [false, true]) {
      for (const declaredEasy of [false, true]) {
        expect(outcomeOf({ correct: false }, usedExplanation, declaredEasy)).toBe('again');
      }
    }
  });

  it('corretta con aiuto: `hard`, anche se dichiarata «facile»', () => {
    expect(outcomeOf({ correct: true }, true, false)).toBe('hard');
    expect(outcomeOf({ correct: true }, true, true)).toBe('hard');
  });

  it('è pura: stessa terna => stesso esito, ripetutamente', () => {
    const first = outcomeOf({ correct: true }, false, true);
    const second = outcomeOf({ correct: true }, false, true);
    expect(second).toBe(first);
    expect(first).toBe('easy');
  });

  it('non muta il `CheckOutcome` d\'ingresso', () => {
    const check: CheckOutcome = { correct: true };
    const snapshot = { ...check };
    outcomeOf(check, true, true);
    expect(check).toEqual(snapshot);
    expect(check.correct).toBe(true);
  });
});
