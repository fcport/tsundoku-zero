---
title: 'Story 3.14: Una lezione senza esercizi si sblocca lo stesso'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '9cc64eddd2b65534858574e51e5800592a75f512'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Alcune lezioni sono concettuali: non hanno esercizi. Sbloccarle NON muove la pila (0 righe `review_state`), così l'utente vede il pulsante «funzionare» ma il conteggio resta a zero — indistinguibile da un pulsante rotto. La meccanica di sblocco (RPC `unlock_lesson`, 3.13) gestisce GIÀ questo caso — crea solo la riga `lesson_progress`, nessuna `review_state` — ma la dashboard NON lo DICHIARA: 3.13 differì esplicitamente a 3.14 «la dichiarazione "questa lezione non ha esercizi"».

**Approach:** Rendere DERIVABILE dallo stato persistito che l'ultima lezione sbloccata è concettuale, e DICHIARARLO sulla dashboard. Aggiungere `exerciseCount` al read-model del contenuto (`LessonSummary`, letto server-side via count PostgREST), un selettore di dominio PURO `lastUnlockedLesson`, e una dichiarazione neutra sulla dashboard quando la pila è a zero e l'ultima sbloccata non ha esercizi. AC1 (materializzazione) e AC3 (conta come sbloccata) sono GIÀ consegnati da 3.13: qui si verificano e si aggiunge la sola dichiarazione UI mancante.

## Boundaries & Constraints

**Always:**
- **La dichiarazione è DERIVATA, mai memorizzata (AD-5).** Condizione: `count === 0` E `lastUnlocked !== null` E `lastUnlocked.exerciseCount === 0`. Deriva dallo stato persistito (`['lessons']` + `['unlocked']` + pila), NON da stato transiente della mutation: sopravvive al refresh (una lezione concettuale sbloccata resta dichiarata al ricarico). Nessuna nuova lettura: riusa le quattro query già presenti sulla dashboard.
- **`exerciseCount` è CONTENUTO, letto server-side.** Estendere `LessonSummary` con `exerciseCount: number`. L'adattatore `src/data/contentRepository.ts` lo legge col count aggregato PostgREST della risorsa embedded (`select('…, exercise(count)')` ⇒ `exercise: [{ count: n }]`), lo mappa e LANCIA `DataError('listLessons')` su forma malformata (mirror del contratto esistente: riga rotta = fallimento, non valore degradato).
- **La sequenza «ultima sbloccata» vive nel DOMINIO.** Creare `lastUnlockedLesson(lessons, unlockedIds): LessonSummary | null` PURA in `src/domain/curriculum.ts` (accanto a `nextLessonToUnlock`): la lezione sbloccata con `ordinal` più ALTO, o `null` se nulla di sbloccato combacia. Puro, totale, senza mutazione né costrutti temporali (AD-1). Le sbloccate sono un prefisso contiguo (unico percorso di scrittura è sequenziale), quindi «ordinal più alto» = «più recente».
- **Copy neutra (nessuna grammatica della celebrazione).** `dashboard.noExercisesNotice` in ENTRAMBI i cataloghi `en`/`it` (parità imposta da `i18n.test.tsx`): dichiara che la lezione non ha esercizi E il perché (è concettuale → nulla da rivedere → la pila resta a zero, non è un fallimento). Nessun `!`, emoji, avverbio di lode, verde/rosso; solo token del sistema di design (`text-ink-secondary`).
- **Confini AD-1.** `src/features/dashboard/` importa `domain` (`curriculum`, `due`, `streak`), `ui`, `i18n`, `@tanstack/react-query`, MAI `data`. Solo token del sistema di design, nessun colore letterale.

**Block If:**
- _Nessun blocco._ Ogni decisione è fissata dall'epica («una lezione senza esercizi si sblocca comunque, non muove la pila, e l'interfaccia lo dichiara»; «conta la lezione come sbloccata») e dai pattern esistenti (RPC di 3.13, `resolveBilingual`, contratto `DataError`). Nessun input umano né azione esterna al repository (nessun dominio/DNS/API-key/console vendor).

