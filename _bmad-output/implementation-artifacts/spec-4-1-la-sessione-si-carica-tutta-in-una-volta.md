---
title: 'La sessione si carica tutta in una volta'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: 'fdc6a3306ba13a296d0d40e945b0c3208398baea'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Oggi la sessione carica gli esercizi con un doppio passo REATTIVO dopo il mount di `SessionScreen`: query `['due', userId]` → effetto `start(dueIds)` → query `['exercises', initialIds]`. Contenuto e spiegazione non sono garantiti in memoria NEL MOMENTO in cui la sessione parte; se il campo cade nella finestra fra i due passi (o durante la seconda query) la sessione resta a scheletro. Per chi sta per entrare in metropolitana, «perdere il campo a metà» la interrompe.

**Approach:** Un PRECARICO esplicito all'avvio sessione (il pulsante «svuota pila» della dashboard, cablato nel livello app) che — riusando la pila `['due', userId]` già in cache dal conteggio della dashboard (stessa chiave, nessuna divergenza) — carica in UN colpo solo l'intera pila dovuta con contenuto+spiegazioni sotto `['exercises', ids]` PRIMA di navigare a `/studia`. La sessione poi legge solo cache calda: avanzare non tocca la rete, spiegazione inclusa.

## Boundaries & Constraints

**Always:**
- Il precarico interroga la pila con `dueQueryKey(userId)` importata da `domain/due` — MAI un letterale `['due'` (sonda `due-sole-authority.test.ts`).
- Riusa la cache `['due']` esistente via `queryClient.ensureQueryData` (ritorna il valore in cache senza refetch se presente): il numero mostrato dalla dashboard e la pila caricata dalla sessione NON possono divergere (AD-5).
- Gli id si derivano dalla pila `['due']`; il contenuto si precarica sotto `['exercises', ids]` con la STESSA forma/ordine di chiave che `SessionScreen` costruisce (`['exercises', initialIds]`, dove `initialIds = dueData.map(s => s.exerciseId)`), così la sessione ottiene un cache-hit.
- Contenuto e spiegazione in UN solo batch (`content.listExercisesByIds`): la spiegazione è già dentro `ExerciseContent.exercise`, nessuna seconda richiesta.
- La navigazione resta nel livello app (AD-1): il precarico vive nel wiring di `AuthenticatedShell` (`usePorts()` + `useQueryClient()`), non nelle features che importerebbero react-router/data.
- `userId` null ⇒ nessun precarico (no-op).

**Block If:** _Nessuna._ L'unica ambiguità (dove vive il contenuto, cfr. AC3) è risolta dall'architettura, non richiede input umano (vedi Design Notes).

**Never:**
- NON arricchire il payload di `['due']` col contenuto: la dashboard sovraccaricherebbe (scaricherebbe tutti i corpi degli esercizi per un solo numero), e romperebbe `applyResultToDue`/l'aggiornamento ottimistico (operano su `ReviewState[]`) e il confine della porta `review` (ritorna stati, non contenuto).
- NON reimplementare `isDue`/la dovutezza fuori da `due.ts`.
- NON introdurre l'indicatore di sincronizzazione (4.4), la coda offline/persister (4.2/4.3), né richieste per-esercizio.
- NON gestire l'avvio a freddo senza rete / PWA (fuori scopo epica).
- NESSUNA nuova UI né annuncio: il precarico è invisibile.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pila già in cache (utente da dashboard) | `['due', userId]` popolata, si preme «svuota pila» | riusa `['due']` (nessun `listDue`), precarica `['exercises', ids]` con contenuto+spiegazioni, poi naviga | No error expected |
| Pila non in cache | `['due']` assente | `ensureQueryData` chiama `listDue(clock.now())`, poi precarica gli esercizi, poi naviga | vedi riga errore |
| Pila vuota | `['due']` = `[]` | `ids = []`, `listExercisesByIds([])` ⇒ `[]` senza query; naviga allo stato neutro | No error expected |
| userId null | `userId` assente | no-op, nessuna chiamata di porta, nessuna navigazione forzata | No error expected |
| Errore di precarico | `listDue`/`listExercisesByIds` reject | naviga COMUNQUE a `/studia` (degrado grazioso: la sessione ripiega sul caricamento reattivo) | rejection catturata; nessuna unhandled rejection |

