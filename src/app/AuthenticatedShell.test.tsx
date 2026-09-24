import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { AuthenticatedShell } from './AuthenticatedShell';

// Righe della I/O Matrix per la radice protetta (storia 1.7): resa statica.
// La shell autenticata è branding (<App/>: lang="ja" + tagline) + bottone
// Disconnetti; il pending disabilita il bottone.

const NOOP = () => {};

describe('AuthenticatedShell — branding + bottone Disconnetti', () => {
  const markup = renderToStaticMarkup(
    <AuthenticatedShell onSignOut={NOOP} signOutPending={false} />,
  );

  it('rende il branding con lang="ja" e la tagline', () => {
    expect(markup).toMatch(/lang="ja"[^>]*>積ん読ゼロ/);
    expect(markup).toContain(en.app.tagline);
  });

  it('rende il bottone Disconnetti da t()', () => {
    expect(markup).toContain(en.auth.signOut);
  });

  it('NON rende il form di autenticazione', () => {
    expect(markup).not.toContain('id="auth-email"');
    expect(markup).not.toContain('id="auth-password"');
  });

  it('ha un solo landmark <main> (nessun <main> annidato/duplicato)', () => {
    // La shell è <header> + <App/>: App possiede l'UNICO <main>. Come nel ramo
    // non autenticato (1.6), un <main> annidato o duplicato è un difetto.
    const opens = markup.match(/<main/g) ?? [];
    expect(opens.length).toBe(1);
  });
});

describe('AuthenticatedShell — pending disabilita Disconnetti', () => {
  it('signOutPending={true} ⇒ il bottone è disabled', () => {
    const markup = renderToStaticMarkup(
      <AuthenticatedShell onSignOut={NOOP} signOutPending={true} />,
    );
    const buttonTag = markup.slice(
      markup.indexOf('<button'),
      markup.indexOf('>', markup.indexOf('<button')) + 1,
    );
    expect(buttonTag).toContain('disabled');
  });

  it('signOutPending={false} ⇒ il bottone NON è disabled', () => {
    const markup = renderToStaticMarkup(
      <AuthenticatedShell onSignOut={NOOP} signOutPending={false} />,
    );
    const buttonTag = markup.slice(
      markup.indexOf('<button'),
      markup.indexOf('>', markup.indexOf('<button')) + 1,
    );
    expect(buttonTag).not.toContain('disabled');
  });
});
