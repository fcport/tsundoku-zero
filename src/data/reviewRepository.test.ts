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
  /** Errore ritornato da `rpc()` (per applyReview). */
  readonly rpcError?: unknown;
}

interface FakeCalls {
  table: string;
  columns: string;
  rpc: { fn: string; params: Record<string, unknown> } | null;
}

function makeFakeClient(options: FakeReviewOptions = {}): {
  client: SupabaseClient;
  calls: FakeCalls;
} {
  const calls: FakeCalls = { table: '', columns: '', rpc: null };

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
    // Cattura la chiamata RPC (nome funzione + parametri) per l applyReview.
    async rpc(fn: string, params: Record<string, unknown>) {
      calls.rpc = { fn, params };
      return { data: null, error: options.rpcError ?? null };
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

// Righe della I/O Matrix per `listReviewLog` (storia 3.12): il canale UNICO dello
// streak (AD-18). Legge TUTTO il log — nessun filtro `isDue`, `now` non serve — e
// mappa `reviewed_at` (stringa ISO) in `reviewedAt: Date`. Lo stesso client finto
// (from→select) serve la tabella `review_log`.
describe('listReviewLog — mappa review_log in ReviewLogEntry (streak, AD-18)', () => {
  it('righe valide ⇒ entries con reviewedAt: Date, dalla tabella review_log', async () => {
    const { client, calls } = makeFakeClient({
      rows: [
        { reviewed_at: '2026-09-24T08:00:00.000Z' },
        { reviewed_at: '2026-09-25T09:30:00.000Z' },
      ],
    });
    const repo = createSupabaseReviewRepository(client);

    const log = await repo.listReviewLog();

    expect(calls.table).toBe('review_log');
    expect(calls.columns).toContain('reviewed_at');
    expect(log).toEqual([
      { reviewedAt: new Date('2026-09-24T08:00:00.000Z') },
      { reviewedAt: new Date('2026-09-25T09:30:00.000Z') },
    ]);
  });

  it('data null (nessuna riga) ⇒ array vuoto', async () => {
    const { client } = makeFakeClient({});
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).resolves.toEqual([]);
  });

  it("errore Supabase ⇒ DataError('listReviewLog') con causa preservata", async () => {
    const supabaseError = { message: 'rls denied', code: '42501' };
    const { client } = makeFakeClient({ error: supabaseError });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).rejects.toBeInstanceOf(DataError);
    await expect(repo.listReviewLog()).rejects.toMatchObject({
      operation: 'listReviewLog',
      cause: supabaseError,
    });
  });

  it('riga malformata (reviewed_at non stringa) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [{ reviewed_at: 12345 }] });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).rejects.toBeInstanceOf(DataError);
  });

  it('reviewed_at stringa NON parsabile ⇒ DataError (timestamp non valido)', async () => {
    const { client } = makeFakeClient({ rows: [{ reviewed_at: 'not-a-date' }] });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).rejects.toBeInstanceOf(DataError);
  });

  it('riga null (elemento non-oggetto) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [null] });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).rejects.toBeInstanceOf(DataError);
  });
});

// Righe della I/O Matrix per `applyReview` (storia 3.19, AD-7): UNA chiamata
// idempotente alla RPC transazionale `apply_review`. L adattatore TRASPORTA i valori
// GIÀ calcolati dal client (nessun ricalcolo qui né in SQL), mappa camel→snake e
// Date→ISO. Su errore Supabase ⇒ DataError('applyReview') (reject).
describe('applyReview — rpc(apply_review) con valori pre-calcolati (AD-7)', () => {
  const input = {
    reviewId: 'rev-1',
    exerciseId: 'ex-1',
    outcome: 'good' as const,
    stage: 2,
    dueAt: new Date('2026-09-28T12:00:00.000Z'),
    reviewedAt: new Date('2026-09-25T12:00:00.000Z'),
    usedExplanation: false,
  };

  it('chiama rpc con il nome apply_review e i parametri snake_case (date in ISO)', async () => {
    const { client, calls } = makeFakeClient();
    const repo = createSupabaseReviewRepository(client);

    await repo.applyReview(input);

    expect(calls.rpc?.fn).toBe('apply_review');
    expect(calls.rpc?.params).toEqual({
      review_id: 'rev-1',
      exercise_id: 'ex-1',
      outcome: 'good',
      stage: 2,
      due_at: '2026-09-28T12:00:00.000Z',
      reviewed_at: '2026-09-25T12:00:00.000Z',
      used_explanation: false,
    });
  });

  it('risolve senza valore su successo (void)', async () => {
    const { client } = makeFakeClient();
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.applyReview(input)).resolves.toBeUndefined();
  });

  it("errore Supabase ⇒ DataError('applyReview') con causa preservata", async () => {
    const supabaseError = { message: 'rls denied', code: '42501' };
    const { client } = makeFakeClient({ rpcError: supabaseError });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.applyReview(input)).rejects.toBeInstanceOf(DataError);
    await expect(repo.applyReview(input)).rejects.toMatchObject({
      operation: 'applyReview',
      cause: supabaseError,
    });
  });

  it('passa used_explanation true quando la spiegazione è stata consultata', async () => {
    const { client, calls } = makeFakeClient();
    const repo = createSupabaseReviewRepository(client);

    await repo.applyReview({ ...input, usedExplanation: true, outcome: 'hard' });

    expect(calls.rpc?.params.used_explanation).toBe(true);
    expect(calls.rpc?.params.outcome).toBe('hard');
  });
});
