// Ambiente `node` (l'env globale della suite): la FEDELTÀ del persister durevole (4.2,
// AC5) senza IndexedDB reale. `createReviewPersister` prende uno storage INIETTABILE:
// qui gli si passa uno storage in memoria che, come IndexedDB, conserva l'OGGETTO
// snapshot (structured clone), non una stringa `JSON`. Il round-trip
// `persistClient`→`restoreClient` deve riportare la mutation `["review"]` `paused` con
// le variabili integre e i `Date` ancora `Date` — la prova che `serialize` identità +
// storage a oggetti preservano i `Date` che `JSON` romperebbe.
//
// AC5 — il persister persiste SOLO le mutation (config del provider), la coda non
//        scade (`maxAge: Infinity`, config del provider) e la scrittura è throttlata a
//        ≤ 250 ms. Qui si prova la FEDELTÀ del round-trip del persister (l'unica parte
//        del persister testabile senza browser); `maxAge`/`shouldDehydrateQuery` sono
//        opzioni del `PersistQueryClientProvider` in `main.tsx`, non del persister, e
//        il round-trip dehydrate/hydrate della coda è coperto da `reviewMutation.test`.
import {
  QueryClient,
  MutationObserver,
  dehydrate,
  hydrate,
  onlineManager,
} from '@tanstack/react-query';
import type {
  AsyncStorage,
  PersistedClient,
} from '@tanstack/react-query-persist-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewOutcome } from '../domain/schedule';
import type {
  ApplyReviewInput,
  ReviewRepository,
} from '../domain/ports/reviewRepository';
import {
  REVIEW_MUTATION_KEY,
  REVIEW_SYNC_SCOPE,
  registerReviewMutationDefaults,
} from '../features/study/reviewMutation';
import {
  createReviewPersister,
  reviewPersistOptions,
  resumeReviewQueue,
} from './reviewPersister';

const DUE_AT = new Date('2026-10-01T00:00:00.000Z');
const REVIEWED_AT = new Date('2026-09-26T12:00:00.000Z');

function makeInput(): ApplyReviewInput {
  return {
    reviewId: 'rev-persist-1',
    exerciseId: 'ex-1',
    outcome: 'good' satisfies ReviewOutcome,
    stage: 1,
    dueAt: DUE_AT,
    reviewedAt: REVIEWED_AT,
    usedExplanation: true,
  };
}

/**
 * Uno storage `AsyncStorage` in memoria che conserva l'OGGETTO passato tal quale
 * (come IndexedDB via structured clone), non una stringa. Il tipo `AsyncStorage<string>`
 * è la firma richiesta dal persister; con `serialize`/`deserialize` identità il valore
 * reale che scorre è l'oggetto `PersistedClient` — vedi `reviewPersister.ts`.
 */
