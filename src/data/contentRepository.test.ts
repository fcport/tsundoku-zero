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
  /** Righe ritornate da `select().order()` / `select().in()`. */
  readonly rows?: readonly unknown[] | null;
  /** Errore ritornato da `select().order()` / `select().in()`. */
  readonly error?: unknown;
}

interface FakeCalls {
  table: string;
  columns: string;
  orderBy: string | null;
  /** Colonna passata a `.in(column, values)` (null se `.in` non è stato invocato). */
  inColumn: string | null;
  /** Valori passati a `.in(column, values)` (null se non invocato). */
  inValues: readonly unknown[] | null;
  /** Vero se il filtro `.in` è stato eseguito (per provare il corto-circuito ids vuoti). */
  inQueried: boolean;
}

/** Costruisce un finto SupabaseClient + gli spione delle chiamate. */
function makeFakeClient(options: FakeContentOptions = {}): {
  client: SupabaseClient;
  calls: FakeCalls;
} {
  const calls: FakeCalls = {
    table: '',
    columns: '',
    orderBy: null,
    inColumn: null,
    inValues: null,
    inQueried: false,
  };

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
            in: async (column: string, values: readonly unknown[]) => {
              calls.inColumn = column;
              calls.inValues = values;
              calls.inQueried = true;
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

// Righe della I/O & Edge-Case Matrix per `listExercisesByIds` (3.18): mappa per i
// tre kind via `exerciseSchema.parse` (fonte UNICA), `explanation_it` null ⇒
// `{ en }`, `ids` vuoto ⇒ `[]` senza query, errore/riga malformata ⇒ DataError. Il
// payload jsonb porta `sentence`/`answer`/`distractors`; le colonne portano
// `kind`/`grammar_point`/`explanation_*`.

/** Riga `exercise` valida single-select (payload + colonne), sovrascrivibile. */
function singleSelectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ex-ss',
    kind: 'single-select',
    payload: {
      sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
      answer: 'は',
      distractors: ['を', 'が'],
    },
    grammar_point: 'wa-particle',
    explanation_en: 'The topic particle.',
    explanation_it: 'La particella del tema.',
    ...overrides,
  };
}

/** Riga `exercise` valida select-span. */
function selectSpanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ex-span',
    kind: 'select-span',
    payload: {
      sentence: { kanji: '難しい', kana: 'むずかしい' },
      answer: { start: 0, end: 1 },
    },
    grammar_point: 'i-adjective',
    explanation_en: 'An i-adjective.',
    explanation_it: null,
    ...overrides,
  };
}

/** Riga `exercise` valida assemble. */
function assembleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ex-asm',
    kind: 'assemble',
    payload: {
      sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
      answer: ['本', 'を', '読む'],
    },
    grammar_point: 'word-order',
    explanation_en: 'Subject object verb.',
    explanation_it: null,
    ...overrides,
  };
}

