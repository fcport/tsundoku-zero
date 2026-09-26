// Ambiente `node` (l'env globale della suite): la SIMULAZIONE END-TO-END della catena
// offline (4.5). La catena era già completa — la coda sopravvive alla chiusura (4.2), si
// drena da sola al ritorno della rete (4.3), ha un indicatore (4.4) — ma NIENTE provava
// end-to-end che RIAPPLICARE la stessa coda non falsi i dati: un drenaggio ritentato (blip
// di rete a metà invio, ack perso) o una coda ripresa due volte non devono produrre righe
// duplicate in `review_log` né far avanzare due volte lo stadio. Qui si compone l'INTERA
// catena client con la stessa superficie react-query di `reviewMutation.test.ts`
// (`MutationObserver` + `REVIEW_SYNC_SCOPE`, `onlineManager`, `dehydrate`/`hydrate`,
// `registerReviewMutationDefaults`): nessun browser, nessun IndexedDB reale, nessun DB vivo.
//
// VERIFICA IN DUE METÀ, ESPLICITAMENTE PONTICELLATE. «Applicato esattamente una volta» =
// (il client invia una `review_id` STABILE) ∘ (il server deduplica su quella `review_id`).
// La PRIMA metà è REALE e provata QUI a livello client: la `review_id` è congelata nelle
// variabili della mutation (generata in `SessionScreen` con `crypto.randomUUID()`),
// sopravvive al round-trip `dehydrate`/`hydrate` e viene RI-inviata identica dal `retry`
// dei default e da ogni ripresa. La SECONDA metà è il contratto SQL
// `ON CONFLICT (id) DO NOTHING` + update guardato da `from logged`, provato
// STRUTTURALMENTE (AST) da `migrations.test.ts` (Story 3.9): referenziato lì, NON duplicato
// qui. La porta `applyReview` modellata di questo test replica quel contratto solo per
// COMPORRE la simulazione osservabile («applicato una volta» a livello log/stadio) — non è
// la prova del server, ed è dichiarato così per non spacciare un mock auto-avverante per
// verifica.
//
// AC1 — coda `paused` recuperata → drenata → un ritentativo automatico ri-drena la STESSA
//        mutation (la porta ha già scritto la riga al 1º tentativo): `review_log` = 1 riga
//        per quella `review_id`, stessa `review_id` su entrambi i tentativi.
// AC2 — stessa `review_id` applicata due volte (ritentativo dopo throw transitorio
//        post-scrittura): lo stadio dell'esercizio è avanzato ESATTAMENTE una volta.
// AC3 — offline → più risposte `paused` con `review_id` distinte → dehydrate → NUOVO client
//        + default ri-registrati → hydrate → online → `resumePausedMutations()`: ogni
//        risposta applicata esattamente una volta, in ORDINE; una SECONDA
//        `resumePausedMutations()` non aggiunge nulla (le `success` non sono più `paused`).
// AC4 — ciclo di vita completo (persist → riapertura → resume → ritentativo): la
//        `review_id` che raggiunge la porta a ogni tentativo è quella dell'istante della
//        risposta, MAI rigenerata dal drenaggio né dal round-trip.
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
  registerReviewMutationDefaults,
  type ReviewMutationVars,
} from './reviewMutation';

// Le `Date` viaggiano FISSE (costanti tipo `reviewMutation.test.ts`), mai da `Date.now()`:
// il determinismo è un requisito. `dueAt`/`reviewedAt` sono i valori GIÀ CALCOLATI di Epic 3.
const DUE_AT = new Date('2026-10-01T00:00:00.000Z');
const REVIEWED_AT = new Date('2026-09-26T12:00:00.000Z');

/**
 * L'input pre-calcolato di una risposta (Epic 3): porta due `Date` e una `review_id`
 * generata UNA volta in `SessionScreen` con `crypto.randomUUID()`. Qui la `review_id` e
 * l'`exerciseId` sono parametri COSTANTI (mai `crypto.randomUUID()` nel test): è
 * esattamente la loro STABILITÀ per tutto il ciclo di vita che questa storia prova.
 */
function makeInput(reviewId = 'rev-1', exerciseId = 'ex-1'): ApplyReviewInput {
  return {
    reviewId,
    exerciseId,
    outcome: 'good' satisfies ReviewOutcome,
    stage: 1,
    dueAt: DUE_AT,
    reviewedAt: REVIEWED_AT,
    usedExplanation: false,
  };
}

