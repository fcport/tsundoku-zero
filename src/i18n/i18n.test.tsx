import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../ui/App';
import { en } from './en';
import { it as itCatalog } from './it';
import { i18n } from './index';

// Codifica la I/O & Edge-Case Matrix e gli AC della storia 1.4. L'ambiente è
// `node` (vitest.config.ts): nessun jsdom, il render passa da
// renderToStaticMarkup. Init sincrono con risorse inline + useSuspense:false
// ⇒ useTranslation è pronto quando <App/> è resa.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

/** Raccoglie ricorsivamente i percorsi-chiave (`a.b.c`) di un catalogo. */
function keyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Raccoglie ricorsivamente i valori-foglia (stringhe) di un catalogo. */
function leafValues(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj];
  if (typeof obj !== 'object' || obj === null) return [];
  return Object.values(obj as Record<string, unknown>).flatMap(leafValues);
}

// Blocchi Unicode CJK: simboli/punteggiatura CJK, Hiragana, Katakana, CJK
// Unified Ideographs (+ Ext A), forme a larghezza piena. Copre 積ん読ゼロ e ogni
// kana/kanji. Scritto con escape \u per non introdurre whitespace irregolare
// (lo spazio ideografico U+3000 nel sorgente) — ESLint no-irregular-whitespace.
const CJK = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFFEF]/u;

describe('AC1 — type-safety via declaration merging su CustomTypeOptions', () => {
  it('chiave esistente ⇒ ritorna la stringa localizzata e compila', () => {
    // Chiave valida: compila (0 errori tsc) e risolve al valore `en`.
    expect(i18n.t('app.tagline')).toBe(en.app.tagline);
  });

  it('chiave inesistente ⇒ errore di compilazione tsc (asserito da @ts-expect-error)', () => {
    // @ts-expect-error — 'app.nope' non esiste nelle risorse tipizzate.
    // Se l'augmentation si rompesse (t accetta qualunque stringa), la direttiva
    // diventerebbe "unused" e `tsc --noEmit` fallirebbe: così sia
    // l'augmentation rotta sia la chiave-diventata-valida sono colte in CI.
    i18n.t('app.nope');
  });
});

describe('AC2 — parità ricorsiva dei cataloghi en/it', () => {
  it('hanno lo stesso insieme di chiavi (ricorsivo)', () => {
    expect(new Set(keyPaths(en))).toEqual(new Set(keyPaths(itCatalog)));
  });

  it('sono entrambi non vuoti', () => {
    expect(keyPaths(en).length).toBeGreaterThan(0);
    expect(keyPaths(itCatalog).length).toBeGreaterThan(0);
  });
});

describe('AC / Matrix — nessun carattere CJK nei cataloghi', () => {
  it('nessun valore di `en` contiene CJK', () => {
    for (const v of leafValues(en)) {
      expect(CJK.test(v), `valore CJK inatteso in en: ${v}`).toBe(false);
    }
  });

  it('nessun valore di `it` contiene CJK', () => {
    for (const v of leafValues(itCatalog)) {
      expect(CJK.test(v), `valore CJK inatteso in it: ${v}`).toBe(false);
    }
  });
});

describe('AC3 — giapponese come dato con lang="ja"; interfaccia da t()', () => {
  const markup = renderToStaticMarkup(<App />);

  it('il markup porta lang="ja" attorno al giapponese', () => {
    expect(markup).toMatch(/lang="ja"[^>]*>積ん読ゼロ/);
  });

  it('la tagline resa è il VALORE di t(), non la chiave', () => {
    // Prova che l'interfaccia passa da t(): il markup contiene il valore `en`
    // risolto, e NON la chiave grezza 'app.tagline'.
    expect(markup).toContain(en.app.tagline);
    expect(markup).not.toContain('app.tagline');
  });

  it('la stringa giapponese non è un valore dei cataloghi (non viene da t())', () => {
    const allValues = [...leafValues(en), ...leafValues(itCatalog)];
    expect(allValues).not.toContain('積ん読ゼロ');
  });
});

describe('AC4 — il confine a tre di AD-14 è documentato', () => {
  const doc = readFileSync(resolve(repoRoot, 'docs/i18n-boundary.md'), 'utf8');

  it('dichiara il lato INTERFACCIA da t()', () => {
    expect(doc).toMatch(/interfaccia/i);
    expect(doc).toMatch(/t\(\)/);
  });

  it('dichiara il lato CONTENUTO delle lezioni dal file di lezione', () => {
    expect(doc).toMatch(/contenuto delle lezioni/i);
    expect(doc).toMatch(/file di lezione/i);
  });

  it('dichiara il lato GIAPPONESE da nessuno dei due', () => {
    expect(doc).toMatch(/giapponese/i);
    expect(doc).toMatch(/nessuno dei due/i);
  });
});
