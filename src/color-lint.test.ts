import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ESLint, type Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// Sonda della regola colore (AC4), sul modello di src/boundaries.test.ts.
// Invece di committare componenti rotti sotto src/ (che terrebbero la CI rossa
// per sempre), lintiamo frammenti VIRTUALI a un filePath in src/ui/ con l'API
// programmatica di ESLint. Ogni riga corrisponde a una riga della I/O Matrix.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd: repoRoot });
  // Riscaldamento: la prima lintText paga a freddo il caricamento della flat
  // config (vari secondi su un runner CI freddo). Ammortizziamo qui.
  await eslint.lintText('export const __warmup__ = 0;\n', {
    filePath: resolve(repoRoot, 'src/ui/__warmup__.ts'),
    warnIgnored: false,
  });
});

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

/** Asserisce che `no-restricted-syntax` sia segnalato a severità ERROR (2). */
function expectColorError(messages: Linter.LintMessage[]): void {
  const asError = messages.some(
    (m) => m.ruleId === 'no-restricted-syntax' && m.severity === 2,
  );
  expect(
    asError,
    `atteso no-restricted-syntax a severità ERROR (2); messaggi: ${JSON.stringify(
      messages.map((m) => ({ ruleId: m.ruleId, severity: m.severity })),
    )}`,
  ).toBe(true);
}

function expectNoColorError(messages: Linter.LintMessage[]): void {
  const colorMsgs = messages.filter((m) => m.ruleId === 'no-restricted-syntax');
  expect(
    colorMsgs,
    `atteso 0 errori della regola colore; trovati: ${JSON.stringify(colorMsgs)}`,
  ).toEqual([]);
}

describe('regola colore ERROR sui componenti (AC4, UX-DR1)', () => {
  it('hex in className (arbitrary value Tailwind) ⇒ ERROR in src/ui', async () => {
    const messages = await lintFragment(
      'export const C = () => <div className="bg-[#ff0000]" />;\n',
      'src/ui/__probe__.tsx',
    );
    expectColorError(messages);
  });

  it('hex in style inline ⇒ ERROR in src/ui', async () => {
    const messages = await lintFragment(
      "export const C = () => <div style={{ color: '#fff' }} />;\n",
      'src/ui/__probe__.tsx',
    );
    expectColorError(messages);
  });

  it('rgb() in style inline ⇒ ERROR in src/features', async () => {
    const messages = await lintFragment(
      "export const C = () => <div style={{ color: 'rgb(255, 0, 0)' }} />;\n",
      'src/features/__probe__.tsx',
    );
    expectColorError(messages);
  });

  it('hex in template literal ⇒ ERROR in src/ui', async () => {
    const messages = await lintFragment(
      'const shade = "500";\nexport const cls = `bg-[#00ff00] shade-${shade}`;\n',
      'src/ui/__probe__.ts',
    );
    expectColorError(messages);
  });

  it('hsl() in un literal ⇒ ERROR in src/ui', async () => {
    const messages = await lintFragment(
      "export const c = 'hsl(210, 50%, 30%)';\n",
      'src/ui/__probe__.ts',
    );
    expectColorError(messages);
  });

  it('componente che usa un TOKEN ⇒ nessun errore colore', async () => {
    const messages = await lintFragment(
      'export const C = () => <div className="bg-surface-base text-ink-primary" />;\n',
      'src/ui/__probe__.tsx',
    );
    expectNoColorError(messages);
  });
});

describe('ambito della regola: solo i componenti', () => {
  it('lo script di contrasto (fuori src/ui|features) può contenere hex', async () => {
    // scripts/** non è né ui né features: un hex qui è legittimo (i token li
    // legge da theme.css, ma la formula/esempi possono citarli).
    const messages = await lintFragment(
      "export const example = '#1F4A7A';\n",
      'scripts/__probe__.mjs',
    );
    expectNoColorError(messages);
  });

  it('un livello non-componente (domain) non è vincolato dalla regola colore', async () => {
    const messages = await lintFragment(
      "export const brandHex = '#1C1A17';\n",
      'src/domain/__probe__.ts',
    );
    expectNoColorError(messages);
  });
});
