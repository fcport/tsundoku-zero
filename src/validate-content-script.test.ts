import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectIssues } from '../scripts/validate-content.ts';

// Il CANCELLO di CI (FR2.6, AC3) ha DUE superfici che i test del dominio non
// coprono: (1) la SCOPERTA dei file (glob robusto, contro i falsi verdi e i
// crash), e (2) il contratto detection⇄EXIT-CODE — «un file malformato blocca il
// merge». `validateLessons` (puro) è testato altrove; qui proviamo lo SCRIPT.
//
// `collectIssues` è la composizione glob+read+validate SENZA side effect: la
// importiamo direttamente (la guardia `VITEST` nel modulo impedisce a `main()` di
// girare). Il contratto di exit-code, invece, non è osservabile senza processo:
// lo proviamo SPAWNANDO il CLI reale (vite-node), come farebbe lo step CI.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const scriptPath = resolve(repoRoot, 'scripts', 'validate-content.ts');
// Invochiamo il modulo di vite-node DIRETTAMENTE con `process.execPath` (node),
// non lo shim `.bin/vite-node.cmd`: su Windows il wrapper batch, spawnato da
// `execFileSync`, viene terminato da un segnale (status null) invece di propagare
// l'exit code. Il modulo .mjs eseguito da node è portabile e restituisce l'exit
// code reale — proprio ciò che AC3 richiede di osservare.
const viteNodeBin = resolve(repoRoot, 'node_modules', 'vite-node', 'vite-node.mjs');

const validLesson = {
  order: 1,
  title: { en: 'Il verbo 読む' },
  grammarPoints: ['〜を読む'],
  exercises: [
    {
      kind: 'single-select',
      grammarPoint: '〜を読む',
      sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
      answer: '読む',
      distractors: ['見る', '書く'],
      explanation: { en: 'The verb to read.' },
    },
  ],
};

const badKindLesson = {
  ...validLesson,
  exercises: [{ ...validLesson.exercises[0], kind: 'foo' }],
};

// Radice temporanea unica per l'intera suite; ripulita alla fine.
let root: string;
const dirs: Record<string, string> = {};

function makeDir(name: string): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'tsundoku-validate-'));

  // conforme
  dirs.good = makeDir('good');
  writeFileSync(join(dirs.good, '01-yomu.json'), JSON.stringify(validLesson), 'utf8');

  // kind fuori registro
  dirs.badKind = makeDir('bad-kind');
  writeFileSync(join(dirs.badKind, '02-broken.json'), JSON.stringify(badKindLesson), 'utf8');

  // JSON non parsabile
  dirs.badJson = makeDir('bad-json');
  writeFileSync(join(dirs.badJson, '03-broken.json'), '{ not valid json', 'utf8');

  // vuota (scoperta = 0 lezioni)
  dirs.empty = makeDir('empty');

  // estensione MAIUSCOLA: deve essere scoperta (niente falso verde)
  dirs.upper = makeDir('upper');
  writeFileSync(join(dirs.upper, '04-UPPER.JSON'), JSON.stringify(badKindLesson), 'utf8');

  // file annidato in una sottocartella: deve essere scoperto (glob ricorsivo)
  dirs.nested = makeDir('nested');
  mkdirSync(join(dirs.nested, 'sub'), { recursive: true });
  writeFileSync(join(dirs.nested, 'sub', '05-nested.json'), JSON.stringify(badKindLesson), 'utf8');

  // una CARTELLA il cui nome finisce in `.json`: va SALTATA (niente crash EISDIR)
  dirs.dirNamedJson = makeDir('dir-named-json');
  mkdirSync(join(dirs.dirNamedJson, 'notafile.json'), { recursive: true });
  writeFileSync(join(dirs.dirNamedJson, '01-yomu.json'), JSON.stringify(validLesson), 'utf8');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('collectIssues — scoperta robusta e validazione (FR2.6)', () => {
  it('cartella ASSENTE ⇒ [] (zero lezioni, percorso grazioso)', async () => {
    const absent = join(root, 'does-not-exist');
    expect(await collectIssues(absent)).toEqual([]);
  });

  it('cartella VUOTA ⇒ [] (zero lezioni)', async () => {
    expect(await collectIssues(dirs.empty)).toEqual([]);
  });

  it('cartella conforme ⇒ []', async () => {
    expect(await collectIssues(dirs.good)).toEqual([]);
  });

  it('kind fuori registro ⇒ issue non vuoto sul path exercises.0.kind', async () => {
    const issues = await collectIssues(dirs.badKind);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.path.join('.') === 'exercises.0.kind')).toBe(true);
  });

  it('JSON non valido ⇒ issue non vuoto', async () => {
    const issues = await collectIssues(dirs.badJson);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => /JSON non valido/.test(i.message))).toBe(true);
  });

  it('estensione MAIUSCOLA `*.JSON` viene scoperta (niente falso verde)', async () => {
    // Il file è malformato: se venisse SALTATO per il case dell'estensione, il
    // cancello direbbe [] (falso verde). Deve invece produrre un issue.
    const issues = await collectIssues(dirs.upper);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('un file in una SOTTOCARTELLA viene scoperto (glob ricorsivo)', async () => {
    const issues = await collectIssues(dirs.nested);
    expect(issues.length).toBeGreaterThan(0);
    // Il path del file scoperto contiene la sottocartella.
    expect(issues.some((i) => i.file.includes('sub'))).toBe(true);
  });

  it('una CARTELLA chiamata `*.json` è saltata senza crashare (no EISDIR)', async () => {
    // La dir contiene un file conforme + una sottocartella `notafile.json`. La
    // seconda NON deve entrare nella lista (crasherebbe su readFile): il risultato
    // è [] senza eccezioni.
    await expect(collectIssues(dirs.dirNamedJson)).resolves.toEqual([]);
  });
});

