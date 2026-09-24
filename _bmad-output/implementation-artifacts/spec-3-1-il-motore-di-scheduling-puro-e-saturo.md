---
title: 'Story 3.1 — Il motore di scheduling, puro e saturo'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: '894afcd5f06f2cbafa3681de8dba5c7df3aab5ac'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Il ciclo di ripasso di Epic 3 ha bisogno di una legge di scheduling (scala Leitner) che sia leggibile e verificabile in un solo file, senza dipendenze da orologio, rete o DB. È il primo mattone del motore di dominio: da questa costante deriveranno il `CHECK` SQL su `review_state.stage` e l'asse delle statistiche.

**Approach:** Un modulo di dominio puro `src/domain/schedule.ts` che espone **una sola** costante di scala e una funzione pura `schedule(state, outcome, now)` che restituisce il prossimo stato di ripasso. Gli stadi saturano ai due estremi tramite clamp aritmetico (nessuna ramificazione per lo stadio 0 o 5). Le scadenze ricevono una dispersione deterministica derivata da `exerciseId` e stadio.

## Boundaries & Constraints

**Always:**
- Vive sotto `src/domain/` → purezza AD-1: nessun import esterno, nessun global di piattaforma, nessun `Date.now()`, `new Date()` senza argomenti, `Intl.DateTimeFormat().resolvedOptions()` né `Math.random()`. Ogni istante temporale entra come parametro `now: Date`.
- La scala Leitner è **una sola** costante esportata: stadi `0`–`5` (gli indici), intervalli `[0, 1, 3, 7, 16, 35]` giorni (i valori). Lo stadio massimo si deriva da `length - 1`, non da una seconda costante.
- `schedule` è puro e totale: stessa terna `(state, outcome, now)` ⇒ stesso stato risultante, sempre; nessuna mutazione dell'input (ritorna un nuovo oggetto).
- Il clamp dello stadio è aritmetico e uniforme (`Math.min`/`Math.max`), non un `if (stage === 0/5)`.
- Determinismo delle scadenze: ripetere il calcolo produce esattamente le stesse `Date`.

**Block If:**
- Nessuna condizione bloccante attesa: gli AC risolvono ogni scelta osservabile.

**Never:**
- Nessuna persistenza, rete, RPC o SQL in questo modulo (arrivano in 3.7–3.10).
- Nessun `outcomeOf`, `isDue`, coda di sessione o streak (sono storie 3.2–3.5 separate).
- Nessuna dipendenza da `src/data`, `src/ui` o `@supabase/*`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| good sotto il tetto | `{stage:2,...}`, `good`, `now` | `stage:3`; `dueAt = now + 7g + jitter` | nessun errore |
| easy sotto il tetto | `{stage:1,...}`, `easy`, `now` | `stage:3`; `dueAt = now + 7g + jitter` | nessun errore |
| easy che satura | `{stage:5,...}`, `easy`, `now` | resta `stage:5`, **non** 7; intervallo `35g` | nessun errore |
| easy oltre il tetto | `{stage:4,...}`, `easy`, `now` | clamp a `stage:5`; intervallo `35g` | nessun errore |
| again da qualunque stadio | `{stage:4, lapseCount:2,...}`, `again`, `now` | `stage:0`; `lapseCount:3`; `dueAt === now` (intervallo `0`) | nessun errore |
| hard a stadio medio | `{stage:3,...}`, `hard`, `now` | resta `stage:3`; intervallo `7g × 0.6 = 4.2g` (+ jitter) | nessun errore |
| again/hard a stadio 0 | `{stage:0,...}`, `again`\|`hard`, `now` | resta `stage:0`, `dueAt === now`, senza rami speciali | nessun errore |
| dispersione deterministica | due stati con `exerciseId` diversi, stessi `stage`/`now`/`outcome` (intervallo > 0) | `dueAt` diversi tra loro; ricalcolo ⇒ `dueAt` identici | nessun errore |

</intent-contract>

## Code Map

- `src/domain/schedule.ts` -- **DA CREARE**. Il modulo: tipi `ReviewOutcome`/`ReviewState`, costante `LEITNER_INTERVALS_DAYS`, `schedule()`, hash interno puro per la dispersione.
- `src/domain/uuid.ts` -- Precedente di hashing puro scritto a mano nel dominio (SHA-1 senza global): un FNV-1a a 32 bit locale è la convenzione, non un pacchetto npm.
- `src/domain/exercise-purity.test.ts:42-83` -- Pattern della sonda meccanica (`stripComments` + scansione sorgente + guardia anti-vacuità) da replicare estendendolo ai costrutti temporali.
- `src/domain/exercise.ts:15-25,62` -- Convenzioni: campi camelCase, `export type`. `ReviewState` è un value object runtime → interfaccia TS semplice, **non** serve il kit di `./schema`.
- `eslint.config.js:171-184` -- `no-restricted-globals` sul dominio copre solo `fetch`/storage, NON i costrutti temporali → per l'AC5 serve la sonda vitest.
- `tsconfig.json:19-22` -- `strict` senza `noUncheckedIndexedAccess` (`LEITNER_INTERVALS_DAYS[stage]` è `number`); `noUnusedParameters` e `noFallthroughCasesInSwitch` attivi.

