// Storia 6.3 — Il confronto che impedisce la contaminazione.
//
// CLI del controllo di autorazione anti-contaminazione (FR11.7, AC1/AC2/AC4). È
// l'UNICA impurità: fa SOLO I/O — glob dei transcript e delle lezioni, lettura,
// stampa del report, uscita — e delega OGNI decisione al NUCLEO PURO
// `scripts/lib/contamination.ts`. Nessuna logica di confronto è duplicata qui
// (stesso modello di `scripts/validate-content.ts` ⇄
// `src/domain/content-validation.ts`).
//
// NON è, e non può essere, un cancello di CI (AC4): confronta il contenuto
// prodotto con i TRANSCRIPT della fonte, che 6.1 tiene FUORI dal repository. In CI
// il transcript è assente, quindi non c'è nulla da confrontare. È l'UNICO anello
// della catena di qualità che non si chiude a valle: si esegue in LOCALE, durante
// la revisione umana obbligatoria del runbook (passo 5), contro la cartella di
// lavoro privata dell'autore.
//
// Il CLI legge i file-fonte SOLO sotto `.authoring/` (o la transcriptDir passata).
// La rete di sicurezza di 6.1 è la CARTELLA, non l'estensione: `.gitignore` esclude
// `.authoring/` INTERAMENTE, quindi qualsiasi file al suo interno resta fuori dal
// repo. Le estensioni (`*.txt`/`*.vtt`/`*.srt`/`*.transcript*`) sono elencate SEPARATAMENTE
// in `.gitignore`, ma un `*.txt` NUDO fuori da `.authoring/` non è git-ignorato:
// per questo i transcript vivono nella cartella di lavoro, ed è lì che il CLI li
// cerca.
//
// Uso: `vite-node scripts/check-contamination.ts [transcriptDir] [lessonsDir]` —
// entrambi opzionali (default `.authoring/` e `content/lessons/`). L'allowlist
// (`contamination-allowlist.json`) è cercata ACCANTO ai transcript, dentro la
// transcriptDir: una transcriptDir personalizzata sposta anche la ricerca
// dell'allowlist. Nessun transcript ⇒ messaggio esplicito + exit NON-zero (niente
// da confrontare ⇒ nulla verificato: NON un falso verde).
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import { parseLesson } from '../src/domain/lesson.ts';
import {
  collectProducedTexts,
  detectOverlaps,
  unusedAllowlistEntries,
  type ContaminationOverlap,
  type MotivatedException,
  type ProducedText,
  type TranscriptText,
} from './lib/contamination.ts';

const DEFAULT_TRANSCRIPT_DIR = '.authoring';
const DEFAULT_LESSONS_DIR = join('content', 'lessons');
// Nome del file di allowlist, cercato ACCANTO ai transcript (dentro la
// transcriptDir): così una transcriptDir personalizzata sposta anche l'allowlist,
// invece di lasciarla ancorata a `.authoring/` in modo incoerente.
const ALLOWLIST_NAME = 'contamination-allowlist.json';

/**
 * Estensioni riconosciute come materiale-fonte da confrontare, sotto la cartella
 * di lavoro. Sono le stesse categorie che 6.1 elenca in `.gitignore`
 * (`*.txt`/`*.vtt`/`*.srt`/`*.transcript*`), MA qui contano solo perché il file è
 * DENTRO `.authoring/`: è la cartella a garantire l'esclusione dal repo, non
 * l'estensione (un `*.txt` nudo fuori da `.authoring/` non è git-ignorato). Un file
 * `*.transcript*` (es. `x.transcript`, `x.transcript.txt`) combacia sul frammento;
 * gli altri sull'estensione.
 */
function isTranscriptFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.txt') ||
    lower.endsWith('.vtt') ||
    lower.endsWith('.srt') ||
    lower.includes('.transcript')
  );
}

/**
 * Scopre per GLOB i file-fonte sotto `dir` (ricorsivo). Speculare alla `discover`
 * di `scripts/validate-content.ts`: filtra solo i file, cartella assente
 * (ENOENT/ENOTDIR) ⇒ nessun file. L'ALLOWLIST (`contamination-allowlist.json`) NON
 * è materiale-fonte: è configurazione dell'autore e non deve entrare nel confronto,
 * quindi è esclusa dal glob. Ordina per determinismo.
 */
async function discoverTranscripts(dir: string, allowlistPath: string): Promise<string[]> {
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
  const allowlistName = allowlistPath.split(/[\\/]/).pop();
  return entries
    .filter(
      (dirent) =>
        dirent.isFile() && isTranscriptFile(dirent.name) && dirent.name !== allowlistName,
    )
    .map((dirent) => join(dirent.parentPath, dirent.name))
    .sort();
}

