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

// ---------------------------------------------------------------------------
// Story 3.9 — Asserzioni strutturali sulla RPC apply_review (AC1–AC4).
//
// La funzione è la SOLA via per persistere una risposta, e nasce IDEMPOTENTE. Si
// verifica OFFLINE la condizione STRUTTURALE necessaria (AD-12/AD-13, come ogni
// migrazione): (AC1) la firma canonica di AD-7 — 7 parametri con nomi/tipi/ordine
// esatti, `returns void`; (AC2) il corpo è UNA sola istruzione, un `update` di
// review_state guardato da un CTE `logged` il cui `insert` su review_log ha
// `on conflict (id) do nothing` (idempotenza) e `from logged` (la guardia); (AC4)
// `stage`/`due_at` sono PASSTHROUGH dai parametri (ColumnRef, non un'espressione
// calcolata) e il corpo non contiene aritmetica di scheduling (`interval`, valori
// della scala Leitner). La prova a RUNTIME dell'idempotenza (riapplicare due volte
// NON produce un secondo log né un secondo avanzamento) è di Epic 4 / storia 4.5 —
// vedi frontmatter `deferred`: pg-query-emscripten PARSA soltanto, non esegue.
// ---------------------------------------------------------------------------

const applyReview = migrations.find((m) => m.name.endsWith('_create_apply_review.sql'));

/**
 * Porzioni dell'AST della `create function` non modellate dalla d.ts del
 * pacchetto, lette con tipi locali (come i test 3.8 fanno per il `typeName` di
 * colonna): la d.ts resta invariata, tocchiamo solo questo file di test.
 */
type PgString = { readonly String?: { readonly sval?: string } };
type FunctionParameterElt = {
  readonly FunctionParameter?: {
    readonly name?: string;
    readonly mode?: string;
    readonly argType?: { readonly names?: readonly PgString[] };
  };
};
type CreateFunctionStmt = {
  readonly funcname?: readonly PgString[];
  readonly parameters?: readonly FunctionParameterElt[];
  readonly returnType?: { readonly names?: readonly PgString[] };
  readonly options?: readonly {
    readonly DefElem?: {
      readonly defname?: string;
      // `as` porta il corpo (List di String); `language` una String; `security`
      // un Boolean (false = invoker, true = definer); `set` un VariableSetStmt.
      readonly arg?: {
        readonly List?: { readonly items?: readonly PgString[] };
        readonly String?: { readonly sval?: string };
        readonly Boolean?: { readonly boolval?: boolean };
        readonly VariableSetStmt?: {
          readonly name?: string;
          readonly args?: readonly {
            readonly A_Const?: { readonly sval?: { readonly sval?: string } };
          }[];
        };
      };
    };
  }[];
};

/** Ultimo segmento di una lista di nomi qualificati (`public.apply_review` → `apply_review`; `pg_catalog.int4` → `int4`). */
function lastSegment(names: readonly PgString[] | undefined): string | undefined {
  const segs = (names ?? [])
    .map((n) => n.String?.sval)
    .filter((s): s is string => typeof s === 'string');
  return segs[segs.length - 1];
}

/** Estrae la CreateFunctionStmt dall'AST di una migrazione (o undefined). */
function createFunctionOf(parse: PgParseResult): CreateFunctionStmt | undefined {
  return parse.parse_tree.stmts
    .map((s) => (s.stmt as { CreateFunctionStmt?: CreateFunctionStmt }).CreateFunctionStmt)
    .find((c): c is CreateFunctionStmt => c !== undefined);
}

/**
 * Estrae il TESTO del corpo della funzione dall'opzione `as`
 * (`options[].DefElem` con `defname === 'as'`, poi `arg.List.items[0].String.sval`).
 */
function functionBodyOf(fn: CreateFunctionStmt | undefined): string | undefined {
  const asOpt = (fn?.options ?? []).find((o) => o.DefElem?.defname === 'as');
  return asOpt?.DefElem?.arg?.List?.items?.[0]?.String?.sval;
}

