---
title: 'Story 3.2 — L''esito si calcola, non si dichiara'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: '96e6f3fb89af8a5f5544f8bd849ac271782ea133'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Il ciclo di ripasso deve giudicare la risposta dell'utente invece di
chiedergli quanto gli sia sembrata facile: se l'esito lo dichiarasse l'utente, lo
streak potrebbe mentire. Serve la seconda legge di dominio di Epic 3 (`AD-24`),
puro complemento di `schedule()` (3.1) e consumatore della correttezza di
`check()` (Epic 2).

**Approach:** Un modulo di dominio puro `src/domain/outcome.ts` che espone **una
sola** funzione `outcomeOf(check, usedExplanation, declaredEasy): ReviewOutcome`.
Traduce fatti già raccolti — la correttezza (`CheckOutcome` di `check()`), se la
spiegazione è stata consultata prima di rispondere, se l'utente ha dichiarato
"facile" — nell'esito SRS. È l'**unico** punto del codice che decide un esito.

## Boundaries & Constraints

**Always:**
- Vive sotto `src/domain/` → purezza AD-1: nessun import esterno (solo `./exercise`
  e `./schedule`, entrambi domain), nessun global di piattaforma, nessun `fetch`,
  `Date.now()`, `new Date()` senza argomenti, `Intl…resolvedOptions()` né
  `Math.random()`. Non riceve né usa `now`: l'esito non dipende dal tempo.
- Riusa i tipi canonici senza ridefinirli: `CheckOutcome` da `./exercise`,
  `ReviewOutcome` da `./schedule`. Una sola definizione di ciascun tipo.
- `outcomeOf` è pura e totale: stessa terna di input ⇒ stesso esito, sempre;
  nessuna mutazione; sincrona; nessuna rete → l'esito calcolato offline è
  identico a quello che si otterrebbe online (`AD-24`).
- Precedenza fissa: la scorrettezza domina tutto (`again`); poi l'aver consultato
  la spiegazione (`hard`); `easy` solo se corretta **senza aiuto** e dichiarata;
  altrimenti `good`.

**Block If:**
- Nessuna condizione bloccante attesa: gli AC risolvono ogni scelta osservabile.

**Never:**
- Nessun ricalcolo della correttezza: `outcomeOf` **consuma** il `CheckOutcome`
  di `check()`, non riesegue la validazione (non riceve `Exercise` né la risposta
  grezza).
- Nessuna persistenza, rete, RPC, scheduling, coda di sessione o streak (sono
  3.7–3.10, 3.1, 3.4, 3.5).
- Nessun altro punto di `src/` può decidere un esito: la UI raccoglie i fatti, il
  dominio li traduce.

## I/O & Edge-Case Matrix

`outcomeOf({correct}, usedExplanation, declaredEasy)` sull'intero cubo booleano:

| Scenario | Input | Esito | Note |
|----------|-------|-------|------|
| sbagliata, nessun aiuto, non dichiarata | `{false}, false, false` | `again` | la scorrettezza domina |
| sbagliata + dichiarata "facile" | `{false}, false, true` | `again` | dichiarare "facile" non salva una risposta errata |
| sbagliata + spiegazione consultata | `{false}, true, false` | `again` | la correttezza precede l'aiuto |
| sbagliata + aiuto + dichiarata | `{false}, true, true` | `again` | tutto subordinato alla scorrettezza |
| corretta senza aiuto | `{true}, false, false` | `good` | caso base |
| corretta senza aiuto, dichiarata "facile" | `{true}, false, true` | `easy` | unico caso `easy` |
| corretta dopo la spiegazione | `{true}, true, false` | `hard` | l'aiuto declassa a `hard` |
| corretta, aiuto **e** dichiarata "facile" | `{true}, true, true` | `hard` | `easy` richiede "senza aiuto": l'aiuto vince |

</intent-contract>

## Code Map

