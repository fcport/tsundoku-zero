// CLI di generazione dell'audio delle frasi con VOICEVOX (motore locale, gratis).
// Fa SOLO I/O — legge le lezioni, interroga il motore, scrive i file — e delega le
// regole al dominio: il nome del file (`sentenceAudioFile`) e il confronto delle
// letture (`readingKey`) stanno in `src/domain/sentence-audio.ts`.
//
// Per ogni frase chiede a VOICEVOX la lettura che userebbe (`audio_query`) e la
// confronta con `sentence.kana`, scritto a mano. Se non coincidono (降りません letto
// おりません, 日本 letto にっぽん), riparte dalla frase in kana; se anche così non
// coincide, la frase è segnalata e il comando esce con errore.
//
// Prerequisiti: VOICEVOX installato e `ffmpeg` nel PATH. Se il motore non risponde
// su http://127.0.0.1:50021, lo script lo avvia da solo (`vv-engine/run.exe`, senza
// finestra) e a fine giro lo chiude. Il percorso viene da `VOICEVOX_ENGINE_PATH` (anche
// in `.env.local`), altrimenti dall'installazione predefinita in
// `%LOCALAPPDATA%\Programs\VOICEVOX`. Licenza della voce: «VOICEVOX:No.7», uso non
// commerciale (LICENSE-CONTENT).
//
// Uso: `npm run generate-audio -- [--force] [--lesson <pezzo del nome file>]
//        [--speaker <id stile>] [--out <dir>]`
// Senza `--lesson`, cancella anche gli audio di frasi che non esistono più.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readingKey, sentenceAudioFile } from '../src/domain/sentence-audio.ts';

const ENGINE = 'http://127.0.0.1:50021';
const LESSONS_DIR = join('content', 'lessons');
/** No.7, stile アナウンス. */
const DEFAULT_SPEAKER = 30;

interface AudioQuery {
  readonly accent_phrases: ReadonlyArray<{ readonly moras: ReadonlyArray<{ readonly text: string }> }>;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function engine(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${ENGINE}${path}`, init);
  if (!res.ok) throw new Error(`VOICEVOX ${path}: HTTP ${res.status} ${await res.text()}`);
  return res;
}

async function engineUp(): Promise<boolean> {
  try {
    return (await fetch(`${ENGINE}/version`)).ok;
  } catch {
    return false;
  }
}

/**
 * Il motore se è già acceso; altrimenti lo avvia e aspetta che risponda. Restituisce
 * il processo avviato (da chiudere a fine giro) o `null` se era già acceso.
 */
async function ensureEngine(): Promise<ChildProcess | null> {
  if (await engineUp()) return null;

  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Nessun `.env.local`: resta il percorso predefinito.
  }
  const enginePath =
    process.env.VOICEVOX_ENGINE_PATH ??
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'VOICEVOX', 'vv-engine', 'run.exe');
  if (!existsSync(enginePath)) {
    throw new Error(
      `VOICEVOX non è acceso e il motore non è in ${enginePath}. ` +
        'Imposta VOICEVOX_ENGINE_PATH in .env.local (es. D:\\programs\\voicevox\\vv-engine\\run.exe).',
    );
  }

  console.log(`Avvio VOICEVOX (${enginePath})…`);
  const child = spawn(enginePath, [], { stdio: 'ignore', windowsHide: true });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`VOICEVOX si è chiuso subito (exit ${child.exitCode}).`);
    if (await engineUp()) return child;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  child.kill();
  throw new Error('VOICEVOX non ha risposto entro 2 minuti.');
}

async function audioQuery(text: string, speaker: number): Promise<AudioQuery> {
  const res = await engine(`/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`, { method: 'POST' });
  return (await res.json()) as AudioQuery;
}

function moraText(query: AudioQuery): string {
  return query.accent_phrases.flatMap((p) => p.moras.map((m) => m.text)).join('');
}

/** WAV → MP3 mono 48 kbps con ffmpeg (stdin → file). */
function toMp3(wav: Uint8Array, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-b:a', '48k', outPath]);
    let stderr = '';
    ff.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg (${code}): ${stderr}`))));
    ff.stdin.end(wav);
  });
}

