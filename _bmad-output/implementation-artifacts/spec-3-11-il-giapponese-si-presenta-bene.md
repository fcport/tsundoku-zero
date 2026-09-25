---
title: 'Story 3.11: Il giapponese si presenta bene'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_revision: '9a5ba59106ddb1a86c75ab3ba286b42dfc363d0f'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Il dominio allinea la furigana (`alignFurigana()`, 3.6) ma nessuna superficie la RENDE: manca il componente che trasforma i segmenti in `<ruby>`/`<rt>` accessibile, con `lang="ja"`, `<rt>` `aria-hidden` e senza romaji. Manca inoltre il campo con cui un esercizio dichiara se mostrare la furigana (predefinito visibile). Senza questi, le schermate della sessione (3.18+) non hanno come mostrare una frase giapponese leggibile.

**Approach:** Un componente presentazionale puro in `src/ui/` che riceve segmenti già allineati e li rende in ruby accessibile; e un campo additivo `showFurigana` sui tre tipi di esercizio nel dominio, con una sola definizione del predefinito *visibile* (`furiganaVisible`). Il componente onora la visibilità; l'allineamento resta nel dominio.

## Boundaries & Constraints

**Always:**
- Il componente vive in `src/ui/` e **non** importa `domain` (AD-1, imposto in CI: `ui → ['ui','i18n']`). Dichiara il proprio tipo strutturale `RubySegment` (`{ readonly text: string; readonly ruby: string | null }`), identico a `FuriganaSegment`: l'output di `alignFurigana()` vi fluisce per COMPATIBILITÀ STRUTTURALE, senza dipendenza nominale.
- Rende SOLO i segmenti ricevuti, verbatim: nessuna logica di allineamento (AD-21 vive in `src/domain/furigana.ts`). Un segmento con `ruby` non-null ⇒ `<ruby>{text}<rp>(</rp><rt aria-hidden="true">{ruby}</rt><rp>)</rp></ruby>`; `ruby === null` ⇒ solo `{text}`.
- Il nodo che avvolge il giapponese porta `lang="ja"` (AD-14/UX-DR24: il giapponese è DATO, non passa da i18n). `<rt>` è `aria-hidden="true"` (UX-DR28), con `<rp>` di ripiego attorno al `<rt>`.
- Nessun romaji in alcun ramo (UX-DR25): la lettura resa è la kana VERBATIM.
- `showFurigana` è un campo di CIASCUNO dei tre tipi di esercizio (`optional(boolean())`), non una regola globale. Il predefinito VISIBILE è definito UNA sola volta da `furiganaVisible(exercise)` (`exercise.showFurigana ?? true`); il componente riceve un `showFurigana: boolean` già risolto e con `false` rende il solo testo base (nessun `<rt>`, ancora `lang="ja"`).
- Solo token del sistema di design se servono classi (regola colore ERROR su `src/ui`).

**Block If:**
- _Nessun blocco._ Additivo su schema, confini e pattern di componente già stabiliti.

