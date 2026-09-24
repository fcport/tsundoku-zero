import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { AuthGate } from './AuthGate';
import type { AuthGateway } from '../domain/ports/authGateway';

// Righe della I/O Matrix per la commutazione di vista (storie 1.6/1.7): resa
// staticamente. Ambiente node, nessun jsdom.

// Il gateway non è invocato in questi test (nessun submit): un finto inerte
// COMPLETO soddisfa il tipo della porta (cresciuta con metodi richiesti in 1.7).
const inertGateway: AuthGateway = {
  signUp: async () => ({ ok: true }),
  signIn: async () => ({ ok: true }),
  signOut: async () => {},
  isAuthenticated: async () => false,
  onAuthStateChange: () => () => {},
};
const NOOP = () => {};

describe('AuthGate — autenticato ⇒ shell protetta (branding + Disconnetti)', () => {
  const markup = renderToStaticMarkup(
    <AuthGate
      authenticated={true}
      gateway={inertGateway}
      onAuthenticated={NOOP}
      onSignOut={NOOP}
      signOutPending={false}
    />,
  );

  it('rende il branding con lang="ja" e la tagline', () => {
    expect(markup).toMatch(/lang="ja"[^>]*>積ん読ゼロ/);
    expect(markup).toContain(en.app.tagline);
  });

  it('rende il bottone Disconnetti', () => {
    expect(markup).toContain(en.auth.signOut);
  });

  it('NON rende il form di autenticazione', () => {
    expect(markup).not.toContain('id="auth-email"');
    expect(markup).not.toContain('id="auth-password"');
    expect(markup).not.toContain(en.auth.submit);
  });
});

describe('AuthGate — non autenticato ⇒ schermata di Accesso', () => {
  const markup = renderToStaticMarkup(
    <AuthGate
      authenticated={false}
      gateway={inertGateway}
      onAuthenticated={NOOP}
      onSignOut={NOOP}
      signOutPending={false}
    />,
  );

  it('rende il form con i campi email e password', () => {
    expect(markup).toContain('id="auth-email"');
    expect(markup).toContain('id="auth-password"');
    expect(markup).toContain(en.auth.submit);
  });

  it('ha un solo landmark <main> (nessun <main> annidato)', () => {
    // AuthScreen NON riusa <App/> (che ha il proprio <main>): il branding vive
    // solo sulla radice protetta autenticata. Qui esattamente un <main>.
    const opens = markup.match(/<main/g) ?? [];
    expect(opens.length).toBe(1);
  });
});
