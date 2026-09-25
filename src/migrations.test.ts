import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import PgQueryModule, {
  type PgParseResult,
  type PgQueryModule as PgQuery,
} from 'pg-query-emscripten';
import { beforeAll, describe, expect, it } from 'vitest';
import { LEITNER_INTERVALS_DAYS, REVIEW_OUTCOMES } from './domain/schedule';

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

// pg-query-emscripten gira su un heap WASM che non si libera fra una parse e
// l'altra: oltre una certa quota di invocazioni ripetute il modulo va in crash
// (`… is not a function`). Poiché le asserzioni parsano SPESSO lo stesso testo,
// memoizziamo il risultato per stringa: ogni SQL distinto attraversa il WASM UNA
// sola volta, e le decine di `parse` dei test diventano una manciata di
// invocazioni reali. Il risultato è deterministico (stesso testo ⇒ stesso AST),
// quindi la cache non altera il significato dei test.
const parseCache = new Map<string, PgParseResult>();
function parseSql(sql: string): PgParseResult {
  const cached = parseCache.get(sql);
  if (cached !== undefined) return cached;
  const res = pg.parse(sql);
  parseCache.set(sql, res);
  return res;
}

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
      const res: PgParseResult = parseSql(sql);
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
    const res = parseSql('creat table t (id uuid);');
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
    const res = parseSql(sql);
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
    const res = parseSql(userSettings?.sql ?? '');
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
    const res = parseSql(sql);
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

    const rawParse = parseSql(raw);
    const strippedParse = parseSql(stripped);

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

// ---------------------------------------------------------------------------
// Story 3.7 — Asserzioni strutturali sulla migrazione lesson/exercise (AC1).
//
// Le tabelle del contenuto nascono in SOLA LETTURA: schema canonico esatto, RLS
// abilitata su entrambe, UNA policy select `to authenticated` per tabella e
// ZERO policy di scrittura. FK exercise.lesson_id → lesson(id) cascade, CHECK sul
// registro chiuso di `kind`. (Il file di SEED è coperto dal loop generico «ogni
// *.sql parsa» sopra: qui asseriamo il DDL.)
// ---------------------------------------------------------------------------

const lessonExercise = migrations.find((m) =>
  m.name.endsWith('_create_lesson_and_exercise.sql'),
);

