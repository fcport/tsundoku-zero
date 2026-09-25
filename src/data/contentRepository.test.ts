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
        },
        {
          id: 'particle-wa',
          ordinal: 2,
          title_en: 'The particle wa',
          title_it: null,
          grammar_points: ['wa', 'topic'],
        },
      ],
    });
    const repo = createSupabaseContentRepository(client);

    const lessons = await repo.listLessons();

    // La select tocca la tabella lesson, chiede le colonne attese e ordina
    // server-side per ordinal.
    expect(calls.table).toBe('lesson');
    expect(calls.columns).toContain('ordinal');
    expect(calls.orderBy).toBe('ordinal');

    // Titolo bilingue: `it` PRESENTE quando la colonna ha un valore.
    expect(lessons[0]).toEqual({
      id: 'te-form',
      ordinal: 1,
      title: { en: 'The te-form', it: 'La forma in te' },
      grammarPoints: ['te-form'],
    });

    // Forma d'oro: `it` OMESSO (non undefined esplicito) quando la colonna è null.
    expect(lessons[1]?.title).toEqual({ en: 'The particle wa' });
    expect('it' in (lessons[1]?.title ?? {})).toBe(false);
    expect(lessons[1]?.grammarPoints).toEqual(['wa', 'topic']);
  });

  it('nessuna riga ⇒ array vuoto', async () => {
    const { client } = makeFakeClient({ rows: [] });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listLessons()).resolves.toEqual([]);
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
});
