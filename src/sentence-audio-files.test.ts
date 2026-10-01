import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sentenceAudioFile } from './domain/sentence-audio';

// Igiene di livello repo: ogni frase di content/lessons/ ha il suo audio in
// public/audio/, e non c'è audio di frasi che non esistono più. Aggiungere o
// cambiare una frase senza rigenerare l'audio (`npm run generate-audio`, con
// VOICEVOX aperto) rende il test rosso.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const lessonsDir = resolve(repoRoot, 'content', 'lessons');
const audioDir = resolve(repoRoot, 'public', 'audio');

function sentences(): Set<string> {
  const out = new Set<string>();
  for (const name of readdirSync(lessonsDir).filter((n) => n.endsWith('.json'))) {
    const lesson = JSON.parse(readFileSync(resolve(lessonsDir, name), 'utf-8')) as {
      exercises: { sentence: { kanji: string } }[];
    };
    for (const e of lesson.exercises) out.add(e.sentence.kanji);
  }
  return out;
}

describe('audio delle frasi (public/audio/)', () => {
  it('ogni frase ha il suo audio', () => {
    const missing = [...sentences()].filter((s) => !existsSync(resolve(audioDir, sentenceAudioFile(s))));
    expect(missing, 'frasi senza audio: lancia `npm run generate-audio`').toEqual([]);
  });

  it('nessun audio di frasi che non esistono più', () => {
    const expected = new Set([...sentences()].map(sentenceAudioFile));
    const orphans = readdirSync(audioDir).filter((f) => f.endsWith('.mp3') && !expected.has(f));
    expect(orphans, 'audio orfani: lancia `npm run generate-audio`').toEqual([]);
  });
});
