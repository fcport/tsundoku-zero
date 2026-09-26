---
title: 'Il flusso regge un corso senza fine'
type: 'chore' # feature | bugfix | refactor | chore
created: '2026-09-26'
status: 'awaiting-operator' # draft | ready-for-dev | in-progress | in-review | done | blocked | awaiting-operator
baseline_revision: '7f254569b394f04cbf60532382a00268fd1dfd60'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: [oversized]
deferred: []
operator_actions:
  - >-
    Misura il tempo reale di M5 (AC2): guarda la fonte di una lezione e cronometra
    un'esecuzione completa del flusso del runbook, dall'inizio (guardare la fonte)
    alla fine (esercizio giocabile, `npm run validate-content` verde, seed
    rigenerato, lezione committata). Registra il tempo reale nella tabella di
    docs/authoring-cost.md, sostituendo la riga «da misurare». Non inventare tempi.
  - >-
    Autora, rileggi (rilettura umana obbligatoria di FR11.2, passo 5 del runbook) e
    committa almeno quattro lezioni ulteriori sotto content/lessons/ per raggiungere
    il traguardo DoD di almeno cinque (obiettivo undici). Committare contenuto di
    corso richiede la rilettura umana, non delegabile a un agente.
  - >-
    A ogni lezione aggiunta, aggiorna la sentinella `<!-- authored-lessons: N -->` di
    docs/authoring-cost.md al nuovo conteggio reale: il test src/authoring-cost.test.ts
    è rosso finché la sentinella non coincide col numero di file sotto content/lessons/.
    Aggiorna anche il verdetto DoD: al raggiungimento delle cinque lezioni, porta la
    sentinella `<!-- dod-status: below-target -->` a `<!-- dod-status: met -->` — il test
    accoppia questa sentinella al conteggio e resta rosso finché non è riallineata.
---

<intent-contract>

## Intent

**Problem:** L'epica 6 ha costruito il confine con la fonte (6.1), il runbook (6.2) e il controllo anti-contaminazione (6.3), ma manca l'**accettazione dell'epica**: nessuno ha esaminato la procedura contro `NFR9` (nessun passaggio manuale il cui costo cresca col numero di lezioni già autorate, verificato su un corso di lunghezza **non nota**), non c'è dove **registrare il tempo** visione→esercizio giocabile (`M5` ≤ 30 minuti, soglia da tarare), e la Definition of Done del PRD §11 (**almeno cinque** lezioni autorate e validate) non è né verificata né tracciata — oggi il repository ne contiene **una** (`content/lessons/01-la-particella-wo.json`).

**Approach:** Aggiungere il documento di **sostenibilità della pipeline** `docs/authoring-cost.md`, coppia doc↔test sul precedente di 6.1/6.2/6.3, che: (AC1) **esamina passo per passo** il runbook e classifica ogni passo come manuale/automatico dando il verdetto `NFR9` — nessun costo manuale cresce con N — verificato contro un corso di lunghezza indefinita; (AC2) dichiara la soglia `M5` come **stima da tarare**, la metodologia di misura, e una **tabella di registrazione** del tempo; (AC3) dichiara il traguardo DoD (≥ 5) e **traccia** lo stato reale del contenuto. Il test `src/authoring-cost.test.ts` àncora meccanicamente il verdetto e la copertura di ogni passo del runbook, prova che le lezioni reali **validano** (`validateLessons` → `[]`) e tiene onesto il contatore. Le due parti che richiedono **esecuzione umana fuori dal repo** — la misura reale del tempo (guardare la fonte) e l'autorazione+revisione+commit di ≥ 4 lezioni ulteriori (la rilettura umana obbligatoria che un agente non può eseguire, FR11.2) — sono **dovute all'operatore**: la storia si finalizza a `awaiting-operator` con `operator_actions`, non a `blocked`.

## Boundaries & Constraints

