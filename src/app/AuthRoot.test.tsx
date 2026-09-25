import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { AuthRoot } from './AuthRoot';
import type { AuthGateway } from '../domain/ports/authGateway';
import type { SettingsRepository } from '../domain/ports/settingsRepository';
import type { AccountGateway } from '../domain/ports/accountGateway';
import type { Ports } from '../features/ports/PortsContext';

// Riga della I/O Matrix per la resa INIZIALE (storia 1.7): finché lo stato di
// sessione è indeterminato (`checking`), AuthRoot rende un PLACEHOLDER NEUTRO —
// né il form né la shell — così una sessione persistita non fa lampeggiare il
// form (AC3). La resa server (renderToStaticMarkup) non esegue useEffect, quindi
// cattura esattamente lo stato `checking` iniziale. La glue useEffect (boot +
// subscription) è coperta dalla e2e live differita.

// Finto inerte COMPLETO: nessun metodo è invocato durante la resa server.
const inertGateway: AuthGateway = {
  signUp: async () => ({ ok: true }),
  signIn: async () => ({ ok: true }),
  signOut: async () => {},
  isAuthenticated: async () => false,
  currentUserId: async () => null,
  onAuthStateChange: () => () => {},
};

// Porta finta inerte (nuova prop 1.9): non invocata durante la resa server
// (loadLocale/saveLocale vivono nella glue useEffect, non eseguita da SSR).
const inertSettings: SettingsRepository = {
  loadLocale: async () => null,
  saveLocale: async () => {},
};
// Porta finta inerte (nuova prop 1.10): deleteAccount non è invocata da SSR.
const inertAccount: AccountGateway = {
  deleteAccount: async () => ({ ok: true }),
};

// Porte del ciclo inerti (nuova prop 3.12): non consumate durante la resa server
// (lo stato `checking` rende un placeholder, mai il PortsProvider/la dashboard).
const inertPorts: Ports = {
  clock: { now: () => new Date(), timeZone: () => 'UTC' },
  review: { listDue: async () => [], listReviewLog: async () => [] },
  progress: { listUnlockedLessonIds: async () => [] },
  content: { listLessons: async () => [] },
};

describe('AuthRoot — resa iniziale `checking` (placeholder neutro)', () => {
  const markup = renderToStaticMarkup(
    <AuthRoot
      gateway={inertGateway}
      settings={inertSettings}
      account={inertAccount}
      ports={inertPorts}
    />,
  );

  it('NON rende il form di autenticazione (niente flash)', () => {
    expect(markup).not.toContain('id="auth-email"');
    expect(markup).not.toContain('id="auth-password"');
    expect(markup).not.toContain(en.auth.submit);
    expect(markup).not.toContain(en.auth.signInSubmit);
  });

  it('NON rende la shell autenticata (né branding né Disconnetti)', () => {
    expect(markup).not.toContain('積ん読ゼロ');
    expect(markup).not.toContain(en.app.tagline);
    expect(markup).not.toContain(en.auth.signOut);
  });
});