/** Le frasi delle lezioni, senza doppioni: kanji → kana. */
async function loadSentences(lessonFilter: string | undefined): Promise<Map<string, string>> {
  const files = (await readdir(LESSONS_DIR))
    .filter((f) => f.endsWith('.json') && (!lessonFilter || f.includes(lessonFilter)))
    .sort();
  const sentences = new Map<string, string>();
  for (const f of files) {
    const lesson = JSON.parse(await readFile(join(LESSONS_DIR, f), 'utf8')) as {
      exercises: ReadonlyArray<{ sentence: { kanji: string; kana: string } }>;
    };
    for (const e of lesson.exercises) sentences.set(e.sentence.kanji, e.sentence.kana);
  }
  return sentences;
}

async function main(): Promise<void> {
  const lessonFilter = arg('lesson');
  const speaker = Number(arg('speaker') ?? DEFAULT_SPEAKER);
  const outDir = arg('out') ?? join('public', 'audio');
  const force = process.argv.includes('--force');

  const sentences = await loadSentences(lessonFilter);
  await mkdir(outDir, { recursive: true });
  const engineProcess = await ensureEngine();
  try {
    await generate(sentences, { lessonFilter, speaker, outDir, force });
  } finally {
    // Chiuso solo se l'ha aperto lo script: un VOICEVOX già aperto resta com'è.
    engineProcess?.kill();
  }
}

async function generate(
  sentences: Map<string, string>,
  { lessonFilter, speaker, outDir, force }: { lessonFilter?: string; speaker: number; outDir: string; force: boolean },
): Promise<void> {

  const fixed: string[] = [];
  const wrong: string[] = [];
  let generated = 0;
  for (const [kanji, kana] of sentences) {
    const file = sentenceAudioFile(kanji);
    const outPath = join(outDir, file);
    if (!force && existsSync(outPath)) continue;

    let query = await audioQuery(kanji, speaker);
    if (readingKey(moraText(query)) !== readingKey(kana)) {
      const fromKanji = moraText(query);
      query = await audioQuery(kana, speaker);
      const report = `${file}  ${kanji}\n    attesa:    ${kana}\n    dai kanji: ${fromKanji}\n    dai kana:  ${moraText(query)}`;
      if (readingKey(moraText(query)) !== readingKey(kana)) {
        wrong.push(report);
        continue;
      }
      fixed.push(report);
    }

    const res = await engine(`/synthesis?speaker=${speaker}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    await toMp3(new Uint8Array(await res.arrayBuffer()), outPath);
    generated += 1;
    console.log(`${file}  ${kanji}`);
  }

  // Gli audio di frasi tolte o cambiate: solo su un giro completo, altrimenti
  // `--lesson` cancellerebbe l'audio delle altre lezioni.
  let removed = 0;
  if (!lessonFilter) {
    const expected = new Set([...sentences.keys()].map(sentenceAudioFile));
    for (const f of await readdir(outDir)) {
      if (f.endsWith('.mp3') && !expected.has(f)) {
        await rm(join(outDir, f));
        removed += 1;
      }
    }
  }

  console.log(`\n${generated} audio generati, ${removed} rimossi, ${sentences.size} frasi in tutto.`);
  if (fixed.length > 0) {
    console.log(`\n${fixed.length} letture corrette ripartendo dai kana:\n\n${fixed.join('\n')}`);
  }
  if (wrong.length > 0) {
    console.error(`\n${wrong.length} letture ANCORA SBAGLIATE, audio non generato:\n\n${wrong.join('\n')}`);
    process.exitCode = 1;
  }
}

await main();
