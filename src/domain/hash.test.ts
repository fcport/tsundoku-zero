import { describe, expect, it } from 'vitest';
import { fnv1a } from './hash';

// L'hash estratto da `schedule.ts` (refactor puro): determinismo, dispersione fra
// stringhe diverse, la stringa vuota (offset basis FNV) e un vettore PINNATO — se
// l'implementazione regredisse, la dispersione delle scadenze e l'ordine delle
// opzioni cambierebbero silenziosamente, quindi il pin li protegge entrambi.

describe('fnv1a — hash deterministico condiviso (AD estrazione)', () => {
  it('stessa stringa ⇒ stesso valore (determinismo)', () => {
    expect(fnv1a('te-form:0:choice')).toBe(fnv1a('te-form:0:choice'));
    expect(fnv1a('')).toBe(fnv1a(''));
  });

  it('stringhe diverse ⇒ (in genere) valori diversi', () => {
    expect(fnv1a('a')).not.toBe(fnv1a('b'));
    expect(fnv1a('option-1')).not.toBe(fnv1a('option-2'));
  });

  it('la stringa vuota ⇒ l offset basis FNV (0x811c9dc5)', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('')).toBe(2166136261);
  });

  it('ritorna sempre un intero non segnato a 32 bit', () => {
    for (const s of ['', 'a', 'hello', 'te-form:0', 'アイウ']) {
      const h = fnv1a(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('vettore PINNATO: valore atteso per una stringa nota', () => {
    // Pin: una regressione dell implementazione romperebbe questo prima di
    // riscrivere silenziosamente dispersione e ordine opzioni.
    expect(fnv1a('hello')).toBe(1335831723);
  });
});
