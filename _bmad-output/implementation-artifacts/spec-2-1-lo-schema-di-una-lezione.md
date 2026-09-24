---
title: 'Story 2.1: Lo schema di una lezione'
type: 'feature'
created: '2026-09-24'
status: done
baseline_revision: '0c4cbfe9b306f467b05e2c83e8cea55abe255bbe'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** L'applicazione non ha ancora un contratto per il contenuto: lezioni ed esercizi non hanno una forma dichiarata. Serve una forma **tipizzata e validabile a runtime** in cui contenuto e codice si incontrano, così che una lezione (dato, non codice) possa essere caricata e verificata prima di raggiungere chi la consuma (Epic 3) o chi la produce (Epic 6).

**Approach:** Un piccolo kit di schema **puro** nel dominio (nessuna dipendenza esterna: `AD-1` vieta a `src/domain/` qualsiasi import di pacchetto) da cui **tipo TypeScript e validatore a runtime derivano dalla stessa definizione** — il tipo si inferisce dallo schema (`Infer<S>`), non da un secondo elenco parallelo. Su questo kit si definiscono la forma della frase giapponese (`kanji`/`kana` separati), della spiegazione bilingue, dell'esercizio (forma **base/comune**) e della lezione, più la derivazione dell'identificatore di lezione dal punto grammaticale.

## Boundaries & Constraints

