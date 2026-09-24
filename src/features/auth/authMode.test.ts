import { describe, expect, it } from 'vitest';
import { AUTH_MODE_COPY, submitForMode } from './authMode';
import { submitSignUp } from './signUp';
import { submitSignIn } from './signIn';

// Il wiring modo→orchestratore e modo→chiavi di vista (storia 1.7): è QUESTA
// selezione a far sì che l'accesso invochi davvero `signIn`. Estratta nel modulo
// puro authMode, qui è verificata per riferimento — invertire il ternario
// romperebbe questi test.

describe('submitForMode — selezione dell\'orchestratore per modo', () => {
  it('sign-in ⇒ submitSignIn (uguaglianza per riferimento)', () => {
    expect(submitForMode('sign-in')).toBe(submitSignIn);
  });

  it('sign-up ⇒ submitSignUp (uguaglianza per riferimento)', () => {
    expect(submitForMode('sign-up')).toBe(submitSignUp);
  });
});

describe('AUTH_MODE_COPY — chiavi di vista e bersaglio del toggle per modo', () => {
  it('sign-up mappa alle chiavi di registrazione', () => {
    expect(AUTH_MODE_COPY['sign-up']).toEqual({
      titleKey: 'auth.title',
      submitKey: 'auth.submit',
      toggleKey: 'auth.switchToSignIn',
      toggleTo: 'sign-in',
    });
  });

  it('sign-in mappa alle chiavi di accesso', () => {
    expect(AUTH_MODE_COPY['sign-in']).toEqual({
      titleKey: 'auth.signInTitle',
      submitKey: 'auth.signInSubmit',
      toggleKey: 'auth.switchToSignUp',
      toggleTo: 'sign-up',
    });
  });

  it('toggleTo è l\'ALTRO modo per ciascuno', () => {
    expect(AUTH_MODE_COPY['sign-up'].toggleTo).toBe('sign-in');
    expect(AUTH_MODE_COPY['sign-in'].toggleTo).toBe('sign-up');
  });
});
