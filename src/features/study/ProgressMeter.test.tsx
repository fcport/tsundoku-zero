import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { i18n } from '../../i18n';
import { ProgressMeter } from './ProgressMeter';

// AC5 (3.19) — la barra di avanzamento, presentazionale. role="progressbar" con
// aria-valuenow/min/max per (0/n), (k/n), (n/n); aria-label da i18n; non resa a
// total 0.

function render(completed: number, total: number): string {
  return renderToStaticMarkup(<ProgressMeter completed={completed} total={total} />);
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('AC5 — attributi ARIA per il progresso', () => {
  it('(0/n): valuenow 0, valuemax n, valuemin 0, role progressbar', () => {
    const markup = render(0, 5);
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="0"');
    expect(markup).toContain('aria-valuemin="0"');
    expect(markup).toContain('aria-valuemax="5"');
    expect(markup).toContain(en.session.progress.label);
  });

  it('(k/n): valuenow k intermedio', () => {
    const markup = render(3, 5);
    expect(markup).toContain('aria-valuenow="3"');
    expect(markup).toContain('aria-valuemax="5"');
  });

  it('(n/n): valuenow === valuemax (completato)', () => {
    const markup = render(5, 5);
    expect(markup).toContain('aria-valuenow="5"');
    expect(markup).toContain('aria-valuemax="5"');
  });
});

describe('AC5 — non resa a total 0', () => {
  it('total 0 ⇒ nessuna barra', () => {
    const markup = render(0, 0);
    expect(markup).not.toContain('role="progressbar"');
    expect(markup).toBe('');
  });
});
