import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Sonda MECCANICA su TUTTO `src/` per la SOLA AUTORITÀ dell'allineamento della
// furigana (Story 3.6, AD-21/UX-DR23): la furigana SI ALLINEA in un solo punto.
// `src/domain/furigana.ts` è l'UNICO modulo di `src/` che DICHIARA una funzione/
// const `alignFurigana`: nessun'altra schermata o modulo lo ricalcola. Le future
// CHIAMATE `alignFurigana(...)` dai consumatori (rendering della furigana 3.11,
// span di select-span 2.3) sono call, non dichiarazioni, e non fanno falso
// positivo. Guardia PROSPETTICA di «nessuna logica di allineamento fuori dal
// dominio».
//
// I `*.test.ts` sono esclusi (le fixture citano `alignFurigana`) come
// `furigana.ts` stesso (è l'autorità legittima). Modellata su
// `streak-sole-authority.test.ts`.

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..');
const repoRoot = resolve(__dirname, '..', '..');
const furiganaSource = resolve(__dirname, 'furigana.ts');

/**
 * Rileva la DICHIARAZIONE dell'allineamento: `function alignFurigana` o
 * `const alignFurigana` (spazi liberi, confine di parola). Una dichiarazione
 * PRODUCE l'allineamento; una chiamata `alignFurigana(...)` lo CONSUMA e non
 * corrisponde (`\b(function|const)` precede il nome), così i consumatori futuri
 * non sono falsi positivi.
 */
const DECLARES_ALIGN_FURIGANA = /\b(?:function|const)\s+alignFurigana\b/;

/** Cammina ricorsivamente `dir` raccogliendo tutti i file `.ts`/`.tsx`. */
function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Rimuove i commenti di riga e di blocco, così la sonda controlla il CODICE, non
 * la prosa: una menzione di `alignFurigana()` in un commento (come in exercise.ts
 * o content-validation.ts) non è una dichiarazione. Identica alla famiglia delle
 * sonde di dominio.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** I sorgenti candidati: tutto `src/`, esclusi i `.test.ts`/`.test.tsx`. */
function candidateFiles(): string[] {
  return collectTsFiles(srcDir).filter((p) => !/\.test\.tsx?$/.test(p));
}

describe("sola autorità sull'allineamento: solo furigana.ts lo dichiara (Story 3.6, AD-21)", () => {
  const files = candidateFiles();

  // Anti-vacuità (1): aver scansionato abbastanza da rendere l'affermazione
  // significativa. `src/` supera ampiamente i 5 sorgenti non-di-test.
  it('scansiona almeno 5 sorgenti non-di-test (anti-vacuità)', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  // Anti-vacuità (2): il rilevatore NON è un no-op. `furigana.ts` — l'autorità
  // legittima — deve corrispondere al rilevatore; se non corrispondesse, la sonda
  // non potrebbe rilevare un secondo produttore altrove.
  it('il rilevatore di dichiarazione corrisponde a furigana.ts (la regex non è vuota)', () => {
    const code = stripComments(readFileSync(furiganaSource, 'utf8'));
    expect(DECLARES_ALIGN_FURIGANA.test(code)).toBe(true);
  });

  it('nessun altro file di src/ (escluso furigana.ts) dichiara alignFurigana', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file === furiganaSource) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      if (DECLARES_ALIGN_FURIGANA.test(code)) {
        offenders.push(relative(repoRoot, file).replace(/\\/g, '/'));
      }
    }
    expect(
      offenders,
      `solo src/domain/furigana.ts può dichiarare l'allineamento della furigana (AD-21); offender: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
