import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  authResultFromResponse,
  classifyAuthError,
  authResultFromUserUpdate,
  createSupabaseAuthGateway,
  hasSession,
  isGuestSession,
} from './authGateway';

// Righe della I/O Matrix per l'adattatore (storie 1.6/1.7): le funzioni PURE si
// esercitano senza client reale né rete, con letterali che imitano la forma
// della risposta di Supabase (solo `code` sull'errore, solo `session` sui dati).
// Le mappe hanno nomi NEUTRI perché condivise fra registrazione e accesso.

describe('classifyAuthError — code Supabase ⇒ reason di dominio', () => {
  it('user_already_exists ⇒ email-already-registered', () => {
    expect(classifyAuthError({ code: 'user_already_exists' })).toBe(
      'email-already-registered',
    );
  });

  it('email_exists ⇒ email-already-registered', () => {
    expect(classifyAuthError({ code: 'email_exists' })).toBe(
      'email-already-registered',
    );
  });

  it('weak_password ⇒ weak-password', () => {
    expect(classifyAuthError({ code: 'weak_password' })).toBe('weak-password');
  });

  it('validation_failed (email) ⇒ invalid-email', () => {
    expect(classifyAuthError({ code: 'validation_failed' })).toBe(
      'invalid-email',
    );
  });

  it('email_address_invalid ⇒ invalid-email', () => {
    expect(classifyAuthError({ code: 'email_address_invalid' })).toBe(
      'invalid-email',
    );
  });

  it('invalid_credentials ⇒ wrong-password (accesso: password errata O email inesistente)', () => {
    // AC2 strutturale: password errata ed email inesistente collassano entrambe
    // su questo code, quindi sullo STESSO reason — l'esistenza dell'email non è
    // rivelata.
    expect(classifyAuthError({ code: 'invalid_credentials' })).toBe(
      'wrong-password',
    );
  });

  it('code sconosciuto ⇒ unknown', () => {
    expect(classifyAuthError({ code: 'over_request_rate_limit' })).toBe(
      'unknown',
    );
  });

  it('forma senza code (o non-oggetto) ⇒ unknown', () => {
    expect(classifyAuthError({})).toBe('unknown');
    expect(classifyAuthError({ message: 'boom' })).toBe('unknown');
    expect(classifyAuthError(null)).toBe('unknown');
    expect(classifyAuthError('boom')).toBe('unknown');
    expect(classifyAuthError({ code: 123 })).toBe('unknown');
  });
});

