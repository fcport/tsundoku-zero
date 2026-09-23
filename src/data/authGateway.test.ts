import { describe, expect, it } from 'vitest';
import {
  classifySignUpError,
  signUpResultFromResponse,
} from './authGateway';

// Righe della I/O Matrix per l'adattatore (storia 1.6): le funzioni PURE si
// esercitano senza client reale né rete, con letterali che imitano la forma
// della risposta di Supabase (solo `code` sull'errore, solo `session` sui dati).

describe('classifySignUpError — code Supabase ⇒ reason di dominio', () => {
  it('user_already_exists ⇒ email-already-registered', () => {
    expect(classifySignUpError({ code: 'user_already_exists' })).toBe(
      'email-already-registered',
    );
  });

  it('email_exists ⇒ email-already-registered', () => {
    expect(classifySignUpError({ code: 'email_exists' })).toBe(
      'email-already-registered',
    );
  });

  it('weak_password ⇒ weak-password', () => {
    expect(classifySignUpError({ code: 'weak_password' })).toBe(
      'weak-password',
    );
  });

  it('validation_failed (email) ⇒ invalid-email', () => {
    expect(classifySignUpError({ code: 'validation_failed' })).toBe(
      'invalid-email',
    );
  });

  it('email_address_invalid ⇒ invalid-email', () => {
    expect(classifySignUpError({ code: 'email_address_invalid' })).toBe(
      'invalid-email',
    );
  });

  it('invalid_credentials ⇒ wrong-password', () => {
    expect(classifySignUpError({ code: 'invalid_credentials' })).toBe(
      'wrong-password',
    );
  });

  it('code sconosciuto ⇒ unknown', () => {
    expect(classifySignUpError({ code: 'over_request_rate_limit' })).toBe(
      'unknown',
    );
  });

  it('forma senza code (o non-oggetto) ⇒ unknown', () => {
    expect(classifySignUpError({})).toBe('unknown');
    expect(classifySignUpError({ message: 'boom' })).toBe('unknown');
    expect(classifySignUpError(null)).toBe('unknown');
    expect(classifySignUpError('boom')).toBe('unknown');
    expect(classifySignUpError({ code: 123 })).toBe('unknown');
  });
});

describe('signUpResultFromResponse — risposta Supabase ⇒ SignUpResult', () => {
  it('nessun errore + sessione presente ⇒ ok (atterra autenticato)', () => {
    expect(
      signUpResultFromResponse({
        data: { session: { access_token: 'a' } },
        error: null,
      }),
    ).toEqual({ ok: true });
  });

  it('nessun errore ma SESSIONE ASSENTE ⇒ unknown (dipendenza operatore)', () => {
    // Conferma email attiva ⇒ session:null ⇒ mai stato silente rotto.
    expect(
      signUpResultFromResponse({ data: { session: null }, error: null }),
    ).toEqual({ ok: false, reason: 'unknown' });
  });

  it('nessun errore ma data:null ⇒ unknown', () => {
    expect(signUpResultFromResponse({ data: null, error: null })).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('errore email già registrata ⇒ email-already-registered', () => {
    expect(
      signUpResultFromResponse({
        data: null,
        error: { code: 'user_already_exists' },
      }),
    ).toEqual({ ok: false, reason: 'email-already-registered' });
  });

  it('errore password debole ⇒ weak-password', () => {
    expect(
      signUpResultFromResponse({
        data: null,
        error: { code: 'weak_password' },
      }),
    ).toEqual({ ok: false, reason: 'weak-password' });
  });

  it('errore email non valida ⇒ invalid-email', () => {
    expect(
      signUpResultFromResponse({
        data: null,
        error: { code: 'validation_failed' },
      }),
    ).toEqual({ ok: false, reason: 'invalid-email' });
  });

  it('errore non classificato ⇒ unknown; il messaggio grezzo non è nel reason', () => {
    const result = signUpResultFromResponse({
      data: null,
      error: { code: 'wormhole_collapsed' },
    });
    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });
});
