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
/** Il fuso della giornata di studio (confine alle 2 locali). */
const TZ = 'Europe/Rome';

/** Una riga `review_state` grezza della lezione `lesson`, in scadenza a `dueAt`. */
function row(id: string, lesson: string, dueAt: string) {
  return {
    exercise_id: id,
    stage: 3,
    due_at: dueAt,
    review_count: 4,
    lapse_count: 0,
    last_reviewed_at: '2026-09-01T10:00:00.000Z',
    exercise: { lesson_id: lesson },
  };
}

describe('listDue — il rientro dolce: oltre 8 arretrati, gli altri vanno ai giorni dopo', () => {
  // 20 arretrati di 4 lezioni (5 ciascuna), scaduti fra il 10 e il 14 settembre.
  const backlog = Array.from({ length: 20 }, (_, i) =>
    row(`ex-${String(i).padStart(2, '0')}`, `lesson-${i % 4}`, `2026-09-1${i % 5}T00:30:00.000Z`),
  );

  it('legge la lezione di ogni esercizio insieme alla pila', async () => {
    const { client, calls } = makeFakeClient({ rows: backlog });
    await createSupabaseReviewRepository(client).listDue(NOW, TZ);
    expect(calls.columns).toContain('exercise(lesson_id)');
  });

  it('oggi tiene 8 arretrati vari e salva il rinvio degli altri 12, 8 domani e 4 dopodomani', async () => {
    const { client, calls } = makeFakeClient({ rows: backlog });
    const due = await createSupabaseReviewRepository(client).listDue(NOW, TZ);

    expect(due).toHaveLength(8);
    // Vari: le 4 lezioni ci sono tutte, 2 esercizi ciascuna.
    const lessonOfId = new Map(backlog.map((r) => [r.exercise_id, r.exercise.lesson_id]));
    expect(new Set(due.map((s) => lessonOfId.get(s.exerciseId))).size).toBe(4);

    expect(calls.rpc?.fn).toBe('postpone_reviews');
    const ids = calls.rpc?.params.exercise_ids as string[];
    expect(ids).toHaveLength(12);
    expect(ids.every((id) => !due.some((s) => s.exerciseId === id))).toBe(true);
    // Il 26 e il 27 settembre alle 2 di Roma (00:00 UTC, ora legale).
    expect(calls.rpc?.params.due_ats).toEqual([
      ...Array(8).fill('2026-09-26T00:00:00.000Z'),
      ...Array(4).fill('2026-09-27T00:00:00.000Z'),
    ]);
    // Solo righe ancora arretrate: scadute prima dell'inizio di oggi.
    expect(calls.rpc?.params.still_due_before).toBe('2026-09-25T00:00:00.000Z');
  });

  it('se il salvataggio fallisce la pila di oggi resta comunque a 8', async () => {
    const { client } = makeFakeClient({ rows: backlog, rpcError: { message: 'offline' } });
    await expect(createSupabaseReviewRepository(client).listDue(NOW, TZ)).resolves.toHaveLength(8);
  });

  it('fino a 8 arretrati nessun rinvio', async () => {
    const { client, calls } = makeFakeClient({ rows: backlog.slice(0, 8) });
    await expect(createSupabaseReviewRepository(client).listDue(NOW, TZ)).resolves.toHaveLength(8);
    expect(calls.rpc).toBeNull();
  });
});

describe('countPostponed — gli arretrati rinviati ancora in arrivo', () => {
  it('legge review_state e conta i rinvii (mai ripassati, in scadenza domani)', async () => {
    const { client, calls } = makeFakeClient({
      rows: [
        { ...row('ex-a', 'l1', '2026-09-26T00:00:00.000Z'), last_reviewed_at: null, stage: 0 },
        row('ex-b', 'l1', '2026-09-24T00:30:00.000Z'),
      ],
    });
    await expect(createSupabaseReviewRepository(client).countPostponed(NOW, TZ)).resolves.toBe(1);
    expect(calls.table).toBe('review_state');
  });

  it('su errore Supabase lancia DataError', async () => {
    const { client } = makeFakeClient({ error: { message: 'boom' } });
    await expect(createSupabaseReviewRepository(client).countPostponed(NOW, TZ)).rejects.toMatchObject({
      operation: 'countPostponed',
    });
  });
});

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

    const due = await repo.listDue(NOW, TZ);

    expect(calls.table).toBe('review_state');
    expect(calls.columns).toContain('due_at');

    // Solo le due dovute (l'ordine è quello di `mixByLesson`); la futura è filtrata.
    expect(due.map((s) => s.exerciseId).sort()).toEqual(['ex-now', 'ex-past']);
    const past = due.find((s) => s.exerciseId === 'ex-past');
    const atNow = due.find((s) => s.exerciseId === 'ex-now');

    // Mappa completa in ReviewState: due_at/last_reviewed_at → Date (null resta null).
    expect(past).toEqual({
      exerciseId: 'ex-past',
      stage: 2,
      dueAt: new Date('2026-09-24T12:00:00.000Z'),
      reviewCount: 3,
      lapseCount: 1,
      lastReviewedAt: new Date('2026-09-23T12:00:00.000Z'),
    });
    expect(atNow?.lastReviewedAt).toBeNull();
    expect(atNow?.dueAt).toEqual(NOW);
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

    await expect(repo.listDue(NOW, TZ)).resolves.toEqual([]);
  });

  it('data null (nessuna riga, nessun errore) ⇒ array vuoto', async () => {
    const { client } = makeFakeClient({});
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW, TZ)).resolves.toEqual([]);
  });
});

