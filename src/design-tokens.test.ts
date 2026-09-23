import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Assevera la FORMA di theme.css: la fonte unica dei valori (AC1/AC2/AC6/AC7/AC8).
// Legge il file grezzo — nessuna compilazione — perché è il sorgente stesso a
// dover rispettare i vincoli (nessun prefers-color-scheme scritto a mano, ecc.).

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, 'ui/theme.css');
const css = readFileSync(cssPath, 'utf8');

/** `{ nome: '#hex' }` da tutte le righe `--color-<nome>: <hex>;`. */
function parseColors(source: string): Record<string, string> {
  const colors: Record<string, string> = {};
  const re = /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    colors[m[1]] = m[2];
  }
  return colors;
}

// I 27 colori attesi = i letterali esatti di DESIGN.md, senza focus-ring-dark.
const EXPECTED_COLORS: Record<string, string> = {
  // Chiari (14)
  'surface-base': '#FAF7F0',
  'surface-raised': '#FFFFFF',
  'surface-sunken': '#F1ECE1',
  'ink-primary': '#1C1A17',
  'ink-secondary': '#6B6459',
  'ink-muted': '#797065',
  'border-hairline': '#E3DCCE',
  'border-strong': '#9B8D7B',
  accent: '#1F4A7A',
  'accent-hover': '#173A61',
  'accent-subtle': '#E8EEF6',
  danger: '#9B3A2F',
  'danger-subtle': '#F7E9E6',
  'focus-ring': '#2F6FB0',
  // Scuri (13) — nessun focus-ring-dark
  'surface-base-dark': '#161513',
  'surface-raised-dark': '#1F1E1B',
  'surface-sunken-dark': '#100F0E',
  'ink-primary-dark': '#F2EEE6',
  'ink-secondary-dark': '#A8A196',
  'ink-muted-dark': '#8D8477',
  'border-hairline-dark': '#332F2A',
  'border-strong-dark': '#70675B',
  'accent-dark': '#7FB0DC',
  'accent-hover-dark': '#9CC4E6',
  'accent-subtle-dark': '#1B2A38',
  'danger-dark': '#E08476',
  'danger-subtle-dark': '#38211E',
};

const EXPECTED_TEXT_ROLES = [
  'word-hero',
  'word-hero-mobile',
  'word-ruby',
  'reading',
  'meaning',
  'count-hero',
  'count-hero-mobile',
  'display',
  'body',
  'label',
  'label-caps',
  'caption',
  'attribution',
];

describe('AC1 — i 27 token colore, i letterali esatti di DESIGN.md', () => {
  const colors = parseColors(css);

  it('sono esattamente 27 (14 chiari + 13 scuri)', () => {
    expect(Object.keys(colors)).toHaveLength(27);
  });

  it('ogni token ha il valore letterale di DESIGN.md', () => {
    expect(colors).toEqual(EXPECTED_COLORS);
  });

  it('non contiene focus-ring-dark (piegato su accent-dark)', () => {
    expect(colors['focus-ring-dark']).toBeUndefined();
  });

  it('focus-ring chiaro (#2F6FB0) resta un token distinto', () => {
    expect(colors['focus-ring']).toBe('#2F6FB0');
    // accent-dark porta lo stesso valore che avrebbe focus-ring-dark.
    expect(colors['accent-dark']).toBe('#7FB0DC');
  });
});

describe('AC1 — nessun blocco prefers-color-scheme scritto a mano', () => {
  it('il sorgente non contiene "prefers-color-scheme"', () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
  });

  it('non usa una strategia a classe per il dark (@custom-variant / darkMode)', () => {
    expect(css).not.toMatch(/@custom-variant\s+dark/);
    expect(css).not.toMatch(/darkMode/);
  });
});

describe('AC1 — i 13 ruoli tipografici (nessun sentence-hero)', () => {
  const textTokens = [...css.matchAll(/--text-([a-z0-9-]+)\s*:/g)]
    .map((m) => m[1])
    // Scarta i sottoproprietari (--text-body--line-height ecc.): solo la radice.
    .filter((name) => !name.includes('--'));

  it('definisce esattamente i 13 ruoli di DESIGN.md', () => {
    expect(new Set(textTokens)).toEqual(new Set(EXPECTED_TEXT_ROLES));
  });

  it('word-hero dichiara 64px e line-height 1.75 (letterali di DESIGN.md)', () => {
    expect(css).toMatch(/--text-word-hero\s*:\s*64px\s*;/);
    expect(css).toMatch(/--text-word-hero--line-height\s*:\s*1\.75\s*;/);
  });

  it('attribution dichiara 11px (il corpo minimo del sistema)', () => {
    expect(css).toMatch(/--text-attribution\s*:\s*11px\s*;/);
  });
});

