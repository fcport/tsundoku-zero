---
title: 'Story 3.3 — Una sola definizione di "dovuto"'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: '9063002595a2ab7b970f31eed24b792d4d04cf34'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** La pila dei "dovuti" deve avere **una sola** verità: se la dashboard e
la sessione la calcolassero ciascuna per conto proprio, il numero mostrato e il
numero caricato potrebbero divergere. Serve la terza legge di dominio di Epic 3
(`AD-5`): un unico predicato di dovutezza e un'unica identità della pila su cui
tutti i consumatori futuri (dashboard, precarico di sessione, cancello di sblocco)
convergeranno.

**Approach:** Un modulo di dominio puro `src/domain/due.ts` che espone (a) `isDue(state,
now): boolean`, l'**unico** predicato che decide se un esercizio è dovuto, e (b)
`dueQueryKey(userId)`, l'**unica** definizione dell'identità della pila `['due',
userId]`. In più la **porta** `ReviewRepository.listDue` in `src/domain/ports/`, il
cui contratto è ancorato a `isDue`. L'implementazione dell'adattatore e il cablaggio
delle schermate arrivano dopo (3.10, 3.12+); qui si fissa la definizione perché i
consumatori non possano nascere divergenti.

## Boundaries & Constraints

**Always:**
- Vive sotto `src/domain/` → purezza AD-1: nessun import esterno, nessun global di
  piattaforma, nessun `fetch`, `Date.now()`, `new Date()` senza argomenti,
  `Intl…resolvedOptions()` né `Math.random()`. `isDue` riceve `now: Date` come
  parametro esplicito (`isDue.length === 2`).
- `isDue` è pura, sincrona, totale e non muta lo stato: stessa coppia `(state, now)`
  ⇒ stesso booleano. Dovutezza = `state.dueAt <= now` (confine **inclusivo**: un
  intervallo `0` — `again` o istante di sblocco — è dovuto subito).
- Riusa il tipo canonico `ReviewState` da `./schedule` senza ridefinirlo. La porta
  `ReviewRepository` importa **solo** `type ReviewState`.
- `dueQueryKey(userId)` è l'unica definizione della chiave `['due', userId]`: tupla
  `readonly`, pura, framework-agnostica (nessun consumatore la ridefinisce).

**Block If:**
- Nessuna condizione bloccante attesa: gli AC risolvono ogni scelta osservabile.

**Never:**
- Nessuna persistenza, rete, RPC, SQL o client Supabase: l'adattatore concreto di
  `ReviewRepository` è la storia 3.10 (`src/data/`), non questa.
- Nessuna schermata, hook React, TanStack Query runtime o `QueryClient`: qui si
  dichiara solo l'identità della chiave, non la si consuma (schermate 3.12+).
- Nessun altro punto di `src/` decide la dovutezza o ridefinisce la chiave della
  pila: la pila si calcola in un solo punto.

## I/O & Edge-Case Matrix

`isDue(state, now)` — dovutezza inclusiva rispetto a `now`:

| Scenario | Input / State | Expected Output | Error Handling |
|----------|--------------|-----------------|----------------|
| scaduto nel passato | `dueAt = now − 1ms` | `true` | nessun errore |
| dovuto esatto (intervallo 0) | `dueAt = now` | `true` (confine inclusivo) | nessun errore |
| non ancora dovuto | `dueAt = now + 1ms` | `false` | nessun errore |
| sblocco fresco (stage 0) | `dueAt = istante di sblocco ≤ now` | `true` | nessun errore |
| non-mutazione | qualunque `state` | lo `state` passato è invariato | nessun errore |

`dueQueryKey(userId)` — identità della pila:

| Scenario | Input | Expected Output | Error Handling |
|----------|-------|-----------------|----------------|
| chiave utente | `'u1'` | `['due', 'u1']` (tupla readonly) | nessun errore |
| determinismo | `'u1'` due volte | tuple uguali per valore | nessun errore |
| isolamento per-utente | `'u1'` vs `'u2'` | secondo elemento diverso | nessun errore |