describe('migrazione apply_review — una risposta, una chiamata, nessun doppione (Story 3.9)', () => {
  // Guardia anti-vacuità: la migrazione esiste e il timestamp è > dell'ultima
  // esistente (20260925101500, review_and_progress). Senza, ogni asserzione qui
  // sotto su `applyReview?.sql ?? ''` girerebbe su stringa vuota e passerebbe vuota.
  it('la migrazione esiste e il timestamp è > 20260925101500', () => {
    expect(applyReview, 'atteso un file *_create_apply_review.sql').toBeDefined();
    const version = applyReview?.name.slice(0, 14) ?? '';
    expect(version).toMatch(/^\d{14}$/);
    expect(
      version > '20260925101500',
      `timestamp ${version} non è > 20260925101500`,
    ).toBe(true);
  });

  // AC1 (righe "Funzione ben formata" + "Firma canonica"): via AST, la
  // CreateFunctionStmt è `public.apply_review`, con i 7 parametri nei nomi/tipi/
  // ordine esatti (`int`↔`int4`, `boolean`↔`bool` via TYPE_ALIASES) e `returns void`.
  it('la firma canonica di AD-7: apply_review, 7 parametri esatti, returns void (via AST)', () => {
    const res = parseSql(applyReview?.sql ?? '');
    expect(res.error).toBeNull();

    const fn = createFunctionOf(res);
    expect(fn, 'nessuna create function nella migrazione').toBeDefined();

    // funcname: ultimo segmento `apply_review`, primo `public`.
    expect(lastSegment(fn?.funcname)).toBe('apply_review');
    expect(fn?.funcname?.[0]?.String?.sval).toBe('public');

    // returns void.
    expect(lastSegment(fn?.returnType?.names)).toBe('void');

    // Forme di tipo equivalenti accettate (l'AST normalizza int→int4, boolean→bool).
    const TYPE_ALIASES: Record<string, readonly string[]> = {
      uuid: ['uuid'],
      text: ['text'],
      int: ['int', 'int4'],
      timestamptz: ['timestamptz'],
      boolean: ['boolean', 'bool'],
    };

    // I 7 parametri, nell'ORDINE esatto della firma AD-7.
    const expectedParams: readonly [string, keyof typeof TYPE_ALIASES][] = [
      ['review_id', 'uuid'],
      ['exercise_id', 'uuid'],
      ['outcome', 'text'],
      ['stage', 'int'],
      ['due_at', 'timestamptz'],
      ['reviewed_at', 'timestamptz'],
      ['used_explanation', 'boolean'],
    ];

    const params = (fn?.parameters ?? [])
      .map((p) => p.FunctionParameter)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    // Esattamente 7 parametri (nessuno in più: es. un `grammar_point` estraneo).
    expect(params.length).toBe(expectedParams.length);

    params.forEach((param, i) => {
      const [expectedName, expectedType] = expectedParams[i];
      // Nome e ORDINE.
      expect(param.name, `parametro #${i}: atteso ${expectedName}`).toBe(expectedName);
      // Tipo (ultimo segmento di argType.names).
      const actualType = lastSegment(param.argType?.names);
      expect(
        TYPE_ALIASES[expectedType],
        `tipo di ${expectedName}: atteso ${expectedType} (${TYPE_ALIASES[expectedType].join('|')}), trovato ${actualType}`,
      ).toContain(actualType);
    });
  });

  // AC1/AC2 (boundary "Always" — posture di sicurezza): la firma da sola non basta.
  // `language sql` è LOAD-BEARING per l'atomicità di AC2 (una funzione `language sql`
  // con una sola istruzione È già una transazione: senza, il ragionamento sulla
  // guardia cade). `security invoker` + `set search_path = ''` sono l'isolamento
  // dichiarativo: le scritture sono owner-scoped e le policy RLS di 3.8 le impongono
  // (insert `with check auth.uid() = user_id`), quindi l'invoker non serve elevato.
  // Nessuna asserzione le copriva: un refactor a `security definer` (che BYPASSA la
  // RLS) o un `search_path` caduto passerebbe ogni altro test in silenzio.
  it('la funzione è language sql, security invoker e set search_path = \'\' (via AST)', () => {
    const fn = createFunctionOf(parseSql(applyReview?.sql ?? ''));
    const options = fn?.options ?? [];
    const optByName = (name: string) =>
      options.find((o) => o.DefElem?.defname === name)?.DefElem;

    // language sql: l'atomicità di AC2 poggia su questo.
    expect(optByName('language')?.arg?.String?.sval, 'la funzione non è `language sql`').toBe('sql');

    // security invoker: `boolval` false = INVOKER, true = DEFINER. La clausola deve
    // essere PRESENTE ed essere invoker — `security definer` bypasserebbe la RLS.
    const security = optByName('security');
    expect(security, 'manca la clausola `security` (posture non dichiarata)').toBeDefined();
    expect(security?.arg?.Boolean?.boolval, 'la funzione non è `security invoker`').toBe(false);

    // set search_path = '': con la schema-qualificazione (`public.*`), blocca
    // l'iniezione di search_path.
    const setOpt = optByName('set')?.arg?.VariableSetStmt;
    expect(setOpt?.name, 'manca `set search_path`').toBe('search_path');
    const searchPathValues = (setOpt?.args ?? []).map((a) => a.A_Const?.sval?.sval);
    expect(searchPathValues, "`search_path` non è impostato alla stringa vuota").toEqual(['']);
  });

  // AC2 (righe "Prima applicazione" + "Ritentativo"): il corpo è UNA SOLA
  // istruzione — un `update` di review_state — con un CTE `logged` la cui query è
  // un `insert` su review_log con `on conflict (id) do nothing`, e un `from logged`
  // (la guardia). Si estrae il corpo dall'opzione `as`, lo si ri-parsa e lo si
  // ispeziona via AST.
  it('il corpo è una sola istruzione: update guardato da un insert idempotente (via AST)', () => {
    const res = parseSql(applyReview?.sql ?? '');
    const fn = createFunctionOf(res);
    const body = functionBodyOf(fn);
    expect(body, 'corpo della funzione non estratto dall\'opzione `as`').toBeDefined();

    const bodyRes = parseSql(body ?? '');
    expect(
      bodyRes.error,
      `il corpo della funzione non parsa: ${bodyRes.error?.message ?? ''}`,
    ).toBeNull();

    // ESATTAMENTE 1 statement: una sola istruzione ⇒ una sola transazione (AC2).
    expect(bodyRes.parse_tree.stmts.length).toBe(1);

    type OnConflictClause = {
      readonly action?: string;
      readonly infer?: {
        readonly indexElems?: readonly { readonly IndexElem?: { readonly name?: string } }[];
      };
    };
    // SelectStmt che alimenta l'INSERT: `fromClause` (le tabelle lette, per lo
    // SNAPSHOT) e `targetList` (i valori inseriti, per posizione).
    type SelectStmt = {
      readonly fromClause?: readonly { readonly RangeVar?: { readonly relname?: string } }[];
      readonly targetList?: readonly {
        readonly ResTarget?: {
          // Un valore è un ColumnRef (parametro/colonna joinata) o un FuncCall
          // (`auth.uid()` per user_id).
          readonly val?: {
            readonly ColumnRef?: { readonly fields?: readonly PgString[] };
            readonly FuncCall?: { readonly funcname?: readonly PgString[] };
          };
        };
      }[];
    };
    type InsertStmt = {
      readonly relation?: { readonly relname?: string };
      readonly cols?: readonly { readonly ResTarget?: { readonly name?: string } }[];
      readonly selectStmt?: { readonly SelectStmt?: SelectStmt };
      readonly onConflictClause?: OnConflictClause;
      // Il `returning` della CTE data-modifying: le righe che alimentano la guardia.
      readonly returningList?: readonly unknown[];
    };
    type Cte = {
      readonly CommonTableExpr?: {
        readonly ctename?: string;
        readonly ctequery?: { readonly InsertStmt?: InsertStmt };
      };
    };
    type UpdateStmt = {
      readonly relation?: { readonly relname?: string };
      readonly withClause?: { readonly ctes?: readonly Cte[] };
      readonly fromClause?: readonly { readonly RangeVar?: { readonly relname?: string } }[];
    };

    const update = (bodyRes.parse_tree.stmts[0].stmt as { UpdateStmt?: UpdateStmt }).UpdateStmt;
    expect(update, 'l\'unica istruzione non è un UPDATE').toBeDefined();
    // L'UPDATE è su review_state.
    expect(update?.relation?.relname).toBe('review_state');

    // withClause con ESATTAMENTE 1 CTE, chiamato `logged`.
    const ctes = update?.withClause?.ctes ?? [];
    expect(ctes.length).toBe(1);
    const cte = ctes[0]?.CommonTableExpr;
    expect(cte?.ctename).toBe('logged');

    // La query del CTE è un INSERT su review_log.
    const insert = cte?.ctequery?.InsertStmt;
    expect(insert, 'la query del CTE `logged` non è un INSERT').toBeDefined();
    expect(insert?.relation?.relname).toBe('review_log');

    // AC3 (struttura): `on conflict (id) do nothing` — l'idempotenza. L'azione è
    // NOTHING e l'inferenza è sulla colonna `id` (il review_id del client).
    expect(insert?.onConflictClause?.action).toBe('ONCONFLICT_NOTHING');
    const inferCols = (insert?.onConflictClause?.infer?.indexElems ?? [])
      .map((e) => e.IndexElem?.name)
      .filter((n): n is string => typeof n === 'string');
    expect(inferCols).toEqual(['id']);

    // AC2/AC3 (la guardia): `from logged`. Con `on conflict do nothing`, un
    // ritentativo non produce righe ⇒ il prodotto con `logged` è vuoto ⇒ 0 update.
    const fromRels = (update?.fromClause ?? [])
      .map((f) => f.RangeVar?.relname)
      .filter((n): n is string => typeof n === 'string');
    expect(fromRels).toContain('logged');

    // AC2/AC3 (PATCH 1 — la guardia regge SOLO con un `returning` non vuoto): senza
    // `returning`, la CTE `logged` non produrrebbe righe MAI e il `from logged`
    // renderebbe l'UPDATE morto anche alla PRIMA applicazione — la guardia si
    // invertirebbe in silenzio (il SQL parsa comunque). Pretendere ≥1 elemento nel
    // `returningList` blocca quella regressione.
    expect(
      (insert?.returningList ?? []).length,
      'l\'INSERT della CTE `logged` non ha un `returning` (la guardia si invertirebbe)',
    ).toBeGreaterThan(0);

    // AC (PATCH 2 — snapshot di grammar_point, prova STRUTTURALE, non più solo il
    // commento). (a) La lista colonne dell'INSERT è ESATTA e in ordine.
    const insertCols = (insert?.cols ?? [])
      .map((c) => c.ResTarget?.name)
      .filter((n): n is string => typeof n === 'string');
    expect(insertCols).toEqual([
      'id',
      'user_id',
      'exercise_id',
      'grammar_point',
      'outcome',
      'used_explanation',
      'reviewed_at',
    ]);

    // (b) Il SELECT che alimenta l'INSERT legge da `exercise`: è la FONTE dello
    // snapshot server-side di grammar_point (non arriva dalla firma).
    const select = insert?.selectStmt?.SelectStmt;
    const selectFromRels = (select?.fromClause ?? [])
      .map((f) => f.RangeVar?.relname)
      .filter((n): n is string => typeof n === 'string');
    expect(selectFromRels).toContain('exercise');

    // Helper: i campi (qualificatori) del ColumnRef nella posizione `i` del
    // targetList del SELECT. La posizione è vincolata all'ordine di `insertCols`.
    const selectTargets = select?.targetList ?? [];
    const fieldsAt = (i: number): string[] =>
      (selectTargets[i]?.ResTarget?.val?.ColumnRef?.fields ?? [])
        .map((f) => f.String?.sval)
        .filter((s): s is string => typeof s === 'string');

    // (c) grammar_point (indice 3) viene dalla TABELLA joinata (alias `e`), NON da
    // un parametro: ultimo campo `grammar_point`, primo campo diverso da
    // `apply_review`. È lo snapshot: cattura il valore CORRENTE su `exercise`.
    const grammarFields = fieldsAt(3);
    expect(grammarFields[grammarFields.length - 1], 'la colonna 3 non alimenta grammar_point').toBe(
      'grammar_point',
    );
    expect(
      grammarFields[0],
      'grammar_point è preso da un parametro invece che dallo snapshot su exercise',
    ).not.toBe('apply_review');

    // AC4 (PATCH 3 — outcome è PASSTHROUGH, non derivato): outcome (indice 4) è un
    // ColumnRef verso `apply_review.outcome`. Prova che l'esito è RICEVUTO dal
    // client (AD-24), non derivato in SQL da `used_explanation` — simmetrico al
    // passthrough di stage/due_at nell'UPDATE.
    const outcomeFields = fieldsAt(4);
    expect(outcomeFields[0], 'outcome non è qualificato con apply_review (derivato?)').toBe(
      'apply_review',
    );
    expect(outcomeFields[outcomeFields.length - 1], 'la colonna 4 non è outcome').toBe('outcome');

    // (d) user_id (indice 1) è alimentato da `auth.uid()`: è l'ANCORA di ownership
    // su cui poggia l'intera isolazione RLS (insert `with check auth.uid() = user_id`
    // di 3.8). user_id NON è nella firma (7 parametri, nessun user_id): asserire la
    // fonte impedisce che un refactor lo sostituisca con un valore spoofabile.
    // Simmetrico allo snapshot di grammar_point e al passthrough di outcome.
    const userIdFn = selectTargets[1]?.ResTarget?.val?.FuncCall?.funcname;
    expect(lastSegment(userIdFn), 'user_id non è alimentato da auth.uid()').toBe('uid');
    expect(
      userIdFn?.[0]?.String?.sval,
      'la funzione di user_id non è nello schema auth (spoofabile?)',
    ).toBe('auth');
  });

  // AC4 (riga "Nessun ricalcolo"): `stage`, `due_at` e `last_reviewed_at` nel
  // targetList dell'UPDATE sono ColumnRef verso `apply_review.*` (PASSTHROUGH dai
  // parametri), NON un'espressione calcolata (A_Expr). Un ricalcolo Leitner
  // renderebbe questi `A_Expr` — rosso.
  it('stage, due_at e last_reviewed_at sono passthrough dai parametri, non ricalcolati (via AST)', () => {
    const res = parseSql(applyReview?.sql ?? '');
    const fn = createFunctionOf(res);
    const bodyRes = parseSql(functionBodyOf(fn) ?? '');

    type ColumnRef = { readonly fields?: readonly PgString[] };
    type ResTarget = {
      readonly name?: string;
      readonly val?: { readonly ColumnRef?: ColumnRef };
    };
    type UpdateStmt = {
      readonly targetList?: readonly { readonly ResTarget?: ResTarget }[];
    };

    const update = (bodyRes.parse_tree.stmts[0].stmt as { UpdateStmt?: UpdateStmt }).UpdateStmt;
    const targets = (update?.targetList ?? [])
      .map((t) => t.ResTarget)
      .filter((t): t is NonNullable<typeof t> => t !== undefined);

    // Per ogni target passthrough: `set <col> = apply_review.<param>` è un ColumnRef
    // il cui ultimo campo è il parametro atteso (e primo campo `apply_review`).
    // PATCH 4 — anche `last_reviewed_at = apply_review.reviewed_at`: completa la
    // copertura del passthrough del `set` (nessun campo dell'UPDATE è ricalcolato).
    for (const [col, param] of [
      ['stage', 'stage'],
      ['due_at', 'due_at'],
      ['last_reviewed_at', 'reviewed_at'],
    ] as const) {
      const target = targets.find((t) => t.name === col);
      expect(target, `target ${col} assente nell'UPDATE`).toBeDefined();

      const columnRef = target?.val?.ColumnRef;
      // È un ColumnRef, non un'espressione calcolata (A_Expr): passthrough puro.
      expect(
        columnRef,
        `${col} non è assegnato da un ColumnRef (ricalcolo?)`,
      ).toBeDefined();

      const fields = (columnRef?.fields ?? [])
        .map((f) => f.String?.sval)
        .filter((s): s is string => typeof s === 'string');
      expect(fields[0], `${col} non è qualificato con apply_review`).toBe('apply_review');
      expect(fields[fields.length - 1], `${col} non punta a apply_review.${param}`).toBe(param);
    }
  });

  // AC4 (riga "Nessun ricalcolo", ridondanza testuale): il corpo (senza commenti)
  // NON contiene aritmetica di scheduling — nessun `interval` e nessuno dei valori
  // della scala Leitner (1,3,7,16,35 giorni). Il `+ 1` dei contatori è bookkeeping
  // sull'esito ricevuto, non scheduling; i valori della scala Leitner sono ciò che
  // tradirebbe un ricalcolo dello stadio/scadenza in SQL.
  it('il corpo non contiene aritmetica di scheduling (interval / scala Leitner)', () => {
    const body = functionBodyOf(createFunctionOf(parseSql(applyReview?.sql ?? '')));
    const stripped = stripSqlComments(body ?? '').toLowerCase();

    // Nessun `interval`: la funzione non calcola scadenze.
    expect(stripped).not.toMatch(/\binterval\b/);

    // Nessun valore DISTINTIVO della scala Leitner (LEITNER_INTERVALS_DAYS): la
    // loro presenza tradirebbe un ricalcolo dell'intervallo in SQL. Si saltano 0 e
    // 1 perché NON sono distintivi dello scheduling: `1` è l'incremento legittimo
    // dei contatori (`review_count + 1`, `+ (case … then 1 …)`), bookkeeping
    // sull'esito ricevuto, non aritmetica di scadenza. I gradini > 1 (3,7,16,35) NON
    // hanno alcuna ragione di comparire in una funzione che riceve `due_at` già
    // calcolato — la loro assenza è il testimone dell'assenza di ricalcolo.
    for (const days of LEITNER_INTERVALS_DAYS.filter((d) => d > 1)) {
      expect(
        stripped,
        `il corpo contiene il valore della scala Leitner ${days} (ricalcolo?)`,
      ).not.toMatch(new RegExp(`\\b${days}\\b`));
    }
  });

  // AC2/AC4 (commenti): il file DOCUMENTA idempotenza (review_id / on conflict),
  // la guardia (from logged), lo snapshot di grammar_point e l'assenza di
  // scheduling — nello stile dei file esistenti. Si ispeziona il SQL GREZZO.
  it('documenta idempotenza, guardia, snapshot e assenza di scheduling (commenti)', () => {
    const raw = (applyReview?.sql ?? '').toLowerCase();
    expect(raw).toContain('idempotent');
    expect(raw).toContain('on conflict');
    expect(raw).toContain('snapshot');
    expect(raw).toContain('scheduling');
  });

  // Guardia sull'assunzione di stripSqlComments (come per le altre migrazioni):
  // il SQL strippato deve parsare ancora e produrre lo STESSO numero di statement,
  // così un `--` in un literal non corrompe in silenzio le asserzioni testuali.
  it('stripSqlComments non corrompe il SQL (stesso parse, stesso conteggio)', () => {
    const rawSql = applyReview?.sql ?? '';
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
