---
title: "Story 2.4: Una lezione può non avere esercizi"
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: 'c4ccae7807011ad04be8999a7808b14fd6d105cb'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Lo schema di 2.1 già ammette `exercises: []` e già impone `grammarPoints` non vuoto — scelta deliberata e in ottica 2.4. Ma nulla nel codice **àncora** le due promesse di FR2.4 alla loro superficie: (1) una lezione **concettuale** — che riorienta il pensiero, senza risposta giusta — è accettata con zero esercizi; (2) proprio **nel caso senza esercizi** i punti grammaticali restano obbligatori, perché alimentano le statistiche di Epic 5. Oggi l'unico test sull'array vuoto riusa una fixture che ha esercizi altrove, e il test «grammarPoints vuoto rifiutato» usa una lezione **con** esercizi: nessuno prova la coppia FR2.4 con una fixture concettuale realistica, e una regressione (`array`→`nonEmptyArray` su `exercises`, o `grammarPoints` reso opzionale) non sarebbe colta come violazione di FR2.4.

**Approach:** Consegnare 2.4 come **hardening del contratto** alla superficie esterna `parseLesson`: un blocco di test dedicato a FR2.4 con una fixture di lezione concettuale realistica (zero esercizi, punti grammaticali dichiarati) che prova AC1 (accettazione + tipo `Lesson`) e AC2 (grammarPoints dichiarati e preservati; e obbligatori proprio senza esercizi — grammarPoints vuoto/assente ⇒ rifiuto localizzato). Toccare `lesson.ts` **solo** nel commento, per attribuire a FR2.4 la scelta «`exercises` vuoto ammesso, `grammarPoints` obbligatorio» — nessun cambio di comportamento.

## Boundaries & Constraints

**Always:**
- Le AC sono osservate alla superficie **esterna** `parseLesson(input: unknown): ParseResult<Lesson>` — la stessa che l'intento nomina («lo schema la accetta e la validazione passa»), mai un proxy interno.
- **AC1** — una fixture di lezione concettuale (riorienta il pensiero, nessuna risposta giusta) con `exercises: []`, `order ≥ 1`, `title` non vuoto e ≥1 `grammarPoints` non vuoto ⇒ `parseLesson` ritorna `ok: true`, `value.exercises` è `[]`, e il valore è **assegnabile a `Lesson`** (prova di tipo a compile-time: `const l: Lesson = result.value`).
- **AC2** — la stessa lezione senza esercizi **dichiara** i grammarPoints: `value.grammarPoints` è non vuoto e uguale all'input. E i punti grammaticali restano **obbligatori proprio senza esercizi**: una lezione con `exercises: []` e `grammarPoints: []` — e una con la chiave `grammarPoints` **assente** — è **rifiutata** con un issue sul path `grammarPoints`.
- La fixture usa contenuto giapponese realistico e coerente (un punto grammaticale concettuale plausibile); nessun valore segnaposto.
- Il commento di `lessonSchema` in `lesson.ts` cita esplicitamente **FR2.4** come proprietario della scelta «`exercises` array possibilmente vuoto (chiave obbligatoria) + `grammarPoints` `nonEmptyArray` obbligatorio», senza modificarne il comportamento.
- TypeScript strict, **nessun `any`**. Dominio puro (AD-1): il test non introduce import oltre `vitest` e i moduli di dominio, come l'attuale `lesson.test.ts`.

**Block If:**
- _Nessun blocco._ Storia interamente in-repo (dominio puro + test): nessuna azione umana né vendor. Esito atteso `done`.