</intent-contract>

## Code Map

- `src/domain/due.ts` -- **DA CREARE**. Espone `isDue(state, now): boolean`, `dueQueryKey(userId): DueQueryKey` e `export type DueQueryKey = readonly ['due', string]`. Importa `type ReviewState` da `./schedule`.
- `src/domain/schedule.ts:27-34` -- `interface ReviewState` (`readonly dueAt: Date` è il campo su cui `isDue` decide). Riusare, non ridefinire.
- `src/domain/schedule.ts:129-142` -- `schedule()` **produce** `dueAt` (`again`/stadio 0 ⇒ `dueAt === now`, intervallo `0`): è la ragione del confine inclusivo `<=` in `isDue`. `schedule` non è un punto che «decide la dovutezza» (assegna il campo, non lo confronta), quindi non è un offender per la sonda di sola autorità.
- `src/domain/ports/reviewRepository.ts` -- **DA CREARE**. Porta `ReviewRepository` con `listDue(now: Date): Promise<readonly ReviewState[]>`. Modellata sulla convenzione di `ports/settingsRepository.ts` (JSDoc di contratto; nessun import esterno; opera sull'«utente corrente»).
- `src/domain/ports/settingsRepository.ts:1-34` -- Convenzione delle porte del dominio da rispecchiare: intestazione che spiega chi implementa (`src/data/`) e chi inietta (`src/app/`), metodi che operano sull'utente corrente senza parametro `userId`.
- `src/domain/schedule-purity.test.ts:1-62` -- Pattern della sonda di purezza temporale (`stripComments` + regex sui costrutti vietati + guardia anti-vacuità + `fn.length`) da replicare per `due.ts`.
- `src/domain/outcome-sole-authority.test.ts:1-97` -- Pattern della sonda di **sola autorità** su tutto `src/` (walk dei `.ts(x)`, esclusione dei `*.test.ts` e del modulo autorevole, doppia anti-vacuità: ≥5 sorgenti **e** il rilevatore corrisponde al modulo autorevole) da replicare per la dovutezza e per la chiave.
- `eslint.config.js:82,109,174-183` -- `boundaries`: `domain → domain` ammesso; `domain` non importa pacchetti esterni; `no-restricted-globals` sul dominio copre `fetch`/storage. `data → domain` e `features → domain` sono gli unici archi comuni: perciò la chiave condivisa **deve** vivere nel dominio.
- `src/boundaries.test.ts:113-140` -- Lintà tutto `src/**` a 0 errori: i nuovi file di dominio devono passare (solo import di dominio, nessun global vietato).
- `tsconfig.json:19-22` -- `strict` con `noUnusedParameters`; `readonly ['due', string]` va tipata come tupla.

## Tasks & Acceptance

**Execution:**
- `src/domain/due.ts` -- Creare il modulo: `isDue(state: ReviewState, now: Date): boolean` = `state.dueAt.getTime() <= now.getTime()`; `type DueQueryKey = readonly ['due', string]`; `dueQueryKey(userId: string): DueQueryKey` = `['due', userId] as const`. Nessuna ridefinizione di tipi, nessun costrutto temporale/di rete/non deterministico.
- `src/domain/ports/reviewRepository.ts` -- Creare la porta: `export interface ReviewRepository { listDue(now: Date): Promise<readonly ReviewState[]>; }`. JSDoc di contratto: `listDue` restituisce **esattamente** gli stati per cui `isDue(state, now)` è vero; è l'unica interrogazione dietro la chiave `dueQueryKey(userId)`; nessun consumatore ricalcola la pila. Importa `type ReviewState` da `../schedule`.
- `src/domain/due.test.ts` -- Coprire l'intera I/O Matrix di `isDue` (passato, `= now`, futuro, sblocco stage 0, non-mutazione) e di `dueQueryKey` (forma `['due', userId]`, determinismo per valore, isolamento per-utente). Anti-vacuità: `isDue` verde su entrambi i lati del confine `now`.
- `src/domain/due-purity.test.ts` -- Sonda meccanica sul sorgente di `due.ts` (modellata su `schedule-purity.test.ts`): assenza di `fetch`, `Date.now(`, `new Date()` senza argomenti, `Intl…resolvedOptions(`, `Math.random`; guardia anti-vacuità (file trovato, non vuoto, contiene `export function isDue`); `isDue.length === 2`.
- `src/domain/due-sole-authority.test.ts` -- Sonda meccanica su **tutto** `src/` (esclusi `*.test.ts` e `due.ts`) per i due AC di sola autorità: (1) nessun altro file confronta `dueAt` con un istante per decidere la dovutezza (rilevatore su `dueAt` adiacente a un operatore relazionale, in entrambi gli ordini); (2) il letterale di chiave `['due'`/`["due"` compare solo in `due.ts`. Doppia anti-vacuità per ciascuno (≥5 sorgenti **e** il rilevatore corrisponde a `due.ts`). Documentare la PORTATA NOTA come in `outcome-sole-authority.test.ts`.

**Acceptance Criteria:**
- Given `isDue(state, now)` in `src/domain/`, when la si invoca, then è pura, sincrona, non muta lo stato, riceve `now` come parametro esplicito (`isDue.length === 2`) e restituisce `true` se e solo se `state.dueAt <= now`.
- Given uno stato con `dueAt` nel passato o esattamente uguale a `now`, when valutato, then `isDue` è `true` (un intervallo `0` è dovuto subito); con `dueAt` nel futuro è `false`.
- Given la porta `ReviewRepository` in `src/domain/ports/`, when la si ispeziona, then dichiara `listDue(now)` il cui contratto restituisce esattamente gli stati per cui `isDue(state, now)` è vero, senza alcuna logica di persistenza/scheduling nel dominio.
- Given l'identità della pila, when un consumatore la interroga, then esiste **una sola** definizione della chiave `['due', userId]` — `dueQueryKey(userId)` — e nessun altro punto di `src/` la ridefinisce.
- Given il modulo, when se ne ispeziona il sorgente, then non contiene `fetch`, `Date.now()`, `new Date()` senza argomenti, `Intl…resolvedOptions()` né `Math.random()`.
- Given l'intero `src/`, when lo si ispeziona meccanicamente, then l'**unico** punto che decide la dovutezza (confronta `dueAt` con un istante) è `src/domain/due.ts`: nessun'altra schermata o modulo ricalcola la pila.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - none

_Note di triage:_ quattro layer in parallelo. **Intent-alignment**: conferma che il
diff implementa la lettura corretta per una storia della fase dominio (creare l'unica
definizione: `isDue` + `dueQueryKey` + porta) e che la convergenza runtime delle tre
schermate è **volutamente** rinviata a 3.10/3.12+ per l'ordinamento dell'epica (parte
dell'intento), documentata nel Never dello spec, nel JSDoc della porta e nella PORTATA
NOTA della sonda — nessun `intent_gap`, nessun `bad_spec`. **Verification-gap**: nessun
gap (l'unica superficie comportamentale, `isDue`/`dueQueryKey`, è pinnata da asserzioni
eseguite). **Edge-case-hunter**: 2 finding, entrambi sul caso `Invalid Date → NaN` (input
non validato ⇒ mai dovuto): rifiutati perché la validazione degli input è per contratto
AD-1 responsabilità del data layer (stesso rifiuto esplicito di 3.1 sulle guardie su
`now`/`stage`); aggiungere un `throw` violerebbe la totalità/purezza del predicato.
**Blind-hunter**: ~13 finding, tutti rifiutati — due («file di test placeholder», «test
di non-mutazione vuoto») sono artefatti del diff ABBREVIATO passato ai reviewer, non dei
file su disco (che hanno le sonde complete e le 6 asserzioni di non-mutazione); le
etichette «AC4/AC6» della sonda sono in realtà corrette (AC4=chiave, AC6=dovutezza); il
test di integrazione `schedule→isDue`, lo stub di conformità della porta e i test di
export-surface replicano rifiuti già stabiliti in 3.1/3.2 (interfaccia imposta da `tsc`,
adattatore = 3.10, convenzione delle porte senza `index.ts`); il caso «Date uguali ma
oggetti distinti» è già coperto dal test `=now` (`new Date(now.getTime())` vs `now`); il
limite del rilevatore `DECIDES_DUENESS` (forme indirette) è già la PORTATA NOTA
documentata, guardia prospettica come in 3.2; `userId` è un valore fidato di auth (nessuna
validazione di stringa vuota nel dominio). Nessun finding sopravvive al triage.

## Design Notes

`isDue` è deliberatamente minima — `state.dueAt.getTime() <= now.getTime()` — ma il
**punto della storia non è la complessità, è l'unicità**: una sola funzione decide la
dovutezza, così dashboard, precarico e cancello non possono divergere. Il confine è
**inclusivo** (`<=`) per coerenza con `schedule.ts`, dove `again` e lo stadio 0
producono `dueAt === now` (intervallo `0`, «di nuovo in questa sessione»): un tale
esercizio deve risultare dovuto immediatamente.

```ts
export function isDue(state: ReviewState, now: Date): boolean {
  return state.dueAt.getTime() <= now.getTime();
}
export type DueQueryKey = readonly ['due', string];
export function dueQueryKey(userId: string): DueQueryKey {
  return ['due', userId] as const;
}
```

**Perché la chiave vive nel dominio (scelta risolta, non un gap):** i consumatori
futuri sono l'adattatore in `src/data/` (3.10) e le schermate in `src/features/`
(3.12+). Per i confini di AD-1 l'**unico** livello che entrambi possono importare è
`domain` (`data → domain`, `features → domain`; `features` non può importare `data`).
Perché esista *una sola* definizione della chiave, deve stare qui. È una tupla pura di
stringhe: non viola la purezza (nessun import esterno, nessun global). Il dominio
dichiara l'**identità** della pila; TanStack, nei livelli esterni, la userà come
chiave di cache senza che il dominio conosca TanStack.

**Perché la porta ora e l'adattatore no:** l'epica assegna le porte al dominio e gli
adattatori a `src/data/` (3.10). AC2 nomina esplicitamente «la porta
`ReviewRepository.listDue`»: dichiararla qui, con il contratto ancorato a `isDue`,
fissa il canale unico di lettura prima che i consumatori nascano.

**Sonda di sola autorità (portata nota):** come in `outcome-sole-authority.test.ts`, i
rilevatori intercettano la forma **diretta** (confronto di `dueAt` adiacente a un
operatore relazionale; letterale `['due'`). Un produttore indiretto — estrarre
`const t = state.dueAt.getTime()` e confrontare `t` altrove — sfuggirebbe e resta
responsabilità della review. Il valore della sonda è **prospettico**: diventa una
guardia reale quando le schermate 3.12+ leggeranno la pila.

## Verification

**Commands:**
- `npm run test -- src/domain/due` -- expected: `due.test.ts`, `due-purity.test.ts` e `due-sole-authority.test.ts` tutti verdi.
- `npm run test` -- expected: suite completa verde, 0 regressioni (conferma che la sonda di sola autorità non produce falsi positivi sull'albero esistente).
- `npm run typecheck` -- expected: nessun errore (attenzione a `noUnusedParameters` e alla tupla `readonly ['due', string]`).
- `npm run lint` -- expected: nessuna violazione (`boundaries` domain→domain, `no-restricted-globals` sul dominio, `boundaries.test.ts` a 0 errori).

## Auto Run Result

Status: done
Follow-up review recommended: false (patch: high 0, medium 0, low 0 → score 3×0 + 1×0 = 0 < 5)

**Change implementato:** creata la terza legge di dominio di Epic 3 (`AD-5`) — **una
sola definizione di «dovuto»**. `isDue(state, now)` in `src/domain/due.ts` è l'UNICO
predicato di dovutezza (puro, sincrono, totale, non-mutante; confine inclusivo `<=`
coerente con l'intervallo `0` di `schedule()`); `dueQueryKey(userId)` è l'UNICA
definizione dell'identità della pila `['due', userId]` (tupla `readonly`,
framework-agnostica, nel dominio perché è l'unico livello importabile sia da `data`
sia da `features`). La porta `ReviewRepository.listDue` è dichiarata dal dominio con
il contratto ancorato a `isDue`. Adattatore dati (3.10) e cablaggio delle schermate
(3.12+) restano fuori ambito per l'ordinamento dell'epica: qui si fissa la definizione
perché i consumatori futuri non possano nascere divergenti.

**File cambiati:**
- `src/domain/due.ts` -- nuovo: `isDue(state, now): boolean`, `type DueQueryKey = readonly ['due', string]`, `dueQueryKey(userId): DueQueryKey`. Importa solo `type ReviewState` da `./schedule` (nessuna ridefinizione di tipi, nessun import esterno/global/costrutto temporale).
- `src/domain/ports/reviewRepository.ts` -- nuovo: porta `ReviewRepository` con `listDue(now): Promise<readonly ReviewState[]>`, JSDoc di contratto («restituisce esattamente gli stati per cui `isDue` è vero; unica interrogazione dietro `dueQueryKey`»). Modellata su `ports/settingsRepository.ts`.
- `src/domain/due.test.ts` -- nuovo: 10 test, intera I/O Matrix di `isDue` (passato, `=now`, futuro, sblocco stadio 0, non-mutazione con snapshot dei 6 campi, determinismo, anti-vacuità su entrambi i lati) e di `dueQueryKey` (forma, determinismo per valore, isolamento per-utente).
- `src/domain/due-purity.test.ts` -- nuovo: 7 test, sonda meccanica sul sorgente (assenza di `fetch`/`Date.now`/`new Date()`/`resolvedOptions`/`Math.random`), anti-vacuità (file + firma), `isDue.length === 2`.
- `src/domain/due-sole-authority.test.ts` -- nuovo: 5 test, scansione di tutto `src/` (esclusi `*.test.ts` e `due.ts`): nessun altro file decide la dovutezza (confronto `dueAt` vs istante) né ridefinisce la chiave `['due'`; doppia anti-vacuità per ciascun rilevatore; PORTATA NOTA documentata.

**Review findings:** 0 patch, 0 deferred, 14 rejected, 0 intent_gap, 0 bad_spec. Quattro layer in parallelo (blind-hunter, edge-case-hunter, verification-gap, intent-alignment); dettaglio nel Review Triage Log.

**Verifica eseguita:**
- `npm run test -- src/domain/due` → 22/22 verdi (3 file).
- `npm run test` (suite completa) → 462/462 verdi, 0 regressioni (conferma che la sonda di sola autorità non produce falsi positivi sull'albero esistente).
- `npm run typecheck` → nessun errore.
- `npm run lint` → nessuna violazione.
- Matrix Test Audit: tutte le righe delle due tabelle I/O (5 di `isDue` + 3 di `dueQueryKey`) coperte da test eseguiti e verdi.

**Rischi residui:** nessuno per l'ambito di questa storia. La validazione degli input
(`dueAt`/`now` come `Date` valide, `userId` non vuoto) resta per contratto AD-1
responsabilità del data layer (3.7–3.10), coerentemente con `schedule()` (3.1). Il
valore della sonda di sola autorità è **prospettico**: diventa una guardia reale quando
le schermate 3.12+ leggeranno la pila via `listDue`/`dueQueryKey` senza ricalcolarla.
