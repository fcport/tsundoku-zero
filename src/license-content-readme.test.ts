import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Test di igiene di livello repo per la storia 7.3 — le due licenze e il README.
// Precedente durevole: src/deploy-config.test.ts e src/source-boundary.test.ts
// leggono file di RADICE da src/ (resolve(here, '..', <file>)) e bloccano una
// regressione della loro superficie come CI rossa, non come scoperta a valle.
// Qui ancoriamo meccanicamente:
//   (a) i TRE file esistono alla radice e hanno contenuto diverso l'uno
//       dall'altro (due licenze DISTINTE, non un file duplicato);
//   (b) LICENSE è la licenza del CODICE (MIT, titolare, anno, «Software»);
//   (c) LICENSE-CONTENT è la licenza del CONTENUTO (CC BY-SA 4.0, SPDX, URL);
//   (d) il README NOMINA entrambe le licenze e ne dichiara la SEPARAZIONE;
//   (e) il README porta le ancore delle SETTE domande della traccia;
//   (f) la 7a risposta nomina il controllo anti-contaminazione e il suo LIMITE
//       (non è un cancello di CI), così una revisione futura non lo rimuove in
//       silenzio.
// Non tocca src/features, src/app, src/domain: è documentazione + licenze.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const read = (file: string): string =>
  readFileSync(resolve(repoRoot, file), 'utf-8');

describe('storia 7.3 — i tre file di radice esistono e sono distinti', () => {
  it.each(['LICENSE', 'LICENSE-CONTENT', 'README.md'])(
    '%s esiste alla radice',
    (file) => {
      expect(
        existsSync(resolve(repoRoot, file)),
        `atteso ${file} alla radice del repository`,
      ).toBe(true);
    },
  );

  it('LICENSE, LICENSE-CONTENT e README.md hanno contenuto diverso', () => {
    // Due licenze DISTINTE (AC1): non un file copiato tre volte. Se un contenuto
    // combaciasse con un altro, la separazione codice/contenuto sarebbe finta.
    const license = read('LICENSE');
    const content = read('LICENSE-CONTENT');
    const readme = read('README.md');
    expect(license).not.toBe(content);
    expect(license).not.toBe(readme);
    expect(content).not.toBe(readme);
  });
});

describe('storia 7.3 — LICENSE è la licenza del codice (MIT)', () => {
  const license = read('LICENSE');

  it('è MIT, con titolare e anno, e parla del software', () => {
    expect(license).toMatch(/MIT License/);
    expect(license).toMatch(/Federico Casadei/);
    expect(license).toMatch(/2026/);
    expect(license).toMatch(/Software/);
  });
});

describe('storia 7.3 — LICENSE-CONTENT è la licenza del contenuto (CC BY-SA 4.0)', () => {
  const content = read('LICENSE-CONTENT');

  it('si autoidentifica: nome completo, SPDX e URL canonico del legalcode', () => {
    expect(content).toMatch(/Attribution-ShareAlike 4\.0/);
    expect(content).toMatch(/CC-BY-SA-4\.0/);
    expect(content).toMatch(
      /https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/legalcode/,
    );
  });
});

describe('storia 7.3 — il README dichiara la separazione delle due licenze', () => {
  const readme = read('README.md');

  it('nomina LICENSE e LICENSE-CONTENT e dichiara che sono separate', () => {
    // Ancore backtickate al markup reale del README (entrambi i nomi sono fra
    // backtick): il trattino di LICENSE-CONTENT è un confine di parola in regex,
    // quindi /\bLICENSE\b/ combacerebbe ANCHE dentro LICENSE-CONTENT e non
    // discriminerebbe il file di licenza del CODICE. Le backtick lo distinguono.
    expect(readme).toMatch(/`LICENSE`/);
    expect(readme).toMatch(/`LICENSE-CONTENT`/);
    // Parola-radice di «separat» (separate/separata/separazione): il README deve
    // dichiarare che le due licenze sono separate, non solo elencarle.
    expect(readme).toMatch(/separat/i);
  });
});

describe('storia 7.3 — il README risponde alle sette domande della traccia', () => {
  const readme = read('README.md');

  it.each([
    ['cos\'è il progetto', /Japanese grammar/i],
    ['Leitner', /Leitner/],
    ['SM-2', /SM-2/],
    ['FSRS', /FSRS/],
    ['Vite', /Vite/],
    ['Next', /Next/],
    ['Supabase', /Supabase/],
    ['dominio', /domain/i],
    ['framework', /framework/i],
    ['cosa lasciato fuori', /left out/i],
  ])('porta l\'ancora %s', (_label, pattern) => {
    expect(readme).toMatch(pattern);
  });
});

describe('storia 7.3 — la settima risposta nomina il controllo e il suo limite', () => {
  const readme = read('README.md');

  it('nomina il controllo anti-contaminazione e il limite non-CI', () => {
    expect(readme).toMatch(/anti-contamination/i);
    // Il limite dichiarato: è l'unico anello che NON è un cancello di CI. Una
    // sottostringa stabile ancora l'affermazione senza legarsi alla frase esatta.
    expect(readme).toMatch(/it is not a CI gate/i);
  });
});