**Never:**
- **Non** cambiare il comportamento dello schema: `exercises` resta `array(exerciseSchema)` (chiave **obbligatoria**, array vuoto ammesso) — **non** renderlo `optional`/con default (introdurrebbe `exercises?: Exercise[] | undefined`, complicando i consumatori di Epic 3), **non** renderlo `nonEmptyArray`. `grammarPoints` resta `nonEmptyArray(nonEmptyString())`.
- **Non** creare file reali in `content/lessons/` (è 2.7), **non** implementare il gate CI su `content/lessons/` (è 2.6), **non** implementare statistiche/aggregazioni per grammar point (è Epic 5), **non** implementare lo sblocco di una lezione senza esercizi (è Epic 3, story 3-14).
- **Non** introdurre superfici API senza consumatore (es. `lessonTeaches()`/`lessonHasExercises()`): i punti grammaticali sono già `lesson.grammarPoints`.
- **Non** aggiungere una coerenza «`exercise.grammarPoint` ⊆ `lesson.grammarPoints`»: fuori dalle AC di 2.4 e territorio del gate di 2.6.
- **Non** toccare `exercise.ts`/`schema.ts`/`uuid.ts`/`exercise-identity.ts`; **non** toccare `deriveLessonId`/`lessonId`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| lezione concettuale senza esercizi | `{order:5, title, grammarPoints:[gp], exercises:[]}` valido | `parseLesson` ⇒ `ok:true`, `value.exercises === []`, `value` assegnabile a `Lesson` (AC1) | n/a |
| i grammarPoints restano dichiarati | stessa lezione senza esercizi, dopo il parse | `value.grammarPoints` non vuoto e uguale all'input (AC2) | n/a |
| senza esercizi, grammarPoints vuoto | `{…, exercises:[], grammarPoints:[]}` | `ok:false`, issue con path `grammarPoints` (AC2) | rifiuto localizzato |
| senza esercizi, grammarPoints assente | `{order, title, exercises:[]}` (nessun `grammarPoints`) | `ok:false`, issue con path `grammarPoints` (AC2) | rifiuto localizzato |

</intent-contract>

## Code Map

- `src/domain/lesson.ts` — **RIFERIMENTO + micro-modifica al solo commento.** `lessonSchema` (righe 26-41): `grammarPoints: nonEmptyArray(nonEmptyString())` (riga 39) ed `exercises: array(exerciseSchema)` (riga 40, chiave **obbligatoria**, vuoto ammesso). `parseLesson` (righe 52-54) è la superficie esterna delle AC. Il commento righe 18-25 documenta già «ZERO o più» ma attribuisce la scelta a «(AC2)» di 2.1: aggiungere il riferimento esplicito a **FR2.4** senza toccare il codice.
- `src/domain/lesson.test.ts` — **MODIFICA.** Aggiungere un `describe('FR2.4 — una lezione può non avere esercizi')` con la fixture concettuale e i quattro casi della matrice. Fixture **inline** (nessun file reale, è 2.7). Riusa il pattern esistente `parseLesson(...)` + `if (result.ok) { const lesson: Lesson = result.value }` (righe 23-41) e l'assert sul path degli issue (`i.path.join('.') === 'grammarPoints'`, righe 52-58).
- `src/domain/schema.ts` — **RIFERIMENTO (non modificare).** `array()` (152-174) accetta l'array vuoto; `nonEmptyArray()` (177-179) impone ≥1; `object()` (269-296) rende ogni chiave **obbligatoria** salvo `optional()` — perciò `grammarPoints` assente ⇒ `array().parse(undefined)` fallisce con issue sul path `grammarPoints`.
- `src/domain/exercise.ts` — **RIFERIMENTO (non modificare).** Ogni esercizio porta `grammarPoint` **singolo** (righe 81/97/111), distinto dai `grammarPoints` di lezione: senza esercizi i punti insegnati vivono SOLO su `lesson.grammarPoints` — la ragione di AC2.
- `src/domain/exercise-purity.test.ts` — **RIFERIMENTO.** `lesson.ts` è già nell'elenco anti-vacuità (righe 56-63); 2.4 non aggiunge sorgenti di dominio, quindi nessuna modifica.

## Tasks & Acceptance

