import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Sonda su SORGENTE della purezza/determinismo del dominio (AC6, AD-22): nessun
// file di dominio (esclusi i `.test.ts`) deve usare `Math.random`. `AD-1` è retto
// in CI da `boundaries/external` (import esterni) e `no-restricted-globals`
// (fetch/storage), ma `no-restricted-globals` NON copre `Math.random` — perciò
// serve questa sonda meccanica, modellata sullo stile-sonda di
// `src/boundaries.test.ts` con guardia anti-vacuità sui file attesi.

const __dirname = dirname(fileURLToPath(import.meta.url));
// La cartella del dominio è quella di questo file di test.
const domainDir = __dirname;
const repoRoot = resolve(__dirname, '..', '..');

/** Cammina ricorsivamente `dir` raccogliendo tutti i file `.ts`. */
function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Tutti i sorgenti di dominio, esclusi i file di test. */
function domainSourceFiles(): string[] {
  return collectTsFiles(domainDir).filter((p) => !p.endsWith('.test.ts'));
}

/**
 * Rimuove i commenti di riga e di blocco dal sorgente, così la sonda controlla
 * il CODICE, non la prosa: una menzione di `Math.random` in un commento che
 * spiega perché è vietato non è una violazione, un suo USO sì.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('purezza del dominio: nessun Math.random (AC6, AD-22)', () => {
  const files = domainSourceFiles();

  // Guardia anti-vacuità: se la scansione non trovasse i sorgenti (cwd sbagliata,
  // cartella vuota), la sonda passerebbe senza aver verificato nulla. Pretendiamo
  // che i file portanti del dominio siano stati visti.
  it('vede i sorgenti di dominio attesi (anti-vacuità)', () => {
    const seen = files.map((p) => relative(repoRoot, p).replace(/\\/g, '/'));
    for (const expected of [
      'src/domain/schema.ts',
      'src/domain/exercise.ts',
      'src/domain/lesson.ts',
      'src/domain/scaffold.ts',
    ]) {
      expect(
        seen.some((p) => p.endsWith(expected)),
        `atteso che ${expected} fosse tra i sorgenti scanditi; visti: ${seen.join(', ')}`,
      ).toBe(true);
    }
  });

  it('nessun file di dominio contiene Math.random', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      if (/Math\s*\.\s*random/.test(code)) {
        offenders.push(relative(repoRoot, file).replace(/\\/g, '/'));
      }
    }
    expect(offenders, `Math.random vietato sotto src/domain/: ${offenders.join(', ')}`).toEqual(
      [],
    );
  });
});
