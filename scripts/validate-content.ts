// CLI del CANCELLO di validazione del contenuto (FR2.6, AD-25). È l'UNICA
// impurità: fa SOLO I/O — glob dei file, lettura, stampa, uscita — e delega OGNI
// decisione a `validateLessons` (dominio puro, fonte unica). Nessuna logica di
// validazione è duplicata qui (AD-1). Eseguito da `vite-node` (importa il
// validatore TypeScript senza nuove dipendenze). Modellato sul runner di
// `scripts/check-contrast.mjs` (exit non-zero sui fallimenti; guardia
// dell'entrypoint così i test lo importano senza eseguire il CLI).
//
// Uso: `vite-node scripts/validate-content.ts [dir]` — `dir` opzionale (default
// `content/lessons`). Cartella assente ⇒ nessun file ⇒ exit 0 (il contenuto
// arriva in 2.7).
import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import { validateLessons, type ContentIssue, type LessonFile } from '../src/domain/content-validation.ts';

const DEFAULT_DIR = join('content', 'lessons');

/**
 * Scopre per GLOB tutti i file `*.json` (case-insensitive) sotto `dir`
 * (ricorsivo), nessun elenco cablato (AC4): aggiungere una lezione conforme non
 * richiede modifiche al codice.
 *
 * Robusto contro i falsi verdi e i crash grezzi:
 * - filtra solo i `dirent.isFile()` — una CARTELLA il cui nome finisce in `.json`
 *   non entra (altrimenti `readFile` lancerebbe `EISDIR` e farebbe crashare il
 *   cancello invece di emettere un issue);
 * - confronto case-INSENSITIVE su `.json` — un file `NN-*.JSON` reale viene
 *   validato, non saltato in silenzio (evita un falso verde);
 * - `ENOENT` (cartella assente) E `ENOTDIR` (il path esiste ma è un FILE) ⇒ zero
 *   lezioni (return []): il percorso «nessun contenuto ancora» resta grazioso,
 *   non un crash. La dir bersaglio è opzionale fino a 2.7.
 *
 * Il path completo si compone dal dirent (`parentPath`/`path` + `name`), così i
 * file annidati nelle sottocartelle sono localizzati correttamente. Ordina per un
 * output deterministico.
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
    // `parentPath` è la cartella che contiene la voce (assoluto o relativo a
    // `dir` a seconda dell'input). `path` è l'alias deprecato: preferisci
    // `parentPath` quando presente.
    .map((dirent) => join(dirent.parentPath, dirent.name))
    .sort();
}

/**
 * Composizione PURA di effetti (glob + read + validate) SENZA side effect di
 * processo: nessun `console`, nessun `process.exit`. Restituisce gli issue così
 * com'è, così i test possono asserirli senza spawnare il CLI. La superficie
 * osservabile del CANCELLO (exit code) resta in `main`.
 */
export async function collectIssues(dir: string): Promise<ContentIssue[]> {
  const paths = await discover(dir);
  const files: LessonFile[] = await Promise.all(
    paths.map(async (path) => ({ path, source: await readFile(path, 'utf8') })),
  );
  return validateLessons(files);
}

async function main(): Promise<void> {
  const dir = process.argv[2] ?? DEFAULT_DIR;
  const issues = await collectIssues(dir);

  if (issues.length > 0) {
    console.error(`Validazione del contenuto FALLITA: ${issues.length} problema/i.`);
    for (const issue of issues) {
      const where = issue.path.length > 0 ? issue.path.join('.') : '(file)';
      console.error(`  ${issue.file} — ${where}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`Validazione del contenuto OK: nessun problema in ${dir}.`);
  process.exit(0);
}

// Esegui il CLI solo come ENTRYPOINT, non quando importato dai test (nello
// spirito della guardia di scripts/check-contrast.mjs). Così il contratto
// detection⇄exit-code è osservabile spawnando il processo, mentre l'import di
// `collectIssues` da un test NON ha side effect (nessun `process.exit`).
//
// Perché non `import.meta.url === argv[1]` come nel .mjs: quello script gira
// sotto `node` (dove `argv[1]` È il file). Questo gira sotto `vite-node`, che
// consuma il path del suo script e lascia in `argv[1]` il proprio runner
// (`vite-node.mjs`) — quel confronto non combacerebbe MAI. La discriminante
// affidabile è invece il RUNNER: la CLI reale gira sotto `vite-node` (nessun
// `process.env.VITEST`), i test girano sotto `vitest` (che imposta `VITEST`),
// quindi importano il modulo senza far partire il CLI.
if (process.env.VITEST === undefined) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
