import { describe, expect, it } from 'vitest';
import { systemClock } from './clock';

// Riga «Clock.now | systemClock | a Date (new Date())» della I/O & Edge-Case
// Matrix (storia 3.10). L'adattatore di produzione della porta `Clock` legge
// l'orologio di piattaforma: `new Date()` è ammesso qui (src/data), vietato solo
// sotto src/domain. Un test di dominio inietta invece un clock con `now()` fisso.

describe('systemClock — adattatore di produzione della porta Clock', () => {
  it('now() ritorna una Date', () => {
    expect(systemClock.now()).toBeInstanceOf(Date);
  });

  it('now() rispecchia l’istante corrente (entro una finestra ampia)', () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    const after = Date.now();
    // Legge l'orologio VIVO, non una costante: cade fra le due letture di
    // confine. Finestra ampia: prova che è tempo corrente, non un valore fisso.
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });

  it('due letture successive non tornano indietro nel tempo', () => {
    const first = systemClock.now().getTime();
    const second = systemClock.now().getTime();
    expect(second).toBeGreaterThanOrEqual(first);
  });
});
