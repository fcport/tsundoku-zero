// Story 3.7 — Il contenuto raggiunge il client e può essere aggiornato.
//
// Generatore dell'SQL di SEED per le tabelle `lesson`/`exercise`. Divisione
// dominio/tooling (AD-1, come scripts/validate-content.ts): il BUILDER dell'SQL è
// TOOLING PURO (nessun stato, nessun I/O) esportato e testabile; l'I/O — glob +
// read + validate + write — vive in `main()`, guardato da `process.env.VITEST`.
// Lo script importa SOLO da src/domain/* e node:* (nessun @supabase/supabase-js):
// vive fuori da src/, quindi non tocca la matrice `boundaries` (come
// validate-content.ts).
//
// L'SQL emesso è IDEMPOTENTE: `insert … on conflict (id) do update set …`. Gli id
// derivano dal contenuto (lessonId/deriveExerciseId), quindi un contenuto
// invariato riproduce gli stessi id e l'upsert non cambia nulla; un contenuto
// corretto aggiorna solo le righe cambiate.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import { parseLesson, lessonId, type Lesson } from '../src/domain/lesson.ts';
import { deriveExerciseId } from '../src/domain/exercise-identity.ts';
import { validateLessons, type LessonFile } from '../src/domain/content-validation.ts';

const DEFAULT_DIR = join('content', 'lessons');
const MIGRATIONS_DIR = join('supabase', 'migrations');

/**
 * Cita un literal di stringa SQL: raddoppia l'apice singolo e racchiude tra apici.
 * Così contenuto giapponese, apostrofi (`l'oggetto`) o qualsiasi carattere non
 * rompono l'SQL. PURO.
 */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Emette un valore testuale o `null`: `null` letterale se `undefined`, altrimenti
 * il literal citato. Il ripiego linguistico (title_it/explanation_it assenti)
 * diventa `null` in colonna (ricade su en, FR8.5). PURO.
 */
function sqlNullableString(value: string | undefined): string {
  return value === undefined ? 'null' : sqlString(value);
}

/**
 * Emette un `text[]` come `array[…]` di literal citati. Un array vuoto diventa
 * `array[]::text[]` (tipizzato, così Postgres non lo lascia ambiguo). PURO.
 */
function sqlTextArray(values: readonly string[]): string {
  if (values.length === 0) {
    return 'array[]::text[]';
  }
  return `array[${values.map(sqlString).join(', ')}]`;
}

/**
 * Il PAYLOAD jsonb di un esercizio: i campi dipendenti dal kind. `sentence` e
 * `answer` sempre; `distractors` SOLO per single-select. Serializzato con
 * `JSON.stringify` e citato come literal `::jsonb`. PURO e TOTALE (switch chiuso
 * sul registro AD-22 con guardia `never`).
 */
function exercisePayload(exercise: Exercise): string {
  switch (exercise.kind) {
    case 'single-select':
      return JSON.stringify({
        sentence: exercise.sentence,
        answer: exercise.answer,
        distractors: exercise.distractors,
      });
    case 'select-span':
      return JSON.stringify({
        sentence: exercise.sentence,
        answer: exercise.answer,
      });
    case 'assemble':
      return JSON.stringify({
        sentence: exercise.sentence,
        answer: exercise.answer,
      });
    default: {
      // Registro chiuso (AD-22): un kind non gestito è errore di COMPILAZIONE.
      const _exhaustive: never = exercise;
      void _exhaustive;
      return '{}';
    }
  }
}

// L'`Exercise` è la forma inferita dallo schema; lo importiamo per tipo dagli
// esercizi già validati che compongono una `Lesson`.
type Exercise = Lesson['exercises'][number];

/**
 * BUILDER PURO dell'SQL di seed (AC2/AC3/AC4/AC5). Emette due insert idempotenti:
 *
 *  - `insert into lesson … on conflict (id) do update set …` con id = lessonId,
 *    title_it → null se assente, grammar_points come array[…];
 *  - `insert into exercise … on conflict (id) do update set …` con id =
 *    deriveExerciseId, payload = '<json>'::jsonb, explanation_it → null se assente.
 *
 * Una lezione con `exercises: []` produce la sua riga `lesson` e NESSUNA riga
 * `exercise` (AC5). Se NON c'è alcun esercizio in tutto il contenuto, l'insert
 * su `exercise` è OMESSO del tutto (un `insert … values` senza righe è SQL
 * invalido). Riceve `Lesson` GIÀ validate: non rivalida.
 */
