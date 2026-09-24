import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { alignFurigana } from './furigana';

// Sonda MECCANICA sul SORGENTE di `furigana.ts`, modellata su `due-purity.test.ts`
// (AD-1, purezza del dominio, AC5 di 3.6). `no-restricted-globals` in
// eslint.config.js copre `fetch`/storage, e `boundaries/external` vieta l'import di
// qualunque pacchetto esterno (React incluso). Questa sonda legge comunque il
// codice (commenti rimossi) e pretende che i costrutti non deterministici e
// l'import di React non compaiano: il dominio è puro e NON importa React (AC5).
// `alignFurigana` non ha input temporali: prende esattamente due parametri
// (`alignFurigana.length === 2`).

const __dirname = dirname(fileURLToPath(import.meta.url));
const furiganaSource = resolve(__dirname, 'furigana.ts');

/**
 * Rimuove i commenti di riga e di blocco, così la sonda controlla il CODICE, non
 * la prosa: una menzione di `Math.random()` in un commento che spiega perché è
 * vietato non è una violazione, un suo USO sì. Identica alla famiglia delle sonde
 * di dominio.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('purezza di furigana.ts (AC5, AD-1)', () => {
  // Guardia anti-vacuità: se il file non si leggesse (path errato, spostamento),
  // la sonda passerebbe senza aver verificato nulla. Pretendiamo di averlo trovato,
  // con contenuto non vuoto e la firma attesa.
  const raw = readFileSync(furiganaSource, 'utf8');
  it('trova il sorgente di furigana.ts (anti-vacuità)', () => {
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).toContain('export function alignFurigana');
  });

  const code = stripComments(raw);

  it('non usa fetch(', () => {
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
  });

  it('non usa Math.random', () => {
    expect(/Math\s*\.\s*random/.test(code)).toBe(false);
  });

  it('non importa react (AC5: il dominio non importa React)', () => {
    // Nessun import/require da 'react' o da uno scope '@…/react' o sottopercorso
    // 'react/…'. Il confine è imposto anche da `boundaries/external`; qui è una
    // guardia esplicita e leggibile sul sorgente.
    expect(/\bfrom\s*['"]react(?:\/[^'"]*)?['"]/.test(code)).toBe(false);
    expect(/\bimport\s*['"]react(?:\/[^'"]*)?['"]/.test(code)).toBe(false);
    expect(/\brequire\s*\(\s*['"]react(?:\/[^'"]*)?['"]\s*\)/.test(code)).toBe(false);
  });

  it('kanji e kana sono parametri espliciti: alignFurigana.length === 2', () => {
    expect(alignFurigana.length).toBe(2);
  });
});