/** Il `result` che viaggia nelle variabili (glue di cache, non attraversa la porta). */
function makeResult(exerciseId = 'ex-1'): ReviewState {
  return {
    exerciseId,
    stage: 1,
    dueAt: DUE_AT,
    reviewCount: 1,
    lapseCount: 0,
    lastReviewedAt: REVIEWED_AT,
  };
}

function makeVars(reviewId?: string, exerciseId?: string): ReviewMutationVars {
  return { input: makeInput(reviewId, exerciseId), result: makeResult(exerciseId) };
}

/**
 * Una porta `review` MODELLATA che rispecchia FEDELMENTE il contratto della RPC
 * `apply_review` (Story 3.9). Il `review_log` è una `Map` chiavata su `review_id` con
 * DEDUP (`on conflict (id) do nothing`); lo stadio per esercizio è una seconda `Map` che
 * avanza SOLO quando l'insert produce davvero una riga (la guardia `from logged`). Rende
 * osservabile «applicato esattamente una volta» a livello di log/stadio.
 *
 * `applyReview` è uno spy (`vi.fn`) così i test contano le chiamate e ispezionano l'input
 * di OGNI tentativo (la stessa `review_id`?). `failReviewIdsOnce` è l'insieme delle
 * `review_id` che devono throware UNA volta DOPO la scrittura (ack perso): la riga viene
 * scritta PRIMA dello throw, così il secondo tentativo trova la riga già presente ed esce
 * via dedup — è esattamente lì che l'idempotenza conta.
 */
function makeModeledReviewGate(failReviewIdsOnce: readonly string[] = []) {
  const reviewLog = new Map<string, ApplyReviewInput>();
  const stageByExercise = new Map<string, number>();
  const stageBumps = new Map<string, number>();
  const thrownFor = new Set<string>();
  const toFail = new Set(failReviewIdsOnce);

  const applyReview = vi.fn<(input: ApplyReviewInput) => Promise<void>>(
    async (input) => {
      // Insert idempotente: la riga si scrive SOLO se la `review_id` non è già presente.
      // È il `on conflict (id) do nothing` — un ritentativo con la STESSA id è un no-op.
      // `input.reviewId` (il campo generato dal client) è il valore memorizzato come
      // `review_log.id`: è quella colonna il bersaglio di `ON CONFLICT (id) DO NOTHING`
      // nella RPC reale (provato strutturalmente in `migrations.test.ts`, Story 3.9). NON
      // esiste un campo `id` separato — la Map va chiaviata su `input.reviewId`.
      const inserted = !reviewLog.has(input.reviewId);
      if (inserted) {
        reviewLog.set(input.reviewId, input);
        // GUARDIA `from logged`: lo stadio avanza SOLO su insert reale. Ritentativo
        // (conflitto) ⇒ 0 righe ⇒ 0 update ⇒ stadio NON riavanza (AD-7). Bump idempotente
        // sull'input RICEVUTO (passthrough, nessun ricalcolo Leitner qui).
        stageByExercise.set(input.exerciseId, input.stage);
        stageBumps.set(
          input.exerciseId,
          (stageBumps.get(input.exerciseId) ?? 0) + 1,
        );
      }
      // Ack perso: la scrittura è avvenuta (sopra), ma la risposta si perde e il `retry`
      // dei default ri-invia. Throw DOPO la scrittura, una sola volta per `review_id`.
      if (toFail.has(input.reviewId) && !thrownFor.has(input.reviewId)) {
        thrownFor.add(input.reviewId);
        throw new Error(`ack perso (transitorio) per ${input.reviewId}`);
      }
    },
  );

  const review: ReviewRepository = {
    listDue: async () => [],
    listReviewLog: async () => [],
    applyReview,
  };

  return { review, applyReview, reviewLog, stageByExercise, stageBumps };
}

/**
 * Avvia la mutation `['review']` via `MutationObserver` (la stessa superficie che
 * `useMutation` usa sotto), con `mutationKey`+`scope` della coda. Offline entra `paused`:
 * la `Promise` di `mutate` NON risolve finché la rete non torna, quindi NON la si attende
 * offline — si osserva lo stato dalla coda. Ritorna la `Promise` così un chiamante online
 * può attenderla.
 */
