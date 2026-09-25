import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { i18n } from '../../i18n';
import type { ResolvedExplanation } from '../../domain/exercise';
import { ExplanationPanel } from './ExplanationPanel';

// AC1/AC2/AC3 + FR8.5 (3.19) — il pannello della spiegazione, presentazionale.
// Consulto (correct null): SOLO spiegazione, nessuna dichiarazione di esito.
// Post-risposta (correct non-null): dichiarazione TESTUALE + spiegazione. Ripiego
// (isFallback): avviso «non ancora tradotta», lang sulla lingua resa. Nessun colore.

const resolved: ResolvedExplanation = {
  text: 'The topic particle marks the topic.',
  language: 'en',
  isFallback: false,
};

const fallback: ResolvedExplanation = {
  text: 'The English explanation shown as a fallback.',
  language: 'en',
  isFallback: true,
};

function render(explanation: ResolvedExplanation, correct: boolean | null): string {
  return renderToStaticMarkup(
    <ExplanationPanel explanation={explanation} correct={correct} />,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('AC3 — consulto pre-risposta (correct null): solo spiegazione', () => {
  it('rende il testo LETTERALE della spiegazione, senza dichiarazione di esito', () => {
    const markup = render(resolved, null);
    expect(markup).toContain(resolved.text);
    expect(markup).not.toContain(en.session.outcome.correct);
    expect(markup).not.toContain(en.session.outcome.incorrect);
  });
});

describe('AC1 — post-risposta (correct non-null): dichiarazione + spiegazione', () => {
  it('corretto ⇒ dichiara «corretto» in testo + spiegazione', () => {
    const markup = render(resolved, true);
    expect(markup).toContain(en.session.outcome.correct);
    expect(markup).not.toContain(en.session.outcome.incorrect);
    expect(markup).toContain(resolved.text);
  });

  it('errato ⇒ dichiara «non corretto» in testo + spiegazione', () => {
    const markup = render(resolved, false);
    expect(markup).toContain(en.session.outcome.incorrect);
    expect(markup).not.toContain(en.session.outcome.correct);
    expect(markup).toContain(resolved.text);
  });
});

describe('FR8.5 — ripiego dichiarato', () => {
  it('isFallback ⇒ avviso «non ancora tradotta»', () => {
    const markup = render(fallback, null);
    expect(markup).toContain(en.session.explanation.fallbackNotice);
  });

  it('non-fallback ⇒ nessun avviso', () => {
    const markup = render(resolved, null);
    expect(markup).not.toContain(en.session.explanation.fallbackNotice);
  });

  it('il testo di ripiego porta lang sulla lingua EFFETTIVAMENTE resa (en)', () => {
    const markup = render(fallback, null);
    // Ripiego: testo in inglese ⇒ lang="en" sul nodo del testo.
    expect(markup).toContain('lang="en"');
  });
});

describe('AC2 — nessuna grammatica della celebrazione', () => {
  it('nessun verde/rosso, nessun !/emoji (nessun success/danger/green/red)', () => {
    const markup = render(resolved, true);
    expect(markup).not.toContain('danger');
    expect(markup.toLowerCase()).not.toContain('green');
    expect(markup.toLowerCase()).not.toContain('red');
    expect(markup).not.toContain('!');
  });
});
