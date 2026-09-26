import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Igiene di livello repo per FR11.7 — il confine con la fonte (storia 6.1).
// Il materiale della fonte (transcript, sottotitoli, trascrizioni) è opera
// protetta: un commit distratto lo esporrebbe. L'esclusione vive in .gitignore
// ma senza guardia una modifica futura la toglierebbe in SILENZIO. Come
// src/deploy-config.test.ts blocca la config che il routing reale è di Vercel,
// qui blocchiamo la config che la tracciabilità reale è di git: una regressione
// di .gitignore è CI ROSSA, non una fonte esposta in produzione.
// Precedente: src/boundaries.test.ts, src/deploy-config.test.ts — config di
// livello repo eseguita da src/.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const gitignore = readFileSync(resolve(repoRoot, '.gitignore'), 'utf-8');

/**
 * Ritorna true se git considera `path` ignorato. `check-ignore` esce 0 quando
 * il percorso è ignorato e 1 (throw di execFileSync) quando è tracciabile — il
 * comportamento REALE che questa suite blocca, non una stringa di config. Il
 * percorso non deve esistere sul disco: check-ignore ragiona sui pattern, non
 * sul filesystem, così il test non versiona alcun transcript.
 */
function isIgnored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--', path], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
    return true;
  } catch (error) {
    // check-ignore esce 1 SOLO quando git ha risposto "non ignorato": è l'unico
    // throw che rappresenta un percorso tracciabile. Ogni altro status (git
    // assente, fuori da un work-tree, exit 128) è un errore reale che non deve
    // travestirsi da "non ignorato" e far passare la guardia per la ragione
    // sbagliata: lo rilanciamo così il test fallisce in modo leggibile.
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: number }).status === 1
    ) {
      return false; // git ha risposto: percorso NON ignorato
    }
    throw error; // git assente, fuori da un work-tree, o errore reale
  }
}

describe('FR11.7 — confine con la fonte (.gitignore)', () => {
  it('esclude esplicitamente i pattern di transcript, sottotitoli e trascrizioni', () => {
    // I pattern esistenti non devono regredire: preservarli è l'invariante.
    // Ancoriamo a RIGA attiva (trimmata) e non a sottostringa: un pattern
    // commentato (`# *.vtt`) o presente solo come pezzo di un altro
    // (`transcripts/` dentro `.transcripts/`) non deve passare per errore.
    const lines = gitignore.split(/\r?\n/).map((l) => l.trim());
    for (const pattern of [
      '.transcripts/',
      'transcripts/',
      '*.transcript',
      '*.transcript.txt',
      '*.vtt',
      '*.srt',
      '.authoring/',
    ]) {
      expect(
        lines,
        `atteso il pattern ${pattern} come riga attiva (non commento) in .gitignore`,
      ).toContain(pattern);
    }
  });

  it('nomina le tre categorie e ne dà la ragione nel commento', () => {
    // Il commento deve dire COSA si esclude (le tre categorie) e PERCHÉ (fonte
    // protetta; si estraggono fatti; la parafrasi resta derivata), così chi
    // legge il file capisce il confine senza aprire il doc.
    expect(gitignore).toMatch(/transcript/i);
    expect(gitignore).toMatch(/sottotitoli/i);
    expect(gitignore).toMatch(/trascrizioni/i);
    // "opera protetta" può andare a capo col prefisso di commento: basta la
    // parola-ancora, la ragione è "fonte/opera protetta".
    expect(gitignore).toMatch(/protett/i);
    expect(gitignore).toMatch(/fatt/i); // "fatti" / "FATTI"
    expect(gitignore).toMatch(/derivata/i);
    // Il rinvio obsoleto (storie 2.1 e 2.9 — 2.9 non esiste) è corretto in
    // PRD §2 · storia 6.1. La negativa mira alla COPPIA specifica, non a un
    // "2.9" incidentale futuro (una versione, una percentuale).
    expect(gitignore).toMatch(/storia 6\.1/i);
    expect(gitignore).not.toMatch(/2\.1 e 2\.9/);
  });
});

describe('FR11.7 — tracciabilità reale (git check-ignore)', () => {
  // Righe della I/O Matrix: transcript/sottotitoli/trascrizioni ignorati; il
  // contenuto di lezione (controllo) tracciato.
  it.each([
    ['.authoring/cure-dolly-12.txt', 'transcript in cartella di lavoro'],
    ['lezione.vtt', 'sottotitoli WebVTT'],
    ['lezione.srt', 'sottotitoli SubRip'],
    ['x.transcript', 'transcript per estensione'],
    ['x.transcript.txt', 'transcript .transcript.txt'],
    ['transcripts/x.txt', 'transcript in transcripts/'],
    ['.transcripts/deep/x.txt', 'transcript in .transcripts/ (annidato)'],
  ])('ignora %s (%s)', (path) => {
    expect(isIgnored(path), `atteso ${path} ignorato`).toBe(true);
  });

  it('NON ignora il contenuto di lezione (controllo tracciato)', () => {
    // Guardia anti-vacuità: se i pattern fossero troppo larghi (es. ignorare
    // tutto sotto content/), il test sopra passerebbe ma esporrebbe niente. Il
    // file di controllo prova che il confine è chirurgico, non un blocco totale.
    const control = 'content/lessons/01-la-particella-wo.json';
    // Se il campione sparisse (rinominato/rimosso), check-ignore direbbe
    // comunque "non ignorato" (exit 1) e l'asserzione passerebbe verificando il
    // nulla: pretendiamo prima che il file esista, così la guardia non erode.
    expect(
      existsSync(resolve(repoRoot, control)),
      `il file di controllo ${control} deve esistere sul disco`,
    ).toBe(true);
    expect(
      isIgnored(control),
      'atteso il contenuto di lezione tracciato (non ignorato)',
    ).toBe(false);
  });
});

describe('FR11.7 — documentazione della pipeline', () => {
  const docPath = resolve(repoRoot, 'docs', 'authoring-pipeline.md');

  it('docs/authoring-pipeline.md esiste', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it('dichiara i tre principi e l\'esempio concreto "motori"/treno', () => {
    const doc = readFileSync(docPath, 'utf-8');
    // Principio 1: fatti, mai formulazioni.
    expect(doc).toMatch(/fatt/i);
    expect(doc).toMatch(/formulazion/i);
    // Principio 2: parafrasi con i sinonimi = opera derivata.
    expect(doc).toMatch(/sinonim/i);
    expect(doc).toMatch(/derivata/i);
    // Principio 3: le metafore didattiche non si riusano.
    expect(doc).toMatch(/metafor/i);
    // Esempio concreto: il caso "motori"/treno del progetto, con la correzione
    // in terminologia standard e il rinvio verificabile alla storia.
    expect(doc).toMatch(/motori/i);
    expect(doc).toMatch(/treno/i);
    expect(doc).toMatch(/verbo/i);
    expect(doc).toMatch(/copula/i);
    expect(doc).toMatch(/aggettivo in い/);
    expect(doc).toMatch(/c618164/);
  });
});