function startMutation(qc: QueryClient, vars: ReviewMutationVars): Promise<unknown> {
  const observer = new MutationObserver<unknown, Error, ReviewMutationVars>(qc, {
    mutationKey: [...REVIEW_MUTATION_KEY],
    scope: REVIEW_SYNC_SCOPE,
  });
  return observer.mutate(vars);
}

/**
 * Avvia la mutation `['review']` con `retryDelay: 0` a livello di observer: i default
 * portano il `retry` (numero di ritentativi) MA il backoff reale rallenterebbe il test,
 * quindi si sovrascrive SOLO il delay a 0 — il `retry` continua a venire dai default, come
 * in produzione. Evita fake-timer fragili (Design Notes della spec, «backoff neutralizzato
 * con retryDelay: 0 a livello observer, il conteggio retry resta dai default»).
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

/** Tutte le mutation nel mutation-cache del client, nell'ordine di creazione. */
function allMutations(qc: QueryClient) {
  return qc.getMutationCache().getAll();
}

// I QueryClient creati da `makeClient()` sono registrati qui e ripuliti in `afterEach`,
// SEMPRE — anche se un `expect` fallisce a metà test. Senza, un client (con eventuali
// timer di backoff dei ritentativi ancora pendenti) lasciato vivo dal percorso di
// fallimento colerebbe nei test successivi contaminando lo stato condiviso.
const clients: QueryClient[] = [];

/**
 * Crea un QueryClient con la config canonica dei test (`retry: false` sulle query: nessun
 * refetch fantasma) e lo registra per la pulizia in `afterEach`. Sostituisce ogni
 * `new QueryClient(...)` nei test così la pulizia è garantita anche sui percorsi di errore.
 */
function makeClient(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(qc);
  return qc;
}

let realOnline: boolean;

beforeEach(() => {
  // Salva e forza lo stato di rete deterministicamente (l'`onlineManager` è un singleton
  // di modulo condiviso): ogni test lo ripristina in afterEach.
  realOnline = onlineManager.isOnline();
});

afterEach(() => {
  // Pulizia INCONDIZIONATA dei client creati nel test (anche se un `expect` è fallito
  // prima delle `.clear()` a fine corpo): svuota le cache e tronca i timer pendenti, poi
  // ripristina il singleton `onlineManager`.
  clients.forEach((c) => c.clear());
  clients.length = 0;
  onlineManager.setOnline(realOnline);
});

