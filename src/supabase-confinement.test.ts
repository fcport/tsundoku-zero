import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Story 3.10 — AC2, gate MECCANICO di confinamento di @supabase/supabase-js.
//
// Solo src/data/ importa il client Supabase (AD-2). La regola boundaries/external
// di ESLint blocca gli esterni SOLO da `domain` (boundaries.test.ts): «solo data
// importa supabase-js» NON è imposta da ESLint — da qui questo test a scansione
// sorgente. Scandisce src/**/*.{ts,tsx} (esclusi i *.test.*, commenti strippati) e
// pretende che ogni file che importa `@supabase/supabase-js` sia sotto src/data/.
//
// Legge i file via node:fs, come src/service-role-confinement.test.ts. I *.test.*
// sono esclusi dalle regole boundaries e possono importare pacchetti esterni.

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = here;
const dataDir = join(here, 'data');

const SUPABASE_IMPORT = /@supabase\/supabase-js/;

/**
 * Rimuove i commenti da un file .ts/.tsx: blocchi e commenti di riga. Le
 * asserzioni ispezionano il CODICE effettivo, non la prosa: un commento che
 * NOMINA `@supabase/supabase-js` per documentarlo (es. l'intestazione di
 * supabaseClient.ts) non deve contare come import. Modello: stripComments in
 * service-role-confinement.test.ts.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    // Da `//` a fine riga. `[^\r\n]*` (non `.*$`) taglia anche con line-ending
    // CRLF: un `\r` finale farebbe fallire l'ancora `$`, lasciando passare un
    // commento (es. l'intestazione di main.tsx che NOMINA il pacchetto).
    .map((line) => line.replace(/\/\/[^\r\n]*/, ''))
    .join('\n');
}

/** Raccoglie ricorsivamente i file .ts/.tsx sotto `dir`, ESCLUSI i *.test.*. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = collectSourceFiles(srcDir);

/** Vero se `file` è sotto src/data/. */
function isUnderData(file: string): boolean {
  const rel = relative(dataDir, file);
  return !rel.startsWith('..') && !rel.startsWith('/') && rel !== '';
}

describe('@supabase/supabase-js confinato a src/data/ (AC2)', () => {
  // Anti-vacuità sullo scan.
  it('esiste almeno un file sorgente da ispezionare', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  const importers = sourceFiles.filter((file) =>
    SUPABASE_IMPORT.test(stripComments(readFileSync(file, 'utf-8'))),
  );

  it('ogni file che importa @supabase/supabase-js è sotto src/data/', () => {
    const offenders = importers.filter((file) => !isUnderData(file));
    expect(
      offenders.map((f) => relative(srcDir, f).replace(/\\/g, '/')),
      'file che importano supabase-js fuori da src/data/',
    ).toEqual([]);
  });

  // Anti-vacuità: se «nessun file importa supabase-js» il confinamento sarebbe
  // banalmente vero. Almeno un file DATA deve importarlo davvero.
  it('almeno un file sotto src/data/ importa @supabase/supabase-js', () => {
    expect(importers.some((file) => isUnderData(file))).toBe(true);
  });
});
