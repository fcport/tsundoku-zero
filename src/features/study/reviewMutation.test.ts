// Ambiente `node` (l'env globale della suite): il CUORE della coda durevole (4.2) è
// testabile SENZA browser né IndexedDB reale — la registrazione dei default, la pausa
// offline, il round-trip dehydrate→hydrate della coda e la ripresa. Lo storage
// IndexedDB (glue di `app`) è coperto a parte da `reviewPersister.test.ts` iniettando
// uno storage in memoria; qui si esercita la SUPERFICIE react-query direttamente
// (`MutationObserver` + `dehydrate`/`hydrate` + `onlineManager`), che è ciò che il
// persister muove sotto.
//
// AC1 — una valutazione avviata offline entra `paused`, `applyReview` NON è chiamata.
// AC2 — dehydrate → NUOVO client → register default → hydrate: la mutation `paused` è
//        di nuovo presente con le variabili integre (`dueAt`/`reviewedAt` sono `Date`).
// AC3 — con la rete tornata, `resumePausedMutations()` esegue la `mutationFn` di
//        default UNA volta con l'input originale, senza `No mutationFn found`.
// Matrix — riapertura offline: reidratata ma ancora offline resta `paused`, nessun
//        `applyReview`; regressione — senza default registrati prima del restore la
//        ripresa fallirebbe con `No mutationFn found` (prevenuto dall'ordine).
import {
  QueryClient,
  MutationObserver,
  dehydrate,
  hydrate,
  onlineManager,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewOutcome, ReviewState } from '../../domain/schedule';
import type {
  ApplyReviewInput,
  ReviewRepository,
} from '../../domain/ports/reviewRepository';
import {
  REVIEW_MUTATION_KEY,
  REVIEW_SYNC_SCOPE,
  REVIEW_SYNC_MAX_RETRIES,
  registerReviewMutationDefaults,
  type ReviewMutationVars,
} from './reviewMutation';

const DUE_AT = new Date('2026-10-01T00:00:00.000Z');
const REVIEWED_AT = new Date('2026-09-26T12:00:00.000Z');

/** L'input pre-calcolato di una risposta (Epic 3): porta due `Date`. */
function makeInput(reviewId = 'rev-1'): ApplyReviewInput {
  return {
    reviewId,
    exerciseId: 'ex-1',
    outcome: 'good' satisfies ReviewOutcome,
    stage: 1,
    dueAt: DUE_AT,
    reviewedAt: REVIEWED_AT,
    usedExplanation: false,
  };
}

/** Il `result` che viaggia nelle variabili (glue di cache, non attraversa la porta). */
function makeResult(): ReviewState {
  return {
    exerciseId: 'ex-1',
    stage: 1,
    dueAt: DUE_AT,
    reviewCount: 1,
    lapseCount: 0,
    lastReviewedAt: REVIEWED_AT,
  };
}

function makeVars(reviewId?: string): ReviewMutationVars {
  return { input: makeInput(reviewId), result: makeResult() };
}

/** Una porta review il cui solo metodo esercitato è `applyReview` (spiato). */
function spyReview(applyReview: ReviewRepository['applyReview']): ReviewRepository {
  return {
    listDue: async () => [],
    listReviewLog: async () => [],
    applyReview,
  };
}

/**
 * Avvia la mutation `['review']` via `MutationObserver` (la stessa superficie che
 * `useMutation` usa sotto). Offline entra `paused`: la `Promise` di `mutate` NON
 * risolve finché la rete non torna, quindi NON la si attende qui — si osserva lo stato
 * dalla coda. Ritorna la `Promise` così un chiamante online può attenderla.
 */
function startMutation(qc: QueryClient, vars: ReviewMutationVars): Promise<unknown> {
  const observer = new MutationObserver<unknown, Error, ReviewMutationVars>(qc, {
    mutationKey: [...REVIEW_MUTATION_KEY],
    scope: REVIEW_SYNC_SCOPE,
  });
  return observer.mutate(vars);
}

/** L'unica mutation nel mutation-cache del client, o `undefined`. */
function onlyMutation(qc: QueryClient) {
  return qc.getMutationCache().getAll()[0];
}

let realOnline: boolean;

beforeEach(() => {
  // Salva e forza lo stato di rete deterministicamente (l'`onlineManager` è un
  // singleton di modulo condiviso): ogni test lo ripristina in afterEach.
  realOnline = onlineManager.isOnline();
});