**Never:**
- NON toccare la RPC `unlock_lesson` né aggiungere SQL: la materializzazione di una lezione senza esercizi (solo `lesson_progress`, nessuna `review_state`) è GIÀ corretta e verificata dai test AST di 3.13 (l'INSERT `review_state` è guidato da `select … from exercise where lesson_id` ⇒ 0 esercizi = 0 righe; il CTE inserisce sempre `lesson_progress`). AC1 non richiede codice nuovo.
- NON introdurre il rendering del TITOLO bilingue nella UI (mapping `Locale`→`BilingualLanguage`, `resolveBilingual` con dichiarazione del ripiego FR8.5): è confine delle storie di sessione (3.18/3.19) dove il giapponese e il ripiego sono davvero esercitati. La dichiarazione si riferisce a «la lezione appena sbloccata» senza nominarla.
- NON fare il lavoro di 3.15/3.16: nessuno stato di primo-avvio DISTINTO, nessun occultamento dello zero del `pile-counter`, nessuna schermata unica SENZA azione per il curriculum esaurito. Il cancello di 3.13 resta identico; la dichiarazione è un elemento AGGIUNTIVO, non una nuova schermata.
- NON cablare l'avvio sessione (resta 3.18); NON memorizzare pila/sbloccate (sempre derivate, AD-5); nessun `Date.now()`/`new Date()`/`resolvedOptions()` sotto `src/domain/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `lastUnlockedLesson`: nulla sbloccato | lessons 1..5, unlocked ∅ | `null` | — |
| `lastUnlockedLesson`: prefisso | lessons 1..5, unlocked {ord 1,2,3} | la lezione `ordinal` 3 (più alta sbloccata) | — |
| `lastUnlockedLesson`: input disordinato | lessons non ordinate, unlocked {1,2} | la lezione `ordinal` 2 | — |
| `lastUnlockedLesson`: id spurio | unlocked contiene un id assente da lessons | ignora, ritorna il max fra i match (o `null`) | — |
| `listLessons`: conta esercizi | riga con `exercise: [{ count: 3 }]` | `exerciseCount: 3` | — |
| `listLessons`: lezione concettuale | riga con `exercise: [{ count: 0 }]` | `exerciseCount: 0` | — |
| `listLessons`: `exercise` malformato | `exercise` non-array o `count` non-numero | LANCIA `DataError('listLessons')` | reject, non degrada |
| dashboard: concettuale + successiva | `count 0`, `lastUnlocked.exerciseCount 0`, `next ≠ null` | rende la dichiarazione E l'azione di sblocco | — |
| dashboard: pila drenata normale | `count 0`, `lastUnlocked.exerciseCount > 0` | NESSUNA dichiarazione | — |
| dashboard: nulla sbloccato | `count 0`, `lastUnlocked === null` | NESSUNA dichiarazione (primo-avvio = 3.15) | — |
| dashboard: pila non vuota | `count > 0` | NESSUNA dichiarazione (solo il cancello di 3.13) | — |

</intent-contract>

## Code Map

- `src/domain/ports/contentRepository.ts:22-27` -- `LessonSummary`; **aggiungere** `exerciseCount: number` (docblock: conteggio degli esercizi della lezione; `0` = lezione concettuale, AD-19). Additivo: `nextLessonToUnlock` non lo usa.
- `src/domain/curriculum.ts:26-38` -- accanto a `nextLessonToUnlock`, **creare** `lastUnlockedLesson(lessons, unlockedIds): LessonSummary | null` (puro: copia+ordina per `ordinal` DISCENDENTE, ritorna la prima il cui `id` è in `unlockedIds`, o `null`). Docblock: «ultima sbloccata = prefisso contiguo ⇒ ordinal massimo sbloccato».
- `src/domain/curriculum.test.ts:11-13` -- l'helper `lesson()`: **aggiungere** `exerciseCount` (default 0) alla forma; **aggiungere** un `describe('lastUnlockedLesson …')` con le 4 righe «lastUnlockedLesson» della matrix. Le asserzioni `toEqual(lesson(...))` esistenti restano verdi (stesso helper su entrambi i lati).
- `src/data/contentRepository.ts:22-23,27-33,49-71,82-97` -- `LESSON_COLUMNS`: **aggiungere** `exercise(count)`; `LessonRow`: **aggiungere** `exercise: unknown`; `toLessonSummary`: **leggere** `exerciseCount` dal count embedded (`exercise[0].count`, numero), LANCIANDO `DataError('listLessons')` se `exercise` non è array o `count` non è numero. Docblock aggiornato.
- `src/data/contentRepository.test.ts:51-91,114-179` -- **aggiornare** le righe finte con `exercise: [{ count: n }]`; **aggiungere** i test: count mappato (>0), lezione concettuale (`count 0`), `exercise` malformato ⇒ `DataError`.
- `src/features/dashboard/DashboardScreen.tsx:22,113-168` -- import `lastUnlockedLesson`; derivare `const lastUnlocked = lastUnlockedLesson(lessonsQ.data, unlockedQ.data)`; **aggiungere**, PRIMA del cancello, la dichiarazione resa sse `count === 0 && lastUnlocked?.exerciseCount === 0` (un `<p className="text-label text-ink-secondary">{t('dashboard.noExercisesNotice')}</p>`). Il cancello 3.13 resta invariato.
- `src/features/dashboard/DashboardScreen.test.tsx:65-91,253-289` -- `seededClient`: dare a ogni lezione seminata `exerciseCount: 1` di default (così i test cancello esistenti NON innescano la dichiarazione) + un `lessonExerciseCounts?: readonly number[]` opzionale; **aggiungere** un `describe` per AC2 (concettuale ⇒ dichiarazione + sblocco; drenata normale ⇒ nessuna; nulla sbloccato ⇒ nessuna; microcopy senza `!`) e per AC3 (la concettuale conta in «u di t lezioni»).
- `src/i18n/en.ts:33-49`, `src/i18n/it.ts:27-43` -- sezione `dashboard`: **aggiungere** `noExercisesNotice` in ENTRAMBI (parità en/it).
- `src/migrations.test.ts:1449-1632` -- (SOLO lettura) il test AST di `unlock_lesson` che già verifica AC1: nessuna modifica.
- `src/app/{AppRoutes,AuthRoot,AuthenticatedShell}.test.tsx`, `src/features/ports/PortsContext.test.tsx` -- (SOLO lettura) i fake `content.listLessons` ritornano `[]`: l'aggiunta del campo non li rompe, nessuna modifica.

## Tasks & Acceptance

**Execution:**
- `src/domain/ports/contentRepository.ts` -- **aggiungere** `exerciseCount: number` a `LessonSummary` con docblock.
- `src/domain/curriculum.ts` -- **creare** `lastUnlockedLesson` (puro, docblock).
- `src/domain/curriculum.test.ts` -- **estendere** l'helper `lesson()` con `exerciseCount`; **aggiungere** i 4 test `lastUnlockedLesson`.
- `src/data/contentRepository.ts` -- **estendere** select + `LessonRow` + `toLessonSummary` per `exerciseCount` (con `DataError` su malformato).
- `src/data/contentRepository.test.ts` -- **aggiornare** le righe finte; **aggiungere** i test count>0 / concettuale / malformato.
- `src/features/dashboard/DashboardScreen.tsx` -- derivare `lastUnlocked`; **aggiungere** la dichiarazione condizionale.
- `src/features/dashboard/DashboardScreen.test.tsx` -- **estendere** `seededClient` (default `exerciseCount 1` + override); **aggiungere** i test AC2/AC3.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- **aggiungere** `dashboard.noExercisesNotice` in entrambi.

**Acceptance Criteria:**
- **AC1 — Materializzazione senza esercizi (già consegnata, verificata).** *Given* una lezione senza esercizi, *when* `unlock_lesson` è eseguita, *then* crea la riga `lesson_progress` e NESSUNA `review_state`. Garantito strutturalmente dalla RPC di 3.13 (INSERT `review_state` guidato da `select … from exercise where lesson_id`; CTE `lesson_progress` sempre inserito) e verificato dal test AST esistente in `src/migrations.test.ts`. Effetto DB dal vivo e2e-differito (AD-12/13). Nessun codice nuovo.
- **AC2 — Dichiarazione della lezione concettuale.** *Given* la pila a zero con l'ULTIMA lezione sbloccata priva di esercizi, *when* la dashboard è resa, *then* dichiara esplicitamente che quella lezione non ha esercizi e perché (è concettuale, la pila resta a zero — non un fallimento). *And* quando l'ultima sbloccata HA esercizi, o nulla è sbloccato, o la pila non è vuota, la dichiarazione NON compare.
- **AC3 — Conta come sbloccata (già consegnata, verificata).** *Given* una lezione concettuale sbloccata, *when* il progresso del curriculum è mostrato, *then* la lezione è conteggiata fra le sbloccate («u di t lezioni»): `listUnlockedLessonIds` legge `lesson_progress`, quindi la concettuale (che ha la sua riga di progresso) è già inclusa. Verificato da un test della dashboard.
- **AC4 — Selettore puro.** *Given* le lezioni e le sbloccate, *when* `lastUnlockedLesson` è invocata, *then* ritorna la sbloccata con `ordinal` più alto (o `null`), ordinando input disordinati e ignorando id spuri; puro, senza clock/rete.
- **AC5 — Read-model del contenuto.** *Given* le righe `lesson` col count embedded degli esercizi, *when* `listLessons` mappa, *then* ogni `LessonSummary` porta `exerciseCount` (0 per la concettuale); una forma `exercise` malformata ⇒ `DataError('listLessons')`.
- **AC6 — Confini / celebrazione.** *Given* `features/dashboard` e i cataloghi, *then* `features/dashboard` non importa `data`, nessun colore letterale, la copy della dichiarazione è priva di `!`/emoji/lode, parità en/it verde; `npm run lint`/`npm test` verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 1, low 0)
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[medium]` `[patch]` `toExerciseCount` (`src/data/contentRepository.ts`) rigettava ogni riga la cui `exercise` embedded non avesse lunghezza ESATTAMENTE 1. Il count aggregato PostgREST per una lezione SENZA esercizi può emettere `[]` invece di `[{ count: 0 }]`: con la guardia rigida, la riga della lezione concettuale — il caso CENTRALE di 3.14 — avrebbe lanciato `DataError` e, poiché una singola riga malformata rigetta l'intera promise di `listLessons`, avrebbe bloccato la dashboard sullo scheletro proprio nel caso che la storia costruisce. Fix: `[]` ⇒ `exerciseCount 0` (forma valida per «zero esercizi»); resta `DataError` su non-array, lunghezza > 1, o `count` non-numero. Aggiunti test `exercise: []` ⇒ 0 e lunghezza > 1 ⇒ `DataError`. `npm test` verde (731).
- reject notevoli (verificati contro il codice reale):
  - **Guardia numerica su `count` (NaN/negativo/non-intero)** (blind-hunter + edge-case-hunter): `typeof === 'number'` È il bar del repo per le colonne lette — anche `ordinal` non è integer/range-checked — e la sorgente (aggregato PostgREST) è sempre un intero non-negativo: non producibile dal reale, e un check asimmetrico solo su `count` divergerebbe dal pattern esistente.
  - **Copertura difensiva** (entry `[null]`/non-oggetto; mutua-esclusione notice/hero-count; assert IT esplicito del notice): la parità en/it è già imposta strutturalmente da `i18n.test.tsx`; il ramo `count > 0` è già coperto; l'entry non-oggetto è dietro una guardia su forma garantita dalla sorgente. Il test empty-array è stato comunque aggiunto come parte del patch.
  - **Stile** (double-cast in `toExerciseCount`; costante condivisa per `'listLessons'`; memoizzazione del sort di `lastUnlockedLesson`): preferenze; il repo ripete già le stringhe operazione (`progressRepository`) e i selettori ordinano indipendentemente (`nextLessonToUnlock`); il curriculum è piccolo (sort trascurabile).
  - **Glue click→`mutate`→refetch non esercitata + effetto DB dal vivo (incl. forma di `exercise(count)`)**: convenzione documentata del repo (AD-12/13; env `node`/`renderToStaticMarkup` senza jsdom), come in 3.13/3.9; già dichiarata nello spec. Il meccanismo (selettori dominio, mappa dati, condizione di render) è coperto a unità.
  - **Lezione non nominata (deittica vs nominata)** (intent-alignment): scelta DELIBERATA e documentata (nominarla richiederebbe il mapping `Locale`→`BilingualLanguage` + `resolveBilingual`, scope delle storie di sessione 3.18/3.19); AC2 «quella lezione» è deittico ed è soddisfatto da «la lezione appena sbloccata».
  - **Gerarchia visiva/a11y del notice; esaurito+concettuale con copy «appena»**: rifinitura degli stati vuoti di autorità dell'epica (3.15/3.16); il notice usa token validi ed è testo nel landmark `main`; e mostra SEMPRE la lezione più recente (`ordinal` massimo sbloccato = ultimo sblocco), quindi «appena sbloccata» è accurato nel caso primario post-click.
  - **«Drift» del numero storia (3.14 vs 3.13)**: non reale — questa È la storia 3.14; il `baseline_revision` del diff è il commit di 3.13, da cui la confusione del reviewer.

## Design Notes

**Perché derivare la dichiarazione dallo stato persistito, non dalla mutation.** «Mai memorizzare, sempre derivare» (AD-5): la dichiarazione NON è un flag «ho appena cliccato». È una funzione pura dello stato letto: `count === 0 && lastUnlocked?.exerciseCount === 0`. Vantaggio concreto: sopravvive al refresh — chi ricarica dopo aver sbloccato una lezione concettuale continua a vedere il perché la pila è a zero. Le sbloccate sono un prefisso contiguo (l'unico percorso di scrittura, `nextLessonToUnlock`, è sequenziale), quindi «ultima sbloccata» è deterministicamente «ordinal massimo sbloccato», senza bisogno di un `unlocked_at` nel read-model.

**Perché `exerciseCount` nel contenuto e non un cross-check su `review_state`.** «Ha esercizi» è una proprietà del CONTENUTO (uguale per tutti), non del progresso utente. Dopo aver drenato una lezione normale le sue righe `review_state` esistono ancora (non sono più dovute): distinguere «concettuale» da «drenata» richiede comunque il conteggio di contenuto. Il count embedded PostgREST (`exercise(count)`) lo legge server-side in un solo giro, senza scaricare i payload degli esercizi (coerente con `LessonSummary` snello). Comportamento del count dal vivo e2e-differito (AD-12/13); la mappa e la stringa di select sono verificate a unità col client finto.

**Perché non nominare la lezione.** Nominarla richiederebbe il mapping `Locale`→`BilingualLanguage` e `resolveBilingual` con dichiarazione del ripiego (FR8.5) — machinery di rendering bilingue che l'epica colloca nelle storie di sessione (3.18/3.19), dove giapponese e ripiego sono davvero esercitati. Introdurla qui per una riga sarebbe espansione d'infrastruttura fuori scope. «La lezione appena sbloccata» identifica univocamente il referente.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (`exerciseCount` ovunque; `lastUnlockedLesson` tipata; `DashboardScreen` coerente).
- `npm run lint` -- expected: exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; boundaries verdi).
- `npm test` -- expected: exit 0 (`lastUnlockedLesson`; `exerciseCount` in `contentRepository`; dichiarazione dashboard AC2/AC3; parità en/it; nessuna regressione a 3.12/3.13).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

## Auto Run Result

Status: done

**Sintesi del cambiamento.** La storia 3.14 aggiunge la sola parte mancante del ciclo di sblocco: la DICHIARAZIONE, sulla dashboard, che l'ultima lezione sbloccata è concettuale (senza esercizi). AC1 (sblocco crea `lesson_progress` e NESSUNA `review_state`) e AC3 (la concettuale conta come sbloccata) erano GIÀ consegnati da 3.13 — la RPC atomica `unlock_lesson` materializza le righe `review_state` da un `select … from exercise where lesson_id`, quindi 0 esercizi ⇒ 0 righe, mentre il CTE inserisce sempre `lesson_progress`; e `listUnlockedLessonIds` legge `lesson_progress`, includendo la concettuale nel «u di t lezioni» — e restano verificati (test AST della migrazione + test dashboard). Il read-model del contenuto guadagna `LessonSummary.exerciseCount` (letto server-side col count aggregato embedded PostgREST `exercise(count)`); nasce il selettore di dominio PURO `lastUnlockedLesson` (la sbloccata con `ordinal` massimo, o `null`); la dashboard rende una dichiarazione neutra SSE `count === 0 && lastUnlocked?.exerciseCount === 0`, DERIVATA dallo stato persistito (mai da un flag di mutation, AD-5: sopravvive al refresh) e AGGIUNTIVA al cancello 3.13 (che resta invariato). La dichiarazione NON compare a pila drenata normale, a nulla sbloccato (primo-avvio = 3.15) o a pila non vuota. Restano fuori scope, per autorità dell'epica: gli stati vuoti DISTINTI e l'occultamento dello zero (3.15/3.16), il rendering del titolo bilingue nella UI (storie di sessione 3.18/3.19), il tetto di sblocco (3.17) e la verifica DB dal vivo (e2e differita, AD-12/13).

**File modificati/creati:**
- `src/domain/ports/contentRepository.ts` — aggiunto `exerciseCount: number` a `LessonSummary` (docblock: `0` = lezione concettuale).
- `src/domain/curriculum.ts` (+ `.test.ts`) — nuovo `lastUnlockedLesson` puro (ordina per `ordinal` discendente, ritorna la prima sbloccata, o `null`); 4 test (nulla sbloccato, prefisso, disordinato, id spurio); helper `lesson()` esteso con `exerciseCount`.
- `src/data/contentRepository.ts` (+ `.test.ts`) — `LESSON_COLUMNS` con `exercise(count)`, `LessonRow.exercise`, `toExerciseCount` (tollera `[{ count: n }]` e `[]`⇒0; `DataError` su non-array/lunghezza>1/`count` non-numero), mappatura `exerciseCount`; test count>0, concettuale `[{count:0}]`, empty-array `[]`⇒0, lunghezza>1⇒DataError, `exercise` non-array⇒DataError, `count` non-numero⇒DataError.
- `src/features/dashboard/DashboardScreen.tsx` (+ `.test.tsx`) — deriva `lastUnlocked`; dichiarazione condizionale prima del cancello; `seededClient` con `exerciseCount` default 1 + override `lessonExerciseCounts`; test AC2 (concettuale⇒notice+sblocco; drenata⇒niente; nulla sbloccato⇒niente; pila non vuota⇒niente; microcopy senza `!`) e AC3 (la concettuale conta in «3 of 10 lessons»).
- `src/i18n/en.ts` / `it.ts` — `dashboard.noExercisesNotice` (parità en/it), copy neutra (fatto + perché; nessun `!`/emoji/lode/colore).
- `src/features/ports/PortsContext.test.tsx` — `exerciseCount: 1` nel literal `sampleLessons` (necessario al typecheck; il test non asserisce il campo).

**Ripartizione dei finding (questa passata):** patch applicati 1 (medium); differiti 0; respinti 14 (medium 0, low 14). Nessun `intent_gap`, nessun `bad_spec`, nessun loopback: `review_loop_iteration` resta 0. L'unico patch ha reso `toExerciseCount` tollerante alla forma `[]` che PostgREST può emettere per una lezione senza esercizi — protezione diretta del caso centrale della storia contro un contratto esterno incerto (una guardia rigida avrebbe fatto fallire `listLessons` proprio per la lezione concettuale).

**Raccomandazione di follow-up review:** `false`. Contano solo i patch di questa passata: high 0, medium 1, low 0 ⇒ punteggio `3×1 + 1×0 = 3` (< 5 e nessun high).

**Verifica eseguita (dopo il patch, indipendente):**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; boundaries verdi).
- `npm test` — exit 0 (70 file, 731 test; `lastUnlockedLesson`, `exerciseCount` in `contentRepository` incl. `[]`⇒0, dichiarazione dashboard AC2/AC3, parità en/it; nessuna regressione a 3.12/3.13).
- `npm run validate-content` — exit 0.

**Matrix Test Audit:** tutte e 11 le righe della matrice coperte da test eseguiti e verdi (4 in `curriculum.test.ts` per `lastUnlockedLesson`; 3+ in `contentRepository.test.ts` per `exerciseCount`/concettuale/malformato; 4 in `DashboardScreen.test.tsx` per la dichiarazione). AC1 (materializzazione senza esercizi) resta coperto dal test AST di `unlock_lesson` (3.13).

**Rischi residui.** (1) L'effetto DB dal vivo — sia dello sblocco di una lezione senza esercizi, sia della FORMA di ritorno di `exercise(count)` (`[{count:0}]` vs `[]`) — è verificato solo a unità con client finto; la verifica dal vivo è e2e-differita (AD-12/13). Il patch rende il codice robusto a ENTRAMBE le forme, riducendo il rischio residuo. (2) La glue click→`mutate`→refetch che fa comparire la dichiarazione dopo lo sblocco non è esercitata sotto l'harness `node`/`renderToStaticMarkup` (nessun jsdom): differita all'e2e come da convenzione del repo; il meccanismo (selettori, mappa, condizione di render) è coperto a unità. (3) La dichiarazione riusa i token dei renghi statistici (`text-label text-ink-secondary`): l'eventuale gerarchia visiva distinta è rifinitura degli stati vuoti (3.15/3.16).