## Tasks & Acceptance

**Execution:**
- `src/domain/schedule.ts` -- Creare il modulo con: (a) `export type ReviewOutcome = 'again' | 'hard' | 'good' | 'easy'`; (b) `export interface ReviewState` con `readonly exerciseId: string; stage: number; dueAt: Date; reviewCount: number; lapseCount: number; lastReviewedAt: Date | null`; (c) `export const LEITNER_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35] as const` (unica costante di scala); (d) `export function schedule(state, outcome, now): ReviewState`. La logica di transizione, clamp, intervallo, jitter e aggiornamento campi è quella delle Design Notes; in più `lapseCount += (outcome === 'again' ? 1 : 0)`, `reviewCount += 1`, `lastReviewedAt = now`, ritornando un **nuovo** oggetto (input non mutato). Hash puro FNV-1a interno per la frazione in `[0,1)`.
- `src/domain/schedule.test.ts` -- Coprire ogni riga della I/O Matrix: transizioni di stadio per i quattro esiti; saturazione a 5 con `easy`; reset a 0 e `lapseCount++` con `again`; stadio 0 che resta 0 con intervallo 0 (`dueAt === now`); `hard` che tiene lo stadio e riduce a ~60%; determinismo (ricalcolo identico) e dispersione (due `exerciseId` diversi ⇒ `dueAt` diversi). Assertire l'intervallo come finestra `[base, base × (1 + DISPERSION_FRACTION))` per assorbire il jitter; per intervallo `0` assertire l'uguaglianza esatta `dueAt.getTime() === now.getTime()`. Verificare che `state` passato non venga mutato.
- `src/domain/schedule-purity.test.ts` -- Sonda meccanica modellata su `exercise-purity.test.ts`: legge il sorgente di `src/domain/schedule.ts` (commenti rimossi con `stripComments`) e assicura che NON contenga `Date.now(`, `new Date()` (parentesi vuote), `Intl.DateTimeFormat().resolvedOptions(` né `Math.random`. Guardia anti-vacuità: il file deve essere stato trovato. Assertire inoltre `schedule.length === 3` (`now` è parametro esplicito).

**Acceptance Criteria:**
- Given `src/domain/schedule.ts`, when lo si ispeziona, then esiste **una sola** costante esportata per la scala Leitner con stadi `0`–`5` e intervalli `0, 1, 3, 7, 16, 35` giorni.
- Given `schedule(state, outcome, now)`, when riceve `good`/`easy`/`again`/`hard`, then lo stadio avanza di `1`/`2`, torna a `0` con `lapseCount+1`, oppure resta con intervallo ridotto a ~60% rispettivamente.
- Given uno stadio `5` con `easy` e uno stadio `0` con `again`/`hard`, when calcolato, then saturano a `5` e a `0` senza ramificazioni speciali nel codice.
- Given il modulo, when ispezionato, then non contiene `Date.now()`, `new Date()` senza argomenti, `Intl.DateTimeFormat().resolvedOptions()` né `Math.random()`, e `now` è sempre un parametro esplicito.
- Given due esercizi valutati nello stesso istante allo stesso stadio, when le scadenze vengono calcolate, then ricevono una dispersione deterministica derivata da `exerciseId` e stadio, e ripetere il calcolo produce esattamente le stesse date.

## Design Notes

Chiave: **niente rami per gli estremi**. Si sceglie lo stadio prossimo per esito, poi clamp; l'intervallo è un unico prodotto `scala[nextStage] × fattoreEsito`. Stadio 0 (intervallo 0) e stadio 5 saturato cadono fuori da soli.

```ts
const MAX_STAGE = LEITNER_INTERVALS_DAYS.length - 1; // 5, derivato
const OUTCOME_FACTOR: Record<ReviewOutcome, number> = { again: 1, hard: 0.6, good: 1, easy: 1 };

function nextStageFor(stage: number, outcome: ReviewOutcome): number {
  switch (outcome) {
    case 'again': return 0;
    case 'hard':  return stage;
    case 'good':  return stage + 1;
    case 'easy':  return stage + 2;
  }
}
// nel corpo: const s = Math.max(0, Math.min(MAX_STAGE, nextStageFor(state.stage, outcome)));
// const intervalMs = LEITNER_INTERVALS_DAYS[s] * OUTCOME_FACTOR[outcome] * MS_PER_DAY;
// const jitter = fraction(state.exerciseId, s) * intervalMs * DISPERSION_FRACTION;
```

