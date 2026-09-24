import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { AppRoutes } from './AppRoutes';
import type { AuthGateway } from '../domain/ports/authGateway';
import type { SettingsRepository } from '../domain/ports/settingsRepository';

// Righe di route-matching della I/O Matrix (storia 1.8). Il route-matching è
// SINCRONO (nessun effetto): renderToStaticMarkup NON esegue useEffect, quindi
// <Navigate> rende null in SSR. Perciò l'asserzione è per ASSENZA/PRESENZA del
// contenuto raggiunto, che cattura esattamente la decisione del guard senza
// jsdom. Ambiente node. La navigazione reale del browser è verifica live differita.

// Il gateway è passato solo ad AuthScreen e non è invocato senza submit: un
// finto inerte COMPLETO (schema di 1.7) soddisfa il tipo della porta.
const inertGateway: AuthGateway = {
  signUp: async () => ({ ok: true }),
  signIn: async () => ({ ok: true }),
  signOut: async () => {},
  isAuthenticated: async () => false,
  onAuthStateChange: () => () => {},
};
// Porta finta inerte (nuova prop 1.9): non invocata durante la resa server.
const inertSettings: SettingsRepository = {
  loadLocale: async () => null,
  saveLocale: async () => {},
};
const NOOP = () => {};

function renderAt(path: string, authenticated: boolean): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes
        authenticated={authenticated}
        gateway={inertGateway}
        settings={inertSettings}
        onAuthenticated={NOOP}
        onSignOut={NOOP}
        signOutPending={false}
      />
    </MemoryRouter>,
  );
}

describe('AppRoutes — radice protetta, autenticato', () => {
  const markup = renderAt('/', true);

  it('rende AuthenticatedShell: branding lang="ja" 積ん読ゼロ + tagline + Disconnetti', () => {
    expect(markup).toMatch(/lang="ja"[^>]*>積ん読ゼロ/);
    expect(markup).toContain(en.app.tagline);
    expect(markup).toContain(en.auth.signOut);
  });

  it('NON rende il form', () => {
    expect(markup).not.toContain('id="auth-email"');
    expect(markup).not.toContain('id="auth-password"');
  });

  it('ha un solo landmark <main> (nessun <main> annidato)', () => {
    // Il <App/> dentro AuthenticatedShell fornisce l'UNICO <main>; l'<header>
    // con Disconnetti non deve aggiungerne un secondo. Invariante ripristinata
    // dall'AuthGate.test eliminato.
    const opens = markup.match(/<main/g) ?? [];
    expect(opens.length).toBe(1);
  });
});

describe('AppRoutes — deep link protetto, autenticato', () => {
  const markup = renderAt('/dashboard', true);

  it('rende la radice protetta minima (branding)', () => {
    expect(markup).toMatch(/lang="ja"[^>]*>積ん読ゼロ/);
    expect(markup).toContain(en.auth.signOut);
  });
});

describe('AppRoutes — radice protetta, anonimo', () => {
  const markup = renderAt('/', false);

  it('il guard blocca: né branding né Disconnetti (Navigate→null in SSR)', () => {
    expect(markup).not.toContain('積ん読ゼロ');
    expect(markup).not.toContain(en.app.tagline);
    expect(markup).not.toContain(en.auth.signOut);
  });
});

describe('AppRoutes — deep link protetto, anonimo', () => {
  const markup = renderAt('/statistiche', false);

  it('il guard blocca: nessun branding', () => {
    expect(markup).not.toContain('積ん読ゼロ');
    expect(markup).not.toContain(en.auth.signOut);
  });
});

describe('AppRoutes — rotta di Accesso, anonimo', () => {
  const markup = renderAt('/login', false);

  it('rende il form (id="auth-email", id="auth-password")', () => {
    expect(markup).toContain('id="auth-email"');
    expect(markup).toContain('id="auth-password"');
    expect(markup).toContain(en.auth.submit);
  });

  it('ha un solo landmark <main> (nessun <main> annidato)', () => {
    // AuthScreen fornisce l'UNICO <main> (non riusa <App/>): esattamente uno.
    // Invariante ripristinata dall'AuthGate.test eliminato.
    const opens = markup.match(/<main/g) ?? [];
    expect(opens.length).toBe(1);
  });
});

describe('AppRoutes — rotta di Accesso, autenticato', () => {
  const markup = renderAt('/login', true);

  it('NON rende il form (rediretto; Navigate→null in SSR)', () => {
    expect(markup).not.toContain('id="auth-email"');
    expect(markup).not.toContain('id="auth-password"');
    expect(markup).not.toContain(en.auth.submit);
  });
});
