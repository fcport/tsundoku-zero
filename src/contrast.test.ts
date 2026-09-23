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
    expect(r).toBeCloseTo(4.5449, 3);
    expect(r).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });

  it('coppia testo scura al limite: ink-muted-dark su surface-raised-dark ≥ 4.5', () => {
    const r = contrastRatio(colors['ink-muted-dark'], colors['surface-raised-dark']);
    expect(r).toBeCloseTo(4.524, 3);
    expect(r).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });

  it('coppia non-testo al limite: border-strong-dark su surface-raised-dark ≥ 3.0', () => {
    const r = contrastRatio(colors['border-strong-dark'], colors['surface-raised-dark']);
    expect(r).toBeCloseTo(3.0006, 4);
    expect(r).toBeGreaterThanOrEqual(NON_TEXT_THRESHOLD);
  });

  it('border-strong supera 3:1 come confine non-testo (chiaro)', () => {
    const r = contrastRatio(colors['border-strong'], colors['surface-base']);
    expect(r).toBeGreaterThanOrEqual(NON_TEXT_THRESHOLD);
  });

  it('bordo decorativo border-hairline sta a ~1.27:1 — sotto ogni soglia', () => {
    // Non è un fallimento: è la ragione per cui è ESENTE (WCAG 1.4.11).
    const r = contrastRatio(colors['border-hairline'], colors['surface-base']);
    expect(r).toBeCloseTo(1.275, 2);
    expect(r).toBeLessThan(NON_TEXT_THRESHOLD);
  });
});

describe('border-hairline è decorativo esente, non un primo piano valutato', () => {
  it('non compare fra i ruoli testo o non-testo di alcuna modalità', () => {
    for (const mode of ['light', 'dark'] as const) {
      const roles = TOKEN_ROLES[mode];
      expect(roles.text).not.toContain(mode === 'light' ? 'border-hairline' : 'border-hairline-dark');
      expect(roles.nonText).not.toContain(
        mode === 'light' ? 'border-hairline' : 'border-hairline-dark',
      );
      expect(roles.exempt).toContain(mode === 'light' ? 'border-hairline' : 'border-hairline-dark');
    }
  });
});

describe('in scuro il focus-ring riusa accent-dark', () => {
  it('accent-dark è il ruolo non-testo del focus in scuro (nessun focus-ring-dark)', () => {
    expect(TOKEN_ROLES.dark.nonText).toContain('accent-dark');
    expect(colors['focus-ring-dark']).toBeUndefined();
  });
});

describe('verifica completa sul theme.css reale', () => {
  it('valuta ogni coppia su surface-base E surface-raised, chiaro E scuro', () => {
    const { rows } = verifyContrast(colors);
    // 6 testo + 2 non-testo = 8 primi piani per modalità, × 2 fondi = 16 righe.
    const light = rows.filter((r: { mode: string }) => r.mode === 'light');
    const dark = rows.filter((r: { mode: string }) => r.mode === 'dark');
    expect(light).toHaveLength(16);
    expect(dark).toHaveLength(16);
    const bgs = new Set(rows.map((r: { bg: string }) => r.bg));
    expect(bgs).toContain('surface-base');
    expect(bgs).toContain('surface-raised');
    expect(bgs).toContain('surface-base-dark');
    expect(bgs).toContain('surface-raised-dark');
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
