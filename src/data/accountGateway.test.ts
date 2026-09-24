import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  accountDeletionResultFromInvoke,
  createSupabaseAccountGateway,
} from './accountGateway';

// Righe della I/O & Edge-Case Matrix per l'adattatore AccountGateway (storia
// 1.10). Il client Supabase è FINTO: `functions.invoke('delete-account')` è
// verificato per FORMA della chiamata (nome della funzione) e per ESITO
// (ok/errore/throw), senza rete né funzione reale. L'effetto sul progetto reale
// è verifica live differita (operatore). Confine TOTALE: `deleteAccount` non
// rifiuta mai.

/** Registra le chiamate a `functions.invoke` per l'ispezione. */
interface InvokeCall {
  readonly name: string;
}

interface FakeClientOptions {
  /** Errore ritornato da `functions.invoke` (assente ⇒ successo). */
  readonly invokeError?: unknown;
  /** Se true, `functions.invoke` lancia (throw SDK). */
  readonly invokeThrows?: boolean;
}

/** Costruisce un finto SupabaseClient minimale + lo spione delle chiamate. */
function makeFakeClient(options: FakeClientOptions = {}): {
  client: SupabaseClient;
  invokes: InvokeCall[];
} {
  const invokes: InvokeCall[] = [];

  const fake = {
    functions: {
      invoke: async (name: string) => {
        invokes.push({ name });
        if (options.invokeThrows) throw new Error('sdk down');
        return { data: null, error: options.invokeError ?? null };
      },
    },
  };

  return { client: fake as unknown as SupabaseClient, invokes };
}

describe('accountDeletionResultFromInvoke — mappa pura dell’esito di invoke', () => {
  it('nessun errore (null) ⇒ { ok: true }', () => {
    expect(accountDeletionResultFromInvoke(null)).toEqual({ ok: true });
  });

  it('nessun errore (undefined) ⇒ { ok: true }', () => {
    expect(accountDeletionResultFromInvoke(undefined)).toEqual({ ok: true });
  });

  it('errore presente ⇒ { ok: false, reason: "unknown" }', () => {
    expect(
      accountDeletionResultFromInvoke({ message: 'non-2xx' }),
    ).toEqual({ ok: false, reason: 'unknown' });
  });

  it('errore truthy generico (stringa) ⇒ { ok: false, reason: "unknown" }', () => {
    expect(accountDeletionResultFromInvoke('boom')).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
});

describe('deleteAccount — invoca la sola Edge Function delete-account', () => {
  it('invoke ok ⇒ { ok: true }; invoca "delete-account"', async () => {
    const { client, invokes } = makeFakeClient({ invokeError: null });
    const gateway = createSupabaseAccountGateway(client);

    await expect(gateway.deleteAccount()).resolves.toEqual({ ok: true });
    expect(invokes).toHaveLength(1);
    expect(invokes[0]?.name).toBe('delete-account');
  });

  it('invoke con errore ⇒ { ok: false, reason: "unknown" } (errore non propagato)', async () => {
    const { client } = makeFakeClient({ invokeError: { message: 'fail' } });
    const gateway = createSupabaseAccountGateway(client);

    await expect(gateway.deleteAccount()).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('throw dell’SDK su invoke ⇒ { ok: false, reason: "unknown" } (confine totale)', async () => {
    const { client } = makeFakeClient({ invokeThrows: true });
    const gateway = createSupabaseAccountGateway(client);

    await expect(gateway.deleteAccount()).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
});