**Execution:**
- `src/domain/lesson.test.ts` — aggiungere il blocco `FR2.4` con la fixture concettuale (`exercises: []`) e i quattro casi della matrice: AC1 (accettazione + prova di tipo `Lesson` con `exercises` vuoto); AC2 (grammarPoints dichiarati e preservati); rifiuto con `grammarPoints: []` sul path `grammarPoints`; rifiuto con `grammarPoints` assente sul path `grammarPoints`.
- `src/domain/lesson.ts` — aggiornare **solo** il commento di `lessonSchema` per attribuire a **FR2.4** la scelta «`exercises` vuoto ammesso, `grammarPoints` obbligatorio». Nessun cambio di comportamento, nessun cambio di firma.

**Acceptance Criteria:**
- Given una lezione concettuale che riorienta il pensiero senza risposta giusta, when descritta con `exercises: []` e validata da `parseLesson`, then l'esito è `ok: true` e il valore è un `Lesson` valido con `exercises` vuoto (FR2.4, AC1 d'epica).
- Given una lezione senza esercizi, when ispezionata dopo il parse, then `grammarPoints` è dichiarato (non vuoto) e preservato invariato (FR2.4, AC2 d'epica; dipendenza statistiche Epic 5).
- Given una lezione **senza esercizi** con `grammarPoints` vuoto **o** assente, when validata, then l'esito è `ok: false` con un issue localizzato sul path `grammarPoints` — i punti grammaticali restano obbligatori proprio nel caso senza esercizi.
- Given lo schema, when 2.4 è consegnata, then `exercises` resta chiave obbligatoria con array possibilmente vuoto (né `optional` né `nonEmptyArray`) e `grammarPoints` resta `nonEmptyArray`; nessun file in `content/lessons/`, nessun gate CI, nessuna statistica introdotti; `exercise.ts`/`schema.ts` invariati.
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano senza regressioni e senza alcun `any`.

## Spec Change Log

_Nessun loopback `bad_spec`: `<intent-contract>` invariato._

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 1, low 2)
- defer: 0
- reject: 11: (high 0, medium 0, low 11)
- addressed_findings:
  - `[medium]` `[patch]` **mancava il test simmetrico «`exercises` ASSENTE»**: la suite provava l'array vuoto e il grammarPoints assente, ma non che OMETTERE del tutto `exercises` fosse rifiutato — proprio la decisione «chiave OBBLIGATORIA, mai `optional`» che il commento di `lesson.ts` rende portante (Epic 3 riceve sempre `Exercise[]`, mai `undefined`). Aggiunto il test «rifiuta la lezione con la chiave exercises ASSENTE», con asserzione forte sul path esatto `['exercises']`: àncora runtime contro una regressione a `optional`.
  - `[low]` `[patch]` **asserzioni negative troppo deboli (`.some`)**: i due test negativi su grammarPoints usavano `issues.some(i => i.path === 'grammarPoints')`, mentre il file usa già la forma forte `toEqual` (riga ~99). Portati a `expect(bad.issues.map(i => i.path.join('.'))).toEqual(['grammarPoints'])` — poiché solo grammarPoints è malformato, l'asserzione attribuisce con precisione il fallimento e coglie uno schema che segnalasse altri campi. Stessa forma applicata al nuovo test di `exercises` ASSENTE.
  - `[low]` `[patch]` **il commento di AC1 sovradichiarava la prova di tipo**: affermava che `const lesson: Lesson = result.value` prova «exercises resta Exercise[], mai undefined», ma quell'assegnazione prova solo la CONFORMITÀ a `Lesson` e NON coglie a livello di tipo una regressione a `optional`. Commento riscritto onestamente: l'assegnazione prova la conformità a compile-time; la garanzia runtime della chiave obbligatoria è ancorata dal nuovo test «exercises ASSENTE».

