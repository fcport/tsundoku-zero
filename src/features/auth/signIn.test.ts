import { describe, expect, it } from 'vitest';
import type {
  AuthGateway,
  SignInResult,
} from '../../domain/ports/authGateway';
import { submitSignIn } from './signIn';

// Righe della I/O Matrix per l'orchestrazione dell'accesso (storia 1.7):
// submitSignIn è il gemello totale di submitSignUp sulla porta `signIn`. Un
// finto gateway iniettato restituisce un SignInResult fissato; submitSignIn lo
// traduce riusando l'unico traduttore.

// La porta cresce con metodi RICHIESTI: ogni finto è reso COMPLETO con stub
// inerti dei metodi non esercitati, oltre a quello sotto test.
const INERT: Omit<AuthGateway, 'signIn'> = {
  signUp: async () => ({ ok: true }),
  signOut: async () => {},
  isAuthenticated: async () => false,
  currentUserId: async () => null,
  onAuthStateChange: () => () => {},
};

/** Finto gateway: `signIn` ritorna sempre il `result` dato. */
function fakeGateway(result: SignInResult): AuthGateway {
  return { ...INERT, signIn: () => Promise.resolve(result) };
}

const CREDS = { email: 'a@b.co', password: 'hunter2hunter2' };

describe('submitSignIn — gateway iniettato ⇒ esito tradotto', () => {
  it('accesso valido ⇒ { ok: true }', async () => {
    const outcome = await submitSignIn(fakeGateway({ ok: true }), CREDS);
    expect(outcome).toEqual({ ok: true });
  });

  it('password errata ⇒ "Password errata." ancorata al campo password', async () => {
    const outcome = await submitSignIn(
      fakeGateway({ ok: false, reason: 'wrong-password' }),
      CREDS,
    );
    expect(outcome).toEqual({
      ok: false,
      message: { key: 'auth.error.wrongPassword', field: 'password' },
    });
  });

  it('email inesistente ⇒ STESSO messaggio della password errata (non rivela l\'email)', async () => {
    // Il reason wrong-password copre entrambi i casi (invalid_credentials): il
    // messaggio è identico, l'esistenza dell'email non è rivelata (AC2).
    const wrongPw = await submitSignIn(
      fakeGateway({ ok: false, reason: 'wrong-password' }),
      CREDS,
    );
    const noEmail = await submitSignIn(
      fakeGateway({ ok: false, reason: 'wrong-password' }),
      { email: 'ghost@b.co', password: 'hunter2hunter2' },
    );
    expect(noEmail).toEqual(wrongPw);
  });

  it('gateway signIn che LANCIA ⇒ risolve a unknown (form), non rifiuta', async () => {
    const throwing: AuthGateway = {
      ...INERT,
      signIn: () => Promise.reject(new Error('network')),
    };
    const outcome = await submitSignIn(throwing, CREDS);
    expect(outcome).toEqual({
      ok: false,
      message: { key: 'auth.error.unknown', field: 'form' },
    });
  });

  it('gateway signIn che lancia in modo sincrono ⇒ risolve a unknown, non rifiuta', async () => {
    const throwing: AuthGateway = {
      ...INERT,
      signIn: () => {
        throw new Error('boom');
      },
    };
    const outcome = await submitSignIn(throwing, CREDS);
    expect(outcome).toEqual({
      ok: false,
      message: { key: 'auth.error.unknown', field: 'form' },
    });
  });
});