describe('AC8 — sentence-hero NON è definito (deferito a 3.23)', () => {
  it('nessun token --text-sentence-hero / --text-sentence-hero-mobile', () => {
    // Verificabile dall'assenza del TOKEN (una commento può nominarlo).
    expect(css).not.toMatch(/--text-sentence-hero\b/);
    expect(css).not.toMatch(/--text-sentence-hero-mobile\b/);
  });

  it('non compare fra i ruoli tipografici estratti', () => {
    const textTokens = [...css.matchAll(/--text-([a-z0-9-]+)\s*:/g)]
      .map((m) => m[1])
      .filter((name) => !name.includes('--'));
    expect(textTokens).not.toContain('sentence-hero');
    expect(textTokens).not.toContain('sentence-hero-mobile');
  });
});

describe('AC1 — scala di spaziatura e raggi coi valori di DESIGN.md', () => {
  it('spaziatura 1–8 sulla scala a 4px', () => {
    const expected: Record<string, string> = {
      '1': '4px',
      '2': '8px',
      '3': '12px',
      '4': '16px',
      '5': '24px',
      '6': '32px',
      '7': '48px',
      '8': '64px',
    };
    for (const [k, v] of Object.entries(expected)) {
      expect(css).toMatch(new RegExp(`--spacing-${k}\\s*:\\s*${v}\\s*;`));
    }
  });

  it('spaziature derivate: gutter-mobile/desktop, measure, thumb-zone', () => {
    expect(css).toMatch(/--spacing-gutter-mobile\s*:\s*20px\s*;/);
    expect(css).toMatch(/--spacing-gutter-desktop\s*:\s*32px\s*;/);
    expect(css).toMatch(/--spacing-measure\s*:\s*34rem\s*;/);
    expect(css).toMatch(/--spacing-thumb-zone\s*:\s*120px\s*;/);
  });

  it('i quattro raggi sm/md/lg/full', () => {
    expect(css).toMatch(/--radius-sm\s*:\s*4px\s*;/);
    expect(css).toMatch(/--radius-md\s*:\s*8px\s*;/);
    expect(css).toMatch(/--radius-lg\s*:\s*12px\s*;/);
    expect(css).toMatch(/--radius-full\s*:\s*9999px\s*;/);
  });
});

describe('AC6 — nessuna ombra nel sistema', () => {
  it('azzera --shadow-* / --inset-shadow-* / --drop-shadow-*', () => {
    expect(css).toMatch(/--shadow-\*\s*:\s*initial\s*;/);
    expect(css).toMatch(/--inset-shadow-\*\s*:\s*initial\s*;/);
    expect(css).toMatch(/--drop-shadow-\*\s*:\s*initial\s*;/);
  });

  it('non definisce alcun token d’ombra con un valore reale', () => {
    // Ammessi solo gli azzeramenti `--shadow-*: initial`. Nessun
    // `--shadow-<nome>: <box-shadow>`.
    const shadowDefs = [...css.matchAll(/--(?:inset-|drop-)?shadow-([a-z0-9-]+)\s*:\s*([^;]+);/g)];
    for (const m of shadowDefs) {
      expect(m[2].trim()).toBe('initial');
    }
  });
});

describe('AC2 — palette e famiglie vincolate; due famiglie caricate', () => {
  it('azzera i default Tailwind prima dei token (--color-*/--font-* initial)', () => {
    expect(css).toMatch(/--color-\*\s*:\s*initial\s*;/);
    expect(css).toMatch(/--font-\*\s*:\s*initial\s*;/);
  });

  it('--font-jp dichiara Noto Sans JP con stack di ripiego', () => {
    const m = css.match(/--font-jp\s*:\s*([^;]+);/);
    expect(m).not.toBeNull();
    expect(m?.[1]).toMatch(/Noto Sans JP/);
    // Uno stack: almeno un ripiego oltre alla famiglia primaria.
    expect((m?.[1].match(/,/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('--font-sans dichiara Inter con stack di ripiego', () => {
    const m = css.match(/--font-sans\s*:\s*([^;]+);/);
    expect(m).not.toBeNull();
    expect(m?.[1]).toMatch(/Inter/);
    expect((m?.[1].match(/,/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});

describe('AC2 — index.html carica entrambe le famiglie da Google Fonts', () => {
  const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');

  it('carica Inter e Noto Sans JP', () => {
    expect(html).toMatch(/fonts\.googleapis\.com/);
    expect(html).toMatch(/Inter/);
    expect(html).toMatch(/Noto\+Sans\+JP/);
  });

  it('usa preconnect verso i domini dei font', () => {
    expect(html).toMatch(/preconnect[^>]*fonts\.googleapis\.com/);
    expect(html).toMatch(/preconnect[^>]*fonts\.gstatic\.com/);
  });
});
