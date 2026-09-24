import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Sonda MECCANICA per i due AC di SOLA AUTORITÀ / NON-MEMORIZZAZIONE (Story 3.5,
// AD-18): lo streak SI CALCOLA in un solo punto e NON si memorizza.
// (1) `src/domain/streak.ts` è l'UNICO modulo di `src/` che DICHIARA una funzione/
//     const `streak`: nessun'altra schermata o modulo lo ricalcola. Le future
//     CHIAMATE `streak(...)` dai consumatori (dashboard 3.12+, completamento 3.21)
//     sono call, non dichiarazioni, e non fanno falso positivo.
// (2) Nessun file `.sql` di `supabase/migrations/**` contiene un identificatore di
//     colonna `streak`: nessuna colonna lo memorizza (AC4, «nessuna colonna che lo
//     memorizzi»). Guardia PROSPETTICA: diventa reale quando 3.7+ creerà le tabelle
//     di review; oggi esiste solo `create_user_settings.sql`.
//
// I `*.test.ts` sono esclusi (le fixture citano `streak`) come `streak.ts` stesso
// (è l'autorità legittima). Modellata su `due-sole-authority.test.ts`.

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..');
const repoRoot = resolve(__dirname, '..', '..');
const streakSource = resolve(__dirname, 'streak.ts');
const migrationsDir = resolve(repoRoot, 'supabase', 'migrations');

/**
 * Rileva la DICHIARAZIONE di uno streak: `function streak` o `const streak`
 * (spazi liberi, confine di parola). Una dichiarazione PRODUCE lo streak; una
 * chiamata `streak(...)` lo CONSUMA e non corrisponde (`\b(function|const)`
 * precede il nome), così i consumatori futuri non sono falsi positivi.
 */
const DECLARES_STREAK = /\b(?:function|const)\s+streak\b/;

/**
 * Rileva un identificatore di colonna `streak` in SQL: la parola `streak` come
 * token isolato (confine di parola), case-insensitive. Sensibilità: qualunque
 * menzione di `streak` come identificatore in una migrazione è un offender —
 * proprio ciò che AC4 vieta.
 */
const SQL_STREAK_COLUMN = /\bstreak\b/i;

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
 * la prosa. Identica alla famiglia delle sonde di dominio.
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

/** Rimuove i commenti SQL (riga `--` e blocco in stile C) prima di scansionare. */
function stripSqlComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ');
}

/** Raccoglie i file `.sql` di `supabase/migrations/**` (vuoto se la cartella manca). */
function collectSqlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSqlFiles(full));
    } else if (entry.isFile() && /\.sql$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('sola autorità sullo streak: solo streak.ts lo calcola (Story 3.5, AD-18)', () => {
  const files = candidateFiles();

  // Anti-vacuità (1): aver scansionato abbastanza da rendere l'affermazione
  // significativa. `src/` supera ampiamente i 5 sorgenti non-di-test.
  it('scansiona almeno 5 sorgenti non-di-test (anti-vacuità)', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  // Anti-vacuità (2): il rilevatore NON è un no-op. `streak.ts` — l'autorità
  // legittima — deve corrispondere al rilevatore; se non corrispondesse, la sonda
  // non potrebbe rilevare un secondo produttore altrove.
  it('il rilevatore di dichiarazione corrisponde a streak.ts (la regex non è vuota)', () => {
    const code = stripComments(readFileSync(streakSource, 'utf8'));
    expect(DECLARES_STREAK.test(code)).toBe(true);
  });

  it('nessun altro file di src/ (escluso streak.ts) dichiara/calcola lo streak', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file === streakSource) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      if (DECLARES_STREAK.test(code)) {
        offenders.push(relative(repoRoot, file).replace(/\\/g, '/'));
      }
    }
    expect(
      offenders,
      `solo src/domain/streak.ts può calcolare lo streak; offender: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});

describe('non-memorizzazione dello streak: nessuna colonna in migrations (Story 3.5, AC4)', () => {
  const sqlFiles = collectSqlFiles(migrationsDir);

  // Anti-vacuità: la cartella delle migrazioni esiste ed è scansionata. Se un
  // domani il path si rompesse, la guardia passerebbe a vuoto: pretendiamo ≥1 file.
  it('scansiona almeno un file .sql di migrazione (anti-vacuità)', () => {
    expect(sqlFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('nessuna migrazione .sql contiene un identificatore di colonna `streak`', () => {
    const offenders: string[] = [];
    for (const file of sqlFiles) {
      const sql = stripSqlComments(readFileSync(file, 'utf8'));
      if (SQL_STREAK_COLUMN.test(sql)) {
        offenders.push(relative(repoRoot, file).replace(/\\/g, '/'));
      }
    }
    expect(
      offenders,
      `nessuna colonna deve memorizzare lo streak (AD-18); offender: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