/** Scopre per GLOB i file `*.json` sotto `dir` (ricorsivo). Speculare a validate-content.ts. */
async function discoverLessons(dir: string): Promise<string[]> {
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

/**
 * Legge l'allowlist se presente: un array JSON di `{ span, reason }`. Assente ⇒
 * `[]` (nessuna motivazione). Malformata ⇒ errore leggibile (non un falso verde
 * che ignora una allowlist rotta). La motivazione è MECCANICA: una `reason` vuota
 * NON sopprime (la scrematura è dentro `detectOverlaps`), quindi non filtriamo qui.
 */
function loadAllowlist(path: string): MotivatedException[] {
  if (!existsSync(path)) {
    return [];
  }
  const raw = readFileSync(path, 'utf8');
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Allowlist ${path} non è JSON valido: ${(error as Error).message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`Allowlist ${path}: attesa una lista di { span, reason }.`);
  }
  return data.map((entry, i) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as { span?: unknown }).span !== 'string' ||
      typeof (entry as { reason?: unknown }).reason !== 'string'
    ) {
      throw new Error(
        `Allowlist ${path}[${i}]: ogni voce richiede { span: string, reason: string }.`,
      );
    }
    return { span: (entry as MotivatedException).span, reason: (entry as MotivatedException).reason };
  });
}

/**
 * L'ESITO del controllo, senza side effect di processo (nessun `console`, nessun
 * `process.exit`): la lista dei transcript trovati, le sovrapposizioni rilevate, e
 * se il controllo è passato. È PASSATO se e solo se c'è ALMENO un transcript
 * (altrimenti niente da confrontare ⇒ nulla verificato, non un falso verde) E non
 * resta alcuna sovrapposizione NON motivata. Così i test asseriscono l'esito senza
 * spawnare il CLI.
 */
export interface CheckResult {
  readonly transcriptPaths: ReadonlyArray<string>;
  readonly overlaps: ReadonlyArray<ContaminationOverlap>;
  readonly passed: boolean;
  readonly noTranscript: boolean;
  // Voci di allowlist (con `reason` non vuota) il cui `span` non combacia con
  // alcuna sovrapposizione: segnale d'igiene (refuso/voce stale). NON fa fallire
  // il controllo — è solo un avviso.
  readonly unusedAllowlist: ReadonlyArray<MotivatedException>;
}

/**
 * Composizione PURA di effetti (glob + read + detect) SENZA side effect di
 * processo. Globba i transcript sotto `transcriptDir`, le lezioni sotto
 * `lessonsDir`, legge l'allowlist opzionale, `parseLesson` ogni lezione,
 * `collectProducedTexts` + `detectOverlaps`, e restituisce l'esito. Il `main` sopra
 * lo traduce in report + exit code.
 *
 * Un JSON di lezione malformato ⇒ errore leggibile (l'esito del controllo dipende
 * dal contenuto reale: non lo si può saltare in silenzio).
 */
export async function runCheck(opts: {
  readonly transcriptDir: string;
  readonly lessonsDir: string;
  readonly allowlistPath?: string;
}): Promise<CheckResult> {
  // L'allowlist vive ACCANTO ai transcript: assente `allowlistPath`, la si deriva
  // dalla transcriptDir, così segue una transcriptDir personalizzata (Patch 2).
  const allowlistPath = opts.allowlistPath ?? join(opts.transcriptDir, ALLOWLIST_NAME);
  const transcriptPaths = await discoverTranscripts(opts.transcriptDir, allowlistPath);

  // Nessun transcript: niente da confrontare ⇒ nulla verificato. NON è un verde:
  // è la I/O Matrix «Nessun transcript ⇒ messaggio + exit non-zero».
  if (transcriptPaths.length === 0) {
    return {
      transcriptPaths: [],
      overlaps: [],
      passed: false,
      noTranscript: true,
      unusedAllowlist: [],
    };
  }

  const transcripts: TranscriptText[] = await Promise.all(
    transcriptPaths.map(async (path) => ({ path, text: await readFile(path, 'utf8') })),
  );

  const allowlist = loadAllowlist(allowlistPath);

  const lessonPaths = await discoverLessons(opts.lessonsDir);
  const produced: ProducedText[] = [];
  for (const path of lessonPaths) {
    const source = await readFile(path, 'utf8');
    let data: unknown;
    try {
      data = JSON.parse(source) as unknown;
    } catch (error) {
      throw new Error(`Lezione ${path}: JSON non valido — ${(error as Error).message}`);
    }
    const parsed = parseLesson(data);
    if (!parsed.ok) {
      const first = parsed.issues[0];
      const where = first !== undefined && first.path.length > 0 ? first.path.join('.') : '(file)';
      throw new Error(
        `Lezione ${path}: non conforme allo schema (${where}: ${first?.message ?? 'sconosciuto'}). ` +
          `Esegui prima \`npm run validate-content\`.`,
      );
    }
    produced.push(...collectProducedTexts(parsed.value, path));
  }

  const overlaps = detectOverlaps(produced, transcripts, { allowlist });
  const unmotivated = overlaps.filter((o) => o.motivated === undefined);
  const unusedAllowlist = unusedAllowlistEntries(overlaps, allowlist);

  return {
    transcriptPaths,
    overlaps,
    passed: unmotivated.length === 0,
    noTranscript: false,
    unusedAllowlist,
  };
}

