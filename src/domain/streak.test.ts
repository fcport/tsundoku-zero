import { describe, expect, it } from 'vitest';
import { streak, type ReviewLogEntry } from './streak';

// I/O Matrix di `streak.ts` (Story 3.5, AD-18): lo streak SI CALCOLA dal solo
// `review_log`, non si memorizza. `streak(log, now, timeZone)` è pura, sincrona,
// totale, non muta il log e conta i giorni di CALENDARIO consecutivi (nel
// `timeZone` passato) con ≥1 risposta, a ritroso da un'ancora (oggi se ha
// attività, altrimenti ieri, altrimenti 0). Il confine di giornata è mezzanotte
// nel `timeZone` PASSATO.
//
// Fusi REALI: `Asia/Tokyo` (UTC+9, senza DST) per la maggior parte dei casi;
// `America/New_York` per un confine che attraversa una transizione DST.

const TOKYO = 'Asia/Tokyo'; // UTC+9 fisso: mezzanotte locale = 15:00 UTC del giorno prima.

/** Voce di log da un istante ISO, per leggibilità dei fixture. */
function entry(iso: string): ReviewLogEntry {
  return { reviewedAt: new Date(iso) };
}

describe('streak: giorni consecutivi con attività, contati dal solo log (AC2, AC5)', () => {
  // A Tokyo (UTC+9) il 24/09/2026 è il giorno locale che va da 2026-09-23T15:00Z
  // a 2026-09-24T15:00Z. Ancoriamo "now" a metà giornata locale.
  const now = new Date('2026-09-24T03:00:00.000Z'); // = 2026-09-24 12:00 a Tokyo.

  it('log vuoto ⇒ 0', () => {
    expect(streak([], now, TOKYO)).toBe(0);
  });

  it('solo oggi (1 risposta) ⇒ 1', () => {
    expect(streak([entry('2026-09-24T02:00:00.000Z')], now, TOKYO)).toBe(1);
  });

  it('catena consecutiva oggi + ieri + l’altroieri ⇒ 3', () => {
    const log = [
      entry('2026-09-24T02:00:00.000Z'), // oggi (24) a Tokyo
      entry('2026-09-23T02:00:00.000Z'), // ieri (23) a Tokyo
      entry('2026-09-22T02:00:00.000Z'), // l'altroieri (22) a Tokyo
    ];
    expect(streak(log, now, TOKYO)).toBe(3);
  });

  it('più risposte nello stesso giorno ⇒ il giorno conta una volta (1)', () => {
    const log = [
      entry('2026-09-24T00:30:00.000Z'), // 09:30 Tokyo, 24
      entry('2026-09-24T02:00:00.000Z'), // 11:00 Tokyo, 24
      entry('2026-09-24T05:00:00.000Z'), // 14:00 Tokyo, 24
    ];
    expect(streak(log, now, TOKYO)).toBe(1);
  });

  it('interruzione: risposte oggi e 3 giorni fa (buco ieri/l’altroieri) ⇒ 1', () => {
    const log = [
      entry('2026-09-24T02:00:00.000Z'), // oggi (24)
      entry('2026-09-21T02:00:00.000Z'), // 3 giorni fa (21)
    ];
    expect(streak(log, now, TOKYO)).toBe(1);
  });

  it('grazia: nessuna attività oggi, risposte ieri + l’altroieri ⇒ 2 (vivo fino a mezzanotte)', () => {
    const log = [
      entry('2026-09-23T02:00:00.000Z'), // ieri (23)
      entry('2026-09-22T02:00:00.000Z'), // l'altroieri (22)
    ];
    expect(streak(log, now, TOKYO)).toBe(2);
  });

  it('interrotto: ultima risposta 2 giorni fa (né oggi né ieri) ⇒ 0', () => {
    const log = [
      entry('2026-09-22T02:00:00.000Z'), // 2 giorni fa (22)
      entry('2026-09-21T02:00:00.000Z'), // 3 giorni fa (21)
    ];
    expect(streak(log, now, TOKYO)).toBe(0);
  });
});