**Always:**
- Il documento **esamina la procedura reale** (`docs/authoring-runbook.md`), non una sua parafrasi: enumera **ognuno** dei suoi passi e per ciascuno dice se è manuale o automatico e come cresce il suo costo al crescere di N (lezioni già autorate). Il verdetto `NFR9` è esplicito: **nessun passaggio manuale** ha un costo che cresce con N, e la verifica è contro un corso di **lunghezza non nota / non fissata** (AC1).
- Il documento distingue onestamente il costo **manuale** (dell'autore, che resta O(1) per lezione) dal costo **automatico** dei comandi che ri-processano tutte le N lezioni (`npm test`, `npm run check-contamination`, `npm run validate-content`, `npm run generate-content-seed`): quest'ultimo è calcolo automatico su contenuto minuscolo, non fatica manuale, e non viola `NFR9`.
- Il documento dichiara la soglia `M5` ≤ **30 minuti** (dalla visione all'esercizio giocabile) come **stima da tarare**, definisce **cosa** si misura (inizio = guardare la fonte; fine = esercizio giocabile/committato) e contiene una **tabella di registrazione** del tempo per lezione (AC2). Poiché nessuna misura reale esiste ancora — richiede l'esecuzione umana del flusso — la tabella parte con una riga **dovuta all'operatore**.
- Il documento dichiara il traguardo DoD (**almeno cinque** lezioni autorate, revisionate e validate; obiettivo undici) e **traccia lo stato reale**: il conteggio corrente e le lezioni ancora dovute (AC3).
- Coppia doc↔test come 6.1/6.2/6.3: `src/authoring-cost.test.ts` àncora le dichiarazioni obbligatorie e **accoppia** il documento al runbook (una riga di analisi per ciascun passo del runbook; se il runbook guadagna o perde un passo, il test è rosso finché l'analisi non lo copre) e al contenuto reale (`validateLessons(realLessonFiles()) === []`; conteggio del documento == conteggio reale).

**Block If:**
- (nessuno) — ogni parte costruibile da un agente (l'analisi `NFR9`, la metodologia e la tabella di misura, il tracciamento della DoD, il test-ancora) è costruita e committata. Le parti che dipendono da **esecuzione umana** — misurare il tempo reale guardando la fonte (AC2) e autorare+rileggere+committare ≥ 4 lezioni (AC3, la rilettura umana obbligatoria di FR11.2 non è delegabile a un agente) — sono **dovute all'operatore**: si finalizza a `awaiting-operator` con `operator_actions`, mai `blocked`.

**Never:**
- Non **autorare né committare lezioni di corso** in `content/lessons/`: le cinque lezioni sono la DoD e committarle richiederebbe la rilettura umana che un agente non può eseguire (coerente con lo `Never` di 6.2). L'unica prova sul contenuto è che le lezioni **esistenti** validano.
- Non **inventare** tempi di autorazione né dichiarare `M5` soddisfatta: nessuna misura reale è stata eseguita; il tempo va **registrato** dall'operatore.
- Non modificare lo schema, il validatore (`src/domain/content-validation.ts`), la union degli esercizi, né `content/lessons/01-la-particella-wo.json`.
- Non aggiungere alcun controllo alla **CI** (`.github/workflows/ci.yml`) né creare un **README di root** (territorio di Epic 7).
- Non scrivere né modificare `sprint-status.yaml`.
- Non rimuovere alcuna ancora testuale già imposta da `src/source-boundary.test.ts`, `src/authoring-runbook.test.ts` o `src/authoring-contamination.test.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Copertura passi (AC1) | i passi `### N.` di `docs/authoring-runbook.md` | l'analisi di `docs/authoring-cost.md` ha una riga per **ogni** numero di passo del runbook | manca una riga ⇒ test rosso |
| Verdetto NFR9 (AC1) | testo del documento | dichiara «nessun passaggio manuale … cresce» e «lunghezza non nota / non fissata» | ancora assente ⇒ test rosso |
| Soglia M5 (AC2) | testo del documento | dichiara `30 minuti`, «stima da tarare», e contiene la tabella di registrazione | ancora/tabella assente ⇒ test rosso |
| Lezioni reali validano (AC3) | `content/lessons/**/*.json` | `validateLessons(realLessonFiles())` → `[]` e conteggio ≥ 1 | issue reale ⇒ test rosso (guardia anti-vacuità) |
| Contatore onesto (AC3) | sentinella `authored-lessons: N` nel documento | `N` == numero reale di lezioni sotto `content/lessons/` | disallineamento ⇒ test rosso (chiede di aggiornare il documento) |
| Traguardo DoD (AC3) | testo del documento | dichiara «almeno cinque» e che lo stato attuale è **sotto** il traguardo (dovuto all'operatore) | ancora assente ⇒ test rosso |

</intent-contract>

## Code Map

- `docs/authoring-cost.md` (nuovo) -- il documento di sostenibilità. Stile e registro allineati a `docs/authoring-runbook.md`/`docs/contamination-check.md`. Sezioni: **Analisi NFR9 (AC1)** con una tabella «Passo | Manuale? | Costo in N | Perché» (una riga per ciascuno dei sette passi del runbook) e il verdetto esplicito; **Tempo di autorazione M5 (AC2)** con soglia, metodologia e tabella di registrazione (riga iniziale «da misurare» dovuta all'operatore); **Definition of Done (AC3)** con traguardo ≥ 5, la sentinella machine-readable `<!-- authored-lessons: 1 -->` e lo stato reale; **Collocazione e limite** (cosa è costruito, cosa è dovuto all'operatore).
- `src/authoring-cost.test.ts` (nuovo) -- test di igiene, modello `src/authoring-runbook.test.ts` (riusa il pattern `here`/`repoRoot`, `realLessonFiles()`, `validateLessons`). Verifica: (a) il doc esiste; (b) AC1 — estrae i numeri di passo del runbook da `^### (\d+)\.` e asserisce che l'analisi del doc ha una riga `| N |` per **ognuno** (stesso insieme), più le ancore del verdetto («nessun passaggio manuale … cresce», «non nota»/«non fissat»); (c) AC2 — ancore `30`, `minut`, `stima`/`tarare`, e presenza della tabella di registrazione; (d) AC3 — `validateLessons(realLessonFiles())` `=== []`, conteggio `>= 1`, sentinella `authored-lessons: N` == conteggio reale, e ancora del traguardo «almeno cinque»/`5`.
- `docs/authoring-runbook.md` -- **fonte esaminata** da AC1: i sette passi `### 1.`–`### 7.` (righe 30/40/57/77/136/177/197). Il test estrae i numeri di passo da qui: il documento nuovo deve coprirli tutti. **Non modificare** (preservare le ancore di `src/authoring-runbook.test.ts`); al massimo un rinvio in coda al nuovo doc, senza toccare righe ancorate.
- `content/lessons/01-la-particella-wo.json` -- l'**unica** lezione presente; oggetto del conteggio DoD (AC3) e della prova `validateLessons` → `[]`. Non modificata.
- `content/lessons/.gitkeep` -- non è `*.json`, quindi `realLessonFiles()` (filtra `.json`) non lo conta.
- `src/domain/content-validation.ts` -- `validateLessons(files: LessonFile[]): ContentIssue[]`, PURO: `[]` sse conforme; `LessonFile = { path, source }`. Importato dal test per provare che il contenuto reale valida.
- `docs/contamination-check.md` (righe 71, 122-145) -- precedente diretto: cita già «i trenta minuti della storia 6.4» e usa una **tabella di audit con riga dovuta all'operatore**; la sezione DoD/M5 del nuovo doc segue la stessa forma (stato reale + azione dovuta).
- `package.json` (righe 12-19) -- gli script `test`/`validate-content`/`check-contamination`/`generate-content-seed`: sono i passi **automatici** che l'analisi NFR9 cita come «ri-processano tutte le N lezioni ma sono automatici, non manuali».
- `_bmad-output/planning-artifacts/prds/prd-tsundoku-zero-2026-09-22/prd.md` (NFR9 riga 304; M5 righe 96-98; DoD §11 righe 357-371) -- fonte autorevole delle tre soglie citate dagli AC.

## Tasks & Acceptance

**Execution:**
- `docs/authoring-cost.md` (nuovo) -- scrivere il documento in italiano con le quattro sezioni della Code Map. L'analisi NFR9 (AC1) esamina i **sette** passi del runbook uno per uno (tabella con una riga per passo `1`–`7`, colonna manuale/automatico e costo in funzione di N) e chiude col verdetto esplicito (nessun costo manuale cresce con N; verificato contro corso di lunghezza non nota; i comandi che scalano sono automatici). La sezione M5 (AC2) dichiara la soglia 30 minuti come stima da tarare, la metodologia (inizio/fine della misura) e una tabella di registrazione con riga iniziale dovuta all'operatore. La sezione DoD (AC3) dichiara il traguardo ≥ 5, la sentinella `<!-- authored-lessons: 1 -->` e lo stato reale (1 lezione presente, ≥ 4 dovute). La sezione «Collocazione e limite» distingue ciò che è costruito da ciò che è dovuto all'operatore (misura reale, autorazione delle lezioni), sul modello di `docs/contamination-check.md`.
- `src/authoring-cost.test.ts` (nuovo) -- scrivere il test di igiene (modello `src/authoring-runbook.test.ts`): esistenza del doc; copertura di ogni passo del runbook (insieme dei numeri di passo del runbook ⊆ e == insieme delle righe di analisi del doc); ancore del verdetto NFR9; ancore M5 + tabella; `validateLessons(realLessonFiles()) === []` con conteggio ≥ 1; sentinella `authored-lessons` == conteggio reale; ancora del traguardo DoD.
- `docs/authoring-runbook.md` -- (facoltativo, minimo) aggiungere in coda un rinvio a `docs/authoring-cost.md` come documento di accettazione dell'epica, **senza** toccare le righe ancorate da `src/authoring-runbook.test.ts`.

**Acceptance Criteria:**
- Given `docs/authoring-cost.md`, when se ne esamina la sezione NFR9 (AC1), then contiene una riga di analisi per **ognuno** dei passi del runbook e dichiara che nessun passaggio manuale ha un costo che cresce col numero di lezioni già autorate, verificato contro un corso di **lunghezza non nota** (non un totale fissato).
- Given il documento, when se ne legge la sezione M5 (AC2), then dichiara la soglia di **30 minuti** come **stima da tarare** e fornisce una **tabella di registrazione** del tempo per lezione; nessun tempo è inventato — la misura reale è dovuta all'operatore.
- Given `content/lessons/`, when il test esegue `validateLessons(realLessonFiles())`, then il risultato è `[]` (le lezioni esistenti validano) e il conteggio reale (≥ 1) coincide con la sentinella `authored-lessons` del documento; il documento dichiara il traguardo DoD di **almeno cinque** lezioni e che lo stato attuale è sotto il traguardo (AC3).
- Given la suite, when `npm test` viene eseguito, then `src/authoring-cost.test.ts` è verde e `npm run validate-content`/`npm run typecheck`/`npm run lint` restano verdi (nessuna modifica a schema, validatore o contenuto reale; ancore di 6.1/6.2/6.3 preservate).

## Design Notes

- **Perché `awaiting-operator`.** Due dei tre AC hanno un deliverable che dipende da **esecuzione umana fuori dal repo**. AC2 chiede il **tempo misurato** dalla visione all'esercizio giocabile: richiede di guardare la fonte e cronometrare un'esecuzione reale — un agente non può. AC3 chiede **≥ 5 lezioni autorate e validate**: autorare e committare lezioni di corso richiede la **rilettura umana obbligatoria** (FR11.2), che è per progetto non delegabile a un agente (lo `Never` di 6.2 lo vieta esplicitamente). L'agente costruisce e prova tutto il costruibile — l'analisi NFR9 (AC1, interamente documentale), la metodologia e la tabella di misura, il tracciamento della DoD, il test-ancora — e finalizza a `awaiting-operator` enumerando in `operator_actions` la misura del tempo e l'autorazione delle lezioni mancanti. Stessa distinzione di 6.3 (non 6.2): qui il deliverable dipende da un input/azione esterna, non è un semplice passo di flusso futuro.
- **Perché il test àncora l'analisi, non «dimostra» NFR9.** AC1 chiede che la procedura sia **esaminata**: il deliverable è l'analisi ragionata, non una proprietà del repo calcolabile a valle. Il test garantisce che l'esame **esista**, **copra ogni passo** del runbook (accoppiamento load-bearing: un passo nuovo o rimosso rende il test rosso) e **dichiari il verdetto**. È lo stesso registro di onestà dell'epica: 6.3 dichiara di essere «l'unico anello che non si chiude a valle», 6.2 nota che le garanzie umane sono «prosa fissata da ancore testuali, non meccanismi». La parte genuinamente meccanica di AC3 — le lezioni reali **validano** — è invece provata sul ritorno reale di `validateLessons`.
- **Il contatore onesto è una forcing function voluta.** La sentinella `authored-lessons: N` accoppiata al conteggio reale rende rosso il test se qualcuno aggiunge una lezione senza aggiornare il documento (o viceversa): il tracker DoD non può mentire in silenzio. Il messaggio d'errore del test dice esattamente come riallineare. Non si asserisce `N >= 5` (sarebbe rosso ora e un agente non può renderlo verde): il traguardo ≥ 5 resta prosa dichiarata + `operator_actions`, il conteggio resta onesto.
- **Costo manuale vs automatico.** Il punto sottile di NFR9: comandi come `check-contamination`/`validate-content`/`generate-content-seed`/`npm test` ri-processano **tutte** le N lezioni a ogni esecuzione (calcolo O(N)), ma è **calcolo automatico** su contenuto minuscolo, non fatica manuale — e la fatica dell'autore per lezione resta O(1). La scelta «indicizzare per concetto, non per episodio» (6.1) è ciò che tiene O(1) anche la scelta di `order`/identità (l'autore prende la prossima posizione libera; l'unicità la impone il cancello, automaticamente). Il documento deve dirlo esplicitamente, altrimenti l'analisi sembra ignorare l'O(N) evidente.

## Verification

**Commands:**
- `npx vitest run src/authoring-cost.test.ts` -- expected: pass (doc con tutte le ancore; copertura dei passi; lezioni reali validano; contatore allineato).
- `npm run validate-content` -- expected: exit 0 (contenuto reale invariato).
- `npm run typecheck` -- expected: nessun errore.
- `npm run lint` -- expected: nessun errore.
- `npm test` -- expected: suite verde, incluse `source-boundary`, `authoring-runbook`, `authoring-contamination` (ancore preservate).

**Manual checks (if no CLI):**
- Leggere `docs/authoring-cost.md`: la sezione NFR9 esamina ognuno dei sette passi del runbook con un verdetto esplicito; la sezione M5 dichiara la soglia come stima da tarare con una tabella di registrazione vuota (dovuta all'operatore); la sezione DoD dichiara ≥ 5 e lo stato reale (1 lezione). Nessun tempo è inventato e nessuna lezione di corso è stata committata.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 1, low 2)
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[medium]` `[patch]` (verification-gap) Il verdetto DoD non era accoppiato al conteggio: la sentinella `authored-lessons` teneva onesto il **numero**, ma la prosa «sotto il traguardo» sarebbe rimasta verde e **stantia** quando l'operatore raggiunge le cinque lezioni (e, peggio, il ramo `≥ 5` del test si sarebbe scontrato con la prosa esplicativa che nomina «sotto il traguardo»). Aggiunta una seconda sentinella machine-readable `<!-- dod-status: below-target|met -->`, **distinta** dalla prosa, accoppiata dal test al conteggio reale (`< 5` ⇒ `below-target`; `≥ 5` ⇒ `met`, con l'altra assente). `operator_actions` esteso a imporre il flip della sentinella al raggiungimento delle cinque. Rimossa l'ancora debole `/\b5\b/` (soddisfatta anche da «passo 5»).
  - `[low]` `[patch]` (blind-hunter) Errore fattuale nella sezione M5: «i **venti gradi** delle soglie del controllo anti-contaminazione» — quelle soglie sono `MIN_JA_RUN` (8 caratteri) / `MIN_PROSE_WORDS` (6 parole), non gradi. Analogia corretta in «8 caratteri / 6 parole».
  - `[low]` `[patch]` (blind-hunter/edge-case) Accoppiamento doc↔runbook fragile e non documentato: il test estrae i passi con `### N.` ma le righe d'analisi usano `| N —` con la sola em-dash. Classe di caratteri della regex di riga allargata a `[—–\-|]` (trattino ASCII / en-dash / em-dash / pipe) e aggiunta una nota di manutenzione nel doc che documenta l'accoppiamento (una riga per passo, copertura esatta).

Findings scartati (reject, 14): tutti low, oltre gli AC o by-design/speculativi. **blind-hunter**: «5 vs 11» è fedele al PRD §11 (soglia cinque, obiettivo undici, entrambi dichiarati e riconciliati nel doc); M5 senza forcing-function automatica (è operator-owed e non forzabile in CI, come l'anti-contaminazione di 6.3); crescita del passo-5 già indirizzata dal doc («rilegge la lezione appena scritta, non le N precedenti»); framework «solo verdetto positivo» (l'analisi riflette la procedura reale attuale); ancore di prosa del verdetto «permissive» (proprietà voluta degli anchor-test, confermata in 6.1/6.2); nessuna asserzione sul passo-7 seed (deployment oltre AC3, già scartato in 6.2); «giocabile» include già la rigenerazione seed (definizione difendibile); drift futuro fra la formulazione DoD del runbook e del cost-doc (entrambi citano il PRD; over-coupling non giustificato); nessun verdetto sul confine anti-contaminazione della lezione campione (audit retroattivo = territorio di 6.3, già `awaiting-operator`). **edge-case**: sub-heading speculativo `### 8.1` (nessuno esiste; runbook piatto `### N.`); riga-tabella con cifra iniziale estranea (nessuna; la riga M5 inizia con `_`); `.json` non-lezione annidato in `content/lessons/` (rispecchia il cancello reale, che usa lo stesso `realLessonFiles()`); `5` a larghezza piena che romperebbe `/\b5\b/` (ancora rimossa comunque); CRLF (nessun rischio per le ancore attuali). L'**intent-alignment** auditor (descrittivo) ha confermato che il diff implementa la lettura «analisi documentale + `awaiting-operator`» imposta dalla direttiva, con AC1 le cui superfici coincidono e AC2/AC3 dovute all'operatore (disclosed + `operator_actions`).

## Auto Run Result

Status: awaiting-operator (l'accettazione documentale dell'epica 6 — analisi NFR9, metodologia + tabella M5, tracciamento DoD, test-ancora — è costruita, provata e committata; la **misura reale del tempo** e l'**autorazione di ≥ 4 lezioni ulteriori** sono dovute all'operatore)

**Sintesi del cambiamento.** La storia è l'**accettazione dell'epica 6** (`chore`): una coppia doc↔test che esamina la pipeline contro i tre requisiti che la governano. Il nuovo `docs/authoring-cost.md` (1) **analisi NFR9** (AC1): esamina passo per passo i sette passi di `docs/authoring-runbook.md` in una tabella «manuale/automatico · costo in N», col verdetto esplicito che nessun costo **manuale** cresce con N (verificato contro un corso di lunghezza non nota; i comandi O(N) sono calcolo **automatico**, non fatica manuale) e il punto sottile dell'indicizzazione-per-concetto che tiene O(1) la scelta di `order`/identità; (2) **M5** (AC2): dichiara la soglia di 30 minuti come **stima da tarare**, la metodologia di misura (inizio = guardare la fonte; fine = esercizio giocabile/committato) e una **tabella di registrazione** la cui unica riga è «da misurare» (nessun tempo inventato); (3) **DoD** (AC3): dichiara il traguardo ≥ 5 (obiettivo 11), la sentinella `authored-lessons: N` e la sentinella di verdetto `dod-status: below-target|met`, con lo stato reale (1 lezione). Il test `src/authoring-cost.test.ts` accoppia meccanicamente l'analisi al runbook (una riga per passo, copertura esatta), prova che le lezioni **reali validano** (`validateLessons` → `[]`) e tiene onesti sia il **conteggio** sia il **verdetto**. Le due parti non eseguibili da un agente — la misura reale del tempo (guardare la fonte) e l'autorazione+revisione umana+commit di ≥ 4 lezioni (FR11.2 non delegabile) — sono enumerate in `operator_actions`; da qui `awaiting-operator`, non `done` né `blocked`.

**File toccati.**
- `docs/authoring-cost.md` (nuovo) — il documento di sostenibilità (analisi NFR9 AC1, metodologia+tabella M5 AC2, tracciamento DoD AC3 con due sentinelle, collocazione e limite).
- `src/authoring-cost.test.ts` (nuovo) — test-ancora (6 test): esistenza; copertura esatta dei passi del runbook; ancore del verdetto NFR9; ancore M5 + tabella; `validateLessons(realLessonFiles()) === []` + conteggio ≥ 1 + sentinella `authored-lessons` allineata; verdetto DoD accoppiato al conteggio via sentinella `dod-status`.
- `docs/authoring-runbook.md` — sezione «Accettazione» in coda, rinvio al nuovo doc (nessuna riga ancorata da `src/authoring-runbook.test.ts` toccata).
- `_bmad-output/implementation-artifacts/spec-6-4-...md` — questo spec (frontmatter `awaiting-operator` + `operator_actions`, triage log, questo risultato).

**Breakdown dei findings.** intent_gap 0 · bad_spec 0 · patch 3 (1 medium, 2 low) · defer 0 · reject 14 (tutti low). Nessun loopback (nessun intent_gap/bad_spec).

**Raccomandazione di follow-up review.** `true`. Patch di questo pass per severità: high 0, medium 1, low 2. Score = 3×1 + 1×2 = **5** (≥ 5) → `followup_review_recommended: true`.

**Verifica eseguita.**
- `npx vitest run src/authoring-cost.test.ts` → 6/6 pass.
- `npm run validate-content` → exit 0 (contenuto reale invariato).
- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0.
- `npm test` → 96 file, 1159 test, tutti verdi (`source-boundary`, `authoring-runbook`, `authoring-contamination` inclusi: ancore preservate).

**Rischi residui.** (1) AC2 e AC3 restano aperti fino all'esecuzione dell'operatore: la tabella M5 è a «da misurare» e la DoD è a 1/5 (`dod-status: below-target`). (2) Il ramo `≥ 5` del test del verdetto DoD sarà esercitato per la prima volta quando l'operatore autora le lezioni mancanti e porta la sentinella a `met` — è la forcing-function prevista. (3) Le garanzie di AC1 sul contenuto dell'analisi sono per progetto **prosa** fissata da ancore testuali + accoppiamento strutturale (copertura dei passi), non una dimostrazione meccanica del costo O(1): coerente col registro di onestà dell'epica (6.3 «unico anello non a valle»). (4) `sprint-status.yaml` è bookkeeping dell'orchestratore: non toccato da questo run.
