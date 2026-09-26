// Livello features/study (4.2): la FONTE UNICA della mutation di persistenza delle
// valutazioni — le costanti di identità della coda PIÙ la registrazione della sua
// `mutationFn` ai DEFAULT del QueryClient. Il perché sta tutto in un punto: alla
// riapertura dell'app il persister reidrata la coda di mutation PRIMA (o senza) che
// `SessionScreen` sia montato, e `resumePausedMutations()` risolve la `mutationFn`
// per `mutationKey` dai DEFAULT del client. Se la `mutationFn` vivesse solo nel
// componente non esisterebbe alla ripresa (`No mutationFn found`): perciò è
// registrata al BOOTSTRAP, mai in un componente.
//
// AD-1: questo modulo vive in `features` e importa SOLO `@tanstack/react-query` (il
// tipo `QueryClient`) e i tipi di DOMINIO (le porte). NON tocca `data`/`app` né il
// persister IndexedDB (quello è glue di `app`, `reviewPersister.ts`). Riusabile da
// app (bootstrap), dal componente (che avvia la mutation con la stessa key/scope) e
// dai test (che registrano i default sul loro QueryClient).
import type { QueryClient } from '@tanstack/react-query';
import type { ReviewState } from '../../domain/schedule';
import type {
  ApplyReviewInput,
  ReviewRepository,
} from '../../domain/ports/reviewRepository';

// La CHIAVE di mutation della coda delle valutazioni: l'identità con cui il
// componente avvia la mutation e con cui i default risolvono la `mutationFn` alla
// ripresa. Una sola definizione condivisa da app, componente e test.
export const REVIEW_MUTATION_KEY = ['review'] as const;

// Lo SCOPE della coda di sincronizzazione: uno scope condiviso serializza il
// drenaggio (una mutation in volo alla volta per scope). Il drenaggio in serie e in
// ORDINE — la seconda mutation non parte finché la prima non si risolve — è ORA
// verificato (4.3): con più risposte accodate lo scope garantisce A prima di B.
// Impostato allo stesso sito di registrazione così non diverge dalla `mutationFn`.
export const REVIEW_SYNC_SCOPE = { id: 'review-sync' } as const;

// Il numero MASSIMO di ritentativi di invio di una singola risposta (4.3). Un
// fallimento di invio mentre si è online si ritenta da solo — sicuro perché la RPC
// `apply_review` è idempotente per `review_id` (`on conflict do nothing`): un
// ritentativo con lo stesso `reviewId` è un no-op. MAI infinito: un errore
// permanente risale in `error` dopo questi ritentativi invece di girare all'infinito.
export const REVIEW_SYNC_MAX_RETRIES = 3;

/**
 * Le variabili della mutation `applyReview`: l'input PRE-CALCOLATO (Epic 3, mai
 * ricalcolato al drenaggio) PIÙ il `result` — usato dall'`onMutate` ottimistico del
 * componente per rimpiazzare lo stato in cache. Il `result` non attraversa la porta:
 * è glue locale della cache, ma viaggia nelle variabili così sopravvive al
 * dehydrate/hydrate della coda (anche se, ripreso in background al reload, l'onMutate
 * del componente non è presente — vedi Design Notes della spec).
 */
export interface ReviewMutationVars {
  readonly input: ApplyReviewInput;
  readonly result: ReviewState;
}

/**
 * Registra la `mutationFn` delle valutazioni ai DEFAULT del QueryClient per la
 * `REVIEW_MUTATION_KEY`, con lo `REVIEW_SYNC_SCOPE`. DEVE essere chiamata al
 * bootstrap PRIMA che il persister reidrati il client: l'hydrate applica i default
 * per `mutationKey`, quindi una coda reidratata trova la sua `mutationFn` solo se i
 * default sono già registrati (altrimenti `No mutationFn found` alla ripresa). La
 * `mutationFn` trasporta l'`input` già calcolato alla porta idempotente `applyReview`
 * (RPC `on conflict (review_id) do nothing`): nessun ricalcolo di esito/scadenza.
 */
export function registerReviewMutationDefaults(
  qc: QueryClient,
  review: ReviewRepository,
): void {
  qc.setMutationDefaults(REVIEW_MUTATION_KEY, {
    mutationFn: ({ input }: ReviewMutationVars) => review.applyReview(input),
    scope: REVIEW_SYNC_SCOPE,
    // Ritentativo AUTOMATICO del drenaggio (4.3): un fallimento di invio mentre si è
    // online si ritenta da solo, senza pulsante «riprova». Con `networkMode: 'online'`
    // (default) una mutation offline entra `paused` e NON consuma ritentativi — retry e
    // pausa coesistono. Backoff esponenziale LIMITATO (tetto a 30 s) e finito: dopo
    // `REVIEW_SYNC_MAX_RETRIES` un errore permanente risale in `error` (rollback
    // ottimistico del componente), non gira all'infinito.
    retry: REVIEW_SYNC_MAX_RETRIES,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}