describe('streak: il confine di giornata è mezzanotte nel timeZone passato (AC3)', () => {
  it('due risposte a cavallo di mezzanotte locale (Tokyo) ⇒ 2 giorni distinti', () => {
    // Mezzanotte Tokyo del 24/09 = 2026-09-23T15:00:00Z.
    const beforeMidnight = entry('2026-09-23T14:59:00.000Z'); // 23:59 Tokyo, 23
    const afterMidnight = entry('2026-09-23T15:01:00.000Z'); // 00:01 Tokyo, 24
    const now = new Date('2026-09-24T03:00:00.000Z'); // 12:00 Tokyo, 24
    expect(streak([beforeMidnight, afterMidnight], now, TOKYO)).toBe(2);
  });

  it('due risposte nello stesso giorno locale ma a cavallo di mezzanotte UTC ⇒ 1', () => {
    // A Tokyo il giorno 24 va da 2026-09-23T15:00Z a 2026-09-24T15:00Z: due istanti
    // a cavallo della mezzanotte UTC (23:59Z del 23 e 00:01Z del 24) cadono ENTRAMBI
    // nello stesso giorno locale 24, quindi contano una volta sola.
    const beforeUtcMidnight = entry('2026-09-23T23:59:00.000Z'); // 08:59 Tokyo, 24
    const afterUtcMidnight = entry('2026-09-24T00:01:00.000Z'); // 09:01 Tokyo, 24
    const now = new Date('2026-09-24T03:00:00.000Z'); // 12:00 Tokyo, 24
    expect(streak([beforeUtcMidnight, afterUtcMidnight], now, TOKYO)).toBe(1);
  });

  it('lo stesso istante UTC cade in giorni diversi con timeZone diversi', () => {
    // La STESSA coppia (log, now) deve produrre streak DIVERSI nei due fusi: sono
    // proprio i valori attesi (1 vs 2) a dimostrare che il bucketing avviene nel
    // `timeZone` PASSATO. Un'implementazione che ignorasse `timeZone` (bucketando
    // sempre in un fuso solo) non potrebbe far tornare entrambe le asserzioni.
    const now = new Date('2026-09-24T02:00:00.000Z'); // Tokyo: giorno 24 (11:00); NY EDT (UTC−4): giorno 23 (22:00)
    const r = entry('2026-09-24T02:00:00.000Z'); // Tokyo 24 / NY 23 — «oggi» in entrambi i fusi
    const s = entry('2026-09-22T10:00:00.000Z'); // Tokyo 22 (19:00) / NY 22 (06:00)

    // A Tokyo: giorni {24, 22}; dall'ancora 24 il giorno 23 manca ⇒ catena lunga 1.
    expect(streak([r, s], now, TOKYO)).toBe(1);

    // A New York: giorni {23, 22}; dall'ancora 23 il giorno 22 è consecutivo ⇒ 2.
    expect(streak([r, s], now, 'America/New_York')).toBe(2);
  });

  it('confine di mezzanotte attraverso una transizione DST (America/New_York)', () => {
    // Ora legale USA 2026: termina domenica 2026-11-01 alle 02:00 locali (gli
    // orologi tornano a 01:00). I giorni di CALENDARIO 10-31, 11-01, 11-02 restano
    // consecutivi malgrado il 11-01 duri 25 ore. Ancoriamo now al 11-02 locale.
    const now = new Date('2026-11-02T17:00:00.000Z'); // 12:00 EST (UTC−5) del 02, NY
    const log = [
      entry('2026-11-02T15:00:00.000Z'), // 10:00 EST del 02, NY
      entry('2026-11-01T15:00:00.000Z'), // 10:00 EST del 01, NY (giorno della transizione)
      entry('2026-10-31T14:00:00.000Z'), // 10:00 EDT (UTC−4) del 31, NY
    ];
    expect(streak(log, now, 'America/New_York')).toBe(3);
  });
});

describe('streak: purezza osservabile — ordine irrilevante, non-mutazione, determinismo (AC4, AC5)', () => {
  const now = new Date('2026-09-24T03:00:00.000Z'); // 12:00 Tokyo, 24
  const chain = [
    entry('2026-09-24T02:00:00.000Z'),
    entry('2026-09-23T02:00:00.000Z'),
    entry('2026-09-22T02:00:00.000Z'),
  ];

  it('l’ordine del log è irrilevante: stesse voci in ordine diverso ⇒ stesso numero', () => {
    const reversed = [...chain].reverse();
    expect(streak(reversed, now, TOKYO)).toBe(streak(chain, now, TOKYO));
    expect(streak(reversed, now, TOKYO)).toBe(3);
  });

  it('non muta il log passato (snapshot invariato)', () => {
    const log = [
      entry('2026-09-24T02:00:00.000Z'),
      entry('2026-09-23T02:00:00.000Z'),
    ];
    const snapshot = log.map((e) => e.reviewedAt.getTime());
    const lengthBefore = log.length;
    streak(log, now, TOKYO);
    expect(log.length).toBe(lengthBefore);
    expect(log.map((e) => e.reviewedAt.getTime())).toEqual(snapshot);
  });

  it('è deterministica: stessa terna due volte ⇒ risultati uguali', () => {
    expect(streak(chain, now, TOKYO)).toBe(streak(chain, now, TOKYO));
  });

  // Anti-vacuità: la suite è verde su casi con streak > 1 E con streak = 0, così
  // una funzione costante (sempre 0, o sempre un valore fisso) fallirebbe.
  it('anti-vacuità: verde sia con streak > 1 sia con streak = 0', () => {
    expect(streak(chain, now, TOKYO)).toBe(3);
    expect(streak([], now, TOKYO)).toBe(0);
    expect(streak([entry('2026-09-20T02:00:00.000Z')], now, TOKYO)).toBe(0);
  });
});
