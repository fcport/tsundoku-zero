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
// Direzione «rivista» (29-09-2026): carta, inchiostro, un solo rosso.
const EXPECTED_COLORS: Record<string, string> = {
  // Chiari (14)
  'surface-base': '#ECE7DC',
  'surface-raised': '#F5F1E9',
  'surface-sunken': '#DCD5C7',
  'ink-primary': '#121110',
  'ink-secondary': '#4F4A44',
  'ink-muted': '#625C54',
  'border-hairline': '#C9C2B4',
  'border-strong': '#121110',
  accent: '#B8321B',
  'accent-hover': '#9C2915',
  'accent-subtle': '#F2DCD3',
  danger: '#A82E19',
  'danger-subtle': '#EFD6CC',
  'focus-ring': '#B8321B',
  // Il rosso acceso che si legge sull'inchiostro (barra d'azione, opzione giusta).
  'accent-on-ink': '#FF6A4D',
};

const EXPECTED_TEXT_ROLES = [
  'word-hero',
  'word-hero-mobile',
  'sentence-hero',
  'sentence-hero-mobile',
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

describe('AC1 — i 15 token colore, i letterali esatti di DESIGN.md', () => {
  const colors = parseColors(css);

  it('sono esattamente 15 (14 per la carta + accent-on-ink), nessuno scuro', () => {
    expect(Object.keys(colors)).toHaveLength(15);
    expect(Object.keys(colors).filter((k) => k.endsWith('-dark'))).toEqual([]);
  });

  it('ogni token ha il valore letterale di DESIGN.md', () => {
    expect(colors).toEqual(EXPECTED_COLORS);
  });

  it('focus-ring (#B8321B) resta un token distinto', () => {
    expect(colors['focus-ring']).toBe('#B8321B');
  });
});

describe('nessuna modalità scura (29-09-2026)', () => {
  it('il sorgente non contiene "prefers-color-scheme"', () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
  });

  it('dichiara color-scheme light e non usa varianti dark: nel body', () => {
    expect(css).toMatch(/color-scheme\s*:\s*light\s*;/);
    expect(css).not.toMatch(/dark:/);
  });

  it('non usa una strategia a classe per il dark (@custom-variant / darkMode)', () => {
    expect(css).not.toMatch(/@custom-variant\s+dark/);
    expect(css).not.toMatch(/darkMode/);
  });
});

describe('AC1 — i 15 ruoli tipografici (i 13 di DESIGN.md + sentence-hero(-mobile))', () => {
  const textTokens = [...css.matchAll(/--text-([a-z0-9-]+)\s*:/g)]
    .map((m) => m[1])
    // Scarta i sottoproprietari (--text-body--line-height ecc.): solo la radice.
    .filter((name) => !name.includes('--'));

  it('definisce esattamente i 15 ruoli (i 13 di DESIGN.md + sentence-hero(-mobile))', () => {
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

describe('AC1 — sentence-hero È definito (fissato dalla 3.23, UX-DR8)', () => {
  it('--text-sentence-hero dichiara 32px e line-height 1.9 (NON 1.75)', () => {
    expect(css).toMatch(/--text-sentence-hero\s*:\s*32px\s*;/);
    expect(css).toMatch(/--text-sentence-hero--line-height\s*:\s*1\.9\s*;/);
    // L'interlinea è 1.9, non l'1.75 di word-hero (che valeva per una parola sola).
    expect(css).not.toMatch(/--text-sentence-hero--line-height\s*:\s*1\.75\s*;/);
  });

  it('--text-sentence-hero-mobile dichiara 26px e line-height 1.9', () => {
    expect(css).toMatch(/--text-sentence-hero-mobile\s*:\s*26px\s*;/);
    expect(css).toMatch(/--text-sentence-hero-mobile--line-height\s*:\s*1\.9\s*;/);
  });

  it('compare fra i ruoli tipografici estratti', () => {
    const textTokens = [...css.matchAll(/--text-([a-z0-9-]+)\s*:/g)]
      .map((m) => m[1])
      .filter((name) => !name.includes('--'));
    expect(textTokens).toContain('sentence-hero');
    expect(textTokens).toContain('sentence-hero-mobile');
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

  it('i quattro raggi sm/md/lg/full (la rivista non arrotonda: sm e md a zero)', () => {
    expect(css).toMatch(/--radius-sm\s*:\s*0px\s*;/);
    expect(css).toMatch(/--radius-md\s*:\s*0px\s*;/);
    expect(css).toMatch(/--radius-lg\s*:\s*2px\s*;/);
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

describe('AC2 — palette e famiglie vincolate; tre famiglie caricate', () => {
  it('azzera i default Tailwind prima dei token (--color-*/--font-* initial)', () => {
    expect(css).toMatch(/--color-\*\s*:\s*initial\s*;/);
    expect(css).toMatch(/--font-\*\s*:\s*initial\s*;/);
  });

  it('--font-jp dichiara Shippori Mincho con stack di ripiego', () => {
    const m = css.match(/--font-jp\s*:\s*([^;]+);/);
    expect(m).not.toBeNull();
    expect(m?.[1]).toMatch(/Shippori Mincho/);
    // Uno stack: almeno un ripiego oltre alla famiglia primaria.
    expect((m?.[1].match(/,/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('--font-jp-read dichiara BIZ UDPMincho, ed è il font di ogni nodo giapponese', () => {
    const m = css.match(/--font-jp-read\s*:\s*([^;]+);/);
    expect(m).not.toBeNull();
    expect(m?.[1]).toMatch(/BIZ UDPMincho/);
    expect((m?.[1].match(/,/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(css).toMatch(/:lang\(ja\)\s*\{\s*font-family:\s*var\(--font-jp-read\)/);
  });

  it('--font-sans dichiara Archivo con stack di ripiego', () => {
    const m = css.match(/--font-sans\s*:\s*([^;]+);/);
    expect(m).not.toBeNull();
    expect(m?.[1]).toMatch(/Archivo/);
    expect((m?.[1].match(/,/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('--font-mono dichiara IBM Plex Mono con stack di ripiego', () => {
    const m = css.match(/--font-mono\s*:\s*([^;]+);/);
    expect(m).not.toBeNull();
    expect(m?.[1]).toMatch(/IBM Plex Mono/);
    expect((m?.[1].match(/,/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});

describe('AC2 — index.html carica le tre famiglie da Google Fonts', () => {
  const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');

  it("carica Archivo (con l'asse di larghezza), Shippori Mincho e IBM Plex Mono", () => {
    expect(html).toMatch(/fonts\.googleapis\.com/);
    expect(html).toMatch(/family=Archivo:wdth,wght/);
    expect(html).toMatch(/Shippori\+Mincho/);
    expect(html).toMatch(/BIZ\+UDPMincho/);
    expect(html).toMatch(/IBM\+Plex\+Mono/);
  });

  it('usa preconnect verso i domini dei font', () => {
    expect(html).toMatch(/preconnect[^>]*fonts\.googleapis\.com/);
    expect(html).toMatch(/preconnect[^>]*fonts\.gstatic\.com/);
  });
});