**Always:**
- Tipo e validatore da **una** definizione: lo schema è la fonte, il tipo è `Infer<typeof schema>`. Nessuna coppia tipo-scritto-a-mano + validatore-scritto-a-mano che si possano disallineare (AC1).
- Il dominio resta **puro**: i nuovi file sotto `src/domain/` non importano React, Supabase, `fetch`/storage/orologio, né alcun pacchetto npm (`AD-1`, imposto da `eslint-plugin-boundaries` e `no-restricted-globals`). `String.prototype.normalize('NFKC')` è ammesso (funzione pura del linguaggio).
- Una lezione porta: `order` (intero ≥ 1), `title` (non vuoto), `grammarPoints` (≥ 1, non vuoti) e `exercises` (**zero o più** — l'array vuoto è valido, AC2).
- Un esercizio (forma base) porta: `kind` (stringa non vuota), contenuto giapponese `sentence`, risposta corretta `answer`, `distractors` opzionali, e `explanation` (AC3).
- Ogni frase giapponese espone `kanji` e `kana` come **stringhe separate** e non vuote, perché `AD-21` ne derivi i segmenti (AC4).
- La spiegazione ha `en` **obbligatorio** (non vuoto) e `it` **facoltativo**: è contenuto del file di lezione, non passa da i18n (AC3; il ripiego di visualizzazione è 2.5).
- L'identificatore canonico di una lezione **deriva dal suo punto grammaticale primario** (il primo di `grammarPoints`) via `deriveLessonId`, e **non** dipende da `order`, `title` né da alcuna numerazione/ordine di una fonte esterna (AC5, FR2.1a).
- Il validatore raccoglie gli errori come lista di `{ path, message }` (non lancia): `path` localizza il campo malformato, così 2.6 potrà riferirlo in CI.

**Block If:**
- _Nessun blocco._ Storia interamente in-repo (codice di dominio puro + test): nessuna azione umana o vendor. Esito atteso `done`.

**Never:**
- **Non** chiudere il registro dei tipi di esercizio né aggiungere i validatori `check()`: la union discriminata chiusa a `single-select`/`select-span`/`assemble` e i validatori sono **storia 2.2**. Qui `kind` è una stringa non vuota; 2.2 la stringe ai tre letterali.
- **Non** calcolare l'identità dell'esercizio (`uuidv5`): è **storia 2.3**.
- **Non** implementare il gate di validazione in CI su `content/lessons/`: è **storia 2.6**. Qui si consegna solo `parseLesson`.
- **Non** creare file di lezione reali in `content/lessons/`: la lezione campione è **storia 2.7**. I test usano fixture inline.
- Nessuna libreria di schema esterna (Zod ecc.): violerebbe `AD-1` nel dominio.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| lezione valida con esercizi | oggetto conforme | `ok: true`, `value` tipizzato `Lesson` | nessun errore |
| lezione senza esercizi | `exercises: []` | `ok: true` (zero o più ammesso, AC2) | nessun errore |
| frase senza kana | esercizio con `sentence.kana` assente/vuoto | `ok: false` | issue con `path` `…sentence.kana` |
| spiegazione senza inglese | `explanation.en` assente/vuoto | `ok: false` | issue con `path` `…explanation.en` |
| grammarPoints vuoto | `grammarPoints: []` | `ok: false` | issue con `path` `grammarPoints` |
| order non valido | `order: 1.5` o `"1"` o `0` | `ok: false` | issue con `path` `order` |
| tipo sbagliato annidato | `exercises[1].kind` numero | `ok: false` | issue con `path` `exercises.1.kind` |
| id da punto grammaticale | due lezioni con stesso `grammarPoints[0]`, `order`/`title` diversi | `deriveLessonId` **identico** | n/a |
| id cambia con la grammatica | `grammarPoints[0]` modificato | `deriveLessonId` **diverso** | n/a |

</intent-contract>

## Code Map

- `src/domain/schema.ts` — **NUOVO**: il kit di schema puro. Esporta `Schema<T>`, `Infer<S>`, `ParseResult<T>` (`{ readonly ok: true; value: T } | { readonly ok: false; issues: SchemaIssue[] }`, stessa convenzione di `src/features/auth/authOutcome.ts`), `SchemaIssue` (`{ path: (string|number)[]; message: string }`), e i combinatori `string()`, `number()`, `object()`, `array()`, `optional()`, `refine()` più gli helper `nonEmptyString()`, `nonEmptyArray()`, `integer()`. `object()` inferisce le chiavi opzionali (quelle il cui `Infer` include `undefined`) come `?`. Nessun `any`.
- `src/domain/exercise.ts` — **NUOVO**: value object del contenuto e forma **base** dell'esercizio. `japaneseSentence` → `{ kanji: string; kana: string }` (AC4); `explanation` → `{ en: string; it?: string }` (AC3); `exerciseSchema` base → `{ kind; sentence; answer; distractors?; explanation }` (AC3). Esporta i tipi `JapaneseSentence`, `Explanation`, `Exercise` via `Infer`. 2.2 ridefinisce `exerciseSchema`/`Exercise` come union discriminata **sotto lo stesso nome**, così `lesson.ts` non cambia.
- `src/domain/lesson.ts` — **NUOVO**: `lessonSchema` (AC2) + `type Lesson = Infer<...>`; `parseLesson(input: unknown): ParseResult<Lesson>`; `deriveLessonId(grammarPoint: string): string` (slug NFKC→lowercase→non-alfanumerico in `-`→collasso→trim) e `lessonId(lesson: Lesson): string = deriveLessonId(lesson.grammarPoints[0])` (AC5).
- `src/domain/scaffold.ts` — **RIFERIMENTO**: modello di file di dominio puro (intestazione, JSDoc, nessuna dipendenza).
- `eslint.config.js` — **RIFERIMENTO** (non modificare): `boundaries/external` vieta al dominio ogni import esterno; `no-restricted-globals` vieta `fetch`/storage. I `*.test.ts` sono fuori dallo scope dei confini.
- `src/domain/scaffold.test.ts` — **RIFERIMENTO**: forma dei test (vitest `describe/it/expect`, import relativo).

## Tasks & Acceptance

**Execution:**
- `src/domain/schema.ts` — creare il kit puro: `Schema<T>`/`Infer<S>`/`ParseResult`/`SchemaIssue` + combinatori e helper sopra elencati; `object()` produce chiavi opzionali da `optional()`; gli issue propagano il `path` annidato.
- `src/domain/exercise.ts` — creare `japaneseSentence`, `explanation`, `exerciseSchema` base e i tipi inferiti.
- `src/domain/lesson.ts` — creare `lessonSchema`, `Lesson`, `parseLesson`, `deriveLessonId`, `lessonId`.
- `src/domain/schema.test.ts` — testare il kit: parse valido, tipo sbagliato con `path`, `array`, `optional` (chiave assente ok / presente-ma-errata no), `refine`/`nonEmptyString`, propagazione del `path` annidato.
- `src/domain/exercise.test.ts` — testare le righe di matrice su frase (kanji+kana obbligatori) ed esplicazione (`en` obbligatorio, `it` opzionale) e la forma base dell'esercizio (happy + malformati).
- `src/domain/lesson.test.ts` — testare `parseLesson` (happy con e senza esercizi; malformati: `title` vuoto, `grammarPoints` vuoto, `order` non intero, tipo annidato errato con `path`) e `deriveLessonId`/`lessonId` nelle due direzioni di AC5.

**Acceptance Criteria:**
- Given lo schema di lezione, when lo si definisce, then il tipo `Lesson` è `Infer<typeof lessonSchema>` (una sola definizione), e `parseLesson` valida a runtime a partire dalla stessa definizione — non da un secondo elenco parallelo (AC1).
- Given una lezione, when viene validata, then `parseLesson` accetta `order` intero ≥ 1, `title` non vuoto, `grammarPoints` ≥ 1 ed `exercises` da **zero** in su, e rifiuta con un issue localizzato dal `path` ogni violazione (AC2).
- Given un esercizio, when viene validato, then porta `kind`, `sentence`, `answer`, `distractors` opzionali e `explanation`; una frase giapponese espone `kanji` e `kana` separati e non vuoti; `explanation.en` è obbligatorio e `explanation.it` facoltativo (AC3, AC4).
- Given due lezioni con lo stesso punto grammaticale primario ma `order`/`title` diversi, when se ne ricava l'identificatore, then `deriveLessonId` è **identico**; e cambiando il punto grammaticale l'identificatore **cambia** — l'id non riproduce numerazione/ordine di una fonte esterna (AC5, FR2.1a).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano senza regressioni: i nuovi file di dominio non violano `AD-1` (nessun import esterno, nessun global vietato) e non introducono `any`.

## Design Notes

**Perché un kit di schema fatto in casa e non Zod.** `AD-1` (imposto in CI da `boundaries/external: { from: ['domain'], disallow: ['*', '@*/*'] }`) vieta al dominio **ogni** import di pacchetto. La fonte unica tipo⇄validatore va quindi costruita con TypeScript puro: si scrive lo schema una volta e il tipo si **inferisce**. Esempio del principio (single source):

```ts
const explanation = object({ en: nonEmptyString(), it: optional(nonEmptyString()) });
export type Explanation = Infer<typeof explanation>; // { en: string; it?: string }
```

Un tipo scritto a mano accanto a un validatore scritto a mano sarebbero «due elenchi paralleli» — proprio ciò che AC1 vieta.

**Perché la forma base dell'esercizio, non la union.** L'epica separa deliberatamente 2.1 (lo schema) da 2.2 (i tre tipi + `check()`). Qui `exerciseSchema` è il **contratto comune** su cui la lezione si regge; 2.2 lo ridefinisce come union discriminata chiusa **con lo stesso nome esportato**, specializzando `answer`/`distractors` per tipo e aggiungendo i validatori. Non è provvisorietà per errore: è il confine di storia. `answer` base è `nonEmptyString()`; 2.2 potrà specializzarlo (es. sequenza di tessere per `assemble`).

**Perché l'id si deriva e non si memorizza.** Derivare l'identificatore dal punto grammaticale (come `AD-23` fa per l'esercizio) rende **impossibile** violarlo autorando l'id da un numero di episodio della fonte. `deriveLessonId` dipende **solo** dal punto grammaticale primario, mai da `order`/`title`: è la garanzia meccanica di FR2.1a. Il primo di `grammarPoints` è il punto primario che dà identità; l'unicità fra lezioni è una verifica di contenuto (2.6), non di forma.

## Verification

**Commands:**
- `npm run lint` — expected: 0 errori; i nuovi file di dominio non violano `boundaries/external` né `no-restricted-globals`.
- `npm run typecheck` — expected: `tsc` strict senza errori, nessun `any`; `Infer` produce i tipi attesi (le chiavi `optional` sono `?`).
- `npm test` — expected: `schema.test.ts` + `exercise.test.ts` + `lesson.test.ts` verdi (tutte le righe della I/O Matrix), più le sonde di 1.1–1.5 senza regressioni.
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori.

## Spec Change Log

_Nessun loopback `bad_spec` in questa run: `<intent-contract>` invariato._

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 0, low 4)
- defer: 0
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[low]` `[patch]` **`deriveLessonId` poteva restituire `""`**: un punto grammaticale di sola punteggiatura (es. `"---"`, `"・・・"`) passa `nonEmptyString()` ma il suo slug è vuoto — un id vuoto è una collisione d'identità silenziosa (romperebbe l'unicità di 2.6). Reso TOTALE: ripiego su una codifica esadecimale deterministica dei code point NFKC (prefisso `u-`), iniettiva (input diversi ⇒ id diversi). +2 test.
  - `[low]` `[patch]` **`object()` «raccoglie TUTTI gli errori» non testato**: il docstring lo promette ma nessun test passava due chiavi malformate insieme. Aggiunto un test che asserisce 2 issue con i rispettivi path (sollevato anche dal verification-gap).
  - `[low]` `[patch]` **`number()` `-Infinity` non testato**: il docstring esclude NaN/Infinity ma solo `+Infinity` era coperto. Aggiunta l'asserzione su `Number.NEGATIVE_INFINITY`.
  - `[low]` `[patch]` **AC5 — clausola del titolo implicita** (intent-alignment): il diff derivava l'id ma lasciava il titolo prosa libera senza dichiarare *perché*. Aggiunto un commento in `lesson.ts` che rende esplicita la divisione: il titolo è prosa autorata la cui indipendenza dalla fonte esterna è imposta dalla **revisione umana obbligatoria** (FR11.2), mentre l'**identificatore** è la superficie d'identità meccanica che ignora dimostrabilmente il titolo (test «id IDENTICO… title diversi»). Nessun cambio di comportamento.

Findings rifiutati (rappresentativi): «chiudere `kind` ai tre letterali / registro dei tipi» — è esplicitamente **storia 2.2** sull'autorità dell'intento (scope note), non un difetto di 2.1; «`refine()` potrebbe lanciare se il predicato lancia» e «`lessonId` con un `Lesson` non parsato ha `grammarPoints[0]` undefined» — nessun trigger realistico: i predicati usati sono funzioni totali e `lessonId` è tipizzato su `Lesson` (parsato), un uso con dati grezzi è errore di programmazione fuori dal contratto; «test di prototype-pollution (`__proto__`)» — `object()` costruisce un oggetto piano iterando solo le chiavi dello `shape`, l'input non muta il prototipo, e il contenuto è dato versionato e human-reviewed; «test di idempotenza / lettere accentate / messaggi di `typeName` / stile di asserzione posizionale vs `some()` / `exercises` non-array a livello lezione / path annidato di `refine` / grammarPoint duplicati» — coperti transitivamente (es. `array()` non-array già testato) o nitpick di copertura su comportamento già corretto e senza consumatore. Nessun `defer`: nessun problema pre-esistente reale è emerso.

## Auto Run Result

Status: done

**Sommario.** Lezioni ed esercizi hanno finalmente una **forma dichiarata e tipizzata**, dove contenuto e codice si incontrano su un contratto. Un kit di schema **puro** nel dominio (`src/domain/schema.ts`) — nessuna dipendenza esterna, perché `AD-1` vieta al dominio ogni import di pacchetto — realizza la fonte **unica** tipo⇄validatore: si scrive lo schema una volta e il tipo si **inferisce** (`Infer<typeof schema>`), mai da un secondo elenco parallelo (AC1). Su questo kit vivono i value object del contenuto (`japaneseSentence` con `kanji`/`kana` separati non vuoti — AC4; `explanation` con `en` obbligatorio e `it` facoltativo — AC3), la forma **base** dell'esercizio (`exerciseSchema`: `kind`, `sentence`, `answer`, `distractors?`, `explanation` — AC3), lo schema della lezione (`order` intero ≥ 1, `title` non vuoto, `grammarPoints` ≥ 1, `exercises` **zero o più** — AC2) e `parseLesson`. L'**identificatore** di una lezione si **deriva** dal punto grammaticale primario (`deriveLessonId`/`lessonId`) — mai da `order`/`title` né da numerazione di una fonte esterna (AC5, FR2.1a) — ed è totale (mai stringa vuota). Confini di storia rispettati: nessuna union chiusa a tre tipi né `check()` (2.2), nessuna identità `uuidv5` (2.3), nessun gate CI su `content/lessons/` (2.6), nessun file di lezione reale (2.7). Storia interamente in-repo: esito `done`, nessuna azione operatore.

**File creati (uno per riga):**
- `src/domain/schema.ts` — **nuovo**: il kit di schema puro (`Schema<T>`, `Infer<S>`, `ParseResult`/`SchemaIssue`, combinatori `string`/`number`/`boolean`/`object`/`array`/`optional`/`refine` + helper `nonEmptyString`/`nonEmptyArray`/`integer`); `object()` inferisce le chiavi `optional` come `?`; gli issue propagano il `path` annidato; nessun `any`.
- `src/domain/exercise.ts` — **nuovo**: `japaneseSentence`, `explanation`, `exerciseSchema` base e i tipi inferiti `JapaneseSentence`/`Explanation`/`Exercise` (2.2 li ridefinisce come union sotto lo stesso nome).
- `src/domain/lesson.ts` — **nuovo**: `lessonSchema`, `Lesson`, `parseLesson`, `deriveLessonId` (totale), `lessonId`; commento esplicito sulla risoluzione della clausola del titolo di AC5.
- `src/domain/schema.test.ts` — **nuovo**: 16 test del kit (primitivi, `refine`/helper, `array`/multi-errore, `optional` assente/presente/errato, `object` non-object/chiavi-extra/path-annidato/multi-errore, inferenza delle chiavi `optional`, `-Infinity`).
- `src/domain/exercise.test.ts` — **nuovo**: 15 test (frase kanji+kana, spiegazione `en`/`it`, forma base con e senza `distractors`, path annidati).
- `src/domain/lesson.test.ts` — **nuovo**: 15 test (`parseLesson` happy con/senza esercizi; malformati con `path` localizzato; `deriveLessonId`/`lessonId` nelle due direzioni di AC5 + totalità sul caso di sola punteggiatura).
- `_bmad-output/implementation-artifacts/epic-2-context.md` — **nuovo**: contesto d'epica compilato (caricato come `context:` dello spec).
- `_bmad-output/implementation-artifacts/spec-2-1-...md` — questo spec: triage, Auto Run Result, `status: done`.

**Findings di review:** 4 patch applicati (tutti low: `deriveLessonId` totale, copertura multi-errore di `object()`, `-Infinity`, commento AC5 sul titolo), 0 intent_gap, 0 bad_spec, 0 deferiti, 13 rifiutati (vedi Review Triage Log).

**Follow-up review recommendation: false.** Patch di questa passata: high 0, medium 0, low 4. Punteggio `3×medium + 1×low = 0 + 4 = 4 < 5` e nessun high ⇒ `false`.

**Verifica eseguita (tutta verde, rieseguita dopo i patch):** `npm run typecheck` (`tsc` strict, nessun `any`), `npm run lint` (0 errori; i nuovi file di dominio non violano `boundaries/external` né `no-restricted-globals` — validato dalla sonda di `boundaries.test.ts` sull'albero reale), `npm test` (**300 test su 34 file**: 16 + 15 + 15 nei tre file nuovi, più le sonde di 1.1–1.5 senza regressioni), `npm run build` (`tsc --noEmit` + `vite build` producono `dist/`). Matrix Test Audit: tutte e 9 le righe della I/O Matrix coperte da test che girano e passano.

**Rischi residui.** Nessuno di rilievo per lo scopo di 2.1. Il registro dei tipi resta aperto (`kind` è una stringa non vuota) fino a 2.2 che lo chiude ai tre letterali con i validatori `check()`; l'identità `uuidv5` dell'esercizio è 2.3; la validazione bloccante in CI su `content/lessons/` è 2.6; la prima lezione reale/fixture è 2.7. L'avviso di build «chunks > 500 kB» è preesistente e non correlato a questa storia (codice di dominio a impatto trascurabile sul bundle).
