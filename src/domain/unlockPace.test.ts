import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LESSONS_PER_DAY,
  LESSONS_PER_DAY_OPTIONS,
  dailyUnlockLimitReached,
  unlocksToday,
} from './unlockPace';

// I/O Matrix di `unlockPace.ts` (Story 3.17, FR6.5/FR6.6): il tetto giornaliero
// di sblocco. `unlocksToday(unlockedAt, now, timeZone)` conta gli istanti nel
// giorno LOCALE di `now`; `dailyUnlockLimitReached(...)` è `>= lessonsPerDay`.
// Entrambe PURE, sincrone, totali; `now`/`timeZone` sono parametri (AD-1). Il
// confine di giornata è mezzanotte nel `timeZone` PASSATO — copre transitivamente
// `calendarDay` (anche coperto da `streak.test.ts`).
//
// Fusi REALI: `Asia/Tokyo` (UTC+9, senza DST) per la maggior parte; `America/
// New_York` per un confine che attraversa una transizione DST.

const TOKYO = 'Asia/Tokyo';

/** Istante da ISO, per leggibilità dei fixture. */
function at(iso: string): Date {
  return new Date(iso);
}

describe('unlocksToday: conta gli sblocchi nel giorno locale di now (AD-1)', () => {
  // A Tokyo (UTC+9) il 24/09/2026 va da 2026-09-23T15:00Z a 2026-09-24T15:00Z.
  const now = at('2026-09-24T03:00:00.000Z'); // 12:00 Tokyo, 24

  it('lista vuota ⇒ 0', () => {
    expect(unlocksToday([], now, TOKYO)).toBe(0);
  });

  it('un solo sblocco oggi ⇒ 1', () => {
    expect(unlocksToday([at('2026-09-24T02:00:00.000Z')], now, TOKYO)).toBe(1);
  });

  it('due sblocchi oggi ⇒ 2', () => {
    const unlocked = [
      at('2026-09-24T00:30:00.000Z'), // 09:30 Tokyo, 24
      at('2026-09-24T05:00:00.000Z'), // 14:00 Tokyo, 24
    ];
    expect(unlocksToday(unlocked, now, TOKYO)).toBe(2);
  });

  it('sblocco di IERI (fuso locale) NON conta come oggi ⇒ 0', () => {
    // 2026-09-23T02:00Z = 11:00 Tokyo del 23 (ieri): fuori dal giorno di now.
    expect(unlocksToday([at('2026-09-23T02:00:00.000Z')], now, TOKYO)).toBe(0);
  });

  it('sblocco di DOMANI (fuso locale) NON conta ⇒ 0', () => {
    // 2026-09-24T16:00Z = 01:00 Tokyo del 25 (domani).
    expect(unlocksToday([at('2026-09-24T16:00:00.000Z')], now, TOKYO)).toBe(0);
  });

  it('mix oggi/ieri/domani ⇒ conta solo i due di oggi', () => {
    const unlocked = [
      at('2026-09-23T02:00:00.000Z'), // ieri
      at('2026-09-24T00:30:00.000Z'), // oggi
      at('2026-09-24T05:00:00.000Z'), // oggi
      at('2026-09-24T16:00:00.000Z'), // domani (01:00 Tokyo del 25)
    ];
    expect(unlocksToday(unlocked, now, TOKYO)).toBe(2);
  });

  it('il confine di giornata è mezzanotte nel timeZone PASSATO', () => {
    // Mezzanotte Tokyo del 24/09 = 2026-09-23T15:00Z. Due istanti a cavallo cadono
    // in giorni locali diversi (23 e 24): rispetto a now (24) ne conta uno solo.
    const beforeMidnight = at('2026-09-23T14:59:00.000Z'); // 23:59 Tokyo, 23
    const afterMidnight = at('2026-09-23T15:01:00.000Z'); // 00:01 Tokyo, 24
    expect(unlocksToday([beforeMidnight, afterMidnight], now, TOKYO)).toBe(1);
  });

  it('lo stesso istante conta in giorni diversi con timeZone diversi', () => {
    // La STESSA coppia (unlocked, now) produce conteggi diversi nei due fusi: prova
    // che il bucketing avviene nel timeZone PASSATO.
    const now2 = at('2026-09-24T02:00:00.000Z'); // Tokyo 24 (11:00); NY EDT 23 (22:00)
    const u = at('2026-09-24T02:00:00.000Z'); // «now» stesso istante

    expect(unlocksToday([u], now2, TOKYO)).toBe(1); // Tokyo: oggi (24)
    expect(unlocksToday([u], now2, 'America/New_York')).toBe(1); // NY: oggi (23)

    // Un istante che a NY è «ieri» ma a Tokyo è ancora «oggi».
    const v = at('2026-09-23T20:00:00.000Z'); // Tokyo 24 (05:00); NY 23 (16:00)
    expect(unlocksToday([v], now2, TOKYO)).toBe(1); // Tokyo: oggi (24)
    expect(unlocksToday([v], now2, 'America/New_York')).toBe(1); // NY: oggi (23)
  });

  it('confine di giornata attraverso una transizione DST (America/New_York)', () => {
    // Ora legale USA 2026: termina 2026-11-01 alle 02:00 locali. Il giorno di
    // calendario 11-01 dura 25 ore ma resta UN solo giorno locale.
    const now3 = at('2026-11-01T17:00:00.000Z'); // 12:00 EST del 01, NY
    const unlocked = [
      at('2026-11-01T06:00:00.000Z'), // 02:00 EDT→EST del 01, NY (stesso giorno)
      at('2026-11-01T16:00:00.000Z'), // 11:00 EST del 01, NY (stesso giorno)
      at('2026-10-31T18:00:00.000Z'), // 14:00 EDT del 31, NY (ieri)
    ];
    expect(unlocksToday(unlocked, now3, 'America/New_York')).toBe(2);
  });
});