Findings rifiutati (11, tutti low; rappresentativi): «manca il test di `exercises` non-array (null/{}/stringa)» — è comportamento generico di `array()`, coperto in `schema.test.ts` e fuori dalle due AC di 2.4; «manca `grammarPoints: ['']` nel caso senza esercizi» — il refinement `nonEmptyString` è indipendente dagli esercizi, già coperto a riga 95; «`order: 5` arbitrario, non asserito» — cosmetico, `order` è fuori dalle AC; «i due test riparsano la stessa fixture» — la separazione AC1/AC2 è deliberata e più leggibile; «asserire zero issue sul successo» — su `ok: true` il tipo `ParseResult` non porta il campo `issues`; «il cross-ref del commento a `FR2.4` può marcire» — pointer d'aiuto, non contratto; «redance con i test di 2.1 non dichiarata» — il blocco è esplicitamente etichettato `FR2.4` con fixture concettuale distinta; «il commento di design non cita AC/FR dei consumatori Epic 3/5» — quei consumatori non esistono ancora, il commento già nomina FR2.4/Epic 3/Epic 5/2.1; «typo `infersce`» — pre-esistente (riga 24), non causato da questa storia; «validazione elemento array / order-title sotto il ramo senza esercizi» — già coperte e indipendenti dalla presenza di esercizi. Nessun `defer`: nessun problema pre-esistente reale è emerso.

### 2026-09-24 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 11: (high 0, medium 0, low 11)
- addressed_findings:
  - none

Passata di follow-up (triggerata dal re-invio su spec `done`). Quattro layer in parallelo su Opus: Edge-Case Hunter (nessun finding — tutti i path della matrice sono `if (result.ok)`/`if (!bad.ok)`-guardati e risolvono contro `object`/`array`/`nonEmptyArray`); Verification-Gap (nessun gap — ha rieseguito `npm test` 20/20, `typecheck`, `lint` puliti, e ha tracciato ogni asserzione contro `schema.ts`); Intent-Alignment (il diff implementa la lettura più forte, hardening + ancora runtime «chiave `exercises` obbligatoria»; nessuna under-delivery, nessun boundary violato). I 12 finding del Blind Hunter — dopo dedup dei due «`exercises` non-array» → 11 distinti — sono tutti reject/low: comportamento generico di `array()` fuori dalle 2 AC (già respinto nella prima passata), stile/verbosità del commento JSDoc, ridondanze deliberate che rispecchiano il testo bipartito di AC2 (`toBeGreaterThan(0)` + `toEqual`), fixture inline «assente» volutamente esplicite (nessun accoppiamento di correttezza con `conceptualLesson`), casi multi-issue/`lessonId`/element-malformato già coperti o territorio di altre storie, e `expectTypeOf` reso ridondanto dal fatto che `Lesson` è `Infer<typeof lessonSchema>` (il tipo segue lo schema, e la chiave obbligatoria è già ancorata a runtime dal test «exercises ASSENTE»). Nessun `patch`/`bad_spec`/`intent_gap`/`defer`.

## Design Notes

**Perché una storia di hardening e non di schema.** 2.1 ha già scelto — deliberatamente e in ottica 2.4 — `exercises: array(...)` (chiave obbligatoria, vuoto ammesso) e `grammarPoints: nonEmptyArray(...)`. La capacità c'è; manca la **prova ancorata** delle due promesse FR2.4 alla superficie `parseLesson`, con una fixture concettuale realistica, così che una futura regressione (rendere `exercises` obbligatoriamente non vuoto, o `grammarPoints` opzionale) sia colta come violazione di **FR2.4**, non solo come rottura incidentale di un test di 2.1.

**Perché `exercises` resta obbligatorio-ma-vuoto, non `optional`.** `optional` cambierebbe il tipo prodotto in `exercises?: Exercise[] | undefined`, costringendo Epic 3 a `lesson.exercises ?? []` ovunque. Chiave obbligatoria con array vuoto garantisce ai consumatori un `Exercise[]` sempre presente e rende **esplicita** la dichiarazione autoriale di «zero esercizi», invece di un campo dimenticato.

**Perché i grammarPoints sono la clausola portante di AC2.** Un esercizio porta `grammarPoint` singolo; una lezione senza esercizi non ha esercizi da cui derivare i punti insegnati. L'unica sede resta `lesson.grammarPoints`, che perciò deve restare obbligatorio proprio nel caso senza esercizi — è ciò che alimenta le statistiche di Epic 5 quando altre lezioni riprendono quei punti.

Fixture concettuale (golden example):

