import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseProgressRepository } from './progressRepository';
import { DataError } from './dataError';

// Righe della I/O & Edge-Case Matrix per l'adattatore ProgressRepository. Il
// client Supabase è FINTO: la select di lesson_progress e la mappa in
// `readonly string[]` sono verificate senza rete né DB reale. LANCIA `DataError`
// su errore o riga malformata (alimenta TanStack Query — reject).

interface FakeProgressOptions {
  readonly rows?: readonly unknown[] | null;
  readonly error?: unknown;
  /** Errore ritornato dalla RPC `unlock_lesson` (assente ⇒ successo). */
  readonly rpcError?: unknown;
}

/** Registra la chiamata a `.rpc` per l'ispezione (mirror del fake invoke di accountGateway.test). */
interface RpcCall {
  readonly name: string;
  readonly params: unknown;
}

function makeFakeClient(options: FakeProgressOptions = {}): {
  client: SupabaseClient;
  calls: { table: string; columns: string };
  rpcs: RpcCall[];
} {
  const calls = { table: '', columns: '' };
  const rpcs: RpcCall[] = [];

  const fake = {
    from(table: string) {
      calls.table = table;
      return {
        select: async (columns: string) => {
          calls.columns = columns;
          return {
            data: options.rows ?? null,
            error: options.error ?? null,
          };
        },
      };
    },
    rpc: async (name: string, params: unknown) => {
      rpcs.push({ name, params });
      return { data: null, error: options.rpcError ?? null };
    },
  };

  return { client: fake as unknown as SupabaseClient, calls, rpcs };
}

describe('listUnlockedLessonIds — happy path: ritorna gli id lezione', () => {
  it('mappa le righe nei loro lesson_id', async () => {
    const { client, calls } = makeFakeClient({
      rows: [{ lesson_id: 'te-form' }, { lesson_id: 'particle-wa' }],
    });
    const repo = createSupabaseProgressRepository(client);

    const ids = await repo.listUnlockedLessonIds();

    expect(calls.table).toBe('lesson_progress');
    expect(calls.columns).toBe('lesson_id');
    expect(ids).toEqual(['te-form', 'particle-wa']);
  });

  it('nessuna riga ⇒ array vuoto (nessuna lezione sbloccata)', async () => {
    const { client } = makeFakeClient({ rows: [] });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessonIds()).resolves.toEqual([]);
  });

  it('data null (nessuna riga, nessun errore) ⇒ array vuoto', async () => {
    const { client } = makeFakeClient({});
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessonIds()).resolves.toEqual([]);
  });
});

describe('listUnlockedLessonIds — fallimenti lanciano DataError (reject)', () => {
  it("errore Supabase ⇒ DataError('listUnlockedLessonIds') con causa preservata", async () => {
    const supabaseError = { message: 'rls denied', code: '42501' };
    const { client } = makeFakeClient({ error: supabaseError });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessonIds()).rejects.toBeInstanceOf(DataError);
    await expect(repo.listUnlockedLessonIds()).rejects.toMatchObject({
      operation: 'listUnlockedLessonIds',
      cause: supabaseError,
    });
  });

  it('riga malformata (lesson_id non stringa) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [{ lesson_id: 42 }] });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessonIds()).rejects.toBeInstanceOf(DataError);
  });

  it('riga null (elemento non-oggetto) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [null] });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessonIds()).rejects.toBeInstanceOf(DataError);
  });
});

describe('unlockLesson — SCRITTURA via RPC atomica/idempotente unlock_lesson (3.13)', () => {
  it('happy: invoca `unlock_lesson` con lesson_id e unlocked_at ISO; risolve void', async () => {
    const { client, rpcs } = makeFakeClient({});
    const repo = createSupabaseProgressRepository(client);
    const now = new Date('2026-09-25T12:34:56.000Z');

    await expect(repo.unlockLesson('te-form', now)).resolves.toBeUndefined();

    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]?.name).toBe('unlock_lesson');
    expect(rpcs[0]?.params).toEqual({
      lesson_id: 'te-form',
      unlocked_at: '2026-09-25T12:34:56.000Z',
    });
  });

  it("errore RPC ⇒ DataError('unlockLesson') con causa preservata (reject, non degrada)", async () => {
    const rpcError = { message: 'rls denied', code: '42501' };
    const { client } = makeFakeClient({ rpcError });
    const repo = createSupabaseProgressRepository(client);
    const now = new Date('2026-09-25T12:00:00.000Z');

    await expect(repo.unlockLesson('te-form', now)).rejects.toBeInstanceOf(
      DataError,
    );
    await expect(repo.unlockLesson('te-form', now)).rejects.toMatchObject({
      operation: 'unlockLesson',
      cause: rpcError,
    });
  });
});
