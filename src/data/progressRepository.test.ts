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
}

function makeFakeClient(options: FakeProgressOptions = {}): {
  client: SupabaseClient;
  calls: { table: string; columns: string };
} {
  const calls = { table: '', columns: '' };

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
  };

  return { client: fake as unknown as SupabaseClient, calls };
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
