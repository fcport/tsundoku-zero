import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import PgQueryModule, {
  type PgParseResult,
  type PgQueryModule as PgQuery,
} from 'pg-query-emscripten';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildSeedSql,
  chooseSeedTimestamp,
  incrementTimestamp,
  migrationPrefix,
} from '../scripts/generate-content-seed.ts';
import { lessonId, parseLesson, type Lesson } from './domain/lesson.ts';
import { deriveExerciseId } from './domain/exercise-identity.ts';

// Story 3.7 — Il contenuto raggiunge il client e può essere aggiornato.
//
// Esercita il BUILDER PURO `buildSeedSql`. Nessun Supabase locale (AD-12/AD-13):
// l'SQL emesso è validato OFFLINE con la grammatica Postgres reale
// (pg-query-emscripten), e le altre asserzioni ispezionano il testo/AST prodotto.
// I file di test sono esclusi dalle regole boundaries: possono importare da
// `scripts/` e dai moduli del dominio.

const pgReady: Promise<PgQuery> = new PgQueryModule() as unknown as Promise<PgQuery>;
let pg: PgQuery;
beforeAll(async () => {
  pg = await pgReady;
});

/**
 * Una lezione di prova COMPLETA: titolo bilingue, i tre kind del registro, con e
 * senza `explanation.it`. Non tocca il contenuto reale — sono fixture del test.
 */
const fullLesson: Lesson = {
  order: 1,
  title: { en: 'Marking the object with を', it: "Marcare l'oggetto con を" },
  grammarPoints: ['「を」で示す目的語', '熟字訓の読み'],
  exercises: [
    {
      kind: 'single-select',
      grammarPoint: '熟字訓の読み',
      sentence: { kanji: '今日は日本語を勉強します', kana: 'きょうはにほんごをべんきょうします' },
      answer: 'きょう',
      distractors: ['こんにち', 'いまび'],
      explanation: { en: 'jukujikun reading', it: 'lettura jukujikun' },
    },
    {
      // assemble SENZA explanation.it — il ripiego deve diventare null.
      kind: 'assemble',
      grammarPoint: '「を」で示す目的語',
      sentence: { kanji: '本を読みます', kana: 'ほんをよみます' },
      answer: ['本を', '読みます'],
      explanation: { en: 'を marks the object' },
    },
    {
      kind: 'select-span',
      grammarPoint: '「を」で示す目的語',
      sentence: { kanji: '果物を買います', kana: 'くだものをかいます' },
      answer: { start: 0, end: 1 },
      explanation: { en: 'select the object', it: "seleziona l'oggetto" },
    },
  ],
};

/** Una lezione SENZA esercizi e col titolo SENZA `it` (AC4/AC5). */
const emptyLesson: Lesson = {
  order: 2,
  title: { en: 'A lesson with no exercises yet' },
  grammarPoints: ['て形の導入'],
  exercises: [],
};

function parseSql(sql: string): PgParseResult {
  return pg.parse(sql);
}

