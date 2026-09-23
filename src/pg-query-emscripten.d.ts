// Dichiarazione di tipo per pg-query-emscripten (nessun @types pubblicato).
//
// Il pacchetto è un port WASM di libpg_query (la grammatica Postgres reale): il
// default export è una factory usata come `await new Module()`, che espone
// `parse(sql)`. Modelliamo qui SOLO la porzione dell'albero che src/migrations.test.ts
// ispeziona (statement CREATE TABLE e le sue colonne), così il test resta
// type-safe senza `any` (AD-1: TypeScript strict, nessun any nel codice).
declare module 'pg-query-emscripten' {
  /** Nodo `String` dell'albero: `{ String: { sval } }`. */
  export interface PgString {
    readonly sval: string;
  }

  /** Un vincolo di colonna: PK, FK (con azione di cancellazione), not null, default. */
  export interface PgConstraint {
    readonly contype: string;
    readonly pktable?: {
      readonly schemaname?: string;
      readonly relname?: string;
    };
    /** 'c' = cascade per fk_del_action. */
    readonly fk_del_action?: string;
  }

  /** Definizione di colonna dentro `CreateStmt.tableElts`. */
  export interface PgColumnDef {
    readonly colname?: string;
    readonly constraints?: readonly { readonly Constraint?: PgConstraint }[];
  }

  /** Un elemento di `tableElts`: una colonna o (non usato qui) un vincolo di tabella. */
  export interface PgTableElt {
    readonly ColumnDef?: PgColumnDef;
  }

  export interface PgCreateStmt {
    readonly relation?: { readonly relname?: string };
    readonly tableElts?: readonly PgTableElt[];
  }

  /** Uno statement dell'albero: la chiave nomina il tipo (CreateStmt, CreatePolicyStmt, …). */
  export interface PgStmtNode {
    readonly CreateStmt?: PgCreateStmt;
    // Altri statement (AlterTableStmt, CreatePolicyStmt, …) esistono ma non li
    // tipizziamo: il test li ispeziona via testo, non via AST.
    readonly [statementType: string]: unknown;
  }

  export interface PgRawStmt {
    readonly stmt: PgStmtNode;
  }

  export interface PgParseTree {
    readonly version: number;
    readonly stmts: readonly PgRawStmt[];
  }

  /** Esito del parse: `error` è null su successo, `{ message }` su errore di sintassi. */
  export interface PgParseResult {
    readonly parse_tree: PgParseTree;
    readonly stderr_buffer: string;
    readonly error: { readonly message: string } | null;
  }

  export interface PgQueryModule {
    parse(sql: string): PgParseResult;
  }

  /** `await new Module()` risolve a un'istanza con `parse`. */
  interface PgQueryModuleConstructor {
    new (): Promise<PgQueryModule>;
  }

  const Module: PgQueryModuleConstructor;
  export default Module;
}
