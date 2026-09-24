import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import {
  DeleteAccountConfirm,
  type DeleteAccountPhase,
} from './DeleteAccountConfirm';

// Righe della I/O Matrix per la presentazione della conferma (storia 1.10):
// ambiente node, nessun jsdom, resa statica con renderToStaticMarkup per ciascuna
// fase. La conferma è ESPLICITA e a due passi (AC1): in `idle` un solo grilletto,
// nessuna conseguenza né conferma; in `confirming` la conseguenza dichiarata,
// conferma/annulla, lo slot errore. Il flusso click reale è glue differita.

const NOOP = () => {};

function render(
  phase: DeleteAccountPhase,
  { pending = false, error = false } = {},
): string {
  return renderToStaticMarkup(
    <DeleteAccountConfirm
      phase={phase}
      pending={pending}
      error={error}
      onRequestDelete={NOOP}
      onConfirm={NOOP}
      onCancel={NOOP}
    />,
  );
}

describe('DeleteAccountConfirm — fase idle (solo grilletto)', () => {
  const markup = render('idle');

  it('rende il grilletto da t() (account.delete.trigger)', () => {
    expect(markup).toContain(en.account.delete.trigger);
  });

  it('NON rende la conseguenza né i bottoni conferma/annulla', () => {
    expect(markup).not.toContain(en.account.delete.consequence);
    expect(markup).not.toContain(en.account.delete.cancel);
  });

  it('NON rende lo slot errore', () => {
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain(en.account.delete.error);
  });
});

describe('DeleteAccountConfirm — fase confirming (conferma esplicita)', () => {
  const markup = render('confirming');

  it('rende la conseguenza dichiarata da t() (dati distrutti, statistiche non sopravvivono, irreversibile)', () => {
    expect(markup).toContain(en.account.delete.consequence);
  });

  it('rende i bottoni conferma e annulla da t()', () => {
    expect(markup).toContain(en.account.delete.confirm);
    expect(markup).toContain(en.account.delete.cancel);
  });

  it('senza errore, nessuno slot alert', () => {
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain(en.account.delete.error);
  });
});

describe('DeleteAccountConfirm — pending disabilita la conferma', () => {
  it('pending={true} ⇒ il bottone di conferma è disabled', () => {
    const markup = render('confirming', { pending: true });
    // Il PRIMO <button> nella fase confirming è la conferma (annulla segue).
    const buttonTag = markup.slice(
      markup.indexOf('<button'),
      markup.indexOf('>', markup.indexOf('<button')) + 1,
    );
    expect(buttonTag).toContain('disabled');
  });

  it('pending={false} ⇒ il bottone di conferma NON è disabled', () => {
    const markup = render('confirming', { pending: false });
    const buttonTag = markup.slice(
      markup.indexOf('<button'),
      markup.indexOf('>', markup.indexOf('<button')) + 1,
    );
    expect(buttonTag).not.toContain('disabled');
  });

  it('pending={true} ⇒ ANCHE il bottone di Annulla è disabled', () => {
    // Annullare mentre la cancellazione è in volo non aborta la richiesta: su
    // un'azione irreversibile è un'affordance ingannevole. Entrambi i bottoni
    // (conferma e annulla) sono disabilitati ⇒ due `disabled` nel markup.
    const markup = render('confirming', { pending: true });
    const disabledCount = (markup.match(/disabled/g) ?? []).length;
    expect(disabledCount).toBe(2);
  });
});

describe('DeleteAccountConfirm — slot errore', () => {
  it('error={true} in confirming ⇒ rende account.delete.error in role="alert"', () => {
    const markup = render('confirming', { error: true });
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(en.account.delete.error);
  });
});

describe('DeleteAccountConfirm — nessun <main> (preserva single-main)', () => {
  it('la superficie non introduce un secondo landmark <main>', () => {
    for (const phase of ['idle', 'confirming'] as const) {
      const markup = render(phase);
      expect(markup).not.toContain('<main');
    }
  });
});