export function buildSeedSql(lessons: readonly Lesson[]): string {
  const parts: string[] = [];
  parts.push('-- Seed del contenuto (lezioni ed esercizi), generato da');
  parts.push('-- scripts/generate-content-seed.ts a partire da content/lessons/.');
  parts.push('-- NON modificare a mano: rigenera con `npm run generate-content-seed`.');
  parts.push('-- Idempotente: upsert su `id`; gli id derivano dal contenuto');
  parts.push('-- (lessonId/deriveExerciseId), quindi un contenuto invariato non cambia nulla.');
  parts.push('');

  // --- lesson ------------------------------------------------------------------
  const lessonRows = lessons.map((lesson) => {
    const id = lessonId(lesson);
    return (
      `  (${sqlString(id)}, ${lesson.order}, ${sqlString(lesson.title.en)}, ` +
      `${sqlNullableString(lesson.title.it)}, ${sqlTextArray(lesson.grammarPoints)})`
    );
  });
  if (lessonRows.length > 0) {
    parts.push('insert into lesson (id, ordinal, title_en, title_it, grammar_points) values');
    parts.push(lessonRows.join(',\n'));
    parts.push('on conflict (id) do update set');
    parts.push('  ordinal = excluded.ordinal,');
    parts.push('  title_en = excluded.title_en,');
    parts.push('  title_it = excluded.title_it,');
    parts.push('  grammar_points = excluded.grammar_points;');
  } else {
    // Nessuna lezione nel contenuto: nessun insert su `lesson` (un `insert …
    // values` senza righe è SQL invalido). Simmetrico al ramo `exercise`.
    parts.push('-- Nessuna lezione nel contenuto: nessuna riga `lesson`.');
  }
  parts.push('');

  // --- exercise ----------------------------------------------------------------
  const exerciseRows: string[] = [];
  for (const lesson of lessons) {
    const lid = lessonId(lesson);
    for (const exercise of lesson.exercises) {
      const id = deriveExerciseId(exercise);
      exerciseRows.push(
        `  (${sqlString(id)}, ${sqlString(lid)}, ${sqlString(exercise.kind)}, ` +
          `${sqlString(exercisePayload(exercise))}::jsonb, ${sqlString(exercise.grammarPoint)}, ` +
          `${sqlString(exercise.explanation.en)}, ${sqlNullableString(exercise.explanation.it)})`,
      );
    }
  }

  if (exerciseRows.length > 0) {
    parts.push(
      'insert into exercise (id, lesson_id, kind, payload, grammar_point, explanation_en, explanation_it) values',
    );
    parts.push(exerciseRows.join(',\n'));
    parts.push('on conflict (id) do update set');
    parts.push('  lesson_id = excluded.lesson_id,');
    parts.push('  kind = excluded.kind,');
    parts.push('  payload = excluded.payload,');
    parts.push('  grammar_point = excluded.grammar_point,');
    parts.push('  explanation_en = excluded.explanation_en,');
    parts.push('  explanation_it = excluded.explanation_it;');
  } else {
    // Nessun esercizio in tutto il contenuto: nessun insert su `exercise` (AC5).
    parts.push('-- Nessun esercizio nel contenuto: nessuna riga `exercise`.');
  }
  parts.push('');

  return parts.join('\n');
}

/**
 * Scopre per GLOB i file `*.json` sotto `dir` (ricorsivo). Speculare a
 * scripts/validate-content.ts: filtra solo i file, case-insensitive su `.json`,
 * cartella assente (ENOENT/ENOTDIR) ⇒ nessun file. Ordina per determinismo.
 */
async function discover(dir: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true, recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return [];
    }
    throw error;
  }
  return entries
    .filter((dirent) => dirent.isFile() && dirent.name.toLowerCase().endsWith('.json'))
    .map((dirent) => join(dirent.parentPath, dirent.name))
    .sort();
}

