import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Sonda MECCANICA su TUTTO `src/` per i due AC di SOLA AUTORITÀ (Story 3.3, AD-5):
// la pila dei dovuti SI CALCOLA in un solo punto. `src/domain/due.ts` è l'UNICO
// modulo che (1) DECIDE la dovutezza — confronta `dueAt` con un istante tramite un
// operatore relazionale — e (2) DEFINISCE l'identità della pila — il letterale di
// chiave `['due'`. Nessun'altra schermata o modulo ricalcola la pila o ridefinisce
// la chiave: così dashboard, precarico e cancello non possono divergere.
//
// I `*.test.ts` sono esclusi (le fixture citano i costrutti) come `due.ts` stesso
// (è l'autorità legittima). Modellata su `outcome-sole-authority.test.ts`.
//
// PORTATA NOTA: come in `outcome-sole-authority.test.ts`, i rilevatori intercettano
// la forma DIRETTA — `dueAt` (eventualmente `.getTime()`/`.valueOf()`) adiacente a
// un operatore relazionale, in entrambi gli ordini; letterale `['due'`/`["due"`. Un
// produttore INDIRETTO — estrarre `const t = state.dueAt.getTime()` e confrontare
// `t` altrove — sfuggirebbe e resta responsabilità della review. Il valore della
// sonda è PROSPETTICO: diventa una guardia reale quando le schermate 3.12+
// leggeranno la pila.

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..');
const repoRoot = resolve(__dirname, '..', '..');
const dueSource = resolve(__dirname, 'due.ts');

/**
 * Rileva la DECISIONE di dovutezza: `dueAt` (eventualmente seguito da una lettura
 * numerica `.getTime()`/`.valueOf()`) adiacente a un operatore relazionale
 * `<`/`>`/`<=`/`>=`, in ENTRAMBI gli ordini (`dueAt <= x` e `x >= dueAt`). Il
 * carattere di lookahead/lookbehind `[^<>=]` esclude `<<`, `>>`, `===`, `!==`,
 * `=>`: catturiamo l'ORDINAMENTO temporale (che decide la dovutezza), non
 * l'uguaglianza né la sottrazione (`dueAt.getTime() - now`).
 */
const DECIDES_DUENESS =
  /dueAt(?:\s*\.\s*(?:getTime|valueOf)\s*\(\s*\))?\s*(?:<=?|>=?)(?![<>=])|(?<![<>=])(?:<=?|>=?)[^;\n{}()]*?\bdueAt\b/;

/** Rileva il LETTERALE di chiave della pila: `['due'` o `["due"`, spazi liberi. */
const DEFINES_DUE_KEY = /\[\s*(['"])due\1/;

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
 * la prosa: una menzione di `dueAt <= now` in un commento non è una violazione.
 * Identica alla famiglia delle sonde di dominio.
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

describe('sola autorità sulla dovutezza: solo due.ts decide la pila (Story 3.3, AD-5)', () => {
  const files = candidateFiles();

  // Anti-vacuità (1): aver scansionato abbastanza da rendere l'affermazione
  // significativa. `src/` supera ampiamente i 5 sorgenti non-di-test.
  it('scansiona almeno 5 sorgenti non-di-test (anti-vacuità)', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  // --- AC6: solo due.ts DECIDE la dovutezza (confronta dueAt con un istante) ---

  // Anti-vacuità (2): il rilevatore NON è un no-op. `due.ts` — l'autorità
  // legittima — deve corrispondere al rilevatore; se non corrispondesse, la sonda
  // non potrebbe rilevare un secondo decisore altrove.
  it('il rilevatore di dovutezza corrisponde a due.ts (la regex non è vuota)', () => {
    const code = stripComments(readFileSync(dueSource, 'utf8'));
    expect(DECIDES_DUENESS.test(code)).toBe(true);
  });

  it('nessun altro file di src/ (escluso due.ts) decide la dovutezza', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file === dueSource) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      if (DECIDES_DUENESS.test(code)) {
        offenders.push(relative(repoRoot, file).replace(/\\/g, '/'));
      }
    }
    expect(
      offenders,
      `solo src/domain/due.ts può decidere la dovutezza; offender: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  // --- AC4: solo due.ts DEFINISCE l'identità della pila (letterale ['due') ---

  // Anti-vacuità (2): il rilevatore di chiave NON è un no-op.
  it('il rilevatore di chiave corrisponde a due.ts (la regex non è vuota)', () => {
    const code = stripComments(readFileSync(dueSource, 'utf8'));
    expect(DEFINES_DUE_KEY.test(code)).toBe(true);
  });

  it("nessun altro file di src/ (escluso due.ts) ridefinisce la chiave ['due', …]", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file === dueSource) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      if (DEFINES_DUE_KEY.test(code)) {
        offenders.push(relative(repoRoot, file).replace(/\\/g, '/'));
      }
    }
    expect(
      offenders,
      `solo src/domain/due.ts può definire la chiave ['due', userId]; offender: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