describe('authResultFromResponse — risposta Supabase ⇒ AuthResult', () => {
  it('nessun errore + sessione presente ⇒ ok (atterra autenticato)', () => {
    expect(
      authResultFromResponse({
        data: { session: { access_token: 'a' } },
        error: null,
      }),
    ).toEqual({ ok: true });
  });

  it('nessun errore ma SESSIONE ASSENTE ⇒ unknown (dipendenza operatore)', () => {
    // Conferma email attiva ⇒ session:null ⇒ mai stato silente rotto.
    expect(
      authResultFromResponse({ data: { session: null }, error: null }),
    ).toEqual({ ok: false, reason: 'unknown' });
  });

  it('nessun errore ma data:null ⇒ unknown', () => {
    expect(authResultFromResponse({ data: null, error: null })).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('errore email già registrata ⇒ email-already-registered', () => {
    expect(
      authResultFromResponse({
        data: null,
        error: { code: 'user_already_exists' },
      }),
    ).toEqual({ ok: false, reason: 'email-already-registered' });
  });

  it('errore password debole ⇒ weak-password', () => {
    expect(
      authResultFromResponse({
        data: null,
        error: { code: 'weak_password' },
      }),
    ).toEqual({ ok: false, reason: 'weak-password' });
  });

  it('errore email non valida ⇒ invalid-email', () => {
    expect(
      authResultFromResponse({
        data: null,
        error: { code: 'validation_failed' },
      }),
    ).toEqual({ ok: false, reason: 'invalid-email' });
  });

  it('errore credenziali non valide (accesso) ⇒ wrong-password; stesso esito per email inesistente', () => {
    // Riuso della mappa condivisa da parte dell'accesso: la stessa risposta di
    // signInWithPassword produce lo stesso AuthResult del signup.
    expect(
      authResultFromResponse({
        data: { session: null },
        error: { code: 'invalid_credentials' },
      }),
    ).toEqual({ ok: false, reason: 'wrong-password' });
  });

  it('errore non classificato ⇒ unknown; il messaggio grezzo non è nel reason', () => {
    const result = authResultFromResponse({
      data: null,
      error: { code: 'wormhole_collapsed' },
    });
    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });
});

describe('hasSession — session ⇒ boolean (mappa della subscription)', () => {
  it('sessione presente ⇒ true', () => {
    expect(hasSession({ access_token: 'a' })).toBe(true);
  });

  it('null ⇒ false', () => {
    expect(hasSession(null)).toBe(false);
  });

  it('undefined ⇒ false', () => {
    expect(hasSession(undefined)).toBe(false);
  });
});

// Righe della I/O Matrix per `currentUserId` (storia 3.12): il client è FINTO —
// solo `auth.getSession` è invocato. Sessione con `user.id` ⇒ id; nessuna
// sessione o SDK che lancia ⇒ `null` (confine TOTALE, mai reject).
interface FakeSessionOptions {
  /** Valore di `data.session` ritornato da getSession (o `null`). */
  readonly session?: unknown;
  /** Se true, getSession LANCIA (imita un throw dell'SDK). */
  readonly throws?: boolean;
}

function makeSessionClient(options: FakeSessionOptions = {}): SupabaseClient {
  const fake = {
    auth: {
      getSession: async () => {
        if (options.throws) throw new Error('boom');
        return { data: { session: options.session ?? null }, error: null };
      },
    },
  };
  return fake as unknown as SupabaseClient;
}

describe('currentUserId — id dell utente o null (confine totale, 3.12)', () => {
  it('sessione con user.id ⇒ ritorna l id (stringa)', async () => {
    const gateway = createSupabaseAuthGateway(
      makeSessionClient({ session: { user: { id: 'user-42' } } }),
    );
    await expect(gateway.currentUserId()).resolves.toBe('user-42');
  });

  it('nessuna sessione ⇒ null', async () => {
    const gateway = createSupabaseAuthGateway(makeSessionClient({ session: null }));
    await expect(gateway.currentUserId()).resolves.toBeNull();
  });

  it('SDK che lancia ⇒ null (non rifiuta)', async () => {
    const gateway = createSupabaseAuthGateway(makeSessionClient({ throws: true }));
    await expect(gateway.currentUserId()).resolves.toBeNull();
  });
});

// La prova senza account (23-10-2026): l'ospite è un utente anonimo di Supabase; il
// salvataggio passa email e password in UNA chiamata a `updateUser`.
describe('isGuestSession — sessione ⇒ ospite?', () => {
  it('user.is_anonymous true ⇒ ospite', () => {
    expect(isGuestSession({ user: { id: 'u', is_anonymous: true } })).toBe(true);
  });

  it('user.is_anonymous false o assente ⇒ non ospite', () => {
    expect(isGuestSession({ user: { id: 'u', is_anonymous: false } })).toBe(false);
    expect(isGuestSession({ user: { id: 'u' } })).toBe(false);
  });

  it('sessione o utente assenti ⇒ non ospite', () => {
    expect(isGuestSession(null)).toBe(false);
    expect(isGuestSession({})).toBe(false);
    expect(isGuestSession('boom')).toBe(false);
  });
});

describe('authResultFromUserUpdate — risposta di updateUser ⇒ AuthResult', () => {
  it('utente restituito ⇒ ok', () => {
    expect(authResultFromUserUpdate({ data: { user: { id: 'u' } }, error: null })).toEqual({
      ok: true,
    });
  });

  it('email già usata ⇒ email-already-registered', () => {
    expect(
      authResultFromUserUpdate({ data: { user: null }, error: { code: 'email_exists' } }),
    ).toEqual({ ok: false, reason: 'email-already-registered' });
  });

  it('nessun errore ma nessun utente ⇒ unknown', () => {
    expect(authResultFromUserUpdate({ data: null, error: null })).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
});

describe('createSupabaseAuthGateway — ospite (client finto)', () => {
  it('continueAsGuest chiama signInAnonymously; sessione ⇒ ok', async () => {
    const fake = {
      auth: {
        signInAnonymously: async () => ({ data: { session: { access_token: 'a' } }, error: null }),
      },
    };
    const gateway = createSupabaseAuthGateway(fake as unknown as SupabaseClient);
    await expect(gateway.continueAsGuest()).resolves.toEqual({ ok: true });
  });

  it('continueAsGuest con accesso anonimo spento ⇒ unknown', async () => {
    const fake = {
      auth: {
        signInAnonymously: async () => ({
          data: { session: null },
          error: { code: 'anonymous_provider_disabled' },
        }),
      },
    };
    const gateway = createSupabaseAuthGateway(fake as unknown as SupabaseClient);
    await expect(gateway.continueAsGuest()).resolves.toEqual({ ok: false, reason: 'unknown' });
  });

  it('isGuest legge is_anonymous dalla sessione; SDK che lancia ⇒ false', async () => {
    const guest = createSupabaseAuthGateway(
      makeSessionClient({ session: { user: { id: 'u', is_anonymous: true } } }),
    );
    await expect(guest.isGuest()).resolves.toBe(true);
    const broken = createSupabaseAuthGateway(makeSessionClient({ throws: true }));
    await expect(broken.isGuest()).resolves.toBe(false);
  });

  it('saveGuestAccount passa email e password in UNA chiamata', async () => {
    const calls: unknown[] = [];
    const fake = {
      auth: {
        updateUser: async (attrs: unknown) => {
          calls.push(attrs);
          return { data: { user: { id: 'u', is_anonymous: false } }, error: null };
        },
      },
    };
    const gateway = createSupabaseAuthGateway(fake as unknown as SupabaseClient);
    await expect(
      gateway.saveGuestAccount({ email: 'a@b.co', password: 'hunter2hunter2' }),
    ).resolves.toEqual({ ok: true });
    expect(calls).toEqual([{ email: 'a@b.co', password: 'hunter2hunter2' }]);
  });

  it('saveGuestAccount con SDK che lancia ⇒ unknown, non rifiuta', async () => {
    const fake = {
      auth: {
        updateUser: async () => {
          throw new Error('network');
        },
      },
    };
    const gateway = createSupabaseAuthGateway(fake as unknown as SupabaseClient);
    await expect(
      gateway.saveGuestAccount({ email: 'a@b.co', password: 'hunter2hunter2' }),
    ).resolves.toEqual({ ok: false, reason: 'unknown' });
  });
});