/** Timestamp `YYYYMMDDHHmmss` (UTC) per il nome della migrazione. */
function migrationTimestamp(now: Date): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  return (
    `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

/**
 * Il prefisso timestamp `YYYYMMDDHHmmss` di un nome di migrazione, o `undefined`
 * se il nome non ne ha uno. PURO.
 */
export function migrationPrefix(name: string): string | undefined {
  const match = /^(\d{14})_/.exec(name);
  return match?.[1];
}

/**
 * Sceglie il timestamp del seed: quello CORRENTE, ma MAI ≤ della migrazione più
 * recente già presente. Il seed DEVE ordinarsi DOPO il DDL che crea le tabelle
 * (supabase applica in ordine lessicografico di timestamp): se l'orologio è
 * indietro rispetto al DDL, si ripiega su `<max esistente> + 1s`. PURO (riceve
 * l'elenco dei nomi e l'ora, non fa I/O).
 */
export function chooseSeedTimestamp(
  existingNames: readonly string[],
  now: Date,
): string {
  const current = migrationTimestamp(now);
  const maxExisting = existingNames
    .map(migrationPrefix)
    .filter((p): p is string => p !== undefined)
    .reduce<string>((max, p) => (p > max ? p : max), '');
  if (current > maxExisting) {
    return current;
  }
  // Orologio indietro (o pari): un secondo dopo la migrazione più recente.
  return incrementTimestamp(maxExisting);
}

/**
 * Incrementa di un secondo un timestamp `YYYYMMDDHHmmss`, interpretato in UTC.
 * `Date.UTC` normalizza il rollover (secondo 60 ⇒ minuto successivo, 23:59:59 ⇒
 * giorno dopo, fine mese ⇒ mese dopo). PURO.
 */
export function incrementTimestamp(ts: string): string {
  const year = Number(ts.slice(0, 4));
  const month = Number(ts.slice(4, 6));
  const day = Number(ts.slice(6, 8));
  const hour = Number(ts.slice(8, 10));
  const minute = Number(ts.slice(10, 12));
  const second = Number(ts.slice(12, 14));
  const next = new Date(Date.UTC(year, month - 1, day, hour, minute, second + 1));
  return migrationTimestamp(next);
}

/**
 * I nomi dei file di migrazione già presenti (per scegliere un timestamp che
 * ordina dopo). I/O; cartella assente ⇒ nessun nome. Ignora i seed precedenti nel
 * calcolo? No: anche un seed precedente conta come «migrazione più recente», così
 * due rigenerazioni ravvicinate non producono un timestamp regressivo.
 */
async function existingMigrationNames(): Promise<string[]> {
  try {
    const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
    return entries
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.sql'))
      .map((dirent) => dirent.name);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return [];
    }
    throw error;
  }
}

/**
 * L'UNICA impurità: glob + read + VALIDA + build + write. Valida con
 * `validateLessons` (fonte unica, FR2.6); se ci sono issue, stampa e
 * `process.exit(1)` — fallisce rumorosamente, nessun seed generato (AC6).
 * Altrimenti `parseLesson` ogni file (già garantito valido), chiama
 * `buildSeedSql`, e scrive `supabase/migrations/<timestamp>_seed_content.sql`.
 */
async function main(): Promise<void> {
  const dir = process.argv[2] ?? DEFAULT_DIR;
  const paths = await discover(dir);
  const files: LessonFile[] = await Promise.all(
    paths.map(async (path) => ({ path, source: await readFile(path, 'utf8') })),
  );

  const issues = validateLessons(files);
  if (issues.length > 0) {
    console.error(`Contenuto NON valido: ${issues.length} problema/i. Nessun seed generato.`);
    for (const issue of issues) {
      const where = issue.path.length > 0 ? issue.path.join('.') : '(file)';
      console.error(`  ${issue.file} — ${where}: ${issue.message}`);
    }
    process.exit(1);
  }

  // Il contenuto è già validato: `parseLesson` qui non può fallire. Il cast
  // dell'esito è sicuro (validateLessons ha già rifiutato ogni non conformità).
  const lessons: Lesson[] = files.map((file) => {
    const parsed = parseLesson(JSON.parse(file.source));
    if (!parsed.ok) {
      // Difesa in profondità: non dovrebbe mai capitare dopo validateLessons.
      throw new Error(`parseLesson fallito su ${file.path} dopo validateLessons`);
    }
    return parsed.value;
  });

  const sql = buildSeedSql(lessons);
  // Il seed DEVE applicarsi DOPO il DDL (referenzia lesson/exercise): il suo
  // timestamp non è mai ≤ della migrazione esistente più recente.
  const existing = await existingMigrationNames();
  const outName = `${chooseSeedTimestamp(existing, new Date())}_seed_content.sql`;
  const outPath = join(MIGRATIONS_DIR, outName);
  await writeFile(outPath, sql, 'utf8');
  console.log(`Seed generato: ${outPath} (${lessons.length} lezione/i).`);
}

// Esegui il CLI solo come ENTRYPOINT, non quando importato dai test. La
// discriminante è il RUNNER (come validate-content.ts): la CLI reale gira sotto
// vite-node (nessun VITEST), i test sotto vitest (VITEST impostato).
if (process.env.VITEST === undefined) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
