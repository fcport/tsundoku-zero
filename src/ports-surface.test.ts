import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Story 3.10 — AC1, gate MECCANICO della SUPERFICIE delle porte.
//
// Il dominio DICHIARA le cinque porte del ciclo di ripasso come interfacce PURE
// in src/domain/ports/. Questo test lo impone come CI rossa: scandisce i file
// della cartella e pretende un `export interface` per CIASCUNA porta. Se una
// venisse rinominata o rimossa, il test va rosso (protegge il contratto che gli
// adattatori di src/data/ e il seam di src/features/ implementano).
//
// Legge i file via node:fs, come src/service-role-confinement.test.ts e
// src/migrations.test.ts. I *.test.ts sono esclusi dalle regole boundaries.

const here = dirname(fileURLToPath(import.meta.url));
const portsDir = join(here, 'domain', 'ports');

const PORTS = [
  'Clock',
  'ContentRepository',
  'ReviewRepository',
  'ProgressRepository',
  'SettingsRepository',
] as const;

/** Ogni .ts sotto src/domain/ports/, ESCLUSI i *.test.*, concatenati. */
function readPortsSource(): string {
  return readdirSync(portsDir)
    .filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
    .map((f) => readFileSync(join(portsDir, f), 'utf-8'))
    .join('\n');
}

describe('superficie delle porte di dominio (AC1)', () => {
  const source = readPortsSource();

  // Anti-vacuità: se la cartella fosse vuota (o il glob rotto) le asserzioni
  // «export interface» passerebbero su una stringa vuota senza verificare nulla.
  it('la cartella src/domain/ports/ non è vuota', () => {
    const files = readdirSync(portsDir).filter(
      (f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f),
    );
    expect(files.length).toBeGreaterThan(0);
  });

  for (const port of PORTS) {
    it(`dichiara \`export interface ${port}\``, () => {
      const pattern = new RegExp(`export\\s+interface\\s+${port}\\b`);
      expect(
        pattern.test(source),
        `atteso \`export interface ${port}\` in src/domain/ports/`,
      ).toBe(true);
    });
  }
});
