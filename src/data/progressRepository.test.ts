import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseProgressRepository } from './progressRepository';
import { DataError } from './dataError';

// Righe della I/O & Edge-Case Matrix per l'adattatore ProgressRepository. Il
// client Supabase è FINTO: la select di lesson_progress e la mappa in
// `readonly UnlockedLesson[]` (id + istante di sblocco, il read-model UNICO di
// 3.17) sono verificate senza rete né DB reale. LANCIA `DataError` su errore o
// riga malformata (alimenta TanStack Query — reject).

interface FakeProgressOptions {
  readonly rows?: readonly unknown[] | null;
  readonly error?: unknown;
  /** Errore ritornato dalla RPC `unlock_lesson` (assente ⇒ successo). */
  readonly rpcError?: unknown;
  /** Dati ritornati dalla RPC (assente ⇒ `null`, come `unlock_lesson` che è void). */
  readonly rpcData?: unknown;
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
      return { data: options.rpcData ?? null, error: options.rpcError ?? null };
    },
  };

  return { client: fake as unknown as SupabaseClient, calls, rpcs };
}

describe('listUnlockedLessons — happy path: ritorna id + istante di sblocco', () => {
  it('mappa le righe in { lessonId, unlockedAt } (unlocked_at parsato a Date)', async () => {
    const { client, calls } = makeFakeClient({
      rows: [
        { lesson_id: 'te-form', unlocked_at: '2026-09-24T10:00:00.000Z' },
        { lesson_id: 'particle-wa', unlocked_at: '2026-09-25T08:30:00.000Z' },
      ],
    });
    const repo = createSupabaseProgressRepository(client);

    const unlocked = await repo.listUnlockedLessons();

    expect(calls.table).toBe('lesson_progress');
    expect(calls.columns).toBe('lesson_id, unlocked_at');
    expect(unlocked).toEqual([
      { lessonId: 'te-form', unlockedAt: new Date('2026-09-24T10:00:00.000Z') },
      { lessonId: 'particle-wa', unlockedAt: new Date('2026-09-25T08:30:00.000Z') },
    ]);
  });

  it('nessuna riga ⇒ array vuoto (nessuna lezione sbloccata)', async () => {
    const { client } = makeFakeClient({ rows: [] });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessons()).resolves.toEqual([]);
  });

  it('data null (nessuna riga, nessun errore) ⇒ array vuoto', async () => {
    const { client } = makeFakeClient({});
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessons()).resolves.toEqual([]);
  });
});

describe('listUnlockedLessons — fallimenti lanciano DataError (reject)', () => {
  it("errore Supabase ⇒ DataError('listUnlockedLessons') con causa preservata", async () => {
    const supabaseError = { message: 'rls denied', code: '42501' };
    const { client } = makeFakeClient({ error: supabaseError });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessons()).rejects.toBeInstanceOf(DataError);
    await expect(repo.listUnlockedLessons()).rejects.toMatchObject({
      operation: 'listUnlockedLessons',
      cause: supabaseError,
    });
  });

  it('riga malformata (lesson_id non stringa) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [{ lesson_id: 42, unlocked_at: '2026-09-24T10:00:00.000Z' }],
    });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (unlocked_at assente) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [{ lesson_id: 'te-form' }] });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (unlocked_at non stringa) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [{ lesson_id: 'te-form', unlocked_at: 12345 }],
    });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (unlocked_at stringa non parsabile a Date) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [{ lesson_id: 'te-form', unlocked_at: 'non-una-data' }],
    });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga null (elemento non-oggetto) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [null] });
    const repo = createSupabaseProgressRepository(client);

    await expect(repo.listUnlockedLessons()).rejects.toBeInstanceOf(DataError);
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

describe('addLessonExercises — «Esercitati di più» via RPC add_lesson_exercises', () => {
  it('happy: invoca la RPC con lesson_id e added_at ISO e ritorna quanti ne ha aggiunti', async () => {
    const { client, rpcs } = makeFakeClient({ rpcData: 6 });
    const repo = createSupabaseProgressRepository(client);
    const now = new Date('2026-10-01T09:00:00.000Z');

    await expect(repo.addLessonExercises('te-form', now)).resolves.toBe(6);
    expect(rpcs[0]).toEqual({
      name: 'add_lesson_exercises',
      params: { lesson_id: 'te-form', added_at: '2026-10-01T09:00:00.000Z' },
    });
  });

  it("errore RPC o risposta non numerica ⇒ DataError('addLessonExercises')", async () => {
    const now = new Date('2026-10-01T09:00:00.000Z');
    const failing = createSupabaseProgressRepository(makeFakeClient({ rpcError: { message: 'x' } }).client);
    await expect(failing.addLessonExercises('te-form', now)).rejects.toMatchObject({
      operation: 'addLessonExercises',
    });
    const odd = createSupabaseProgressRepository(makeFakeClient({ rpcData: 'sei' }).client);
    await expect(odd.addLessonExercises('te-form', now)).rejects.toBeInstanceOf(DataError);
  });
});

describe('listActiveExerciseCounts — esercizi in pila per lezione via RPC active_exercise_counts', () => {
  it('happy: una voce per lezione', async () => {
    const { client, rpcs } = makeFakeClient({
      rpcData: [
        { lesson_id: 'a', active: 12 },
        { lesson_id: 'b', active: 18 },
      ],
    });
    const repo = createSupabaseProgressRepository(client);

    const counts = await repo.listActiveExerciseCounts();
    expect(rpcs[0]?.name).toBe('active_exercise_counts');
    expect([...counts]).toEqual([
      ['a', 12],
      ['b', 18],
    ]);
  });

  it("riga malformata o errore ⇒ DataError('listActiveExerciseCounts')", async () => {
    const bad = createSupabaseProgressRepository(
      makeFakeClient({ rpcData: [{ lesson_id: 'a', active: '12' }] }).client,
    );
    await expect(bad.listActiveExerciseCounts()).rejects.toMatchObject({
      operation: 'listActiveExerciseCounts',
    });
    const failing = createSupabaseProgressRepository(makeFakeClient({ rpcError: { message: 'x' } }).client);
    await expect(failing.listActiveExerciseCounts()).rejects.toBeInstanceOf(DataError);
  });
});
