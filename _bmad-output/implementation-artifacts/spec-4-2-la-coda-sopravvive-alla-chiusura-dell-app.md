---
title: 'La coda sopravvive alla chiusura dell''app'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '133a630fc823aa985d28055a56269c4721d0d403'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      La coda IndexedDB durevole non è legata all'utente autenticato né svuotata
      al sign-out: su un browser condiviso una coda in sospeso attraverso un
      cambio account può drenarsi sotto un altro utente al reload.
    evidence: |-
      DB_NAME/CLIENT_KEY sono costanti globali e resumePausedMutations() scatta
      all'onSuccess del restore senza verifica dell'utente; il sign-out non chiama
      persister.removeClient(). Fuori dallo scenario single-user dell'epica, ma
      reale su browser condiviso multi-account.
    location: >-
      src/app/reviewPersister.ts; src/app/main.tsx
    severity: medium
  - summary: >-
      Nessun cache-buster sul client persistito con maxAge Infinity: un cambio di
      schema/contratto RPC fra deploy può reidratare una coda stale come input
      malformato.
    evidence: |-
      persistOptions non imposta buster e non scarta lo snapshot su errore di
      restore; con ApplyReviewInput/RPC che evolvono, una coda vecchia verrebbe
      rigiocata. Va legato a una fonte di versione (es. VERSION) quando disponibile.
    location: >-
      src/app/main.tsx; src/app/reviewPersister.ts
    severity: low
  - summary: >-
      throttleTime 250ms (AC5) è configurato ma non osservato da un test di
      coalescing delle scritture.
    evidence: |-
      I test del persister provano la fedeltà del round-trip ma non che scritture
      ravvicinate si aggregano entro la finestra; una regressione a throttle 0
      passerebbe verde. Richiede un test con fake timers.
    location: >-
      src/app/reviewPersister.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** Oggi la mutation di persistenza di una risposta (`applyMutation` in `SessionScreen.tsx:218`) è definita DENTRO il componente e vive solo in memoria: se il campo cade e l'utente chiude l'app (o ricarica) mentre una risposta è in volo, la mutation svanisce e la risposta è persa. Non c'è persistenza durevole della coda, né una `mutationFn` registrata al bootstrap: alla reidratazione il componente potrebbe non esistere e la ripresa fallirebbe con `No mutationFn found`. Per chi studia in metropolitana, «riapro l'app e la mia risposta è sparita» rompe la promessa dell'epica.

**Approach:** Fondare la coda DUREVOLE. (1) Registrare la `mutationFn` delle valutazioni al bootstrap con `setMutationDefaults(['review'], …)` (scope `review-sync`), MAI nel componente. (2) Persistere il mutation-cache su IndexedDB via un persister con `throttleTime ≤ 250 ms`, dehydratando SOLO le mutation in pausa. (3) Alla riapertura, reidratare il client dallo storage e chiamare `resumePausedMutations()` all'avvio, così la coda è ancora presente e il drenaggio riparte da solo. `SessionScreen` avvia la mutation con `mutationKey: ['review']` e non definisce più una propria `mutationFn`.

## Boundaries & Constraints

