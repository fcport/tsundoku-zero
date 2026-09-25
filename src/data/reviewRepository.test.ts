import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseReviewRepository } from './reviewRepository';
import { DataError } from './dataError';

// Righe della I/O & Edge-Case Matrix per l'adattatore ReviewRepository. Il client
// Supabase è FINTO: la select di review_state e la mappa in ReviewState sono
// verificate senza rete né DB reale. La dovutezza NON è reimplementata: l'adattatore
// FILTRA con `isDue(state, now)` di dominio (AD-5), quindi qui il mix di righe è AL
// CONFINE `<=` — la stessa inclusività di isDue. `now` è INIETTATO dal test.

interface FakeReviewOptions {
  /** Righe ritornate da `select()`. */
  readonly rows?: readonly unknown[] | null;
  /** Errore ritornato da `select()`. */
  readonly error?: unknown;
}

function makeFakeClient(options: FakeReviewOptions = {}): {
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

// Istante di riferimento iniettato (via Clock in produzione): tutte le scadenze
// del test sono relative a QUESTO now, così il confine `<=` di isDue è esplicito.
const NOW = new Date('2026-09-25T12:00:00.000Z');

describe('listDue — mappa in ReviewState e ritorna SOLO le dovute (isDue, AD-5)', () => {
  it('mix al confine: passato (dovuto), esattamente now (dovuto, <=), futuro (non dovuto)', async () => {
    const { client, calls } = makeFakeClient({
      rows: [
        // Passato ⇒ dovuto.
        {
          exercise_id: 'ex-past',
          stage: 2,
          due_at: '2026-09-24T12:00:00.000Z',
          review_count: 3,
          lapse_count: 1,
          last_reviewed_at: '2026-09-23T12:00:00.000Z',
        },
        // Esattamente now ⇒ dovuto (confine INCLUSIVO <=).
        {
          exercise_id: 'ex-now',
          stage: 0,
          due_at: NOW.toISOString(),
          review_count: 0,
          lapse_count: 0,
          last_reviewed_at: null,
        },
        // Futuro (1 ms dopo now) ⇒ NON dovuto.
        {
          exercise_id: 'ex-future',
          stage: 1,
          due_at: new Date(NOW.getTime() + 1).toISOString(),
          review_count: 1,
          lapse_count: 0,
          last_reviewed_at: '2026-09-24T12:00:00.000Z',
        },
      ],
    });
    const repo = createSupabaseReviewRepository(client);

    const due = await repo.listDue(NOW);

    expect(calls.table).toBe('review_state');
    expect(calls.columns).toContain('due_at');

    // Solo le due dovute, nell'ordine di lettura; la futura è filtrata.
    expect(due.map((s) => s.exerciseId)).toEqual(['ex-past', 'ex-now']);

    // Mappa completa in ReviewState: due_at/last_reviewed_at → Date (null resta null).
    expect(due[0]).toEqual({
      exerciseId: 'ex-past',
      stage: 2,
      dueAt: new Date('2026-09-24T12:00:00.000Z'),
      reviewCount: 3,
      lapseCount: 1,
      lastReviewedAt: new Date('2026-09-23T12:00:00.000Z'),
    });
    expect(due[1]?.lastReviewedAt).toBeNull();
    expect(due[1]?.dueAt).toEqual(NOW);
  });

  it('nessuna riga dovuta ⇒ array vuoto', async () => {
    const { client } = makeFakeClient({
      rows: [
        {
          exercise_id: 'ex-future',
          stage: 1,
          due_at: new Date(NOW.getTime() + 60_000).toISOString(),
          review_count: 0,
          lapse_count: 0,
          last_reviewed_at: null,
        },
      ],
    });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW)).resolves.toEqual([]);
  });

  it('data null (nessuna riga, nessun errore) ⇒ array vuoto', async () => {
    const { client } = makeFakeClient({});
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW)).resolves.toEqual([]);
  });
});

describe('listDue — fallimenti lanciano DataError (reject)', () => {
  it("errore Supabase ⇒ DataError('listDue') con causa preservata", async () => {
    const supabaseError = { message: 'rls denied', code: '42501' };
    const { client } = makeFakeClient({ error: supabaseError });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW)).rejects.toBeInstanceOf(DataError);
    await expect(repo.listDue(NOW)).rejects.toMatchObject({
      operation: 'listDue',
      cause: supabaseError,
    });
  });

  it('riga malformata (due_at non stringa) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [
        {
          exercise_id: 'ex',
          stage: 0,
          due_at: 12345,
          review_count: 0,
          lapse_count: 0,
          last_reviewed_at: null,
        },
      ],
    });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW)).rejects.toBeInstanceOf(DataError);
  });

  it('due_at stringa NON parsabile ⇒ DataError (timestamp non valido)', async () => {
    const { client } = makeFakeClient({
      rows: [
        {
          exercise_id: 'ex',
          stage: 0,
          due_at: 'not-a-date',
          review_count: 0,
          lapse_count: 0,
          last_reviewed_at: null,
        },
      ],
    });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW)).rejects.toBeInstanceOf(DataError);
  });

  it('last_reviewed_at non-null NON parsabile ⇒ DataError (timestamp non valido)', async () => {
    const { client } = makeFakeClient({
      rows: [
        {
          exercise_id: 'ex',
          stage: 0,
          due_at: NOW.toISOString(),
          review_count: 0,
          lapse_count: 0,
          last_reviewed_at: 'nope',
        },
      ],
    });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW)).rejects.toBeInstanceOf(DataError);
  });

  it('riga null (elemento non-oggetto) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [null] });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW)).rejects.toBeInstanceOf(DataError);
  });
});
