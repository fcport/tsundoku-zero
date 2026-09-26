import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MIN_JA_RUN,
  MIN_PROSE_WORDS,
  collectProducedTexts,
  detectOverlaps,
  normalizeJa,
  normalizeProse,
  unusedAllowlistEntries,
  type ContaminationOverlap,
  type MotivatedException,
  type ProducedText,
  type TranscriptText,
} from '../scripts/lib/contamination';
import { runCheck } from '../scripts/check-contamination';
import type { Lesson } from './domain/lesson';

// Test di igiene per la storia 6.3 — il confronto che impedisce la contaminazione.
// Come src/authoring-runbook.test.ts prova la coppia doc↔esempio del runbook, qui
// si prova la coppia doc↔strumento del controllo anti-contaminazione:
//   (a) il NUCLEO PURO segnala una sovrapposizione e assolve il contenuto pulito,
//       usando FIXTURE SINTETICHE (un «transcript» INVENTATO, mai materiale della
//       fonte) — così AC1/AC2 sono verificati meccanicamente SENZA versionare un
//       transcript, coerente con la ragione per cui il controllo non è in CI;
//   (b) `runCheck` end-to-end su una TEMP DIR fuori dal repo (transcript+lezione
//       sintetici), inclusa la riga «nessun transcript ⇒ esito non passato»;
//   (c) le ANCORE obbligatorie di docs/contamination-check.md (AC4: non-cancello-
//       di-CI, unico anello non a valle, audit retroattivo della lezione campione),
//       così una revisione futura non le rimuove in silenzio;
//   (d) lo script npm `check-contamination` è presente in package.json.
// NESSUN transcript reale entra nel repo: le fixture sono testo sintetico in una
// temp dir del sistema (mkdtempSync su tmpdir()), mai sotto content/ né src/.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

/** Una lezione sintetica minima, valida di forma, per estrarre i testi prodotti. */
function syntheticLesson(overrides?: Partial<Lesson>): Lesson {
  return {
    order: 1,
    title: { en: 'A synthetic title about particles', it: 'Un titolo sintetico sulle particelle' },
    grammarPoints: ['gp'],
    exercises: [
      {
        kind: 'single-select',
        grammarPoint: 'gp',
        sentence: { kanji: '猫が魚を食べる', kana: 'ねこがさかなをたべる' },
        answer: 'が',
        distractors: ['は', 'を'],
        explanation: {
          en: 'The subject particle marks the new information in this sentence clearly.',
          it: 'La particella soggetto marca l\'informazione nuova in questa frase.',
        },
      },
    ],
    ...overrides,
  } as Lesson;
}

