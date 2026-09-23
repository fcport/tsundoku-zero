import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Righe "deep link" e "percorso interno del repo" della I/O Matrix (storia 1.2).
// Il routing vero è di Vercel e si verifica sull'URL reale (azione operatore);
// qui blocchiamo la CONFIG che lo produce, così una regressione di vercel.json
// — rewrite rimosso o output-dir cambiato — fa fallire la CI invece di rompere
// silenziosamente i deep link o esporre la radice del repo in produzione.
// Precedente: src/boundaries.test.ts verifica config di livello repo da src/.

const here = dirname(fileURLToPath(import.meta.url));
const vercelConfig = JSON.parse(
  readFileSync(resolve(here, '..', 'vercel.json'), 'utf-8'),
) as {
  readonly framework?: string;
  readonly installCommand?: string;
  readonly buildCommand?: string;
  readonly outputDirectory?: string;
  readonly rewrites?: readonly { source: string; destination: string }[];
};

describe('vercel.json — config di deploy', () => {
  it('framework/install/build fissati: le impostazioni che romperebbero la produzione', () => {
    // Se una di queste scivola, il deploy fallisce (o installa con npm install,
    // vietato da AD-20). Le fissiamo qui insieme a output-dir/rewrites così una
    // regressione di vercel.json è CI rossa, non una produzione rotta.
    expect(vercelConfig.framework).toBe('vite');
    expect(vercelConfig.installCommand).toBe('npm ci');
    expect(vercelConfig.buildCommand).toBe('npm run build');
  });

  it('serve solo l\'artefatto di build: outputDirectory = dist', () => {
    // Riga "percorso interno del repo": dist non contiene _bmad-output, quindi
    // /_bmad-output/… non è raggiungibile dalla radice del repo in produzione.
    expect(vercelConfig.outputDirectory).toBe('dist');
  });

  it('deep link: riscrive ogni rotta verso /index.html (fallback SPA)', () => {
    // Riga "deep link": nessun 404 su una rotta interna aperta direttamente;
    // i file statici di dist/assets/* non sono intercettati (i rewrites di
    // Vercel si applicano solo quando nessun file corrisponde).
    expect(vercelConfig.rewrites).toEqual([
      { source: '/(.*)', destination: '/index.html' },
    ]);
  });
});
