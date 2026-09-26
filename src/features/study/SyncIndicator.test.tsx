// Ambiente `node` (l'env globale della suite): il componente DERIVATO dalla coda
// (4.4) è testabile SENZA browser né IndexedDB reale. `useIsMutating` legge la
// `MutationCache` via `useSyncExternalStore` con lo snapshot calcolato in modo
// SINCRONO (server snapshot = stato corrente): `renderToStaticMarkup` in env
// `node` riflette quindi la coda seminata. La coda è seminata con la STESSA
// superficie di `reviewMutation.test.ts` (`MutationObserver` + `onlineManager`),
// così il test esercita la coda REALE e non un finto stato del componente.
//
// AC1 — coda con una mutation `['review']` `paused` ⇒ pastiglia con `role="status"`,
//        `aria-live="polite"`, testo `t('sync.pending')`, derivata da `useIsMutating`.
// AC2 — coda senza mutation `['review']` `pending` ⇒ markup vuoto (indicatore ASSENTE).
// AC3 — la pastiglia NON è un modale né un allarme (niente `danger`/`dialog`/`alert`/
//        `aria-live="assertive"`) ed è `pointer-events-none` (non bloccante).
// AC4 — 2+ mutation `paused` ⇒ output IDENTICO a una sola (invariante al conteggio):
//        `aria-live` annuncia una volta al cambio di stato, non a ogni risposta.
// Matrix — mutation di ALTRA chiave in volo ⇒ indicatore assente (filtro per chiave).
import { renderToStaticMarkup } from 'react-dom/server';
import {
  QueryClient,
  QueryClientProvider,
  MutationObserver,
  onlineManager,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { i18n } from '../../i18n';
import { SyncIndicator } from './SyncIndicator';
import {
  REVIEW_MUTATION_KEY,
  REVIEW_SYNC_SCOPE,
  registerReviewMutationDefaults,
  type ReviewMutationVars,
} from './reviewMutation';
import type { ReviewOutcome, ReviewState } from '../../domain/schedule';
import type {
  ApplyReviewInput,
  ReviewRepository,
} from '../../domain/ports/reviewRepository';

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

/** Una porta review inerte: `applyReview` non deve essere invocata (coda offline). */
function inertReview(): ReviewRepository {
  return {
    listDue: async () => [],
    listReviewLog: async () => [],
    applyReview: async () => {},
  };
}

/** Un QueryClient con i default della mutation registrati (come al bootstrap). */
function makeClient(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  registerReviewMutationDefaults(qc, inertReview());
  return qc;
}

/**
 * Semina UNA valutazione `['review']` OFFLINE via `MutationObserver` (la stessa
 * superficie che `useMutation` usa sotto): offline entra `paused`, quindi la
 * `Promise` di `mutate` NON risolve — non la si attende, si osserva lo stato dalla
 * coda. Stesso pattern di `reviewMutation.test.ts`.
 */
function seedPaused(qc: QueryClient, reviewId?: string): void {
  const observer = new MutationObserver<unknown, Error, ReviewMutationVars>(qc, {
    mutationKey: [...REVIEW_MUTATION_KEY],
    scope: REVIEW_SYNC_SCOPE,
  });
  void observer.mutate(makeVars(reviewId));
}

/** Rende `<SyncIndicator />` sotto un `QueryClientProvider` col client dato. */
function render(qc: QueryClient): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <SyncIndicator />
    </QueryClientProvider>,
  );
}

let realOnline: boolean;

beforeEach(async () => {
  // Salva e forza lo stato di rete deterministicamente (l'`onlineManager` è un
  // singleton di modulo condiviso): ogni test lo ripristina in afterEach.
  realOnline = onlineManager.isOnline();
  // La live region annuncia il testo `en`: fissa la lingua per un output stabile.
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  onlineManager.setOnline(realOnline);
  await i18n.changeLanguage('en');
});

