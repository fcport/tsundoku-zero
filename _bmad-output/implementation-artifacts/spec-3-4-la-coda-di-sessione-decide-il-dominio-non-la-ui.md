---
title: 'Story 3.4 — La coda di sessione decide il dominio, non la UI'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: 'c08ce33baa7850cf195c77d846fb8d4320023fa5'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** La coda di una sessione di esercizi deve avere **una sola** verità su
chi resta e chi esce: se lo decidesse la UI (FR5.4 «intervallo 0 = in fondo alla
coda»), la stessa risposta produrrebbe code diverse a seconda della schermata, e
la sessione potrebbe «finire» con esercizi ancora sbagliati. Serve la quarta legge
di dominio di Epic 3 (`AD-6`): la coda è un **riduttore puro**, e lo store che la
ospita non fa che delegare.

**Approach:** Un modulo di dominio puro `src/domain/session.ts` che espone
`sessionReducer(state, event)` — quando l'esito di una valutazione ha **intervallo
risultante 0** (l'esercizio è ancora dovuto: `isDue(result, now)` di `./due`)
l'esercizio torna in fondo alla coda, altrimenti ne esce — più `createSession`,
`isComplete` e `currentExerciseId`. Sopra, uno store **Zustand** in
`src/features/study/sessionStore.ts` che tiene lo stato e delega ogni calcolo al
riduttore, **non** persistito. La coda riusa `isDue` (`AD-5`) come unico predicato
di dovutezza: sessione e pila non possono divergere.

## Boundaries & Constraints

**Always:**
- `session.ts` vive sotto `src/domain/` → purezza `AD-1`: nessun import esterno,
  nessun global di piattaforma, nessun `fetch`/`Date.now()`/`new Date()` senza
  argomenti/`Intl…resolvedOptions()`/`Math.random()`. L'istante `now` **entra**
  dentro l'evento, mai letto dall'orologio.
- `sessionReducer` è puro, sincrono, totale e non muta lo stato: stessa coppia
  `(state, event)` ⇒ stesso `SessionState` nuovo (`sessionReducer.length === 2`).
- La decisione requeue-o-esci è delegata a `isDue(result, now)` di `../due`: la coda
  **non** reimplementa la dovutezza né confronta `dueAt` per conto suo.
- Riusa `type ReviewState` da `./schedule` senza ridefinirlo.
- Lo store è in `src/features/study/` (features → domain ammesso), contiene stato +
  azioni che **delegano** a `createSession`/`sessionReducer`, e **non** è persistito
  (nessun `persist`, nessuno storage): la sessione è effimera, FR4.7 la ricostruisce.
- `zustand@^5.0.15` (versione fissata dalla spine) va aggiunta a `dependencies` con
  `npm install`, aggiornando `package.json` **e** `package-lock.json`.

**Block If:**
- Nessuna condizione bloccante attesa: gli AC risolvono ogni scelta osservabile.

**Never:**
- Nessuna logica di scheduling o di coda dentro lo store: lo store forwarda, il
  dominio decide (`AD-6`).
- Nessuna persistenza/rete/RPC/SQL/client Supabase, nessun adattatore di
  `ReviewRepository` (è la storia 3.10), nessuna schermata di sessione né rendering
  (3.18+): qui si fissano riduttore e store perché i consumatori non nascano divergenti.
- Nessun altro punto di `src/` decide l'ordine/appartenenza della coda di sessione.

## I/O & Edge-Case Matrix

`sessionReducer` e i suoi companion (`result` = `schedule(state, outcome, now)`):

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| coda iniziale | `createSession(['a','b','c'])` | `queue ['a','b','c']`, `currentExerciseId 'a'`, `isComplete false` | nessun errore |
| coda vuota | `createSession([])` | `queue []`, `currentExerciseId null`, `isComplete true` | nessun errore |
| intervallo 0: `again` | `['a','b','c']`, `reviewed` con `schedule(stage0 'a','again',now)` | `'a'` in fondo → `['b','c','a']` | nessun errore |
| intervallo 0: `hard` a stadio 0 | `['a','b']`, `reviewed` con `schedule(stage0 'a','hard',now)` | `'a'` in fondo → `['b','a']` | nessun errore |
| intervallo > 0: `good` | `['a','b','c']`, `reviewed` con `schedule(stage0 'a','good',now)` | `'a'` esce → `['b','c']` | nessun errore |
| intervallo > 0: `easy` | `['a']`, `reviewed` con `schedule(stage0 'a','easy',now)` | esce → `[]`, `isComplete true` | nessun errore |
| ultimo ancora dovuto | `['a']`, `reviewed` `'a'` `again` | resta `['a']`, `isComplete false` | nessun errore |
| ultimo superato | `['a']`, `reviewed` `'a'` `good` | `[]`, `isComplete true` | nessun errore |
| id non in coda | `['a','b']`, `reviewed` con `result.exerciseId = 'z'` | invariato `['a','b']` | nessun errore |
| non-mutazione | qualunque `state` | lo `state` passato è invariato | nessun errore |
| determinismo | stessa `(state, event)` due volte | risultati uguali per valore | nessun errore |

</intent-contract>

## Code Map

- `src/domain/session.ts` -- **DA CREARE.** Espone `type SessionState = { readonly queue: readonly string[] }`, `type SessionEvent = { type: 'reviewed'; result: ReviewState; now: Date }`, `createSession(ids): SessionState`, `sessionReducer(state, event): SessionState`, `isComplete(state): boolean`, `currentExerciseId(state): string | null`. Importa `type ReviewState` da `./schedule` e `isDue` da `./due`.
- `src/domain/schedule.ts:42,129-142` -- `LEITNER_INTERVALS_DAYS` (stadio 0 = intervallo 0) e `schedule()`, che per `again` e per `hard` a stadio 0 produce `dueAt === now` (intervallo 0, jitter 0). È la ragione per cui la coda distingue «resta» da «esce». I test costruiscono i `result` chiamando `schedule()` reale, non a mano.
- `src/domain/due.ts:isDue` -- Riusare: `isDue(result, now)` = `result.dueAt <= now` è l'**unico** predicato che dice se l'esercizio è ancora dovuto (intervallo 0). La coda vi delega la decisione di requeue (`AD-5`), confine inclusivo `<=`.
- `src/domain/schedule.ts:27-34` -- `interface ReviewState` (`exerciseId` è l'identità nella coda). Riusare, non ridefinire.
- `src/features/study/sessionStore.ts` -- **DA CREARE.** Store Zustand: `create<SessionStore>()((set) => …)` con `session: SessionState` + azioni `start(ids)` → `createSession` e `dispatch(event)` → `sessionReducer`. Nessuna manipolazione di `queue`, nessun import di `schedule`/`due`, nessun `persist`/storage.
- `src/features/settings/`, `src/features/account/` -- Convenzione della cartella di feature da rispecchiare (nessun `index.ts` obbligatorio; `boundaries` classifica per cartella).
- `src/domain/schedule-purity.test.ts:1-62` -- Pattern della sonda di purezza temporale (`stripComments` + regex sui costrutti vietati + anti-vacuità + `fn.length`) da replicare per `session-purity.test.ts`.
- `src/domain/due.test.ts:1-99` -- Pattern della I/O Matrix con anti-vacuità e snapshot di non-mutazione da replicare per `session.test.ts`.
- `eslint.config.js:74-117,174-183` -- `boundaries`: `features → domain` ammesso; `features` **può** importare `zustand` (non è fra i disallow `i18next`/`react-i18next`/`react-router`); `domain → domain`; `no-restricted-globals` solo sul dominio.
- `src/boundaries.test.ts:113-140` -- Lintà tutto `src/**` a 0 errori: i nuovi file devono passare.
- `vitest.config.ts:7` -- Ambiente `node`: lo store si prova con `useSessionStore.getState()/.setState()` senza React né DOM.
- `tsconfig.json:19-22` -- `strict` + `noUnusedParameters`; usare la forma **curried** `create<SessionStore>()(...)` per l'inferenza TS di Zustand v5.
- `.../ARCHITECTURE-SPINE.md:87-91,235,304,330` -- `AD-6` (store delega, non persistito), Zustand `5.0.15`, `domain/session.ts`, F4 → `features/study`.
- `package.json:19-26` -- aggiungere `zustand` a `dependencies`.

## Tasks & Acceptance

**Execution:**
- `package.json` + `package-lock.json` -- `npm install zustand@^5.0.15`: aggiunge la dipendenza (versione della spine) e aggiorna il lock. Committare entrambi i file.
- `src/domain/session.ts` -- Creare il modulo puro. `sessionReducer`: rimuovi `event.result.exerciseId` dalla coda; se era presente **e** `isDue(event.result, event.now)` è vero (intervallo 0), riaccodalo in fondo, altrimenti resta rimosso. `createSession(ids) = { queue: [...ids] }`; `isComplete = queue.length === 0`; `currentExerciseId = queue[0] ?? null`. Nessun costrutto temporale/di rete/non deterministico.
- `src/features/study/sessionStore.ts` -- Creare lo store Zustand che ospita `SessionState` e delega: `start` → `createSession`, `dispatch` → `sessionReducer`. Nessuna logica di coda/scheduling, nessun `persist`, nessuno storage.
- `src/domain/session.test.ts` -- Coprire l'intera I/O Matrix (coda iniziale/vuota, requeue su `again` e su `hard`-stadio-0, uscita su `good`/`easy`, ultimo dovuto vs superato, id assente, non-mutazione, determinismo), costruendo i `result` con `schedule()` reale. Anti-vacuità: casi verdi su entrambi i lati della decisione requeue.
- `src/domain/session-purity.test.ts` -- Sonda meccanica sul sorgente di `session.ts` (modellata su `schedule-purity.test.ts`): assenza di `fetch`/`Date.now(`/`new Date()` senza argomenti/`Intl…resolvedOptions(`/`Math.random`; anti-vacuità (file trovato, non vuoto, contiene `export function sessionReducer`); `sessionReducer.length === 2`.
- `src/features/study/sessionStore.test.ts` -- Test comportamentale (Vitest `node`, `useSessionStore.getState()`): `start` costruisce la coda via `createSession`; dopo un `dispatch`, `session` è **esattamente** `sessionReducer(before, event)` (delega provata per valore); un `again` riaccoda attraverso lo store. Reset in `beforeEach`.
- `src/features/study/sessionStore-source.test.ts` -- Sonda meccanica sul sorgente dello store: importa/usa `sessionReducer` e `createSession`; **non** contiene il token `queue` né import di `../../domain/schedule`/`due`; **non** contiene `persist`/`localStorage`/`sessionStorage`. Anti-vacuità (file trovato, non vuoto, contiene `create<`).

**Acceptance Criteria:**
- Given `sessionReducer(state, event)` in `src/domain/session.ts`, when un evento `reviewed` porta un esito con **intervallo risultante 0** (`isDue(result, now)` vero: `again`, o `hard` a stadio 0), then l'esercizio torna **in fondo** alla coda corrente.
- Given una coda in cui ogni esercizio riceve un esito con **intervallo > 0** (per una pila di sblocco fresco a stadio 0 è un `good` o un `easy`), when tutti sono stati valutati così, then la coda è vuota e `isComplete` è `true` (la sessione può terminare).
- Given `sessionReducer`, when lo si invoca, then è puro, sincrono, totale, non muta lo stato e riceve `now` **dentro l'evento** (`sessionReducer.length === 2`; il sorgente non contiene costrutti temporali/di rete/non deterministici).
- Given la decisione requeue-o-esci, when un esercizio viene valutato, then è `isDue` di `../due` — l'**unica** definizione di «dovuto» — a stabilirla: la coda non reimplementa la dovutezza.
- Given lo store Zustand di `src/features/study/`, when lo si ispeziona, then delega ogni calcolo a `createSession`/`sessionReducer` e **non** contiene logica di scheduling o di coda.
- Given lo store, when lo si ispeziona, then **non** è persistito (nessun `persist`, nessuno storage): un'istanza fresca parte a coda vuota.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 15: (high 0, medium 0, low 15)
- addressed_findings:
  - `[low]` `[patch]` Lo `switch (event.type)` di `sessionReducer` era privo della guardia di esaustività `never` che il dominio usa altrove (`exercise.ts:246-249`, `exercise-identity.ts:43-48`). Aggiunta come `assertNever` **dopo** lo switch (`const _exhaustive: never = event.type; void _exhaustive; return state;`) — non come `default`, che su una union a un solo membro **non compila** (`event` non si restringe a `never`). Così un futuro tipo di `SessionEvent` non gestito diventa un errore di COMPILAZIONE invece di un `undefined` silenzioso (tsconfig non ha `noImplicitReturns`).

_Note di triage:_ quattro layer in parallelo. **Verification-gap**: nessun gap — ogni
ramo comportamentale (requeue su `again`/`hard`-a-stadio-0, uscita su `good`/`easy`,
guardia `wasQueued`, non-mutazione, determinismo, delega dello store per valore) è
pinnato da asserzioni eseguite che usano `schedule()` reale. **Intent-alignment**:
descrittivo, nessuna divergenza — la lettura «intervallo 0» è onorata via `isDue`
(`AD-5`), equivalente per l'invariante di `schedule()` (jitter proporzionale ⇒
intervallo 0 ⇒ `dueAt === now`), e AC3 è coperto da sonda lessicale **più** test
comportamentale di delega. **Edge-case-hunter** (4 finding) e **blind-hunter** (~12):
un solo finding sopravvive (la guardia `never`, sopra). Rifiutati: validazione di
input non fidato (`ids` null/undefined, `Date` non valida ⇒ `NaN`, id duplicati) —
per contratto `AD-1` è responsabilità del data layer (3.7–3.10), stesso rifiuto già
stabilito in 3.1/3.3, e aggiungere `throw` violerebbe la totalità/purezza; selettori
dello store, reset su logout/cambio utente, stabilità referenziale su no-op,
consolidamento delle sonde di purezza, rigenerazione del grafo delle dipendenze e
rinominare `dispatch` → concerni di storie successive (schermate 3.18+, adattatore
3.10, ciclo di vita auth) senza consumatore attuale; la ridondanza `now`/`dueAt` è
intrinseca alla delega a `isDue` ed è documentata nel JSDoc dell'evento; la
«fragilità» della sonda lessicale dello store è complementata dal test di delega per
valore. Nessun altro finding sopravvive al triage.

## Design Notes

**Il cuore è minimo, il punto è l'unicità.** Come `isDue` in 3.3, il riduttore è
poche righe; il valore è che la coda di sessione ha **un solo** posto che decide, e
che quel posto è il dominio, non lo store né la UI (titolo della storia, `AD-6`).

```ts
import type { ReviewState } from './schedule';
import { isDue } from './due';

export type SessionState = { readonly queue: readonly string[] };
export type SessionEvent = { type: 'reviewed'; result: ReviewState; now: Date };

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'reviewed': {
      const id = event.result.exerciseId;
      const remaining = state.queue.filter((qid) => qid !== id);
      const wasQueued = remaining.length !== state.queue.length;
      // intervallo 0 ⇔ ancora dovuto adesso ⇔ resta in sessione (in fondo)
      return wasQueued && isDue(event.result, event.now)
        ? { queue: [...remaining, id] }
        : { queue: remaining };
    }
  }
}
```

**Perché riusare `isDue` (scelta risolta, non un accorgimento).** `schedule()`
produce `dueAt >= now` sempre; l'intervallo è 0 **se e solo se** `dueAt === now`,
cioè **se e solo se** `isDue(result, now)`. Delegare a `isDue` non è un trucco: è
il significato corretto — «ancora dovuto in questa sessione» è la stessa dovutezza
della pila (`AD-5`). Così la coda di sessione e la pila della dashboard non possono
mai dare risposte diverse su cosa è dovuto.

**Riconciliazione di AC2 dell'epica («almeno un `good`»).** La regola precisa è
*intervallo > 0 ⇒ esce*, non *outcome === good*: anche `easy` fa uscire, e un `hard`
a stadio ≥ 1 fa uscire senza un `good`. La formula «ogni esercizio ha ricevuto
almeno un good» dell'epica descrive il caso dominante — una sessione di **sblocco
fresco** (tutti a stadio 0), dove gli unici esiti che superano l'esercizio sono
`good` ed `easy`. La coda resta guidata dall'intervallo (FR5.4/`AD-6`); i test
coprono esplicitamente sia `easy` (esce) sia `hard`-a-stadio-0 (resta) per fissare
la regola reale.

**Perché lo store ora e le schermate no.** Come 3.3 ha dichiarato la porta prima
dell'adattatore, 3.4 fissa store+riduttore prima delle schermate (3.18+): lo store
nasce «muto» così nessuna schermata futura sarà tentata di metterci logica di coda.
Vive in `features/study` (F4 nella spine) perché deve importare il dominio (`ui`
non può; `features` sì). Non è persistito per specifica: la sessione è effimera e
FR4.7 la ricostruisce dagli esercizi ancora dovuti.

```ts
export const useSessionStore = create<SessionStore>()((set) => ({
  session: createSession([]),
  start: (ids) => set(() => ({ session: createSession(ids) })),
  dispatch: (event) => set((s) => ({ session: sessionReducer(s.session, event) })),
}));
```

**`currentExerciseId`/`isComplete` sono la superficie di lettura della coda:** le
schermate leggeranno «l'esercizio corrente» e «è finita?» da qui, non indicizzando
`state.queue[0]` — la forma interna (array ordinato) resta un segreto del dominio.

## Verification

**Commands:**
- `npm install zustand@^5.0.15` -- expected: `zustand` in `dependencies`, `package-lock.json` aggiornato, `npm ci` ancora coerente.
- `npm run test -- src/domain/session src/features/study` -- expected: `session.test.ts`, `session-purity.test.ts`, `sessionStore.test.ts`, `sessionStore-source.test.ts` tutti verdi.
- `npm run test` -- expected: suite completa verde, 0 regressioni (le sonde di sola autorità di `outcome`/`due` non vedono nuovi offender: `session.ts` non ritorna letterali d'esito né confronta `dueAt`).
- `npm run typecheck` -- expected: nessun errore (`strict`, `noUnusedParameters`; forma curried di `create`).
- `npm run lint` -- expected: nessuna violazione (`boundaries` `features → domain`; `features` può importare `zustand`; purezza del dominio).

## Auto Run Result

Status: done
Follow-up review recommended: false (patch: high 0, medium 0, low 1 → score 3×0 + 1×1 = 1 < 5, nessun high)

**Change implementato:** creata la quarta legge di dominio di Epic 3 (`AD-6`) — **la
coda di sessione decide il dominio, non la UI**. `sessionReducer(state, event)` in
`src/domain/session.ts` è l'UNICO punto che decide chi resta e chi esce dalla coda:
puro, sincrono, totale, non-mutante; su un evento `reviewed` rimuove l'esercizio
valutato e, se l'esito è ancora dovuto adesso (`isDue(result, now)` — intervallo
risultante 0, cioè `again` o `hard` a stadio 0), lo riaccoda in fondo, altrimenti
esce. La decisione requeue è **delegata a `isDue`** (`AD-5`, `src/domain/due.ts`): la
coda non reimplementa la dovutezza, così sessione e pila non possono divergere.
`createSession`/`isComplete`/`currentExerciseId` sono la superficie di lettura della
coda (la forma interna resta un segreto del dominio). Sopra, lo store Zustand
`src/features/study/sessionStore.ts` ospita lo stato e **delega** ogni calcolo al
riduttore, senza logica di coda/scheduling e **non** persistito (`AD-6`; FR4.7
ricostruisce la sessione dagli esercizi ancora dovuti). Adattatore dati (3.10) e
schermate di sessione (3.18+) restano fuori ambito per l'ordinamento dell'epica.

**File cambiati:**
- `package.json` -- aggiunta `zustand@^5.0.15` a `dependencies` (versione fissata dalla spine).
- `package-lock.json` -- rigenerato da `npm install zustand@^5.0.15` (voce `zustand@5.0.15`); `npm ci` resta coerente.
- `src/domain/session.ts` -- nuovo: `SessionState`, `SessionEvent`, `createSession`, `sessionReducer` (con guardia di esaustività `never` dopo lo switch), `isComplete`, `currentExerciseId`. Importa `type ReviewState` da `./schedule` e `isDue` da `./due` (nessun import esterno/global/costrutto temporale).
- `src/domain/session.test.ts` -- nuovo: 14 test, intera I/O Matrix costruendo i `result` con `schedule()` reale (requeue su `again`/`hard`-stadio-0, uscita su `good`/`easy`, ultimo dovuto vs superato, sblocco fresco che si svuota, id assente, non-mutazione, determinismo, anti-vacuità sui due lati).
- `src/domain/session-purity.test.ts` -- nuovo: 6 test, sonda meccanica sul sorgente (assenza di `fetch`/`Date.now`/`new Date()`/`resolvedOptions`/`Math.random`), anti-vacuità, `sessionReducer.length === 2`.
- `src/features/study/sessionStore.ts` -- nuovo: store Zustand in forma curried che delega a `createSession`/`sessionReducer`; nessuna logica di coda, nessun `persist`/storage.
- `src/features/study/sessionStore.test.ts` -- nuovo: 5 test comportamentali (istanza fresca vuota; `start` via `createSession`; `dispatch` = `sessionReducer(before, event)`; requeue/uscita attraverso lo store).
- `src/features/study/sessionStore-source.test.ts` -- nuovo: 5 test, sonda meccanica sul sorgente dello store (usa `sessionReducer`/`createSession`; nessun token `queue`; nessun import di `schedule`/`due`; nessun `persist`/storage; anti-vacuità).

**Review findings:** 1 patch (low), 0 deferred, 15 rejected, 0 intent_gap, 0 bad_spec.
Quattro layer in parallelo (blind-hunter, edge-case-hunter, verification-gap,
intent-alignment); dettaglio nel Review Triage Log. Il patch — guardia di esaustività
`never` sullo switch del riduttore — è stato applicato come `assertNever` **dopo** lo
switch (la forma `default` non compila su una union a un solo membro), ri-derivato dal
subagent di implementazione con contesto intatto.

**Verifica eseguita (dopo la patch):**
- `npm run test -- src/domain/session src/features/study` → 30/30 verdi (4 file).
- `npm run test` (suite completa) → 492/492 verdi, 52 file, 0 regressioni (le sonde di sola autorità di `outcome`/`due` non vedono nuovi offender; `boundaries.test.ts` linta tutto l'albero a 0 errori).
- `npm run typecheck` → nessun errore (`strict`, `noUnusedParameters`; forma curried di `create`; guardia `never` che compila su union a un membro via `event.type`).
- `npm run lint` → nessuna violazione.
- Matrix Test Audit: tutte le 11 righe della I/O Matrix coperte da test eseguiti e verdi in `session.test.ts` (14/14).

**Rischi residui:** nessuno per l'ambito di questa storia. La validazione degli input
(`ids` non vuoti, `Date` valide) resta per contratto `AD-1` responsabilità del data
layer (3.7–3.10), coerentemente con `schedule()`/`isDue()`. Il ciclo di vita dello
store (reset su logout/cambio utente) e l'esposizione di selettori derivati sono
concerni delle storie che cablano lo store nelle schermate (3.18+), senza consumatore
in questa storia.