**Never:**
- NON importare `domain` da `src/ui/` (violazione AD-1 rossa in CI); NON reimplementare o rieseguire l'allineamento nel componente.
- NON emettere romaji; NON far entrare `showFurigana` nell'identità dell'esercizio (AD-23: `exerciseNaturalKey` enumera `[kind, kanji, kana, answerRepr]` — resta escluso).
- NON propagare `showFurigana` nel `payload` jsonb / nel seed né aggiungere una colonna: il percorso di LETTURA dell'esercizio (sessione) è 3.18/3.19; qui il campo si DICHIARA soltanto. `exercisePayload` (`generate-content-seed.ts`) resta invariato ⇒ il seed committato non si rigenera.
- NON cablare `JapaneseText` in una schermata di produzione: nessuna exercise-card esiste ancora (3.18); il componente è un primitivo provato dal suo test (come `PortsProvider` in 3.10). Nessuna migrazione/tabella/altra modifica di dominio oltre il campo additivo e il resolver.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| segmento con ruby | `{text:'今日',ruby:'きょう'}`, `showFurigana=true` | `<ruby>今日<rp>(</rp><rt aria-hidden="true">きょう</rt><rp>)</rp></ruby>` | nessun errore |
| segmento senza ruby | `{text:'は',ruby:null}`, `showFurigana=true` | testo base `は`, nessun `<ruby>`/`<rt>` | nessun errore |
| furigana nascosta | segmenti con ruby, `showFurigana=false` | solo testo base concatenato, nessun `<ruby>`/`<rt>`; involucro ancora `lang="ja"` | nessun errore |
| involucro | array di segmenti | concatenati nell'ordine dentro un unico nodo con `lang="ja"` | nessun errore |
| lettura verbatim | `{text:'茶',ruby:'ちゃ'}` | `<rt>` contiene esattamente `ちゃ` (kana), nessuna forma romaji | nessun errore |
| resolver assente | esercizio senza `showFurigana` | `furiganaVisible(e) === true` (predefinito visibile) | nessun errore |
| resolver esplicito | esercizio con `showFurigana:false` | `furiganaVisible(e) === false` | nessun errore |
| campo malformato | parse esercizio con `showFurigana:'yes'` | issue di schema sul path `showFurigana` | reject (non degrada) |

</intent-contract>

## Code Map