describe('CLI validate-content — contratto detection⇄exit-code (AC3)', () => {
  /**
   * Esegue il CLI reale su `dir` e ritorna il codice d'uscita (0 = verde).
   *
   * L'ambiente è ripulito da `VITEST`: questo test gira DENTRO vitest, quindi il
   * figlio ne EREDITEREBBE `process.env.VITEST` e la guardia dell'entrypoint
   * sopprimerebbe `main()` — il CLI non eserciterebbe MAI il contratto di
   * exit-code (proprio ciò che vogliamo provare). Rimuovendolo, `main()` gira
   * come nello step CI reale (dove `VITEST` non esiste).
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

  it('cartella conforme ⇒ exit 0 (non blocca)', () => {
    expect(runCli(dirs.good)).toBe(0);
  });

  it('file malformato ⇒ exit NON-zero (blocca il merge, AC3)', () => {
    expect(runCli(dirs.badKind)).not.toBe(0);
  });
});

describe('wiring del cancello in CI (AC3)', () => {
  // Il wiring che fa BLOCCARE il merge è pinnato QUI (come src/boundaries.test.ts
  // pinna la severità del lint): una modifica a ci.yml che aggiunge
  // `continue-on-error: true`, o rimuove lo step / lo script, disattiverebbe il
  // cancello con NULLA che fallisce. Questo test coglie il downgrade silenzioso.
  const workflow = readFileSync(resolve(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  const pkg = readFileSync(resolve(repoRoot, 'package.json'), 'utf8');

  it('package.json definisce lo script validate-content', () => {
    expect(JSON.parse(pkg).scripts['validate-content']).toBeDefined();
  });

  it('ci.yml esegue `npm run validate-content` in uno step', () => {
    expect(workflow).toMatch(/run:\s*npm run validate-content/);
  });

  it('lo step del cancello NON è marcato continue-on-error: true', () => {
    // Isola lo step che esegue validate-content e verifica che, tra quella riga
    // `run:` e lo step successivo (una riga `- name:`), non compaia
    // `continue-on-error: true`. Così un downgrade LOCALE dello step è colto anche
    // se altrove nel file comparisse (in futuro) un continue-on-error legittimo.
    const lines = workflow.split('\n');
    const runIdx = lines.findIndex((l) => /run:\s*npm run validate-content/.test(l));
    expect(runIdx).toBeGreaterThanOrEqual(0);
    // Trova l'inizio dello step (la riga `- name:` che precede il `run:`).
    let stepStart = runIdx;
    while (stepStart > 0 && !/^\s*-\s+name:/.test(lines[stepStart])) {
      stepStart -= 1;
    }
    // Trova l'inizio dello step SUCCESSIVO (la prossima riga `- name:`).
    let nextStep = lines.length;
    for (let i = runIdx + 1; i < lines.length; i += 1) {
      if (/^\s*-\s+name:/.test(lines[i])) {
        nextStep = i;
        break;
      }
    }
    const stepBlock = lines.slice(stepStart, nextStep).join('\n');
    expect(stepBlock).toMatch(/npm run validate-content/);
    expect(stepBlock).not.toMatch(/continue-on-error:\s*true/);
  });
});
