import { describe, expect, it } from 'vitest';
import type {
  AuthFailureReason,
  AuthGateway,
  SignUpResult,
} from '../../domain/ports/authGateway';
import type { AuthErrorKey, AuthErrorMessage } from './authFailureMessage';
import { applySignUpOutcome, submitSignUp } from './signUp';

// Righe della I/O Matrix per l'orchestrazione (storia 1.6): un finto gateway
// iniettato restituisce un SignUpResult fissato; submitSignUp lo traduce.

/** Finto gateway: ritorna sempre il `result` dato, ignora le credenziali. */
function fakeGateway(result: SignUpResult): AuthGateway {
  return { signUp: () => Promise.resolve(result) };
}

const CREDS = { email: 'a@b.co', password: 'hunter2hunter2' };

const KNOWN_KEYS: readonly AuthErrorKey[] = [
  'auth.error.emailAlreadyRegistered',
  'auth.error.invalidEmail',
  'auth.error.weakPassword',
  'auth.error.wrongPassword',
  'auth.error.unknown',
];

describe('submitSignUp — gateway iniettato ⇒ esito tradotto', () => {
  it('gateway ok ⇒ { ok: true }', async () => {
    const outcome = await submitSignUp(fakeGateway({ ok: true }), CREDS);
    expect(outcome).toEqual({ ok: true });
  });

  it('email già registrata ⇒ messaggio ancorato al campo email', async () => {
    const outcome = await submitSignUp(
      fakeGateway({ ok: false, reason: 'email-already-registered' }),
      CREDS,
    );
    expect(outcome).toEqual({
      ok: false,
      message: { key: 'auth.error.emailAlreadyRegistered', field: 'email' },
    });
  });

  it('password debole ⇒ messaggio ancorato al campo password', async () => {
    const outcome = await submitSignUp(
      fakeGateway({ ok: false, reason: 'weak-password' }),
      CREDS,
    );
    expect(outcome).toEqual({
      ok: false,
      message: { key: 'auth.error.weakPassword', field: 'password' },
    });
  });

  it('email non valida ⇒ messaggio ancorato al campo email', async () => {
    const outcome = await submitSignUp(
      fakeGateway({ ok: false, reason: 'invalid-email' }),
      CREDS,
    );
    expect(outcome).toEqual({
      ok: false,
      message: { key: 'auth.error.invalidEmail', field: 'email' },
    });
  });

  it('unknown ⇒ messaggio generico a livello form', async () => {
    const outcome = await submitSignUp(
      fakeGateway({ ok: false, reason: 'unknown' }),
      CREDS,
    );
    expect(outcome).toEqual({
      ok: false,
      message: { key: 'auth.error.unknown', field: 'form' },
    });
  });

  it('per OGNI reason, message.key è fra le chiavi note', async () => {
    const reasons: readonly AuthFailureReason[] = [
      'email-already-registered',
      'weak-password',
      'invalid-email',
      'wrong-password',
      'unknown',
    ];
    for (const reason of reasons) {
      const outcome = await submitSignUp(
        fakeGateway({ ok: false, reason }),
        CREDS,
      );
      if (outcome.ok) throw new Error('atteso esito di fallimento');
      expect(KNOWN_KEYS).toContain(outcome.message.key);
    }
  });

  it('gateway che LANCIA ⇒ risolve a unknown (form), non rifiuta', async () => {
    // Rete caduta / errore imprevisto rilanciato da auth-js: il confine è
    // totale, submitSignUp non deve mai propagare un reject.
    const throwing: AuthGateway = {
      signUp: () => Promise.reject(new Error('network')),
    };
    const outcome = await submitSignUp(throwing, CREDS);
    expect(outcome).toEqual({
      ok: false,
      message: { key: 'auth.error.unknown', field: 'form' },
    });
  });

  it('gateway che lancia in modo sincrono ⇒ risolve a unknown, non rifiuta', async () => {
    const throwing: AuthGateway = {
      signUp: () => {
        throw new Error('boom');
      },
    };
    const outcome = await submitSignUp(throwing, CREDS);
    expect(outcome).toEqual({
      ok: false,
      message: { key: 'auth.error.unknown', field: 'form' },
    });
  });
});

// Il DISPATCH puro dell'esito (AC1 wiring): successo ⇒ solo onAuthenticated;
// fallimento ⇒ solo onError con quel messaggio esatto. Spie a chiusura, no dep.
describe('applySignUpOutcome — dispatch dell\'esito verso gli handler', () => {
  it('{ ok:true } ⇒ chiama SOLO onAuthenticated', () => {
    let authenticatedCalls = 0;
    let errorCalls = 0;
    applySignUpOutcome(
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
    applySignUpOutcome(
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
