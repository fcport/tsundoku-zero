---
title: 'Il ritorno della rete non chiede il permesso'
type: 'feature'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '545af33f58a97cba9115f6beff24709267c02723'
context: []
warnings: [oversized]
deferred:
  - summary: >-
      Un fallimento di invio PERMANENTE (non di rete) esaurisce i ritentativi e
      lascia la risposta in stato `error`: non più `paused`, non ripersistita,
      persa al reload e senza alcun segnale all'utente.
    evidence: |-
      Con `retry: REVIEW_SYNC_MAX_RETRIES` finito, dopo l'ultimo fallimento la
      mutation esce da `paused` ⇒ il dehydrate (solo `isPaused`) non la ripersiste
      e `resumeReviewQueue` la assorbe col `.catch`. L'`onError` del componente fa
      il rollback ottimistico ma nessuno informa l'utente né riprova al riavvio.
      La visibilità è la storia 4.4 (indicatore) e l'idempotenza la 4.5, ma
      nessuna delle due garantisce il RECUPERO di un invio permanentemente fallito.
    location: >-
      src/features/study/reviewMutation.ts (retry); src/app/reviewPersister.ts (resumeReviewQueue .catch)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** La coda durevole delle valutazioni (4.2) sopravvive alla chiusura, ma il DRENAGGIO al ritorno della rete resta implicito e non ritenta. Oggi (1) non c'è un listener `online` esplicito che rilanci la coda quando il campo torna a metà sessione — il resume è affidato solo al ciclo di vita interno del provider e all'`onSuccess` del restore all'avvio; (2) la `mutationFn` NON ha alcun `retry` (i default di mutation di TanStack sono `retry: 0`), quindi un fallimento di invio mentre si è online lascia la risposta in errore senza ritentare; (3) il drenaggio in serie e la coerenza esito/scadenza sono FOUNDATIONAL da 4.2 (`scope: review-sync`, input pre-calcolato) ma non VERIFICATI. Per chi esce dalla galleria la promessa è «non devi fare niente»: la coda si sincronizza da sola, nell'ordine giusto, ritentando i fallimenti — senza un pulsante «riprova».

