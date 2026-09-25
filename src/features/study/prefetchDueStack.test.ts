import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { dueQueryKey } from '../../domain/due';
import type { ReviewState } from '../../domain/schedule';
import type { ExerciseContent } from '../../domain/ports/contentRepository';
import type { Exercise } from '../../domain/exercise';
import { prefetchDueStack, type PrefetchPorts } from './prefetchDueStack';

// Righe della I/O & Edge-Case Matrix per il PRECARICO della sessione (4.1) sulla
// SUPERFICIE REALE: un `QueryClient` vero (la stessa cache che `SessionScreen`
// legge) + porte SPIA (`vi.fn`). Copre AC1 (pila+contenuto+spiegazioni popolati),
// AC3 (riuso della cache `['due']` senza refetch, stessa chiave della dashboard) e
// gli edge (pila vuota, userId null). Il degrado grazioso su reject è provato al
// livello del wiring (`AuthenticatedShell.prefetch.test.tsx`), non qui: questa
// funzione PROPAGA il reject di proposito, il chiamante lo cattura.

const UID = 'user-1';
const NOW = new Date('2026-09-25T12:00:00.000Z');

const firstExercise: Exercise = {
  kind: 'single-select',
  grammarPoint: 'wa-particle',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['を', 'が', 'に'],
  explanation: { en: 'The topic particle.' },
};

const secondExercise: Exercise = {
  kind: 'assemble',
  grammarPoint: 'word-order',
  sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
  answer: ['本', 'を', '読む'],
  explanation: { en: 'Subject object verb.' },
};

const EXERCISES: readonly ExerciseContent[] = [
  { id: 'ex-1', exercise: firstExercise },
  { id: 'ex-2', exercise: secondExercise },
];

/** Stato di ripasso minimo: il precarico usa solo `exerciseId`. */
function due(id: string): ReviewState {
  return {
    exerciseId: id,
    stage: 0,
    dueAt: new Date(0),
    reviewCount: 0,
    lapseCount: 0,
    lastReviewedAt: null,
  };
}

const DUE_STATES: readonly ReviewState[] = [due('ex-1'), due('ex-2')];

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Porte spia: `listDue`/`listExercisesByIds` sono `vi.fn` osservabili con dati
 * COERENTI (gli stati e gli esercizi seminati). `clock.now()` ritorna un istante
 * fisso così l'argomento di `listDue` è verificabile.
 */
function spyPorts(overrides: {
  listDue?: () => Promise<readonly ReviewState[]>;
  listExercisesByIds?: (
    ids: readonly string[],
  ) => Promise<readonly ExerciseContent[]>;
} = {}): {
  ports: PrefetchPorts;
  listDue: ReturnType<typeof vi.fn>;
  listExercisesByIds: ReturnType<typeof vi.fn>;
  now: ReturnType<typeof vi.fn>;
} {
  const listDue = vi.fn(overrides.listDue ?? (async () => DUE_STATES));
  const listExercisesByIds = vi.fn(
    overrides.listExercisesByIds ??
      (async (ids: readonly string[]) =>
        EXERCISES.filter((e) => ids.includes(e.id))),
  );
  const now = vi.fn(() => NOW);
  return {
    ports: {
      review: { listDue },
      content: { listExercisesByIds },
      clock: { now },
    },
    listDue,
    listExercisesByIds,
    now,
  };
}

describe('prefetchDueStack — riga: pila NON in cache', () => {
  it('chiama listDue(clock.now()), precarica gli esercizi, popola entrambe le chiavi (AC1)', async () => {
    const qc = freshClient();
    const { ports, listDue, listExercisesByIds, now } = spyPorts();

    await prefetchDueStack(qc, ports, UID);

    // `listDue` chiamato UNA volta con l'istante dell'orologio.
    expect(listDue).toHaveBeenCalledTimes(1);
    expect(listDue).toHaveBeenCalledWith(NOW);
    expect(now).toHaveBeenCalled();
    // Il contenuto precaricato con gli id derivati dalla pila.
    expect(listExercisesByIds).toHaveBeenCalledTimes(1);
    expect(listExercisesByIds).toHaveBeenCalledWith(['ex-1', 'ex-2']);

    // AC1: entrambe le chiavi popolate — la pila sotto `dueQueryKey`, il contenuto
    // sotto `['exercises', ids]` con la STESSA forma che SessionScreen costruisce.
    expect(qc.getQueryData(dueQueryKey(UID))).toEqual(DUE_STATES);
    const cachedContent = qc.getQueryData<readonly ExerciseContent[]>([
      'exercises',
      ['ex-1', 'ex-2'],
    ]);
    expect(cachedContent).toEqual(EXERCISES);
  });

  it('ogni ExerciseContent caricato porta la sua explanation (AC1)', async () => {
    const qc = freshClient();
    const { ports } = spyPorts();

    await prefetchDueStack(qc, ports, UID);

    const cachedContent = qc.getQueryData<readonly ExerciseContent[]>([
      'exercises',
      ['ex-1', 'ex-2'],
    ]);
    expect(cachedContent).toBeDefined();
    for (const content of cachedContent ?? []) {
      expect(content.exercise.explanation).toBeDefined();
    }
  });
});