describe('storia 6.3 — nucleo puro (fixture sintetiche)', () => {
  it('normalizeJa: NFKC + strip di spazi e punteggiatura', () => {
    // 全角 → 半角 (NFKC) e via spazi/punteggiatura: restano solo i caratteri di
    // contenuto, così un run verbatim è una sequenza contigua.
    expect(normalizeJa('猫が、 魚を。')).toBe('猫が魚を');
    expect(normalizeJa('ＡＢＣ')).toBe('ABC'); // full-width → half-width
  });

  it('normalizeProse: NFKC + minuscolo + parole senza punteggiatura ai bordi', () => {
    expect(normalizeProse('The Subject, is: new.')).toEqual(['the', 'subject', 'is', 'new']);
  });

  it('collectProducedTexts estrae JA (kanji/kana) e prosa (title/explanation en/it) con etichetta', () => {
    const produced = collectProducedTexts(syntheticLesson(), 'lesson.json');
    const fields = produced.map((p) => p.field);
    expect(fields).toContain('title.en');
    expect(fields).toContain('title.it');
    expect(fields).toContain('exercises.0.sentence.kanji');
    expect(fields).toContain('exercises.0.sentence.kana');
    expect(fields).toContain('exercises.0.explanation.en');
    expect(fields).toContain('exercises.0.explanation.it');
    // Le frasi sono JA (per carattere), le spiegazioni/titolo prosa (per parola).
    expect(produced.find((p) => p.field === 'exercises.0.sentence.kanji')!.kind).toBe('ja');
    expect(produced.find((p) => p.field === 'exercises.0.explanation.en')!.kind).toBe('prose');
  });

  it('title.it/explanation.it assenti ⇒ non estratti', () => {
    const lesson = syntheticLesson({
      title: { en: 'Only english' },
      exercises: [
        {
          kind: 'single-select',
          grammarPoint: 'gp',
          sentence: { kanji: '猫が魚を食べる', kana: 'ねこがさかなをたべる' },
          answer: 'が',
          distractors: ['は'],
          explanation: { en: 'Only english explanation here.' },
        },
      ] as Lesson['exercises'],
    });
    const fields = collectProducedTexts(lesson, 'l.json').map((p) => p.field);
    expect(fields).not.toContain('title.it');
    expect(fields).not.toContain('exercises.0.explanation.it');
  });

  // --- I/O Matrix ------------------------------------------------------------

  it('Sovrapposizione JA: run ≥ soglia condiviso ⇒ overlap col campo e lo span', () => {
    const produced: ProducedText[] = [
      { lessonPath: 'l', field: 'exercises.0.sentence.kanji', kind: 'ja', text: '猫が魚を食べる' },
    ];
    const transcripts: TranscriptText[] = [
      { path: 't.txt', text: '…そして 猫が魚を食べる のを見た。' },
    ];
    const overlaps = detectOverlaps(produced, transcripts, { minJaRun: 5 });
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].field).toBe('exercises.0.sentence.kanji');
    expect(overlaps[0].kind).toBe('ja');
    expect(overlaps[0].span).toBe('猫が魚を食べる');
    expect(overlaps[0].length).toBe(7);
    expect(overlaps[0].transcriptPath).toBe('t.txt');
    expect(overlaps[0].motivated).toBeUndefined();
  });

  it('Contenuto pulito JA: solo run brevi (< soglia) ⇒ nessun overlap', () => {
    const produced: ProducedText[] = [
      { lessonPath: 'l', field: 'f', kind: 'ja', text: '犬が走る' },
    ];
    // Condividono solo «が» (1 carattere), sotto ogni soglia sensata.
    const transcripts: TranscriptText[] = [{ path: 't.txt', text: '猫が魚を食べる' }];
    expect(detectOverlaps(produced, transcripts, { minJaRun: MIN_JA_RUN })).toEqual([]);
  });

  it('Sovrapposizione in prosa: ≥ soglia parole consecutive ⇒ overlap sul campo explanation', () => {
    const produced: ProducedText[] = [
      {
        lessonPath: 'l',
        field: 'exercises.0.explanation.en',
        kind: 'prose',
        text: 'The subject particle marks new information in the sentence.',
      },
    ];
    const transcripts: TranscriptText[] = [
      { path: 't.txt', text: 'Remember: the subject particle marks new information, always.' },
    ];
    const overlaps = detectOverlaps(produced, transcripts, { minProseWords: 4 });
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].field).toBe('exercises.0.explanation.en');
    expect(overlaps[0].kind).toBe('prose');
    expect(overlaps[0].span).toBe('the subject particle marks new information');
  });

  it('Contenuto pulito prosa: solo run brevi/comuni (< soglia) ⇒ nessun overlap', () => {
    const produced: ProducedText[] = [
      { lessonPath: 'l', field: 'f', kind: 'prose', text: 'The particle is here for you.' },
    ];
    const transcripts: TranscriptText[] = [
      { path: 't.txt', text: 'The particle appears in a totally different explanation entirely.' },
    ];
    // Condividono solo «the particle» (2 parole), sotto la soglia di 6.
    expect(detectOverlaps(produced, transcripts, { minProseWords: MIN_PROSE_WORDS })).toEqual([]);
  });

  it('Esempio canonico motivato: allowlist con reason≠"" riclassifica, non fa fallire', () => {
    const produced: ProducedText[] = [
      { lessonPath: 'l', field: 'f', kind: 'ja', text: '猫が魚を食べる' },
    ];
    const transcripts: TranscriptText[] = [{ path: 't.txt', text: '猫が魚を食べる' }];
    const allowlist: MotivatedException[] = [
      { span: '猫が魚を食べる', reason: 'frase d\'esempio canonica pubblica' },
    ];
    const overlaps = detectOverlaps(produced, transcripts, { minJaRun: 5, allowlist });
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].motivated).toBe('frase d\'esempio canonica pubblica');
  });

  it('reason vuota NON sopprime: resta un fallimento (motivated undefined)', () => {
    const produced: ProducedText[] = [
      { lessonPath: 'l', field: 'f', kind: 'ja', text: '猫が魚を食べる' },
    ];
    const transcripts: TranscriptText[] = [{ path: 't.txt', text: '猫が魚を食べる' }];
    const allowlist: MotivatedException[] = [{ span: '猫が魚を食べる', reason: '   ' }];
    const overlaps = detectOverlaps(produced, transcripts, { minJaRun: 5, allowlist });
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].motivated).toBeUndefined();
  });

  it('riporta il run MASSIMALE, non i sotto-run', () => {
    const produced: ProducedText[] = [
      { lessonPath: 'l', field: 'f', kind: 'ja', text: '猫が魚を食べる' },
    ];
    const transcripts: TranscriptText[] = [{ path: 't.txt', text: '猫が魚を食べる' }];
    const overlaps = detectOverlaps(produced, transcripts, { minJaRun: 3 });
    // Un solo overlap massimale, non uno per ogni finestra da 3.
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].span).toBe('猫が魚を食べる');
  });

  it('soglia ≤ 0 non produce sovrapposizioni a lunghezza zero (guardia Math.max(1,…))', () => {
    // Contenuto senza ALCUN carattere condiviso: nessun run reale. Con la guardia,
    // minJaRun:0 è alzato a 1: `best=0` non soddisfa `>= 1`, quindi NESSUN overlap
    // spurio a lunghezza zero. (Senza la guardia, `best=0 >= 0` emetterebbe un
    // overlap fantasma a ogni posizione.)
    const produced: ProducedText[] = [
      { lessonPath: 'l', field: 'f', kind: 'ja', text: '猫犬象' },
    ];
    const transcripts: TranscriptText[] = [{ path: 't.txt', text: '魚鳥獣' }];
    const overlaps = detectOverlaps(produced, transcripts, { minJaRun: 0 });
    expect(overlaps).toEqual([]);
    // Simmetrico per la prosa: nessuna parola condivisa.
    const prose: ProducedText[] = [
      { lessonPath: 'l', field: 'f', kind: 'prose', text: 'alpha beta gamma' },
    ];
    const proseTr: TranscriptText[] = [{ path: 't.txt', text: 'delta epsilon zeta' }];
    expect(detectOverlaps(prose, proseTr, { minProseWords: -3 })).toEqual([]);
  });

  it('multi-transcript: riporta il transcriptPath che contiene il run MASSIMALE', () => {
    const produced: ProducedText[] = [
      { lessonPath: 'l', field: 'f', kind: 'ja', text: '猫が魚を食べる' },
    ];
    // Il primo transcript condivide solo un run corto (「猫が」), il secondo l'intera
    // frase: il run massimale è nel secondo, ed è quello che l'overlap deve nominare.
    const transcripts: TranscriptText[] = [
      { path: 'short.txt', text: '猫が walked away' },
      { path: 'long.txt', text: '前 猫が魚を食べる 後' },
    ];
    const overlaps = detectOverlaps(produced, transcripts, { minJaRun: 2 });
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].span).toBe('猫が魚を食べる');
    expect(overlaps[0].transcriptPath).toBe('long.txt');
  });
});

