import { describe, expect, it } from 'vitest';
import { NUMERIC_ROW_SIZE, keyboardSelectionIndex } from './keyboard';

// La mappa PURA tasto→posizione del contratto tastiera (AC2/AC3). Copre ogni riga
// della I/O & Edge-Case Matrix pura: in-range, overflow, non-selettori, oltre la
// fila numerica. La funzione è agnostica al tipo (nessun `Exercise` in firma): la
// STESSA associazione vale per single-select/select-span/assemble, per costruzione.

describe('NUMERIC_ROW_SIZE — la fila copre nove posizioni (AC3)', () => {
  it('vale 9', () => {
    expect(NUMERIC_ROW_SIZE).toBe(9);
  });
});

describe('keyboardSelectionIndex — tasto in range ⇒ posizione (AC2)', () => {
  it("'1' ⇒ indice 0 (posizione 1)", () => {
    expect(keyboardSelectionIndex('1', 4)).toBe(0);
  });

  it("'2' con optionCount=4 ⇒ indice 1 (posizione 2)", () => {
    expect(keyboardSelectionIndex('2', 4)).toBe(1);
  });

  it("'9' con nove opzioni ⇒ indice 8 (ultima della fila)", () => {
    expect(keyboardSelectionIndex('9', 9)).toBe(8);
  });

  it('mappa ogni cifra 1-9 al proprio indice quando le opzioni bastano', () => {
    for (let i = 0; i < NUMERIC_ROW_SIZE; i++) {
      const key = String(i + 1);
      expect(keyboardSelectionIndex(key, NUMERIC_ROW_SIZE)).toBe(i);
    }
  });
});

describe("keyboardSelectionIndex — agnostica al tipo: STESSA associazione ovunque (AC2)", () => {
  it("l'associazione dipende SOLO da (key, optionCount), non dal tipo", () => {
    // La firma non accetta un tipo di esercizio: single-select con 4 opzioni,
    // select-span con 4 segmenti e assemble con 4 tessere danno lo STESSO indice.
    expect(keyboardSelectionIndex('3', 4)).toBe(2);
    // Ripetuta con lo stesso conteggio: identica (nessun ramo per kind).
    expect(keyboardSelectionIndex('3', 4)).toBe(keyboardSelectionIndex('3', 4));
  });
});

describe('keyboardSelectionIndex — overflow dichiarato (AC3)', () => {
  it("cifra senza opzione ('4' con optionCount=3) ⇒ null (no-op)", () => {
    expect(keyboardSelectionIndex('4', 3)).toBeNull();
  });

  it('oltre la fila numerica: optionCount=12 ⇒ indici 0-8 da tasto, mai 9-11', () => {
    // Le posizioni 1-9 restano selezionabili da tasto...
    expect(keyboardSelectionIndex('9', 12)).toBe(8);
    // ...ma non esiste tasto per gli indici >= 9 (raggiungibili solo con Tab): la
    // cifra più alta è '9', già mappata a 8.
    expect(keyboardSelectionIndex('0', 12)).toBeNull();
  });
});

describe('keyboardSelectionIndex — tasti non selettori ⇒ null', () => {
  it("'0' ⇒ null (non è la posizione 1, la fila parte da '1')", () => {
    expect(keyboardSelectionIndex('0', 4)).toBeNull();
  });

  it("una lettera ('a') ⇒ null", () => {
    expect(keyboardSelectionIndex('a', 4)).toBeNull();
  });

  it("un tasto multi-carattere ('Enter') ⇒ null", () => {
    expect(keyboardSelectionIndex('Enter', 4)).toBeNull();
  });

  it('la stringa vuota ⇒ null', () => {
    expect(keyboardSelectionIndex('', 4)).toBeNull();
  });

  it("nessuna opzione (optionCount=0) ⇒ null anche per '1'", () => {
    expect(keyboardSelectionIndex('1', 0)).toBeNull();
  });
});

describe('keyboardSelectionIndex — anti-vacuità', () => {
  it('esiste almeno un caso che ritorna un indice e almeno uno che ritorna null', () => {
    // Se la funzione ritornasse sempre lo stesso valore, i test sopra sarebbero
    // vacui: questa asserzione lega esplicitamente i due esiti.
    expect(keyboardSelectionIndex('1', 4)).not.toBeNull();
    expect(keyboardSelectionIndex('z', 4)).toBeNull();
  });
});