afterEach(() => {
  onlineManager.setOnline(realOnline);
});

describe('4.2 — la coda di valutazioni sopravvive alla chiusura (default + persist + resume)', () => {
  it('AC1 — offline, la mutation ["review"] entra paused e applyReview NON è chiamata', async () => {
    const applyReview = vi.fn(async () => {});
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(qc, spyReview(applyReview));

    onlineManager.setOnline(false);
    void startMutation(qc, makeVars());
    // Lascia sfilare la microtask in cui react-query mette la mutation in pausa.
    await Promise.resolve();

    const mutation = onlyMutation(qc);
    expect(mutation).toBeDefined();
    expect(mutation?.state.isPaused).toBe(true);
    expect(applyReview).not.toHaveBeenCalled();

    qc.clear();
  });

  it('AC2 — dehydrate → NUOVO client → register default → hydrate: la coda sopravvive, Date integre', async () => {
    const source = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(source, spyReview(async () => {}));

    onlineManager.setOnline(false);
    void startMutation(source, makeVars());
    await Promise.resolve();
    expect(onlyMutation(source)?.state.isPaused).toBe(true);

    // Il dehydrate di default persiste SOLO le mutation in pausa
    // (`defaultShouldDehydrateMutation` = `isPaused`); niente query (nessuna qui).
    const dehydrated = dehydrate(source);
    expect(dehydrated.mutations).toHaveLength(1);

    // NUOVO client (simula la riapertura dell'app): i default DEVONO essere registrati
    // PRIMA dell'hydrate — l'hydrate applica i default per `mutationKey`.
    const target = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(target, spyReview(async () => {}));
    hydrate(target, dehydrated);

    const restored = onlyMutation(target);
    expect(restored).toBeDefined();
    expect(restored?.state.isPaused).toBe(true);
    // Le variabili sono integre e i `Date` sono ANCORA `Date` (nel round-trip in
    // memoria; il persister IndexedDB li preserva via structured clone — 4.2 persister
    // test). `instanceof Date` è la prova che `JSON` non li ha appiattiti a stringa.
    const vars = restored?.state.variables as ReviewMutationVars;
    expect(vars.input.dueAt).toBeInstanceOf(Date);
    expect(vars.input.reviewedAt).toBeInstanceOf(Date);
    expect(vars.input.dueAt.getTime()).toBe(DUE_AT.getTime());
    expect(vars.input.reviewedAt.getTime()).toBe(REVIEWED_AT.getTime());
    expect(vars.input.reviewId).toBe('rev-1');

    source.clear();
    target.clear();
  });

  it('AC3 — tornata la rete, resumePausedMutations esegue applyReview UNA volta con l input originale', async () => {
    const applyReview = vi.fn<(input: ApplyReviewInput) => Promise<void>>(
      async () => {},
    );
    const source = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(source, spyReview(async () => {}));

    onlineManager.setOnline(false);
    void startMutation(source, makeVars('rev-42'));
    await Promise.resolve();

    const dehydrated = dehydrate(source);
    const target = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // La `mutationFn` di default del NUOVO client è quella spiata: è ciò che deve
    // eseguire la ripresa (non una funzione del componente, assente al reload).
    registerReviewMutationDefaults(target, spyReview(applyReview));
    hydrate(target, dehydrated);

    // La rete torna, poi la ripresa all'avvio (via `onSuccess` del provider in prod).
    onlineManager.setOnline(true);
    await target.resumePausedMutations();

    expect(applyReview).toHaveBeenCalledTimes(1);
    const passed = applyReview.mock.calls[0][0];
    expect(passed.reviewId).toBe('rev-42');
    expect(passed.dueAt).toBeInstanceOf(Date);
    expect(passed.dueAt.getTime()).toBe(DUE_AT.getTime());
    // Nessun `No mutationFn found`: la mutation è risolta (non in errore per fn mancante).
    const resumed = onlyMutation(target);
    expect(resumed?.state.status).toBe('success');

    source.clear();
    target.clear();
  });

  it('Matrix — riaperta ma ANCORA offline: resta paused, nessun applyReview', async () => {
    const applyReview = vi.fn(async () => {});
    const source = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(source, spyReview(async () => {}));

    onlineManager.setOnline(false);
    void startMutation(source, makeVars());
    await Promise.resolve();

    const dehydrated = dehydrate(source);
    const target = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(target, spyReview(applyReview));
    hydrate(target, dehydrated);

    // Ancora offline: la ripresa non drena nulla (le pause restano in pausa).
    await target.resumePausedMutations();

    expect(onlyMutation(target)?.state.isPaused).toBe(true);
    expect(applyReview).not.toHaveBeenCalled();

    source.clear();
    target.clear();
  });

  it('Regressione — SENZA default registrati la ripresa fallirebbe (No mutationFn found)', async () => {
    const source = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(source, spyReview(async () => {}));

    onlineManager.setOnline(false);
    void startMutation(source, makeVars());
    await Promise.resolve();

    const dehydrated = dehydrate(source);
    // NUOVO client SENZA `registerReviewMutationDefaults`: l'ordine corretto
    // (register → restore) è ciò che previene questo fallimento; qui lo dimostriamo.
    const target = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(target, dehydrated);

    onlineManager.setOnline(true);
    await target.resumePausedMutations();

    const mutation = onlyMutation(target);
    expect(mutation?.state.status).toBe('error');
    expect(String(mutation?.state.error)).toContain('No mutationFn found');

    source.clear();
    target.clear();
  });
});

