import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// AC1 — il contratto tastiera è REGISTRATO come aggiornamento di AD-15, non come
// convenzione locale. Stesso precedente di `i18n.test` per `docs/i18n-boundary.md`
// (AD-14): il documento è la fonte del contratto, un test ne verifica esistenza e
// punti. Ambiente `node` (vitest.config.ts): legge il file dal repoRoot.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const doc = readFileSync(
  resolve(repoRoot, 'docs/session-keyboard-contract.md'),
  'utf8',
);

describe('AC1 — il documento aggiorna e SOSTITUISCE AD-15', () => {
  it('dichiara di essere un aggiornamento di AD-15', () => {
    expect(doc).toMatch(/AD-15/);
  });

  it('dichiara di SOSTITUIRE il vecchio contratto («spazio rivela, 1-4 valutano»)', () => {
    expect(doc).toMatch(/sostitu/i);
    // Cita il vecchio contratto che rimpiazza (le cifre sono formattate come codice).
    expect(doc).toMatch(/spazio rivela/i);
    expect(doc).toMatch(/valutano/i);
  });
});

describe('AC1 — il documento dichiara i punti del contratto', () => {
  it('mappa tasto numerico → posizione, stessa associazione per ogni tipo (AC2)', () => {
    expect(doc).toMatch(/tasto numerico/i);
    expect(doc).toMatch(/posizione/i);
    // La funzione pura è agnostica al tipo che rende vera l'invariante.
    expect(doc).toMatch(/keyboardSelectionIndex/);
    expect(doc).toMatch(/agnostic/i);
  });

  it('dichiara il comportamento di overflow (AC3)', () => {
    expect(doc).toMatch(/overflow/i);
    // La fila numerica copre 1-9 (le cifre sono formattate come codice `1`-`9`).
    expect(doc).toMatch(/fila numerica/i);
    expect(doc).toMatch(/NUMERIC_ROW_SIZE/);
    expect(doc).toMatch(/no-op/i);
  });

  it('dichiara UNA sola live region aria-live="polite" (AC4)', () => {
    expect(doc).toMatch(/live region/i);
    expect(doc).toMatch(/aria-live="polite"/);
  });

  it('dichiara tab-order = ordine di lettura = ordine dei tasti numerici (AC5)', () => {
    expect(doc).toMatch(/tab-order/i);
    expect(doc).toMatch(/ordine di lettura/i);
  });

  it('dichiara l anello di focus visibile col token focus-ring (AC5)', () => {
    expect(doc).toMatch(/focus/i);
    expect(doc).toMatch(/focus-ring/);
  });

  it('dichiara Enter avanza / Esc esce', () => {
    expect(doc).toMatch(/Enter/);
    expect(doc).toMatch(/Esc/);
  });
});
