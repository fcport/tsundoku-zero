import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Story 1.10 — AC3, gate MECCANICO di confinamento della service_role.
//
// La service_role può cancellare qualunque utente: non può stare nel bundle
// servito al browser (AD-11). Questo test lo impone come CI rossa:
//  (a) nessun file di CODICE in src/** contiene `service_role`/`SERVICE_ROLE`
//      (case-insensitive) — i commenti sono strippati (un commento che
//      DOCUMENTA l'assenza, es. src/data/supabaseClient.ts, non conta; i file
//      *.test.ts che nominano il token per verificarlo sono esclusi);
//  (b) .env.example non dichiara alcuna variabile VITE_* di service-role
//      (il prefisso VITE_ finisce nel bundle);
//  (c) ANTI-VACUITÀ: la funzione server (fuori da src/) esiste e USA davvero
//      SERVICE_ROLE — la chiave vive solo lato server, non è semplicemente
//      «assente ovunque».
//
// Legge i file via node:fs, come src/deploy-config.test.ts e src/migrations.test.ts.
// I *.test.ts sono esclusi dalle regole boundaries e possono usare node:*.

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = here;
const repoRoot = resolve(here, '..');

const SERVICE_ROLE = /service_role|SERVICE_ROLE/i;

/**
 * Rimuove i commenti da un file .ts/.tsx: commenti di riga in stile due-slash e
 * commenti a blocco. Le asserzioni ispezionano il CODICE effettivo, non la prosa
 * dei commenti: un commento che NOMINA `service_role` per documentarne l'assenza
 * (supabaseClient.ts) non deve contare come un uso. Modello: stripYamlComments in
 * migrations.test.ts.
 */
function stripComments(source: string): string {
  return source
    // Blocchi /* ... */ (anche multilinea).
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Righe // ...
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
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

describe('service_role confinata FUORI da src/** (AC3)', () => {
  // Anti-vacuità: se il glob si rompesse e non trovasse file, "nessun match"
  // passerebbe senza aver ispezionato niente.
  it('esiste almeno un file sorgente da ispezionare', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it('nessun file di codice in src/** contiene service_role/SERVICE_ROLE', () => {
    const offenders = sourceFiles.filter((file) =>
      SERVICE_ROLE.test(stripComments(readFileSync(file, 'utf-8'))),
    );
    expect(
      offenders,
      `service_role trovata nel codice di: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});

describe('.env.example — nessuna VITE_* di service-role', () => {
  const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf-8');

  it('nessuna riga dichiara una variabile VITE_* con service-role', () => {
    // Una assegnazione VITE_… = che nomina service-role finirebbe nel bundle.
    // (Il file DOCUMENTA a prosa perché la service_role non è qui: ammesso, non
    // è una dichiarazione di variabile VITE_*.)
    const viteServiceRoleDecl = envExample
      .split('\n')
      .filter((line) => /^\s*VITE_[A-Z0-9_]*=/i.test(line))
      .filter((line) => SERVICE_ROLE.test(line));
    expect(viteServiceRoleDecl).toEqual([]);
  });
});

describe('anti-vacuità — la funzione server USA la service_role (fuori da src/)', () => {
  const functionPath = join(
    repoRoot,
    'supabase',
    'functions',
    'delete-account',
    'index.ts',
  );

  it('supabase/functions/delete-account/index.ts esiste', () => {
    expect(existsSync(functionPath)).toBe(true);
  });

  it('la funzione legge SUPABASE_SERVICE_ROLE_KEY (la chiave vive solo lato server)', () => {
    const fn = readFileSync(functionPath, 'utf-8');
    expect(SERVICE_ROLE.test(fn)).toBe(true);
    expect(fn).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
