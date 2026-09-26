---
title: 'Il flusso di autorazione, documentato e ripetibile'
type: 'chore' # feature | bugfix | refactor | chore
created: '2026-09-26'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: '51dff868c6db329438a0b90ee8d2f4e22c97d78b'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      Il cancello validateLessons non verifica che gli indici start/end di un
      esercizio select-span siano entro il numero reale di segmenti della frase:
      un end fuori range supera la validazione.
    evidence: |-
      src/domain/content-validation.ts controlla la forma (parseLesson: start>=0,
      end>start), kana-senza-Han, l'unicità cross-file e il grammarPoint
      dichiarato, ma NON i bound di segmento. La segmentazione (alignFurigana) è
      Epic 3 e il controllo kana è dichiarato "di CARATTERE, non di
      segmentazione". Un select-span con end oltre i segmenti reali passa il gate
      e produrrebbe un esercizio rotto; oggi lo intercetta solo la revisione
      umana (passo 5 del runbook). Non correggibile in 6.2: l'intent vieta di
      modificare il validatore; naturale ricongiungimento a Epic 3.
    location: >-
      src/domain/content-validation.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Oggi non esiste una procedura scritta per trasformare una lezione appena studiata in un file di esercizi conforme allo schema di Epic 2. Il confine con la fonte è documentato (storia 6.1, `docs/authoring-pipeline.md`), ma *come si lavora* dipende ancora dalla memoria di chi ha autorato la lezione campione: un terzo — o l'owner fra sei mesi — non saprebbe da dove partire, e senza una procedura ripetibile il costo per lezione non è controllabile (premessa di 6.4).

**Approach:** Scrivere un **runbook operativo** end-to-end (`docs/authoring-runbook.md`) che qualcuno esegue leggendolo: dai fatti estratti dal transcript, alla stesura assistita da un LLM, al file `content/lessons/NN-<concetto>.json`, alla **revisione umana obbligatoria** prima del commit, fino al cancello di validazione di Epic 2 (`npm run validate-content`, imposto in CI). Includere un **esempio completo** di lezione valida — costruito da fatti grammaticali liberi, in terminologia linguistica standard — e bloccare doc+esempio con un test di igiene di livello repo (sul modello di `src/source-boundary.test.ts`) che verifica meccanicamente le dichiarazioni obbligatorie del doc e che l'esempio passi davvero `validateLessons`.

## Boundaries & Constraints

**Always:**
- Il runbook è **autosufficiente**: chi non l'ha mai eseguito produce una lezione valida senza chiedere aiuto (AC1). Enumera i tre tipi del registro chiuso e la forma di `answer` di ciascuno, i campi obbligatori, e le regole oltre-schema che il cancello impone (kana senza Han, `grammarPoint` fra i `grammarPoints` dichiarati, unicità cross-file di `order`/id).
- Il runbook dichiara che l'autorazione è **assistita da un LLM** (solo in autorazione, mai a runtime) e che prevede una **rilettura umana obbligatoria prima del commit**: nessun esercizio raggiunge il repository senza essere stato riletto (AC2).
- Il runbook dichiara che aggiungere una lezione **non tocca il codice**: l'autore crea/edita solo un JSON sotto `content/lessons/`, mai `src/` o lo schema; una lezione conforme passa il cancello senza interventi manuali sullo schema (AC3).
- L'esempio completo usa **solo terminologia linguistica standard** e frasi inventate dai fatti — mai formulazioni, esempi o metafore della fonte (coerente con `docs/authoring-pipeline.md`).
- Il runbook rinvia a `docs/authoring-pipeline.md` per il confine fatto/formulazione e indicizza la lezione **per concetto grammaticale**, mai per numero/titolo/ordine della fonte.

**Block If:**
- (nessuno) — la procedura è interamente documentabile da un agente; le azioni umane che descrive (guardare la fonte, rileggere prima del commit) sono passi del flusso per esecuzioni future, non prerequisiti per completare la storia.