describe('4.4 — un indicatore che non spaventa (derivato dalla coda, non bloccante)', () => {
  it('AC1 — coda con una mutation ["review"] paused ⇒ pastiglia status/polite col testo t("sync.pending")', async () => {
    const qc = makeClient();
    onlineManager.setOnline(false);
    seedPaused(qc);
    // Lascia sfilare la microtask in cui react-query mette la mutation in pausa.
    await Promise.resolve();

    const markup = render(qc);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    // Il testo è il VALORE di t(), non la chiave grezza.
    expect(markup).toContain(en.sync.pending);
    expect(markup).not.toContain('sync.pending');

    qc.clear();
  });

  it('AC2 — coda senza mutation ["review"] pending ⇒ markup vuoto (indicatore ASSENTE)', () => {
    const qc = makeClient();
    // Nessuna mutation seminata: la coda è vuota.
    const markup = render(qc);
    expect(markup).toBe('');
    // Nessuno stato «tutto sincronizzato» (l'indicatore è semplicemente assente).
    expect(markup).not.toContain(en.sync.pending);

    qc.clear();
  });

  it('AC3 — non è un modale né un allarme, ed è non bloccante (pointer-events-none)', async () => {
    const qc = makeClient();
    onlineManager.setOnline(false);
    seedPaused(qc);
    await Promise.resolve();

    const markup = render(qc);
    // Non un allarme: né colore d'allarme, né role/live d'allarme.
    expect(markup).not.toContain('danger');
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain('aria-live="assertive"');
    // Colore CALMO, positivo: il token d'accento sottotono (non solo l'assenza di
    // `danger`). Una regressione che togliesse il colore calmo verrebbe colta.
    expect(markup).toContain('bg-accent-subtle');
    expect(markup).toContain('text-accent');
    // Non un modale: nessun dialog né aria-modal.
    expect(markup).not.toContain('role="dialog"');
    expect(markup).not.toContain('aria-modal');
    // Non bloccante: non intercetta gli eventi.
    expect(markup).toContain('pointer-events-none');
    // Nessun controllo interattivo (nessun pulsante «riprova»/«chiudi»/«ignora»).
    expect(markup).not.toContain('<button');

    qc.clear();
  });

  it('AC4 — 2 mutation paused ⇒ output IDENTICO a una sola (invariante al conteggio)', async () => {
    const one = makeClient();
    onlineManager.setOnline(false);
    seedPaused(one, 'rev-1');
    await Promise.resolve();
    const markupOne = render(one);

    const two = makeClient();
    onlineManager.setOnline(false);
    seedPaused(two, 'rev-1');
    seedPaused(two, 'rev-2');
    await Promise.resolve();
    const markupTwo = render(two);

    // Il contenuto della live region non varia col numero di risposte accodate:
    // `aria-live` annuncia una volta alla comparsa, non a ogni risposta.
    expect(markupTwo).toBe(markupOne);
    expect(markupOne).toContain(en.sync.pending);

    one.clear();
    two.clear();
  });

  it('Matrix — una mutation di ALTRA chiave in volo ⇒ indicatore assente (filtro per REVIEW_MUTATION_KEY)', async () => {
    const qc = makeClient();
    // Default per una chiave DIVERSA, con una fn che non risolve: la mutation
    // resta `pending` (in volo) ma con `mutationKey` ≠ `['review']`.
    qc.setMutationDefaults(['other'], {
      mutationFn: () => new Promise<void>(() => {}),
    });
    const observer = new MutationObserver<unknown, Error, void>(qc, {
      mutationKey: ['other'],
    });
    void observer.mutate();
    await Promise.resolve();

    // `useIsMutating` filtra per la `REVIEW_MUTATION_KEY`: una chiave diversa non
    // conta, l'indicatore è assente.
    const markup = render(qc);
    expect(markup).toBe('');

    qc.clear();
  });

  it('Matrix (metà in volo) — mutation ["review"] ONLINE in volo (pending, non paused) ⇒ indicatore PRESENTE', async () => {
    const qc = makeClient();
    // Sovrascrive il default della `REVIEW_MUTATION_KEY` con una `mutationFn` che
    // NON risolve mai: online la mutation resta `pending` IN VOLO (non `paused`).
    // `useIsMutating` conta `status: 'pending'`, che copre sia l'in-volo sia la
    // pausa offline — questo test asserisce direttamente la metà «in volo».
    qc.setMutationDefaults([...REVIEW_MUTATION_KEY], {
      mutationFn: () => new Promise<void>(() => {}),
    });
    onlineManager.setOnline(true);
    const observer = new MutationObserver<unknown, Error, ReviewMutationVars>(qc, {
      mutationKey: [...REVIEW_MUTATION_KEY],
      scope: REVIEW_SYNC_SCOPE,
    });
    void observer.mutate(makeVars());
    await Promise.resolve();

    const markup = render(qc);
    expect(markup).toContain(en.sync.pending);

    qc.clear();
  });

  it('Guardia — sync.pending è STABILE (nessun placeholder di interpolazione in en/it)', () => {
    // La stabilità del testo è ciò che rende vero l'annuncio-una-volta (AC4): se
    // qualcuno aggiungesse un conteggio interpolato (`{{count}}`), ogni risposta
    // accodata cambierebbe la live region e la sommergerebbe. Questa guardia lo
    // blocca su ENTRAMBI i cataloghi (parità en/it).
    expect(en.sync.pending).not.toContain('{{');
    expect(itCatalog.sync.pending).not.toContain('{{');
  });
});
