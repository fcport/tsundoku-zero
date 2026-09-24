import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseSettingsRepository } from './settingsRepository';

// Righe della I/O & Edge-Case Matrix per l'adattatore SettingsRepository (storia
// 1.9). Il client Supabase è FINTO: l'upsert diretto (mai RPC) e la lettura RLS
// sono verificati per FORMA della chiamata, senza rete né DB reale. L'effetto sul
// DB reale è verifica live differita (operatore). Confine TOTALE: nessun metodo
// rifiuta mai.

/** Registra le chiamate a `.from().upsert()` per l'ispezione. */
interface UpsertCall {
  readonly table: string;
  readonly values: unknown;
}

interface FakeClientOptions {
  /** Il valore di `getSession()`; assente ⇒ nessuna sessione. */
  readonly userId?: string | undefined;
  /** Se true, `getSession` lancia (throw SDK). */
  readonly getSessionThrows?: boolean;
  /** Riga ritornata da `select().maybeSingle()`. */
  readonly row?: { locale: unknown } | null;
  /** Errore ritornato da `select().maybeSingle()`. */
  readonly selectError?: unknown;
  /** Se true, `.from()` lancia (throw SDK) sulla lettura/scrittura. */
  readonly fromThrows?: boolean;
}

/** Costruisce un finto SupabaseClient minimale + gli spione delle chiamate. */
function makeFakeClient(options: FakeClientOptions = {}): {
  client: SupabaseClient;
  upserts: UpsertCall[];
} {
  const upserts: UpsertCall[] = [];

  const fake = {
    auth: {
      getSession: async () => {
        if (options.getSessionThrows) throw new Error('sdk down');
        return {
          data: {
            session: options.userId
              ? { user: { id: options.userId } }
              : null,
          },
        };
      },
    },
    from(table: string) {
      if (options.fromThrows) throw new Error('sdk down');
      return {
        upsert: async (values: unknown) => {
          upserts.push({ table, values });
          return { error: null };
        },
        select: () => ({
          maybeSingle: async () => ({
            data: options.row ?? null,
            error: options.selectError ?? null,
          }),
        }),
      };
    },
  };

  return { client: fake as unknown as SupabaseClient, upserts };
}

describe('saveLocale — upsert diretto su user_settings (mai RPC)', () => {
  it("sessione con user.id + 'it' ⇒ upsert({ user_id, locale: 'it' })", async () => {
    const { client, upserts } = makeFakeClient({ userId: 'user-1' });
    const repo = createSupabaseSettingsRepository(client);

    await repo.saveLocale('it');

    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.table).toBe('user_settings');
    expect(upserts[0]?.values).toEqual({ user_id: 'user-1', locale: 'it' });
  });

  it('nessuna sessione ⇒ no-op (nessun upsert)', async () => {
    const { client, upserts } = makeFakeClient({ userId: undefined });
    const repo = createSupabaseSettingsRepository(client);

    await repo.saveLocale('it');

    expect(upserts).toHaveLength(0);
  });

  it('throw dell’SDK su getSession ⇒ risolve void, non rifiuta (confine totale)', async () => {
    const { client, upserts } = makeFakeClient({ getSessionThrows: true });
    const repo = createSupabaseSettingsRepository(client);

    await expect(repo.saveLocale('it')).resolves.toBeUndefined();
    expect(upserts).toHaveLength(0);
  });

  it('throw dell’SDK su from ⇒ risolve void, non rifiuta (confine totale)', async () => {
    const { client } = makeFakeClient({ userId: 'user-1', fromThrows: true });
    const repo = createSupabaseSettingsRepository(client);

    await expect(repo.saveLocale('it')).resolves.toBeUndefined();
  });
});

describe('loadLocale — select().maybeSingle() con RLS sulla riga propria', () => {
  it("riga presente ⇒ ritorna la stringa locale ('it')", async () => {
    const { client } = makeFakeClient({ row: { locale: 'it' } });
    const repo = createSupabaseSettingsRepository(client);

    await expect(repo.loadLocale()).resolves.toBe('it');
  });

  it('riga assente (null) ⇒ null', async () => {
    const { client } = makeFakeClient({ row: null });
    const repo = createSupabaseSettingsRepository(client);

    await expect(repo.loadLocale()).resolves.toBeNull();
  });

  it('errore sulla select ⇒ null', async () => {
    const { client } = makeFakeClient({
      row: { locale: 'it' },
      selectError: { message: 'rls denied' },
    });
    const repo = createSupabaseSettingsRepository(client);

    await expect(repo.loadLocale()).resolves.toBeNull();
  });

  it('valore locale non-stringa ⇒ null', async () => {
    const { client } = makeFakeClient({ row: { locale: 42 } });
    const repo = createSupabaseSettingsRepository(client);

    await expect(repo.loadLocale()).resolves.toBeNull();
  });

  it('throw dell’SDK su from ⇒ null (confine totale)', async () => {
    const { client } = makeFakeClient({ fromThrows: true });
    const repo = createSupabaseSettingsRepository(client);

    await expect(repo.loadLocale()).resolves.toBeNull();
  });
});
