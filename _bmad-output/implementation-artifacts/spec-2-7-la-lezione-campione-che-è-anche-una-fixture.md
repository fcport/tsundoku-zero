---
title: "Story 2.7: La lezione campione, che è anche una fixture"
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: '4baf89d1d0847d278b30b6c09c3b91b82c3d43fe'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Lo span di select-span {start:0,end:1} della lezione campione va verificato/aggiustato
      contro alignFurigana() quando esisterà (Epic 3, storia 3.6).
    evidence: |-
      Lo span indicizza i SEGMENTI di alignFurigana(), che non esiste ancora (solo commenti
      in exercise.ts/content-validation.ts). Il cancello di 2.6 accetta solo end>start≥0
      (segmentSpan, exercise.ts:113-120), quindi non può confermare che il segmento 0 sia
      davvero 果物. Lo span è autorato assumendo che il jukujikun 果物 (letto くだもの come
      unità) sia il primo segmento; da riconfermare in 3.6. Si aggancia al deferred già
      registrato in 2.6 sui confini dello span.
    location: >-
      content/lessons/01-la-particella-wo.json (exercises.2.answer)
    severity: medium
  - summary: >-
      La conferma sul rendering reale dei valori di sentence-hero (UX-DR8: 32/26px, interlinea
      1.9) sulla frase più lunga di questa lezione è dovuta alla storia 3.23.
    evidence: |-
      UX-DR8 fissa i valori ma epics.md e la storia 3.23 dicono che la verifica sul rendering
      «si chiude nella storia 3.23»; 1.3 àncora con design-tokens.test.ts l'ASSENZA del token
      --text-sentence-hero oggi (definirlo ora romperebbe quel test). 2.7 fornisce SOLO la
      frase più lunga (l'assemble, 25 caratteri) come input di stress; il rendering richiede
      la UI di presentazione dell'esercizio (Epic 3).
    location: >-
      src/ui/theme.css (token --text-sentence-hero, da definire in 3.23)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Il contratto dell'esercizio è completo (schema unico, tre tipi, identità da contenuto, ripiego bilingue) e il cancello di CI di 2.6 lo protegge, ma `content/lessons/` è ancora VUOTA (solo `.gitkeep`): non esiste una sola lezione reale. I test di componente di Epic 3 e l'end-to-end di Epic 7 hanno bisogno di contenuto VERO — non sintetico — per ciascuno dei tre tipi, e la frase più lunga della lezione serve a chiudere la verifica di `sentence-hero` (UX-DR8) in 3.23.

**Approach:** Autorare a mano UNA lezione reale `content/lessons/01-*.json`, conforme allo schema di 2.1/2.2 e verde al cancello di 2.6, con almeno un esercizio per ciascun tipo e i tre casi difficili incorporati (frase lunga, jukujikun, okurigana). Esporla come FIXTURE typed tramite un accessor di dominio che import-a il file reale e lo valida (fixture ≡ contenuto spedito). Un test àncora le tre coperture e prova che il cancello resta verde sulla cartella reale.

## Boundaries & Constraints

**Always:**
- **Superficie osservata (outermost) per la validazione (AC3):** il CANCELLO reale di 2.6. `npm run validate-content` esce ZERO con la lezione presente in `content/lessons/`, e il test invoca `collectIssues(<repo>/content/lessons)` (la stessa composizione glob→read→validate della CLI) asserendo `[]`. Nessuna reimplementazione della validazione: si CONSUMA il cancello di 2.6.
- **Un solo file di lezione**, `content/lessons/01-<slug>.json` (JSON, convenzione `NN-*.json` del PRD §2), `order: 1`. Contiene **≥1 esercizio per ciascun `kind`** del registro chiuso: `single-select`, `select-span`, `assemble` (AC1).
- **Tre casi difficili incorporati DI PROPOSITO (AC1)**, ciascuno ancorato da un'asserzione nel test: (a) una **frase lunga** (la frase dell'`assemble`, ≥24 caratteri kanji) — è l'input di stress per `sentence-hero`; (b) una **jukujikun** (今日→きょう nel `single-select`; anche 果物→くだもの nel `select-span`); (c) una **okurigana** (新しい / 読みます nella frase lunga).
- **Contenuto conforme allo schema unico:** ogni frase espone `kanji` e `kana` SEPARATI e non vuoti; `kana` è SOLA lettura (nessun ideogramma Han — condizione del cancello di 2.6); ogni esercizio porta `grammarPoint` non vuoto e `explanation.en` non vuoto; `single-select` porta `distractors` non vuoto; `assemble.answer` è la sequenza ordinata di tessere; `select-span.answer` è `{start,end}` con `end>start≥0`.
- **Ripiego bilingue esercitato dal contenuto reale:** almeno un esercizio con `explanation.it` presente e almeno uno con `it` ASSENTE, così Epic 3 ha un caso reale del ripiego dichiarato di 2.5. Il test àncora entrambe le presenze.
- **Fixture typed e canonica (AC4):** `src/domain/sample-lesson.ts` fa lo `import` STATICO del file reale, lo valida con `parseLesson` (fonte unica), ed esporta `sampleLesson: Lesson`. L'import diretto GARANTISCE che la fixture sia la lezione spedita, non una copia sintetica. Se il contenuto divergesse dallo schema l'accessor LANCIA (guardia d'integrità della fixture; non scatta mai perché il cancello tiene il contenuto valido).
- **Contenuto ORIGINALE (AC5):** frasi composte a mano per questa lezione, non riprodotte da alcuna fonte; prima applicazione concreta delle regole del PRD §2. Rimane soggetto alla revisione umana obbligatoria (FR11.2).
- TypeScript strict, **nessun `any`**; dominio puro (nessun import esterno, nessun global vietato): l'import di un file dati JSON per path relativo NON è un pacchetto esterno.

**Block If:** _Nessun blocco._ Storia interamente in-repo (un file dati + un accessor di dominio + un test): nessuna azione umana né vendor fuori dal repo. Esito atteso `done`.

**Never:**
- **Non** definire il token `--text-sentence-hero` né toccare `src/ui/theme.css`: UX-DR8 fissa i valori (32/26px, interlinea 1.9) ma la loro CONFERMA sul rendering reale si CHIUDE in 3.23 (Epic 3), e 1.3 àncora con un test l'ASSENZA del token oggi. 2.7 fornisce SOLO la frase lunga; la conferma è deferita a 3.23 (vedi Design Notes).
- **Non** verificare i confini dello span di `select-span` contro la segmentazione reale: `alignFurigana()` è Epic 3 (3.6). Lo span di `01-*.json` è autorato assumendo che 果物 (jukujikun letto come unità) sia il segmento 0 → `{start:0,end:1}`; va riverificato/aggiustato quando 3.6 esisterà (si aggancia al deferred già registrato in 2.6). Il cancello odierno accetta `end>start≥0`.
- **Non** costruire il caricatore di contenuto runtime dell'app (glob → `Lesson[]` per il client): è 3.7. Qui l'unico consumo è la FIXTURE (import statico di un file noto), non la scoperta dinamica.
- **Non** modificare schema/dominio/cancello esistenti (`lesson.ts`, `exercise.ts`, `exercise-identity.ts`, `content-validation.ts`, `scripts/validate-content.ts`, `ci.yml`): 2.7 li CONSUMA. **Non** rimuovere `.gitkeep` (documenta la cartella; il glob del cancello ignora i non-`.json`).
- **Non** aggiungere lezioni oltre a questa, né dipendenze npm.

## Coverage Matrix (i tre esercizi del file `01-*.json`)

| Esercizio | `kind` | Caso difficile ancorato | `explanation.it` |
|-----------|--------|-------------------------|------------------|
| 1 | `single-select` | **jukujikun** 今日→きょう (answer `きょう`, distrattori letture plausibili) | presente |
| 2 | `assemble` | **frase lunga** (≥24 char) + **okurigana** 新しい/借りて/読みます | ASSENTE (caso di ripiego) |
| 3 | `select-span` | **jukujikun** 果物→くだもの; span `{0,1}` = l'oggetto marcato da を | presente |

</intent-contract>

## Code Map

- `content/lessons/01-la-particella-wo.json` — **NUOVO.** La lezione campione reale. `order:1`, `title` in prosa giapponese derivata dal punto grammaticale, `grammarPoints` (primario: l'oggetto marcato da «を»), `exercises` coi tre `kind` e i casi difficili della Coverage Matrix. Ogni `kana` è sola lettura (nessun Han). Frasi originali.
- `src/domain/sample-lesson.ts` — **NUOVO.** Accessor della fixture: `import raw from '../../content/lessons/01-la-particella-wo.json'` (statico; `resolveJsonModule` è già ON), `parseLesson(raw)` (fonte unica di 2.1), export `sampleLesson: Lesson`. Se `!ok` LANCIA con i path degli issue (guardia d'integrità). Dominio puro: import di dati JSON per path relativo, nessun pacchetto esterno, nessun global.
- `src/domain/sample-lesson.test.ts` — **NUOVO.** (a) AC3: `collectIssues(resolve(repoRoot,'content','lessons'))` ⇒ `[]` (cancello reale su dir reale; `repoRoot` da `import.meta.url` come in `validate-content-script.test.ts`); (b) AC1: i tre `kind` presenti; (c) casi difficili ancorati: max `sentence.kanji` ≥24 char; una frase contiene 今日 col relativo `answer` `きょう`; 果物 presente; 新しい e 読みます presenti nella frase lunga; (d) `sampleLesson` carica (order 1, ≥3 esercizi); (e) ripiego: esiste ≥1 `explanation.it` presente e ≥1 assente. Fixture dal file reale (via accessor), non inline.
- **RIFERIMENTO (non modificare):** `src/domain/lesson.ts` (`parseLesson`, `Lesson`, `lessonId`), `src/domain/exercise.ts` (registro chiuso, `japaneseSentence`, `explanation`, `segmentSpan`), `src/domain/exercise-identity.ts` (`deriveExerciseId`, unicità), `src/domain/content-validation.ts` + `scripts/validate-content.ts` (il cancello e `collectIssues`), `.github/workflows/ci.yml` (step del cancello), `content/lessons/.gitkeep`, `src/design-tokens.test.ts` (àncora l'assenza di `sentence-hero`, deferito a 3.23).

## Tasks & Acceptance

**Execution:**
- `content/lessons/01-la-particella-wo.json` — autorare la lezione: tre esercizi (uno per `kind`), i tre casi difficili, `kana` senza Han, un esercizio senza `it`. Frasi originali.
- `src/domain/sample-lesson.ts` — accessor: import statico + `parseLesson` + export `sampleLesson: Lesson`; lancia su non-conformità.
- `src/domain/sample-lesson.test.ts` — coprire AC1 (tre `kind` + tre casi difficili ancorati), AC3 (cancello reale ⇒ `[]`), il caricamento della fixture e la presenza/assenza di `it`.

**Acceptance Criteria:**
- Given il registro dei tre tipi, when la lezione campione è autorata in `content/lessons/01-*.json`, then contiene almeno un esercizio per ciascun `kind` (`single-select`, `select-span`, `assemble`) e include di proposito una frase lunga, una con jukujikun e una con okurigana — ciascun caso ancorato da un'asserzione del test (AC1).
- Given la lezione campione, when `npm run validate-content` gira sulla cartella reale (e `collectIssues('content/lessons')` nel test), then passa lo schema di 2.1 e i controlli di 2.6 ed esce ZERO / ritorna `[]` (AC3).
- Given la lezione campione come fixture, when `sample-lesson.ts` la carica, then `parseLesson` la accetta e `sampleLesson: Lesson` è il file reale spedito (import statico), disponibile ai test di Epic 3 e all'e2e di Epic 7 senza contenuto sintetico (AC4).
- Given il contenuto, when è prodotto, then usa frasi originali (non riprodotte da fonti) ed è la prima applicazione concreta delle regole del PRD §2 (AC5, ratificata dalla revisione umana FR11.2).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run validate-content`, when girano, then passano senza regressioni e senza alcun `any`.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 2, low 1)
- defer: 2: (high 0, medium 2, low 0)
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[medium]` `[patch]` `title` era identico a `grammarPoints[0]` (il tag grammaticale verbatim), non prosa — l'anti-pattern che `lesson.ts` (AC5) segnala e che lo spec chiedeva di evitare. Ora `title: "毎日の動作を「を」で言い表す"`, prosa distinta che riflette il tema (azioni quotidiane: studiare / prendere in prestito e leggere / comprare).
  - `[medium]` `[patch]` Le tessere dell'`assemble` non ricostruivano `sentence.kanji`: la 、 era scartata dalle tessere. Ora la tessera `借りて、` porta la virgola ⇒ `answer.join('') === sentence.kanji`. Aggiunto il test-invariante che lo àncora per ogni esercizio `assemble`.
  - `[low]` `[patch]` La spiegazione dell'`assemble` mescolava meccanica della UI («Reordering the tiles must keep 本を before 借りて») nella prosa didattica: rimossa, resta la sola spiegazione grammaticale.

Quattro layer in parallelo su Opus (baseline `4baf89d`). **Verification-Gap**: nessun rilievo — le sei affermazioni (cancello reale `[]`, tre `kind`, tre casi difficili, fixture typed dal file reale, `kana` senza Han, ripiego bilingue reale) sono ciascuna coperta da un test che gira e passa; l'unico non verificato (lo span contro la segmentazione) è correttamente deferito a 3.6. **Intent-Alignment** (descrittivo): il diff implementa fedelmente la lettura content+fixture su AC1/AC3/AC4/AC5; l'unica divergenza di superficie (AC2 rendering) è deferimento voluto dall'intento stesso (nota UX-DR8 «si chiude in 3.23»). **Edge-Case** e **Blind Hunter**: i rilievi reali confluiscono nei 3 patch e nei 2 defer; i restanti rifiutati. Findings rifiutati (14, tutti low): import per filename (è l'INTEGRITÀ voluta della fixture: rinominare rompe il typecheck, non silenziosamente); `collectIssues` sulla dir reale (è la superficie AC3 voluta — il cancello reale sul contenuto reale); throw a module-load (by-design, guardia d'integrità; la sua regressione è colta due volte); `Math.max` su array vuoto (guardato dall'asserzione ≥3 esercizi); fragilità di `find(≥24)` (una sola frase lunga nel contenuto); fixture negative (già provate esaustivamente in 2.6); unicità id senza test dedicato (imposta dal cancello, che AC3 esercita); `kana` come lettura corretta del `kanji` (non verificabile senza `alignFurigana()`, 3.6 — stesso deferred); tessere con Han vs check solo su `kana` (lo scope Han su `kana` è corretto by-design); `it` via `!==undefined` (lo schema vieta `it` vuoto); ripiego sull'esercizio più difficile (lo spec lascia aperto quale); organizzazione dei test; nota forward-ref sull'okurigana.

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 15: (high 0, medium 0, low 15)
- addressed_findings:
  - none

Seconda passata di review (spec ripartita da `done`, `review_loop_iteration` 0), quattro layer in parallelo su Opus, baseline `4baf89d`. **Verification-Gap**: nessun rilievo (le sei affermazioni restano ancorate; lo span vs segmentazione è già deferito a 3.6). **Intent-Alignment** (descrittivo): unica osservazione di quota — AC3 è testimoniato dal test a livello di `collectIssues` (in-process) mentre la lettura outermost dell'intento nomina anche l'exit-code di `npm run validate-content`; entrambe le superfici sono però coperte (il test invoca `collectIssues`, la sezione Verification esegue `npm run validate-content` → exit 0, e `validate-content-script.test.ts` copre già la superficie di processo). Nessuna azione. **Blind Hunter** ed **Edge-Case** hanno prodotto rilievi tutti di contenuto/organizzazione, ciascuno o già deciso dalla passata precedente, o riservato per design alla revisione umana, o contraddittorio con l'autorità dell'intento — quindi tutti rifiutati, tutti `low`. Verificato contro il codice reale prima del triage: (1) lo schema di `lesson.ts` esige solo `title: nonEmptyString()`; la proprietà «title prosa ≠ tag grammaticale» è ESPLICITAMENTE non imponibile meccanicamente e demandata a FR11.2 (revisione umana), con la superficie meccanica d'identità in `lessonId` (che ignora `title`) — quindi un test `title !== grammarPoints[0]` sarebbe un guardiano debole di una proprietà by-design non-testabile; (2) `content-validation.ts` non richiede che ogni `grammarPoints` abbia un esercizio (una lezione può averne ZERO e dichiararli comunque; alimentano le statistiche di Epic 5), e il secondo punto «他動詞と目的語» è tematicamente coperto dai verbi transitivi; (3) il cancello accetta `end>start≥0` e non valida i confini dello span contro i segmenti reali — già deferito a 3.6. Findings rifiutati (15, tutti low): single-select àncora la jukujikun (answer きょう) non la particella を — è il design della Coverage Matrix; «≥24 caratteri kanji» misura la lunghezza del campo `kanji` della frase (corretto come input di stress di rendering per sentence-hero); il secondo `grammarPoints` non ha esercizio dedicato (permesso dallo schema, tematicamente presente); indice di segmento 0 dello `select-span` non verificato (già deferito a 3.6); l'`assemble` (più difficile) senza `explanation.it` (lo spec lascia aperto quale esercizio ripiega); nessuna progressione fra i tre grammar-point (scelta di contenuto); qualità dei distrattori della jukujikun (letture plausibili-ma-errate, che È il loro scopo); fix `title ≠ grammarPoints[0]` non ancorato da test (by-design sotto FR11.2); virgola nella tessera 借りて、 (deciso di proposito nella passata precedente per l'invariante di ricostruzione); parità semantica IT/EN non verificata (territorio di revisione umana); il `title` promette più ampiezza didattica del contenuto (nuance di contenuto); fragilità di `find(≥24)` con margine di un carattere (una sola frase lunga per design); il test del ripiego si accoppia alla distribuzione autorata di `it` (è l'AC 2.5 che esige presenza E assenza); l'invariante join delle tessere non è imposto dal cancello reale (è ancorato dal test della fixture, che È la sua sede); AC3 testimoniato a livello di `collectIssues` vs exit-code di processo (entrambe le superfici coperte).

## Design Notes

**`sentence-hero` (AC2) è deferito a 3.23, non implementabile qui.** UX-DR8 FISSA i valori del ruolo di frase (32px desktop / 26px mobile, interlinea 1.9), ma `epics.md` §UX-DR8 e la storia 3.23 dicono che la sua verifica sul rendering reale «si chiude nella storia 3.23», e 1.3 àncora con `design-tokens.test.ts` che il token `--text-sentence-hero` NON è definito oggi (definirlo ora romperebbe quel test e invaderebbe 3.23). Il rendering reale richiede inoltre la UI di presentazione dell'esercizio, che è Epic 3. Ciò che 2.7 possiede e consegna: la **frase più lunga** (l'`assemble`, ≥24 char) come input di stress, pronta perché 3.23 confermi o corregga i valori. Deferred, non un'azione d'operatore fuori dal repo.

**Perché un accessor di dominio e non fs.** L'import statico del JSON (bundler + `resolveJsonModule`) dà una fixture TYPED a build-time, la spedisce identica al contenuto reale (nessuna divergenza sintetica, AC4) e resta PURA (nessun I/O runtime). Rinominare il file rompe il typecheck — integrità della fixture. Vitest risolve gli import `.json` via Vite; `tsc` include i file importati anche fuori da `include`. La prova del CANCELLO usa invece `collectIssues` (fs), la superficie reale di AC3.

**Lo span di `select-span` è provvisorio.** `{start:0,end:1}` assume che 果物 (jukujikun) sia il segmento 0 di `alignFurigana()` (una lettura d'unità non splittabile). Quella funzione è 3.6: il cancello odierno non valida i confini contro i segmenti reali (deferred già in 2.6). Da riverificare quando 3.6 esisterà.

## Verification

**Commands:**
- `npm run validate-content` — expected: exit 0 (il cancello scopre `01-*.json` per glob e la trova conforme).
- `npm test` — expected: `sample-lesson.test.ts` verde (tre `kind`, casi difficili ancorati, cancello `[]`, fixture caricata) + le suite 1.1–2.6 senza regressioni.
- `npm run typecheck` — expected: 0 errori, nessun `any` (l'import JSON e `sampleLesson: Lesson` tipizzano puliti).
- `npm run lint` — expected: 0 errori (l'import di dati JSON nel dominio non è un pacchetto esterno; nessun global vietato).
- `npm run build` — expected: `tsc --noEmit` + `vite build` senza errori.

## Auto Run Result

Status: `done` (seconda passata di review su spec ripartita da `done`; nessun cambiamento al codice).

**Sintesi della modifica implementata.** La storia consegna la prima lezione reale `content/lessons/01-la-particella-wo.json` (particella «を» come marcatore dell'oggetto), con un esercizio per ciascuno dei tre `kind` del registro chiuso (`single-select`, `assemble`, `select-span`) e i tre casi difficili incorporati di proposito (frase lunga ≥24 caratteri, jukujikun 今日/果物, okurigana 新しい/借りて/読みます). La lezione è esposta come FIXTURE typed e canonica tramite l'accessor di dominio `src/domain/sample-lesson.ts` (import statico + `parseLesson` + `sampleLesson: Lesson`, con throw d'integrità), e `src/domain/sample-lesson.test.ts` àncora le coperture consumando il cancello reale di 2.6 (`collectIssues` sulla cartella reale ⇒ `[]`).

**File modificati (diff dal baseline `4baf89d`):**
- `content/lessons/01-la-particella-wo.json` — la lezione campione reale (tre esercizi, tre casi difficili, `kana` senza Han, un esercizio senza `explanation.it`).
- `src/domain/sample-lesson.ts` — accessor della fixture: import statico del file reale, validazione con `parseLesson`, export `sampleLesson: Lesson`, throw su non-conformità.
- `src/domain/sample-lesson.test.ts` — copre AC1 (tre `kind` + tre casi difficili ancorati), AC3 (cancello reale ⇒ `[]`), il caricamento della fixture, l'invariante join delle tessere e la presenza/assenza di `it`.
- `_bmad-output/implementation-artifacts/spec-2-7-la-lezione-campione-che-è-anche-una-fixture.md` — questa spec (triage log della seconda passata + Auto Run Result).

**Ripartizione dei rilievi (questa passata):** patch applicati: 0; item deferiti (nuovi): 0; item rifiutati: 15 (tutti `low`). Nessun `intent_gap`, nessun `bad_spec`. I due deferred preesistenti (span vs `alignFurigana()` → 3.6; conferma rendering `sentence-hero` → 3.23) restano invariati (di proprietà dell'orchestratore). Motivazione di rigetto per tema: rilievi già decisi dalla passata precedente, o riservati per design alla revisione umana obbligatoria (FR11.2, es. `title` prosa ≠ tag grammaticale — non imponibile dallo schema), o contraddittori con l'autorità dell'intento (la Coverage Matrix fissa il single-select come àncora della jukujikun e l'`assemble` come caso di ripiego senza `it`). Dettaglio nel `## Review Triage Log`.

**Raccomandazione di follow-up review:** `false`. Patch di questa passata per severità: high 0, medium 0, low 0; score `3×0 + 1×0 = 0` (< 5).

**Verifica eseguita (stato corrente, tree della sessione):**
- `npm run validate-content` → exit 0 («Validazione del contenuto OK: nessun problema in content\lessons»).
- `npm run typecheck` (`tsc --noEmit`) → exit 0.
- `npm run lint` (`eslint .`) → exit 0.
- `npm test` → 392/392 test passati su 40 file (incl. `sample-lesson.test.ts` e `validate-content-script.test.ts`), exit 0.
- `npm run build` (`tsc --noEmit` + `vite build`) → exit 0 (l'avviso sul chunk >500 kB è preesistente e non bloccante).

**Rischi residui.** (1) Lo span `{start:0,end:1}` dello `select-span` è provvisorio finché non esiste `alignFurigana()` (3.6): il cancello odierno accetta `end>start≥0` ma non verifica i confini contro i segmenti reali — già deferito. (2) La conferma dei valori di rendering di `sentence-hero` (UX-DR8) sulla frase più lunga si chiude in 3.23 — già deferito. (3) Le proprietà di qualità del contenuto non meccanizzabili (prosa del `title`, parità semantica IT/EN, scelta dei distrattori) restano soggette alla revisione umana obbligatoria (FR11.2).