function inMemoryStorage(): AsyncStorage<string> {
  const map = new Map<string, unknown>();
  return {
    getItem: (key) => (map.get(key) ?? null) as string | null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/**
 * Costruisce un `PersistedClient` reale con una mutation `["review"]` `paused` (le
 * variabili portano due `Date`): avvia la mutation offline via `MutationObserver` su un
 * QueryClient e ne dehydrata lo stato. È lo stesso snapshot che il provider persiste.
 */
async function buildPersistedClient(): Promise<PersistedClient> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setMutationDefaults([...REVIEW_MUTATION_KEY], {
    mutationFn: async () => {},
    scope: REVIEW_SYNC_SCOPE,
  });
  onlineManager.setOnline(false);
  const observer = new MutationObserver<unknown, Error, { input: ApplyReviewInput }>(
    qc,
    {
      mutationKey: [...REVIEW_MUTATION_KEY],
      scope: REVIEW_SYNC_SCOPE,
    },
  );
  void observer.mutate({ input: makeInput() });
  await Promise.resolve();
  const clientState = dehydrate(qc);
  qc.clear();
  return { timestamp: Date.now(), buster: '', clientState };
}

/** Una porta review il cui solo metodo esercitato è `applyReview` (spiato). */
function spyReview(
  applyReview: ReviewRepository['applyReview'],
): ReviewRepository {
  return {
    listDue: async () => [],
    listReviewLog: async () => [],
    applyReview,
  };
}

let realOnline: boolean;

beforeEach(() => {
  realOnline = onlineManager.isOnline();
});

afterEach(() => {
  onlineManager.setOnline(realOnline);
});

describe('4.2 — reviewPersister: fedeltà del round-trip e preservazione dei Date (AC5)', () => {
  it('persistClient → restoreClient riporta la mutation ["review"] paused', async () => {
    const persister = createReviewPersister(inMemoryStorage());
    const client = await buildPersistedClient();
    expect(client.clientState.mutations).toHaveLength(1);

    await persister.persistClient(client);
    const restored = await persister.restoreClient();

    expect(restored).toBeDefined();
    expect(restored?.clientState.mutations).toHaveLength(1);
    // È la coda della sincronizzazione: mutationKey e scope conservati.
    const mutation = restored?.clientState.mutations[0];
    expect(mutation?.mutationKey).toEqual([...REVIEW_MUTATION_KEY]);
  });

  it('i Date nelle variabili restano Date dopo il round-trip (serialize identità)', async () => {
    const persister = createReviewPersister(inMemoryStorage());
    const client = await buildPersistedClient();

    await persister.persistClient(client);
    const restored = await persister.restoreClient();

    const vars = restored?.clientState.mutations[0]?.state.variables as {
      input: ApplyReviewInput;
    };
    // La prova di AC5: `JSON` avrebbe reso questi stringhe; con lo storage a oggetti
    // (structured clone) e serialize identità restano `Date` con lo stesso istante.
    expect(vars.input.dueAt).toBeInstanceOf(Date);
    expect(vars.input.reviewedAt).toBeInstanceOf(Date);
    expect(vars.input.dueAt.getTime()).toBe(DUE_AT.getTime());
    expect(vars.input.reviewedAt.getTime()).toBe(REVIEWED_AT.getTime());
    expect(vars.input.reviewId).toBe('rev-persist-1');
  });

  it('removeClient svuota lo storage: un restore successivo è undefined', async () => {
    const persister = createReviewPersister(inMemoryStorage());
    const client = await buildPersistedClient();

    await persister.persistClient(client);
    await persister.removeClient();
    const restored = await persister.restoreClient();

    expect(restored).toBeUndefined();
  });
});

// Le opzioni di persist/hydrate e la ripresa sono ESTRATTE dai literali inline di
// `main.tsx` (`persistOptions={{ persister, ...reviewPersistOptions() }}`,
// `onSuccess={() => resumeReviewQueue(queryClient)}`) proprio per esercitarle qui: una
// regressione (rimozione di `onSuccess`, o `maxAge` che torna al default) romperebbe la
// promessa della story (la coda sopravvive ma non riparte) restando altrimenti verde.
describe('4.2 — reviewPersistOptions + resumeReviewQueue (wiring del provider testato)', () => {
  it('reviewPersistOptions: maxAge Infinity e shouldDehydrateQuery ⇒ false', () => {
    const options = reviewPersistOptions();
    expect(options.maxAge).toBe(Infinity);
    // La query NON va persistita: la funzione ritorna sempre `false`.
    const shouldDehydrateQuery = options.dehydrateOptions?.shouldDehydrateQuery;
    expect(shouldDehydrateQuery).toBeDefined();
    expect(
      shouldDehydrateQuery?.(undefined as never),
    ).toBe(false);
  });

  it('le opzioni dehydratano SOLO le mutation (nessuna query nello snapshot)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setMutationDefaults([...REVIEW_MUTATION_KEY], {
      mutationFn: async () => {},
      scope: REVIEW_SYNC_SCOPE,
    });
    // Una query seminata PIÙ una mutation paused offline: lo snapshot deve contenere
    // solo la mutation.
    qc.setQueryData(['x'], 1);
    onlineManager.setOnline(false);
    const observer = new MutationObserver<unknown, Error, { input: ApplyReviewInput }>(
      qc,
      { mutationKey: [...REVIEW_MUTATION_KEY], scope: REVIEW_SYNC_SCOPE },
    );
    void observer.mutate({ input: makeInput() });
    await Promise.resolve();

    const dehydrated = dehydrate(qc, reviewPersistOptions().dehydrateOptions);
    expect(dehydrated.queries).toHaveLength(0);
    expect(dehydrated.mutations).toHaveLength(1);

    qc.clear();
  });

  it('resumeReviewQueue drena una mutation paused quando torna online (una chiamata)', async () => {
    const applyReview = vi.fn<(input: ApplyReviewInput) => Promise<void>>(
      async () => {},
    );
    // Snapshot con una mutation paused, poi reidratato sul client target con la spia
    // ai default: è ciò che `resumeReviewQueue` deve far ripartire (non una fn del
    // componente, assente al reload).
    const client = await buildPersistedClient();
    const target = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(target, spyReview(applyReview));
    hydrate(target, client.clientState);
    expect(target.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);

    onlineManager.setOnline(true);
    resumeReviewQueue(target);
    // `resumeReviewQueue` non ritorna la Promise (fire-and-forget col `.catch`): si
    // lascia sfilare il microtask del drenaggio prima di asserire.
    await vi.waitFor(() => expect(applyReview).toHaveBeenCalledTimes(1));

    const passed = applyReview.mock.calls[0][0];
    expect(passed.reviewId).toBe('rev-persist-1');
    expect(passed.dueAt).toBeInstanceOf(Date);

    target.clear();
  });
});
