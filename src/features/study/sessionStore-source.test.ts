import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Sonda MECCANICA sul SORGENTE di `sessionStore.ts` (Story 3.4, AD-6): lo store
// nasce «muto». DELEGA al dominio (usa `sessionReducer`/`createSession`) e NON
// contiene logica di coda (nessun token `queue`) né di scheduling (nessun import di
// `../../domain/schedule`/`due`); NON è persistito (nessun `persist`, nessuno
// storage). Legge il codice a commenti rimossi, così la prosa non è una violazione.

const __dirname = dirname(fileURLToPath(import.meta.url));
const storeSource = resolve(__dirname, 'sessionStore.ts');

/** Rimuove i commenti di riga e di blocco: la sonda controlla il CODICE, non la prosa. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('sonda sul sorgente di sessionStore.ts (AC5, AC6)', () => {
  const raw = readFileSync(storeSource, 'utf8');

  // Anti-vacuità: file trovato, non vuoto, ed è davvero uno store Zustand.
  it('trova il sorgente e contiene create< (anti-vacuità)', () => {
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).toContain('create<');
  });

  const code = stripComments(raw);

  it('delega al dominio: usa sessionReducer e createSession', () => {
    expect(code).toContain('sessionReducer');
    expect(code).toContain('createSession');
  });

  it('non contiene logica di coda: nessun token queue', () => {
    expect(/\bqueue\b/.test(code)).toBe(false);
  });

  it('non importa lo scheduling del dominio (schedule/due)', () => {
    expect(/from\s+['"]\.\.\/\.\.\/domain\/schedule['"]/.test(code)).toBe(false);
    expect(/from\s+['"]\.\.\/\.\.\/domain\/due['"]/.test(code)).toBe(false);
  });

  it('non è persistito: nessun persist né storage', () => {
    expect(/\bpersist\b/.test(code)).toBe(false);
    expect(/\blocalStorage\b/.test(code)).toBe(false);
    expect(/\bsessionStorage\b/.test(code)).toBe(false);
  });
});