/**
 * Report umano dell'esito su stdout/stderr. Le sovrapposizioni NON motivate vanno
 * su stderr (sono il fallimento); quelle motivate su stdout (registro, non
 * fallimento). Nessuna sovrapposizione ⇒ una riga verde.
 */
function report(result: CheckResult): void {
  if (result.noTranscript) {
    console.error(
      'Controllo anti-contaminazione NON eseguito: nessun transcript sotto `.authoring/`.',
    );
    console.error(
      '  Niente da confrontare ⇒ nulla verificato. Metti il/i transcript della fonte in',
    );
    console.error(
      '  `.authoring/` (mai versionato, 6.1) e riesegui. Questo NON è un verde.',
    );
    return;
  }

  console.log(
    `Transcript confrontati (${result.transcriptPaths.length}): ${result.transcriptPaths.join(', ')}`,
  );

  // Avviso d'igiene (non un fallimento): voci di allowlist che non motivano alcuna
  // sovrapposizione reale — un refuso nello span, o un esempio che non esiste più.
  if (result.unusedAllowlist.length > 0) {
    console.error(
      `AVVISO: ${result.unusedAllowlist.length} voce/i di allowlist inutilizzata/e (span che non ` +
        `combacia con alcuna sovrapposizione — refuso o voce stale):`,
    );
    for (const entry of result.unusedAllowlist) {
      console.error(`  «${entry.span}» — motivo: ${entry.reason}`);
    }
  }

  const motivated = result.overlaps.filter((o) => o.motivated !== undefined);
  const unmotivated = result.overlaps.filter((o) => o.motivated === undefined);

  if (motivated.length > 0) {
    console.log(`Sovrapposizioni MOTIVATE (allowlist, non fanno fallire): ${motivated.length}.`);
    for (const o of motivated) {
      console.log(
        `  ${o.lessonPath} — ${o.field} ⇄ ${o.transcriptPath}: «${o.span}» ` +
          `(${o.length} ${o.kind === 'ja' ? 'caratteri' : 'parole'}) — motivo: ${o.motivated!}`,
      );
    }
  }

  if (unmotivated.length > 0) {
    console.error(
      `Controllo anti-contaminazione FALLITO: ${unmotivated.length} sovrapposizione/i non motivata/e.`,
    );
    for (const o of unmotivated) {
      console.error(
        `  ${o.lessonPath} — ${o.field} ⇄ ${o.transcriptPath}: «${o.span}» ` +
          `(${o.length} ${o.kind === 'ja' ? 'caratteri' : 'parole'}, a partire da ${o.start}).`,
      );
    }
    console.error(
      '  Riscrivi la frase/spiegazione dal FATTO (docs/authoring-pipeline.md), oppure — se è',
    );
    console.error(
      '  un esempio canonico pubblico — motivala nell\'allowlist con una `reason` non vuota.',
    );
    return;
  }

  console.log('Controllo anti-contaminazione OK: nessuna sovrapposizione non motivata.');
}

async function main(): Promise<void> {
  const transcriptDir = process.argv[2] ?? DEFAULT_TRANSCRIPT_DIR;
  const lessonsDir = process.argv[3] ?? DEFAULT_LESSONS_DIR;
  const result = await runCheck({ transcriptDir, lessonsDir });
  report(result);
  process.exit(result.passed ? 0 : 1);
}

// Esegui il CLI solo come ENTRYPOINT, non quando importato dai test. La
// discriminante è il RUNNER (come `scripts/validate-content.ts`): la CLI reale gira
// sotto `vite-node` (nessun `process.env.VITEST`), i test sotto `vitest` (VITEST
// impostato), quindi importano `runCheck` senza far partire il CLI né uscire dal
// processo.
if (process.env.VITEST === undefined) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
