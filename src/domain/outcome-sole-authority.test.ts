import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Sonda MECCANICA su TUTTO `src/` per l'AC di SOLA AUTORITÀ (Story 3.2): l'esito
// SI CALCOLA in un solo punto. `src/domain/outcome.ts` è l'UNICO modulo che
// PRODUCE (ritorna) un letterale d'esito SRS; nessun altro punto del codice decide
// un esito — la UI raccoglie i fatti, il dominio li traduce. `schedule()` CONSUMA
// `ReviewOutcome` (switch, `OUTCOME_FACTOR`) ma non lo produce, quindi non è un
// «punto che decide un esito» e non deve comparire tra gli offender.
//
// I `*.test.ts` sono esclusi (le fixture citano i letterali) come `outcome.ts`
// stesso (è l'autorità legittima). Modellata su `exercise-purity.test.ts`.

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..');
const repoRoot = resolve(__dirname, '..', '..');
const outcomeSource = resolve(__dirname, 'outcome.ts');

/**
 * Rileva un `return` di un LETTERALE d'esito: `return 'again'` / `"hard"` / …,
 * con virgolette singole o doppie e spazi liberi. Cattura la produzione di un
 * esito, non il semplice USO del tipo (`switch`, annotazioni, `Record` di
 * fattori), che non ritorna il letterale.
 *
 * PORTATA NOTA: la sonda intercetta la forma DIRETTA `return '<letterale>'` — la
 * forma naturale con cui un produttore d'esito si scrive (come `outcomeOf`
 * stesso). Un produttore INDIRETTO — variabile intermedia (`const o = 'good';
 * return o;`), ternario o tabella di lookup che non emette un `return` letterale
 * — le sfuggirebbe: quel caso resta responsabilità della review. Allargare la
 * regex introdurrebbe falsi positivi, quindi si preferisce questo confine netto.
 */
const RETURNS_OUTCOME_LITERAL = /\breturn\s+(['"])(again|hard|good|easy)\1/;

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
 * la prosa: una menzione di `return 'again'` in un commento non è una violazione.
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

describe('sola autorità sull\'esito: solo outcome.ts produce un letterale (Story 3.2)', () => {
  const files = candidateFiles();

  // Anti-vacuità (1): aver scansionato abbastanza da rendere l'affermazione
  // significativa. `src/` supera ampiamente i 5 sorgenti non-di-test.
  it('scansiona almeno 5 sorgenti non-di-test (anti-vacuità)', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  // Anti-vacuità (2): il rilevatore NON è un no-op. `outcome.ts` — l'autorità
  // legittima — deve corrispondere alla regex; se non corrispondesse, la sonda
  // non potrebbe rilevare un secondo produttore altrove.
  it('il rilevatore corrisponde a outcome.ts (la regex non è vuota)', () => {
    const code = stripComments(readFileSync(outcomeSource, 'utf8'));
    expect(RETURNS_OUTCOME_LITERAL.test(code)).toBe(true);
  });

  it('nessun altro file di src/ (escluso outcome.ts) ritorna un letterale d\'esito', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file === outcomeSource) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      if (RETURNS_OUTCOME_LITERAL.test(code)) {
        offenders.push(relative(repoRoot, file).replace(/\\/g, '/'));
      }
    }
    expect(
      offenders,
      `solo src/domain/outcome.ts può produrre un esito SRS; offender: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
