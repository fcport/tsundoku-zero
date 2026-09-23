// Verifica del contrasto in CI (storia 1.3, UX-DR7).
//
// Valuta OGNI coppia colore/fondo sui due fondi (surface-base E surface-raised),
// in modalità chiara E scura, e fallisce con exit non-zero se una coppia di
// testo scende sotto 4.5:1 o una non-testo sotto 3:1. border-hairline è
// decorativo (WCAG 1.4.11) ed è ESENTE: non viene mai valutato, non fa mai
// fallire lo script.
//
// La fonte dei valori è UNA: src/ui/theme.css. Questo file non ridefinisce i
// colori — li LEGGE con una regex su `--color-<nome>: <hex>;`, coerente con lo
// spirito "niente valori sparsi". Gli helper puri sono esportati così che
// src/contrast.test.ts li eserciti dentro `npm test` senza duplicare la logica.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEME_PATH = resolve(__dirname, '..', 'src', 'ui', 'theme.css');

// -----------------------------------------------------------------------------
// WCAG: luminanza relativa e rapporto di contrasto (Design Notes della spec).
// Confrontiamo il valore GREZZO (>=), senza arrotondare a 2 decimali: i margini
// sono voluti e sottili (border-strong-dark/surface-raised-dark = 3.0006).
// -----------------------------------------------------------------------------

/** `#RRGGBB` (o `#RGB`) → `[r, g, b]` in 0..255. */
export function hexToRgb(hex) {
  const s = hex.trim().replace(/^#/, '');
  const full =
    s.length === 3
      ? s
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Colore esadecimale non valido: "${hex}"`);
  }
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

const lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Luminanza relativa WCAG di `[r, g, b]`. */
export function luminance([r, g, b]) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rapporto di contrasto WCAG fra due colori esadecimali. */
export function contrastRatio(fgHex, bgHex) {
  const a = luminance(hexToRgb(fgHex));
  const b = luminance(hexToRgb(bgHex));
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// -----------------------------------------------------------------------------
// Classificazione dei ruoli (Design Notes). Non è un prodotto cartesiano cieco:
// DESIGN.md assegna un ruolo a ogni token, e lo script lo rispetta. Valutare un
// fondo-tinta come primo piano lo farebbe fallire per progetto.
// -----------------------------------------------------------------------------

export const TEXT_THRESHOLD = 4.5;
export const NON_TEXT_THRESHOLD = 3.0;

/**
 * Ruoli per modalità. In scuro l'anello di focus NON è un token separato: riusa
 * `accent-dark` (il valore #7FB0DC è identico), l'unica riconciliazione del 27.
 * I fondi sono i due contro cui si valuta ogni primo piano.
 */
export const TOKEN_ROLES = {
  light: {
    backgrounds: ['surface-base', 'surface-raised'],
    text: [
      'ink-primary',
      'ink-secondary',
      'ink-muted',
      'accent',
      'accent-hover',
      'danger',
    ],
    nonText: ['border-strong', 'focus-ring'],
    // Decorativo esente (WCAG 1.4.11): mai valutato, mai un fallimento.
    exempt: ['border-hairline'],
  },
  dark: {
    backgrounds: ['surface-base-dark', 'surface-raised-dark'],
    text: [
      'ink-primary-dark',
      'ink-secondary-dark',
      'ink-muted-dark',
      'accent-dark',
      'accent-hover-dark',
      'danger-dark',
    ],
    // In scuro il focus-ring riusa accent-dark (nessun focus-ring-dark token).
    nonText: ['border-strong-dark', 'accent-dark'],
    exempt: ['border-hairline-dark'],
  },
};

// -----------------------------------------------------------------------------
// Fonte unica: legge i colori dal blocco @theme di theme.css.
// -----------------------------------------------------------------------------

/** Estrae `{ nome: '#hex' }` da tutte le righe `--color-<nome>: <hex>;`. */
export function parseThemeColors(css) {
  const colors = {};
  const re = /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    colors[m[1]] = m[2];
  }
  return colors;
}

/**
 * Valuta ogni coppia primo-piano/fondo per una modalità e ritorna le righe di
 * report più l'elenco dei fallimenti. Il border-hairline (exempt) non entra mai.
 */
function evaluateMode(colors, roles) {
  const rows = [];
  const failures = [];

  const check = (fgName, kind, threshold) => {
    for (const bgName of roles.backgrounds) {
      const fg = colors[fgName];
      const bg = colors[bgName];
      if (fg === undefined) {
        throw new Error(`Token colore mancante in theme.css: --color-${fgName}`);
      }
      if (bg === undefined) {
        throw new Error(`Token fondo mancante in theme.css: --color-${bgName}`);
      }
      const ratio = contrastRatio(fg, bg);
      const pass = ratio >= threshold;
      rows.push({ fg: fgName, bg: bgName, kind, threshold, ratio, pass });
      if (!pass) {
        failures.push({ fg: fgName, bg: bgName, kind, threshold, ratio });
      }
    }
  };

  for (const t of roles.text) check(t, 'text', TEXT_THRESHOLD);
  for (const n of roles.nonText) check(n, 'non-text', NON_TEXT_THRESHOLD);

  return { rows, failures };
}

/**
 * Verifica completa su entrambe le modalità. Ritorna `{ rows, failures }`.
 * `failures` vuoto ⇒ conformità totale. Puro: nessun I/O, nessun exit.
 */
export function verifyContrast(colors) {
  const rows = [];
  const failures = [];
  for (const mode of ['light', 'dark']) {
    const res = evaluateMode(colors, TOKEN_ROLES[mode]);
    for (const r of res.rows) rows.push({ mode, ...r });
    for (const f of res.failures) failures.push({ mode, ...f });
  }
  return { rows, failures };
}

// -----------------------------------------------------------------------------
// Runner CLI.
// -----------------------------------------------------------------------------

async function main() {
  const css = await readFile(THEME_PATH, 'utf8');
  const colors = parseThemeColors(css);
  const { rows, failures } = verifyContrast(colors);

  const fmt = (n) => n.toFixed(4);
  for (const r of rows) {
    const mark = r.pass ? 'PASS' : 'FAIL';
    console.log(
      `[${r.mode}] ${mark} ${r.fg} su ${r.bg} — ${fmt(r.ratio)}:1 ` +
        `(${r.kind}, soglia ${r.threshold}:1)`,
    );
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} coppia/e sotto soglia:`);
    for (const f of failures) {
      console.error(
        `  [${f.mode}] ${f.fg} su ${f.bg} — ${fmt(f.ratio)}:1 ` +
          `< ${f.threshold}:1 (${f.kind})`,
      );
    }
    process.exit(1);
  }

  console.log(`\nTutte le ${rows.length} coppie conformi. border-hairline esente (WCAG 1.4.11).`);
}

// Esegui solo come CLI, non quando importato dai test.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