**Approach:** (1) Aggiungere un listener `online` ESPLICITO: `subscribeReviewQueueResume(queryClient)` in `src/app/reviewPersister.ts` che, alla transizione a online di `onlineManager`, chiama `resumeReviewQueue(queryClient)`; cablato in `main.tsx` per l'intera vita dell'app (accanto al resume all'avvio già esistente via `onSuccess`). (2) Aggiungere `retry` + `retryDelay` (backoff esponenziale limitato) ai default della mutation in `registerReviewMutationDefaults`, così un fallimento di invio si ritenta da solo — sicuro perché la RPC è idempotente per `review_id` (no-op al ritentativo). (3) VERIFICARE con test la coerenza (stesso esito/`due_at`, nessun ricalcolo) e il drenaggio in serie e in ordine garantito dallo `scope`. Nessun pulsante «riprova» né stato d'errore nuovo nell'interfaccia.

## Boundaries & Constraints

**Always:**
- Il resume al ritorno della rete è un listener `onlineManager` ESPLICITO e testabile in isolamento (`subscribeReviewQueueResume`), OLTRE al resume all'avvio già cablato in 4.2 (`onSuccess` del `PersistQueryClientProvider` → `resumeReviewQueue`). Entrambe le invocazioni passano per `resumeReviewQueue(queryClient)` → `queryClient.resumePausedMutations()`.
- Il `retry` vive nei DEFAULT della mutation (`registerReviewMutationDefaults`, `features/study`), accanto a `mutationFn` e `scope`: è la semantica di drenaggio della coda, non un dettaglio del componente. Un numero limitato di ritentativi con backoff (`REVIEW_SYNC_MAX_RETRIES`), MAI infinito (un errore permanente non deve girare all'infinito).
- Il drenaggio resta in SERIE e in ORDINE tramite `scope: REVIEW_SYNC_SCOPE` (già impostato in 4.2, alla registrazione dei default e sull'`useMutation` del componente): una mutation in volo per scope, le altre attendono.
- Il drenaggio NON ricalcola nulla: la `mutationFn` trasporta l'`input` GIÀ calcolato (esito e `dueAt` da `outcomeOf`/`schedule` sul client, `reviewedAt` = istante della risposta). Una risposta drenata più tardi produce lo STESSO esito e lo STESSO `dueAt` che avrebbe prodotto al momento.
- `retry` e la pausa offline coesistono correttamente: con `networkMode: 'online'` (default) una mutation offline entra `paused` (non consuma ritentativi); il `retry` scatta solo su un fallimento mentre si è online.
- Il core (listener online, retry, serie/ordine, coerenza) è testabile in ambiente `node` guidando `onlineManager` e la superficie react-query (`MutationObserver`/`dehydrate`/`hydrate`): nessun test richiede un browser reale o IndexedDB.

**Block If:** _Nessuna._ Il meccanismo (listener `onlineManager` + `retry` sui default di mutation) è fissato dalle Technical Decisions dell'epica e dalla boundary della 4.2 che delega esplicitamente qui «il ritentativo automatico», «il listener online per il resume» e «la verifica del drenaggio in ordine». Nessuna ambiguità richiede input umano.

**Never:**
- NON introdurre alcun pulsante «riprova» né un nuovo stato d'errore/toast bloccante nell'interfaccia: il ritentativo è automatico e invisibile. L'`onError` del componente resta il rollback ottimistico esistente (dopo l'esaurimento dei ritentativi), nessuna nuova superficie.
- NON introdurre l'indicatore di sincronizzazione (`sync-indicator`, storia 4.4) né la verifica e2e di idempotenza con app chiusa e riaperta (storia 4.5).
- NON ricalcolare esito/scadenza al drenaggio, né spostare il calcolo dal client alla `mutationFn`.
- NON usare `retry` infinito, né rimuovere/duplicare lo `scope` (romperebbe l'ordine del drenaggio).
- NON toccare la RPC/`applyReview` server (l'idempotenza esiste già da Epic 3) né lo store di sessione o la persistenza IndexedDB (4.2).
- NON gestire l'avvio a freddo senza rete / PWA (fuori scopo epica).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ritorno online a sessione viva | `onlineManager` va `online`, coda con mutation `paused`, `subscribeReviewQueueResume` attivo | il listener chiama `resumeReviewQueue` ⇒ `applyReview(input)` UNA volta, senza intervento utente | reject ⇒ ritentata da `retry` (vedi sotto) |
| Resta offline | listener attivo ma `onlineManager` ancora `offline` | nessun drenaggio: le mutation restano `paused`, `applyReview` non chiamata | No error expected |
| Drenaggio in serie | due mutation `['review']` stesso `scope`, online | la seconda `applyReview` NON parte finché la prima non si risolve; ordine preservato (A prima di B) | No error expected |
| Coerenza nel tempo | mutation creata offline (esito `good`, `dueAt`, `reviewedAt`), drenata più tardi (nuovo client, `hydrate`) | `applyReview` riceve ESATTAMENTE l'input originale: stesso `outcome`, stesso `dueAt`, `reviewedAt` = istante della risposta (non «ora») | No error expected |
| Fallimento di invio online | `applyReview` reject una volta poi risolve, online | ritentativo AUTOMATICO: `applyReview` chiamata di nuovo, la mutation finisce `success`; nessun pulsante «riprova» | il `retry` assorbe il fallimento transitorio |
| Fallimento permanente | `applyReview` reject sempre, online | dopo `REVIEW_SYNC_MAX_RETRIES` ritentativi la mutation va in `error`; `onError` del componente fa il rollback ottimistico; nessuna UI d'errore nuova | errore risale dopo i ritentativi, non prima |

</intent-contract>

## Code Map

- `src/features/study/reviewMutation.ts` -- **EDIT** (features): aggiungere `export const REVIEW_SYNC_MAX_RETRIES = 3` e, dentro `setMutationDefaults(REVIEW_MUTATION_KEY, …)`, i campi `retry: REVIEW_SYNC_MAX_RETRIES` e `retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000)` (backoff limitato). `mutationFn`/`scope` invariati. Aggiornare il commento di `REVIEW_SYNC_SCOPE` (riga 27-32): il drenaggio in serie che «4.3 verificherà» è ORA verificato. Confine features→domain invariato.
- `src/app/reviewPersister.ts` -- **EDIT** (app): aggiungere `export function subscribeReviewQueueResume(queryClient): () => void` che ritorna `onlineManager.subscribe((online) => { if (online) resumeReviewQueue(queryClient); })`. Importare `onlineManager` da `@tanstack/react-query`. Aggiornare il commento di `resumeReviewQueue` (riga 193-201): il `retry` ORA esiste sulla mutation, quindi il `.catch` assorbe la reject FINALE dopo i ritentativi esauriti (non «il retry è la 4.3»).
- `src/app/main.tsx:84-86` -- **EDIT**: dopo `registerReviewMutationDefaults(...)` e la creazione del persister, chiamare `subscribeReviewQueueResume(queryClient)` (listener per l'intera vita dell'app; l'unsubscribe è ignorato — il root non smonta). Un commento breve: resume all'avvio (`onSuccess`) + resume al ritorno online (questo listener).
- `src/features/study/reviewMutation.test.ts` -- **EDIT** (env node): aggiungere `describe('4.3 …')` con i test AC2 (serie+ordine via due mutation gated), AC3 (coerenza esito/`dueAt` dopo `dehydrate`→`hydrate`→resume) e AC4 (retry: `applyReview` reject-poi-risolve ⇒ 2 chiamate, `retryDelay: 0` a livello observer per non attendere il backoff reale). Riusa gli helper esistenti (`startMutation`, `spyReview`, `makeVars`, `onlyMutation`, il ripristino `onlineManager` in `afterEach`).
- `src/app/reviewPersister.test.ts` -- **EDIT** (env node): aggiungere `describe('4.3 …')` con il test AC1 del listener online in ISOLAMENTO: `subscribeReviewQueueResume(qc)` (client NON montato, così solo il nostro listener agisce), mutation `paused` offline, `onlineManager.setOnline(true)` ⇒ `applyReview` chiamata UNA volta; `unsubscribe()` in `finally`. Riusa `spyReview`/`makeInput`/`registerReviewMutationDefaults` già importati nel file.
- `src/features/study/reviewMutation.ts:56-64` -- READ-ONLY riferimento: `registerReviewMutationDefaults` è il sito UNICO della `mutationFn`/`scope`/(ora)`retry`.
- `src/domain/ports/reviewRepository.ts:53-64` -- READ-ONLY: `applyReview` è IDEMPOTENTE per `review_id` (`on conflict do nothing`) — è ciò che rende il `retry` sicuro. Invariato.
- `src/features/study/SessionScreen.tsx:220-243,269-316` -- READ-ONLY: la `useMutation` porta già `mutationKey`+`scope`; l'`onError` fa già il rollback ottimistico. NON aggiungere pulsanti «riprova» né UI d'errore (AC4). Nessuna modifica.
- `eslint.config.js:74-117` -- READ-ONLY: la matrice dei confini (features↛data/app; app→tutto). `onlineManager` in `app` è consentito.

## Tasks & Acceptance

**Execution:**
- `src/features/study/reviewMutation.ts` -- AGGIUNGERE `REVIEW_SYNC_MAX_RETRIES` e `retry`/`retryDelay` ai default della mutation; aggiornare il commento dello scope. -- Ritentativo automatico su fallimento di invio (AC4), serie/ordine confermati (AC2).
- `src/app/reviewPersister.ts` -- AGGIUNGERE `subscribeReviewQueueResume(queryClient)` (listener `onlineManager` → `resumeReviewQueue`); aggiornare il commento di `resumeReviewQueue`. -- Resume ESPLICITO al ritorno della rete (AC1).
- `src/app/main.tsx` -- CABLARE `subscribeReviewQueueResume(queryClient)` dopo la registrazione dei default. -- Attiva il listener online per l'intera vita dell'app.
- `src/features/study/reviewMutation.test.ts` -- CREARE i test 4.3: AC2 (serie+ordine), AC3 (coerenza esito/`dueAt`, nessun ricalcolo), AC4 (retry automatico). -- Verifica il drenaggio in ordine, la coerenza nel tempo e il ritentativo sulla superficie reale.
- `src/app/reviewPersister.test.ts` -- CREARE il test 4.3: AC1 (il listener online drena la coda in isolamento, una sola chiamata). -- Verifica il resume al ritorno della rete come codice NOSTRO, non come dettaglio di libreria.

**Acceptance Criteria:**
- Given una coda con una mutation `['review']` `paused` e `subscribeReviewQueueResume` attivo su un client non montato, when `onlineManager` torna `online`, then `applyReview(input)` è invocata esattamente una volta senza alcun intervento; e il resume all'avvio resta cablato via `onSuccess` (4.2). (AC1)
- Given due mutation `['review']` con lo stesso `scope: review-sync` avviate online, when vengono drenate, then la seconda `applyReview` non parte finché la prima non si risolve e l'ordine è preservato (A prima di B). (AC2)
- Given una mutation creata offline con esito `good`, `dueAt` e `reviewedAt` fissati, when viene drenata più tardi (nuovo client, `hydrate`, resume), then `applyReview` riceve lo STESSO `outcome`, lo STESSO `dueAt` e `reviewedAt` = istante della risposta, senza alcun ricalcolo. (AC3)
- Given una mutation online la cui `applyReview` fallisce una volta poi risolve, when la mutation viene eseguita, then il ritentativo è automatico (`applyReview` chiamata due volte), la mutation finisce `success` e non esiste alcun pulsante «riprova» nell'interfaccia. (AC4)

## Design Notes

**Perché un listener online ESPLICITO oltre al built-in del provider.** `QueryClient.mount()` (che il `PersistQueryClientProvider` invoca) sottoscrive già `onlineManager` e chiama `resumePausedMutations()` al ritorno online. Ma la boundary della 4.2 delega esplicitamente a 4.3 «il listener online per il resume»: un helper NOSTRO, esportato e testabile in isolamento (client non montato), rende AC1 una superficie che possediamo e verifichiamo, non un dettaglio interno della libreria soggetto a cambiare tra versioni. La coesistenza col resume del `mount()` in produzione è BENIGNA: il `Retryer` in pausa risolve la sua `continue`-promise una sola volta (la seconda `continue()` trova `continueFn` già consumata), quindi la `mutationFn` esegue UNA volta; e la RPC è comunque idempotente per `review_id` (4.5 lo verifica end-to-end).

**Perché `retry` è sicuro qui.** La RPC `apply_review` è idempotente (`on conflict (review_id) do nothing`, aggiorna lo stato SOLO se l'insert ha prodotto una riga): un ritentativo con lo stesso `review_id` è un no-op. Il backoff è limitato (`min(1000·2^attempt, 30_000)`) e i ritentativi sono un numero finito: un errore permanente (es. coda stale malformata) risale in `error` dopo `REVIEW_SYNC_MAX_RETRIES` invece di girare all'infinito. Con `networkMode: 'online'` una mutation offline entra `paused` e NON consuma ritentativi — retry e pausa non interferiscono.

**Forma (features, `reviewMutation.ts`):**
```ts
export const REVIEW_SYNC_MAX_RETRIES = 3;
qc.setMutationDefaults(REVIEW_MUTATION_KEY, {
  mutationFn: ({ input }: ReviewMutationVars) => review.applyReview(input),
  scope: REVIEW_SYNC_SCOPE,
  retry: REVIEW_SYNC_MAX_RETRIES,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
});
```

**Forma (app, `reviewPersister.ts` + wiring `main.tsx`):**
```ts
export function subscribeReviewQueueResume(queryClient: QueryClient): () => void {
  return onlineManager.subscribe((online) => {
    if (online) resumeReviewQueue(queryClient);
  });
}
// main.tsx: registerReviewMutationDefaults(queryClient, ports.review);
//           subscribeReviewQueueResume(queryClient); // resume anche al ritorno online
```

**Nota sul test del retry.** I default portano un `retryDelay` con backoff reale; nel test AC4 si passa `retryDelay: 0` a livello di `MutationObserver` (override dei default) così il ritentativo non attende il backoff — `retry` continua a venire dai default. Evita fake-timer fragili.

## Verification

**Commands:**
- `npm run lint` -- expected: nessuna violazione dei confini AD-1 (`features` non tocca `data`/`app`; `onlineManager` in `app` consentito).
- `npm run typecheck` -- expected: nessun errore TS.
- `npm test` -- expected: suite verde, inclusi i nuovi test 4.3 in `reviewMutation.test.ts` (AC2/AC3/AC4) e `reviewPersister.test.ts` (AC1), e i test 4.2 invariati.

**Manual checks (if no CLI):**
- In `src/app/main.tsx`, verificare che `subscribeReviewQueueResume(queryClient)` sia chiamato dopo `registerReviewMutationDefaults(...)` e prima/accanto al render.
- Confermare per ispezione che nessuna schermata di studio (`SessionScreen.tsx` e discendenti) renda un pulsante «riprova»/«retry» né una nuova superficie d'errore della sincronizzazione (AC4). Un grep `riprova|retry` in `src/features/study` non deve trovare alcun controllo d'interfaccia.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 0, low 2)
- defer: 1: (high 0, medium 1, low 0)
- reject: 13
- addressed_findings:
  - `[low]` `[patch]` Il `retryDelay` di produzione (`Math.min(1000 * 2 ** attempt, 30_000)`) non aveva copertura: ogni test di retry sovrascrive `retryDelay: 0` a livello observer, quindi una regressione della formula (cap rimosso, base sbagliata) sarebbe passata verde. Aggiunto un test che rilegge i default via `qc.getMutationDefaults([...REVIEW_MUTATION_KEY])` e asserisce `retryDelay(0)=1000`, `(1)=2000`, `(2)=4000`, il cap `(20)=30_000` e `retry = REVIEW_SYNC_MAX_RETRIES`.
  - `[low]` `[patch]` La coesistenza «benigna» del listener esplicito con il resume built-in di `QueryClient.mount()` («esattamente una volta») era solo argomentata, mai testata (il test AC1 isola il nostro listener su client NON montato). Aggiunto un test con client MONTATO (`qc.mount()`) + `subscribeReviewQueueResume`: al ritorno online `applyReview` è chiamata esattamente una volta e RESTA una (flush dei microtask + `setTimeout(0)` poi ri-asserzione), a prova dell'assenza di doppio drenaggio.

Note sui reject principali (rumore o fuori scopo per autorità dell'intento):
- **Idempotenza RPC non verificata qui**: l'`on conflict (review_id) do nothing` è invariante di Epic 3; l'intento assegna la verifica e2e dell'applicato-esattamente-una-volta alla storia 4.5. Fuori scopo per autorità dell'intento.
- **`retryDelay` 0-indexed / cap 30 s «morto» con `MAX_RETRIES = 3`**: comportamento corretto e comment accurato; il cap rispecchia il default di react-query ed è difensivo se il conteggio cresce. Rumore.
- **Leak di `onlineManager` via side-effect di `buildPersistedClient`**: già neutralizzato dal `beforeEach`/`afterEach` globale del file che salva e ripristina lo stato di rete. Non reale.
- **Test di flapping (online→offline→online a metà drenaggio) e di notifica online→online no-op**: oltre gli AC dichiarati; la ri-pausa è gestita nativamente da react-query. Fuori scopo.
- **`main.tsx` non testato / wording del commento unsubscribe / `MAX_RETRIES = 3` senza rationale / commenti lunghi**: composition-root non testabile per costruzione; degrado accettabile e stile coerente con la casa.
- **AC4 «nessun pulsante riprova» provato solo da grep**: nessuna UI è cambiata; provare un'assenza è un negativo fragile — la verifica per ispezione nello spec è sufficiente.

## Auto Run Result

Status: done

**Sintesi della modifica.** Il drenaggio della coda di valutazioni ora riparte da SÉ al ritorno della rete e ritenta i fallimenti di invio, senza nuova UI. (1) Un listener `onlineManager` ESPLICITO — `subscribeReviewQueueResume(queryClient)` in `src/app/reviewPersister.ts`, cablato in `main.tsx` — rilancia `resumeReviewQueue` alla transizione a online, accanto al resume all'avvio già esistente (`onSuccess`, 4.2). (2) I default della mutation (`registerReviewMutationDefaults`, `features/study`) portano ora `retry: REVIEW_SYNC_MAX_RETRIES` (3) + `retryDelay` a backoff esponenziale limitato: un fallimento di invio online si ritenta da solo, senza pulsante «riprova». (3) Il drenaggio in serie/ordine (via `scope: review-sync`, già in 4.2) e la coerenza esito/`due_at` senza ricalcolo sono ora VERIFICATI da test.

**File cambiati (rispetto a `545af33`).**
- `src/features/study/reviewMutation.ts` (EDIT) — `REVIEW_SYNC_MAX_RETRIES = 3`; `retry`/`retryDelay` aggiunti ai default della mutation; commento dello scope aggiornato (serie/ordine ora verificati).
- `src/app/reviewPersister.ts` (EDIT) — `subscribeReviewQueueResume(queryClient)` (listener `onlineManager` → `resumeReviewQueue`); import di `onlineManager`; commento di `resumeReviewQueue` aggiornato (il `.catch` assorbe la reject finale dopo i ritentativi).
- `src/app/main.tsx` (EDIT) — cablaggio di `subscribeReviewQueueResume(queryClient)` dopo la registrazione dei default (listener per l'intera vita dell'app).
- `src/features/study/reviewMutation.test.ts` (EDIT) — test 4.3 AC2 (serie+ordine), AC3 (coerenza esito/`dueAt`, nessun ricalcolo), AC4 (retry transitorio e permanente) + il test `backoff` (blocca la formula del `retryDelay` di produzione, patch di review).
- `src/app/reviewPersister.test.ts` (EDIT) — test 4.3 AC1 (listener online in isolamento) + il test di coesistenza benigna con client montato (esattamente-una-volta, patch di review).

**Esito review (questo pass).** patch applicati: 2 (entrambi low — copertura del `retryDelay` di produzione e del doppio-resume esattamente-una-volta). Item differiti: 1 (medium — un invio permanentemente fallito perde la risposta senza segnale; visibilità/idempotenza sono 4.4/4.5, nessuna delle due garantisce il recupero). Item rifiutati: 13 (rumore, fuori scopo per autorità dell'intento, o già neutralizzati — vedi Review Triage Log).

**Raccomandazione di follow-up review.** `false`. Findings di questo pass triaged `patch`: high 0, medium 0, low 2. Punteggio `3×0 + 1×2 = 2` (< 5) e nessun high ⇒ `followup_review_recommended: false`.

**Verifica eseguita.**
- `npm run lint` ⇒ nessuna violazione (confini AD-1; `onlineManager` in `app` consentito).
- `npm run typecheck` ⇒ nessun errore TS.
- `npm test` ⇒ 86 file, 978 test verdi (inclusi i 6 test 4.3: AC1, AC2, AC3, AC4 transitorio/permanente, backoff, coesistenza benigna).
- Matrix Test Audit: ogni riga della matrice I/O coperta da un test eseguito e passato (ritorno online / resta offline → AC1; drenaggio in serie → AC2; coerenza nel tempo → AC3; fallimento online / permanente → AC4).

**Rischi residui.** L'item `deferred` (invio permanentemente fallito che perde la risposta senza segnale né recupero — medium). Il listener esplicito coesiste col resume built-in di `QueryClient.mount()`: la mutation esegue una volta (Retryer risolve la sua `continue`-promise una volta) e la RPC è idempotente per `review_id` — ora coperto anche dal test di coesistenza. La verifica e2e con app chiusa/riaperta e l'indicatore di sincronizzazione restano rispettivamente le storie 4.5 e 4.4.