- `src/domain/outcome.ts` -- **DA CREARE**. Espone `outcomeOf(check, usedExplanation, declaredEasy)`. Importa `type CheckOutcome` da `./exercise` e `type ReviewOutcome` da `./schedule`.
- `src/domain/exercise.ts:188-253` -- `CheckOutcome { readonly correct: boolean }` (l'input di correttezza) e `check()`. I commenti alle righe 188-197 già dichiarano che `outcomeOf` di 3.2 consuma questa correttezza PIÙ `usedExplanation`/`declaredEasy`: allineare l'implementazione a quel contratto (parametro = correttezza, non risposta grezza).
- `src/domain/schedule.ts:18` -- `export type ReviewOutcome = 'again' | 'hard' | 'good' | 'easy'`: definizione canonica dell'union, da importare (non ridefinire). `schedule()` la **consuma** (switch, `OUTCOME_FACTOR`) ma non la **produce** → non è un "punto che decide un esito".
- `src/domain/schedule-purity.test.ts:1-62` -- Pattern della sonda meccanica sul sorgente (`stripComments` + regex sui costrutti vietati + guardia anti-vacuità + `fn.length`) da replicare per `outcome.ts`.
- `eslint.config.js:82,109,174-183` -- `boundaries`: `domain → domain` ammesso; `domain` non può importare pacchetti esterni; `no-restricted-globals` sul dominio copre `fetch`/storage. I `*.test.ts` sono ignorati da `boundaries`, quindi `node:fs` nelle sonde è lecito.
- `tsconfig.json:19-22` -- `strict` con `noUnusedParameters`; l'esaustività dello `switch`/rami è verificata dal compilatore.

## Tasks & Acceptance

**Execution:**
- `src/domain/outcome.ts` -- Creare il modulo: `export function outcomeOf(check: CheckOutcome, usedExplanation: boolean, declaredEasy: boolean): ReviewOutcome`. Logica a precedenza esplicita (vedi Design Notes), che **ritorna letterali** dell'union. Nessuna ridefinizione di tipi, nessun `now`, nessun costrutto non deterministico o di rete.
- `src/domain/outcome.test.ts` -- Coprire tutte e 8 le righe della I/O Matrix (cubo booleano `correct × usedExplanation × declaredEasy`). Verificare che l'input `CheckOutcome` non venga mutato e che l'esito appartenga sempre all'union.
- `src/domain/outcome-purity.test.ts` -- Sonda meccanica sul sorgente di `outcome.ts` (modellata su `schedule-purity.test.ts`): assenza di `fetch`, `Date.now(`, `new Date()`, `Intl…resolvedOptions(`, `Math.random`; guardia anti-vacuità (file trovato, non vuoto, contiene `export function outcomeOf`); `outcomeOf.length === 3`.
- `src/domain/outcome-sole-authority.test.ts` -- Sonda meccanica su **tutto** `src/` (esclusi `*.test.ts` e `outcome.ts`) per l'AC "nessun altro punto decide un esito": nessun file, a commenti rimossi, contiene un `return` di un letterale d'esito (`return 'again'|'hard'|'good'|'easy'`). Anti-vacuità: aver scansionato ≥5 file **e** dimostrare che `outcome.ts` corrisponde al rilevatore (così la regex non è un no-op).

**Acceptance Criteria:**
- Given `outcomeOf(check, usedExplanation, declaredEasy)` in `src/domain/`, when la si invoca, then è pura, sincrona, non muta gli input e restituisce esattamente uno fra `again`/`hard`/`good`/`easy` (`outcomeOf.length === 3`).
- Given una risposta sbagliata (`check.correct === false`), when l'esito viene derivato, then è `again` indipendentemente da `usedExplanation` e `declaredEasy`.
- Given una risposta corretta consultata dopo la spiegazione (`usedExplanation === true`), when l'esito viene derivato, then è `hard`, anche se `declaredEasy === true`.
- Given una risposta corretta senza aiuto, when l'esito viene derivato, then è `good`, oppure `easy` se `declaredEasy === true`.
- Given il modulo, when se ne ispeziona il sorgente, then non contiene `fetch`, `Date.now()`, `new Date()` senza argomenti, `Intl…resolvedOptions()` né `Math.random()`, così che l'esito calcolato offline coincida con quello online.
- Given l'intero `src/`, when lo si ispeziona meccanicamente, then l'**unico** modulo che produce (ritorna) un letterale d'esito è `src/domain/outcome.ts`: nessun altro punto decide un esito.

## Design Notes

Il primo parametro è la **correttezza** (`CheckOutcome` di `check()`), non la
risposta grezza: `exercise.ts:188-197` fissa già questo contratto (`outcomeOf`
"consuma questa correttezza PIÙ `usedExplanation`/`declaredEasy`"), e con tre soli
parametri non potrebbe ricalcolare la correttezza (mancherebbe l'`Exercise`). Non
è quindi un gap d'intento: è l'unica lettura coerente con il codice esistente.

Logica a precedenza esplicita, che ritorna letterali (così la sonda di sola
autorità ha qualcosa da rilevare):

```ts
export function outcomeOf(
  check: CheckOutcome,
  usedExplanation: boolean,
  declaredEasy: boolean,
): ReviewOutcome {
  if (!check.correct) return 'again';   // la scorrettezza domina tutto
  if (usedExplanation) return 'hard';   // corretta ma con aiuto
  if (declaredEasy) return 'easy';      // corretta, senza aiuto, dichiarata
  return 'good';                        // corretta, senza aiuto
}
```

`easy` esige "senza aiuto": perciò `usedExplanation` è valutato prima di
`declaredEasy`. `again` esige solo la scorrettezza: valutata per prima, ignora gli
altri due fatti — è ciò che impedisce allo streak di mentire.

## Verification

**Commands:**
- `npm run test -- src/domain/outcome` -- expected: tutti i test di `outcome.test.ts`, `outcome-purity.test.ts` e `outcome-sole-authority.test.ts` verdi.
- `npm run typecheck` -- expected: nessun errore (attenzione a `noUnusedParameters` e all'union di ritorno).
- `npm run lint` -- expected: nessuna violazione (`boundaries` domain→domain, `no-restricted-globals` sul dominio).

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 12: (high 0, medium 0, low 12)
- addressed_findings:
  - `[low]` `[patch]` La sonda di sola autorità intercetta solo la forma diretta `return '<letterale>'`: documentata esplicitamente la PORTATA NOTA (un produttore indiretto — variabile intermedia, ternario, tabella di lookup — sfuggirebbe e resta responsabilità della review; allargare la regex introdurrebbe falsi positivi). Convergenza di blind-hunter e intent-alignment su un AC esplicito (AC6/AC5 «nessun altro punto decide un esito»).

_Note di triage:_ quattro finding del blind-hunter (JSDoc «mancante», file di test «solo commenti», parametro non tipizzato, apostrofo in `d'ingresso`) erano falsi positivi indotti dal rendering ABBREVIATO del diff passato ai reviewer, non dai file su disco (che hanno JSDoc completo, `source: string`, `describe/it/expect` reali e `d\'ingresso` già corretto): rifiutati. Rifiutati anche: restringere il primo parametro a `boolean` (il contratto `CheckOutcome` è fissato da `exercise.ts:188-197`, scelta di spec); asserzione di tipo sul ritorno (l'annotazione `: ReviewOutcome` la impone già in `tsc`); test d'integrazione `outcomeOf → schedule` (stessa union importata, garantita dal type system, e fuori ambito); guardia sui booleani o su «altri campi» di `check` (i booleani sono primitivi non mutabili e `CheckOutcome` ha solo `correct`; il cubo è esaustivo); UX di `declaredEasy` ignorato con aiuto (comportamento a spec, riga 8 della Matrix, di competenza delle storie UI); ridondanza del controllo `fetch(` nella sonda (belt-and-suspenders coerente con la famiglia di sonde già accettata). edge-case-hunter: 0 finding; verification-gap: nessuno; intent-alignment: Reading A+B pienamente implementate, nessun `intent_gap` (la firma è risolta da `AD-24`/`exercise.ts`).

## Auto Run Result

Status: done
Follow-up review recommended: false (patch: high 0, medium 0, low 1 → score 3×0 + 1×1 = 1 < 5)

**Change implementato:** creata la seconda legge di dominio di Epic 3 (`AD-24`): `outcomeOf(check, usedExplanation, declaredEasy)` in `src/domain/outcome.ts`, funzione pura e totale che TRADUCE fatti già raccolti — la correttezza (`CheckOutcome` di `check()`), l'aver consultato la spiegazione, l'aver dichiarato «facile» — nell'esito SRS (`again`/`hard`/`good`/`easy`). Precedenza fissa: la scorrettezza domina (`again`), poi l'aiuto (`hard`), poi la dichiarazione (`easy` solo senza aiuto), altrimenti `good`. Nessuna dipendenza da tempo, rete o global: l'esito calcolato offline coincide con quello online. È l'unico punto del codice che produce un esito.

**File cambiati:**
- `src/domain/outcome.ts` -- nuovo: `outcomeOf` puro/totale; importa `type CheckOutcome` da `./exercise` e `type ReviewOutcome` da `./schedule` (nessuna ridefinizione di tipi, nessun import esterno né runtime).
- `src/domain/outcome.test.ts` -- nuovo: 13 test, cubo booleano completo (8 righe della I/O Matrix) più proprietà (scorrettezza domina; aiuto declassa a `hard`), purezza (ricalcolo identico), non-mutazione del `CheckOutcome`, appartenenza all'union, anti-vacuità (8 vertici distinti).
- `src/domain/outcome-purity.test.ts` -- nuovo: 7 test, sonda meccanica sul sorgente (assenza di `fetch`/`Date.now`/`new Date()`/`resolvedOptions`/`Math.random`), anti-vacuità, `outcomeOf.length === 3`.
- `src/domain/outcome-sole-authority.test.ts` -- nuovo: 3 test, scansione di tutto `src/` (esclusi `*.test.ts` e `outcome.ts`) → nessun altro file ritorna un letterale d'esito; anti-vacuità (≥5 sorgenti; il rilevatore corrisponde a `outcome.ts`). Commento esteso con la PORTATA NOTA della sonda (patch di review).

**Review findings:** 1 patch applicato (low), 0 deferred, 12 rejected, 0 intent_gap, 0 bad_spec.

**Verifica eseguita:**
- `npm run test -- src/domain/outcome` → 23/23 verdi (3 file), ri-eseguito dopo il patch.
- `npm run test` (suite completa, in step-03) → 440/440 verdi, 0 regressioni (conferma che la sonda di sola autorità non produce falsi positivi sull'albero esistente).
- `npm run typecheck` → nessun errore.
- `npm run lint` → nessuna violazione.
- Matrix Test Audit: tutte e 8 le righe del cubo booleano coperte da test eseguiti e verdi.

**Rischi residui:** nessuno per l'ambito di questa storia. Il valore della sonda di sola autorità è prospettico: sarà una vera guardia quando una storia UI futura (3.18–3.19) raccoglierà i fatti e dovrà instradarli in `outcomeOf`; la sua portata (forma diretta `return '<letterale>'`) è ora documentata nel file. La validazione runtime degli input resta, per contratto, responsabilità del data layer (3.7–3.10), coerentemente con i Boundaries.