describe('prefetchDueStack — riga: pila GIÀ in cache (utente da dashboard)', () => {
  it('RIUSA il valore in cache senza richiamare listDue, con la chiave del dominio (AC3)', async () => {
    const qc = freshClient();
    // Simula la dashboard: la pila è già popolata sotto la STESSA chiave.
    qc.setQueryData(dueQueryKey(UID), DUE_STATES);
    const { ports, listDue, listExercisesByIds } = spyPorts();

    await prefetchDueStack(qc, ports, UID);

    // AC3: nessun refetch della pila (ensureQueryData ritorna la cache).
    expect(listDue).not.toHaveBeenCalled();
    // Gli id precaricati coincidono con quelli contati dalla dashboard.
    expect(listExercisesByIds).toHaveBeenCalledWith(['ex-1', 'ex-2']);
    expect(qc.getQueryData(dueQueryKey(UID))).toEqual(DUE_STATES);
  });
});

describe('prefetchDueStack — riga: pila vuota', () => {
  it('ids vuoti ⇒ non interroga il contenuto in modo degenere; risolve (AC5)', async () => {
    const qc = freshClient();
    // Porta del contenuto che rispetta il contratto: ids vuoto ⇒ [] senza query.
    const listExercisesByIds = vi.fn(async (ids: readonly string[]) => {
      if (ids.length === 0) return [] as readonly ExerciseContent[];
      return EXERCISES;
    });
    const { ports, listDue } = spyPorts({
      listDue: async () => [],
      listExercisesByIds,
    });

    await expect(prefetchDueStack(qc, ports, UID)).resolves.toBeUndefined();

    expect(listDue).toHaveBeenCalledTimes(1);
    // Chiamato con ids vuoti (la porta ritorna [] senza query, contratto).
    expect(listExercisesByIds).toHaveBeenCalledWith([]);
    // La pila (vuota) e il contenuto (vuoto) sono comunque popolati in cache.
    expect(qc.getQueryData(dueQueryKey(UID))).toEqual([]);
    expect(qc.getQueryData(['exercises', []])).toEqual([]);
  });
});

describe('prefetchDueStack — riga: userId null', () => {
  it('no-op: nessuna chiamata di porta, nessuna scrittura in cache', async () => {
    const qc = freshClient();
    const { ports, listDue, listExercisesByIds, now } = spyPorts();

    await expect(prefetchDueStack(qc, ports, null)).resolves.toBeUndefined();

    expect(listDue).not.toHaveBeenCalled();
    expect(listExercisesByIds).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    // Nessuna scrittura: la cache resta vuota (nessuna chiave `['due', '']`).
    expect(qc.getQueryData(dueQueryKey(''))).toBeUndefined();
  });
});

describe('prefetchDueStack — riga: errore di precarico', () => {
  it('PROPAGA il reject di listDue (il chiamante degrada graziosamente)', async () => {
    const qc = freshClient();
    const { ports } = spyPorts({
      listDue: () => Promise.reject(new Error('network')),
    });

    await expect(prefetchDueStack(qc, ports, UID)).rejects.toThrow('network');
  });

  it('PROPAGA il reject di listExercisesByIds (il chiamante degrada graziosamente)', async () => {
    const qc = freshClient();
    const { ports } = spyPorts({
      listExercisesByIds: () => Promise.reject(new Error('network')),
    });

    await expect(prefetchDueStack(qc, ports, UID)).rejects.toThrow('network');
  });
});
