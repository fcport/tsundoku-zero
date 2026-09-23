import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import PgQueryModule, {
  type PgParseResult,
  type PgQueryModule as PgQuery,
} from 'pg-query-emscripten';
import { beforeAll, describe, expect, it } from 'vitest';

// Story 1.5 — Lo schema nasce versionato e isolato.
//
// Codifica le righe della I/O Matrix dello spec:
//  (a) VALIDAZIONE SINTATTICA OFFLINE di ogni supabase/migrations/*.sql con la
//      grammatica Postgres reale (pg-query-emscripten incapsula libpg_query).
//      Nessuna connessione a database — AD-12/AD-13 vieta l'istanza locale e
//      l'apply da PR: si parsa il TESTO. SQL non parsabile ⇒ CI rossa.
//  (b) ASSERZIONI STRUTTURALI su user_settings: colonne esatte via AST (AC3
//      «e nient'altro»), cascata/RLS/4 policy owner-scoped via testo.
//  (c) GATE DI CONFIG su migrate.yml/ci.yml: l'apply (db push) è dichiarato
//      SOLO in migrate.yml su push:[main]; migrate.yml non contiene mai
//      pull_request; ci.yml non fa mai db push.
//
// Legge i file via node:fs, come src/deploy-config.test.ts e src/boundaries.test.ts.
// I *.test.ts sono esclusi dalle regole boundaries (possono importare pacchetti
// esterni e node:*).

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');

/** Ogni .sql in supabase/migrations, ordinato per versione (come db push). */
function listMigrations(): readonly { name: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(join(migrationsDir, name), 'utf-8'),
    }));
}

const migrations = listMigrations();

/**
 * Rimuove i commenti di riga SQL (`-- …`) da un file. Le asserzioni testuali
 * ispezionano il DDL EFFETTIVO, non la prosa dei commenti: un commento che
 * NOMINA `to authenticated` non deve contare come una policy, né un commento
 * su `check (locale …)` deve far scattare il divieto. (Nessuna stringa contiene
 * `--` in questa migrazione, quindi lo strip di riga è sufficiente e sicuro.)
 */
function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/**
 * Rimuove i commenti YAML (`# …`) da un workflow. I gate sul workflow devono
 * ispezionare la CONFIG effettiva, non i commenti che SPIEGANO perché un
 * trigger è assente (i commenti nominano di proposito `pull_request` e
 * `workflow_dispatch`). Nessun valore di questi workflow contiene `#`.
 */