**Always:**
- La `mutationFn` delle review è registrata SOLO ai default del QueryClient (`setMutationDefaults(['review'], …)`), MAI in un componente. `SessionScreen` avvia la mutation con `mutationKey: ['review']` + `scope: { id: 'review-sync' }` e conserva i suoi `onMutate`/`onError`/`onSettled` (effetti UI, non ripresi al reload).
- I default DEVONO essere registrati PRIMA che il persister reidrati il client (l'hydrate applica i default per `mutationKey`): l'ordine in `main.tsx` è `registerReviewMutationDefaults(...)` → poi il render con `PersistQueryClientProvider`.
- Il persister scrive su IndexedDB con `throttleTime` non superiore a 250 ms. La persistenza deve PRESERVARE i `Date` nelle variabili (`input.dueAt`, `input.reviewedAt`, `result`): usare lo structured clone di IndexedDB (serialize/deserialize identità), NON `JSON` che li romperebbe.
- La dehydration persiste SOLO le mutation (`shouldDehydrateQuery: () => false`; il default `shouldDehydrateMutation` già = `isPaused`) e non scade (`maxAge: Infinity`): una risposta accodata non va persa dopo una chiusura prolungata.
- Al riavvio, dopo il restore, `resumePausedMutations()` viene invocata una volta (via `onSuccess` di `PersistQueryClientProvider`).
- La logica di registrazione + persister vive nel confine giusto: la registrazione dei default (solo `@tanstack/react-query` + porta di dominio) in `features/study`; il persister IndexedDB (pacchetto persist-client + `indexedDB`) in `src/app/` (AD-1). `features` NON importa `data`/`app` né il persister.
- Il core (registrazione, resume, round-trip dehydrate/hydrate, fedeltà del persister) è testabile in ambiente `node` iniettando uno storage in memoria: nessun test deve richiedere un browser reale o IndexedDB.

**Block If:** _Nessuna._ Il meccanismo (TanStack persist-client + IndexedDB) è fissato dalle Technical Decisions dell'epica; nessuna ambiguità richiede input umano.

**Never:**
- NON introdurre il ritentativo automatico dopo un fallimento del server, il listener `online` per il resume al ritorno della rete, né la verifica del drenaggio in ordine — sono la storia 4.3.
- NON introdurre l'indicatore di sincronizzazione (`sync-indicator`, storia 4.4) né la verifica e2e di idempotenza (4.5).
- NON far invalidare `['due']`/`['streak']` alla mutation ripresa in background (l'`onSettled` è del componente, assente al reload): la correttezza del server è garantita dall'RPC idempotente + dal refetch fresco della pila; l'aggiornamento UI dopo drenaggio in background è 4.3/4.4.
- NON ricalcolare esito/scadenza al drenaggio: la `mutationFn` trasporta l'`input` già calcolato (Epic 3).
- NON persistere lo store di sessione zustand né le query (solo la coda di mutation).
- NON gestire l'avvio a freddo senza rete / PWA (fuori scopo epica).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Risposta accodata offline | `onlineManager` offline; mutation `['review']` avviata | la mutation entra in stato `paused` nel mutation-cache; `applyReview` NON è ancora chiamata | No error expected |
| Persist della coda | mutation `paused` + persister con storage iniettato | `persistClient` scrive uno snapshot contenente la mutation `paused` (throttle ≤ 250 ms) | errore di write ⇒ snapshot precedente resta; nessuna unhandled rejection |
| Riapertura online: restore + resume | storage con snapshot, QueryClient NUOVO, default registrati, `onlineManager` online | il restore reidrata la mutation `paused` (variabili integre, `dueAt`/`reviewedAt` sono `Date`); `resumePausedMutations()` esegue la `mutationFn` di default ⇒ `applyReview(input)` UNA volta con l'input originale | reject di `applyReview` ⇒ la mutation resta in errore (nessun retry: 4.3) |
| Riapertura offline | snapshot reidratato, ancora offline | la mutation resta `paused` e presente; nessun `applyReview` finché la rete non torna | No error expected |
| Regressione: default assenti | resume senza `setMutationDefaults` registrato prima del restore | fallirebbe con `No mutationFn found` — PREVENUTO dall'ordine registrazione→restore | copertura di regressione |

</intent-contract>

## Code Map

- `src/features/study/reviewMutation.ts` -- **NUOVO** (features): `REVIEW_MUTATION_KEY = ['review']`, `REVIEW_SYNC_SCOPE = { id: 'review-sync' }`, `type ReviewMutationVars = { input: ApplyReviewInput; result: ReviewState }`, e `registerReviewMutationDefaults(qc, review)` che chiama `setMutationDefaults`. Importa solo `@tanstack/react-query` (tipo `QueryClient`) + tipi di dominio. Confine: features→domain ✓.
- `src/app/reviewPersister.ts` -- **NUOVO** (app): `createReviewPersister(storage)` (persister IndexedDB, throttle 250 ms, serialize identità) e `createIndexedDbStorage(...)` (adattatore `AsyncStorage` su IndexedDB, glue browser). Importa i pacchetti persist-client + `indexedDB`. Confine: app external ✓.
- `src/app/main.tsx:55-67,73-85` -- **EDIT**: dopo `queryClient` e `ports`, chiamare `registerReviewMutationDefaults(queryClient, ports.review)`; creare il persister; sostituire `QueryClientProvider` con `PersistQueryClientProvider` (`persistOptions={{ persister, maxAge: Infinity, dehydrateOptions: { shouldDehydrateQuery: () => false } }}`, `onSuccess={() => void queryClient.resumePausedMutations()}`).
- `src/features/study/SessionScreen.tsx:106,218-240,298-309` -- **EDIT**: la `useMutation` aggiunge `mutationKey: REVIEW_MUTATION_KEY` + `scope: REVIEW_SYNC_SCOPE` e RIMUOVE la `mutationFn` inline (usa il default); `onMutate`/`onError`/`onSettled` invariati; `ApplyVars` (riga 106) → import `ReviewMutationVars` da `./reviewMutation`.
- `src/domain/ports/reviewRepository.ts:20-28,64` -- READ-ONLY: `ApplyReviewInput` (con `dueAt`/`reviewedAt` `Date`) e `applyReview(input): Promise<void>` (RPC idempotente `on conflict (review_id) do nothing`). Riuso, invariato.
- `src/features/study/SessionScreen.keyboard.test.tsx:80-90,113` -- **EDIT**: il test fa scattare la mutation via keydown; registrare i default sul suo QueryClient (`registerReviewMutationDefaults(qc, ports.review)`, features→features ✓) perché la `mutationFn` non è più nel componente.
- `src/features/study/SessionScreen.test.tsx:64-98` -- READ-ONLY: usa `renderToStaticMarkup` (nessuna interazione, non fa scattare la mutation) ⇒ resta verde senza modifiche.
- `eslint.config.js:74-117` -- READ-ONLY: la matrice dei confini che vincola la collocazione (features↛data/app; app→tutto).
- `package.json:20-29` -- **EDIT**: aggiungere `@tanstack/react-query-persist-client` e `@tanstack/query-async-storage-persister` (^5, allineate a `@tanstack/react-query`).

## Tasks & Acceptance

**Execution:**
- `npm i @tanstack/react-query-persist-client @tanstack/query-async-storage-persister` -- aggiungere i pacchetti del persister (v5). -- Prerequisito del persister IndexedDB.
- `src/features/study/reviewMutation.ts` -- CREARE le costanti/tipo condivisi + `registerReviewMutationDefaults(qc, review)`. -- Unica fonte della `mutationFn` (bootstrap), riusabile da app, componente e test.
- `src/app/reviewPersister.ts` -- CREARE `createReviewPersister(storage)` (throttle ≤ 250 ms, serialize identità per preservare i `Date`) e `createIndexedDbStorage()`. -- Persistenza durevole della coda su IndexedDB.
- `src/app/main.tsx` -- CABLARE: registrare i default prima del render; montare `PersistQueryClientProvider` con persister + `maxAge: Infinity` + `shouldDehydrateQuery: () => false` + `onSuccess` che chiama `resumePausedMutations()`. -- Persist + restore + resume all'avvio.
- `src/features/study/SessionScreen.tsx` -- MODIFICARE la `useMutation`: `mutationKey` + `scope`, togliere la `mutationFn` inline, usare `ReviewMutationVars`. -- La mutation risoluta dai default, ripresa dopo il reload.
- `src/features/study/reviewMutation.test.ts` -- CREARE (env node): register default + spy porta; forzare `onlineManager.setOnline(false)`, avviare la mutation `['review']` (via `MutationObserver`), `dehydrate` → nuovo QueryClient → register default → `hydrate` → `setOnline(true)` → `resumePausedMutations()`; coprire le righe della matrice. -- Verifica AC1/AC2/AC3 sulla superficie reale (nessun browser).
- `src/app/reviewPersister.test.ts` -- CREARE (env node): `createReviewPersister(inMemoryStorage)` round-trip `persistClient`→`restoreClient` con una mutation `['review']` `paused`; asserire che la mutation è presente e che `dueAt`/`reviewedAt` restano `Date`. -- Verifica AC5 (fedeltà persister + preservazione `Date`).
- `src/features/study/SessionScreen.keyboard.test.tsx` -- MODIFICARE: registrare i default sul QueryClient del test. -- Mantiene verde l'interazione ora che la `mutationFn` è ai default.

**Acceptance Criteria:**
- Given una valutazione avviata con `mutationKey: ['review']` mentre `onlineManager` è offline, when la si `mutate`, then la mutation risulta `paused` nel mutation-cache e `applyReview` NON è ancora invocata. (AC1)
- Given una mutation `['review']` `paused` persistita nello storage durevole, when si crea un QueryClient NUOVO, si registrano i default e si reidrata dallo storage, then la mutation `paused` è di nuovo presente (la coda è sopravvissuta) con le variabili integre — `input.dueAt` e `input.reviewedAt` sono ancora `Date`. (AC2)
- Given la coda reidratata e `onlineManager` online, when si invoca `resumePausedMutations()` all'avvio, then la `mutationFn` registrata al bootstrap esegue `applyReview(input)` esattamente una volta con l'input originale, senza `No mutationFn found`. (AC3)
- Given `SessionScreen` con i default registrati, when l'utente risponde a un esercizio, then la mutation parte con `mutationKey: ['review']` e si risolve tramite la `mutationFn` di default (nessuna `mutationFn` nel componente). (AC4)
- Given il persister della coda, when persiste, then scrive su IndexedDB con `throttleTime ≤ 250 ms`, dehydrata SOLO le mutation (non le query) e lo snapshot non scade (`maxAge: Infinity`). (AC5)

## Design Notes

**Perché la `mutationFn` va ai default e non nel componente.** Alla riapertura, il persister reidrata la coda PRIMA (o senza) che `SessionScreen` sia montato. `resumePausedMutations()` risolve la `mutationFn` per `mutationKey` dai default del client; se fosse solo nel componente non esisterebbe (`No mutationFn found`). Perciò `registerReviewMutationDefaults` va chiamata al bootstrap, PRIMA del restore (l'hydrate applica i default per key). Il componente mantiene `onMutate`/`onError`/`onSettled` (aggiornamento ottimistico + rollback + invalidazione online): sono effetti d'istanza, non ripresi al reload — e va bene, perché al reload la pila `['due']` è rifetchata fresca.

**Perché IndexedDB + serialize identità.** Le variabili della mutation portano `Date` (`dueAt`, `reviewedAt`). `JSON` li trasformerebbe in stringhe e `applyReview` chiamerebbe `.toISOString()` su una stringa. IndexedDB usa lo structured clone, che preserva i `Date`: passando `serialize`/`deserialize` identità al persister lo snapshot resta un oggetto e i `Date` sopravvivono al round-trip.

**Forma (glue di features):**
```ts
export const REVIEW_MUTATION_KEY = ['review'] as const;
export const REVIEW_SYNC_SCOPE = { id: 'review-sync' } as const;
export interface ReviewMutationVars { readonly input: ApplyReviewInput; readonly result: ReviewState; }
export function registerReviewMutationDefaults(qc: QueryClient, review: ReviewRepository): void {
  qc.setMutationDefaults(REVIEW_MUTATION_KEY, {
    mutationFn: ({ input }: ReviewMutationVars) => review.applyReview(input),
    scope: REVIEW_SYNC_SCOPE,
  });
}
```

**Wiring (app, `main.tsx`):**
```tsx
registerReviewMutationDefaults(queryClient, ports.review); // PRIMA del restore
const persister = createReviewPersister(createIndexedDbStorage());
// <PersistQueryClientProvider client={queryClient}
//   persistOptions={{ persister, maxAge: Infinity, dehydrateOptions: { shouldDehydrateQuery: () => false } }}
//   onSuccess={() => { void queryClient.resumePausedMutations(); }}> … </PersistQueryClientProvider>
```

**Scope `review-sync`:** incluso ora perché è impostato allo stesso sito di registrazione; fonda il drenaggio in serie che 4.3 verificherà. In 4.2 con un solo scope non ha effetto osservabile da testare — è foundational, non un AC.

## Verification

**Commands:**
- `npm run lint` -- expected: nessuna violazione (confini AD-1: `features` non tocca `data`/`app`/persister; `domain` non tocca `indexedDB`).
- `npm run typecheck` -- expected: nessun errore TS.
- `npm test` -- expected: suite verde, inclusi i nuovi `reviewMutation.test.ts` e `reviewPersister.test.ts`, il keyboard test aggiornato, e i test esistenti invariati.

**Manual checks (if no CLI):**
- In `src/app/main.tsx`, ispezionare che `registerReviewMutationDefaults(...)` preceda il render con `PersistQueryClientProvider` e che `onSuccess` chiami `resumeReviewQueue(queryClient)` (→ `resumePausedMutations()`).

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 1, low 2)
- defer: 3: (high 0, medium 1, low 2)
- reject: 8
- addressed_findings:
  - `[medium]` `[patch]` Il wiring di produzione in `main.tsx` (`onSuccess`→resume, `maxAge: Infinity`, `shouldDehydrateQuery: () => false`) non era esercitato da alcun test: una regressione sarebbe passata verde rompendo la promessa della story. Estratto in una factory testata in `reviewPersister.ts` (`reviewPersistOptions()` + `resumeReviewQueue(qc)` con `.catch`), cablata da `main.tsx`; aggiunti 3 test comportamentali (valori delle opzioni; dehydrate persiste SOLO le mutation; `resumeReviewQueue` drena una mutation reidratata quando torna online).
  - `[low]` `[patch]` `reviewPersister.test.ts` ridichiarava `REVIEW_MUTATION_KEY`/`REVIEW_SYNC_SCOPE` localmente (rischio di divergenza dalla fonte unica). Ora le importa da `features/study/reviewMutation` (confine app→features consentito).
  - `[low]` `[patch]` `createIndexedDbStorage` non gestiva `request.onblocked` (Promise appesa su upgrade con altra scheda aperta) né chiudeva la connessione sul percorso d'errore. Aggiunto handler `onblocked` che rigetta e `try/finally` con `db.close()` in `getItem`/`setItem`/`removeItem`.

Note sui reject principali (rumore o fuori scopo per autorità dell'intento):
- **Ordinamento seriale / retry al fallimento**: espliciti nella storia 4.3 (`scope` qui è solo foundational); test di ordine e di ripresa-fallita rinviati.
- **Contaminazione cross-utente, buster, throttle osservato**: reali ma differiti (vedi frontmatter `deferred`), non bloccanti nello scenario single-user dell'epica.
- **`onlineManager` leak fra test**: l'`afterEach` ripristina lo stato anche su fallimento e Vitest isola i file — nessun leak reale.
- **`REVIEW_SYNC_SCOPE` non `Object.freeze`**: `as const` è sufficiente; mutazione runtime vietata dal type system.
- **Guardia private-mode / `tx.error` null / commenti pesanti**: degrado accettabile e stile coerente con la casa.

### 2026-09-26 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 19
- addressed_findings:
  - `[low]` `[patch]` Refuso ortografico italiano nella stringa d'errore di `openDb` (`reviewPersister.ts`): `«connessione aperta in un altra scheda»` → `«un'altra scheda»` (elisione mancante). Corretto; lint/typecheck/test rieseguiti verdi (971 test).

Note sui reject principali di questo pass (rumore o fuori scopo per autorità dell'intento):
- **Copertura del vero adattatore IndexedDB (`createIndexedDbStorage`/`openDb`/`withStore`)**: esplicitamente autorizzata come edge non testato dall'intento (`«nessun test richiede un browser reale o IndexedDB»`); il core è testato via storage iniettato e l'adattatore è verificato per ispezione (`put(value, key)`, `get/delete(key)` corretti). Fuori scopo per autorità dell'intento.
- **`resumeReviewQueue` con `.catch(() => {})` silenzioso**: by-design — nessun retry/osservabilità in 4.2 (retry è 4.3, sync-indicator è 4.4). L'unhandled rejection è deliberatamente assorbita.
- **Test del throttle 250ms; buster/versione DB; leak cross-utente al sign-out**: reali ma GIÀ nel frontmatter `deferred` (item 3, 2, 1); non riaperti né duplicati.
- **Wiring di `main.tsx` / ordine register→render non asserito da test; AC4 provata al livello primitive**: composition-root non testabile per costruzione, già mitigata nel pass precedente estraendo `reviewPersistOptions()`/`resumeReviewQueue()`; il keyboard test esercita il componente montato.
- **Restore-fallito senza `onError`, `indexedDB` undefined in private-mode, StrictMode double-invoke, `result` dead-weight, dehydrate di mutation non-paused, `?? null` su chiave assente, `withStore` multi-request**: degrado accettabile / comportamento della libreria / cast circoscritto e corretto per ispezione / speculazione su codice futuro — nessun difetto reale nello scopo di 4.2.

## Auto Run Result

Status: done

**Sintesi della modifica.** La coda di mutation delle valutazioni è ora DUREVOLE: la `mutationFn` è registrata ai default del QueryClient al bootstrap (`registerReviewMutationDefaults`, in `features/study`), il mutation-cache è persistito su IndexedDB via un persister con `throttleTime = 250 ms` e serialize identità (preserva i `Date`), e alla riapertura il `PersistQueryClientProvider` reidrata il client e chiama `resumePausedMutations()` una volta. `SessionScreen` avvia la mutation con `mutationKey: ['review']` + `scope: review-sync` senza più una `mutationFn` inline. Questo passaggio è stato un **follow-up review** su uno spec già `done` (il pass precedente aveva `followup_review_recommended: true`); nessuna modifica di codice oltre un patch ortografico.

**File cambiati (rispetto a `133a630`).**
- `src/features/study/reviewMutation.ts` (NUOVO) — costanti d'identità (`REVIEW_MUTATION_KEY`, `REVIEW_SYNC_SCOPE`), tipo `ReviewMutationVars`, `registerReviewMutationDefaults`.
- `src/app/reviewPersister.ts` (NUOVO) — persister IndexedDB (`createReviewPersister`, `createIndexedDbStorage`), `reviewPersistOptions()`, `resumeReviewQueue()`. **Patch di questo pass**: corretto refuso ortografico nella stringa d'errore `onblocked`.
- `src/app/main.tsx` (EDIT) — registrazione default prima del render; `PersistQueryClientProvider` con persister + `maxAge: Infinity` + `shouldDehydrateQuery: () => false` + `onSuccess`→resume.
- `src/features/study/SessionScreen.tsx` (EDIT) — `useMutation` con `mutationKey`/`scope`, rimossa la `mutationFn` inline e l'interfaccia locale `ApplyVars`.
- `src/features/study/reviewMutation.test.ts` (NUOVO), `src/app/reviewPersister.test.ts` (NUOVO), `src/features/study/SessionScreen.keyboard.test.tsx` (EDIT) — copertura AC1–AC5 in env `node`.
- `package.json` / `package-lock.json` — aggiunti `@tanstack/react-query-persist-client` e `@tanstack/query-async-storage-persister` (^5).

**Esito review (questo pass).** patch applicati: 1 (low — refuso ortografico italiano). Item differiti: 0 nuovi (i candidati reali erano già nel frontmatter `deferred`). Item rifiutati: 19 (rumore, comportamento di libreria, o fuori scopo per autorità dell'intento — vedi Review Triage Log).

**Raccomandazione di follow-up review.** `false`. Findings di questo pass triaged `patch`: high 0, medium 0, low 1. Punteggio `3×0 + 1×1 = 1` (< 5) e nessun high ⇒ `followup_review_recommended: false`.

**Verifica eseguita.**
- `npm run lint` ⇒ nessuna violazione (la doppia quota è consentita da `avoidEscape` perché la stringa contiene un apostrofo).
- `npm run typecheck` ⇒ nessun errore TS.
- `npm test` ⇒ 86 file, 971 test verdi (inclusi `reviewMutation.test.ts`, `reviewPersister.test.ts`, keyboard test).

**Rischi residui.** Restano i tre item `deferred` (contaminazione cross-utente su browser condiviso al sign-out — medium; assenza di cache-buster su schema/RPC in evoluzione — low; throttle 250ms non osservato da un test di coalescing — low). L'adattatore IndexedDB reale non ha copertura di test per scelta dell'intento (core testato via storage iniettato); verificato corretto per ispezione.