Scelta risolta (non è un gap): la dispersione si deriva da `exerciseId` **e dallo stadio risultante** `s`. Nel caso della Matrix (stesso stadio corrente, stesso esito) `s` coincide per i due esercizi, quindi a distinguerli resta solo `exerciseId` — esattamente ciò che l'AC richiede. La finestra è **proporzionale** all'intervallo (`DISPERSION_FRACTION`, es. `0.25`), così un intervallo `0` produce jitter `0` senza casi speciali e la dispersione non riordina mai le scadenze rispetto allo stadio. `fraction()` è un FNV-1a a 32 bit su `` `${exerciseId}:${s}` `` diviso per `2**32` → `[0,1)`, puro e sincrono come `uuidv5`.

## Verification

**Commands:**
- `npm run test -- src/domain/schedule` -- expected: tutti i test di `schedule.test.ts` e `schedule-purity.test.ts` verdi.
- `npm run typecheck` -- expected: nessun errore (attenzione a `noUnusedParameters` e all'esaustività dello switch).
- `npm run lint` -- expected: nessuna violazione (boundaries/external e no-restricted-globals sul dominio).

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 0
- reject: 20: (high 0, medium 3, low 17)
- addressed_findings:
  - `[medium]` `[patch]` L'`exerciseId` restituito da `schedule` non era assertito da alcun test (una regressione a identità errata sarebbe passata): aggiunta `expect(result.exerciseId).toBe(input.exerciseId)` al test di non-mutazione.
  - `[low]` `[patch]` `ReviewState` era solo parzialmente `readonly` (solo `exerciseId`): resi `readonly` tutti i campi, coerente con la convenzione dei value object del dominio (stile `CheckOutcome`).

_Note di triage:_ i rifiuti principali — fattore `hard` "non pinnato" (falso: il bound superiore `< base×1.25` cattura la caduta di `0.6`), guardie su input invalidi (`now`/`stage`/cast di `outcome`, fuori contratto per un motore puro: validazione a monte nel data layer), costrutti oltre l'insieme enumerato dall'AC (`performance.now`, `Date.parse`), e nit su `stripComments`/regex che rispecchiano la convenzione accettata di `exercise-purity.test.ts`. Nessun `intent_gap`/`bad_spec`: l'audit di intent-alignment conferma una lettura coerente e difendibile di tutti e sei gli AC; le ambiguità AC5 (dispersione da stadio risultante, jitter monodirezionale) erano già risolte e documentate nelle Design Notes.

## Auto Run Result

Status: done
Follow-up review recommended: false (patch: medium 1, low 1, high 0 → score 3×1 + 1 = 4 < 5)

**Change implementato:** creato il motore di scheduling di dominio (scala Leitner) come funzione pura e satura in `src/domain/schedule.ts`, prima legge del ciclo di ripasso di Epic 3. Nessuna dipendenza da orologio, rete o DB; `now` iniettato; saturazione agli estremi via clamp aritmetico senza rami speciali; scadenze con dispersione deterministica derivata da `exerciseId` e stadio risultante.

**File cambiati:**
- `src/domain/schedule.ts` -- nuovo: tipi `ReviewOutcome`/`ReviewState` (tutti i campi `readonly`), costante unica `LEITNER_INTERVALS_DAYS = [0,1,3,7,16,35]`, `schedule(state, outcome, now)` puro/totale, hash interno FNV-1a per la dispersione.
- `src/domain/schedule.test.ts` -- nuovo: 14 test che coprono ogni riga della I/O Matrix (transizioni, saturazione, reset+lapse, stadio 0 stabile, `hard` a ~60%, contatori, non-mutazione + identità, determinismo e dispersione).
- `src/domain/schedule-purity.test.ts` -- nuovo: 6 test, sonda meccanica sul sorgente per l'assenza di `Date.now()`/`new Date()`/`resolvedOptions()`/`Math.random()` e `schedule.length === 3`.

**Review findings:** 2 patch applicati (1 medium, 1 low), 0 deferred, 20 rejected. Nessun intent_gap né bad_spec.

**Verifica eseguita:**
- `npx vitest run` (suite completa) → 417/417 verdi, 0 regressioni.
- `npm run typecheck` → nessun errore.
- `npm run lint` → nessuna violazione.
- Matrix Test Audit: tutte e 8 le righe della I/O Matrix coperte da test eseguiti e verdi.

**Rischi residui:** nessuno per l'ambito di questa storia. La validazione degli input (`now` valido, `stage` in `[0,5]`, `outcome` nell'union) è per contratto responsabilità del data layer (storie 3.7–3.10), coerentemente con i Boundaries dello spec; il `CHECK` SQL su `review_state.stage` deriverà da `LEITNER_INTERVALS_DAYS`.