function stripYamlComments(yaml: string): string {
  return yaml
    .split('\n')
    .map((line) => line.replace(/#.*$/, ''))
    .join('\n');
}

// Il modulo WASM si inizializza una volta (await new Module()).
let pg: PgQuery;
beforeAll(async () => {
  pg = await new PgQueryModule();
});

describe('supabase/migrations — validazione sintattica offline (AC2)', () => {
  // Guardia anti-vacuità: se la cartella fosse vuota o il glob rotto, un file
  // "tutto valido" passerebbe senza aver verificato niente.
  it('esiste almeno una migrazione da validare', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  // Riga "migrazione ben formata" + "migrazione malformata": ogni file è dato
  // in pasto al parser Postgres reale. error === null ⇒ verde; un typo come
  // `creat table` popolerebbe res.error.message ⇒ rosso, prima del merge, senza
  // toccare i dati dell'owner.
  for (const { name, sql } of migrations) {
    it(`parsa senza errori di sintassi: ${name}`, () => {
      const res: PgParseResult = pg.parse(sql);
      expect(
        res.error,
        `errore di sintassi in ${name}: ${res.error?.message ?? ''}`,
      ).toBeNull();
      expect(res.parse_tree.stmts.length).toBeGreaterThan(0);
    });
  }

  // Prova NEGATIVA: dimostra che il parser coglie davvero un typo. Se questo
  // passasse (error nullo su SQL rotto), il gate (a) sarebbe finto.
  it('un typo (creat table) produce un errore di sintassi', () => {
    const res = pg.parse('creat table t (id uuid);');
    expect(res.error).not.toBeNull();
    expect(res.error?.message ?? '').toMatch(/syntax error/i);
  });
});

// ---------------------------------------------------------------------------
// Asserzioni strutturali sulla migrazione user_settings (AC3 / AC4-schema).
// ---------------------------------------------------------------------------

const userSettings = migrations.find((m) => m.name.endsWith('_create_user_settings.sql'));

describe('migrazione user_settings — schema minimo e isolato', () => {
  it('la migrazione esiste', () => {
    expect(userSettings, 'atteso un file *_create_user_settings.sql').toBeDefined();
  });

  // Riga "schema minimo": via AST, la create table espone ESATTAMENTE due
  // colonne, user_id e locale. Una terza colonna (created_at, updated_at, …)
  // fa fallire questo test — è il gate meccanico di «e nient'altro».
  it('espone esattamente le colonne user_id e locale (via AST)', () => {
    const sql = userSettings?.sql ?? '';
    const res = pg.parse(sql);
    expect(res.error).toBeNull();

    const createStmts = res.parse_tree.stmts
      .map((s) => s.stmt.CreateStmt)
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    // Una sola create table nella migrazione.
    expect(createStmts.length).toBe(1);

    const create = createStmts[0];
    expect(create?.relation?.relname).toBe('user_settings');

    const columnNames = (create?.tableElts ?? [])
      .map((elt) => elt.ColumnDef?.colname)
      .filter((n): n is string => typeof n === 'string');

    expect(columnNames).toEqual(['user_id', 'locale']);
  });

  // Riga "chiave + cascata": user_id è PK e references auth.users (id) on delete
  // cascade. Lo leggiamo dall'AST della colonna: fk verso schema auth / tabella
  // users, azione di cancellazione 'c' (cascade), e un vincolo PRIMARY.
  it('user_id è PK e FK cascade verso auth.users (via AST)', () => {
    const res = pg.parse(userSettings?.sql ?? '');
    const create = res.parse_tree.stmts
      .map((s) => s.stmt.CreateStmt)
      .find((c) => c?.relation?.relname === 'user_settings');

    const userIdCol = (create?.tableElts ?? [])
      .map((elt) => elt.ColumnDef)
      .find((c) => c?.colname === 'user_id');
    expect(userIdCol, 'colonna user_id assente').toBeDefined();

    const constraints = (userIdCol?.constraints ?? [])
      .map((c) => c.Constraint)
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    const hasPrimary = constraints.some((c) => c.contype === 'CONSTR_PRIMARY');
    expect(hasPrimary, 'user_id non è PRIMARY KEY').toBe(true);

    const fk = constraints.find((c) => c.contype === 'CONSTR_FOREIGN');
    expect(fk, 'user_id non ha un vincolo FOREIGN KEY').toBeDefined();
    expect(fk?.pktable?.schemaname).toBe('auth');
    expect(fk?.pktable?.relname).toBe('users');
    // fk_del_action 'c' = cascade: la cancellazione dell'utente propaga.
    expect(fk?.fk_del_action, 'FK non è on delete cascade').toBe('c');
  });

  // Riga "chiave + cascata" (testo): ridondanza deliberata sul testo, così una
  // regressione sull'ON DELETE è colta anche a colpo d'occhio del diff.
  it('il testo dichiara on delete cascade verso auth.users (id)', () => {
    const sql = stripSqlComments(userSettings?.sql ?? '').toLowerCase();
    expect(sql).toMatch(/references\s+auth\.users\s*\(\s*id\s*\)\s+on\s+delete\s+cascade/);
  });

  // Riga "RLS + policy": RLS abilitata. Senza, la chiave anonima pubblicabile
  // leggerebbe ogni riga (AD-10).
  it('abilita row level security', () => {
    const sql = stripSqlComments(userSettings?.sql ?? '').toLowerCase();
    expect(sql).toMatch(/alter\s+table\s+user_settings\s+enable\s+row\s+level\s+security/);
  });

  // Riga "RLS + policy": UNA policy per operazione (select/insert/update/delete),
  // tutte `to authenticated` e ristrette a (select auth.uid()) = user_id. Se ne
  // manca una, questo test è rosso.
  it('dichiara 4 policy owner-scoped, una per operazione', () => {
    const sql = userSettings?.sql ?? '';
    const res = pg.parse(sql);
    expect(res.error).toBeNull();

    // Conta le CreatePolicyStmt e raccoglie i comandi coperti.
    const policyCommands = res.parse_tree.stmts
      .map((s) => s.stmt.CreatePolicyStmt as { cmd_name?: string } | undefined)
      .filter((p): p is { cmd_name?: string } => p !== undefined)
      .map((p) => p.cmd_name);

    expect(policyCommands.length).toBe(4);
    expect(new Set(policyCommands)).toEqual(
      new Set(['select', 'insert', 'update', 'delete']),
    );
  });

  it('ogni policy è to authenticated e usa (select auth.uid()) = user_id', () => {
    const sql = stripSqlComments(userSettings?.sql ?? '').toLowerCase();

    // Quattro policy, quattro `to authenticated`.
    const authenticatedCount = (sql.match(/to\s+authenticated/g) ?? []).length;
    expect(authenticatedCount).toBe(4);

    // La condizione owner-scoped col (select auth.uid()) compare almeno una
    // volta per policy (using e/o with check). Pretendiamo il pattern con la
    // sottoquery, non l'auth.uid() nudo (guida performance RLS Supabase).
    const ownerScopedCount = (
      sql.match(/\(\s*select\s+auth\.uid\(\)\s*\)\s*=\s*user_id/g) ?? []
    ).length;
    expect(ownerScopedCount).toBeGreaterThanOrEqual(4);

    // Nessun check sul locale: accoppierebbe lo schema all'enum dell'app prima
    // della storia 1.9. La minimalità è il punto (AC3).
    expect(sql).not.toMatch(/check\s*\(\s*locale/);
  });

  it('locale è text not null default \'en\'', () => {
    const sql = stripSqlComments(userSettings?.sql ?? '').toLowerCase();
    expect(sql).toMatch(/locale\s+text\s+not\s+null\s+default\s+'en'/);
  });

  // Guardia sull'assunzione di stripSqlComments: le asserzioni testuali sopra
  // girano sul SQL con i commenti rimossi, il che è sicuro SOLO finché nessuna
  // stringa letterale contiene `--` (che lo strip di riga taglierebbe a metà).
  // Invece di lasciare l'assunzione implicita, la ENFORCIAMO: ri-parsiamo il
  // testo strippato e pretendiamo che (a) parsi ancora senza errori e (b)
  // produca LO STESSO numero di statement del SQL grezzo. Un `--` dentro un
  // literal (es. default '--') corromperebbe lo strip e farebbe scattare qui
  // un'asserzione chiara, invece di alterare in silenzio un text check a valle.
  it('stripSqlComments non corrompe il SQL (stesso parse, stesso conteggio)', () => {
    const raw = userSettings?.sql ?? '';
    const stripped = stripSqlComments(raw);

    const rawParse = pg.parse(raw);
    const strippedParse = pg.parse(stripped);

    expect(rawParse.error, 'il SQL grezzo non parsa').toBeNull();
    expect(
      strippedParse.error,
      `lo strip ha reso il SQL non parsabile: ${strippedParse.error?.message ?? ''}`,
    ).toBeNull();
    expect(
      strippedParse.parse_tree.stmts.length,
      'lo strip dei commenti ha cambiato il numero di statement (un `--` in un literal?)',
    ).toBe(rawParse.parse_tree.stmts.length);
  });
});

// ---------------------------------------------------------------------------
// Gate di config: l'apply solo su main, mai su PR (AC1 / AC2 «non su PR»).
// ---------------------------------------------------------------------------

// Config EFFETTIVA dei workflow: commenti YAML rimossi, così i gate ispezionano
// i trigger/step reali e non la prosa dei commenti che nomina di proposito
// pull_request/workflow_dispatch per spiegarne l'assenza.
const migrateYml = stripYamlComments(
  readFileSync(join(repoRoot, '.github', 'workflows', 'migrate.yml'), 'utf-8'),
);
const ciYml = stripYamlComments(
  readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf-8'),
);

describe('workflow — l\'apply raggiunge solo main, mai una PR', () => {
  // Riga "apply solo su main": migrate.yml dichiara db push e gira su push a
  // main. Se qualcuno spostasse l'apply su un altro trigger, questi test lo
  // colgono prima del merge.
  it('migrate.yml esegue supabase db push', () => {
    expect(migrateYml).toMatch(/supabase\s+db\s+push/);
  });

  it('migrate.yml gira su push a main', () => {
    // on: push: branches: [main]
    expect(migrateYml).toMatch(/on:/);
    expect(migrateYml).toMatch(/push:/);
    expect(migrateYml).toMatch(/branches:\s*\[\s*main\s*\]/);
  });

  // Gate meccanico di AD-12/AD-13: migrate.yml NON contiene mai pull_request.
  // Un apply che raggiungesse una PR distruggerebbe i dati dell'owner (M1).
  it('migrate.yml NON contiene pull_request', () => {
    expect(migrateYml).not.toMatch(/pull_request/);
  });

  // Nessun workflow_dispatch: dalla UI si potrebbe scegliere un ramo di PR e
  // applicare uno schema non revisionato.
  it('migrate.yml NON contiene workflow_dispatch', () => {
    expect(migrateYml).not.toMatch(/workflow_dispatch/);
  });

  // ci.yml (lint/typecheck/test/build/contrast/graph) gira su pull_request e
  // push:[main] ma NON deve MAI applicare lo schema.
  it('ci.yml NON esegue db push', () => {
    expect(ciYml).not.toMatch(/db\s+push/);
  });
});
