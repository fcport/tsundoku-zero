---
title: 'Story 2.2: I tre tipi e i loro validatori'
type: 'feature'
created: '2026-09-24'
status: done
baseline_revision: '8b68e44081438552e9e9c909c6ec099b9f4e62f0'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Dopo 2.1 l'esercizio ha una forma BASE ma il suo `kind` è ancora una stringa qualsiasi: nulla impedisce a una lezione di introdurre un tipo che il dominio non conosce, e nessuna funzione dice se una risposta è corretta. Il contratto dell'esercizio resta aperto e non verificabile.

**Approach:** Chiudere il registro dei tipi (`AD-22`) trasformando `exerciseSchema`/`Exercise` — **sotto gli stessi nomi esportati**, così `lesson.ts` non cambia — in una **union discriminata su `kind`** chiusa a esattamente tre tipi (`single-select`, `select-span`, `assemble`), ciascuno con la forma dei propri dati. Estendere il kit di schema puro con i combinatori mancanti (`literal`, `discriminatedUnion`) perché la union derivi da **una sola definizione** (tipo inferito + validatore, AC1 di 2.1). Aggiungere per ogni tipo una funzione **pura** `check(exercise, response): CheckOutcome` che dice solo se la risposta è corretta, più i suoi test coi casi limite. Il tipo dice *come si risponde*; ciò che l'esercizio insegna vive in `grammarPoint`, non nel `kind`.

## Boundaries & Constraints

