import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateLessons, type LessonFile } from './domain/content-validation';

// Igiene di livello repo per la storia 6.4 — il flusso regge un corso senza fine.
// Come src/authoring-runbook.test.ts prova la coppia doc↔esempio del runbook e
// src/authoring-contamination.test.ts la coppia doc↔strumento del controllo, qui
// si prova la coppia doc↔ANALISI dell'accettazione dell'epica 6:
//   (AC1) l'analisi NFR9 di docs/authoring-cost.md ESAMINA la procedura REALE —
//         una riga di analisi per OGNI passo di docs/authoring-runbook.md. I numeri
//         di passo sono ESTRATTI dal runbook (`^### N.`), non hard-coded: se il
//         runbook guadagna o perde un passo, questo test è rosso finché l'analisi
//         non lo copre (accoppiamento load-bearing). Più le ancore del verdetto
//         (nessun costo manuale cresce; lunghezza non nota / non fissata).
//   (AC2) le ancore della soglia M5 (30 minuti, stima da tarare) e la presenza
//         della tabella di registrazione del tempo.
//   (AC3) le lezioni REALI di content/lessons/ VALIDANO (`validateLessons` → [],
//         guardia anti-vacuità), il conteggio reale (≥ 1) coincide con la
//         sentinella `authored-lessons: N` del doc (contatore onesto: aggiungere una
//         lezione senza aggiornare il doc rende questo test rosso), e il doc dichiara
//         il traguardo DoD (almeno cinque) con lo stato attuale SOTTO il traguardo.
// NON si asserisce N >= 5: sarebbe rosso ora e un agente non può autorare lezioni
// (la rilettura umana di FR11.2 non è delegabile). Il traguardo resta prosa +
// operator_actions; ciò che qui è meccanico è l'analisi ESISTE, COPRE ogni passo, e
// il contenuto reale VALIDA.
// Precedente: src/authoring-runbook.test.ts (coppia doc + test di igiene, storia 6.2).

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const docPath = resolve(repoRoot, 'docs', 'authoring-cost.md');
const runbookPath = resolve(repoRoot, 'docs', 'authoring-runbook.md');
const lessonsDir = resolve(repoRoot, 'content', 'lessons');

/**
 * Estrae i numeri di passo del runbook dalle intestazioni STABILI `### N. …`. È la
 * FONTE dell'accoppiamento: l'analisi del doc di costo deve avere una riga per
 * ognuno di questi numeri, né più né meno. Se il runbook cambia i suoi passi, questo
 * insieme cambia e il test lo pretende dal doc.
 */
