import { describe, expect, it } from 'vitest';
import type { AccountGateway } from '../../domain/ports/accountGateway';
import { submitDeleteAccount } from './deleteAccount';

// Righe della I/O Matrix per l'orchestrazione della cancellazione (storia 1.10):
// submitDeleteAccount INOLTRA l'esito della porta con confine TOTALE — un throw
// del finto degrada a { ok:false, reason:'unknown' }, mai reject.

describe('submitDeleteAccount — inoltro dell’esito, confine totale', () => {
  it('gateway ok ⇒ inoltra { ok: true }', async () => {
    const account: AccountGateway = {
      deleteAccount: async () => ({ ok: true }),
    };
    await expect(submitDeleteAccount(account)).resolves.toEqual({ ok: true });
  });

  it('gateway fail ⇒ inoltra { ok: false, reason: "unknown" }', async () => {
    const account: AccountGateway = {
      deleteAccount: async () => ({ ok: false, reason: 'unknown' }),
    };
    await expect(submitDeleteAccount(account)).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('gateway invocato una sola volta', async () => {
    let calls = 0;
    const account: AccountGateway = {
      deleteAccount: async () => {
        calls += 1;
        return { ok: true };
      },
    };
    await submitDeleteAccount(account);
    expect(calls).toBe(1);
  });

  it('gateway che rigetta ⇒ { ok: false, reason: "unknown" } (non rifiuta)', async () => {
    const account: AccountGateway = {
      deleteAccount: () => Promise.reject(new Error('network')),
    };
    await expect(submitDeleteAccount(account)).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('gateway che lancia in modo sincrono ⇒ { ok: false, reason: "unknown" }', async () => {
    const account: AccountGateway = {
      deleteAccount: () => {
        throw new Error('boom');
      },
    };
    await expect(submitDeleteAccount(account)).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
});
