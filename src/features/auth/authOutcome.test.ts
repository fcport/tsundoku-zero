import { describe, expect, it } from 'vitest';
import type { AuthErrorMessage } from './authFailureMessage';
import { applyAuthOutcome } from './authOutcome';

// Il DISPATCH puro dell'esito (AC1 wiring), CONDIVISO fra registrazione e
// accesso: successo ⇒ solo onAuthenticated; fallimento ⇒ solo onError con quel
// messaggio esatto. Spie a chiusura, nessuna dipendenza. Spostato da
// signUp.test.ts.

describe('applyAuthOutcome — dispatch dell\'esito verso gli handler', () => {
  it('{ ok:true } ⇒ chiama SOLO onAuthenticated', () => {
    let authenticatedCalls = 0;
    let errorCalls = 0;
    applyAuthOutcome(
      { ok: true },
      {
        onAuthenticated: () => {
          authenticatedCalls += 1;
        },
        onError: () => {
          errorCalls += 1;
        },
      },
    );
    expect(authenticatedCalls).toBe(1);
    expect(errorCalls).toBe(0);
  });

  it('{ ok:false, message } ⇒ chiama SOLO onError con quel messaggio', () => {
    const message: AuthErrorMessage = {
      key: 'auth.error.weakPassword',
      field: 'password',
    };
    let authenticatedCalls = 0;
    const received: AuthErrorMessage[] = [];
    applyAuthOutcome(
      { ok: false, message },
      {
        onAuthenticated: () => {
          authenticatedCalls += 1;
        },
        onError: (m) => received.push(m),
      },
    );
    expect(authenticatedCalls).toBe(0);
    expect(received).toEqual([message]);
  });
});
