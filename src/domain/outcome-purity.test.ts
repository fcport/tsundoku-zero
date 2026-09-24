import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { outcomeOf } from './outcome';

// Sonda MECCANICA sul SORGENTE di `outcome.ts`, modellata su
// `schedule-purity.test.ts` (AD-1, purezza del dominio). `no-restricted-globals`
// in eslint.config.js copre `fetch`/storage ma NON i COSTRUTTI TEMPORALI e
// `Math.random`. Perciò questa sonda legge il codice (commenti rimossi) e pretende
// che quei costrutti non compaiano: l'esito NON dipende dal tempo, così l'esito
// calcolato offline coincide con quello online (`AD-24`).

const __dirname = dirname(fileURLToPath(import.meta.url));
const outcomeSource = resolve(__dirname, 'outcome.ts');

/**
 * Rimuove i commenti di riga e di blocco, così la sonda controlla il CODICE, non
 * la prosa: una menzione di `Date.now()` in un commento che spiega perché è
 * vietato non è una violazione, un suo USO sì. Identica a `schedule-purity.test.ts`.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('purezza di outcome.ts (AD-1, AD-24)', () => {
  // Guardia anti-vacuità: se il file non si leggesse (path errato, spostamento),
  // la sonda passerebbe senza aver verificato nulla. Pretendiamo di averlo trovato,
  // con contenuto non vuoto e la firma attesa.
  const raw = readFileSync(outcomeSource, 'utf8');
  it('trova il sorgente di outcome.ts (anti-vacuità)', () => {
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).toContain('export function outcomeOf');
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

  it('outcomeOf ha esattamente 3 parametri: outcomeOf.length === 3', () => {
    expect(outcomeOf.length).toBe(3);
  });
});
