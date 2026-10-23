import { describe, expect, it } from 'vitest';
import type { AuthGateway, AuthResult } from '../../domain/ports/authGateway';
import { submitGuest, submitSaveGuest } from './guest';

// La prova senza account (23-10-2026): entrare come ospite e salvare l'ospite in un
// account passano dalla stessa traduzione degli esiti di registrazione e accesso.

const INERT: AuthGateway = {
  signUp: async () => ({ ok: true }),
  signIn: async () => ({ ok: true }),
  signOut: async () => {},
  isAuthenticated: async () => false,
  currentUserId: async () => null,
  continueAsGuest: async () => ({ ok: true }),
  isGuest: async () => false,
  saveGuestAccount: async () => ({ ok: true }),
  onAuthStateChange: () => () => {},
};

const CREDS = { email: 'a@b.co', password: 'hunter2hunter2' };
const UNKNOWN = { ok: false, message: { key: 'auth.error.unknown', field: 'form' } };

describe('submitGuest — entrare senza account', () => {
  it('ospite creato ⇒ { ok: true }', async () => {
    await expect(submitGuest(INERT)).resolves.toEqual({ ok: true });
  });

  it('accesso anonimo spento o rifiutato ⇒ messaggio generico, non rifiuta', async () => {
    const off: AuthGateway = {
      ...INERT,
      continueAsGuest: async (): Promise<AuthResult> => ({ ok: false, reason: 'unknown' }),
    };
    await expect(submitGuest(off)).resolves.toEqual(UNKNOWN);
  });

  it('porta che lancia ⇒ messaggio generico, non rifiuta', async () => {
    const throwing: AuthGateway = {
      ...INERT,
      continueAsGuest: () => {
        throw new Error('boom');
      },
    };
    await expect(submitGuest(throwing)).resolves.toEqual(UNKNOWN);
  });
});

describe('submitSaveGuest — tenere i progressi in un account', () => {
  it('inoltra le credenziali alla porta e risolve ok', async () => {
    let received: unknown = null;
    const gateway: AuthGateway = {
      ...INERT,
      saveGuestAccount: async (credentials) => {
        received = credentials;
        return { ok: true };
      },
    };
    await expect(submitSaveGuest(gateway, CREDS)).resolves.toEqual({ ok: true });
    expect(received).toEqual(CREDS);
  });

  it('email già registrata ⇒ messaggio accanto al campo email', async () => {
    const taken: AuthGateway = {
      ...INERT,
      saveGuestAccount: async () => ({ ok: false, reason: 'email-already-registered' }),
    };
    await expect(submitSaveGuest(taken, CREDS)).resolves.toEqual({
      ok: false,
      message: { key: 'auth.error.emailAlreadyRegistered', field: 'email' },
    });
  });

  it('password debole ⇒ messaggio accanto al campo password', async () => {
    const weak: AuthGateway = {
      ...INERT,
      saveGuestAccount: async () => ({ ok: false, reason: 'weak-password' }),
    };
    await expect(submitSaveGuest(weak, CREDS)).resolves.toEqual({
      ok: false,
      message: { key: 'auth.error.weakPassword', field: 'password' },
    });
  });

  it('porta che rifiuta ⇒ messaggio generico, non rifiuta', async () => {
    const rejecting: AuthGateway = {
      ...INERT,
      saveGuestAccount: () => Promise.reject(new Error('network')),
    };
    await expect(submitSaveGuest(rejecting, CREDS)).resolves.toEqual(UNKNOWN);
  });
});