describe('4.5 — riapplicare la coda non falsa niente (idempotenza end-to-end)', () => {
  it('AC1 — coda paused recuperata, un ritentativo ri-drena: 1 sola riga per la review_id, stessa id su entrambi i tentativi', async () => {
    // La porta scrive la riga al 1º tentativo poi throwa UNA volta (ack perso): il `retry`
    // dei default ri-drena la STESSA mutation.
    const { review, applyReview, reviewLog } = makeModeledReviewGate(['rev-ac1']);

    // Sessione offline: la risposta entra `paused` (nessun `applyReview`).
    const source = makeClient();
    registerReviewMutationDefaults(source, review);
    onlineManager.setOnline(false);
    void startMutation(source, makeVars('rev-ac1'));
    await Promise.resolve();
    expect(source.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);
    expect(applyReview).not.toHaveBeenCalled();

    // Riapertura: NUOVO client, default RI-registrati PRIMA dell'hydrate (ordine di
    // bootstrap di `main.tsx`; senza, `No mutationFn found` — AD-8 vincolo 1).
    const dehydrated = dehydrate(source);
    const target = makeClient();
    registerReviewMutationDefaults(target, review);
    hydrate(target, dehydrated);

    // Ritorno rete → resume. La ripresa drena la mutation reidratata via la `mutationFn`
    // di DEFAULT (non un observer nostro): il `retry` dei default assorbe da solo il throw
    // post-scrittura, quindi 2 tentativi, entrambi con la STESSA `review_id`. Il backoff è
    // quello reale dei default (un ritentativo, ~1s): NON un fake-timer (vietato dalla
    // spec) — la neutralizzazione a `retryDelay: 0` a livello observer si applica ai casi
    // avviati da noi (AC2), non a una mutation ripresa da `resumePausedMutations`.
    onlineManager.setOnline(true);
    await target.resumePausedMutations();

    // Due tentativi (ack perso al 1º), STESSA `review_id` su entrambi.
    expect(applyReview).toHaveBeenCalledTimes(2);
    expect(applyReview.mock.calls[0][0].reviewId).toBe('rev-ac1');
    expect(applyReview.mock.calls[1][0].reviewId).toBe('rev-ac1');
    // `review_log` modellato: ESATTAMENTE una riga per quella id (dedup reale al 2º).
    expect(reviewLog.size).toBe(1);
    expect(reviewLog.has('rev-ac1')).toBe(true);
  });

  it('AC2 — stessa review_id applicata due volte (throw transitorio post-scrittura): lo stadio avanza ESATTAMENTE una volta', async () => {
    // Caso reale: il 1º invio scrive la riga e avanza lo stadio, l'ack si perde, il
    // `retry` ri-invia; il 2º tentativo trova la riga già presente ed esce via dedup ⇒
    // stadio NON riavanza (update guardato dall'insert). `retryDelay: 0` a livello observer.
    const { review, applyReview, stageBumps, stageByExercise } =
      makeModeledReviewGate(['rev-ac2']);
    const qc = makeClient();
    registerReviewMutationDefaults(qc, review);

    onlineManager.setOnline(true);
    await startMutationNoDelay(qc, makeVars('rev-ac2'));

    // Ritentativo automatico: due chiamate, stessa `review_id`.
    expect(applyReview).toHaveBeenCalledTimes(2);
    expect(applyReview.mock.calls[0][0].reviewId).toBe('rev-ac2');
    expect(applyReview.mock.calls[1][0].reviewId).toBe('rev-ac2');
    // Lo stadio dell'esercizio è avanzato ESATTAMENTE una volta (guardia `from logged`).
    expect(stageBumps.get('ex-1')).toBe(1);
    expect(stageByExercise.get('ex-1')).toBe(1);
  });

  it('AC3 — offline (N risposte distinte) → dehydrate → NUOVO client + default → hydrate → online → resume: ognuna applicata una volta, in ordine; una 2ª resume è no-op', async () => {
    const { review, applyReview, reviewLog } = makeModeledReviewGate();

    // Sessione offline con N=3 risposte, `review_id` (ed `exerciseId`) DISTINTE, tutte
    // `paused`. Stesso `mutationKey`+`scope` ⇒ lo scope le serializza in ordine.
    const source = makeClient();
    registerReviewMutationDefaults(source, review);
    onlineManager.setOnline(false);
    void startMutation(source, makeVars('rev-A', 'ex-A'));
    void startMutation(source, makeVars('rev-B', 'ex-B'));
    void startMutation(source, makeVars('rev-C', 'ex-C'));
    await Promise.resolve();
    expect(allMutations(source)).toHaveLength(3);
    expect(allMutations(source).every((m) => m.state.isPaused)).toBe(true);
    expect(applyReview).not.toHaveBeenCalled();

    // Chiusura/riapertura: dehydrate persiste SOLO le pause; NUOVO client con default
    // RI-registrati PRIMA dell'hydrate (ordine di bootstrap di `main.tsx`).
    const dehydrated = dehydrate(source);
    expect(dehydrated.mutations).toHaveLength(3);
    const target = makeClient();
    registerReviewMutationDefaults(target, review);
    hydrate(target, dehydrated);

    // Ritorno rete → resume: ogni risposta applicata ESATTAMENTE una volta, in ORDINE
    // (scope seriale A→B→C), ciascuna con la propria `review_id` stabile.
    onlineManager.setOnline(true);
    await target.resumePausedMutations();

    expect(applyReview).toHaveBeenCalledTimes(3);
    expect(applyReview.mock.calls.map((c) => c[0].reviewId)).toEqual([
      'rev-A',
      'rev-B',
      'rev-C',
    ]);
    // Log modellato = N righe distinte, una per `review_id`.
    expect(reviewLog.size).toBe(3);
    expect([...reviewLog.keys()].sort()).toEqual(['rev-A', 'rev-B', 'rev-C']);
    expect(allMutations(target).every((m) => m.state.status === 'success')).toBe(true);

    // Coda ripresa DUE volte: le mutation risolte non sono più `paused`, quindi una
    // seconda `resumePausedMutations()` NON aggiunge alcuna applicazione (0 chiamate in
    // più). Questa è la metà CLIENT di «drenata due volte → nessun doppione», non dipende
    // dal dedup della porta.
    await target.resumePausedMutations();
    expect(applyReview).toHaveBeenCalledTimes(3);
    expect(reviewLog.size).toBe(3);
  });

  it('AC4 — ciclo di vita completo (persist → riapertura → resume → ritentativo): la review_id raggiunge la porta MAI rigenerata, sempre quella dell istante della risposta', async () => {
    // Una risposta offline la cui `review_id` deve sopravvivere IDENTICA a: persist
    // (dehydrate/hydrate) + resume + un ritentativo (throw transitorio post-scrittura).
    const { review, applyReview, reviewLog } = makeModeledReviewGate(['rev-lifecycle']);

    const source = makeClient();
    registerReviewMutationDefaults(source, review);
    onlineManager.setOnline(false);
    void startMutation(source, makeVars('rev-lifecycle'));
    await Promise.resolve();
    expect(source.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);

    // Round-trip persist: la `review_id` (e le `Date`) sopravvivono al dehydrate/hydrate.
    const dehydrated = dehydrate(source);
    const target = makeClient();
    registerReviewMutationDefaults(target, review);
    hydrate(target, dehydrated);
    // La `review_id` reidratata è quella dell'istante della risposta, non rigenerata.
    const restoredVars = target.getMutationCache().getAll()[0]?.state
      .variables as ReviewMutationVars;
    expect(restoredVars.input.reviewId).toBe('rev-lifecycle');
    expect(restoredVars.input.dueAt).toBeInstanceOf(Date);
    expect(restoredVars.input.dueAt.getTime()).toBe(DUE_AT.getTime());
    expect(restoredVars.input.reviewedAt.getTime()).toBe(REVIEWED_AT.getTime());
    // L'INTERO input pre-calcolato (reviewId, exerciseId, outcome, stage, dueAt,
    // reviewedAt, usedExplanation) sopravvive IDENTICO al dehydrate/hydrate: non solo la
    // chiave, ma ogni campo che la RPC riceve già calcolato (Epic 3, nessun ricalcolo).
    expect(restoredVars.input).toEqual(makeInput('rev-lifecycle'));

    // Resume → ritentativo: la porta è chiamata su OGNI tentativo con la STESSA
    // `review_id` — quella dell'istante della risposta, mai rigenerata dal drenaggio.
    onlineManager.setOnline(true);
    await target.resumePausedMutations();

    expect(applyReview).toHaveBeenCalledTimes(2);
    for (const call of applyReview.mock.calls) {
      expect(call[0].reviewId).toBe('rev-lifecycle');
      // A ogni tentativo anche `dueAt`/`reviewedAt` sono quelli originali (non ricalcolati).
      expect(call[0].dueAt.getTime()).toBe(DUE_AT.getTime());
      expect(call[0].reviewedAt.getTime()).toBe(REVIEWED_AT.getTime());
    }
    // Il payload del 2º tentativo (il ritentativo) è VALUE-identico al 1º: la coda ri-invia
    // gli STESSI identici dati, non solo la stessa `review_id`.
    expect(applyReview.mock.calls[1][0]).toEqual(applyReview.mock.calls[0][0]);
    // Nonostante due tentativi, una sola riga per quella id (dedup della metà server).
    expect(reviewLog.size).toBe(1);
    expect(reviewLog.has('rev-lifecycle')).toBe(true);
  });

  it('Matrix — coda ripresa due volte (senza ritentativo): la 2ª resume non re-invoca applyReview (mutation success non più paused)', async () => {
    // Drenaggio riuscito al primo colpo (nessun throw): dopo il resume la mutation è
    // `success`, non più `paused`. Una seconda `resumePausedMutations()` è un no-op.
    const { review, applyReview, reviewLog } = makeModeledReviewGate();
    const source = makeClient();
    registerReviewMutationDefaults(source, review);
    onlineManager.setOnline(false);
    void startMutation(source, makeVars('rev-once'));
    await Promise.resolve();

    const dehydrated = dehydrate(source);
    const target = makeClient();
    registerReviewMutationDefaults(target, review);
    hydrate(target, dehydrated);

    onlineManager.setOnline(true);
    await target.resumePausedMutations();
    expect(applyReview).toHaveBeenCalledTimes(1);
    expect(target.getMutationCache().getAll()[0]?.state.status).toBe('success');

    // Seconda ripresa: 0 chiamate aggiuntive, log invariato.
    await target.resumePausedMutations();
    expect(applyReview).toHaveBeenCalledTimes(1);
    expect(reviewLog.size).toBe(1);
  });
});
