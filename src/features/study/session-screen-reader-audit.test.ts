import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// AC1/AC2/AC3 (7.6) — l'audit screen reader della sessione è REGISTRATO come record
// versionato, non lasciato implicito. Stesso precedente di `session-keyboard-contract.test.ts`
// (AD-15) e di `i18n.test` per `docs/i18n-boundary.md` (AD-14): il documento è la fonte,
// un test ne verifica ESISTENZA e PUNTI DICHIARATI. Testa l'ARTEFATTO, non l'a11y a
// runtime dello screen reader — che resta l'unica affermazione non coperta da automazione
// (AC3), misurata dall'operatore in «Esito misurato». Ambiente `node` (vitest.config.ts):
// legge il file dal repoRoot.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const doc = readFileSync(
  resolve(repoRoot, 'docs/session-screen-reader-audit.md'),
  'utf8',
);

describe('7.6 — il documento esiste e dichiara scopo e ambito', () => {
  it('si dichiara audit screen reader della sessione (storia 7.6)', () => {
    expect(doc).toMatch(/screen reader/i);
    expect(doc).toMatch(/7\.6/);
    expect(doc).toMatch(/audit/i);
  });
});

describe('7.6 — il documento inventaria la copertura automatica ESISTENTE (AC1)', () => {
  it('cita i test a11y esistenti con anchor di file', () => {
    expect(doc).toMatch(/JapaneseText\.test\.tsx/);
    expect(doc).toMatch(/SessionScreen\.test\.tsx/);
    expect(doc).toMatch(/SessionScreen\.keyboard\.test\.tsx/);
    expect(doc).toMatch(/session-keyboard-contract\.test\.ts/);
  });

  it('dichiara ESPLICITAMENTE che l esperienza screen reader e l UNICA affermazione non coperta da test automatico (AC3)', () => {
    // L'affermazione che protegge AC3: l'agente non maschera l'a11y a runtime come «coperta».
    expect(doc).toMatch(/unica affermazione/i);
    expect(doc).toMatch(/non coperta da alcun test automatico/i);
  });
});

describe('7.6 — il documento ragiona il comportamento atteso dal codice (AC2)', () => {
  it('AC1: la frase e letta UNA volta via <rt aria-hidden> ancorato a JapaneseText.tsx', () => {
    expect(doc).toMatch(/JapaneseText\.tsx/);
    expect(doc).toMatch(/aria-hidden="true"/);
    expect(doc).toMatch(/lang="ja"/);
    expect(doc).toMatch(/una volta/i);
  });

  it('AC2: ordine consegna -> opzioni -> esito -> spiegazione ancorato a ExerciseCard.tsx', () => {
    expect(doc).toMatch(/ExerciseCard\.tsx/);
    expect(doc).toMatch(/consegna/i);
    expect(doc).toMatch(/opzioni/i);
    expect(doc).toMatch(/esito/i);
    expect(doc).toMatch(/spiegazione/i);
    // L'ordine di lettura compare come SEQUENZA CONTIGUA ORDINATA: un documento che
    // dichiarasse l'ordine SBAGLIATO (parole sparse ma non nell'ordine giusto)
    // fallirebbe qui. Guarda l'ordine degli elementi che AC2 nomina.
    expect(doc).toMatch(/consegna → opzioni → esito → spiegazione/);
  });

  it('AC3: avanzamento dall UNICA live region aria-live="polite" ancorato a SessionScreen.tsx', () => {
    expect(doc).toMatch(/SessionScreen\.tsx/);
    expect(doc).toMatch(/live region/i);
    expect(doc).toMatch(/aria-live="polite"/);
    // UNA sola live region: assertita con PROSSIMITÀ (le due parole adiacenti), non
    // un «una sola» vagante che potrebbe riferirsi ad altro.
    expect(doc).toMatch(/una sola live region/i);
  });
});

describe('7.6 — il documento espone la superficie del record (procedura + esito + difetti)', () => {
  it('da una procedura manuale con NVDA/VoiceOver e voce giapponese', () => {
    expect(doc).toMatch(/NVDA/);
    expect(doc).toMatch(/VoiceOver/);
    expect(doc).toMatch(/giappones/i);
    expect(doc).toMatch(/npm run dev/);
  });

  it('ha una sezione «Esito misurato» strutturata per AC, marcata da eseguire', () => {
    expect(doc).toMatch(/Esito misurato/i);
    // La superficie strutturata del record: righe PER-AC, non solo un «da eseguire»
    // vagante. Un documento sventrato senza i marcatori per-AC fallirebbe.
    expect(doc).toMatch(/\*\*AC1\*\*/);
    expect(doc).toMatch(/\*\*AC2\*\*/);
    expect(doc).toMatch(/\*\*AC3\*\*/);
    // Marcata esplicitamente «da eseguire»: mai risultati fabbricati. (Guardia sullo
    // stato pendente agent-side; l'operatore la sostituirà con PASS/FAIL al run.)
    expect(doc).toMatch(/da eseguire/i);
  });

  it('ha un registro «Difetti» da compilare dall operatore', () => {
    expect(doc).toMatch(/Difetti/i);
    expect(doc).toMatch(/da compilare/i);
  });
});
