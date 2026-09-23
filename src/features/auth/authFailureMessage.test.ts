import { describe, expect, it } from 'vitest';
import type { AuthFailureReason } from '../../domain/ports/authGateway';
import { authFailureMessage } from './authFailureMessage';

// Righe della I/O Matrix per l'unico traduttore (storia 1.6): ogni reason ⇒ una
// chiave i18n DEDICATA e DISTINTA + il campo responsabile corretto; `unknown`
// generico a livello form.

const ALL_REASONS: readonly AuthFailureReason[] = [
  'email-already-registered',
  'weak-password',
  'invalid-email',
  'wrong-password',
  'unknown',
];

describe('authFailureMessage — reason ⇒ { key, field }', () => {
  it('email già registrata ⇒ chiave dedicata, campo email', () => {
    expect(authFailureMessage('email-already-registered')).toEqual({
      key: 'auth.error.emailAlreadyRegistered',
      field: 'email',
    });
  });

  it('email non valida ⇒ chiave dedicata, campo email', () => {
    expect(authFailureMessage('invalid-email')).toEqual({
      key: 'auth.error.invalidEmail',
      field: 'email',
    });
  });

  it('password debole ⇒ chiave dedicata, campo password', () => {
    expect(authFailureMessage('weak-password')).toEqual({
      key: 'auth.error.weakPassword',
      field: 'password',
    });
  });

  it('password errata ⇒ chiave dedicata, campo password', () => {
    // wrong-password non è prodotto dal signup (lo produrrà l'accesso, 1.7),
    // ma il traduttore lo copre già: FR1.5/AC4 richiede tutti e quattro.
    expect(authFailureMessage('wrong-password')).toEqual({
      key: 'auth.error.wrongPassword',
      field: 'password',
    });
  });

  it('unknown ⇒ chiave generica a livello form', () => {
    expect(authFailureMessage('unknown')).toEqual({
      key: 'auth.error.unknown',
      field: 'form',
    });
  });

  it('ogni reason ha una chiave DISTINTA (nessuna riusata)', () => {
    const keys = ALL_REASONS.map((r) => authFailureMessage(r).key);
    expect(new Set(keys).size).toBe(ALL_REASONS.length);
  });

  it('i quattro fallimenti di FR1.5 hanno chiavi dedicate e campo non-form', () => {
    const fr15: readonly AuthFailureReason[] = [
      'email-already-registered',
      'weak-password',
      'invalid-email',
      'wrong-password',
    ];
    for (const reason of fr15) {
      const { field } = authFailureMessage(reason);
      expect(field === 'email' || field === 'password').toBe(true);
    }
  });
});