describe('dailyUnlockLimitReached: unlocksToday >= lessonsPerDay (uguaglianza inclusa)', () => {
  const now = at('2026-09-24T03:00:00.000Z'); // 12:00 Tokyo, 24
  const oneToday = [at('2026-09-24T02:00:00.000Z')];
  const twoToday = [
    at('2026-09-24T00:30:00.000Z'),
    at('2026-09-24T05:00:00.000Z'),
  ];

  it('cap 1, nessuno sblocco oggi ⇒ non raggiunto', () => {
    expect(dailyUnlockLimitReached([], 1, now, TOKYO)).toBe(false);
  });

  it('cap 1, un solo sblocco oggi ⇒ raggiunto (uguaglianza)', () => {
    expect(dailyUnlockLimitReached(oneToday, 1, now, TOKYO)).toBe(true);
  });

  it('cap 3, due sblocchi oggi ⇒ NON raggiunto (2 < 3)', () => {
    expect(dailyUnlockLimitReached(twoToday, 3, now, TOKYO)).toBe(false);
  });

  it('cap 2, due sblocchi oggi ⇒ raggiunto (uguaglianza)', () => {
    expect(dailyUnlockLimitReached(twoToday, 2, now, TOKYO)).toBe(true);
  });

  it('cap 1, unico sblocco è di IERI ⇒ non raggiunto (il confine di giornata conta)', () => {
    expect(
      dailyUnlockLimitReached([at('2026-09-23T02:00:00.000Z')], 1, now, TOKYO),
    ).toBe(false);
  });
});

describe('LESSONS_PER_DAY_OPTIONS e DEFAULT: sanità del registro chiuso', () => {
  it('il default è 1 ed è fra le opzioni', () => {
    expect(DEFAULT_LESSONS_PER_DAY).toBe(1);
    expect(LESSONS_PER_DAY_OPTIONS).toContain(DEFAULT_LESSONS_PER_DAY);
  });

  it('ogni opzione è un intero >= 1 (l\'invariante del tetto è al confine)', () => {
    for (const v of LESSONS_PER_DAY_OPTIONS) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  it('le opzioni sono distinte e crescenti', () => {
    const arr = [...LESSONS_PER_DAY_OPTIONS];
    expect(new Set(arr).size).toBe(arr.length);
    expect([...arr].sort((a, b) => a - b)).toEqual(arr);
  });
});