**Always:**
- `exerciseSchema` diventa `discriminatedUnion('kind', {...})` chiusa ai **tre** letterali; `Exercise = Infer<typeof exerciseSchema>` (una sola definizione: tipo e validatore non si disallineano). Un `kind` fuori dai tre è un **errore di validazione dello schema**, non un caso ignorato a runtime (AD-22).
- Nomi esportati invariati (`exerciseSchema`, `Exercise`): `lesson.ts` continua a fare `array(exerciseSchema)` **senza modifiche**.
- Campi **comuni** a tutti e tre: `kind` (letterale), `grammarPoint` (non vuoto — ciò che l'esercizio esercita, `AD-22`/riga 824-826), `sentence` (`japaneseSentence`), `explanation`. Specializzati per tipo: `answer` e `distractors`.
- `single-select`: `answer` = l'unica opzione corretta (stringa non vuota); `distractors` = array **non vuoto** di opzioni sbagliate (una consegna, *n* opzioni, una risposta). `check` ⇒ corretto sse `response.choice === answer`.
- `select-span`: `answer` = una **porzione della frase** espressa come span sugli **indici dei segmenti** di `alignFurigana()` (`{ start, end }`, semiaperto, interi ≥ 0, `end > start`) — **mai** indici di carattere. Nessun `distractors`. `check` ⇒ corretto sui **confini dei segmenti** (`start`/`end` combaciano), non su offset di carattere.
- `assemble`: `answer` = la **sequenza ordinata** corretta di tessere (array non vuoto di stringhe non vuote). Nessun `distractors`. `check` ⇒ corretto se `response.order` coincide **elemento per elemento e nell'ordine**.
- `check(exercise, response)` è **puro e totale**: dispatch su `exercise.kind`; una `response` di `kind` diverso dall'esercizio è `{ correct: false }` (non lancia). Ritorna `CheckOutcome = { readonly correct: boolean }`.
- `src/domain/` resta **puro** (`AD-1`): nessun import esterno, nessun global vietato, **nessun `Math.random()`** in nessun file del dominio (imposto meccanicamente da una sonda su sorgente); ogni ordinamento è deterministico.

**Block If:**
- _Nessun blocco._ Storia interamente in-repo (dominio puro + test): nessuna azione umana né vendor. Esito atteso `done`.

**Never:**
- **Non** calcolare l'**esito SRS** (`again`/`hard`/`good`/`easy`): è `outcomeOf()` della **storia 3.2** (`AD-24`), che consuma questa correttezza più `usedExplanation`/`declaredEasy`. `check` restituisce **solo** correttezza (`CheckOutcome`), che è ciò che `AD-22` chiama «Outcome».
- **Non** implementare `alignFurigana()` né la segmentazione: è **Epic 3**. Qui `check` di `select-span` **confronta indici di segmento** senza segmentare; la validazione che quegli indici siano in range coi segmenti reali è controllo di **contenuto in 2.6** (richiede `alignFurigana()`).
- **Non** costruire la resa/mescolamento di opzioni e tessere (presentazione): è **Epic 3**. Qui vale solo il vincolo di purezza/determinismo su `exercise.ts`.
- **Non** calcolare l'identità `uuidv5` dell'esercizio (**2.3**), né toccare il gate CI su `content/lessons/` (**2.6**), né creare file di lezione reali (**2.7**).
- Nessuna libreria di schema esterna (Zod ecc.): violerebbe `AD-1`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| single-select valido | `kind:'single-select'`, `answer`, `distractors:['…']`, `grammarPoint`, `sentence`, `explanation` | `ok: true`, valore tipizzato come variante | nessun errore |
| single-select senza distractors | `distractors` assente o `[]` | `ok: false` | issue con `path` `…distractors` |
| kind fuori registro | `kind:'drag-drop'` | `ok: false` (errore di schema, non ignorato) | issue con `path` `…kind` |
| kind non stringa | `kind: 42` | `ok: false` | issue con `path` `…kind` |
| select-span valido | `answer:{start:5,end:6}` | `ok: true` | nessun errore |
| select-span span degenere | `answer:{start:2,end:2}` o `end<start` | `ok: false` | issue con `path` `…answer` |
| assemble valido | `answer:['A','B','C']` | `ok: true` | nessun errore |
| grammarPoint assente | manca `grammarPoint` | `ok: false` | issue con `path` `…grammarPoint` |
| check single-select giusto/sbagliato | `choice===answer` / `choice` = un distrattore | `{correct:true}` / `{correct:false}` | n/a |
| check select-span sui confini | span `===` answer / span diverso | `{correct:true}` / `{correct:false}` | n/a |
| check assemble ordine | stesse tessere stesso ordine / ordine diverso | `{correct:true}` / `{correct:false}` | n/a |
| check risposta di kind sbagliato | `exercise.kind !== response.kind` | `{correct:false}` (totale, non lancia) | n/a |

</intent-contract>

## Code Map

- `src/domain/schema.ts` — **MODIFICA**: aggiungere due combinatori puri al kit. `literal<L>(value)`: `Schema<L>` che accetta solo il valore esatto (per il discriminante). `discriminatedUnion<D,V>(discriminant, variants)`: legge `input[discriminant]`; se non è una stringa fra le chiavi di `variants` ⇒ `fail([...path, discriminant], 'kind sconosciuto …')`; altrimenti delega alla variante. Output `Infer<V[keyof V]>` (union discriminata). Riusa `fail`/`ok`/`typeName` esistenti; nessun `any` (il cast d'uscita segue lo stile di `object()` a riga 237).
- `src/domain/exercise.ts` — **RISCRITTURA della forma base in union** (righe 55-67 di oggi). Mantiene `japaneseSentence`, `explanation` invariati. `exerciseSchema` = `discriminatedUnion('kind', { 'single-select': …, 'select-span': …, 'assemble': … })`; `Exercise = Infer<typeof exerciseSchema>` (nomi invariati). Nuovi: `CheckOutcome` (`{ readonly correct: boolean }`), `ExerciseResponse` (union discriminata su `kind`: `{kind:'single-select',choice}` | `{kind:'select-span',span:{start,end}}` | `{kind:'assemble',order:readonly string[]}`), `SegmentSpan` (`{start,end}`), e `check(exercise, response): CheckOutcome` (dispatch puro). Import da `./schema`: aggiungere `literal`, `discriminatedUnion`, `integer`, `refine`, `nonEmptyArray`.
- `src/domain/lesson.ts` — **RIFERIMENTO (non modificare)**: importa `exerciseSchema` e fa `array(exerciseSchema)` (righe 16, 40). Deve restare intatto: è la prova che la union vive «sotto lo stesso nome».
- `src/domain/exercise.test.ts` — **RISCRITTURA**: le fixture base non valgono più (single-select ora esige `distractors` e `grammarPoint`). Coprire tutte le righe della I/O Matrix su schema + `check` per i tre tipi, casi limite inclusi.
- `src/domain/lesson.test.ts` — **MODIFICA fixture**: `validExercise` (righe 7-12) va reso una variante valida (`single-select` con `distractors` + `grammarPoint`); il test `exercises.1.kind` (riga 82) con `kind: 42` resta valido (discriminante non fra i tre). Le asserzioni di `parseLesson`/`deriveLessonId` non cambiano.
- `src/domain/schema.test.ts` — **MODIFICA**: aggiungere test per `literal` (accetta/rifiuta) e `discriminatedUnion` (variante giusta, discriminante sconosciuto ⇒ issue sul path del discriminante, discriminante non-stringa, propagazione del `path` annidato).
- `src/domain/exercise-purity.test.ts` — **NUOVO**: sonda su sorgente che asserisce che nessun file `src/domain/**/*.ts` (esclusi i `.test.ts`) contiene `Math.random` — la purezza/determinismo di `AD-22` resa meccanica (lo stile-sonda esiste già in `src/boundaries.test.ts`). `no-restricted-globals` copre `fetch`/storage ma **non** `Math.random`, quindi serve questa sonda.
- `src/boundaries.test.ts` — **RIFERIMENTO**: modello di sonda su sorgente reale con guardia anti-vacuità (pretendi che i file attesi siano stati visti).

## Tasks & Acceptance

**Execution:**
- `src/domain/schema.ts` — aggiungere `literal()` e `discriminatedUnion()` puri, come sopra; issue localizzato sul discriminante per un `kind` sconosciuto.
- `src/domain/exercise.ts` — ridefinire `exerciseSchema`/`Exercise` come union discriminata chiusa a tre; aggiungere `CheckOutcome`, `SegmentSpan`, `ExerciseResponse` e `check()` puro e totale.
- `src/domain/exercise.test.ts` — riscrivere per la union e `check` dei tre tipi; coprire tutte le righe della I/O Matrix.
- `src/domain/lesson.test.ts` — aggiornare le fixture di esercizio alla variante valida; verificare che `parseLesson` e la derivazione dell'id restino verdi (prova che `lesson.ts` è invariato).
- `src/domain/schema.test.ts` — aggiungere i test di `literal` e `discriminatedUnion`.
- `src/domain/exercise-purity.test.ts` — sonda: nessun `Math.random` sotto `src/domain/` (con guardia anti-vacuità sui file attesi).

**Acceptance Criteria:**
- Given `src/domain/exercise.ts`, when viene definito, then `exerciseSchema` è una union discriminata su `kind` **chiusa** a esattamente `single-select`/`select-span`/`assemble`, ciascuna con la forma dei propri dati, e `Exercise = Infer<typeof exerciseSchema>` (una sola definizione); un `kind` fuori dai tre è un errore di validazione dello schema (AC1, AD-22).
- Given ciascun tipo, when viene implementato, then porta una funzione **pura** `check(exercise, response): CheckOutcome` e i propri test unitari coi casi limite (AC2).
- Given un esercizio `single-select`, when valutato, then è corretto se e solo se la risposta coincide con l'unica opzione giusta (AC3).
- Given un esercizio `select-span`, when valutato, then la correttezza si verifica sui **confini dei segmenti** di `alignFurigana()` (span di indici di segmento), **non** su indici di carattere (AC4).
- Given un esercizio `assemble`, when valutato, then la correttezza dipende dall'**ordine** della sequenza di tessere (AC5).
- Given `src/domain/exercise.ts` (e il dominio tutto), when ispezionato, then non importa React/Supabase/rete/orologio e non usa `Math.random()`; l'ordine è deterministico (AC6, provato dalla sonda di purezza e dalle sonde di confine).
- Given ciò che un esercizio insegna, when registrato, then vive in `grammarPoint` sull'esercizio e **non** nel `kind`: il tipo dice come si risponde, il punto grammaticale cosa si esercita (AC7).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano senza regressioni; `lesson.ts` è **invariato** (la union vive sotto gli stessi nomi) e non c'è alcun `any` (AC8).

## Design Notes

**`check` restituisce correttezza, non l'esito SRS.** `AD-22` scrive `check(exercise, response): Outcome`, ma la firma stessa lo vincola: `check` riceve **solo** esercizio e risposta, mentre l'esito SRS (`again`/`hard`/`good`/`easy`, `AD-24`/3.2) richiede anche `usedExplanation` e `declaredEasy`. Quindi `check` **non può** produrre l'esito SRS: produce la **correttezza**, e 3.2 la consuma. Per non collidere col termine «esito»/`outcomeOf` di 3.2, il tipo si chiama `CheckOutcome = { correct: boolean }`. È l'«Outcome» di `AD-22`, disambiguato.

**`select-span`: indici di segmento, non di carattere.** `alignFurigana()` è motore di **Epic 3**; qui non esiste. La risposta e la risposta corretta vivono nello **spazio degli indici di segmento** (`{ start, end }` semiaperto), che *sono* i confini dei segmenti — il contrasto di AC4 è esplicitamente contro gli **indici di carattere**. `check` confronta i confini (`start`/`end`) senza segmentare: entrambi gli operandi sono già in coordinate di segmento. In Epic 3 la UI mappa la selezione ↔ indice via `alignFurigana()`; in 2.6 la validazione di contenuto verificherà che `end` non superi il numero di segmenti reali (serve `alignFurigana()`, quindi coordinamento con Epic 3). Qui si consegna il **confronto puro sui confini**.

**`grammarPoint` sull'esercizio, non nel `kind`.** AC7 impone che «cosa insegna» viva in `grammar_point`; lo schema DB dell'esercizio (3.7) espone `grammar_point` per esercizio e `review_log` lo denormalizza per riga (`AD-18`), perché una statistica aggreghi per punto grammaticale anche dopo una riautorazione. Un esercizio deve quindi risolversi a **un** punto grammaticale: lo porta come campo comune `grammarPoint` (non vuoto). Il `kind` resta puramente d'interazione. (2.1 lasciava aperto sia `kind` sia i campi per tipo; questa storia li chiude entrambi.)

**`discriminatedUnion` nel kit di schema.** La union puro-TS deriva da una sola definizione: ogni variante è un `object({ kind: literal('…'), … })`, e `Infer<V[keyof V]>` distribuisce sulle varianti dando la union discriminata. Esempio del principio:

```ts
const singleSelect = object({ kind: literal('single-select'), grammarPoint: nonEmptyString(),
  sentence: japaneseSentence, answer: nonEmptyString(),
  distractors: nonEmptyArray(nonEmptyString()), explanation });
export const exerciseSchema = discriminatedUnion('kind',
  { 'single-select': singleSelect, 'select-span': selectSpan, 'assemble': assemble });
export type Exercise = Infer<typeof exerciseSchema>; // union discriminata su kind
```

## Verification

**Commands:**
- `npm run typecheck` — expected: `tsc` strict, nessun `any`; `Exercise` è una union discriminata (il narrowing su `kind` funziona nei test); `lesson.ts` compila invariato.
- `npm run lint` — expected: 0 errori; i file di dominio non violano `boundaries/external` né `no-restricted-globals`.
- `npm test` — expected: `schema.test.ts` (+ `literal`/`discriminatedUnion`), `exercise.test.ts` (union + `check` tre tipi, tutte le righe della I/O Matrix), `lesson.test.ts` (fixture aggiornate, verdi), `exercise-purity.test.ts` (nessun `Math.random`), più le sonde di 1.1–2.1 senza regressioni.
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori.

## Spec Change Log

_Nessun loopback `bad_spec` in questa run: `<intent-contract>` invariato._

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 0
- reject: 12: (high 0, medium 0, low 12)
- addressed_findings:
  - `[low]` `[patch]` **`check` senza guardia di esaustività**: lo `switch (exercise.kind)` non chiudeva il registro a compile-time — un quarto `kind` futuro sarebbe scivolato via ritornando `undefined`. Aggiunto un ramo `default` con asserzione idiomatica `never` (`const _exhaustive: never = exercise`), così un `kind` non gestito è un errore di COMPILAZIONE (coerente col registro CHIUSO di AD-22) e a runtime ritorna comunque `{ correct: false }`. Le guardie interne `response.kind === '…'` restano (servono al narrowing di TS, non sono codice morto).
  - `[low]` `[patch]` **ramo del controllo di lunghezza di `assemble` non fissato**: i test coprivano solo un `order` PIÙ CORTO della answer; una risposta più lunga con prefisso corretto (`['A','B','C','D']` vs `['A','B','C']`) non era pinnata, perché `answer.every()` itera solo sugli indici di `answer` e non vede la tessera in eccesso. Aggiunto il test mancante (⇒ `{ correct: false }`). (verification-gap.)
  - `[low]` `[patch]` **asserzioni di `check` potenzialmente vacue**: i tre blocchi `describe('check — …')` racchiudevano le asserzioni in `if (exercise.ok) { … }`, che passerebbero VUOTE se una fixture smettesse di validare. Sostituito con unwrap-or-throw una volta in cima a ciascun blocco, così una regressione della fixture fallisce a voce alta.

Findings rifiutati (rappresentativi): «`check` non valida a runtime la `response` / manca un `exerciseResponseSchema`» — la `response` è tipizzata (AD-22: `check(exercise, response)`); la validazione dell'input non fidato è confine di **Epic 3**, e la totalità promessa da 2.2 è solo sul mismatch di `kind` (coperta); «l'`answer` di single-select non è esclusa dai `distractors`» — coerenza di **contenuto**, di competenza esplicita di **2.6** (unicità/coerenza), non della forma di 2.2; «guardie interne `response.kind` sono codice morto» — errato: servono al narrowing di TypeScript; «`literal(NaN)` / discriminante numerico o booleano / mappa di varianti mal cablata (`kind` ≠ chiave) / letterale interno in conflitto» — capacità non usate qui (il discriminante è una stringa, le tre varianti sono cablate e testate dai test di accettazione); «regex di strip-commenti della sonda con falsi positivi su stringhe/URL» — euristica di TEST il cui vero presidio è ESLint, e nessun falso NEGATIVO per una vera chiamata `Math.random()` (codice nudo, sempre rilevato); «elenco file anti-vacuità fragile» — coerente con lo stile già in `boundaries.test.ts`; «la sonda non copre `Date.now`/`crypto`» — l'AC di 2.2 nomina solo `Math.random()`. Nessun `defer`: nessun problema pre-esistente reale è emerso.

## Auto Run Result

Status: done

**Sommario.** Il registro dei tipi di esercizio è ora **chiuso e verificabile** (AD-22). `exerciseSchema`/`Exercise` — **sotto gli stessi nomi esportati di 2.1**, così `lesson.ts` resta byte-per-byte invariato — sono diventati una **union discriminata su `kind`** chiusa a esattamente tre tipi (`single-select`/`select-span`/`assemble`), ciascuno con la forma dei propri dati e derivato da **una sola definizione** (tipo inferito + validatore, AC1). Un `kind` fuori dai tre è un **errore di validazione dello schema**, localizzato sul path del discriminante, non un caso ignorato a runtime. Il kit di schema puro è stato esteso con `literal()` e `discriminatedUnion()`. Ogni tipo porta una funzione **pura e totale** `check(exercise, response): CheckOutcome` che dice **solo** la correttezza: single-select ⇒ la scelta coincide con l'unica opzione giusta (AC3); select-span ⇒ i **confini dei segmenti** combaciano (span sugli indici di `alignFurigana()`, mai indici di carattere — AC4); assemble ⇒ la sequenza coincide **nell'ordine** (AC5). Ciò che l'esercizio insegna vive nel campo comune `grammarPoint`, non nel `kind` (AC7). Confini di storia rispettati: nessun `alignFurigana()`/segmentazione (Epic 3), nessun esito SRS `outcomeOf()` (3.2), nessuna identità `uuidv5` (2.3), nessun gate CI su `content/lessons/` (2.6), nessun file di lezione reale (2.7). Storia interamente in-repo: esito `done`, nessuna azione operatore.

**File modificati/creati (uno per riga):**
- `src/domain/schema.ts` — **modifica**: aggiunti i combinatori puri `literal()` (inferisce il letterale, mattone del discriminante) e `discriminatedUnion(discriminant, variants)` (discriminante sconosciuto/non-stringa ⇒ issue sul path del discriminante; altrimenti delega alla variante che valida l'intero oggetto). Nessun `any`.
- `src/domain/exercise.ts` — **modifica**: `exerciseSchema`/`Exercise` ridefiniti come union discriminata chiusa a tre (sotto gli stessi nomi); aggiunti `segmentSpan`/`SegmentSpan`, `CheckOutcome`, `ExerciseResponse` e `check()` puro e totale con guardia di esaustività `never` (AD-22 a compile-time).
- `src/domain/exercise.test.ts` — **riscrittura**: union + `check` dei tre tipi, tutte le righe della I/O Matrix, ordine di `assemble` (prefisso più lungo incluso), totalità su `kind` sbagliato, ortogonalità `grammarPoint`/`kind`, narrowing; blocchi `check` resi non-vacui (unwrap-or-throw).
- `src/domain/lesson.test.ts` — **modifica fixture**: `validExercise` reso una variante `single-select` valida (`grammarPoint` + `distractors`); prova che `parseLesson` e la derivazione dell'id restano verdi con `lesson.ts` invariato.
- `src/domain/schema.test.ts` — **modifica**: test di `literal` e `discriminatedUnion` (delega, discriminante sconosciuto/non-stringa, non-object, propagazione del path annidato).
- `src/domain/exercise-purity.test.ts` — **nuovo**: sonda su sorgente — nessun `Math.random` sotto `src/domain/` (AC6), con guardia anti-vacuità sui file attesi.

**Findings di review:** 3 patch applicati (tutti low: guardia di esaustività `never`, test del prefisso più lungo di `assemble`, blocchi `check` non-vacui), 0 intent_gap, 0 bad_spec, 0 deferiti, 12 rifiutati (vedi Review Triage Log).

**Follow-up review recommendation: false.** Patch di questa passata: high 0, medium 0, low 3. Punteggio `3×medium + 1×low = 0 + 3 = 3 < 5` e nessun high ⇒ `false`.

**Verifica eseguita (tutta verde, rieseguita dopo i patch):** `npm run typecheck` (`tsc` strict, nessun `any`; la guardia `never` compila ⇒ la union è esattamente i tre `kind`), `npm run lint` (0 errori; i file di dominio non violano `boundaries/external` né `no-restricted-globals`), `npm test` (**328 test su 35 file**, +1 per il test del prefisso più lungo; sonde di 1.1–2.1 senza regressioni), `npm run build` (`dist/` prodotto). Matrix Test Audit: tutte le 12 righe della I/O Matrix coperte da test che girano e passano.

**Rischi residui.** Nessuno di rilievo per lo scopo di 2.2. La verifica che gli indici di uno span `select-span` cadano dentro i segmenti reali richiede `alignFurigana()` (Epic 3) ed è controllo di contenuto in **2.6**; l'esito SRS (`again`/`hard`/`good`/`easy`) è **3.2**. L'avviso di build «chunks > 500 kB» è preesistente e non correlato (codice di dominio a impatto trascurabile sul bundle).
