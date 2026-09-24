import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { streak } from './streak';

// Sonda MECCANICA sul SORGENTE di `streak.ts`, modellata su
// `schedule-purity.test.ts` (AD-1, purezza del dominio, AC1 di 3.5). Estende la
// famiglia di sonde ai COSTRUTTI TEMPORALI: `no-restricted-globals` in
// eslint.config.js copre `fetch`/storage ma NON `Date.now`, `new Date()`,
// `Intl.DateTimeFormat().resolvedOptions()` né `Math.random`. Perciò questa sonda
// legge il codice (commenti rimossi) e pretende che quei costrutti non compaiano:
// sia l'istante `now` sia il `timeZone` devono ENTRARE come parametri. Nota:
// `Intl.DateTimeFormat({ timeZone })` con fuso ESPLICITO è LEGITTIMO — è solo
// `resolvedOptions()` (che leggerebbe il fuso ambientale) a essere vietato.

const __dirname = dirname(fileURLToPath(import.meta.url));
const streakSource = resolve(__dirname, 'streak.ts');

/**
 * Rimuove i commenti di riga e di blocco, così la sonda controlla il CODICE, non
 * la prosa: una menzione di `Date.now()` in un commento che spiega perché è
 * vietato non è una violazione, un suo USO sì. Identica alla famiglia di sonde.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('purezza temporale di streak.ts (AC1, AD-1)', () => {
  // Guardia anti-vacuità: se il file non si leggesse (path errato, spostamento),
  // la sonda passerebbe senza aver verificato nulla. Pretendiamo di averlo trovato
  // e con contenuto non vuoto.
  const raw = readFileSync(streakSource, 'utf8');
  it('trova il sorgente di streak.ts (anti-vacuità)', () => {
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).toContain('export function streak');
  });

  const code = stripComments(raw);

  it('non usa fetch(', () => {
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
  });

  it('non usa Date.now(', () => {
    expect(/Date\s*\.\s*now\s*\(/.test(code)).toBe(false);
  });

  it('non usa new Date() senza argomenti (parentesi vuote)', () => {
    expect(/new\s+Date\s*\(\s*\)/.test(code)).toBe(false);
  });

  it('non usa Intl.DateTimeFormat().resolvedOptions(', () => {
    expect(/Intl\s*\.\s*DateTimeFormat\s*\([^)]*\)\s*\.\s*resolvedOptions\s*\(/.test(code)).toBe(
      false,
    );
  });

  it('non usa Math.random', () => {
    expect(/Math\s*\.\s*random/.test(code)).toBe(false);
  });

  it('non usa getTimezoneOffset(', () => {
    // Lettura canonica del fuso AMBIENTALE: proibita come resolvedOptions(). Il
    // fuso deve ENTRARE come parametro `timeZone` (AC1).
    expect(/getTimezoneOffset\s*\(/.test(code)).toBe(false);
  });

  it('now e timeZone sono parametri espliciti: streak.length === 3', () => {
    expect(streak.length).toBe(3);
  });
});