</intent-contract>

## Code Map

- `src/features/study/prefetchDueStack.ts` -- **NUOVO**: la funzione di precarico (glue di feature testabile, come `submitSignOut`/`changeLessonsPerDay`). No hook interni: riceve `QueryClient` e le porte come parametri.
- `src/domain/due.ts:68` -- `dueQueryKey(userId)`: l'UNICA identità della pila; il precarico la importa verbatim.
- `src/domain/ports/reviewRepository.ts:43` -- `listDue(now): Promise<readonly ReviewState[]>` (metadati, non contenuto — resta invariata).
- `src/domain/ports/contentRepository.ts:64-71` -- `listExercisesByIds(ids): Promise<readonly ExerciseContent[]>`; `ExerciseContent.exercise` porta la `explanation`; `ids` vuoto ⇒ `[]` senza query.
- `src/app/AuthenticatedShell.tsx:53,70` -- **EDIT**: qui `onStartSession = () => navigate(STUDY_PATH)`; diventa async precarico→navigate (con guardia di re-entrancy). È sotto `PortsProvider` (AuthRoot) e `QueryClientProvider` (main.tsx): `usePorts()`/`useQueryClient()` disponibili.
- `src/features/study/SessionScreen.tsx:172-199` -- consumatore: `dueQ` (`['due']`) + `exercisesQ` (`['exercises', initialIds]`). INVARIATO: con la cache calda dal precarico legge cache-hit; per deep-link ripiega sul caricamento reattivo esistente.
- `src/features/dashboard/DashboardScreen.tsx:96-100,172` -- `dueQ` (`['due']`), `count = dueQ.data.length`. INVARIATO: popola `['due']` che il precarico riusa.
- `src/features/study/SessionScreen.test.tsx:73-82` / `src/app/AuthenticatedShell.test.tsx:41-61` -- convenzione di semina cache (`['due']` = `ReviewState[]`, `['exercises', ids]` = `ExerciseContent[]`).
- `src/features/study/SessionScreen.keyboard.test.tsx:1-35` -- pattern test d'interazione jsdom (`// @vitest-environment jsdom`, `createRoot`+`act`), da mirrorare per il wiring dello shell.

## Tasks & Acceptance

**Execution:**
- `src/features/study/prefetchDueStack.ts` -- CREARE `prefetchDueStack(queryClient, ports, userId)`: se `userId` è null ritorna subito; altrimenti `const states = await queryClient.ensureQueryData({ queryKey: dueQueryKey(userId), queryFn: () => ports.review.listDue(ports.clock.now()) })`; `const ids = states.map(s => s.exerciseId)`; `await queryClient.ensureQueryData({ queryKey: ['exercises', ids], queryFn: () => ports.content.listExercisesByIds(ids) })`. Importa `dueQueryKey` da `domain/due`; non importa react-router né `src/data`. -- Il precarico atomico che riusa la pila e carica contenuto+spiegazioni.
- `src/app/AuthenticatedShell.tsx` -- CABLARE il precarico: `const { review, content, clock } = usePorts()`, `const queryClient = useQueryClient()`; `onStartSession` diventa `() => { if (pending) return; pending=true; void prefetchDueStack(queryClient, { review, content, clock }, userId).catch(() => {}).finally(() => { pending=false; navigate(STUDY_PATH); }) }` (guardia di re-entrancy con `useRef`). Firma pubblica di `AuthenticatedShell` e prop `onStartSession: () => void` della dashboard INVARIATE. -- Innesca il precarico all'avvio sessione, naviga solo dopo (anche su errore).
- `src/features/study/prefetchDueStack.test.ts` -- CREARE (env node): QueryClient reale + porte spia (`vi.fn`). Coprire ogni riga della I/O Matrix. -- Verifica AC1/AC3 e gli edge sulla superficie reale (la cache che la sessione legge).
- `src/app/AuthenticatedShell.prefetch.test.tsx` -- CREARE (`// @vitest-environment jsdom`, `createRoot`+`act`, `MemoryRouter`): cliccare l'azione primaria e verificare che `listDue`+`listExercisesByIds` siano invocate con gli id dovuti e che la posizione diventi `/studia`. -- Osserva la superficie esterna (AC4).