describe('buildSeedSql — l\'SQL di seed è valido, idempotente e derivato dal dominio', () => {
  // (a) L'output PARSA senza errori con la grammatica Postgres reale.
  it('produce SQL sintatticamente valido (AC1/AC3)', () => {
    const res = parseSql(buildSeedSql([fullLesson, emptyLesson]));
    expect(res.error, `errore di sintassi: ${res.error?.message ?? ''}`).toBeNull();
    expect(res.parse_tree.stmts.length).toBeGreaterThan(0);
  });

  // (a) Prova NEGATIVA: dimostra che il parser coglie davvero SQL rotto — così il
  // controllo di validità sopra non è finto.
  it('il parser coglie un typo (prova negativa)', () => {
    const res = parseSql('inser into lesson values (1);');
    expect(res.error).not.toBeNull();
  });

  // (b) Gli id emessi uguagliano lessonId / deriveExerciseId (AC2).
  it('emette lesson.id = lessonId(lesson)', () => {
    const sql = buildSeedSql([fullLesson]);
    expect(sql).toContain(`'${lessonId(fullLesson)}'`);
  });

  it('emette exercise.id = deriveExerciseId(exercise) per ogni esercizio', () => {
    const sql = buildSeedSql([fullLesson]);
    for (const exercise of fullLesson.exercises) {
      expect(sql).toContain(`'${deriveExerciseId(exercise)}'`);
    }
  });

  // (c) Entrambi gli insert usano `on conflict (id) do update` (AC3 idempotenza).
  it('entrambi gli insert sono upsert su (id)', () => {
    const sql = buildSeedSql([fullLesson]).toLowerCase();
    const upserts = sql.match(/on\s+conflict\s*\(\s*id\s*\)\s+do\s+update/g) ?? [];
    expect(upserts.length).toBe(2);
  });

  // (d) Un esercizio senza explanation.it emette explanation_it = null (AC4).
  it('explanation_it è null quando explanation.it è assente', () => {
    // La sola riga esercizio senza `it` è l'assemble; la sua explanation_en è
    // «を marks the object» seguita da `, null` (colonna explanation_it).
    const sql = buildSeedSql([fullLesson]);
    expect(sql).toMatch(/'を marks the object', null\)/);
  });

  // (f) Un titolo senza `it` emette title_it = null (AC4).
  it('title_it è null quando title.it è assente', () => {
    const sql = buildSeedSql([emptyLesson]);
    // La riga lesson di emptyLesson: id, ordinal, title_en, title_it(null), array.
    expect(sql).toMatch(/'A lesson with no exercises yet', null,/);
  });

  // (e) Una lezione senza esercizi: riga `lesson`, nessuna riga `exercise` (AC5).
  it('una lezione senza esercizi produce la riga lesson e nessuna riga exercise', () => {
    const sql = buildSeedSql([emptyLesson]);
    // C'è l'insert su lesson…
    expect(sql).toMatch(/insert\s+into\s+lesson/i);
    // …e la riga della lezione (il suo id derivato).
    expect(sql).toContain(`'${lessonId(emptyLesson)}'`);
    // …ma NESSUN insert su exercise.
    expect(sql).not.toMatch(/insert\s+into\s+exercise/i);
    // E deve comunque parsare.
    expect(parseSql(sql).error).toBeNull();
  });

  // PATCH 1 — contenuto VUOTO: nessuna lezione ⇒ nessun insert `lesson` con
  // `values` vuoto (sarebbe SQL invalido). L'output è solo-commenti e PARSA.
  // Simmetrico al ramo `exercise`, che era già guardato.
  it('nessuna lezione ⇒ nessun insert vuoto, l\'output resta valido', () => {
    const sql = buildSeedSql([]);
    // Deve parsare (solo commenti ⇒ zero statement, non un errore di sintassi).
    expect(parseSql(sql).error, `errore di sintassi: ${parseSql(sql).error?.message ?? ''}`).toBeNull();
    // Nessun insert `lesson` con `values` immediatamente seguito da `on conflict`
    // (la forma invalida che il bug produceva).
    expect(sql).not.toMatch(/insert\s+into\s+lesson[\s\S]*?values\s*on\s+conflict/i);
    // Non c'è nemmeno un insert su exercise.
    expect(sql).not.toMatch(/insert\s+into\s+exercise/i);
    // Difesa in più: nessuno statement affatto (solo commenti).
    expect(parseSql(sql).parse_tree.stmts.length).toBe(0);
  });

  // Robustezza dell'escape: un apostrofo (l'oggetto) non rompe l'SQL.
  it('cita correttamente gli apostrofi nei literal', () => {
    const sql = buildSeedSql([fullLesson]);
    // "Marcare l'oggetto con を" deve comparire con l'apice raddoppiato.
    expect(sql).toContain("Marcare l''oggetto con を");
    expect(parseSql(sql).error).toBeNull();
  });

  // Il payload jsonb contiene i campi dipendenti dal kind; distractors SOLO per
  // single-select.
  it('il payload include distractors solo per single-select', () => {
    const sql = buildSeedSql([fullLesson]);
    // single-select porta distractors nel payload…
    expect(sql).toContain('"distractors"');
    // …e complessivamente esattamente una occorrenza (un solo single-select).
    const occurrences = sql.match(/"distractors"/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC6 — «Il seed nasce dal contenuto validato»: la riga della I/O Matrix «Seed
// prima esecuzione» ha come Error Handling «fallisce rumorosamente se un file non
// valida». `buildSeedSql` (puro) è già coperto sopra; qui proviamo la SUPERFICIE
// del CLI che il builder non ha: il contratto detection⇄EXIT-CODE del CANCELLO,
// e la garanzia che il percorso di fallimento NON scrive alcun seed (esce prima
// di writeFile). Come il test gemello src/validate-content-script.test.ts, l'exit
// code non è osservabile senza processo: SPAWNIAMO il CLI reale (vite-node).
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const scriptPath = resolve(repoRoot, 'scripts', 'generate-content-seed.ts');
const migrationsDir = resolve(repoRoot, 'supabase', 'migrations');
// Come nel test gemello: invochiamo il modulo .mjs di vite-node DIRETTAMENTE con
// `process.execPath` (node), non lo shim `.bin/vite-node.cmd`. Su Windows il
// wrapper batch spawnato da `execFileSync` verrebbe terminato da un segnale
// (status null) invece di propagare l'exit code reale — proprio ciò che AC6
// richiede di osservare.
const viteNodeBin = resolve(repoRoot, 'node_modules', 'vite-node', 'vite-node.mjs');

// Una lezione che VIOLA lo schema (grammarPoints vuoto), così validateLessons
// produce issue e il CLI deve fallire. Non serve testare il success path qui:
// scriverebbe un seed in supabase/migrations/ (il target è cablato), inquinando
// la cartella reale — e il builder puro copre già il caso positivo.
const invalidLesson = {
  order: 1,
  title: { en: 'Broken lesson' },
  grammarPoints: [],
  exercises: [],
};

let badRoot: string;

beforeAll(() => {
  badRoot = mkdtempSync(join(tmpdir(), 'tsundoku-seed-'));
  writeFileSync(join(badRoot, '01-broken.json'), JSON.stringify(invalidLesson), 'utf8');
});

afterAll(() => {
  rmSync(badRoot, { recursive: true, force: true });
});

describe('CLI generate-content-seed — fallisce rumorosamente, nessun seed (AC6)', () => {
  /**
   * Esegue il CLI reale su `dir` e ritorna il codice d'uscita (0 = verde).
   *
   * L'ambiente è ripulito da `VITEST`: questo test gira DENTRO vitest, quindi il
   * figlio ne EREDITEREBBE `process.env.VITEST` e la guardia dell'entrypoint
   * sopprimerebbe `main()` — il CLI non eserciterebbe MAI il contratto di
   * exit-code. Rimuovendolo, `main()` gira come nello step reale.
   */
  function runCli(dir: string): number {
    const env = { ...process.env };
    delete env.VITEST;
    try {
      execFileSync(process.execPath, [viteNodeBin, scriptPath, dir], {
        cwd: repoRoot,
        stdio: 'pipe',
        env,
      });
      return 0;
    } catch (error) {
      // execFileSync lancia su exit non-zero: `status` porta il codice reale.
      return (error as { status?: number }).status ?? 1;
    }
  }

  function countSqlMigrations(): number {
    return readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).length;
  }

  it('contenuto NON valido ⇒ exit NON-zero E nessun file di seed scritto', () => {
    // Conta i .sql reali PRIMA: il percorso di fallimento non deve toccarli.
    const before = countSqlMigrations();

    const exitCode = runCli(badRoot);
    expect(exitCode, 'il CLI deve fallire su contenuto non valido (AC6)').not.toBe(0);

    // Nessun seed generato: il fallimento esce PRIMA di writeFile, quindi il
    // conteggio dei .sql in supabase/migrations/ è invariato.
    const after = countSqlMigrations();
    expect(
      after,
      'il fallimento non deve scrivere alcun seed in supabase/migrations/',
    ).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// PATCH 2 — GATE ANTI-DRIFT del seed committato. Nulla, oggi, impedisce che il
// seed committato diverga da content/lessons/: se qualcuno modifica il contenuto
// e dimentica `npm run generate-content-seed`, il loop generico «ogni *.sql
// parsa» resta verde e la produzione spedirebbe contenuto STANTÌO — proprio ciò
// che la storia promette di evitare. Questo test rigenera l'SQL dal contenuto
// REALE e pretende che sia UGUALE (byte-per-byte, a meno del trailing whitespace)
// al file committato. Una modifica al contenuto senza rigenerare rompe la CI.
//
// Offline: usa `buildSeedSql` (puro) e legge i file dal disco (node:fs). Nessun
// Supabase, nessuno spawn.
// ---------------------------------------------------------------------------

describe('seed committato — non deve divergere da content/lessons/ (anti-drift)', () => {
  const contentDir = resolve(repoRoot, 'content', 'lessons');

  /** Le lezioni REALI, lette e parsate dal disco (ordine deterministico). */
  function realLessons(): Lesson[] {
    const files = readdirSync(contentDir)
      .filter((f) => f.toLowerCase().endsWith('.json'))
      .sort();
    return files.map((f) => {
      const parsed = parseLesson(JSON.parse(readFileSync(join(contentDir, f), 'utf8')));
      if (!parsed.ok) {
        throw new Error(`content/lessons/${f} non valido: impossibile parsare`);
      }
      return parsed.value;
    });
  }

  /** Il file `*_seed_content.sql` committato, individuato per suffisso. */
  function committedSeed(): { name: string; sql: string } {
    const name = readdirSync(migrationsDir).find((f) => f.endsWith('_seed_content.sql'));
    if (name === undefined) {
      throw new Error('nessun file *_seed_content.sql committato');
    }
    return { name, sql: readFileSync(join(migrationsDir, name), 'utf8') };
  }

  it('esiste esattamente un seed committato', () => {
    const seeds = readdirSync(migrationsDir).filter((f) => f.endsWith('_seed_content.sql'));
    expect(seeds.length, `attesi 1 seed, trovati: ${seeds.join(', ')}`).toBe(1);
  });

  it('buildSeedSql(contenuto reale) === contenuto del seed committato', () => {
    const regenerated = buildSeedSql(realLessons());
    const committed = committedSeed().sql;
    // Normalizza il solo line-ending (git può checkout-are CRLF su Windows): il
    // confronto è sul CONTENUTO, non sulla codifica di fine riga.
    const normalize = (s: string): string => s.replace(/\r\n/g, '\n');
    expect(
      normalize(regenerated),
      'il seed committato è DIVERGENTE dal contenuto: esegui `npm run generate-content-seed` e ricommitta',
    ).toBe(normalize(committed));
  });
});

// ---------------------------------------------------------------------------
// PATCH 3 — UNIT TEST per la scelta del timestamp del seed. `chooseSeedTimestamp`
// governa se il seed si ordina DOPO il DDL (supabase applica in ordine
// lessicografico di timestamp): logica pura, va provata direttamente. PURO —
// nessun I/O, riceve l'elenco dei nomi e l'ora.
// ---------------------------------------------------------------------------

describe('chooseSeedTimestamp — il seed si ordina dopo il DDL', () => {
  // Un Date UTC dal timestamp `YYYYMMDDHHmmss`, per pilotare l'orologio nei test.
  function utc(ts: string): Date {
    return new Date(
      Date.UTC(
        Number(ts.slice(0, 4)),
        Number(ts.slice(4, 6)) - 1,
        Number(ts.slice(6, 8)),
        Number(ts.slice(8, 10)),
        Number(ts.slice(10, 12)),
        Number(ts.slice(12, 14)),
      ),
    );
  }

  const existing = ['20260925090000_create_lesson_and_exercise.sql'];

  it('(a) clock AVANTI al massimo esistente ⇒ ritorna il timestamp corrente', () => {
    // Ora corrente 09:00:05, dopo il DDL 09:00:00 ⇒ si usa l'ora corrente.
    expect(chooseSeedTimestamp(existing, utc('20260925090005'))).toBe('20260925090005');
  });

  it('(b) clock INDIETRO al massimo esistente ⇒ ritorna <max> + 1s', () => {
    // Ora corrente 07:42:52, PRIMA del DDL 09:00:00 ⇒ ripiego su DDL + 1s.
    expect(chooseSeedTimestamp(existing, utc('20260925074252'))).toBe('20260925090001');
  });

  it('(b) clock PARI al massimo esistente ⇒ ritorna <max> + 1s (mai ≤)', () => {
    // Ora corrente identica al DDL ⇒ non deve pareggiarlo, ma superarlo di 1s.
    expect(chooseSeedTimestamp(existing, utc('20260925090000'))).toBe('20260925090001');
  });

  it('nessuna migrazione esistente ⇒ ritorna semplicemente l\'ora corrente', () => {
    expect(chooseSeedTimestamp([], utc('20260925090005'))).toBe('20260925090005');
  });

  it('ignora i nomi senza prefisso timestamp valido', () => {
    // Un file senza prefisso 14-cifre non conta come «massimo esistente».
    expect(chooseSeedTimestamp(['README.md', 'not-a-migration.sql'], utc('20260101000000'))).toBe(
      '20260101000000',
    );
  });
});

describe('incrementTimestamp — rollover corretto ai bordi', () => {
  it('incremento normale di un secondo', () => {
    expect(incrementTimestamp('20260925090000')).toBe('20260925090001');
  });

  it('rollover di secondo⇒minuto', () => {
    expect(incrementTimestamp('20260925090059')).toBe('20260925090100');
  });

  it('rollover di fine giorno (23:59:59 ⇒ giorno successivo 00:00:00)', () => {
    expect(incrementTimestamp('20260925235959')).toBe('20260926000000');
  });

  it('rollover di fine mese (30 set 23:59:59 ⇒ 1 ott 00:00:00)', () => {
    expect(incrementTimestamp('20260930235959')).toBe('20261001000000');
  });

  it('rollover di fine anno (31 dic 23:59:59 ⇒ 1 gen anno successivo)', () => {
    expect(incrementTimestamp('20261231235959')).toBe('20270101000000');
  });
});

describe('migrationPrefix — estrae il prefisso timestamp', () => {
  it('estrae le 14 cifre da un nome di migrazione', () => {
    expect(migrationPrefix('20260925090000_create_lesson_and_exercise.sql')).toBe('20260925090000');
  });

  it('ritorna undefined per un nome senza prefisso valido', () => {
    expect(migrationPrefix('README.md')).toBeUndefined();
    expect(migrationPrefix('123_short.sql')).toBeUndefined();
  });
});
