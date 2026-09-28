import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Igiene di livello repo: docs/content-inventory.md è il registro di quanti esercizi
// ha ogni lezione. Come la sentinella `authored-lessons` di docs/authoring-cost.md,
// è un tracker che non deve poter mentire in silenzio: qui si confronta ogni riga
// della tabella con il contenuto REALE di content/lessons/. Aggiungere una lezione o
// un esercizio senza aggiornare il registro rende il test rosso.
//
// La colonna «Transcript» NON è verificata: i transcript non sono nel repository
// (src/source-boundary.test.ts), quindi non c'è nulla con cui confrontarla.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const docPath = resolve(repoRoot, 'docs', 'content-inventory.md');
const lessonsDir = resolve(repoRoot, 'content', 'lessons');

interface Counts {
  readonly order: number;
  readonly singleSelect: number;
  readonly selectSpan: number;
  readonly assemble: number;
  readonly total: number;
}

/** I conteggi reali per file, letti dai JSON di `content/lessons/`. */
function realCounts(): Map<string, Counts> {
  const out = new Map<string, Counts>();
  for (const name of readdirSync(lessonsDir).filter((n) => n.endsWith('.json')).sort()) {
    const lesson = JSON.parse(readFileSync(resolve(lessonsDir, name), 'utf-8')) as {
      order: number;
      exercises: { kind: string }[];
    };
    const of = (kind: string) => lesson.exercises.filter((e) => e.kind === kind).length;
    out.set(name, {
      order: lesson.order,
      singleSelect: of('single-select'),
      selectSpan: of('select-span'),
      assemble: of('assemble'),
      total: lesson.exercises.length,
    });
  }
  return out;
}

/** Le righe della tabella del doc: `| order | \`file.json\` | transcript | n | n | n | n |`. */
function declaredCounts(doc: string): Map<string, Counts> {
  const out = new Map<string, Counts>();
  const row = /^\|\s*(\d+)\s*\|\s*`([^`]+\.json)`\s*\|[^|]*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*$/gm;
  for (const m of doc.matchAll(row)) {
    expect(out.has(m[2]!), `riga duplicata per ${m[2]} in docs/content-inventory.md`).toBe(false);
    out.set(m[2]!, {
      order: Number(m[1]),
      singleSelect: Number(m[3]),
      selectSpan: Number(m[4]),
      assemble: Number(m[5]),
      total: Number(m[6]),
    });
  }
  return out;
}

const rowFor = (file: string, c: Counts) =>
  `| ${c.order} | \`${file}\` | … | ${c.singleSelect} | ${c.selectSpan} | ${c.assemble} | ${c.total} |`;

describe('docs/content-inventory.md — registro degli esercizi per lezione', () => {
  const doc = readFileSync(docPath, 'utf-8');
  const real = realCounts();
  const declared = declaredCounts(doc);

  it('c\'è contenuto reale da contare (guardia anti-vacuità)', () => {
    expect(real.size).toBeGreaterThan(0);
  });

  it('ogni lezione reale ha la sua riga, con i conteggi reali', () => {
    for (const [file, counts] of real) {
      expect(declared.get(file), `riga attesa in docs/content-inventory.md: ${rowFor(file, counts)}`).toEqual(
        counts,
      );
    }
  });

  it('nessuna riga per file che non esistono', () => {
    const stale = [...declared.keys()].filter((file) => !real.has(file));
    expect(stale, 'righe per lezioni inesistenti in docs/content-inventory.md').toEqual([]);
  });

  it('la sentinella del totale coincide con il numero reale di esercizi', () => {
    const total = [...real.values()].reduce((sum, c) => sum + c.total, 0);
    const sentinel = /<!--\s*inventory-total:\s*(\d+)\s*-->/.exec(doc);
    expect(sentinel, 'sentinella <!-- inventory-total: N --> attesa').not.toBeNull();
    expect(Number(sentinel![1]), `il totale reale è ${total}: aggiorna la sentinella e la prosa`).toBe(total);
  });
});
