import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ESLint, type Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// Sonde di confine: invece di committare file rotti sotto src/ (che
// terrebbero la CI rossa per sempre), lintiamo frammenti VIRTUALI con l'API
// programmatica di ESLint. La regola è così provata a ogni `npm test` senza
// sporcare l'albero. Ogni riga corrisponde a una riga della I/O Matrix.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd: repoRoot });
  // Riscaldamento: la PRIMA lintText paga a freddo il caricamento della flat
  // config e il bootstrap del resolver TypeScript (vari secondi su un runner CI
  // freddo). Ammortizziamo qui, dentro l'hook, così nessuna singola sonda corra
  // contro il timeout per-test di vitest e vada in rosso per un timeout invece
  // che per una violazione reale (hookTimeout alzato in vitest.config.ts).
  await eslint.lintText('export const __warmup__ = 0;\n', {
    filePath: resolve(repoRoot, 'src/domain/__warmup__.ts'),
    warnIgnored: false,
  });
});

/** Lintà `code` come se fosse `filePath` e ritorna i messaggi grezzi. */
async function lintFragment(
  code: string,
  filePath: string,
): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, {
    filePath: resolve(repoRoot, filePath),
    warnIgnored: false,
  });
  return result?.messages ?? [];
}

/**
 * Asserisce che `ruleId` sia segnalato a severità ERROR (2), non warn (1).
 * AC2: una violazione di confine deve tenere la CI ROSSA. Se un domani una
 * regola scivolasse da 'error' a 'warn', il ruleId resterebbe nei messaggi ma
 * la severità no: questa asserzione fallirebbe, come deve.
 */
function expectRuleError(messages: Linter.LintMessage[], ruleId: string): void {
  const asError = messages.some((m) => m.ruleId === ruleId && m.severity === 2);
  expect(
    asError,
    `atteso ${ruleId} a severità ERROR (2); messaggi: ${JSON.stringify(
      messages.map((m) => ({ ruleId: m.ruleId, severity: m.severity })),
    )}`,
  ).toBe(true);
}

describe('confini AD-1 imposti da ESLint', () => {
  it('domain→react ⇒ boundaries/external (ERROR)', async () => {
    const messages = await lintFragment("import 'react';\n", 'src/domain/__probe__.ts');
    expectRuleError(messages, 'boundaries/external');
  });

  it('domain→supabase ⇒ boundaries/external (ERROR)', async () => {
    const messages = await lintFragment(
      "import '@supabase/supabase-js';\n",
      'src/domain/__probe__.ts',
    );
    expectRuleError(messages, 'boundaries/external');
  });

  it('ui→react-i18next ⇒ boundaries/external (ERROR) [funnel i18n AD-14]', async () => {
    // Solo src/i18n/ importa i pacchetti i18n; ui/features/data/app passano dal
    // re-export di ../i18n. Un import diretto da un livello consumatore è una
    // violazione meccanica (CI rossa), non una convenzione.
    const messages = await lintFragment(
      "import { useTranslation } from 'react-i18next';\nexport const x = useTranslation;\n",
      'src/ui/__probe__.tsx',
    );
    expectRuleError(messages, 'boundaries/external');
  });

  it('domain→fetch/storage ⇒ no-restricted-globals (ERROR)', async () => {
    const messages = await lintFragment(
      'export const ping = () => fetch("https://example.test");\n' +
        'export const cached = () => localStorage.getItem("k");\n',
      'src/domain/__probe__.ts',
    );
    expectRuleError(messages, 'no-restricted-globals');
  });

  it('features→data ⇒ boundaries/element-types (ERROR)', async () => {
    // Importa un modulo `data` REALE: il resolver deve poterlo classificare.
    const messages = await lintFragment(
      "import { dataLayerLabel } from '../data/index';\nexport const x = dataLayerLabel;\n",
      'src/features/__probe__.ts',
    );
    expectRuleError(messages, 'boundaries/element-types');
  });

  it('scaffold pulito ⇒ 0 errori sull’albero reale', async () => {
    const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);

    // Guardia anti-vacuità: se il glob non lintasse nulla (glob rotto,
    // cwd sbagliata), un albero "pulito" passerebbe senza aver verificato
    // niente. Pretendiamo che i file reali dei sei livelli siano stati visti.
    const linted = results.map((r) => r.filePath.replace(/\\/g, '/'));
    for (const expected of [
      'src/domain/scaffold.ts',
      'src/data/index.ts',
      'src/ui/App.tsx',
      'src/features/index.ts',
      'src/i18n/index.ts',
      'src/app/main.tsx',
    ]) {
      expect(
        linted.some((p) => p.endsWith(expected)),
        `atteso che ${expected} fosse lintato; lintati: ${linted.join(', ')}`,
      ).toBe(true);
    }

    const errors = results.flatMap((r) =>
      r.messages
        .filter((m) => m.severity === 2)
        .map((m) => `${r.filePath}: ${m.ruleId} ${m.message}`),
    );
    expect(errors).toEqual([]);
  });
});