describe('listDue — fallimenti lanciano DataError (reject)', () => {
  it("errore Supabase ⇒ DataError('listDue') con causa preservata", async () => {
    const supabaseError = { message: 'rls denied', code: '42501' };
    const { client } = makeFakeClient({ error: supabaseError });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW, TZ)).rejects.toBeInstanceOf(DataError);
    await expect(repo.listDue(NOW, TZ)).rejects.toMatchObject({
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

    await expect(repo.listDue(NOW, TZ)).rejects.toBeInstanceOf(DataError);
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

    await expect(repo.listDue(NOW, TZ)).rejects.toBeInstanceOf(DataError);
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

    await expect(repo.listDue(NOW, TZ)).rejects.toBeInstanceOf(DataError);
  });

  it('riga null (elemento non-oggetto) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [null] });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listDue(NOW, TZ)).rejects.toBeInstanceOf(DataError);
  });
});

// Righe della I/O Matrix per `listReviewLog` (storie 3.12/5.2): il canale UNICO
// delle statistiche derivate (AD-18). Legge TUTTO il log — nessun filtro `isDue`,
// `now` non serve — e mappa la riga COMPLETA (`exercise_id`/`outcome`/`reviewed_at`)
// in `ReviewLogRecord` (exerciseId/outcome/reviewedAt). L'adattatore VALIDA
// `outcome` contro `REVIEW_OUTCOMES` e `exercise_id` come stringa. Lo stesso client
// finto (from→select) serve la tabella `review_log`.
describe('listReviewLog — mappa review_log in ReviewLogRecord (statistiche, AD-18)', () => {
  it('righe valide ⇒ record con exerciseId/outcome/reviewedAt/grammarPoint, dalla tabella review_log', async () => {
    const { client, calls } = makeFakeClient({
      rows: [
        {
          exercise_id: 'ex-1',
          outcome: 'good',
          reviewed_at: '2026-09-24T08:00:00.000Z',
          grammar_point: 'te-form',
        },
        {
          exercise_id: 'ex-2',
          outcome: 'again',
          reviewed_at: '2026-09-25T09:30:00.000Z',
          grammar_point: 'particles',
        },
      ],
    });
    const repo = createSupabaseReviewRepository(client);

    const log = await repo.listReviewLog();

    expect(calls.table).toBe('review_log');
    expect(calls.columns).toContain('reviewed_at');
    expect(calls.columns).toContain('exercise_id');
    expect(calls.columns).toContain('outcome');
    expect(calls.columns).toContain('grammar_point');
    expect(log).toEqual([
      {
        exerciseId: 'ex-1',
        outcome: 'good',
        reviewedAt: new Date('2026-09-24T08:00:00.000Z'),
        grammarPoint: 'te-form',
      },
      {
        exerciseId: 'ex-2',
        outcome: 'again',
        reviewedAt: new Date('2026-09-25T09:30:00.000Z'),
        grammarPoint: 'particles',
      },
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
    const { client } = makeFakeClient({
      rows: [{ exercise_id: 'ex-1', outcome: 'good', reviewed_at: 12345, grammar_point: 'te-form' }],
    });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).rejects.toBeInstanceOf(DataError);
  });

  it('reviewed_at stringa NON parsabile ⇒ DataError (timestamp non valido)', async () => {
    const { client } = makeFakeClient({
      rows: [{ exercise_id: 'ex-1', outcome: 'good', reviewed_at: 'not-a-date', grammar_point: 'te-form' }],
    });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (exercise_id non stringa) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [{ exercise_id: 42, outcome: 'good', reviewed_at: '2026-09-24T08:00:00.000Z', grammar_point: 'te-form' }],
    });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (outcome fuori da REVIEW_OUTCOMES) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [{ exercise_id: 'ex-1', outcome: 'perfetto', reviewed_at: '2026-09-24T08:00:00.000Z', grammar_point: 'te-form' }],
    });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (outcome non stringa) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [{ exercise_id: 'ex-1', outcome: 3, reviewed_at: '2026-09-24T08:00:00.000Z', grammar_point: 'te-form' }],
    });
    const repo = createSupabaseReviewRepository(client);

    await expect(repo.listReviewLog()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (grammar_point non stringa) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [{ exercise_id: 'ex-1', outcome: 'good', reviewed_at: '2026-09-24T08:00:00.000Z', grammar_point: 42 }],
    });
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
