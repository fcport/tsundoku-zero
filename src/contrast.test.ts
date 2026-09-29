import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  parseThemeColors,
  verifyContrast,
  TOKEN_ROLES,
  TEXT_THRESHOLD,
  NON_TEXT_THRESHOLD,
  // @ts-expect-error — script .mjs senza dichiarazioni di tipo; è codice puro
  // esercitato qui dentro `npm test` per NON duplicare la logica WCAG (AC3).
} from '../scripts/check-contrast.mjs';

// AC3, dentro `npm test`: importa gli helper dello script di contrasto,
// asserisce rapporti noti (le righe della I/O Matrix) e che la verifica
// completa sul theme.css REALE non abbia alcun fallimento. Confronto sul valore
// GREZZO (>=), come lo script: i margini sono voluti e sottili.

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(__dirname, 'ui/theme.css'), 'utf8');
const colors = parseThemeColors(css) as Record<string, string>;

describe('formula WCAG di contrastRatio', () => {
  it('bianco su nero = 21:1', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  it('stesso colore = 1:1', () => {
    expect(contrastRatio('#1F4A7A', '#1F4A7A')).toBeCloseTo(1, 10);
  });

  it('è simmetrica (primo piano/fondo scambiati)', () => {
    expect(contrastRatio('#797065', '#FAF7F0')).toBeCloseTo(
      contrastRatio('#FAF7F0', '#797065'),
      12,
    );
  });
});

describe('rapporti noti della I/O Matrix', () => {
  it('coppia testo conforme: ink-muted su surface-base (chiaro) ≥ 4.5', () => {
    const r = contrastRatio(colors['ink-muted'], colors['surface-base']);
    expect(r).toBeCloseTo(5.3585, 3);
    expect(r).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });

  it('sull\'inchiostro: accent-on-ink su ink-primary ≥ 4.5 (la dichiarazione dell\'opzione giusta)', () => {
    const r = contrastRatio(colors['accent-on-ink'], colors['ink-primary']);
    expect(r).toBeCloseTo(6.6651, 3);
    expect(r).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });

  it('coppia non-testo: focus-ring su surface-base ≥ 3.0', () => {
    const r = contrastRatio(colors['focus-ring'], colors['surface-base']);
    expect(r).toBeGreaterThanOrEqual(NON_TEXT_THRESHOLD);
  });

  it('border-strong supera 3:1 come confine non-testo (chiaro)', () => {
    const r = contrastRatio(colors['border-strong'], colors['surface-base']);
    expect(r).toBeGreaterThanOrEqual(NON_TEXT_THRESHOLD);
  });

  it('bordo decorativo border-hairline sta a ~1.44:1 — sotto ogni soglia', () => {
    // Non è un fallimento: è la ragione per cui è ESENTE (WCAG 1.4.11).
    const r = contrastRatio(colors['border-hairline'], colors['surface-base']);
    expect(r).toBeCloseTo(1.436, 2);
    expect(r).toBeLessThan(NON_TEXT_THRESHOLD);
  });
});

describe('border-hairline è decorativo esente, non un primo piano valutato', () => {
  it('non compare fra i ruoli testo o non-testo di alcun fondo', () => {
    for (const mode of ['light', 'ink'] as const) {
      const roles = TOKEN_ROLES[mode];
      expect(roles.text).not.toContain('border-hairline');
      expect(roles.nonText).not.toContain('border-hairline');
    }
    expect(TOKEN_ROLES.light.exempt).toContain('border-hairline');
  });
});

describe('nessuna modalità scura (29-09-2026)', () => {
  it('lo script non valuta alcun ruolo scuro', () => {
    expect(Object.keys(TOKEN_ROLES)).toEqual(['light', 'ink']);
  });
});

describe('verifica completa sul theme.css reale', () => {
  it('valuta ogni coppia su surface-base E surface-raised, più il fondo d\'inchiostro', () => {
    const { rows } = verifyContrast(colors);
    // Carta: 6 testo + 2 non-testo = 8 primi piani × 2 fondi = 16 righe.
    // Inchiostro: 2 testi (carta, accent-on-ink) × 1 fondo = 2 righe.
    const light = rows.filter((r: { mode: string }) => r.mode === 'light');
    const ink = rows.filter((r: { mode: string }) => r.mode === 'ink');
    expect(light).toHaveLength(16);
    expect(ink).toHaveLength(2);
    const bgs = new Set(rows.map((r: { bg: string }) => r.bg));
    expect(bgs).toEqual(new Set(['surface-base', 'surface-raised', 'ink-primary']));
  });

  it('non ha alcun fallimento (exit 0 dello script)', () => {
    const { failures } = verifyContrast(colors);
    expect(failures).toEqual([]);
  });
});

describe('un token sotto soglia farebbe fallire la verifica (CI rossa)', () => {
  it('un ink-muted ipotetico troppo chiaro produce un fallimento elencato', () => {
    // #9A9287 era la prima stesura di ink-muted: 2.87:1, non conforme.
    const broken = { ...colors, 'ink-muted': '#9A9287' };
    const { failures } = verifyContrast(broken);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some((f: { fg: string }) => f.fg === 'ink-muted')).toBe(true);
  });
});