**Acceptance Criteria:**
- Given una pila dovuta con esercizi e spiegazioni, when `prefetchDueStack` viene eseguito, then dopo la sua risoluzione `queryClient.getQueryData(dueQueryKey(userId))` e `queryClient.getQueryData(['exercises', ids])` sono entrambe popolate e ogni `ExerciseContent` caricato porta la sua `explanation`. (AC1)
- Given la cache popolata dal precarico e nessuna porta di rete disponibile, when `SessionScreen` rende leggendo `['due']`+`['exercises', ids]` e avanza fra gli esercizi, then consegna e spiegazione compaiono senza che alcuna queryFn venga invocata. (AC2)
- Given `['due', userId]` già in cache (come dopo il conteggio della dashboard), when il precarico interroga la pila, then usa `dueQueryKey(userId)` e RIUSA il valore in cache senza richiamare `listDue`, così gli id caricati coincidono con quelli contati dalla dashboard. (AC3)
- Given l'utente sulla dashboard con pila non vuota, when preme l'azione «svuota pila», then il precarico dell'intera pila viene eseguito e SOLO dopo la sua conclusione avviene la navigazione a `/studia`. (AC4)
- Given una pila vuota, when il precarico viene eseguito, then non interroga il contenuto (`ids` vuoti) e naviga comunque; and given un errore di rete nel precarico, when accade, then la navigazione a `/studia` avviene comunque. (AC5)

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 11
- addressed_findings:
  - `[low]` `[patch]` La chiave `['exercises', ids]` era un letterale duplicato inline in `SessionScreen` e nel nuovo `prefetchDueStack` (segnalato da tre reviewer come fragilità: se le due forme divergessero il precarico non darebbe cache-hit). Estratta in `exercisesQueryKey()` condiviso (`src/features/study/exercisesQueryKey.ts`), speculare a `dueQueryKey` del dominio, e cablata in entrambi i siti di produzione. I test esistenti che seminano il letterale `['exercises', ids]` restano invariati e fanno da cross-check che l'helper produca lo stesso valore.