```ts
// Una lezione che riorienta il pensiero, senza risposta giusta: zero esercizi,
// ma dichiara comunque il punto grammaticale che insegna (AC1 + AC2).
const conceptualLesson = {
  order: 5,
  title: '日本語に未来形はない',
  grammarPoints: ['非過去形は現在と未来をともに表す'],
  exercises: [],
};
```

## Verification

**Commands:**
- `npm run typecheck` — expected: `tsc` strict, nessun `any`; `const lesson: Lesson = result.value` compila (prova di tipo del caso zero-esercizi).
- `npm run lint` — expected: 0 errori; il file di test non viola `boundaries/external` né `no-restricted-globals`.
- `npm test` — expected: il blocco `FR2.4` di `lesson.test.ts` passa (quattro casi), più le sonde 1.1–2.3 senza regressioni.
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori.

## Auto Run Result

Status: done

**Sintesi del cambiamento.** Story 2.4 consegnata come *hardening del contratto* alla superficie esterna `parseLesson`: un blocco di test `describe('FR2.4 — una lezione può non avere esercizi')` con una fixture concettuale realistica (lezione «il giapponese non ha un tempo futuro»: zero esercizi, un punto grammaticale dichiarato) che ancora AC1 (accettazione + tipizzazione `Lesson` con `exercises` vuoto), AC2 (grammarPoints preservati e obbligatori proprio senza esercizi — vuoto/assente ⇒ rifiuto sul path `grammarPoints`) e la simmetrica «chiave `exercises` obbligatoria» (assente ⇒ rifiuto sul path `exercises`). `lesson.ts` toccato **solo** nel commento JSDoc di `lessonSchema` per attribuire a FR2.4 la coppia di scelte; nessun cambio di comportamento né di firma.

**File cambiati (dalla baseline `c4ccae7`):**
- `src/domain/lesson.test.ts` — +71: nuovo blocco `FR2.4` (5 casi: AC1 accettazione+tipo, AC2 preservazione, rifiuto grammarPoints vuoto/assente, rifiuto exercises assente), asserzioni forti `toEqual([...])` sul set esatto dei path.
- `src/domain/lesson.ts` — +11: commento di `lessonSchema` attribuisce a FR2.4 «`exercises` array obbligatorio-ma-vuoto (mai `optional`/`nonEmptyArray`) + `grammarPoints` `nonEmptyArray` obbligatorio». Solo commento.

**Review findings (passata di follow-up).** patch applicati: 0; deferred: 0; rejected: 11 (tutti low). Quattro layer su Opus: Edge-Case Hunter e Verification-Gap nessun finding; Intent-Alignment nessuna under-delivery/boundary violato; Blind Hunter 12→11 finding (dedup) tutti reject/low (comportamento generico di `array()` fuori dalle AC, stile del commento, ridondanze deliberate, casi già coperti o di altre storie, `expectTypeOf` ridondante col tipo inferito). Nessun `intent_gap`/`bad_spec`, nessun loopback (`review_loop_iteration` invariato a 0).

**Follow-up review recommendation:** `false`. Patch di questa passata per severità: high 0, medium 0, low 0. Score = 3×0 + 1×0 = 0 (< 5) e nessun high ⇒ `false`.

**Verifica eseguita.** `npm test` → 20/20 pass (incluso il blocco FR2.4); `npm run typecheck` → pulito, nessun `any`, `const lesson: Lesson = result.value` compila; `npm run lint` → 0 errori; `npm run build` → `dist/` senza errori. (Il codice è invariato rispetto al commit `bdf54d3`; verifica indipendente ripetuta in questa passata.)

**Rischi residui.** Nessuno rilevante alla superficie di 2.4. La conformità di tipo `const lesson: Lesson = result.value` non coglie da sola una regressione di `exercises` a `optional`; la garanzia runtime è però ancorata dal test «exercises ASSENTE» e il tipo `Lesson` è comunque inferito da `lessonSchema` (segue lo schema). Statistiche per grammar point (Epic 5), gate CI su `content/lessons/` (2.6), file reali di lezione (2.7) e sblocco lezione senza esercizi (Epic 3) restano fuori scope, come da contratto.