describe('migrazione lesson/exercise — contenuto in sola lettura (AC1)', () => {
  it('la migrazione esiste', () => {
    expect(
      lessonExercise,
      'atteso un file *_create_lesson_and_exercise.sql',
    ).toBeDefined();
  });

  // Via AST: le due create table espongono ESATTAMENTE le colonne canoniche.
  it('lesson ed exercise espongono esattamente le colonne canoniche (via AST)', () => {
    const res = parseSql(lessonExercise?.sql ?? '');
    expect(res.error).toBeNull();

    const createStmts = res.parse_tree.stmts
      .map((s) => s.stmt.CreateStmt)
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    expect(createStmts.length).toBe(2);

    const columnsOf = (relname: string): (string | undefined)[] => {
      const create = createStmts.find((c) => c.relation?.relname === relname);
      return (create?.tableElts ?? [])
        .map((elt) => elt.ColumnDef?.colname)
        .filter((n): n is string => typeof n === 'string');
    };

    expect(columnsOf('lesson')).toEqual([
      'id',
      'ordinal',
      'title_en',
      'title_it',
      'grammar_points',
    ]);
    expect(columnsOf('exercise')).toEqual([
      'id',
      'lesson_id',
      'kind',
      'payload',
      'grammar_point',
      'explanation_en',
      'explanation_it',
    ]);
  });

  // Via AST: exercise.lesson_id è FK verso lesson(id) on delete cascade.
  it('exercise.lesson_id è FK cascade verso lesson (via AST)', () => {
    const res = parseSql(lessonExercise?.sql ?? '');
    const create = res.parse_tree.stmts
      .map((s) => s.stmt.CreateStmt)
      .find((c) => c?.relation?.relname === 'exercise');

    const lessonIdCol = (create?.tableElts ?? [])
      .map((elt) => elt.ColumnDef)
      .find((c) => c?.colname === 'lesson_id');
    expect(lessonIdCol, 'colonna lesson_id assente').toBeDefined();

    const constraints = (lessonIdCol?.constraints ?? [])
      .map((c) => c.Constraint)
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    const fk = constraints.find((c) => c.contype === 'CONSTR_FOREIGN');
    expect(fk, 'lesson_id non ha un vincolo FOREIGN KEY').toBeDefined();
    expect(fk?.pktable?.relname).toBe('lesson');
    // fk_del_action 'c' = cascade.
    expect(fk?.fk_del_action, 'FK non è on delete cascade').toBe('c');
  });

  // Testo: FK cascade ridondante a colpo d'occhio del diff.
  it('il testo dichiara on delete cascade verso lesson (id)', () => {
    const sql = stripSqlComments(lessonExercise?.sql ?? '').toLowerCase();
    expect(sql).toMatch(/references\s+lesson\s*\(\s*id\s*\)\s+on\s+delete\s+cascade/);
  });

  // RLS abilitata su ENTRAMBE le tabelle: senza, la chiave anonima pubblicabile
  // leggerebbe ogni riga (AD-10). Il contenuto è pubblico agli autenticati, non a
  // chiunque; e la scrittura resta negata dal non avere policy.
  it('abilita row level security su lesson ed exercise', () => {
    const sql = stripSqlComments(lessonExercise?.sql ?? '').toLowerCase();
    expect(sql).toMatch(/alter\s+table\s+lesson\s+enable\s+row\s+level\s+security/);
    expect(sql).toMatch(/alter\s+table\s+exercise\s+enable\s+row\s+level\s+security/);
  });

  // Via AST: ESATTAMENTE due policy, entrambe `select`, una per tabella. Nessuna
  // policy insert/update/delete (con RLS attiva e nessuna policy di scrittura, la
  // scrittura è negata per default — è il cuore della «sola lettura»).
  it('dichiara solo due policy select, nessuna policy di scrittura (via AST)', () => {
    const res = parseSql(lessonExercise?.sql ?? '');
    expect(res.error).toBeNull();

    const policyCommands = res.parse_tree.stmts
      .map((s) => s.stmt.CreatePolicyStmt as { cmd_name?: string } | undefined)
      .filter((p): p is { cmd_name?: string } => p !== undefined)
      .map((p) => p.cmd_name);

    expect(policyCommands.length).toBe(2);
    // Entrambe sono `select`; nessun insert/update/delete.
    expect(new Set(policyCommands)).toEqual(new Set(['select']));
  });

  // Testo: le due policy select sono `to authenticated`; nessuna di scrittura.
  it('ogni policy è for select to authenticated', () => {
    const sql = stripSqlComments(lessonExercise?.sql ?? '').toLowerCase();

    const selectCount = (sql.match(/for\s+select/g) ?? []).length;
    expect(selectCount).toBe(2);

    const authenticatedCount = (sql.match(/to\s+authenticated/g) ?? []).length;
    expect(authenticatedCount).toBe(2);

    // Nessuna policy di scrittura: la sola-lettura dipende dalla loro assenza.
    expect(sql).not.toMatch(/for\s+insert/);
    expect(sql).not.toMatch(/for\s+update/);
    expect(sql).not.toMatch(/for\s+delete/);
  });

  // Il registro dei kind è CHIUSO (AD-22): un CHECK vincola i tre soli valori.
  it('vincola kind al registro chiuso via CHECK', () => {
    const sql = stripSqlComments(lessonExercise?.sql ?? '').toLowerCase();
    expect(sql).toMatch(/check\s*\(\s*kind\s+in\s*\(/);
    expect(sql).toContain("'single-select'");
    expect(sql).toContain("'select-span'");
    expect(sql).toContain("'assemble'");
  });

  // ordinal è unique DEFERRABLE INITIALLY DEFERRED: un riordino in un unico seed
  // non deve violare l'unicità a metà statement.
  it('ordinal è unique deferrable initially deferred', () => {
    const sql = stripSqlComments(lessonExercise?.sql ?? '').toLowerCase();
    expect(sql).toMatch(/ordinal\s+int\s+not\s+null\s+unique\s+deferrable\s+initially\s+deferred/);
  });
});

// ---------------------------------------------------------------------------
// Story 3.8 — Asserzioni strutturali sulla migrazione review_state / review_log /
// lesson_progress (AC1–AC5).
//
// Le tre tabelle PER-UTENTE nascono ISOLATE PER RIGA: schema canonico esatto, FK
// user_id cascade verso auth.users su TUTTE E TRE, RLS abilitata su tutte, 4
// policy owner-scoped su review_state/lesson_progress e SOLO 2 (select/insert) su
// review_log (append-only), CHECK sullo stadio DERIVATO dalla scala Leitner e
// CHECK sull'esito allineato all'insieme REVIEW_OUTCOMES. La prova RLS a runtime
// (A non legge/scrive le righe di B) è differita a Epic 7 (7.5) — vedi frontmatter
// `deferred`: qui si prova la STRUTTURA (RLS + policy + cascata), condizione
// necessaria e meccanicamente verificabile offline (AD-12/AD-13).
// ---------------------------------------------------------------------------

const reviewProgress = migrations.find((m) =>
  m.name.endsWith('_create_review_and_progress.sql'),
);

/**
 * Ritorna la CreateStmt di `relname` dall'AST di una migrazione (o undefined).
 * Usato dai test per tabella: si parsa una volta, si estrae la tabella cercata.
 */
function createTableOf(parse: PgParseResult, relname: string) {
  return parse.parse_tree.stmts
    .map((s) => s.stmt.CreateStmt)
    .find((c) => c?.relation?.relname === relname);
}

describe('migrazione review/progress — progresso per-utente e isolato (Story 3.8)', () => {
  // AC1 (guardia anti-vacuità): la migrazione esiste. Senza, ogni asserzione qui
  // sotto su `reviewProgress?.sql ?? ''` girerebbe su stringa vuota e passerebbe
  // vuota. Il timestamp deve essere > dell'ultima esistente (20260925090001).
  it('la migrazione esiste', () => {
    expect(
      reviewProgress,
      'atteso un file *_create_review_and_progress.sql',
    ).toBeDefined();
    // Timestamp > dell'ultima migrazione esistente: db push le applica in ordine.
    const version = reviewProgress?.name.slice(0, 14) ?? '';
    // Guardia sulla FORMA: 14 cifre esatte. Senza, un prefisso malformato (troppo
    // corto, o con lettere) passerebbe silenziosamente il confronto lessicografico
    // d'ordine invece di fallire in modo esplicito.
    expect(version).toMatch(/^\d{14}$/);
    expect(version > '20260925090001', `timestamp ${version} non è > 20260925090001`).toBe(true);
  });

  // AC1 (righe "Migrazione ben formata" + "Schema minimo"): via AST, le TRE
  // create table espongono ESATTAMENTE le colonne canoniche. Una colonna in
  // più/meno (created_at, updated_at, …) fa fallire — è il gate di «minimalità».
  it('le tre tabelle espongono esattamente le colonne canoniche (via AST)', () => {
    const res = parseSql(reviewProgress?.sql ?? '');
    expect(res.error).toBeNull();

    const createStmts = res.parse_tree.stmts
      .map((s) => s.stmt.CreateStmt)
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    expect(createStmts.length).toBe(3);

    const columnsOf = (relname: string): (string | undefined)[] => {
      const create = createStmts.find((c) => c.relation?.relname === relname);
      return (create?.tableElts ?? [])
        .map((elt) => elt.ColumnDef?.colname)
        .filter((n): n is string => typeof n === 'string');
    };

    expect(columnsOf('review_state')).toEqual([
      'user_id',
      'exercise_id',
      'stage',
      'due_at',
      'review_count',
      'lapse_count',
      'last_reviewed_at',
    ]);
    expect(columnsOf('review_log')).toEqual([
      'id',
      'user_id',
      'exercise_id',
      'grammar_point',
      'outcome',
      'used_explanation',
      'reviewed_at',
    ]);
    expect(columnsOf('lesson_progress')).toEqual([
      'user_id',
      'lesson_id',
      'unlocked_at',
    ]);
  });

  // AC1 (schema canonico, oltre ai NOMI): via AST, ogni colonna delle tre tabelle
  // ha il TIPO e la NULLABILITÀ attesi. Il test dei nomi sopra non coglierebbe una
  // colonna `stage text` invece di `int`, né un `due_at` reso nullable: qui sì. Il
  // tipo si legge dall'ULTIMO segmento di `typeName.names` (pg_query normalizza e
  // antepone `pg_catalog` a `int4`/`bool`, quindi si prende l'ultimo). Si accettano
  // le forme equivalenti (`int`↔`int4`, `boolean`↔`bool`). La nullabilità: una
  // colonna è not-null se ha un `CONSTR_NOTNULL`, oppure è PK di colonna
  // (`CONSTR_PRIMARY`), oppure fa parte della PK COMPOSITE (not-null implicito).
  it('ogni colonna ha il tipo e la nullabilità canonici (via AST)', () => {
    const res = parseSql(reviewProgress?.sql ?? '');
    expect(res.error).toBeNull();

    // Forme di tipo equivalenti accettate (l'AST può normalizzare l'alias SQL).
    const TYPE_ALIASES: Record<string, readonly string[]> = {
      int: ['int', 'int4'],
      timestamptz: ['timestamptz'],
      boolean: ['boolean', 'bool'],
      uuid: ['uuid'],
      text: ['text'],
    };

    // Tipo canonico atteso per ogni colonna, per tabella.
    const expectedTypes: Record<string, Record<string, keyof typeof TYPE_ALIASES>> = {
      review_state: {
        user_id: 'uuid',
        exercise_id: 'uuid',
        stage: 'int',
        due_at: 'timestamptz',
        review_count: 'int',
        lapse_count: 'int',
        last_reviewed_at: 'timestamptz',
      },
      review_log: {
        id: 'uuid',
        user_id: 'uuid',
        exercise_id: 'uuid',
        grammar_point: 'text',
        outcome: 'text',
        used_explanation: 'boolean',
        reviewed_at: 'timestamptz',
      },
      lesson_progress: {
        user_id: 'uuid',
        lesson_id: 'text',
        unlocked_at: 'timestamptz',
      },
    };

    // L'UNICA colonna nullable delle tre tabelle: tutto il resto è not null.
    const nullableColumns = new Set(['review_state.last_reviewed_at']);

    // Le porzioni dell'AST non modellate dalla d.ts del pacchetto (vincolo di
    // TABELLA e `typeName` di colonna) le leggiamo con tipi locali, come il test
    // delle policy fa per CreatePolicyStmt: la d.ts resta invariata (tocchiamo solo
    // questo file di test).
    type TableConstraintElt = {
      readonly Constraint?: {
        readonly contype?: string;
        readonly keys?: readonly { readonly String?: { readonly sval?: string } }[];
      };
    };
    type ColumnWithType = {
      readonly typeName?: {
        readonly names?: readonly { readonly String?: { readonly sval?: string } }[];
      };
    };

    for (const [relname, typeByCol] of Object.entries(expectedTypes)) {
      const create = createTableOf(res, relname);
      expect(create, `tabella ${relname} assente`).toBeDefined();

      // Colonne che compongono la PK composite (not-null implicito).
      const pkKeys = new Set(
        (create?.tableElts ?? [])
          .map((elt) => (elt as TableConstraintElt).Constraint)
          .filter((c): c is NonNullable<typeof c> => c?.contype === 'CONSTR_PRIMARY')
          .flatMap((c) => (c.keys ?? []).map((k) => k.String?.sval))
          .filter((n): n is string => typeof n === 'string'),
      );

      for (const [colname, expectedType] of Object.entries(typeByCol)) {
        const col = (create?.tableElts ?? [])
          .map((elt) => elt.ColumnDef)
          .find((c) => c?.colname === colname);
        expect(col, `colonna ${relname}.${colname} assente`).toBeDefined();

        // Tipo: ultimo segmento di typeName.names.
        const typeNames = ((col as ColumnWithType | undefined)?.typeName?.names ?? [])
          .map((n) => n.String?.sval)
          .filter((n): n is string => typeof n === 'string');
        const actualType = typeNames[typeNames.length - 1];
        expect(
          TYPE_ALIASES[expectedType],
          `tipo di ${relname}.${colname}: atteso ${expectedType} (${TYPE_ALIASES[expectedType].join('|')}), trovato ${actualType}`,
        ).toContain(actualType);

        // Nullabilità.
        const contypes = (col?.constraints ?? [])
          .map((k) => k.Constraint?.contype)
          .filter((t): t is string => typeof t === 'string');
        const isNotNull =
          contypes.includes('CONSTR_NOTNULL') ||
          contypes.includes('CONSTR_PRIMARY') ||
          pkKeys.has(colname);

        if (nullableColumns.has(`${relname}.${colname}`)) {
          expect(isNotNull, `${relname}.${colname} dovrebbe essere nullable`).toBe(false);
        } else {
          expect(isNotNull, `${relname}.${colname} dovrebbe essere not null`).toBe(true);
        }
      }
    }
  });

  // AC1 (default): review_count e lapse_count sono `int not null default 0`. Un
  // contatore senza default costringerebbe apply_review (3.9) a scrivere lo zero a
  // mano; il default 0 è parte dello schema canonico. Verifica testuale sul SQL
  // strippato, come il test di user_settings per `locale ... default 'en'`.
  it('review_count e lapse_count sono int not null default 0', () => {
    const sql = stripSqlComments(reviewProgress?.sql ?? '').toLowerCase();
    expect(sql).toMatch(/review_count\s+int\s+not\s+null\s+default\s+0/);
    expect(sql).toMatch(/lapse_count\s+int\s+not\s+null\s+default\s+0/);
  });

  // AC5 (riga "Cascata account"): via AST, il `user_id` di CIASCUNA delle tre
  // tabelle è FK verso auth.users (id) on delete cascade. Se manca su una, rosso.
  it('user_id è FK cascade verso auth.users su tutte e tre (via AST)', () => {
    const res = parseSql(reviewProgress?.sql ?? '');
    expect(res.error).toBeNull();

    for (const relname of ['review_state', 'review_log', 'lesson_progress']) {
      const create = createTableOf(res, relname);
      const userIdCol = (create?.tableElts ?? [])
        .map((elt) => elt.ColumnDef)
        .find((c) => c?.colname === 'user_id');
      expect(userIdCol, `colonna user_id assente in ${relname}`).toBeDefined();

      const constraints = (userIdCol?.constraints ?? [])
        .map((c) => c.Constraint)
        .filter((c): c is NonNullable<typeof c> => c !== undefined);

      const fk = constraints.find((c) => c.contype === 'CONSTR_FOREIGN');
      expect(fk, `user_id di ${relname} non ha FK`).toBeDefined();
      expect(fk?.pktable?.schemaname, `FK di ${relname} non punta a schema auth`).toBe('auth');
      expect(fk?.pktable?.relname, `FK di ${relname} non punta a users`).toBe('users');
      // fk_del_action 'c' = cascade: la cancellazione dell'utente propaga (AD-11).
      expect(fk?.fk_del_action, `FK user_id di ${relname} non è on delete cascade`).toBe('c');
    }
  });

  // AC5 / boundary "Never" (nessuna FK di contenuto su review_log): review_log ha
  // UNA SOLA FK a livello colonna (user_id → auth.users). exercise_id NON è FK: il
  // log è indipendente e durevole; una FK cascade verso exercise rifarebbe
  // dipendere le statistiche dal contenuto mutabile.
  it('review_log ha una sola FK (user_id), nessuna FK di contenuto (via AST)', () => {
    const res = parseSql(reviewProgress?.sql ?? '');
    const create = createTableOf(res, 'review_log');

    const fkColumns = (create?.tableElts ?? [])
      .map((elt) => elt.ColumnDef)
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .filter((c) =>
        (c.constraints ?? []).some((k) => k.Constraint?.contype === 'CONSTR_FOREIGN'),
      )
      .map((c) => c.colname);

    expect(fkColumns).toEqual(['user_id']);
    // exercise_id NON deve essere FK.
    expect(fkColumns).not.toContain('exercise_id');
  });

  // review_state.exercise_id → exercise(id) cascade e lesson_progress.lesson_id →
  // lesson(id) cascade: lo stato/progresso è legato al contenuto vivo (via AST).
  it('review_state.exercise_id → exercise e lesson_progress.lesson_id → lesson, entrambe cascade (via AST)', () => {
    const res = parseSql(reviewProgress?.sql ?? '');

    const fkOf = (relname: string, colname: string) => {
      const create = createTableOf(res, relname);
      const col = (create?.tableElts ?? [])
        .map((elt) => elt.ColumnDef)
        .find((c) => c?.colname === colname);
      return (col?.constraints ?? [])
        .map((c) => c.Constraint)
        .find((c) => c?.contype === 'CONSTR_FOREIGN');
    };

    const exFk = fkOf('review_state', 'exercise_id');
    expect(exFk, 'review_state.exercise_id non ha FK').toBeDefined();
    expect(exFk?.pktable?.relname).toBe('exercise');
    expect(exFk?.fk_del_action, 'FK exercise_id non è cascade').toBe('c');

    const lsFk = fkOf('lesson_progress', 'lesson_id');
    expect(lsFk, 'lesson_progress.lesson_id non ha FK').toBeDefined();
    expect(lsFk?.pktable?.relname).toBe('lesson');
    expect(lsFk?.fk_del_action, 'FK lesson_id non è cascade').toBe('c');
  });

  // AC1 (PK composite, via testo): review_state e lesson_progress hanno PK
  // composite; review_log ha PK su id.
  it('le PK composite e la PK di review_log sono dichiarate (testo)', () => {
    const sql = stripSqlComments(reviewProgress?.sql ?? '').toLowerCase();
    expect(sql).toMatch(/primary\s+key\s*\(\s*user_id\s*,\s*exercise_id\s*\)/);
    expect(sql).toMatch(/primary\s+key\s*\(\s*user_id\s*,\s*lesson_id\s*\)/);
    expect(sql).toMatch(/id\s+uuid\s+primary\s+key/);
  });

  // AC5 (riga "Isolamento per riga"): RLS abilitata su tutte e tre. Senza, la
  // chiave anonima pubblicabile leggerebbe ogni riga (AD-10).
  it('abilita row level security su tutte e tre le tabelle', () => {
    const sql = stripSqlComments(reviewProgress?.sql ?? '').toLowerCase();
    for (const t of ['review_state', 'review_log', 'lesson_progress']) {
      expect(sql).toMatch(
        new RegExp(`alter\\s+table\\s+${t}\\s+enable\\s+row\\s+level\\s+security`),
      );
    }
  });

  // AC5 (righe "Isolamento per riga" + "Append-only del log", via AST): conteggio
  // e comandi delle policy per tabella. review_state e lesson_progress: 4 policy
  // (select/insert/update/delete). review_log: SOLO 2 (select/insert), ZERO
  // update/delete — l'append-only è imposto dall'assenza di policy (default-deny).
  it('conta le policy per tabella: 4/4/2 e i comandi coperti (via AST)', () => {
    const res = parseSql(reviewProgress?.sql ?? '');
    expect(res.error).toBeNull();

    const policies = res.parse_tree.stmts
      .map(
        (s) =>
          s.stmt.CreatePolicyStmt as
            | { cmd_name?: string; table?: { relname?: string } }
            | undefined,
      )
      .filter((p): p is { cmd_name?: string; table?: { relname?: string } } => p !== undefined);

    const commandsFor = (relname: string): Set<string | undefined> =>
      new Set(policies.filter((p) => p.table?.relname === relname).map((p) => p.cmd_name));

    const reviewStateCmds = commandsFor('review_state');
    expect(reviewStateCmds.size).toBe(4);
    expect(reviewStateCmds).toEqual(new Set(['select', 'insert', 'update', 'delete']));

    const lessonProgressCmds = commandsFor('lesson_progress');
    expect(lessonProgressCmds.size).toBe(4);
    expect(lessonProgressCmds).toEqual(new Set(['select', 'insert', 'update', 'delete']));

    const reviewLogCmds = commandsFor('review_log');
    expect(reviewLogCmds.size).toBe(2);
    expect(reviewLogCmds).toEqual(new Set(['select', 'insert']));
    // Append-only: nessuna policy update/delete su review_log.
    expect(reviewLogCmds.has('update')).toBe(false);
    expect(reviewLogCmds.has('delete')).toBe(false);
  });

  // Ogni policy owner-scoped: `to authenticated` e la sottoquery (select
  // auth.uid()) = user_id (10 policy in totale: 4 + 4 + 2).
  it('ogni policy è to authenticated e usa (select auth.uid()) = user_id', () => {
    const sql = stripSqlComments(reviewProgress?.sql ?? '').toLowerCase();

    const authenticatedCount = (sql.match(/to\s+authenticated/g) ?? []).length;
    expect(authenticatedCount).toBe(10);

    // Il predicato owner-scoped compare ESATTAMENTE 12 volte, non «almeno 10». Il
    // conto: 10 policy in totale, ma le due `update` (review_state e
    // lesson_progress) portano il predicato DUE volte ciascuna (using + with
    // check). Quindi review_state = 5 (select+insert+delete = 3, update = 2),
    // lesson_progress = 5, review_log = 2 (select+insert) → 5 + 5 + 2 = 12.
    // L'uguaglianza esatta impedisce che una policy che PERDE il proprio predicato
    // owner-scoped venga compensata da un'altra che ne ha uno di troppo.
    const ownerScopedCount = (
      sql.match(/\(\s*select\s+auth\.uid\(\)\s*\)\s*=\s*user_id/g) ?? []
    ).length;
    expect(ownerScopedCount).toBe(12);
  });

  // AC3 (riga "Scala dello stadio"): il CHECK su review_state.stage NON è un
  // elenco parallelo — il limite superiore SQL === LEITNER_INTERVALS_DAYS.length -
  // 1 (import da ./domain/schedule). Un drift della scala qui è CI rossa.
  it('il CHECK su stage deriva dalla scala Leitner (limite superiore === length - 1)', () => {
    const sql = stripSqlComments(reviewProgress?.sql ?? '').toLowerCase();
    const maxStage = LEITNER_INTERVALS_DAYS.length - 1;
    const match = sql.match(/check\s*\(\s*stage\s+between\s+0\s+and\s+(\d+)\s*\)/);
    expect(match, 'CHECK (stage between 0 and N) assente').not.toBeNull();
    expect(Number(match?.[1])).toBe(maxStage);
  });

  // AC4 (riga "Insieme degli esiti"): il CHECK su review_log.outcome contiene
  // ESATTAMENTE l'insieme di REVIEW_OUTCOMES (import da ./domain/schedule). I due
  // insiemi divergono ⇒ rosso.
  it('il CHECK su outcome === set(REVIEW_OUTCOMES)', () => {
    const sql = stripSqlComments(reviewProgress?.sql ?? '');
    const match = sql.match(/check\s*\(\s*outcome\s+in\s*\(([^)]*)\)\s*\)/i);
    expect(match, 'CHECK (outcome in (...)) assente').not.toBeNull();
    const sqlOutcomes = new Set(
      (match?.[1] ?? '')
        .split(',')
        .map((s) => s.trim().replace(/^'|'$/g, ''))
        .filter((s) => s.length > 0),
    );
    expect(sqlOutcomes).toEqual(new Set(REVIEW_OUTCOMES));
  });

  // AC2 (riga "Migrazione ben formata"): la denormalizzazione di grammar_point è
  // documentata — un commento dichiara che una statistica non può dipendere da
  // dati mutabili che una riautorazione riscriverebbe. Si ispeziona il SQL GREZZO
  // (il commento vive proprio nei commenti, che stripSqlComments toglierebbe).
  it('documenta la denormalizzazione di grammar_point (commento nel SQL grezzo)', () => {
    const raw = (reviewProgress?.sql ?? '').toLowerCase();
    expect(raw).toContain('denormalizzato');
    expect(raw).toMatch(/statistica\s+non\s+può\s+dipendere\s+da\s+dati\s+mutabili/);
    expect(raw).toMatch(/riautorazione/);
  });

  // Boundary/append-only (commento): il file dichiara PERCHÉ review_log è
  // append-only (default-deny di RLS, non trigger).
  it('documenta l\'append-only di review_log (commento nel SQL grezzo)', () => {
    const raw = (reviewProgress?.sql ?? '').toLowerCase();
    expect(raw).toContain('append-only');
  });

  // Guardia sull'assunzione di stripSqlComments (come per user_settings): il SQL
  // strippato deve parsare ancora e produrre lo STESSO numero di statement, così
  // un `--` in un literal non corrompe in silenzio le asserzioni testuali.
  it('stripSqlComments non corrompe il SQL (stesso parse, stesso conteggio)', () => {
    const rawSql = reviewProgress?.sql ?? '';
    const stripped = stripSqlComments(rawSql);

    const rawParse = parseSql(rawSql);
    const strippedParse = parseSql(stripped);

    expect(rawParse.error, 'il SQL grezzo non parsa').toBeNull();
    expect(
      strippedParse.error,
      `lo strip ha reso il SQL non parsabile: ${strippedParse.error?.message ?? ''}`,
    ).toBeNull();
    expect(strippedParse.parse_tree.stmts.length).toBe(rawParse.parse_tree.stmts.length);
  });
});
