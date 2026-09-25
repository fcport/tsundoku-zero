import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseContentRepository } from './contentRepository';
import { DataError } from './dataError';

// Righe della I/O & Edge-Case Matrix per l'adattatore ContentRepository. Il
// client Supabase è FINTO: la select con `.order('ordinal')` e la mappa in
// LessonSummary sono verificate per FORMA e per RISULTATO, senza rete né DB reale.
// A differenza degli adattatori a confine totale, questo LANCIA `DataError` su
// errore o riga malformata (alimenta TanStack Query — reject).

interface FakeContentOptions {
  /** Righe ritornate da `select().order()`. */
  readonly rows?: readonly unknown[] | null;
  /** Errore ritornato da `select().order()`. */
  readonly error?: unknown;
}

/** Costruisce un finto SupabaseClient + gli spione delle chiamate. */
function makeFakeClient(options: FakeContentOptions = {}): {
  client: SupabaseClient;
  calls: { table: string; columns: string; orderBy: string | null };
} {
  const calls = { table: '', columns: '', orderBy: null as string | null };

  const fake = {
    from(table: string) {
      calls.table = table;
      return {
        select(columns: string) {
          calls.columns = columns;
          return {
            order: async (column: string) => {
              calls.orderBy = column;
              return {
                data: options.rows ?? null,
                error: options.error ?? null,
              };
            },
          };
        },
      };
    },
  };

  return { client: fake as unknown as SupabaseClient, calls };
}

describe('listLessons — happy path: mappa, ordina, omette it quando null', () => {
  it('mappa le righe in LessonSummary con titolo bilingue e ordina per ordinal (server-side)', async () => {
    const { client, calls } = makeFakeClient({
      rows: [
        {
          id: 'te-form',
          ordinal: 1,
          title_en: 'The te-form',
          title_it: 'La forma in te',
          grammar_points: ['te-form'],
          exercise: [{ count: 3 }],
        },
        {
          id: 'particle-wa',
          ordinal: 2,
          title_en: 'The particle wa',
          title_it: null,
          grammar_points: ['wa', 'topic'],
          exercise: [{ count: 5 }],
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    const lessons = await repo.listLessons();

    // La select tocca la tabella lesson, chiede le colonne attese (incluso il count
    // aggregato embedded degli esercizi) e ordina server-side per ordinal.
    expect(calls.table).toBe('lesson');
    expect(calls.columns).toContain('ordinal');
    expect(calls.columns).toContain('exercise(count)');
    expect(calls.orderBy).toBe('ordinal');

    // Titolo bilingue: `it` PRESENTE quando la colonna ha un valore; `exerciseCount`
    // dal count embedded.
    expect(lessons[0]).toEqual({
      id: 'te-form',
      ordinal: 1,
      title: { en: 'The te-form', it: 'La forma in te' },
      grammarPoints: ['te-form'],
      exerciseCount: 3,
    });

    // Forma d'oro: `it` OMESSO (non undefined esplicito) quando la colonna è null.
    expect(lessons[1]?.title).toEqual({ en: 'The particle wa' });
    expect('it' in (lessons[1]?.title ?? {})).toBe(false);
    expect(lessons[1]?.grammarPoints).toEqual(['wa', 'topic']);
    expect(lessons[1]?.exerciseCount).toBe(5);
  });

  it('nessuna riga ⇒ array vuoto', async () => {
    const { client } = makeFakeClient({ rows: [] });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).resolves.toEqual([]);
  });

  it('lezione concettuale: exercise count 0 ⇒ exerciseCount 0 (AC5)', async () => {
    // Una lezione senza esercizi: il count embedded è `[{ count: 0 }]`. Non è un
    // fallimento — è una lezione concettuale, mappata a `exerciseCount: 0`.
    const { client } = makeFakeClient({
      rows: [
        {
          id: 'concept',
          ordinal: 1,
          title_en: 'A concept',
          title_it: null,
          grammar_points: ['concept'],
          exercise: [{ count: 0 }],
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    const lessons = await repo.listLessons();
    expect(lessons[0]?.exerciseCount).toBe(0);
  });

  it('lezione concettuale: exercise array VUOTO ⇒ exerciseCount 0 (AC5)', async () => {
    // PostgREST può emettere `exercise: []` (nessuna riga embedded) per una lezione
    // senza esercizi, invece di `[{ count: 0 }]`. È una forma valida di «zero», non
    // un fallimento: la lezione concettuale NON deve rigettare l'intera listLessons.
    const { client } = makeFakeClient({
      rows: [
        {
          id: 'concept',
          ordinal: 1,
          title_en: 'A concept',
          title_it: null,
          grammar_points: ['concept'],
          exercise: [],
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    const lessons = await repo.listLessons();
    expect(lessons[0]?.exerciseCount).toBe(0);
  });
});

describe('listLessons — fallimenti lanciano DataError (reject, non valore degradato)', () => {
  it("errore Supabase ⇒ DataError('listLessons') con causa preservata", async () => {
    const supabaseError = { message: 'rls denied', code: '42501' };
    const { client } = makeFakeClient({ error: supabaseError });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).rejects.toBeInstanceOf(DataError);
    await expect(repo.listLessons()).rejects.toMatchObject({
      operation: 'listLessons',
      cause: supabaseError,
    });
  });

  it('riga malformata (title_en mancante) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [{ id: 'x', ordinal: 1, title_it: null, grammar_points: [] }],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (grammar_points non array) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [
        {
          id: 'x',
          ordinal: 1,
          title_en: 'X',
          title_it: null,
          grammar_points: 'not-an-array',
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (title_it non-null non-stringa) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [
        {
          id: 'x',
          ordinal: 1,
          title_en: 'X',
          title_it: 42,
          grammar_points: ['g'],
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (ordinal non numero) ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [
        {
          id: 'x',
          ordinal: 'x',
          title_en: 'X',
          title_it: null,
          grammar_points: ['g'],
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga null (elemento non-oggetto) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [null] });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (exercise non array) ⇒ DataError (AC5)', async () => {
    const { client } = makeFakeClient({
      rows: [
        {
          id: 'x',
          ordinal: 1,
          title_en: 'X',
          title_it: null,
          grammar_points: ['g'],
          exercise: 3,
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (exercise count non numero) ⇒ DataError (AC5)', async () => {
    const { client } = makeFakeClient({
      rows: [
        {
          id: 'x',
          ordinal: 1,
          title_en: 'X',
          title_it: null,
          grammar_points: ['g'],
          exercise: [{ count: 'many' }],
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).rejects.toBeInstanceOf(DataError);
  });

  it('riga malformata (exercise array di lunghezza > 1) ⇒ DataError (AC5)', async () => {
    // Il count aggregato embedded è UNA sola riga di aggregazione: più di una voce è
    // una forma inattesa ⇒ fallimento, non un valore degradato (a differenza di `[]`).
    const { client } = makeFakeClient({
      rows: [
        {
          id: 'x',
          ordinal: 1,
          title_en: 'X',
          title_it: null,
          grammar_points: ['g'],
          exercise: [{ count: 1 }, { count: 2 }],
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).rejects.toBeInstanceOf(DataError);
  });
});
