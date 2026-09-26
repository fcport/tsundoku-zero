import { describe, expect, it } from 'vitest';
import { answersOverTime } from './answersOverTime';
import type { ReviewLogEntry } from './streak';

// I/O Matrix di `answersOverTime.ts` (Story 5.1, AD-18): le risposte per giorno di
// calendario SI CALCOLANO dal solo `review_log`, mai da `review_count`. La funzione
// è pura, sincrona, totale, non muta il log; bucketizza per giorno LOCALE (nel
// `timeZone` passato) e costruisce la serie CONTIGUA dal primo giorno con risposte
// fino a OGGI, con i giorni senza risposte a `count` 0. Log vuoto ⇒ `[]`.
//
// Fuso REALE: `Asia/Tokyo` (UTC+9, senza DST) — mezzanotte locale = 15:00 UTC del
// giorno prima. Coerente con `streak.test.ts`.

const TOKYO = 'Asia/Tokyo';

/** Voce di log da un istante ISO, per leggibilità dei fixture. */
function entry(iso: string): ReviewLogEntry {
  return { reviewedAt: new Date(iso) };
}

describe('answersOverTime: serie contigua per giorno dal solo log (AD-18)', () => {
  // A Tokyo il giorno locale del 24/09/2026 va da 2026-09-23T15:00Z a
  // 2026-09-24T15:00Z. Ancoriamo "now" a metà giornata locale del 24.
  const now = new Date('2026-09-24T03:00:00.000Z'); // = 2026-09-24 12:00 a Tokyo.

  it('log vuoto ⇒ []', () => {
    expect(answersOverTime([], now, TOKYO)).toEqual([]);
  });

  it('risposte su più giorni ⇒ un elemento per giorno, dal primo a oggi', () => {
    const log = [
      entry('2026-09-22T02:00:00.000Z'), // 11:00 Tokyo, 22
      entry('2026-09-23T02:00:00.000Z'), // 11:00 Tokyo, 23
      entry('2026-09-24T02:00:00.000Z'), // 11:00 Tokyo, 24
    ];
    expect(answersOverTime(log, now, TOKYO)).toEqual([
      { date: '2026-09-22', count: 1 },
      { date: '2026-09-23', count: 1 },
      { date: '2026-09-24', count: 1 },
    ]);
  });

  it('più risposte nello stesso giorno ⇒ un solo elemento con count = numero di voci', () => {
    const log = [
      entry('2026-09-24T00:30:00.000Z'), // 09:30 Tokyo, 24
      entry('2026-09-24T02:00:00.000Z'), // 11:00 Tokyo, 24
      entry('2026-09-24T05:00:00.000Z'), // 14:00 Tokyo, 24
    ];
    expect(answersOverTime(log, now, TOKYO)).toEqual([
      { date: '2026-09-24', count: 3 },
    ]);
  });

  it('giorni interni senza risposte compaiono con count 0 (contiguità)', () => {
    // Risposte il 21 e il 24; il 22 e il 23 sono buchi interni a 0.
    const log = [
      entry('2026-09-21T02:00:00.000Z'), // 21
      entry('2026-09-24T02:00:00.000Z'), // 24 (= oggi)
    ];
    expect(answersOverTime(log, now, TOKYO)).toEqual([
      { date: '2026-09-21', count: 1 },
      { date: '2026-09-22', count: 0 },
      { date: '2026-09-23', count: 0 },
      { date: '2026-09-24', count: 1 },
    ]);
  });

  it('ultima risposta nel passato ⇒ la serie si estende fino a oggi (code a 0)', () => {
    // Ultima risposta il 21; oggi è il 24: 22, 23, 24 compaiono a 0 (ritmo interrotto).
    const log = [entry('2026-09-21T02:00:00.000Z')];
    expect(answersOverTime(log, now, TOKYO)).toEqual([
      { date: '2026-09-21', count: 1 },
      { date: '2026-09-22', count: 0 },
      { date: '2026-09-23', count: 0 },
      { date: '2026-09-24', count: 0 },
    ]);
  });

  it('solo oggi ⇒ un solo elemento (nessuno zero iniziale)', () => {
    const log = [entry('2026-09-24T02:00:00.000Z')];
    expect(answersOverTime(log, now, TOKYO)).toEqual([
      { date: '2026-09-24', count: 1 },
    ]);
  });
});

describe('answersOverTime: il confine di giornata è mezzanotte nel timeZone passato', () => {
  it('due risposte a cavallo di mezzanotte locale (Tokyo) ⇒ due giorni distinti', () => {
    // Mezzanotte Tokyo del 24/09 = 2026-09-23T15:00:00Z.
    const beforeMidnight = entry('2026-09-23T14:59:00.000Z'); // 23:59 Tokyo, 23
    const afterMidnight = entry('2026-09-23T15:01:00.000Z'); // 00:01 Tokyo, 24
    const now = new Date('2026-09-24T03:00:00.000Z'); // 12:00 Tokyo, 24
    expect(answersOverTime([beforeMidnight, afterMidnight], now, TOKYO)).toEqual([
      { date: '2026-09-23', count: 1 },
      { date: '2026-09-24', count: 1 },
    ]);
  });

  it('lo stesso istante cade in giorni diversi con timeZone diversi', () => {
    // La STESSA coppia (log, now) deve produrre `date` DIVERSE nei due fusi: è
    // proprio la data del bucket a dimostrare che avviene nel `timeZone` PASSATO.
    const now = new Date('2026-09-24T02:00:00.000Z'); // Tokyo: 24 (11:00); NY EDT: 23 (22:00)
    const r = entry('2026-09-24T02:00:00.000Z');

    expect(answersOverTime([r], now, TOKYO)).toEqual([
      { date: '2026-09-24', count: 1 },
    ]);
    expect(answersOverTime([r], now, 'America/New_York')).toEqual([
      { date: '2026-09-23', count: 1 },
    ]);
  });
});

describe('answersOverTime: purezza osservabile — ordine irrilevante, non-mutazione, determinismo', () => {
  const now = new Date('2026-09-24T03:00:00.000Z'); // 12:00 Tokyo, 24
  const log = [
    entry('2026-09-24T02:00:00.000Z'),
    entry('2026-09-23T02:00:00.000Z'),
    entry('2026-09-22T02:00:00.000Z'),
  ];

  it('l’ordine del log è irrilevante: stesse voci in ordine diverso ⇒ stessa serie', () => {
    const reversed = [...log].reverse();
    expect(answersOverTime(reversed, now, TOKYO)).toEqual(
      answersOverTime(log, now, TOKYO),
    );
  });

  it('non muta il log passato (snapshot invariato)', () => {
    const snapshot = log.map((e) => e.reviewedAt.getTime());
    const lengthBefore = log.length;
    answersOverTime(log, now, TOKYO);
    expect(log.length).toBe(lengthBefore);
    expect(log.map((e) => e.reviewedAt.getTime())).toEqual(snapshot);
  });

  it('è deterministica: stessa terna due volte ⇒ serie uguali', () => {
    expect(answersOverTime(log, now, TOKYO)).toEqual(
      answersOverTime(log, now, TOKYO),
    );
  });

  // Anti-vacuità: verde su una serie con più giorni E con `[]`, così una funzione
  // costante (sempre `[]`, o sempre un valore fisso) fallirebbe.
  it('anti-vacuità: serie con più giorni e log vuoto ⇒ []', () => {
    expect(answersOverTime(log, now, TOKYO)).toHaveLength(3);
    expect(answersOverTime([], now, TOKYO)).toEqual([]);
  });
});
