import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Story 1.10 — struttura dell'Edge Function delete-account e gate di deploy.
//
// Codifica le righe della I/O Matrix + gli AC meccanici:
//  (a) la funzione ESISTE e ha la struttura di AC2: verifica il chiamante dal
//      JWT (auth.getUser) e cancella con auth.admin.deleteUser (privilegio
//      service_role); gestisce il preflight CORS OPTIONS;
//  (b) config.toml dichiara [functions.delete-account] con verify_jwt = false
//      (il preflight non autenticato deve passare — verifica manuale nel corpo);
//  (c) GATE DI DEPLOY (AD-12/AD-13): migrate.yml deploya `functions deploy
//      delete-account` su push:[main] e MAI su PR; la config del deploy della
//      funzione è versionata, non manuale.
//
// Legge i file via node:fs, come src/migrations.test.ts e src/deploy-config.test.ts.
// La funzione è codice Deno FUORI dal toolchain Node: qui la ispezioniamo come
// TESTO (nessun import del suo modulo), coerente con l'ispezione dei workflow.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

/** Rimuove i commenti YAML (`# …`). Come in migrations.test.ts. */
function stripYamlComments(yaml: string): string {
  return yaml
    .split('\n')
    .map((line) => line.replace(/#.*$/, ''))
    .join('\n');
}

const functionSource = readFileSync(
  join(repoRoot, 'supabase', 'functions', 'delete-account', 'index.ts'),
  'utf-8',
);

const configToml = readFileSync(
  join(repoRoot, 'supabase', 'config.toml'),
  'utf-8',
);

const migrateYml = stripYamlComments(
  readFileSync(join(repoRoot, '.github', 'workflows', 'migrate.yml'), 'utf-8'),
);

const ciYml = stripYamlComments(
  readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf-8'),
);

describe('delete-account — struttura della funzione (AC2)', () => {
  it('verifica il chiamante dal JWT con auth.getUser', () => {
    // getUser(jwt) autentica il chiamante col client service_role: nessun JWT
    // valido ⇒ nessuna cancellazione.
    expect(functionSource).toMatch(/auth\.getUser\s*\(/);
  });

  it('cancella l’utente con auth.admin.deleteUser (privilegio service_role)', () => {
    expect(functionSource).toMatch(/auth\.admin\.deleteUser\s*\(/);
  });

  it('gestisce il preflight CORS OPTIONS', () => {
    expect(functionSource).toMatch(/OPTIONS/);
  });

  it('legge la service_role dai env di piattaforma (SUPABASE_SERVICE_ROLE_KEY)', () => {
    expect(functionSource).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  // Test-lock del guard del metodo: l'unico endpoint distruttivo rifiuta ogni
  // metodo non-POST con 405. Un controllo su req.method + uno status 405.
  it('rifiuta i metodi non-POST (controllo su req.method ⇒ 405)', () => {
    expect(functionSource).toMatch(/req\.method\s*!==?\s*'POST'/);
    expect(functionSource).toMatch(/405/);
  });

  // Test-lock del confine totale: la logica di gestione è avvolta in try/catch e
  // nel catch ritorna un 500 con i corsHeaders (il browser deve leggere la
  // risposta). Verifichiamo la presenza di try/catch e di un ramo 500 con CORS.
  it('avvolge la logica in try/catch e nel catch ritorna 500 con i corsHeaders', () => {
    expect(functionSource).toMatch(/try\s*\{/);
    expect(functionSource).toMatch(/catch\s*(\([^)]*\))?\s*\{/);
    // Il catch ritorna un 500; la risposta porta sempre i corsHeaders (via il
    // helper jsonResponse, che li allega). Verifichiamo entrambi i marker.
    expect(functionSource).toMatch(/500/);
    expect(functionSource).toMatch(/corsHeaders/);
  });
});

describe('config.toml — dichiarazione della funzione', () => {
  it('dichiara [functions.delete-account]', () => {
    expect(configToml).toMatch(/\[functions\.delete-account\]/);
  });

  it('imposta verify_jwt = false (il preflight non autenticato passa; verifica nel corpo)', () => {
    // La riga vive nel blocco [functions.delete-account].
    const block = configToml.slice(
      configToml.indexOf('[functions.delete-account]'),
    );
    expect(block).toMatch(/verify_jwt\s*=\s*false/);
  });
});

describe('workflow — il deploy della funzione raggiunge solo main, mai una PR', () => {
  it('migrate.yml esegue supabase functions deploy delete-account', () => {
    expect(migrateYml).toMatch(
      /supabase\s+functions\s+deploy\s+delete-account/,
    );
  });

  it('migrate.yml gira su push a main', () => {
    expect(migrateYml).toMatch(/on:/);
    expect(migrateYml).toMatch(/push:/);
    expect(migrateYml).toMatch(/branches:\s*\[\s*main\s*\]/);
  });

  // Gate AD-12/AD-13: nessun deploy da un ramo di PR.
  it('migrate.yml NON contiene pull_request', () => {
    expect(migrateYml).not.toMatch(/pull_request/);
  });

  it('migrate.yml NON contiene workflow_dispatch', () => {
    expect(migrateYml).not.toMatch(/workflow_dispatch/);
  });

  // ci.yml (lint/typecheck/test/build/…) gira su PR ma NON deve deployare.
  it('ci.yml NON esegue functions deploy', () => {
    expect(ciYml).not.toMatch(/functions\s+deploy/);
  });
});