describe('listExercisesByIds — happy path: mappa i tre kind via exerciseSchema.parse (AC5)', () => {
  it('mappa in ExerciseContent { id, exercise } e filtra .in(id, ids) sulla tabella exercise', async () => {
    const { client, calls } = makeFakeClient({
      rows: [singleSelectRow(), selectSpanRow(), assembleRow()],
    });
    const repo = createSupabaseContentRepository(client);

    const result = await repo.listExercisesByIds(['ex-ss', 'ex-span', 'ex-asm']);

    // La select tocca la tabella exercise, chiede le colonne attese e filtra .in.
    expect(calls.table).toBe('exercise');
    expect(calls.columns).toContain('payload');
    expect(calls.columns).toContain('grammar_point');
    expect(calls.inColumn).toBe('id');
    expect(calls.inValues).toEqual(['ex-ss', 'ex-span', 'ex-asm']);

    // L'id di RIGA è preservato accanto all'Exercise di dominio (senza id).
    expect(result).toHaveLength(3);
    const ss = result.find((r) => r.id === 'ex-ss');
    expect(ss?.exercise).toEqual({
      kind: 'single-select',
      grammarPoint: 'wa-particle',
      sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
      answer: 'は',
      distractors: ['を', 'が'],
      explanation: { en: 'The topic particle.', it: 'La particella del tema.' },
    });

    const span = result.find((r) => r.id === 'ex-span');
    expect(span?.exercise.kind).toBe('select-span');
    const asm = result.find((r) => r.id === 'ex-asm');
    expect(asm?.exercise.kind).toBe('assemble');
  });

  it('explanation_it null ⇒ explanation = { en } (it OMESSO, forma d oro FR8.5)', async () => {
    const { client } = makeFakeClient({ rows: [selectSpanRow()] });
    const repo = createSupabaseContentRepository(client);

    const [content] = await repo.listExercisesByIds(['ex-span']);
    expect(content?.exercise.explanation).toEqual({ en: 'An i-adjective.' });
    expect('it' in (content?.exercise.explanation ?? {})).toBe(false);
  });

  it('nessuna riga ⇒ array vuoto', async () => {
    const { client } = makeFakeClient({ rows: [] });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listExercisesByIds(['ex-x'])).resolves.toEqual([]);
  });
});

describe('listExercisesByIds — ids vuoto ⇒ [] SENZA query (filtro degenere)', () => {
  it('non colpisce il DB quando ids è vuoto', async () => {
    const { client, calls } = makeFakeClient({ rows: [singleSelectRow()] });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listExercisesByIds([])).resolves.toEqual([]);
    // Corto-circuito: nessuna query .in eseguita.
    expect(calls.inQueried).toBe(false);
    expect(calls.table).toBe('');
  });
});

describe('listExercisesByIds — fallimenti lanciano DataError (reject)', () => {
  it("errore Supabase ⇒ DataError('listExercisesByIds') con causa preservata", async () => {
    const supabaseError = { message: 'rls denied', code: '42501' };
    const { client } = makeFakeClient({ error: supabaseError });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listExercisesByIds(['ex-ss'])).rejects.toBeInstanceOf(
      DataError,
    );
    await expect(repo.listExercisesByIds(['ex-ss'])).rejects.toMatchObject({
      operation: 'listExercisesByIds',
      cause: supabaseError,
    });
  });

  it('payload non oggetto ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [singleSelectRow({ payload: 'not-an-object' })],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listExercisesByIds(['ex-ss'])).rejects.toBeInstanceOf(
      DataError,
    );
  });

  it('kind fuori dal registro chiuso ⇒ DataError (parse ok:false)', async () => {
    const { client } = makeFakeClient({
      rows: [singleSelectRow({ kind: 'free-text' })],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listExercisesByIds(['ex-ss'])).rejects.toBeInstanceOf(
      DataError,
    );
  });

  it('grammar_point non stringa ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [singleSelectRow({ grammar_point: 42 })],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listExercisesByIds(['ex-ss'])).rejects.toBeInstanceOf(
      DataError,
    );
  });

  it('explanation_en non stringa ⇒ DataError', async () => {
    const { client } = makeFakeClient({
      rows: [singleSelectRow({ explanation_en: null })],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listExercisesByIds(['ex-ss'])).rejects.toBeInstanceOf(
      DataError,
    );
  });

  it('payload malformato (answer mancante) ⇒ DataError (parse ok:false)', async () => {
    const { client } = makeFakeClient({
      rows: [
        singleSelectRow({
          payload: {
            sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
            distractors: ['を'],
          },
        }),
      ],
    });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listExercisesByIds(['ex-ss'])).rejects.toBeInstanceOf(
      DataError,
    );
  });

  it('riga null (elemento non-oggetto) ⇒ DataError', async () => {
    const { client } = makeFakeClient({ rows: [null] });
    const repo = createSupabaseContentRepository(client);

    await expect(repo.listExercisesByIds(['ex-ss'])).rejects.toBeInstanceOf(
      DataError,
    );
  });
});
