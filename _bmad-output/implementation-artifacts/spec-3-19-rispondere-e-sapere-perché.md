---
title: 'Story 3.19: Rispondere, e sapere perché'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '0d5558a9fea484cf66e23d55d7684c97f8e539f6'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Lo store di sessione (singleton di modulo) non viene resettato alla ri-entrata
      in /studia: alla seconda visita il guard salta `start`, mostrando la coda stale
      invece della pila fresca.
    evidence: |-
      `SessionScreen` avvia lo store con un effetto guardato su `initialIds.length === 0`;
      il singleton conserva `initialIds`/`total` fra visite e cambi utente. La
      ricostruzione all'ingresso ("la sessione si ricostruisce, non si ripristina",
      nessun "riprendi dove eri") è esplicitamente la storia 3.20, che deve
      resettare/ricostruire lo store all'ingresso in /studia.
    location: >-
      src/features/study/SessionScreen.tsx (effetto di start della sessione)
    severity: medium
  - summary: >-
      A metà sessione, se `currentState` non è nella cache `['due']` (divergenza
      coda/pila da refetch onSettled o multi-device), la guardia difensiva lascia la
      card bloccata (opzioni piazzate, mai risposta, nessun avanzamento).
    evidence: |-
      `onSelect` fa `if (currentState === undefined) return;` dopo `setSelected(next)`:
      la selezione resta popolata ma `answered` non passa mai a true. Irraggiungibile
      nell'happy path (coda ⊆ pila per costruzione); emerge solo con mutazione esterna
      della pila. Si sovrappone allo stato d'errore/refetch del read-model già
      differito (3.18 deferred #1); va risolto con una strategia di skip/ricostruzione.
    location: >-
      src/features/study/SessionScreen.tsx (onSelect, guardia currentState)
    severity: low
---

<intent-contract>

## Intent

**Problem:** La sessione (3.18) presenta un esercizio e blocca UNA selezione a indice, ma non lo valuta: nessun esito, nessuna spiegazione, nessuna persistenza, nessun avanzamento. La risposta non è nemmeno COMPOSTA per due tipi su tre (assemble è un ordinamento, select-span uno span — il deferred #3 di 3.18), lo store di sessione è muto, e non esiste alcun aggiornamento ottimistico. L'esercizio valuta ma non insegna.

**Approach:** Chiudere il ciclo «rispondi → sai perché → resta registrato». (1) Comporre una risposta REALE per ogni tipo nel dominio (`composeResponse`). (2) Calcolare l'esito interamente sul client con la pipeline pura esistente (`check` → `outcomeOf` → `schedule`), generare un `review_id` client, e persistere con UNA chiamata idempotente (nuovo `applyReview` sulla porta, che invoca la RPC `apply_review` già a DB dalla 3.9). (3) Dichiarare la correttezza SENZA colore e mostrare la spiegazione bilingue (terzo stato della card), consultabile ANCHE prima di rispondere (registrata come `usedExplanation` → `hard`). (4) Aggiornare in modo ottimistico il conteggio della pila (`['due', userId]`, primo `onMutate` del repo) e una barra di avanzamento derivata dallo store di sessione ora cablato. FUORI SCOPE: barra sempre-visibile/abbandono/conteggio residuo/ricostruzione (3.20), schermata di completamento (3.21), contratto tastiera (3.22), responsive (3.23).

## Boundaries & Constraints

**Always:**
- **Composizione della risposta nel DOMINIO** (`src/domain/exercise-presentation.ts`, accanto a `answerOptions`): `composeResponse(exercise, selected: readonly number[]): ExerciseResponse` e `selectionComplete(exercise, selected): boolean`, pure, che usano internamente `answerOptions(exercise)`. `single-select` ⇒ `{ kind, choice: options[selected[0]] }`, completa a `length === 1`. `assemble` ⇒ `{ kind, order: selected.map(i => options[i]) }`, completa a `length === options.length`. `select-span` ⇒ `{ kind, span: { start: selected[0], end: selected[0] + 1 } }` (l'indice di opzione È l'indice di segmento, ordine naturale), completa a `length === 1`. Totali: `selected` vuoto/incompleto non lancia.
- **L'esito si CALCOLA sul client, non si dichiara (AD-24, AC4).** In quell'istante, con le funzioni PURE esistenti (INVARIATE): `check(exercise, composeResponse(...))` ⇒ `CheckOutcome`; `outcomeOf(check, usedExplanation, false)` ⇒ `ReviewOutcome`; `schedule(currentState, outcome, now)` ⇒ `ReviewState` (dà `stage`/`dueAt`). `currentState` è lo `ReviewState` dell'esercizio corrente letto dallo snapshot di `['due', userId]` PRIMA dell'update ottimistico. `now` dal `Clock`.
- **`declaredEasy` è sempre `false` in questa epica.** Nessun AC di Epic 3 introduce un controllo «facile»; l'esito perciò appartiene a `{again, hard, good}` (il ramo `easy` resta nel dominio per completezza ma non è raggiungibile dalla UI). Non aggiungere alcun controllo «facile».
- **`review_id` generato dal client (AC4).** `crypto.randomUUID()` nel gestore di risposta (glue di feature, non nel dominio: `src/domain` vieta i global di piattaforma). Generato UNA volta per tentativo e passato come variabile di mutation, così un retry di TanStack riusa lo stesso id e la RPC (`on conflict do nothing`) è idempotente. Un ri-tentativo dell'esercizio dopo `again` è un NUOVO tentativo ⇒ nuovo `review_id`.
- **Una risposta = una chiamata idempotente (AD-7, AC4).** Nuovo metodo di porta `applyReview(input: ApplyReviewInput): Promise<void>` su `ReviewRepository`; `interface ApplyReviewInput { readonly reviewId: string; readonly exerciseId: string; readonly outcome: ReviewOutcome; readonly stage: number; readonly dueAt: Date; readonly reviewedAt: Date; readonly usedExplanation: boolean }`. Solo `src/data/` lo implementa: `client.rpc('apply_review', { review_id, exercise_id, outcome, stage, due_at: dueAt.toISOString(), reviewed_at: reviewedAt.toISOString(), used_explanation })`; su `error` ⇒ `DataError('applyReview', error)`. NON ricalcola nulla in JS/SQL: trasporta i valori GIÀ calcolati (`exerciseId` = id di RIGA DB = chiave della pila).
- **Aggiornamento ottimistico del conteggio (AC5, primo `onMutate` del repo).** La mutation `applyReview` in `SessionScreen`: `onMutate` fa `cancelQueries(['due',userId])`, snapshot, `setQueryData(dueQueryKey(userId), old => (old ?? []).map(s => s.exerciseId === exerciseId ? result : s).filter(s => isDue(s, reviewedAt)))` (usa `result` e `isDue` di dominio: `again`/`hard`@stage0 restano dovuti ⇒ conteggio invariato; `good`/`easy`/`hard`@stage>0 escono ⇒ conteggio cala); `onError` ripristina lo snapshot; `onSettled` invalida `['due',userId]` e `['streak',userId]`. Il conteggio è consumato dalla dashboard, che legge la STESSA chiave.
- **Barra di avanzamento ottimistica dallo store (AC5).** Cablare lo store di sessione (3.18 lo lasciò muto): `start(dueIds)` al primo caricamento della pila, `dispatch({ type:'reviewed', result, now })` al momento della risposta (avanza la coda; `again`/interval-0 riaccoda in fondo — nessun colore/segnale). Aggiungere al dominio `remainingCount(state): number`; la barra rende COMPLETATO = `total − remainingCount(session)` su `total`, con `total` mantenuto dallo store (dagli id iniziali). Aggiornandosi allo `dispatch` locale, è ottimistica per costruzione (non attende il server). Nuovo `ProgressMeter` presentazionale (`role="progressbar"`, `aria-valuenow/min/max`, ~4px), reso durante la sessione.
- **Terzo stato della card = `spiegazione` (AC1/AC2).** `ExerciseCard` acquisisce lo stato `spiegazione`: dichiara la correttezza in TESTO (`t('session.outcome.correct'|'incorrect')` da `check().correct`) e mostra la spiegazione bilingue. NESSUN verde per il corretto né rosso per lo sbagliato (AC2): stessi token neutri; l'informazione la porta il CONTENUTO della spiegazione. Nessun `!`, emoji, avverbio di lode, coriandolo, badge, animazione celebrativa.
- **Spiegazione consultabile PRIMA di rispondere, registrata, non scoraggiata (AC3).** Nello stato `consegna` un'azione «mostra la spiegazione» rivela il `ExplanationPanel` (solo spiegazione, nessuna dichiarazione di esito) e imposta `usedExplanation = true` (che declassa un esito corretto a `hard`). Nessuno stile d'avvertimento/penalità; una volta consultata resta disponibile.
- **Spiegazione bilingue via dominio (FR8.5).** `ExplanationPanel` risolve con `resolveExplanation(exercise.explanation, locale)` (`resolveBilingual`, INVARIATO), dove `locale = resolveLocale(i18n.language)` (`Locale`='en'|'it' coincide con `BilingualLanguage`). Se `isFallback`, dichiara «non ancora tradotta» (`t('session.explanation.fallbackNotice')`); il `text` reso è sempre LETTERALE, mai una chiave i18n. `lang` corretto sul nodo se il testo è nella lingua di ripiego.
- **`SessionScreen` orchestra; card e pannelli sono presentazionali/controllati.** `SessionScreen` possiede fase locale (`consegna`↔`spiegazione`), `selected: number[]`, `usedExplanation`, la mutation, lo store e la barra. La card espone `selected`/`onSelect(index)`/`answered`/`onReveal`/`revealed` e (in `spiegazione`) `correct`+`explanation`; è l'UNICA superficie `surface-raised`. L'avanzamento al prossimo esercizio è un'azione «prossimo esercizio» (`t('session.next')`, testo concreto mai «Continua») visibile in `spiegazione`; azzera `selected`/`usedExplanation`/fase e mostra il nuovo `currentExerciseId` (lo store è già avanzato).
- **Testabilità SSR preservata.** I test usano `renderToStaticMarkup` (nessun effetto). Lo `start` dello store è un effetto (glue di produzione verificata live); i test SEMINANO lo store (`useSessionStore.getState().start([...])`, reset in `afterEach`) e la cache delle query, poi asseriscono il markup. Le letture (`currentExerciseId`/`remainingCount`) sono pure e rendono in SSR. Gli stati `spiegazione`/risposta-composta si testano a livello di COMPONENTE via props (come 3.18), non via effetto/click in `SessionScreen`.
- **Query esercizi stabile.** Mantenere `['exercises', ids]` ancorata agli id INIZIALI della sessione (dallo store), non alla pila che si accorcia in modo ottimistico: evita refetch/scheletri a ogni risposta. La coda di sessione è sempre un sottoinsieme degli id iniziali.
- **Confini AD-1.** `features/study` importa `domain`/`ui`/`i18n`/`@tanstack/react-query`/`zustand`/`react-router`, MAI `data`; `features` non importa `features`. Dominio puro: nessun `Date.now()`/`new Date()` senza argomenti, `Intl…resolvedOptions()`, `Math.random()`, nessun import esterno. `crypto.randomUUID` vive SOLO in feature.
- **i18n:** estendere il namespace `session` in ENTRAMBI i cataloghi (parità imposta da `i18n.test.tsx`): `outcome.{correct,incorrect}`, `explanation.{reveal,heading,fallbackNotice}`, `next`, `progress.label`. `en` ASCII; niente `!`/emoji/avverbi di lode/CJK; niente `{{count}}`.

**Block If:**
- _Nessun blocco._ Ogni decisione è fissata dall'epica e dai moduli esistenti (`check`/`outcomeOf`/`schedule`/`resolveBilingual` puri e testati; RPC `apply_review` già a DB con firma canonica AD-7; pattern query/scheletro/cancello della dashboard; store `sessionReducer` già scritto). Nessuna migrazione, nessuna azione umana o esterna al repository.

**Never:**
- NON reimplementare l'esito/la dovutezza/lo scheduling: usa `outcomeOf`/`isDue`/`schedule` VERBATIM. NON mettere logica di coda o scheduling nello store o nella schermata (lo store DELEGA a `sessionReducer`). NON aggiungere logica di valutazione in SQL.
- NON usare verde/rosso per l'esito; nessun `!`/emoji/lode/coriandolo/badge/animazione. NON marcare in alcun modo un esercizio RIPRESENTATO nella stessa sessione (AC6).
- NON introdurre: barra «sempre visibile in ogni stato»/abbandono (Esc/indietro)/conteggio residuo/ricostruzione della sessione (3.20); schermata di completamento/zero (3.21); contratto tastiera completo (tasti numerici/ordine di tab/live region, 3.22); breakpoint responsive/thumb-zone (3.23); semantica radiogroup del gruppo opzioni (deferred #2 di 3.18 → 3.22/7.6); stato d'errore del read-model (deferred #1 di 3.18).
- NON comporre span MULTI-segmento per `select-span` (il contenuto attuale è mono-segmento; il raffinamento è differito) né consentire undo/riordino durante l'assemblaggio (append-only fino al completamento). NON aggiungere un controllo «facile» (`declaredEasy` resta `false`). NON definire `--text-sentence-hero` ([[DW-19]]). NESSUN campo `id` sul tipo `Exercise` (identità derivata, AD-23). NON cambiare la chiave `['due', userId]`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| single-select corretta | opzione = `answer` scelta, senza consulto | `check.correct=true`, `outcomeOf⇒good`, `schedule` avanza stadio, dichiarazione «corretto», spiegazione mostrata | — |
| single-select con consulto | opzione = `answer`, spiegazione consultata prima | `usedExplanation=true` ⇒ `outcomeOf⇒hard` | — |
| risposta errata | opzione ≠ `answer` (qualsiasi tipo) | `check.correct=false` ⇒ `outcomeOf⇒again` (stadio 0), riaccodata (interval 0 ⇒ `isDue` vero) | — |
| assemble | 8 tessere toccate in ordine | `composeResponse⇒{order}`; completa alla 8ª; `check` confronta elemento per elemento | — |
| select-span mono-segmento | segmento indice 0 toccato, `answer={0,1}` | `composeResponse⇒{span:{0,1}}` ⇒ corretto | — |
| conteggio ottimistico | risposta `good`/`easy` applicata | `['due',userId]` cala PRIMA della conferma server; dashboard mostra il nuovo conteggio | `onError` ripristina lo snapshot |
| barra ottimistica | qualunque risposta applicata | `remainingCount` cala se l'esercizio esce; barra COMPLETATO cresce PRIMA della conferma | — |
| esercizio ripresentato | `again` riaccoda l'esercizio | ricompare senza alcun segnale distintivo (AC6) | — |
| persistenza | mutation `applyReview` | UNA `rpc('apply_review', …)` con valori pre-calcolati; retry riusa `review_id` (idempotente) | Supabase error ⇒ `DataError('applyReview')` (reject, alimenta TanStack) |
| pila vuota (deep-link) | `dueIds=[]` / coda vuota | stato neutro senza card (completamento è 3.21) | — |

</intent-contract>

## Code Map

- `src/domain/exercise-presentation.ts` -- **aggiungere** `composeResponse(exercise, selected): ExerciseResponse` e `selectionComplete(exercise, selected): boolean` (switch chiuso su `kind` con guardia `never`), che usano `answerOptions(exercise)`. `answerOptions` INVARIATO. Importare `ExerciseResponse` da `./exercise`.
- `src/domain/exercise-presentation.test.ts` -- **estendere**: per i tre kind, `composeResponse` produce la variante giusta (single-select choice, assemble order, select-span span `{i,i+1}`) e `selectionComplete` (1 vs `|opzioni|`); round-trip `composeResponse`→`check` corretto/errato.
- `src/domain/session.ts:82-93` -- **aggiungere** `export function remainingCount(state): number { return state.queue.length; }` (lettore puro, accanto a `isComplete`/`currentExerciseId`). `sessionReducer`/`createSession` INVARIATI.
- `src/domain/session.test.ts` -- **estendere**: `remainingCount` cala su esito uscente, invariato su `again` (riaccodo), 0 a coda vuota.
- `src/domain/exercise.ts:174-232` -- **riusare** `check`, `ExerciseResponse`, `CheckOutcome`, e `resolveExplanation`/`Explanation`/`ResolvedExplanation`. INVARIATO.
- `src/domain/outcome.ts:36-45` -- **riusare** `outcomeOf`. INVARIATO. `src/domain/schedule.ts:135-148` -- **riusare** `schedule`/`ReviewState`/`ReviewOutcome`. INVARIATO. `src/domain/due.ts:26-46` -- **riusare** `isDue`/`dueQueryKey`. INVARIATO.
- `src/domain/ports/reviewRepository.ts:16-34` -- **aggiungere** `ApplyReviewInput` (import `ReviewOutcome` da `../schedule`) e il metodo `applyReview(input): Promise<void>` all'interfaccia (docstring: unica via di persistenza, idempotente, valori pre-calcolati). `Ports` eredita automaticamente il metodo.
- `src/data/reviewRepository.ts:132-169` -- **implementare** `applyReview` nell'adattatore: `await client.rpc('apply_review', {…})` con mappatura camel→snake e `Date`→ISO; `error` ⇒ `DataError('applyReview', error)`. Nuova costante `APPLY_REVIEW_FN = 'apply_review'`.
- `src/data/reviewRepository.test.ts` -- **estendere** il finto client (cattura `rpc(fn, params)`); `applyReview` passa i parametri corretti (ISO per le date); `rpc` error ⇒ `DataError`.
- `src/features/study/sessionStore.ts:23-42` -- **estendere** lo store con `total: number` (id iniziali) e opz. `initialIds` per la chiave esercizi; `start(ids)` imposta `session`, `total`, `initialIds`. Delego invariato a `createSession`/`sessionReducer`.
- `src/features/study/sessionStore.test.ts` -- **aggiungere/estendere**: `start` popola `total`/`initialIds`; `dispatch(reviewed)` avanza via riduttore.
- `src/features/study/ExerciseCard.tsx` -- **espandere**: composizione per tipo (single-select/select-span a un tocco; assemble append-in-ordine con tessere piazzate `disabled` e badge di posizione), azione «mostra la spiegazione» (stato `consegna`), e stato `spiegazione` (rende `<ExplanationPanel correct=… />`). Props nuove: `answered`, `onReveal`, `revealed`, `correct`, `locale`. Nessun verde/rosso; ogni opzione `min-h-[56px]`.
- `src/features/study/ExerciseCard.test.tsx` -- **estendere**: composizione (assemble multi-tocco via props `selected`; badge d'ordine; tessere piazzate disabled), azione «mostra spiegazione» presente in `consegna`, stato `spiegazione` (dichiarazione testuale corretto/non-corretto, nessun `red`/`green`, spiegazione resa).
- `src/features/study/ExplanationPanel.tsx` -- **NUOVO**. Presentazionale: props `{ explanation: ResolvedExplanation; correct: boolean | null }`. `correct===null` ⇒ solo spiegazione (consulto pre-risposta); non-null ⇒ dichiarazione testuale + spiegazione. Rende `fallbackNotice` se `isFallback`; `lang` corretto; nessun colore d'esito.
- `src/features/study/ExplanationPanel.test.tsx` -- **NUOVO**. Consulto (nessuna dichiarazione), post-risposta (dichiarazione), ripiego (`isFallback` ⇒ avviso, `lang="en"`), nessun `red`/`green`.
- `src/features/study/ProgressMeter.tsx` -- **NUOVO**. Presentazionale: props `{ completed: number; total: number }`; `role="progressbar"`, `aria-valuenow/min/max`, `aria-label` da `t('session.progress.label')`, larghezza ~4px, stile larghezza = `completed/total`. Reso solo se `total>0`.
- `src/features/study/ProgressMeter.test.tsx` -- **NUOVO**. Attributi ARIA per (0/n), (k/n), (n/n); non reso a `total=0`.
- `src/features/study/SessionScreen.tsx` -- **riscrivere l'orchestrazione**: legge la pila (`['due',userId]`), avvia lo store (effetto guardato), corrente da `currentExerciseId(session)`, esercizi da `['exercises', initialIds]`; stato locale fase/`selected`/`usedExplanation`; gestore risposta (compose→check→outcomeOf→schedule→`review_id`→`dispatch`→`mutate` ottimistico); `ProgressMeter`; azione «prossimo esercizio». Mutation `applyReview` con `onMutate`/`onError`/`onSettled` (vedi Design Notes).
- `src/features/study/SessionScreen.test.tsx` -- **estendere**: seminare lo store; corrente dallo store; `ProgressMeter` reso con attributi coerenti; conteggio/consegna corrente; un solo `<main>`; neutro a coda vuota. (Gli stati post-risposta restano coperti dai test di componente.)
- `src/i18n/en.ts:88-97` / `src/i18n/it.ts` -- **aggiungere** in `session`: `outcome.{correct,incorrect}`, `explanation.{reveal,heading,fallbackNotice}`, `next`, `progress.label`, in parità (`en` ASCII).
- Finti `review` (aggiungere `applyReview`): `src/features/study/SessionScreen.test.tsx`, `src/features/dashboard/DashboardScreen.test.tsx`, `src/app/AppRoutes.test.tsx`, `src/app/AuthenticatedShell.test.tsx`, `src/app/AuthRoot.test.tsx`, `src/features/ports/PortsContext.test.tsx`, `src/ports-surface.test.ts`.

## Tasks & Acceptance

**Execution:**
- `src/domain/exercise-presentation.ts` (+ test) -- `composeResponse`/`selectionComplete` per i tre kind, pure.
- `src/domain/session.ts` (+ test) -- `remainingCount`.
- `src/domain/ports/reviewRepository.ts` + `src/data/reviewRepository.ts` (+ test) -- `ApplyReviewInput` + `applyReview` via `rpc('apply_review')`, `DataError` su errore.
- `src/features/study/sessionStore.ts` (+ test) -- `total`/`initialIds` in `start`.
- `src/features/study/ExplanationPanel.tsx` + `ProgressMeter.tsx` (+ test) -- nuovi presentazionali.
- `src/features/study/ExerciseCard.tsx` (+ test) -- composizione per tipo, azione «mostra spiegazione», stato `spiegazione`.
- `src/features/study/SessionScreen.tsx` (+ test) -- orchestrazione: store, esito sul client, mutation ottimistica, barra, avanzamento.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- chiavi `session` in parità.
- Finti `review` di app/ports/dashboard -- aggiungere `applyReview`.

**Acceptance Criteria:**
- **AC1 — Esito + spiegazione.** *Given* un esercizio presentato, *when* l'utente sceglie una risposta (completa), *then* il sistema dichiara in testo se è corretta (da `check().correct`) e mostra la spiegazione bilingue.
- **AC2 — Nessuna grammatica della celebrazione.** *Given* l'esito reso, *then* non usa verde per il corretto né rosso per lo sbagliato; l'informazione è portata dal contenuto della spiegazione; nessun `!`/emoji/lode/badge/animazione.
- **AC3 — Consulto pre-risposta.** *Given* un esercizio non ancora risolto, *when* l'utente consulta la spiegazione prima di rispondere, *then* è possibile, `usedExplanation` è registrato (declassa a `hard` un esito corretto) e non c'è stile di penalità.
- **AC4 — Esito sul client + persistenza idempotente.** *Given* una risposta, *when* è registrata, *then* l'esito è calcolato dal dominio SUL CLIENT in quell'istante con un `review_id` client, e la mutation `applyReview` trasporta i valori GIÀ calcolati (`rpc('apply_review')`, idempotente).
- **AC5 — Aggiornamenti ottimistici.** *Given* una risposta, *when* viene applicata, *then* il conteggio `['due',userId]` e la barra di avanzamento si aggiornano PRIMA della conferma del server; su errore il conteggio è ripristinato.
- **AC6 — Ripresentazione neutra.** *Given* un esercizio riaccodato da `again`, *when* ricompare nella stessa sessione, *then* non porta alcun segnale che lo distingua.
- **AC7 — Confini / regressione.** *Given* il diff, *then* `features` non importa `data`; dominio puro (nessun global temporale/casuale/import esterno; `crypto` solo in feature); parità en/it verde, `en` ASCII, copy senza `!`/emoji/lode; dashboard/rotte/`schedule`/`outcome`/`session` invariati nei comportamenti esistenti; `npm run lint`/`typecheck`/`test`/`validate-content` verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 2: (high 0, medium 1, low 1)
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[medium]` `[patch]` La pipeline di risposta e l'update ottimistico del conteggio giravano solo come glue non testata (3 layer convergenti): estratte due funzioni PURE di dominio — `evaluateAnswer` (`src/domain/review.ts`: compose→check→outcomeOf→schedule) e `applyResultToDue` (`src/domain/due.ts`: rimpiazza+filtra `isDue`) — con test dedicati (+13 test); `SessionScreen` ora le usa. Chiude il gap di verifica su AC4 (mapping esito/stage/dueAt) e AC5 (direzione del filtro ottimistico), senza jsdom, nella filosofia domain-puro del repo.
  - `[low]` `[patch]` Aggiunta guardia di re-entrancy `if (answered) return;` in cima a `onSelect` (`SessionScreen.tsx`): un tocco spurio dopo il commit non può ri-eseguire la pipeline (i bottoni sono già `disabled`, difesa ridondante).
- reject notevoli (verificati contro il codice reale e l'intento):
  - **`composeResponse` con `selected` vuoto ⇒ risposta malformata** (blind/edge): irraggiungibile — `onSelect` chiama `composeResponse` SOLO dopo `selectionComplete`, e la spec sanziona esplicitamente risposte parziali senza throw. Nessuna conseguenza utente.
  - **Chiave `['streak', userId]` non verificata** (blind): la chiave COMBACIA con la query streak della dashboard (`DashboardScreen`), quindi l'invalidazione aggiorna davvero lo streak.
  - **`crypto.randomUUID` assente su origine non sicura** (blind/edge): il target è sempre secure-context (HTTPS in produzione, localhost in dev), dove è disponibile.
  - **`aria-valuenow` non clampato in `ProgressMeter`** (blind): irraggiungibile — `completed = total − remainingCount ∈ [0, total]` per costruzione (coda ⊆ id iniziali).
  - **select-span mono-segmento / `declaredEasy=false` / lettura via `getState()`**: tutti sanciti e documentati dalla spec (scope 3.19), non difetti; lo span multi-segmento e il controllo «facile» non sono richiesti da alcun AC di Epic 3.
  - Altri respinti (nit di test/qualità senza conseguenza utente): asserzione `lang="en"` troppo larga ma adeguata in isolamento, assenza di guardia sui sorgenti i18n per `!`/emoji (coperta da convenzione + test sul reso), reset store duplicato nei test e seed a livello di describe in `AppRoutes.test` (benigni sotto l'isolamento per-file di vitest), guardia `enabled` della query esercizi equivalente, e la registrazione ride-along del consulto (unica lettura supportata dallo schema).

## Design Notes

**Perché il dominio compone la risposta.** `answerOptions` (3.18) rende, ma la RISPOSTA (choice/order/span) è la sua immagine speculare e deve vivere accanto, pura e testabile: la UI raccoglie tocchi (indici), il dominio traduce in `ExerciseResponse` che `check` sa valutare. `select-span` mono-segmento (indice→`{i,i+1}`) copre il contenuto attuale; lo span multi-segmento è un raffinamento differito, non un buco (l'unico `select-span` seminato ha `answer={0,1}`).

**Il ciclo si chiude con funzioni già scritte e testate.** `check`→`outcomeOf`→`schedule` esistono da 3.1/3.2; `apply_review` è a DB da 3.9 con la firma canonica AD-7; `sessionReducer` da 3.4. 3.19 è quasi tutto CABLAGGIO: la sola logica nuova (composizione, `remainingCount`, adattatore `applyReview`) è minima e pura/isolata.

**Ottimismo su due canali distinti.** Il *conteggio* è la pila `['due',userId]` (che la dashboard legge): update ottimistico via `onMutate`+`isDue` — `again` resta dovuto (conteggio fermo), `good` esce (conteggio cala). L'*avanzamento* è lo store di sessione locale che si evolve allo `dispatch` (prima e a prescindere dal server). Sono separati per costruzione: lo store ordina la coda (riaccodo in fondo su `again`), la pila conta.

**Esempio (gestore di risposta, in `SessionScreen`).**
```tsx
const onSelect = (index: number) => {
  const next = [...selected, index];
  setSelected(next);
  if (!selectionComplete(exercise, next)) return;          // assemble: attende tutte le tessere
  const response = composeResponse(exercise, next);
  const correct = check(exercise, response).correct;
  const outcome = outcomeOf({ correct }, usedExplanation, false);
  const now = clock.now();
  const result = schedule(currentState, outcome, now);     // currentState dallo snapshot di ['due']
  const reviewId = crypto.randomUUID();
  dispatch({ type: 'reviewed', result, now });             // avanza la coda (barra ottimistica)
  applyMutation.mutate({
    input: { reviewId, exerciseId: currentId, outcome, stage: result.stage,
             dueAt: result.dueAt, reviewedAt: now, usedExplanation },
    result,
  });
  setAnswered({ exercise, correct });                       // fase spiegazione, rende l'esercizio appena risposto
};
```

**Esempio (mutation ottimistica).**
```tsx
const applyMutation = useMutation({
  mutationFn: ({ input }) => review.applyReview(input),
  onMutate: async ({ input, result }) => {
    const key = dueQueryKey(userId ?? '');
    await queryClient.cancelQueries({ queryKey: key });
    const prev = queryClient.getQueryData<readonly ReviewState[]>(key);
    queryClient.setQueryData<readonly ReviewState[]>(key, (old) =>
      (old ?? []).map((s) => (s.exerciseId === input.exerciseId ? result : s))
                 .filter((s) => isDue(s, input.reviewedAt)));
    return { prev, key };
  },
  onError: (_e, _v, ctx) => { if (ctx) queryClient.setQueryData(ctx.key, ctx.prev); },
  onSettled: (_d, _e, _v, ctx) => {
    if (ctx) void queryClient.invalidateQueries({ queryKey: ctx.key });
    void queryClient.invalidateQueries({ queryKey: ['streak', userId] });
  },
});
```

**Testabilità.** Gestore e mutation sono glue d'effetto non eseguibili sotto `renderToStaticMarkup` (node/SSR, nessun jsdom) — verifica live per convenzione del repo (come `unlockMutation`/`changeLocale`). La correttezza REALE è nelle unità pure (`composeResponse`/`check`/`outcomeOf`/`schedule`/`remainingCount`, tutte testate) e negli stati resi via props (card/pannello/barra). I test di `SessionScreen` seminano store+cache e asseriscono lo stato `consegna` + barra.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (nuovo metodo di porta, `ApplyReviewInput`, funzioni di dominio, chiavi i18n `session.*`, props di card/pannelli).
- `npm run lint` -- expected: exit 0 (`features` non importa `data`; dominio senza global temporali/casuali/import esterni; `crypto` solo in feature; boundaries verdi).
- `npm test` -- expected: exit 0 (AC1-AC7: composizione per kind; `remainingCount`; `applyReview` mappa/DataError; card 3 stati + composizione assemble; `ExplanationPanel`/`ProgressMeter`; parità en/it; nessuna regressione a dashboard/rotte/`schedule`/`outcome`/`session`).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

## Auto Run Result

Status: done.

### Sintesi del cambiamento implementato
La storia 3.19 chiude il ciclo della sessione «rispondi → sai perché → resta registrato». La `SessionScreen` (`/studia`) ora: compone una risposta REALE per ogni tipo (single-select/select-span a un tocco, assemble a tocchi ordinati), calcola l'esito interamente sul client con le funzioni pure di dominio (`composeResponse`→`check`→`outcomeOf`→`schedule`), genera un `review_id` client e persiste con UNA chiamata idempotente (`applyReview` → RPC `apply_review`, già a DB dalla 3.9). Il terzo stato della card dichiara in TESTO la correttezza (nessun verde/rosso) e mostra la spiegazione bilingue, consultabile anche PRIMA di rispondere (registrata come `usedExplanation` → `hard`). Il conteggio della pila (`['due', userId]`) si aggiorna in modo ottimistico (primo `onMutate`/rollback del repo) e la barra di avanzamento deriva dallo store di sessione ora cablato (`total − remainingCount`), aggiornata dallo `dispatch` locale.

### File cambiati (rispetto al baseline `0d5558a9fea484cf66e23d55d7684c97f8e539f6`)
- `src/domain/exercise-presentation.ts` (+ test) -- `composeResponse`/`selectionComplete` per i tre kind (pure, totali).
- `src/domain/review.ts` (NUOVO, + test) -- `evaluateAnswer` (pipeline pura compose→check→outcomeOf→schedule; `declaredEasy` fisso `false`).
- `src/domain/due.ts` (+ test) -- `applyResultToDue` (update ottimistico puro: rimpiazza + filtra `isDue`).
- `src/domain/session.ts` (+ test) -- `remainingCount` (lettore puro per la barra).
- `src/domain/ports/reviewRepository.ts` -- `ApplyReviewInput` + metodo `applyReview`.
- `src/data/reviewRepository.ts` (+ test) -- `applyReview` via `rpc('apply_review')`, `DataError` su errore.
- `src/features/study/sessionStore.ts` (+ test) -- `total`/`initialIds` catturati in `start`.
- `src/features/study/ExplanationPanel.tsx` (NUOVO, + test) -- dichiarazione testuale dell'esito + spiegazione bilingue (ripiego dichiarato), nessun colore.
- `src/features/study/ProgressMeter.tsx` (NUOVO, + test) -- barra `role="progressbar"` (completato/totale), non resa a total 0.
- `src/features/study/ExerciseCard.tsx` (+ test) -- composizione per tipo, azione «mostra la spiegazione», terzo stato `spiegazione`.
- `src/features/study/SessionScreen.tsx` (+ test) -- orchestrazione: store, `evaluateAnswer`, mutation ottimistica (`applyResultToDue`), barra, «prossimo esercizio».
- `src/i18n/en.ts` / `src/i18n/it.ts` -- chiavi `session.outcome`/`explanation`/`next`/`progress` in parità (`en` ASCII).
- Finti `review` allineati con `applyReview` (`AppRoutes`, `AuthenticatedShell`, `AuthRoot`, `DashboardScreen`, `PortsContext`).

### Ripartizione dei rilievi di review (questo pass)
- Patch applicati: 2 (medium 1, low 1) — estrazione di `evaluateAnswer`+`applyResultToDue` con test (chiude il gap di verifica AC4/AC5) e guardia di re-entrancy in `onSelect`.
- Item deferiti (nuovi): 2 — reset dello store alla ri-entrata in `/studia` (di competenza 3.20, «la sessione si ricostruisce»); card bloccata su `currentState` undefined a metà sessione (divergenza coda/pila, si sovrappone allo stato d'errore del read-model già differito 3.18 #1).
- Item respinti: 13 (tutti low) — vedi `## Review Triage Log`; verificati contro codice reale e intento (irraggiungibili, sanciti dalla spec, o nit di test senza conseguenza utente).

### Raccomandazione di follow-up
`followup_review_recommended: false`. Rilievi `patch` di questo pass: high 0, medium 1, low 1; punteggio `3×1 + 1×1 = 4` (< 5) e nessun patch high. Nessun ulteriore ciclo necessario.

### Verifica eseguita
Tutte e quattro le verifiche dichiarate sono verdi DOPO i patch:
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0 (confini AD-1 verdi; `src/domain/review.ts` rispetta la purezza del dominio).
- `npm test` -- exit 0 (908 test, 79 file; +13 rispetto al pre-patch, nessuna regressione).
- `npm run validate-content` -- exit 0.
Matrix Test Audit: ogni riga della I/O matrix è coperta da almeno un test eseguito e verde; le porzioni glue (firing della mutation/effetto) sono verificate-live per convenzione del repo, con l'essenza pura ora coperta da `evaluateAnswer`/`applyResultToDue`.

### Rischi residui
- **Ri-entrata in `/studia`**: lo store singleton non è resettato ⇒ alla seconda visita la coda è stale (deferito a 3.20, che possiede la ricostruzione della sessione).
- **Divergenza coda/pila a metà sessione**: `currentState` undefined blocca la card (irraggiungibile nell'happy path; deferito, si sovrappone allo stato d'errore del read-model).
- **Verifica interattiva**: il montaggio finale (dispatch/mutate/`crypto.randomUUID`, transizioni di fase) è glue verificabile solo live (stack di test node/SSR); la logica pura sottostante è ora tutta testata.
