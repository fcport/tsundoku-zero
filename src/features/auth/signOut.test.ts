import { describe, expect, it } from 'vitest';
import type { AuthGateway } from '../../domain/ports/authGateway';
import { submitSignOut } from './signOut';

// Righe della I/O Matrix per la disconnessione (storia 1.7): submitSignOut chiama
// gateway.signOut() con confine TOTALE — risolve sempre `void`, mai reject.

// La porta cresce con metodi RICHIESTI: ogni finto è reso COMPLETO con stub
// inerti dei metodi non esercitati, oltre a `signOut` sotto test.
const INERT: Omit<AuthGateway, 'signOut'> = {
  signUp: async () => ({ ok: true }),
  signIn: async () => ({ ok: true }),
  isAuthenticated: async () => false,
  currentUserId: async () => null,
  onAuthStateChange: () => () => {},
};

describe('submitSignOut — confine totale sulla disconnessione', () => {
  it('signOut che risolve ⇒ submitSignOut risolve; signOut invocato', async () => {
    let calls = 0;
    const gateway: AuthGateway = {
      ...INERT,
      signOut: async () => {
        calls += 1;
      },
    };
    await expect(submitSignOut(gateway)).resolves.toBeUndefined();
    expect(calls).toBe(1);
  });

  it('signOut che rigetta ⇒ submitSignOut risolve comunque (void), non rifiuta', async () => {
    const gateway: AuthGateway = {
      ...INERT,
      signOut: () => Promise.reject(new Error('network')),
    };
    await expect(submitSignOut(gateway)).resolves.toBeUndefined();
  });

  it('signOut che lancia in modo sincrono ⇒ submitSignOut risolve, non rifiuta', async () => {
    const gateway: AuthGateway = {
      ...INERT,
      signOut: () => {
        throw new Error('boom');
      },
    };
    await expect(submitSignOut(gateway)).resolves.toBeUndefined();
  });
});