- `src/domain/furigana.ts:33-36` -- `FuriganaSegment { text; ruby: string｜null }` (l'output di `alignFurigana`, `:74`); il componente ui dichiara un tipo STRUTTURALMENTE identico (`RubySegment`), non lo importa (AD-1).
- `src/domain/exercise.ts:85-120` -- i tre tipi (`singleSelect`/`selectSpan`/`assemble`); **aggiungere** `showFurigana: optional(boolean())` a ciascuno; `:129` `exerciseSchema`, `:140` `Exercise`. **Aggiungere** `furiganaVisible(exercise)` (`?? true`) qui.
- `src/domain/schema.ts:85-94` `boolean()`, `:102-111` `optional()` -- combinatori da RIUSARE; un campo il cui `Infer` include `undefined` diventa chiave `?` (nessun nuovo combinatore).
- `src/domain/exercise-identity.ts:63-70` -- `exerciseNaturalKey` enumera i campi ⇒ `showFurigana` NON entra nell'identità (AC6). ~20 letterali `: Exercise` in `exercise-identity.test.ts` restano validi (campo opzionale, nessuna churn).
- `scripts/generate-content-seed.ts:60-85` -- `exercisePayload` serializza solo `sentence`/`answer`/`distractors` ⇒ `showFurigana` NON nel payload; l'anti-drift `buildSeedSql(reale) === seed committato` (`generate-content-seed.test.ts:321`) resta verde senza rigenerare.
- `src/ui/App.tsx:9-17` -- pattern del componente `ui`: `export function X() {…}`, JSX automatico (nessun `import React`), `lang="ja"` diretto sul giapponese.
- `src/features/auth/AuthForm.tsx:32-58` -- pattern props: `interface` con campi `readonly`, destrutturazione nei parametri.
- `src/features/auth/AuthForm.test.tsx:39-57`, `src/i18n/i18n.test.tsx:80-98` -- pattern test di componente: ambiente `node`, `renderToStaticMarkup`, asserzioni `toContain`/`toMatch`; `:38` regex CJK e invariante `lang="ja"` (complementare ad AC4).
- `eslint.config.js:85` (`ui → ['ui','i18n']`), `:141-168` (regola colore su `src/ui`); `vitest.config.ts` (env `node`).

## Tasks & Acceptance

**Execution:**
- `src/domain/exercise.ts` -- aggiungere `showFurigana: optional(boolean())` alle tre varianti (import `optional`, `boolean` da `./schema`); esportare `furiganaVisible(exercise: { readonly showFurigana?: boolean }): boolean` = `exercise.showFurigana ?? true` con docblock (UNICA sede del predefinito visibile, AC5).
- `src/ui/JapaneseText.tsx` -- **creare**. Esportare `interface RubySegment { readonly text: string; readonly ruby: string｜null }`, `interface JapaneseTextProps { readonly segments: readonly RubySegment[]; readonly showFurigana: boolean }`, e `export function JapaneseText({segments, showFurigana}: JapaneseTextProps)`. Involucro `<span lang="ja">`; per ogni segmento: se `showFurigana && seg.ruby !== null` ⇒ `<ruby>{text}<rp>(</rp><rt aria-hidden="true">{ruby}</rt><rp>)</rp></ruby>`, altrimenti il solo `{seg.text}` (in `<Fragment key>` per la chiave di lista). Nessun import da `domain`, nessun romaji, nessuna logica di allineamento.

**Test (righe della I/O Matrix + AC):**
- `src/ui/JapaneseText.test.tsx` -- **creare**. `renderToStaticMarkup`, env `node`. Coprire: segmento con ruby ⇒ `<ruby>…<rp>(</rp><rt aria-hidden="true">…</rt><rp>)</rp></ruby>`; segmento `ruby:null` ⇒ testo base senza `<rt>`; `showFurigana=false` ⇒ nessun `<ruby>`/`<rt>`, involucro ancora `lang="ja"`; involucro `lang="ja"`; lettura `<rt>` = kana verbatim e nessun romaji (es. `not.toMatch(/kyou/i)`); RENDE VERBATIM un ruby arbitrario (prova che NON riallinea).
- `src/domain/exercise.test.ts` -- **estendere**. `showFurigana` assente ⇒ parse ok e chiave omessa; `showFurigana:false` ⇒ ok, valore `false`; `showFurigana:'yes'` ⇒ issue sul path `showFurigana`. `furiganaVisible`: assente ⇒ `true`, `false` ⇒ `false`, `true` ⇒ `true`.
- `src/domain/exercise-identity.test.ts` -- **estendere** (AC6). Due esercizi identici tranne `showFurigana` (true vs false / assente) ⇒ `deriveExerciseId` UGUALE.

**Acceptance Criteria:**
- **AC1 — Componente ruby.** *Given* `JapaneseText` con segmenti da `alignFurigana()`, *when* è reso, *then* rende i segmenti con `ruby` in `<ruby>`/`<rt>` con `<rp>` di ripiego e quelli senza `ruby` come testo base, senza contenere logica di allineamento (rende i segmenti verbatim).
- **AC2 — `lang="ja"`.** *Given* un rendering del componente, *when* è reso, *then* il nodo che contiene il giapponese porta `lang="ja"`.
- **AC3 — `<rt>` `aria-hidden`.** *Given* la furigana visibile, *when* è resa, *then* ogni `<rt>` porta `aria-hidden="true"`.
- **AC4 — Niente romaji.** *Given* segmenti giapponesi, *when* sono resi, *then* la lettura in `<rt>` è la kana verbatim e nessuna forma romaji compare.
- **AC5 — Visibilità come campo del tipo, predefinito visibile.** *Given* un esercizio, *when* se ne interroga la visibilità della furigana, *then* è il suo campo `showFurigana` risolto da `furiganaVisible` con predefinito visibile (assente ⇒ `true`); e il componente con `showFurigana={false}` rende il testo base senza `<rt>` (ma con `lang="ja"`).
- **AC6 — Identità stabile.** *Given* un esercizio, *when* cambia solo `showFurigana`, *then* `deriveExerciseId` non cambia (la furigana non entra nell'identità, AD-23).

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 17: (high 0, medium 0, low 17)
- addressed_findings:
  - `[low]` `[patch]` La condizione di rendering `showFurigana && seg.ruby !== null` ammetteva `ruby: ''` (valore permesso dal tipo pubblico `RubySegment`), producendo un'annotazione `<rt></rt>` vuota. Cambiata in un check di verità (`showFurigana && seg.ruby`): un `ruby` falsy (`null` o `''`) rende il solo testo base; aggiornati i docblock e aggiunto il test del caso `ruby: ''`.
- reject notevoli (verificati contro il codice reale):
  - **Intent-alignment (AC2/AC4 «qualsiasi schermata», AC5 «reach» nel payload)** — fuori scope per autorità dell'INTENTO stesso: l'epica ordina le schermate dopo (dashboard 3.12, exercise-card 3.18) e questa è una storia-primitivo come 3.10 (`PortsProvider` cablato solo in 3.12). Il romaji è un invariante NEGATIVO tenuto a livello di progetto: nessuna superficie lo introduce, i cataloghi sono già coperti da `i18n.test.tsx`, e `JapaneseText` è il meccanismo con cui le schermate future lo terranno.
  - **Input impossibili dalla sorgente reale** — array `segments` vuoto e (originariamente) `ruby: ''` non sono prodotti da `alignFurigana` (`reading || null`, unica autorità AD-21); il caso `''` è stato comunque indurito col patch sopra.
  - **Test ridondanti** — `showFurigana: null`/`undefined` come chiave presente è coperto dal caso `'yes'` (non-boolean ⇒ issue) e dai test dello schema-kit; identità cross-variante è ridondante (l'esclusione di `showFurigana` da `exerciseNaturalKey` è uniforme per costruzione); regressione «kind sconosciuto» già coperta a schema modificato (`exercise.test.ts`); base-text non-nascosto è garantito strutturalmente (nodo di testo nudo).
  - **Boundary/strutturali** — «test che `ui` non importa `domain`» è già imposto da ESLint/CI (`boundaries.test.ts`, lint verde); il drift `RubySegment`↔`FuriganaSegment` sarebbe colto da `tsc` al primo call-site reale (3.18); `key={i}` è corretto su una lista posizionale statica.
  - **Pre-esistente/di design** — l'elenco esplicito di campi in `exerciseNaturalKey` (2.3/AD-23) è INTENZIONALE ed è già presidiato dal pin del namespace e dai test di sostanza.

## Design Notes

**Perché il componente in `ui` con un tipo-segmento proprio.** `src/ui/` è il livello del design system e AD-1 (imposto in CI) gli vieta OGNI import da `domain`, tipi inclusi (`alwaysTryTypes`). Il componente dichiara quindi `RubySegment`, strutturalmente identico a `FuriganaSegment`; TypeScript accetta `alignFurigana(): FuriganaSegment[]` dove è atteso `readonly RubySegment[]` (tipizzazione strutturale), così il primitivo resta domain-free e riusabile. È lo stesso spirito di `AuthForm`, che riceve chiavi i18n invece di raggiungere l'i18n.

**Perché `optional` + resolver invece di un default materializzato nello schema.** Il cambio resta ADDITIVO: un `showFurigana?: boolean` non tocca i ~20 letterali `: Exercise` di `exercise-identity.test.ts` né le fixture del seed; e `exercisePayload` non lo serializza, quindi il seed committato non si rigenera. Il predefinito *visibile* vive in UNA sola funzione (`furiganaVisible`), non sparso come `?? true`.

**Golden example (JapaneseText):**
```tsx
<span lang="ja">
  {segments.map((seg, i) =>
    showFurigana && seg.ruby !== null ? (
      <ruby key={i}>{seg.text}<rp>(</rp>
        <rt aria-hidden="true">{seg.ruby}</rt><rp>)</rp></ruby>
    ) : (
      <Fragment key={i}>{seg.text}</Fragment>
    ),
  )}
</span>
```

**Perché `<rt>` è `aria-hidden`.** Uno screen reader con voce giapponese legge già il testo base (駅→"eki"); un `<rt>` non nascosto lo farebbe leggere due volte. Ratificato in `EXPERIENCE.md` (UX-DR28); il `<rp>` dà il ripiego a parentesi dove il ruby non è supportato.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (`tsc --noEmit`; `RubySegment` accetta strutturalmente `FuriganaSegment[]`; `showFurigana?` opzionale non rompe i letterali `Exercise`).
- `npm run lint` -- expected: exit 0 (`ui` non importa `domain`; nessun colore letterale; JSX ok).
- `npm test` -- expected: exit 0 (nuovi test componente/dominio verdi; anti-drift del seed invariato perché `showFurigana` non è nel payload).
- `npm run validate-content` -- expected: exit 0 (cancello FR2.6 non regredito; contenuto esistente valido col campo assente).

## Auto Run Result

Status: done

**Sintesi del cambiamento.** La storia 3.11 consegna la RESA del giapponese. Un primitivo presentazionale in `src/ui/` (`JapaneseText`) trasforma segmenti già allineati in ruby accessibile: `<ruby>`/`<rt>` con `<rp>` di ripiego, involucro `<span lang="ja">` (il giapponese è dato, non passa da i18n), `<rt>` `aria-hidden="true"`, nessun romaji e nessuna logica di allineamento (rende i segmenti verbatim). Poiché `src/ui/` non può importare `domain` (AD-1, imposto in CI), il componente dichiara un tipo strutturale `RubySegment` identico a `FuriganaSegment`: l'output di `alignFurigana()` vi fluisce per compatibilità strutturale. Sul dominio, `showFurigana` è aggiunto come campo OPZIONALE ai tre tipi di esercizio e il predefinito VISIBILE vive in un'unica funzione `furiganaVisible(exercise)` (`?? true`). Scelta ADDITIVA: nessuna churn a identità/seed; `showFurigana` è escluso dall'identità (AD-23) e non entra nel payload jsonb (percorso di lettura esercizio differito a 3.18/3.19).

**File modificati:**
- `src/ui/JapaneseText.tsx` (nuovo) — primitivo ruby: `RubySegment`/`JapaneseTextProps` + `JapaneseText`; involucro `lang="ja"`, `<rt>` `aria-hidden`, `<rp>` di ripiego; un `ruby` falsy (`null` o `''`) rende il solo testo base.
- `src/ui/JapaneseText.test.tsx` (nuovo) — righe della I/O Matrix + AC1-5 via `renderToStaticMarkup` (env node).
- `src/domain/exercise.ts` — `showFurigana: optional(boolean())` sui tre kind; resolver `furiganaVisible` (unica sede del predefinito visibile).
- `src/domain/exercise.test.ts` — parse del campo opzionale (assente/false/true/malformato) + resolver.
- `src/domain/exercise-identity.test.ts` — AC6: `showFurigana` diverso ⇒ `deriveExerciseId` identico.

**Ripartizione dei finding (questa passata):** patch applicati 1 (low); differiti 0; respinti 17 (tutti low). Nessun `intent_gap`, nessun `bad_spec`, nessun loopback: `review_loop_iteration` resta 0. L'unico patch ha indurito la condizione di rendering perché un `ruby` vuoto non produca un'annotazione `<rt>` vuota.

**Raccomandazione di follow-up review:** `false`. Solo i patch di questa passata contano: high 0, medium 0, low 1 ⇒ punteggio `3×0 + 1×1 = 1` (< 5 e nessun high).

**Verifica eseguita (dopo il patch, indipendente):**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (`ui` non importa `domain`; nessun colore letterale).
- `npm test` — exit 0 (68 file, 672 test verdi; anti-drift del seed invariato: `showFurigana` non è nel payload).
- `npm run validate-content` — exit 0 (cancello FR2.6 non regredito).

**Rischi residui.** Il componente è un PRIMITIVO senza consumatore di produzione: il cablaggio in una schermata reale (exercise-card) e la propagazione di `showFurigana` nel payload jsonb / seed nascono con le storie di sessione (3.18/3.19), coerentemente con il pattern «dichiarazione-in-anticipo» già usato in 3.10 (`PortsProvider`→3.12). Il tipo `RubySegment` rispecchia STRUTTURALMENTE `FuriganaSegment`: un'eventuale divergenza futura del contratto di dominio sarebbe colta da `tsc` al primo call-site reale (3.18), non da un test oggi.
