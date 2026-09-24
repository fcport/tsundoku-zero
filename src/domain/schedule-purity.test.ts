import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { schedule } from './schedule';

// Sonda MECCANICA sul SORGENTE di `schedule.ts`, modellata su
// `exercise-purity.test.ts` (AD-22, purezza del dominio, AC4 di 3.1). Estende la
// famiglia di sonde ai COSTRUTTI TEMPORALI: `no-restricted-globals` in
// eslint.config.js copre `fetch`/storage ma NON `Date.now`, `new Date()`,
// `Intl.DateTimeFormat().resolvedOptions()` né `Math.random`. Perciò questa sonda
// legge il codice (commenti rimossi) e pretende che quei costrutti non compaiano:
// ogni istante temporale deve ENTRARE come parametro `now`.

const __dirname = dirname(fileURLToPath(import.meta.url));
const scheduleSource = resolve(__dirname, 'schedule.ts');

/**
 * Rimuove i commenti di riga e di blocco, così la sonda controlla il CODICE, non
 * la prosa: una menzione di `Date.now()` in un commento che spiega perché è
 * vietato non è una violazione, un suo USO sì. Identica a `exercise-purity.test.ts`.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('purezza temporale di schedule.ts (AC4, AD-1)', () => {
  // Guardia anti-vacuità: se il file non si leggesse (path errato, spostamento),
  // la sonda passerebbe senza aver verificato nulla. Pretendiamo di averlo trovato
  // e con contenuto non vuoto.
  const raw = readFileSync(scheduleSource, 'utf8');
  it('trova il sorgente di schedule.ts (anti-vacuità)', () => {
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).toContain('export function schedule');
  });

  const code = stripComments(raw);

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

  it('now è un parametro esplicito: schedule.length === 3', () => {
    expect(schedule.length).toBe(3);
  });
});
