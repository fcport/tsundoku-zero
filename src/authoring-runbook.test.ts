import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateLessons, type LessonFile } from './domain/content-validation';

// Igiene di livello repo per la storia 6.2 — il flusso di autorazione documentato
// e ripetibile. Come src/source-boundary.test.ts blocca la config che la fonte
// resti fuori dal repo, qui blocchiamo la COPPIA doc↔esempio del runbook: (a) il
// doc esiste e dichiara meccanicamente le sue ancore obbligatorie, così una
// revisione futura non può rimuovere in silenzio una dichiarazione (LLM in
// autorazione, revisione umana prima del commit, il cancello di Epic 2, «non
// tocca il codice», il rinvio ad authoring-pipeline.md, l'indicizzazione per
// concetto); (b) l'esempio racchiuso fra le sentinelle è ESTRATTO e passato a
// `validateLessons` INSIEME al contenuto reale di content/lessons/ — la STESSA
// porta di Epic 2 — provando che una lezione prodotta seguendo il runbook la
// attraversa COME sarebbe aggiunta (unicità cross-file inclusa), senza interventi
// manuali sullo schema (AC3). Se il template mostrato smettesse di conformarsi,
// il test è rosso.
// Precedente: src/source-boundary.test.ts (coppia doc + test di igiene, storia 6.1).

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const docPath = resolve(repoRoot, 'docs', 'authoring-runbook.md');
const lessonsDir = resolve(repoRoot, 'content', 'lessons');

/**
 * Estrae il blocco JSON dell'esempio racchiuso fra le sentinelle STABILI
 * `<!-- BEGIN worked-example -->` e `<!-- END worked-example -->`. Usiamo
 * sentinelle esplicite, non euristiche di markdown (il «primo blocco ```json»
 * cambierebbe se il doc guadagnasse un altro snippet prima): l'estrazione deve
 * mirare all'esempio inteso, non al primo che capita.
 */
function extractWorkedExample(doc: string): string {
  const begin = '<!-- BEGIN worked-example -->';
  const end = '<!-- END worked-example -->';
  const from = doc.indexOf(begin);
  const to = doc.indexOf(end);
  expect(from, 'sentinella BEGIN worked-example attesa nel runbook').toBeGreaterThanOrEqual(0);
  expect(to, 'sentinella END worked-example attesa nel runbook').toBeGreaterThan(from);
  const between = doc.slice(from + begin.length, to);
  // Il blocco è racchiuso in un fence ```json … ```: prendiamo il corpo del fence.
  const fence = /```json\s*\n([\s\S]*?)\n```/.exec(between);
  expect(fence, 'atteso un fence ```json fra le sentinelle worked-example').not.toBeNull();
  return fence![1];
}

/**
 * Legge il contenuto REALE di `content/lessons/` come lo vedrebbe il cancello:
 * ogni `*.json` (case-insensitive, ricorsivo) → `LessonFile`. Il `path` è relativo
 * alla radice del repo (come lo emette `scripts/validate-content.ts`), così un
 * eventuale issue cross-file nomina i file in modo leggibile. È il vero contesto
 * in cui l'esempio del runbook sarebbe aggiunto: solo validandolo INSIEME a questi
 * scattano le regole di unicità (order/lessonId/identità).
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

describe('storia 6.2 — runbook di autorazione (documentazione)', () => {
  it('docs/authoring-runbook.md esiste', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it('dichiara le ancore obbligatorie del flusso', () => {
    const doc = readFileSync(docPath, 'utf-8');
    // Autorazione assistita da un LLM, SOLO in autorazione (mai a runtime) — AC2.
    expect(doc).toMatch(/LLM/);
    expect(doc).toMatch(/autorazione/i);
    // L'LLM è confinato all'autorazione e NON compare a runtime: invariante
    // portante (l'app serve contenuto statico, non genera nulla in tempo reale).
    expect(doc).toMatch(/mai a runtime/i);
    // Revisione umana OBBLIGATORIA prima del commit: nessun esercizio raggiunge il
    // repository senza essere stato riletto — AC2, l'invariante non aggirabile.
    expect(doc).toMatch(/revisione umana/i);
    expect(doc).toMatch(/prima del commit/i);
    expect(doc).toMatch(/nessun esercizio/i);
    // Il cancello di Epic 2, imposto in CI — AC3.
    expect(doc).toMatch(/npm run validate-content/);
    // Aggiungere una lezione NON tocca il codice — AC3.
    expect(doc).toMatch(/non tocca il codice/i);
    // Rinvio al confine fatto/formulazione (storia 6.1).
    expect(doc).toMatch(/authoring-pipeline\.md/);
    // Indicizzazione per concetto grammaticale, mai per numero/titolo della fonte.
    expect(doc).toMatch(/per concetto/i);
    // La difesa anti-contaminazione oggi è umana; il controllo meccanico è 6.3.
    expect(doc).toMatch(/6\.3/);
  });

  it('cita i tre tipi del registro chiuso e le regole oltre-schema', () => {
    const doc = readFileSync(docPath, 'utf-8');
    // I tre tipi del registro chiuso (AC1).
    expect(doc).toMatch(/single-select/);
    expect(doc).toMatch(/select-span/);
    expect(doc).toMatch(/assemble/);
    // Le regole oltre-schema che il cancello impone (AC1).
    expect(doc).toMatch(/kana/i);
    expect(doc).toMatch(/grammarPoint/);
    expect(doc).toMatch(/order/);
  });

  it('l\'esempio del runbook, DA SOLO, non ha issue di forma (validateLessons → [])', () => {
    // Sanity check di FORMA: l'esempio estratto è JSON valido e, in isolamento,
    // non produce issue di schema/kana/grammarPoint. NON è la prova di AC3 (le
    // regole cross-file — unicità di order/lessonId/identità — NON scattano su un
    // solo file): quella è il test combinato qui sotto. Etichetta onesta: questo
    // verifica la forma, non «il cancello di Epic 2».
    const doc = readFileSync(docPath, 'utf-8');
    const source = extractWorkedExample(doc);
    expect(() => JSON.parse(source) as unknown).not.toThrow();
    const files: LessonFile[] = [{ path: 'docs/authoring-runbook.md#worked-example', source }];
    const issues = validateLessons(files);
    expect(issues).toEqual([]);
  });

  it('l\'esempio passa il cancello di Epic 2 aggiunto al contenuto REALE (unicità cross-file inclusa)', () => {
    // La vera prova di AC3: l'esempio è validato COME sarebbe effettivamente
    // aggiunto — insieme a tutte le lezioni reali di content/lessons/. Così
    // scattano le regole cross-file (order/lessonId/identità unici): se il
    // worked-example collidesse con una lezione esistente (es. `order` duplicato),
    // il cancello reale fallirebbe e questo test sarebbe rosso, smascherando una
    // «prova» isolata troppo indulgente.
    const doc = readFileSync(docPath, 'utf-8');
    const source = extractWorkedExample(doc);
    const files: LessonFile[] = [
      ...realLessonFiles(),
      { path: 'docs/authoring-runbook.md#worked-example', source },
    ];
    const issues = validateLessons(files);
    expect(issues).toEqual([]);
  });
});