function runbookStepNumbers(): number[] {
  const runbook = readFileSync(runbookPath, 'utf-8');
  const numbers = new Set<number>();
  for (const match of runbook.matchAll(/^### (\d+)\./gm)) {
    numbers.add(Number(match[1]));
  }
  return [...numbers].sort((a, b) => a - b);
}

/**
 * Legge il contenuto REALE di `content/lessons/` come lo vedrebbe il cancello: ogni
 * `*.json` (case-insensitive, ricorsivo) → `LessonFile`, `path` relativo alla radice
 * del repo. Modello identico a src/authoring-runbook.test.ts: solo validando questi
 * INSIEME scattano le regole di unicità cross-file. `.gitkeep` non è `*.json`, quindi
 * non è contato.
 */
function realLessonFiles(): LessonFile[] {
  const entries = readdirSync(lessonsDir, { withFileTypes: true, recursive: true });
  return entries
    .filter((dirent) => dirent.isFile() && dirent.name.toLowerCase().endsWith('.json'))
    .map((dirent) => join(dirent.parentPath, dirent.name))
    .sort()
    .map((absPath) => ({
      path: relative(repoRoot, absPath).split('\\').join('/'),
      source: readFileSync(absPath, 'utf-8'),
    }));
}

describe('storia 6.4 — sostenibilità della pipeline (documentazione)', () => {
  it('docs/authoring-cost.md esiste', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it('AC1 — l\'analisi NFR9 copre OGNI passo del runbook (accoppiamento load-bearing)', () => {
    const doc = readFileSync(docPath, 'utf-8');
    const steps = runbookStepNumbers();
    // Il runbook ha i suoi otto passi: se non li estraiamo, il test qui sotto è
    // vacuo. Ci assicuriamo che ce ne sia almeno uno da coprire.
    expect(steps.length).toBeGreaterThan(0);

    // I numeri di passo che l'analisi del doc dichiara: le righe `| N — …` o `| N |`
    // della tabella «Passo | Manuale? | …». Prendiamo il primo campo numerico di ogni
    // riga di tabella markdown. La classe accetta trattino ASCII, en-dash ed em-dash
    // oltre al pipe, così un futuro editor che usi un `-` normale non rompe
    // l'accoppiamento con un `toEqual` oscuro (vedi la nota di manutenzione nel doc).
    const analysed = new Set<number>();
    for (const match of doc.matchAll(/^\|\s*(\d+)\s*[—–\-|]/gm)) {
      analysed.add(Number(match[1]));
    }

    // Copertura ESATTA: ogni passo del runbook ha una riga di analisi, e l'analisi non
    // inventa passi che il runbook non ha. Insieme uguale in entrambe le direzioni.
    for (const step of steps) {
      expect(
        analysed.has(step),
        `l'analisi NFR9 di docs/authoring-cost.md deve avere una riga per il passo ${step} del runbook`,
      ).toBe(true);
    }
    expect([...analysed].sort((a, b) => a - b)).toEqual(steps);
  });

  it('AC1 — dichiara il verdetto NFR9 (nessun costo manuale cresce; lunghezza non nota)', () => {
    const doc = readFileSync(docPath, 'utf-8');
    // Il verdetto esplicito: nessun passaggio manuale cresce col numero di lezioni.
    expect(doc).toMatch(/nessun passaggio manuale/i);
    expect(doc).toMatch(/cresc/i);
    // Verificato contro un corso di lunghezza non nota / non fissata (non un totale).
    expect(doc).toMatch(/non (nota|fissat)/i);
    // La distinzione portante: costo automatico O(N) vs fatica manuale.
    expect(doc).toMatch(/automatic/i);
    expect(doc).toMatch(/manual/i);
    // NFR9 nominato esplicitamente.
    expect(doc).toMatch(/NFR9/);
  });

  it('AC2 — dichiara la soglia M5 (30 minuti, stima da tarare) e la tabella di registrazione', () => {
    const doc = readFileSync(docPath, 'utf-8');
    expect(doc).toMatch(/M5/);
    expect(doc).toMatch(/30/);
    expect(doc).toMatch(/minut/i);
    // 30 minuti è una STIMA DA TARARE, non una verità.
    expect(doc).toMatch(/stima/i);
    expect(doc).toMatch(/tarar/i);
    // La metodologia: inizio = guardare la fonte; fine = esercizio giocabile.
    expect(doc).toMatch(/giocabile/i);
    // Presenza della tabella di registrazione: la riga iniziale «da misurare» dovuta
    // all'operatore (nessun tempo inventato).
    expect(doc).toMatch(/da misurare/i);
    expect(doc).toMatch(/operatore/i);
  });

  it('AC3 — le lezioni reali VALIDANO e il conteggio coincide con la sentinella', () => {
    const files = realLessonFiles();
    // Guardia anti-vacuità: c'è davvero del contenuto da validare.
    expect(files.length).toBeGreaterThanOrEqual(1);
    // Le lezioni esistenti passano il cancello di Epic 2: l'unica prova MECCANICA sul
    // contenuto reale (le regole cross-file scattano validandole insieme).
    expect(validateLessons(files)).toEqual([]);

    // Contatore onesto: la sentinella `<!-- authored-lessons: N -->` del doc deve
    // coincidere col numero reale di file. Se non coincide, il messaggio dice come
    // riallineare — il tracker DoD non mente in silenzio.
    const doc = readFileSync(docPath, 'utf-8');
    const sentinel = /<!--\s*authored-lessons:\s*(\d+)\s*-->/.exec(doc);
    expect(sentinel, 'sentinella <!-- authored-lessons: N --> attesa in docs/authoring-cost.md').not.toBeNull();
    const declared = Number(sentinel![1]);
    expect(
      declared,
      `la sentinella authored-lessons (${declared}) deve coincidere col numero reale di lezioni ` +
        `(${files.length}) sotto content/lessons/ — aggiorna docs/authoring-cost.md`,
    ).toBe(files.length);
  });

  it('AC3 — dichiara il traguardo DoD (almeno cinque) e il verdetto DERIVA dal conteggio', () => {
    const files = realLessonFiles();
    const doc = readFileSync(docPath, 'utf-8');
    // Il traguardo: almeno cinque lezioni. (`/almeno cinque/` è l'ancora specifica;
    // NON usiamo `/\b5\b/`, soddisfatta anche da «passo 5» o dalla riga «5 —» della
    // tabella NFR9, che non fissa il cinque della DoD.)
    expect(doc).toMatch(/almeno\s+cinque/i);
    // Definition of Done nominata.
    expect(doc).toMatch(/Definition of Done|DoD/);
    // Il verdetto di stato è ACCOPPIATO al conteggio reale tramite la sentinella
    // machine-readable `<!-- dod-status: below-target|met -->`, DISTINTA dalla prosa
    // umana (che nomina entrambi gli stati per spiegare il meccanismo, quindi non può
    // essere l'ancora del test: lo sarebbe in modo ambiguo). La sentinella non può
    // restare stantia quando l'operatore autora fino a cinque lezioni.
    const belowTarget = /<!--\s*dod-status:\s*below-target\s*-->/;
    const met = /<!--\s*dod-status:\s*met\s*-->/;
    if (files.length >= 5) {
      expect(doc, 'DoD raggiunta: la sentinella dod-status deve valere «met»').toMatch(met);
      expect(doc, 'DoD raggiunta: la sentinella «below-target» va portata a «met»').not.toMatch(
        belowTarget,
      );
    } else {
      expect(
        doc,
        'DoD non ancora raggiunta: la sentinella dod-status deve valere «below-target»',
      ).toMatch(belowTarget);
      expect(doc, 'DoD non ancora raggiunta: la sentinella «met» non deve comparire').not.toMatch(
        met,
      );
    }
  });
});