**Never:**
- Non implementare lo **strumento meccanico di confronto anti-contaminazione**: è la storia 6.3. Il runbook dichiara che oggi la difesa è la rilettura umana e che il controllo automatico arriverà con 6.3 (fuori CI, perché il transcript non è nel repo).
- Non produrre né committare **lezioni di corso** in `content/lessons/`: le cinque lezioni sono la Definition of Done di 6.4, e committarle richiederebbe la rilettura umana che un agente non può eseguire. L'unico artefatto-lezione di questa storia è l'esempio *dentro* il runbook.
- Non creare un README di root né misurare/registrare il tempo dei trenta minuti (territorio di 6.4 / Epic 7).
- Non modificare lo schema, il validatore o `content/lessons/01-la-particella-wo.json`.
- Non scrivere né modificare `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Esempio del runbook | il blocco JSON marcato nel doc | estratto e passato a `validateLessons` → `[]` (nessun issue) | il test fallisce se l'esempio non conforma |
| Doc esiste e dichiara i passi | `docs/authoring-runbook.md` | il test trova le ancore: LLM-assist, rilettura umana prima del commit, `npm run validate-content`, "non tocca il codice", rinvio a `authoring-pipeline.md` | test rosso se manca un'ancora |
| Cancello di validazione | esempio conforme via `npm run validate-content` | exit 0 (già imposto in `ci.yml`) | non-conforme → exit 1 → merge bloccato |

</intent-contract>

## Code Map

- `docs/authoring-runbook.md` (nuovo) -- il runbook operativo. Stile allineato a `docs/authoring-pipeline.md` e `docs/i18n-boundary.md` (registro, sezioni). Contiene i passi, il riferimento campo-per-campo allo schema, la checklist di revisione umana, e l'esempio completo racchiuso fra sentinelle `<!-- BEGIN worked-example --> ```json … ``` <!-- END worked-example -->`.
- `docs/authoring-pipeline.md` -- righe 11-13: dice già "La **procedura operativa** della sessione di autorazione è della storia 6.2". Aggiungere un rinvio esplicito al nuovo runbook (chiude il cross-link). Non alterare il resto.
- `src/source-boundary.test.ts` -- **template** del test di igiene: `resolve(here, '..')` per la radice, `readFileSync` sul doc, ancore su riga/regex, `describe`/`it`. Modellare `src/authoring-runbook.test.ts` su questo.
- `src/domain/content-validation.ts` -- `validateLessons(files: {path, source}[]): ContentIssue[]`, PURO: `[]` sse e solo se conforme. Il test importa questo per validare l'esempio (nessun I/O di disco necessario).
- `src/domain/lesson.ts` (righe 39-107) e `src/domain/exercise.ts` (union `single-select`/`select-span`/`assemble`, righe ~92-143) -- forma esatta di lezione ed esercizio; `deriveLessonId` da `grammarPoints[0]`. Fonte per il riferimento campo-per-campo del runbook.
- `src/domain/exercise-identity.ts` (righe 63-81) -- identità `uuidv5` da tipo+frase(kanji,kana)+risposta corretta (NFKC); esclude spiegazione/distrattori/grammarPoint. Il runbook lo cita quando spiega perché correggere un refuso non crea un doppione.
- `content/lessons/01-la-particella-wo.json` -- esempio reale della forma dei tre tipi; il runbook vi rinvia come modello già in repo.
- `.github/workflows/ci.yml` (righe 58-66) -- il cancello di merge `npm run validate-content` (FR2.6). È il cancello di Epic 2 a cui AC3 si riferisce.
- `scripts/validate-content.ts` -- CLI del cancello; comando `npm run validate-content` (package.json:16). Glob su `content/lessons/**/*.json`.
- `scripts/generate-content-seed.ts` -- `npm run generate-content-seed` (package.json:17): rigenera la migrazione seed Supabase; il runbook lo nomina come passo finale "rendere la lezione disponibile all'app".

## Tasks & Acceptance

**Execution:**
- `docs/authoring-runbook.md` (nuovo) -- scrivere il runbook end-to-end in italiano: (1) prerequisiti e cartella `.authoring/`; (2) estrarre i **fatti** dal transcript (rinvio a `authoring-pipeline.md`, indicizzare per concetto); (3) autorazione assistita da LLM dai fatti (solo in autorazione), con i vincoli che l'LLM deve rispettare (schema, tre tipi, frasi inventate, terminologia standard); (4) comporre `content/lessons/NN-<concetto>.json` con riferimento campo-per-campo allo schema e alle regole oltre-schema; (5) **revisione umana obbligatoria** prima del commit, con checklist (leggere ogni esercizio; verificare il confine anti-contaminazione — oggi umano, il controllo meccanico è 6.3; verificare i fatti); (6) cancello `npm run validate-content` (verde obbligatorio, imposto in CI) — l'autore non tocca `src/`; (7) passo finale `npm run generate-content-seed` per rendere la lezione disponibile. Includere l'**esempio completo** valido, racchiuso fra le sentinelle, con i tre tipi e terminologia standard.
- `docs/authoring-pipeline.md` -- aggiungere una riga di rinvio al runbook operativo appena creato (chiudere il cross-link già annunciato alle righe 11-13). Nessun'altra modifica.
- `src/authoring-runbook.test.ts` (nuovo) -- test di igiene di livello repo (modello `source-boundary.test.ts`): (a) `docs/authoring-runbook.md` esiste; (b) dichiara le ancore obbligatorie — LLM in autorazione, rilettura umana prima del commit ("nessun esercizio … riletto"), `npm run validate-content`, "non tocca il codice", rinvio a `authoring-pipeline.md`, indicizzazione per concetto; (c) estrae il blocco JSON fra le sentinelle, `JSON.parse` + `validateLessons([{path, source}])` → `expect(issues).toEqual([])`, provando che una lezione prodotta seguendo il runbook passa il cancello di Epic 2.

**Acceptance Criteria:**
- Given `docs/authoring-runbook.md`, when viene letta da chi non l'ha mai eseguita, then contiene i passi, il riferimento campo-per-campo allo schema (tre tipi, campi obbligatori, regole oltre-schema) e un esempio completo, sufficienti a produrre una lezione valida senza chiedere aiuto.
- Given il runbook, when descrive il flusso, then dichiara che l'autorazione è assistita da un LLM e che è **obbligatoria una rilettura umana prima del commit**, senza la quale nessun esercizio raggiunge il repository.
- Given l'esempio del runbook (una lezione prodotta dal flusso), when viene passato a `validateLessons` / `npm run validate-content`, then non produce alcun issue: passa la validazione di Epic 2 senza interventi manuali sullo schema.
- Given la suite, when `npm test` viene eseguito, then `src/authoring-runbook.test.ts` è verde (ancore del doc presenti, esempio valido).

## Design Notes

- **Forma = documento di procedura (non skill/script).** L'epica lascia la forma aperta; il costo minimo e più ripetibile è un runbook di testo, che risponde direttamente ad AC1 ("eseguibile leggendolo") e prosegue la scelta di 6.1 (doc + test di igiene). Nessun nuovo eseguibile da mantenere.
- **Perché l'esempio vive nel doc, non in `content/lessons/`.** Metterlo fra le lezioni di corso lo trasformerebbe in contenuto seedato e conterebbe verso la DoD di 6.4, e — non riletto da un umano — violerebbe l'invariante di AC2. Nel doc è documentazione: dimostra il template e, estratto dal test, prova AC3 senza committare una lezione di corso.
- **Perché non `awaiting-operator`.** Le azioni umane che il runbook descrive (guardare la fonte, rileggere) sono passi del flusso per esecuzioni future, non prerequisiti esterni (dominio, DNS, chiave API) per *completare* la storia. La storia è documentazione + test, interamente eseguibile da un agente.
- **Coppia doc↔test come 6.1.** Le ancore testuali impediscono che una revisione futura del doc rimuova in silenzio una dichiarazione obbligatoria; l'estrazione+validazione dell'esempio impedisce che il template mostrato smetta di conformarsi allo schema. Usare sentinelle stabili per l'estrazione, non euristiche di markdown.

## Verification

**Commands:**
- `npx vitest run src/authoring-runbook.test.ts` -- expected: pass (doc con tutte le ancore; esempio → `validateLessons` `[]`).
- `npm run validate-content` -- expected: exit 0 (il contenuto di corso resta conforme; l'esempio non è sotto `content/lessons/`, quindi non è validato dal cancello ma dal test unitario).
- `npm run typecheck` -- expected: nessun errore.
- `npm test` -- expected: suite verde.

**Manual checks (if no CLI):**
- Leggere `docs/authoring-runbook.md` dall'inizio come farebbe un terzo: verificare che i sette passi, il riferimento allo schema e l'esempio bastino a produrre una lezione valida senza altre fonti, e che la revisione umana obbligatoria sia esplicita e non aggirabile.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 0, medium 1, low 4)
- defer: 0
- reject: 11: (high 0, medium 0, low 11)
- addressed_findings:
  - `[medium]` `[patch]` Il worked-example aveva `order: 1`, collidendo con `content/lessons/01-la-particella-wo.json`; e la prova di AC3 validava l'esempio in ISOLAMENTO, dove le regole cross-file non scattano → esempio portato a `order: 99` (sentinella illustrativa, con nota che l'autore usa la prossima posizione libera) e test rafforzato: nuovo `it()` che valida l'esempio INSIEME al contenuto reale di `content/lessons/` (unicità cross-file inclusa), prova onesta di AC3; l'`it()` isolato rietichettato come controllo di sola forma.
  - `[low]` `[patch]` L'invariante «LLM solo in autorazione, mai a runtime» non era fissato dal test → aggiunta ancora `expect(doc).toMatch(/mai a runtime/i)`.
  - `[low]` `[patch]` Il doc usava «rilettura umana» mentre il termine canonico di FR11.2/AC2 è «revisione umana obbligatoria» → titolo del passo 5 e frase-sommario allineati a «revisione umana obbligatoria»; ancora del test `rilettura` → `revisione`; invariante «senza essere stato riletto» preservato (testuale in FR11.2).
  - `[low]` `[patch]` Il titolo del runbook taggava solo `FR11.2`, ma realizza anzitutto `FR11.1` (flusso documentato e ripetibile, = titolo della storia) → titolo → `(FR11.1–FR11.2)`.
  - `[low]` `[patch]` Il passo 2 nominava `deriveLessonId` (che prende una stringa) come identità della lezione → corretto in `lessonId` (che deriva da `grammarPoints[0]` via `deriveLessonId`).

Findings scartati (reject): due falsi positivi indotti dalla sintesi abbreviata del diff passata ai revisori — parametro `doc` non tipato / `fence[1]` senza guardia (il file reale ha `doc: string` e `fence![1]`; `typecheck` verde) ed `explanation.it` = `"..."` (nel file reale gli `it` sono completi). Migliorie fuori dagli AC o territorio di altre storie: guida su quando impostare `showFurigana`, elencare i pattern glob dei transcript (dominio 6.1, già in `authoring-pipeline.md`), avvertire che il cancello non verifica i bounds dello span (il segment-vs-carattere è già nel doc), spiegare *perché* una lezione senza esercizi (2.4/Epic 5), rimedio alla collisione d'identità e esempio di errore `ContentIssue` (troubleshooting oltre AC1), dettagli di `generate-content-seed` (commit/percorso/id — deployment oltre AC3), pinnare il numero di storia nel test, asserire un solo fence fra le sentinelle (speculativo). L'intent-alignment è descrittivo: ha confermato che il diff implementa coerentemente la lettura «documentazione + prova via stesso cancello» (la DoD delle cinque lezioni è esplicitamente della 6.4), e il residuo gap di superficie su AC3 è stato ridotto dal patch che valida l'esempio insieme al contenuto reale.

### 2026-09-26 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 1: (high 0, medium 1, low 0)
- reject: 17: (high 0, medium 0, low 17)
- addressed_findings:
  - none

Pass di review di follow-up (spec ri-aperto da `done`, `review_loop_iteration` = 0). Quattro layer in parallelo (blind-hunter, edge-case, verification-gap, intent-alignment) alla stessa capacità di modello della sessione.

Difesa portante confermata: il **verification-gap reviewer** non ha trovato alcun gap (l'unica prova load-bearing — AC3, l'esempio che attraversa il cancello reale di Epic 2 insieme al contenuto di `content/lessons/`, unicità cross-file inclusa — è verificata dal test, che asserisce sul ritorno reale di `validateLessons`, 5/5 verde); l'**intent-alignment auditor** (descrittivo) ha confermato che il diff implementa coerentemente la lettura favorita dall'intent (documentazione + prova via stesso cancello; l'invariante di AC2 «revisione umana» è per progetto una promessa di prosa, non un meccanismo — l'anti-contaminazione meccanica è 6.3, esplicitamente fuori CI). Nessun intent_gap, nessun bad_spec, nessun difetto introdotto dal cambiamento (il riferimento campo-per-campo del doc è verificato allineato a `src/domain/content-validation.ts`).

Defer (1): il cancello `validateLessons` non verifica i **bound di segmento** di un `select-span` (un `end` fuori range supera la validazione). Reale e verificato in `src/domain/content-validation.ts`, ma **non caused by** questa storia (limite pre-esistente del validatore) e **non correggibile qui** — l'intent vieta di modificare il validatore, e la segmentazione (`alignFurigana`) è Epic 3. Registrato nel `deferred` del frontmatter per attenzione futura (ricongiungimento naturale a Epic 3); distinto dal finding scartato del pass precedente, che chiedeva un *avviso nel doc*.

Findings scartati (reject, 17): migliorie oltre gli AC o by-design — ancore testuali «troppo permissive» (proprietà voluta del test di igiene, come `source-boundary.test.ts`; confermata appropriata dal verification-gap reviewer); `order: 99` che potrebbe collidere con una futura lezione (sentinella scelta apposta nel pass precedente, col test combinato come prova onesta); robustezza speculativa del test non innescata (`indexOf` che troverebbe una menzione delle sentinelle nella prosa — non presente; secondo fence `json` fra le sentinelle — inesistente; `readdirSync` su `content/lessons/` mancante — la cartella esiste sempre; `dirent.parentPath` scartato anche dall'edge-case reviewer per il vincolo Node ≥20.19); commit della migrazione seed / dettagli `generate-content-seed` (deployment oltre AC3, già scartato); ordine commit passo5/passo7, come scegliere il prossimo `order`, nesting di `content/lessons/`, `it` «facoltativo» ma presente nell'esempio (non contraddittorio), fallback slug di `deriveLessonId`, checklist che ometterebbe indici span/`showFurigana`, remedy troppo stretto per le collisioni cross-file (in realtà si corregge il proprio JSON), drift terminologico Epic 2/FR2.6/AD-25 (il runbook è internamente coerente), criteri di uscita del hand-off verso 6.3 (dominio di 6.3), test che provi l'esempio metafora-free (= strumento meccanico di 6.3, vietato dall'intent).

## Auto Run Result

Status: done (pass di review di follow-up; nessuna modifica di codice indotta)

**Sintesi del cambiamento.** La storia era già implementata e committata (`1ed90a6`): il runbook operativo `docs/authoring-runbook.md` (sette passi end-to-end + riferimento campo-per-campo allo schema + esempio completo racchiuso fra sentinelle), il cross-link in `docs/authoring-pipeline.md`, e il test di igiene `src/authoring-runbook.test.ts` (ancore obbligatorie del doc + estrazione e validazione dell'esempio via `validateLessons`, in isolamento e insieme al contenuto reale). Questo run è un **pass di review di follow-up** aperto da uno spec a `done`: nessun difetto introdotto dal cambiamento è stato trovato, quindi nessuna correzione di codice è stata prodotta.

**File toccati in questo pass.**
- `_bmad-output/implementation-artifacts/spec-6-2-il-flusso-di-autorazione-documentato-e-ripetibile.md` — `status` (done→in-review→done), `followup_review_recommended` true→false, nuova voce `deferred` (gap bound `select-span`), nuova voce di triage log. (Nessun file di codice/documentazione della storia modificato in questo pass.)

**Breakdown dei findings (questo pass).** intent_gap 0 · bad_spec 0 · patch 0 · defer 1 (medium) · reject 17 (tutti low). Nessun patch applicato; nessun loopback bad_spec. Il defer (bound di segmento di `select-span` non verificati dal cancello) è registrato nel frontmatter per Epic 3.

**Raccomandazione di follow-up review.** `false`. Conteggio dei soli findings di questo pass triati `patch`: 0 (high 0, medium 0, low 0). Score = 3×0 + 1×0 = 0 (< 5) e nessun patch high → `followup_review_recommended: false`.

**Verifica eseguita.**
- `npx vitest run src/authoring-runbook.test.ts` → 5/5 pass.
- `npm run validate-content` → exit 0 («Validazione del contenuto OK: nessun problema in content\lessons»).
- `npm run typecheck` → exit 0 (nessun errore).
- `npm test` → 94 file, 1119 test, tutti verdi.

**Rischi residui.** (1) Il gap deferito sui bound di `select-span` resta aperto fino a Epic 3 (oggi difeso solo dalla revisione umana del passo 5). (2) Le garanzie umane di AC1/AC2 (autosufficienza, revisione umana non aggirabile) sono per progetto prosa fissata da ancore testuali, non meccanismi imposti — coerente con l'intent (l'anti-contaminazione meccanica è 6.3, fuori CI). (3) `sprint-status.yaml` risulta modificato nel working tree: è bookkeeping di proprietà dell'orchestratore, non toccato da questo run.