Note sui reject principali (dissolti dall'architettura, non difetti in-scope):
- **Skew temporale / divergenza `initialIds`**: il precarico RIUSA la cache `['due']` via `ensureQueryData` (nessun refetch) e `startSession` è un effetto guardato una-tantum che parte con i dati in cache ⇒ gli id caricati non divergono dal conteggio della dashboard.
- **`['exercises']` non per-utente**: corretto — il contenuto è globale (stesso per tutti, contratto di porta).
- **`/studia` deep-link salta il precarico**: coperto dal caricamento reattivo esistente di `SessionScreen`; l'offline a freddo è fuori scopo epica.
- **AC2 (avanzare senza rete)**: già soddisfatto e testato da `SessionScreen`/keyboard test (Epic 3); il precarico ne garantisce solo la cache calda.
- **staleTime:0 / refetch in background**: policy app-wide preesistente; il display è servito dalla cache (con `retry:false` il dato resta), quindi «mostrare» non richiede rete. Fuori scopo.
- **Guardia di re-entrancy inosservabile**: TanStack deduplica il fetch e la navigazione allo stesso path è idempotente ⇒ la guardia non ha effetto osservabile per il consumatore.

## Design Notes

**Perché il contenuto NON vive sotto `['due']` (lettura di AC3).** «Il precarico interroga la pila usando `['due', userId]`» significa che il precarico LEGGE la pila da quella chiave (per sapere quali esercizi caricare), non che il contenuto sia archiviato lì. Archiviarlo lì (a) farebbe sovraccaricare la dashboard, che scaricherebbe tutti i corpi degli esercizi solo per rendere un numero; (b) romperebbe `applyResultToDue`/l'aggiornamento ottimistico del conteggio, che operano su `ReviewState[]`; (c) violerebbe il confine della porta `review` (`listDue` ritorna stati, non contenuto). L'unica-verità che `due.ts` protegge è QUALE-è-dovuto: riusando la cache `['due']` col medesimo `ensureQueryData`, «il numero mostrato e quello caricato» non possono divergere — esattamente la garanzia richiesta.

**Forma del precarico (glue):**
```ts
export async function prefetchDueStack(qc: QueryClient, ports: PrefetchPorts, userId: string | null) {
  if (userId === null) return;
  const states = await qc.ensureQueryData({
    queryKey: dueQueryKey(userId),
    queryFn: () => ports.review.listDue(ports.clock.now()),
  });
  const ids = states.map((s) => s.exerciseId);
  await qc.ensureQueryData({
    queryKey: ['exercises', ids],
    queryFn: () => ports.content.listExercisesByIds(ids),
  });
}
```

## Verification

**Commands:**
- `npm run lint` -- expected: nessuna violazione (incluso il confine di dominio AD-1).
- `npm run typecheck` -- expected: nessun errore TS.
- `npm test` -- expected: tutta la suite verde, inclusi i nuovi `prefetchDueStack.test.ts` e `AuthenticatedShell.prefetch.test.tsx`, e i test esistenti di `SessionScreen`/`DashboardScreen`/`AuthenticatedShell` invariati.

## Auto Run Result

Status: done

**Modifica implementata.** Precarico esplicito dell'intera pila dovuta all'avvio sessione. Prima, la sessione caricava gli esercizi in due passi reattivi dopo il mount (`['due']` → effetto `start` → `['exercises', initialIds]`). Ora il pulsante «svuota pila» della dashboard innesca `prefetchDueStack`, che riusa la pila `['due', userId]` già in cache (stessa chiave del conteggio dashboard, nessuna divergenza) e carica contenuto+spiegazioni sotto `['exercises', ids]` PRIMA di navigare a `/studia`. La sessione legge poi solo cache calda; avanzare non tocca la rete.

**File cambiati:**
- `src/features/study/prefetchDueStack.ts` (nuovo) — la funzione di precarico, glue testabile senza React (riceve QueryClient + porte).
- `src/features/study/exercisesQueryKey.ts` (nuovo, patch di review) — identità condivisa della cache del contenuto `['exercises', ids]`, speculare a `dueQueryKey`.
- `src/features/study/prefetchDueStack.test.ts` (nuovo) — 7 unit test sulla superficie reale (QueryClient + porte spia): copre ogni riga della matrice I/O.
- `src/app/AuthenticatedShell.prefetch.test.tsx` (nuovo) — 4 test d'interazione jsdom: click → precarico → navigazione, guardia di re-entrancy, degrado grazioso su errore.
- `src/app/AuthenticatedShell.tsx` (modificato) — cablaggio del precarico in `onStartSession` (async, guardia `useRef`, naviga sempre dopo il settle).
- `src/features/study/SessionScreen.tsx` (modificato, patch di review) — usa `exercisesQueryKey(initialIds)` invece del letterale inline; nessun cambio di comportamento.

**Triage dei finding di review:** 1 patch applicato (`low`), 0 deferiti, 11 rigettati. Il patch ha centralizzato la chiave `['exercises', ids]` in un helper condiviso (fragilità segnalata da tre reviewer). I rigetti sono dissolti dall'architettura (riuso cache `['due']` via `ensureQueryData` + `startSession` una-tantum; contenuto globale; route guard su `/studia`; AC2 già coperto da Epic 3; staleTime app-wide fuori scopo) — dettaglio nel Review Triage Log.

**Raccomandazione follow-up review:** `false`. Patch di questo pass per severità: high 0, medium 0, low 1. Punteggio `3×medium + 1×low = 1` (< 5) e nessun patch `high` ⇒ false.

**Verifica eseguita:**
- `npm run typecheck` — pulito.
- `npm run lint` — pulito (confini AD-1 e sonda `due-sole-authority` inclusi).
- `npm test` — 960 test verdi su 84 file (2 nuovi file + suite esistenti invariate). Matrix Test Audit: tutte e 5 le righe coperte da test eseguiti e passati.

**Rischi residui:** Nessuno bloccante. Il precarico è un warm-cache best-effort: sul percorso canonico (utente online che avvia dalla dashboard) garantisce la pila in memoria prima della sessione; l'offline a freddo e il deep-link diretto a `/studia` ripiegano sul caricamento reattivo esistente (per progetto, coerente con lo scopo dell'epica).
