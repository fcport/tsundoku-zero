import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import type { AccountGateway } from '../../domain/ports/accountGateway';
import { DeleteAccountSection } from './DeleteAccountSection';

// Resa statica del container DeleteAccountSection (storia 1.10). Come il gemello
// SettingsScreen.test, chiude una lacuna di regressione: senza questo, la sezione
// potrebbe regredire (ritorno null, titolo perso, <section> persa) sparendo dalla
// shell autenticata con la suite ancora verde. L'ambiente è `node` (nessun jsdom):
// renderToStaticMarkup NON esegue eventi né effetti, quindi lo stato iniziale
// (fase `idle`) è catturato senza il click→handler (glue differita). La porta
// AccountGateway è finta inerte: deleteAccount non è invocata da SSR.

const NOOP = () => {};
const inertAccount: AccountGateway = {
  deleteAccount: async () => ({ ok: true }),
};

describe('DeleteAccountSection — resa del container', () => {
  const markup = renderToStaticMarkup(
    <DeleteAccountSection account={inertAccount} onAccountDeleted={NOOP} />,
  );

  it('rende il titolo della sezione da t() (account.delete.title)', () => {
    expect(markup).toContain(en.account.delete.title);
  });

  it('è un <section> (non un <main>): preserva il single-main', () => {
    expect(markup).toContain('<section');
    expect(markup.match(/<main/g) ?? []).toHaveLength(0);
  });

  it('rende il grilletto iniziale (fase idle, account.delete.trigger)', () => {
    // La sezione non è vuota né ritorna null: espone il primo passo della
    // conferma esplicita a due passi.
    expect(markup).toContain(en.account.delete.trigger);
  });
});