describe('storia 6.3 — unusedAllowlistEntries (igiene dell\'allowlist)', () => {
  const overlaps: ContaminationOverlap[] = [
    {
      lessonPath: 'l',
      field: 'f',
      kind: 'ja',
      transcriptPath: 't.txt',
      span: '猫が魚を食べる',
      length: 7,
      start: 0,
    },
  ];

  it('voce con span inesistente ⇒ elencata (refuso o voce stale)', () => {
    const allowlist: MotivatedException[] = [{ span: '存在しない', reason: 'esempio' }];
    expect(unusedAllowlistEntries(overlaps, allowlist)).toEqual(allowlist);
  });

  it('voce che combacia con una sovrapposizione ⇒ non elencata', () => {
    const allowlist: MotivatedException[] = [{ span: '猫が魚を食べる', reason: 'esempio' }];
    expect(unusedAllowlistEntries(overlaps, allowlist)).toEqual([]);
  });

  it('voce con reason vuota ⇒ mai elencata (non è una motivazione)', () => {
    const allowlist: MotivatedException[] = [{ span: '存在しない', reason: '   ' }];
    expect(unusedAllowlistEntries(overlaps, allowlist)).toEqual([]);
  });
});

describe('storia 6.3 — runCheck end-to-end (temp dir fuori dal repo)', () => {
  let dir: string;
  let transcriptDir: string;
  let lessonsDir: string;

  beforeEach(() => {
    // Fixture SINTETICHE in una temp dir del sistema, MAI sotto content/ né src/.
    dir = mkdtempSync(join(tmpdir(), 'contamination-'));
    transcriptDir = join(dir, '.authoring');
    lessonsDir = join(dir, 'lessons');
    mkdirSync(transcriptDir, { recursive: true });
    mkdirSync(lessonsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeLesson(name: string, lesson: Lesson): void {
    writeFileSync(join(lessonsDir, name), JSON.stringify(lesson), 'utf8');
  }

  it('nessun transcript ⇒ esito NON passato (niente da confrontare ⇒ nulla verificato)', async () => {
    writeLesson('01.json', syntheticLesson());
    const result = await runCheck({ transcriptDir, lessonsDir });
    expect(result.noTranscript).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('contenuto pulito (transcript sintetico non correlato) ⇒ passato', async () => {
    writeFileSync(
      join(transcriptDir, 'source.txt'),
      'A completely unrelated transcript about weather and mountains and rivers.',
      'utf8',
    );
    writeLesson('01.json', syntheticLesson());
    const result = await runCheck({ transcriptDir, lessonsDir });
    expect(result.noTranscript).toBe(false);
    expect(result.transcriptPaths).toHaveLength(1);
    expect(result.passed).toBe(true);
    expect(result.overlaps).toEqual([]);
  });

  it('sovrapposizione JA con un transcript sintetico ⇒ NON passato, overlap segnalato', async () => {
    // La kana prodotta (ねこがさかなをたべる, 10 caratteri) supera la soglia di
    // DEFAULT (MIN_JA_RUN=8): il controllo scatta senza abbassare le soglie. Il
    // transcript INVENTATO la contiene verbatim.
    writeFileSync(join(transcriptDir, 'source.txt'), '前置き ねこがさかなをたべる 後置き', 'utf8');
    writeLesson('01.json', syntheticLesson());
    const result = await runCheck({ transcriptDir, lessonsDir });
    expect(result.passed).toBe(false);
    const kanaOverlap = result.overlaps.find((o) => o.field === 'exercises.0.sentence.kana');
    expect(kanaOverlap).toBeDefined();
    expect(kanaOverlap!.span).toBe('ねこがさかなをたべる');
    expect(kanaOverlap!.motivated).toBeUndefined();
  });

  it('sovrapposizione motivata via allowlist ⇒ passato', async () => {
    writeFileSync(join(transcriptDir, 'source.txt'), '前置き ねこがさかなをたべる 後置き', 'utf8');
    writeLesson('01.json', syntheticLesson());
    const allowlistPath = join(dir, 'allowlist.json');
    writeFileSync(
      allowlistPath,
      JSON.stringify([{ span: 'ねこがさかなをたべる', reason: 'esempio canonico' }]),
      'utf8',
    );
    const result = await runCheck({ transcriptDir, lessonsDir, allowlistPath });
    // La sovrapposizione a soglia di default è ora MOTIVATA ⇒ nessuna non motivata
    // resta ⇒ passato.
    expect(result.passed).toBe(true);
    expect(result.overlaps.every((o) => o.motivated !== undefined)).toBe(true);
  });

  it('allowlist malformata ⇒ errore leggibile (non un falso verde)', async () => {
    writeFileSync(join(transcriptDir, 'source.txt'), 'x', 'utf8');
    writeLesson('01.json', syntheticLesson());
    const allowlistPath = join(dir, 'allowlist.json');
    writeFileSync(allowlistPath, '{ not an array }', 'utf8');
    await expect(runCheck({ transcriptDir, lessonsDir, allowlistPath })).rejects.toThrow();
  });

  it('allowlist DENTRO la transcriptDir (senza allowlistPath) ⇒ sovrapposizione motivata', async () => {
    // Patch 2: l'allowlist di default segue la transcriptDir. Scritta ACCANTO ai
    // transcript come `contamination-allowlist.json`, e SENZA passare allowlistPath,
    // deve essere trovata e riclassificare la sovrapposizione. (Non deve neppure
    // entrare nel glob dei transcript: è configurazione, non materiale-fonte — ma il
    // suo nome non finisce in un'estensione riconosciuta, quindi è già esclusa.)
    writeFileSync(join(transcriptDir, 'source.txt'), '前置き ねこがさかなをたべる 後置き', 'utf8');
    writeFileSync(
      join(transcriptDir, 'contamination-allowlist.json'),
      JSON.stringify([{ span: 'ねこがさかなをたべる', reason: 'esempio canonico' }]),
      'utf8',
    );
    writeLesson('01.json', syntheticLesson());
    const result = await runCheck({ transcriptDir, lessonsDir });
    expect(result.passed).toBe(true);
    expect(result.overlaps.every((o) => o.motivated !== undefined)).toBe(true);
    expect(result.unusedAllowlist).toEqual([]);
  });

  it('voce di allowlist inutilizzata (span che non combacia) ⇒ segnalata in unusedAllowlist, non fa fallire', async () => {
    // Patch 3 end-to-end: transcript non correlato (nessuna sovrapposizione), ma una
    // voce di allowlist con reason: l'esito resta passato (nessuna sovrapposizione
    // non motivata) e la voce compare come inutilizzata.
    writeFileSync(join(transcriptDir, 'source.txt'), 'Totally unrelated content here.', 'utf8');
    writeFileSync(
      join(transcriptDir, 'contamination-allowlist.json'),
      JSON.stringify([{ span: 'refuso che non esiste', reason: 'esempio' }]),
      'utf8',
    );
    writeLesson('01.json', syntheticLesson());
    const result = await runCheck({ transcriptDir, lessonsDir });
    expect(result.passed).toBe(true);
    expect(result.unusedAllowlist).toHaveLength(1);
    expect(result.unusedAllowlist[0].span).toBe('refuso che non esiste');
  });

  it('lezione con JSON malformato ⇒ errore leggibile', async () => {
    writeFileSync(join(transcriptDir, 'source.txt'), 'x', 'utf8');
    writeFileSync(join(lessonsDir, '01.json'), '{ broken', 'utf8');
    await expect(runCheck({ transcriptDir, lessonsDir })).rejects.toThrow(/JSON non valido/);
  });

  it('lezione JSON valido ma NON conforme allo schema ⇒ errore «non conforme allo schema»', async () => {
    // Patch 5: `{ "order": 1 }` è JSON valido (non scatta il catch di JSON.parse) ma
    // manca title/grammarPoints/exercises ⇒ deve raggiungere il ramo `!parsed.ok`.
    writeFileSync(join(transcriptDir, 'source.txt'), 'x', 'utf8');
    writeFileSync(join(lessonsDir, '01.json'), '{ "order": 1 }', 'utf8');
    await expect(runCheck({ transcriptDir, lessonsDir })).rejects.toThrow(
      /non conforme allo schema/,
    );
  });
});

describe('storia 6.3 — documentazione del controllo (docs/contamination-check.md)', () => {
  const docPath = resolve(repoRoot, 'docs', 'contamination-check.md');

  it('docs/contamination-check.md esiste', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it('dichiara cosa confronta (AC1): frase giapponese e spiegazione, NFKC', () => {
    const doc = readFileSync(docPath, 'utf-8');
    expect(doc).toMatch(/frase giapponese/i);
    expect(doc).toMatch(/spiegazione/i);
    expect(doc).toMatch(/sentence\.kanji/);
    expect(doc).toMatch(/sentence\.kana/);
    expect(doc).toMatch(/explanation\.en/);
    expect(doc).toMatch(/explanation\.it/);
    expect(doc).toMatch(/NFKC/);
    // Come si esegue.
    expect(doc).toMatch(/npm run check-contamination/);
    // «Non banale»: le soglie dichiarate e tarabili.
    expect(doc).toMatch(/MIN_JA_RUN/);
    expect(doc).toMatch(/MIN_PROSE_WORDS/);
    expect(doc).toMatch(/tarabil/i);
  });

  it('dichiara la risposta a una segnalazione (AC2): riscrivere o motivare, reason non vuota', () => {
    const doc = readFileSync(docPath, 'utf-8');
    expect(doc).toMatch(/riscriv/i);
    expect(doc).toMatch(/motiv/i);
    expect(doc).toMatch(/allowlist/i);
    // reason vuota NON sopprime.
    expect(doc).toMatch(/reason/i);
    expect(doc).toMatch(/vuota/i);
  });

  it('dichiara collocazione e limite (AC4): non-cancello-di-CI, unico anello, per 6.1', () => {
    const doc = readFileSync(docPath, 'utf-8');
    // Non può essere un cancello di CI perché il transcript è fuori dal repo.
    expect(doc).toMatch(/non può essere un cancello di CI/i);
    expect(doc).toMatch(/transcript/i);
    expect(doc).toMatch(/6\.1/);
    // L'unico anello della catena di qualità che non si chiude a valle.
    expect(doc).toMatch(/unico anello/i);
    expect(doc).toMatch(/valle/i);
  });

  it('registra l\'audit retroattivo (AC3) della lezione campione di 2.7', () => {
    const doc = readFileSync(docPath, 'utf-8');
    expect(doc).toMatch(/audit retroattivo/i);
    expect(doc).toMatch(/content\/lessons\/01-la-particella-wo\.json/);
    // L'esito o l'azione dovuta all'operatore (transcript privato assente).
    expect(doc).toMatch(/operatore/i);
    expect(doc).toMatch(/2\.7/);
  });
});

describe('storia 6.3 — script npm', () => {
  it('package.json espone lo script check-contamination', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['check-contamination']).toBeDefined();
    expect(pkg.scripts?.['check-contamination']).toMatch(/scripts\/check-contamination\.ts/);
  });
});

describe('storia 6.3 — CLI reale: contratto detection⇄exit-code (spawn)', () => {
  // Patch 1: il contratto OSSERVABILE del CLI — `main()` → `process.exit(passed?0:1)`,
  // la guardia entrypoint `process.env.VITEST === undefined`, e `report()` — non è
  // esercitato asserendo `runCheck(...).passed` in-process. Va provato SPAWNANDO il
  // processo reale con `VITEST` rimosso dall'ambiente (altrimenti il figlio erediterebbe
  // il `VITEST` di questo runner e la guardia sopprimerebbe `main()`), esattamente come
  // fa il CLI fratello in src/validate-content-script.test.ts (righe 145-178).
  const viteNodeBin = resolve(repoRoot, 'node_modules', 'vite-node', 'vite-node.mjs');
  const scriptPath = resolve(repoRoot, 'scripts', 'check-contamination.ts');

  let dir: string;
  let transcriptDir: string;
  let lessonsDir: string;

  beforeEach(() => {
    // Fixture SINTETICHE in una temp dir del sistema, MAI sotto content/ né src/.
    dir = mkdtempSync(join(tmpdir(), 'contamination-cli-'));
    transcriptDir = join(dir, '.authoring');
    lessonsDir = join(dir, 'lessons');
    mkdirSync(transcriptDir, { recursive: true });
    mkdirSync(lessonsDir, { recursive: true });
    writeFileSync(join(lessonsDir, '01.json'), JSON.stringify(syntheticLesson()), 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Esegue il CLI reale su (transcriptDir, lessonsDir) e ritorna il codice d'uscita
   * (0 = verde). L'ambiente è ripulito da `VITEST` così la guardia dell'entrypoint
   * NON sopprime `main()` — il contratto di exit-code gira come nello step reale.
   */
  function runCli(tDir: string, lDir: string): number {
    const env = { ...process.env };
    delete env.VITEST;
    try {
      execFileSync(process.execPath, [viteNodeBin, scriptPath, tDir, lDir], {
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

  it('transcript non correlato ⇒ exit 0 (nessuna sovrapposizione non motivata)', () => {
    writeFileSync(
      join(transcriptDir, 'source.txt'),
      'A completely unrelated transcript about weather and mountains.',
      'utf8',
    );
    expect(runCli(transcriptDir, lessonsDir)).toBe(0);
  });

  it('transcript che contiene verbatim la kana prodotta ⇒ exit NON-zero', () => {
    writeFileSync(join(transcriptDir, 'source.txt'), '前置き ねこがさかなをたべる 後置き', 'utf8');
    expect(runCli(transcriptDir, lessonsDir)).not.toBe(0);
  });

  it('nessun transcript ⇒ exit NON-zero (niente da confrontare ⇒ nulla verificato)', () => {
    // transcriptDir esiste ma è vuota: nessun file-fonte.
    expect(runCli(transcriptDir, lessonsDir)).not.toBe(0);
  });
});
