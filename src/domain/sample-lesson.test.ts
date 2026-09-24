import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectIssues } from '../../scripts/validate-content.ts';
import { sampleLesson } from './sample-lesson';

// Story 2.7 — la lezione campione, che è anche una FIXTURE.
//
// Ancora tre cose sul CONTENUTO REALE (mai su fixture inline): (AC3) il CANCELLO
// di 2.6 resta verde sulla cartella reale; (AC1) i tre `kind` sono presenti e i
// tre casi difficili sono incorporati DI PROPOSITO; (AC4) `sampleLesson` è il
// file spedito, caricato via l'accessor di dominio; e il ripiego bilingue di 2.5
// ha un caso reale (un `it` presente, uno assente).
//
// `repoRoot` si ricava da `import.meta.url` come in `validate-content-script.test.ts`.
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const lessonsDir = resolve(repoRoot, 'content', 'lessons');

/** Rileva un ideogramma Han (kanji), come il controllo `kana` del cancello di 2.6. */
const HAN = /\p{Script=Han}/u;

describe('lezione campione — il CANCELLO reale resta verde (AC3)', () => {
  it('collectIssues(content/lessons) ⇒ [] sulla cartella REALE', async () => {
    // Stessa composizione glob→read→validate della CLI (`npm run validate-content`),
    // sulla dir reale che ora contiene 01-*.json. Nessuna reimplementazione: si
    // CONSUMA il cancello di 2.6.
    expect(await collectIssues(lessonsDir)).toEqual([]);
  });
});

describe('lezione campione — fixture caricata dal file reale (AC4)', () => {
  it('sampleLesson carica: order 1 e ≥3 esercizi', () => {
    expect(sampleLesson.order).toBe(1);
    expect(sampleLesson.exercises.length).toBeGreaterThanOrEqual(3);
  });
});

describe('lezione campione — i tre kind del registro chiuso (AC1)', () => {
  it('contiene ≥1 esercizio per ciascun kind', () => {
    const kinds = new Set(sampleLesson.exercises.map((exercise) => exercise.kind));
    expect(kinds.has('single-select')).toBe(true);
    expect(kinds.has('select-span')).toBe(true);
    expect(kinds.has('assemble')).toBe(true);
  });
});

describe('lezione campione — i tre casi difficili ancorati (AC1)', () => {
  it('FRASE LUNGA: la frase più lunga ha ≥24 caratteri kanji (input di stress per sentence-hero)', () => {
    const longest = Math.max(...sampleLesson.exercises.map((e) => [...e.sentence.kanji].length));
    expect(longest).toBeGreaterThanOrEqual(24);
  });

  it('JUKUJIKUN 今日→きょう: esiste un single-select con 今日 nella frase e answer きょう', () => {
    const hit = sampleLesson.exercises.some(
      (e) => e.kind === 'single-select' && e.sentence.kanji.includes('今日') && e.answer === 'きょう',
    );
    expect(hit).toBe(true);
  });

  it('JUKUJIKUN 果物: presente in una frase (letto くだもの come unità, segmento marcato da を)', () => {
    const hit = sampleLesson.exercises.some((e) => e.sentence.kanji.includes('果物'));
    expect(hit).toBe(true);
  });

  it('OKURIGANA: 新しい e 読みます compaiono nella frase LUNGA (dell’assemble)', () => {
    const long = sampleLesson.exercises.find((e) => [...e.sentence.kanji].length >= 24);
    expect(long).toBeDefined();
    expect(long?.sentence.kanji.includes('新しい')).toBe(true);
    expect(long?.sentence.kanji.includes('読みます')).toBe(true);
  });
});

describe('lezione campione — invariante delle tessere assemble', () => {
  it('per ogni assemble, answer.join("") ricostruisce esattamente sentence.kanji', () => {
    // Le tessere di un assemble SONO la frase spezzata: concatenandole in ordine
    // si deve riottenere `sentence.kanji` (punteggiatura inclusa). Guardia contro
    // la deriva futura (una tessera che perde/aggiunge un carattere).
    const assembles = sampleLesson.exercises.filter((e) => e.kind === 'assemble');
    expect(assembles.length).toBeGreaterThanOrEqual(1);
    for (const exercise of assembles) {
      expect(exercise.answer.join('')).toBe(exercise.sentence.kanji);
    }
  });
});

describe('lezione campione — ogni kana è sola lettura (condizione del cancello di 2.6)', () => {
  it('nessun kana contiene un ideogramma Han', () => {
    for (const exercise of sampleLesson.exercises) {
      expect(HAN.test(exercise.sentence.kana)).toBe(false);
    }
  });
});

describe('lezione campione — ripiego bilingue di 2.5 esercitato dal contenuto reale', () => {
  it('esiste ≥1 esercizio con explanation.it PRESENTE e ≥1 con it ASSENTE', () => {
    const withIt = sampleLesson.exercises.filter((e) => e.explanation.it !== undefined);
    const withoutIt = sampleLesson.exercises.filter((e) => e.explanation.it === undefined);
    expect(withIt.length).toBeGreaterThanOrEqual(1);
    expect(withoutIt.length).toBeGreaterThanOrEqual(1);
  });
});