/** Un deferred `Promise` esterno: risolve/rigetta quando il test lo decide. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Avvia la mutation `['review']` con un `retryDelay: 0` a livello di observer: i default
 * portano il `retry` (numero di ritentativi) MA il backoff reale rallenterebbe il test,
 * quindi si sovrascrive SOLO il delay a 0 — il `retry` continua a venire dai default,
 * come in produzione. Evita fake-timer fragili (vedi Design Notes della spec).
 */
function startMutationNoDelay(
  qc: QueryClient,
  vars: ReviewMutationVars,
): Promise<unknown> {
  const observer = new MutationObserver<unknown, Error, ReviewMutationVars>(qc, {
    mutationKey: [...REVIEW_MUTATION_KEY],
    scope: REVIEW_SYNC_SCOPE,
    retryDelay: 0,
  });
  return observer.mutate(vars);
}

describe('4.3 — il ritorno della rete non chiede il permesso (serie/ordine, coerenza, retry)', () => {
  it('backoff — i default portano retry = REVIEW_SYNC_MAX_RETRIES e retryDelay = min(1000·2^attempt, 30_000)', () => {
    // I test di retry sovrascrivono `retryDelay: 0` a livello observer per non attendere
    // il backoff: senza QUESTO test la formula di produzione (base 1000, esponente 2,
    // tetto 30 s) resterebbe SCOPERTA e una regressione (tetto perso, base/segno errati)
    // spedirebbe verde. Qui si leggono i default SPEDITI e si asserisce la formula
    // direttamente, senza fake-timer.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(qc, spyReview(async () => {}));

    const defaults = qc.getMutationDefaults([...REVIEW_MUTATION_KEY]);
    expect(defaults.retry).toBe(REVIEW_SYNC_MAX_RETRIES);

    // `retryDelay` sui default è una union (numero | funzione | undefined): si restringe
    // a funzione prima di invocarla, così il typecheck resta pulito.
    const retryDelay = defaults.retryDelay;
    expect(typeof retryDelay).toBe('function');
    if (typeof retryDelay !== 'function') {
      throw new Error('retryDelay non è una funzione');
    }

    // La formula: raddoppio esponenziale (1000·2^attempt)…
    expect(retryDelay(0, new Error())).toBe(1000);
    expect(retryDelay(1, new Error())).toBe(2000);
    expect(retryDelay(2, new Error())).toBe(4000);
    // …con il TETTO a 30 s (`Math.min`): un attempt alto non supera il cap.
    expect(retryDelay(20, new Error())).toBe(30_000);

    qc.clear();
  });

  it('AC2 — due mutation stesso scope: la seconda applyReview non parte finché la prima non si risolve, ordine A prima di B', async () => {
    const order: string[] = [];
    const firstGate = deferred();
    const applyReview = vi.fn<(input: ApplyReviewInput) => Promise<void>>(
      async (input) => {
        order.push(input.reviewId);
        // La PRIMA (`A`) resta appesa al gate: finché non lo risolviamo, lo scope
        // serializza e la seconda (`B`) NON deve partire.
        if (input.reviewId === 'A') await firstGate.promise;
      },
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(qc, spyReview(applyReview));

    onlineManager.setOnline(true);
    // Due risposte accodate online, stesso `mutationKey`+`scope`: A poi B.
    const pA = startMutation(qc, makeVars('A'));
    const pB = startMutation(qc, makeVars('B'));
    // Lascia sfilare i microtask: A parte, B resta in attesa dello scope.
    await Promise.resolve();
    await Promise.resolve();

    // Solo A è in volo: lo scope tiene B in coda finché A non si risolve.
    expect(applyReview).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['A']);

    // Sblocca A: solo ORA B può partire, e dopo A (ordine preservato).
    firstGate.resolve();
    await Promise.all([pA, pB]);

    expect(applyReview).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['A', 'B']);

    qc.clear();
  });

  it('AC3 — drenata più tardi (nuovo client, hydrate, resume): stesso outcome, stesso dueAt, reviewedAt = istante della risposta, nessun ricalcolo', async () => {
    const applyReview = vi.fn<(input: ApplyReviewInput) => Promise<void>>(
      async () => {},
    );
    const source = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(source, spyReview(async () => {}));

    // Risposta creata OFFLINE con esito/`dueAt`/`reviewedAt` fissati (Epic 3, mai
    // ricalcolati): entra `paused`.
    onlineManager.setOnline(false);
    void startMutation(source, makeVars('rev-consistency'));
    await Promise.resolve();
    expect(onlyMutation(source)?.state.isPaused).toBe(true);

    // Round-trip: NUOVO client (riapertura), default registrati PRIMA dell'hydrate.
    const dehydrated = dehydrate(source);
    const target = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(target, spyReview(applyReview));
    hydrate(target, dehydrated);

    // Tornata la rete, la ripresa drena: `applyReview` riceve ESATTAMENTE l'input
    // originale — nessuna `mutationFn` che ricalcola o rimpiazza `reviewedAt` con «ora».
    onlineManager.setOnline(true);
    await target.resumePausedMutations();

    expect(applyReview).toHaveBeenCalledTimes(1);
    const passed = applyReview.mock.calls[0][0];
    expect(passed.reviewId).toBe('rev-consistency');
    expect(passed.outcome).toBe('good');
    expect(passed.stage).toBe(1);
    expect(passed.dueAt).toBeInstanceOf(Date);
    expect(passed.dueAt.getTime()).toBe(DUE_AT.getTime());
    // `reviewedAt` è l'istante della RISPOSTA originale, NON ricalcolato a «ora».
    expect(passed.reviewedAt).toBeInstanceOf(Date);
    expect(passed.reviewedAt.getTime()).toBe(REVIEWED_AT.getTime());

    source.clear();
    target.clear();
  });

  it('AC4 — applyReview fallisce una volta poi risolve: ritentativo AUTOMATICO (2 chiamate), la mutation finisce success', async () => {
    let attempts = 0;
    const applyReview = vi.fn<(input: ApplyReviewInput) => Promise<void>>(
      async () => {
        attempts += 1;
        // Il PRIMO invio fallisce (errore transitorio), il secondo risolve: è ciò che
        // il `retry` dei default deve assorbire da solo.
        if (attempts === 1) throw new Error('errore di invio transitorio');
      },
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(qc, spyReview(applyReview));

    onlineManager.setOnline(true);
    // `retryDelay: 0` a livello observer: il `retry` viene dai default, il backoff no.
    await startMutationNoDelay(qc, makeVars('rev-retry'));

    // Ritentativo automatico: due chiamate, nessun intervento utente.
    expect(applyReview).toHaveBeenCalledTimes(2);
    expect(onlyMutation(qc)?.state.status).toBe('success');

    qc.clear();
  });

  it('AC4 (permanente) — applyReview fallisce sempre: dopo REVIEW_SYNC_MAX_RETRIES la mutation va in error', async () => {
    const applyReview = vi.fn<(input: ApplyReviewInput) => Promise<void>>(
      async () => {
        throw new Error('errore permanente');
      },
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerReviewMutationDefaults(qc, spyReview(applyReview));

    onlineManager.setOnline(true);
    // La `Promise` di `mutate` rigetta dopo l'esaurimento dei ritentativi: la si assorbe.
    await startMutationNoDelay(qc, makeVars('rev-permanent')).catch(() => {});

    // 1 tentativo iniziale + REVIEW_SYNC_MAX_RETRIES ritentativi = errore, non infinito.
    expect(applyReview).toHaveBeenCalledTimes(1 + REVIEW_SYNC_MAX_RETRIES);
    expect(onlyMutation(qc)?.state.status).toBe('error');

    qc.clear();
  });
});
