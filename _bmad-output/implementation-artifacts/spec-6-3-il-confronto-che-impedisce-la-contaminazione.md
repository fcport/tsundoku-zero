---
title: 'Il confronto che impedisce la contaminazione'
type: 'feature' # feature | bugfix | refactor | chore
created: '2026-09-26'
status: 'awaiting-operator' # draft | ready-for-dev | in-progress | in-review | done | blocked | awaiting-operator
baseline_revision: '0fed398fbbed445c9612768bcb217ebb8ae15721'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: [oversized]
deferred: []
operator_actions:
  - >-
    Metti il transcript privato della lezione campione della storia 2.7
    (content/lessons/01-la-particella-wo.json) nella cartella .authoring/, che
    non è mai versionata (storia 6.1).
  - >-
    Esegui `npm run check-contamination` per confrontare ogni frase giapponese e
    ogni spiegazione delle lezioni esistenti con quel transcript.
  - >-
    Per ogni sovrapposizione non banale segnalata, riscrivi la frase o la
    spiegazione partendo dal fatto (docs/authoring-pipeline.md), oppure — se è un
    esempio canonico pubblico — motivala in .authoring/contamination-allowlist.json
    con una reason non vuota.
  - >-
    Registra l'esito reale (data + verdetto) nella tabella di audit retroattivo
    di docs/contamination-check.md, sostituendo la riga «da verificare» della
    lezione campione.
---

<intent-contract>

## Intent

**Problem:** Il confine fatto/formulazione è documentato (6.1, `docs/authoring-pipeline.md`) e la procedura è scritta (6.2, `docs/authoring-runbook.md`), ma l'unica difesa contro la contaminazione della fonte è oggi la **rilettura umana** (passo 5 del runbook): dipende dall'attenzione dell'autore. Manca lo **strumento meccanico** che confronti ciò che è stato prodotto con il testo di partenza e segnali le sovrapposizioni non banali.

**Approach:** Costruire un controllo di autorazione, locale, che confronta **ogni frase giapponese e ogni spiegazione** di `content/lessons/**/*.json` con il/i **transcript** della cartella di lavoro `.authoring/` e segnala le sovrapposizioni verbatim non banali. Il nucleo di confronto è **puro** (`scripts/lib/contamination.ts`), esposto da un CLI (`npm run check-contamination`) e provato da un test di igiene con **fixture sintetiche** (nessun transcript reale nel repo). La collocazione e il limite sono documentati (`docs/contamination-check.md`) con test-ancora sul modello 6.1/6.2. Il controllo è cablato nella **revisione obbligatoria** del runbook, non è facoltativo.

## Boundaries & Constraints

**Always:**
- Il controllo confronta **ogni frase giapponese** (`sentence.kanji`, `sentence.kana`) **e ogni spiegazione** (`explanation.en`, `explanation.it`) prodotte contro il testo del transcript (AC1); segnala ogni **sovrapposizione non banale** (run verbatim ≥ soglia dopo normalizzazione NFKC).
- Una sovrapposizione segnalata si **riscrive prima del commit**, oppure si **motiva per iscritto** se è un esempio canonico pubblico (AC2). La motivazione è meccanica: una voce di allowlist con `reason` **non vuota** riclassifica la sovrapposizione come «motivata»; `reason` vuota **non** la sopprime.
- Il nucleo di confronto è **puro** (nessun I/O): il glob dei transcript, la lettura e l'exit code vivono nel CLI (modello `scripts/validate-content.ts` ⇄ `src/domain/content-validation.ts`).
- Le soglie di «non banale» sono **costanti dichiarate e tarabili** (la soglia è una stima da tarare, come per i trenta minuti di 6.4).
- La documentazione dichiara che il controllo **non può essere un cancello di CI** — il transcript non entra nel repository (6.1, `.gitignore`) — ed è **l'unico anello** della catena di qualità che non si chiude a valle (AC4).
- L'audit retroattivo (AC3) si applica alla lezione campione di 2.7 (`content/lessons/01-la-particella-wo.json`) e a ogni lezione autorata prima del controllo; l'esito è registrato nella tabella di audit di `docs/contamination-check.md`.

**Block If:**
- (nessuno) — ogni parte costruibile da un agente è costruita e committata. La **esecuzione retroattiva** del controllo contro il transcript **privato** (assente dal repo per 6.1, e assente da questo working tree: nessuna `.authoring/`) è l'unica azione che richiede l'operatore; la storia si **finalizza a `awaiting-operator`** con `operator_actions`, non `blocked`.

**Never:**
- Non aggiungere il controllo alla **CI** (`.github/workflows/ci.yml`): resta fuori, per costruzione (AC4).
- Non versionare transcript, sottotitoli o trascrizioni, **nemmeno come fixture**: le fixture del test sono testo **sintetico** e vivono in una temp dir fuori dal repo, mai sotto `content/` né `src/`.
- Non modificare lo schema, il validatore (`src/domain/content-validation.ts`), la union degli esercizi, né **riscrivere** `content/lessons/01-la-particella-wo.json` (la riscrittura di eventuali sovrapposizioni è decisione dell'autore/operatore dopo aver eseguito il controllo).
- Non scrivere né modificare `sprint-status.yaml`.
- Non rimuovere alcuna ancora testuale già imposta da `src/source-boundary.test.ts` (pipeline) o `src/authoring-runbook.test.ts` (runbook).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sovrapposizione JA | frase prodotta e transcript condividono un run ≥ soglia (NFKC) | overlap segnalato: campo, span, lunghezza | — |
| Contenuto pulito | condivisi solo run brevi/comuni (< soglia) | nessun overlap | — |
| Sovrapposizione in prosa | `explanation` e transcript condividono ≥ soglia parole consecutive | overlap segnalato sul campo `explanation.*` | — |
| Esempio canonico motivato | overlap presente + allowlist `{span, reason≠""}` | riclassificato «motivato»: non fa fallire | `reason` vuota ⇒ resta un fallimento |
| Nessun transcript | `.authoring/` assente o senza file-fonte | messaggio esplicito + exit non-zero (niente da confrontare ⇒ nulla verificato) | non un falso verde |
| CLI su contenuto reale | `npm run check-contamination` con transcript in `.authoring/` | report + exit 0 se nessuna sovrapposizione non motivata, altrimenti non-zero | JSON lezione malformato ⇒ errore leggibile |

</intent-contract>

## Code Map

- `scripts/lib/contamination.ts` (nuovo) -- **nucleo puro**: `normalizeJa`/`normalizeProse` (NFKC + strip), `collectProducedTexts(lesson)` (estrae frasi kanji/kana + spiegazioni en/it con etichetta di campo), `detectOverlaps(produced, transcripts, options?)` (run verbatim massimali ≥ soglia; JA per n-gram di carattere, prosa per n-gram di parola; allowlist con `reason` obbligatoria), costanti `MIN_JA_RUN`/`MIN_PROSE_WORDS` e tipi `ProducedText`/`ContaminationOverlap`/`MotivatedException`. Nessun `console`, nessun `process`, nessun I/O.
- `scripts/check-contamination.ts` (nuovo) -- **CLI**: glob dei transcript sotto `.authoring/` (`*.txt`/`*.vtt`/`*.srt`/`*.transcript*`), glob lezioni sotto `content/lessons/`, `parseLesson` per ogni file, `collectProducedTexts` + `detectOverlaps`, report su stdout, exit non-zero se restano sovrapposizioni non motivate o se non c'è transcript. Funzione composta `runCheck({transcriptDir, lessonsDir, allowlistPath})` esportata; **guardia entrypoint** `process.env.VITEST === undefined` (modello `scripts/validate-content.ts`).
- `docs/contamination-check.md` (nuovo) -- doc dello strumento: cosa confronta (AC1), come si esegue, «non banale» (soglie), risposta a una segnalazione (AC2), **collocazione e limite** (AC4: non-cancello-di-CI, unico anello non a valle, per 6.1), e la **tabella di audit retroattivo** (AC3) con la riga per `01-la-particella-wo.json`.
- `src/authoring-contamination.test.ts` (nuovo) -- test di igiene (modello `src/source-boundary.test.ts` + `src/authoring-runbook.test.ts`): (a) `detectOverlaps`/`collectProducedTexts` sulle fixture sintetiche della I/O Matrix; (b) `runCheck` end-to-end su temp dir (transcript+lezione sintetici) via `mkdtempSync(join(tmpdir(),...))`; (c) ancore obbligatorie di `docs/contamination-check.md` (AC4); (d) script `check-contamination` presente in `package.json`.
- `package.json` (righe 15-18) -- aggiungere `"check-contamination": "vite-node scripts/check-contamination.ts"` (modello `validate-content`/`generate-content-seed`).
- `docs/authoring-runbook.md` (passo 5, righe ~135-156) -- cablare `npm run check-contamination` nella **revisione umana obbligatoria**: il controllo meccanico ora **esiste**. Preservare tutte le ancore di `src/authoring-runbook.test.ts` (revisione umana obbligatoria, mai a runtime, ecc.).
- `docs/authoring-pipeline.md` (righe 11-14) -- aggiornare il forward-ref «lo strumento di confronto anti-contaminazione è della 6.3» in un rinvio al nuovo `docs/contamination-check.md`. Non toccare le sezioni ancorate da `src/source-boundary.test.ts` (motori/treno/verbo/copula/c618164).
- `src/domain/exercise.ts` / `src/domain/lesson.ts` / `src/domain/content-validation.ts` -- forma di `Lesson`/`Exercise` (`sentence.kanji|kana`, `explanation.en|it`) e `parseLesson`: fonte per l'estrazione e per parsare i file lezione nel CLI (import di dominio consentito agli script, come `validate-content`).
- `content/lessons/01-la-particella-wo.json` -- la lezione campione (2.7): oggetto dell'audit retroattivo (AC3); **non modificata** da questa storia.
- `.gitignore` (blocco FR11.7) e `.github/workflows/ci.yml` -- il transcript e `.authoring/` sono già esclusi (ragione per cui il controllo non è in CI); `ci.yml` **non** va toccato.

## Tasks & Acceptance

**Execution:**
- `scripts/lib/contamination.ts` (nuovo) -- scrivere il nucleo puro: normalizzazione, estrazione, `detectOverlaps` con run massimali ≥ soglia e allowlist a `reason` obbligatoria, costanti tarabili e tipi.
- `scripts/check-contamination.ts` (nuovo) -- scrivere il CLI: glob transcript/lezioni, `parseLesson`, comporre nucleo + report + exit code; `runCheck` esportata; guardia entrypoint. Nessun transcript ⇒ messaggio + exit non-zero.
- `docs/contamination-check.md` (nuovo) -- scrivere il doc con le dichiarazioni obbligatorie (AC1, AC2, AC4) e la tabella di audit retroattivo (AC3).
- `package.json` -- aggiungere lo script npm `check-contamination`.
- `docs/authoring-runbook.md` -- passo 5: cablare `npm run check-contamination` nella revisione obbligatoria (il controllo meccanico ora esiste), preservando le ancore esistenti.
- `docs/authoring-pipeline.md` -- aggiornare il forward-ref a 6.3 con rinvio a `docs/contamination-check.md`, senza toccare le sezioni ancorate.
- `src/authoring-contamination.test.ts` (nuovo) -- test di igiene: nucleo puro sulle fixture sintetiche, `runCheck` su temp dir, ancore del doc, script npm presente.

**Acceptance Criteria:**
- Given una frase o spiegazione prodotta che condivide un run verbatim ≥ soglia con un transcript sintetico, when `detectOverlaps`/`runCheck` viene eseguito, then l'overlap è segnalato (campo + span); contenuto sotto soglia non produce alcun overlap.
- Given una sovrapposizione segnalata, when esiste una voce di allowlist con `reason` non vuota per quello span, then è riclassificata «motivata» e non fa fallire; con `reason` vuota resta un fallimento.
- Given `docs/contamination-check.md`, when viene letta, then dichiara che il controllo **non può essere un cancello di CI** (transcript fuori dal repo, 6.1) ed è **l'unico anello** non chiuso a valle, e registra l'audit retroattivo della lezione campione di 2.7 (esito o azione dovuta all'operatore).
- Given la suite, when `npm test` viene eseguito, then `src/authoring-contamination.test.ts` è verde e `npm run validate-content`/`npm run typecheck` restano verdi (nessuna modifica a schema, validatore o contenuto reale).

## Design Notes

- **Perché `awaiting-operator`.** AC3 chiede l'applicazione retroattiva del controllo **contro il transcript di partenza**, incluso quello della lezione campione. Il transcript è input **privato** che 6.1 tiene fuori dal repo: non è in questo working tree (nessuna `.authoring/`) e un agente non può procurarselo. L'agente costruisce e prova lo **strumento** e ne documenta l'audit; l'**esecuzione** contro il transcript privato e la **registrazione dell'esito reale** sono owed all'operatore. Distinto da 6.2 (dove le azioni umane erano passi di flusso futuri, non deliverable della storia): qui l'audit retroattivo è un deliverable esplicito di 6.3 che dipende da un input esterno. Alla fine del run: `status: awaiting-operator` + `operator_actions` (eseguire `npm run check-contamination` contro il/i transcript privato/i della lezione campione, riscrivere o motivare, registrare l'esito nella tabella di audit).
- **Fixture sintetiche, mai reali.** Il test prova che il meccanismo segnala una sovrapposizione e assolve il contenuto pulito usando un «transcript» **inventato** (non materiale della fonte), in una temp dir fuori dal repo. Così AC1/AC2 sono verificati meccanicamente senza mai versionare un transcript — coerente con la ragione per cui il controllo non è in CI.
- **JA per carattere, prosa per parola.** Il giapponese non ha spazi: la soglia di «non banale» è un run di **caratteri** contigui (dopo NFKC + strip di spazi/punteggiatura). La prosa (en/it) usa n-gram di **parole** consecutive. Riportare il run **massimale** per non moltiplicare i sotto-run.
- **Coppia doc↔test come 6.1/6.2.** Le ancore di `docs/contamination-check.md` impediscono che una revisione futura rimuova in silenzio la dichiarazione del limite (non-CI, unico anello); la prova del nucleo impedisce che lo strumento smetta di segnalare.

## Verification

**Commands:**
- `npx vitest run src/authoring-contamination.test.ts` -- expected: pass (nucleo segnala/assolve; ancore del doc presenti; `runCheck` su temp dir).
- `npm run validate-content` -- expected: exit 0 (contenuto reale invariato).
- `npm run typecheck` -- expected: nessun errore.
- `npm run lint` -- expected: nessun errore (scripts sotto globals Node; nessuna violazione di confine).
- `npm test` -- expected: suite verde (incluse `source-boundary` e `authoring-runbook`, ancore preservate).

**Manual checks (if no CLI):**
- Leggere `docs/contamination-check.md`: le quattro dichiarazioni (cosa confronta, risposta alla segnalazione, non-cancello-di-CI/unico anello, audit retroattivo della lezione campione) sono presenti ed esplicite.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 0, medium 1, low 6)
- defer: 0
- reject: 6: (high 0, medium 0, low 6)
- addressed_findings:
  - `[medium]` `[patch]` Il contratto osservabile del CLI (`main` → `process.exit`, guardia entrypoint `VITEST`, `report`) non era esercitato: solo `runCheck().passed` in-process. Aggiunto un `describe` che SPAWNA il CLI reale (`vite-node`, `VITEST` rimosso dall'env — modello `src/validate-content-script.test.ts`): transcript non correlato ⇒ exit 0; kana prodotta verbatim ⇒ exit non-zero; nessun transcript ⇒ exit non-zero.
  - `[low]` `[patch]` L'allowlist di default era ancorata a `.authoring/` anche con una `transcriptDir` personalizzata (incoerente). Ora è derivata dalla `transcriptDir` (`join(transcriptDir, 'contamination-allowlist.json')`); doc aggiornato; test end-to-end con allowlist dentro la temp dir.
  - `[low]` `[patch]` Una voce di allowlist con `reason` non vuota il cui `span` non combacia con nulla era ignorata in silenzio (un refuso faceva credere di aver motivato). Aggiunto l'export puro `unusedAllowlistEntries`, esposto in `CheckResult.unusedAllowlist` e avvisato su stderr (non fa fallire); test del helper.
  - `[low]` `[patch]` `detectOverlaps` con soglia ≤ 0 (via `DetectOptions`) emetteva overlap a lunghezza zero spuri. Guardia `Math.max(1, …)` su entrambe le soglie; test.
  - `[low]` `[patch]` Il path lezione valida-JSON-ma-schema-invalido (`!parsed.ok`) non era testato (il test `{ broken` scattava sul `catch` di `JSON.parse`). Aggiunto un test con JSON valido ma non conforme ⇒ errore «non conforme allo schema».
  - `[low]` `[patch]` La scelta del `transcriptPath` col run massimale fra più transcript non era testata. Aggiunto un test multi-transcript.
  - `[low]` `[patch]` Precisione del doc `docs/contamination-check.md` (+ commento del CLI): è la cartella `.authoring/` (git-ignorata interamente), non l'estensione, a garantire l'esclusione; ritarare le soglie può invalidare gli `span` in allowlist; `01-la-particella-wo.json` è al momento l'unica lezione (tabella completa per ora); una `transcriptDir` personalizzata sposta anche l'allowlist.

Findings scartati (reject, 6): tutti oltre gli AC o by-design. (1) Campi `answer`/`distractors` degli esercizi non confrontati — fuori scope per l'autorità dell'intent: AC1 nomina «ogni **frase** giapponese» (= `sentence`) «e ogni **spiegazione**»; le opzioni non sono frasi, e per `assemble` le tessere ricompongono la `sentence` (già coperta). (2) `findRuns` salta un run distinto annidato dopo `i += best` — by-design: la regione che lo contiene è già segnalata come contaminata, l'informazione di flag non si perde. (3) Esclusione dell'allowlist per basename in `discoverTranscripts` è codice difensivo morto (`.json` non combacia con `isTranscriptFile`) — innocuo. (4) Performance `O(prodotto × transcript)` di `findRuns` — strumento locale su contenuto minuscolo (frasi), non un cancello di CI. (5) Test di campo vuoto/solo-punteggiatura — `nonEmptyString` + `normalizeJa` producono già `''`/`[]` gestiti senza crash da `findRuns`. (6) L'intent-alignment segnalava che `status: awaiting-operator` + `operator_actions` non erano nel frontmatter: è la fase di **Finalize** (eseguita ora), non un difetto del diff.

## Auto Run Result

Status: awaiting-operator (lo strumento anti-contaminazione è costruito, provato, documentato e committato; l'esecuzione retroattiva contro il transcript privato è dovuta all'operatore)

**Sintesi del cambiamento.** La storia costruisce il controllo meccanico anti-contaminazione (FR11.8): un nucleo **puro** (`scripts/lib/contamination.ts`) che confronta ogni frase giapponese (`sentence.kanji`/`kana`) e ogni spiegazione (`explanation.en`/`it`, più il `title`) prodotte con il/i transcript e segnala i run verbatim non banali (JA per carattere ≥ `MIN_JA_RUN`, prosa per parola ≥ `MIN_PROSE_WORDS`, run massimale, allowlist a `reason` obbligatoria); un CLI (`scripts/check-contamination.ts`, `npm run check-contamination`) che fa l'I/O e traduce l'esito in exit code; il doc `docs/contamination-check.md` (cosa confronta AC1, risposta alla segnalazione AC2, non-cancello-di-CI/unico anello AC4, tabella di audit retroattivo AC3) con test-ancora; il test di igiene `src/authoring-contamination.test.ts`; il cablaggio nella revisione obbligatoria del runbook (passo 5) e il rinvio dalla pipeline. L'unica parte NON eseguibile da un agente — l'esecuzione retroattiva contro il transcript **privato** della lezione campione (assente dal repo per 6.1) e la registrazione dell'esito reale (AC3) — è enumerata in `operator_actions`; da qui `awaiting-operator`, non `done` né `blocked`.

**File toccati.**
- `scripts/lib/contamination.ts` (nuovo) — nucleo puro: normalizzazione JA/prosa, `collectProducedTexts`, `detectOverlaps` (con guardia soglia ≥ 1), `unusedAllowlistEntries`, costanti e tipi.
- `scripts/check-contamination.ts` (nuovo) — CLI: glob transcript/lezioni, `parseLesson`, report + exit code; `runCheck` con allowlist derivata dalla `transcriptDir`; avviso su allowlist inutilizzata; guardia entrypoint `VITEST`.
- `docs/contamination-check.md` (nuovo) — doc dello strumento (AC1/AC2/AC4) + tabella di audit retroattivo (AC3).
- `src/authoring-contamination.test.ts` (nuovo) — 34 test: nucleo puro, `runCheck` su temp dir, 3 spawn del CLI reale (contratto exit-code), ancore del doc, script npm.
- `package.json` — script `check-contamination`.
- `docs/authoring-runbook.md` — passo 5: `npm run check-contamination` cablato nella revisione obbligatoria (ancore preservate).
- `docs/authoring-pipeline.md` — forward-ref a 6.3 → `docs/contamination-check.md` (sezioni ancorate intatte).
- `_bmad-output/implementation-artifacts/spec-6-3-...md` — questo spec.

**Breakdown dei findings.** intent_gap 0 · bad_spec 0 · patch 7 (1 medium, 6 low) · defer 0 · reject 6 (tutti low). Nessun loopback (nessun intent_gap/bad_spec).

**Raccomandazione di follow-up review.** `true`. Patch di questo pass per severità: medium 1, low 6, high 0. Score = 3×1 + 1×6 = 9 (≥ 5) → `followup_review_recommended: true`.

**Verifica eseguita.**
- `npx vitest run src/authoring-contamination.test.ts` → 34/34 pass (incl. 3 spawn del CLI reale).
- `npm run validate-content` → exit 0 (contenuto reale invariato).
- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0.
- `npm test` → 95 file, 1153 test, tutti verdi (`source-boundary` e `authoring-runbook` inclusi: ancore preservate).

**Rischi residui.** (1) AC3 resta aperto fino all'esecuzione dell'operatore contro il transcript privato: la tabella di audit è a «da verificare» per `01-la-particella-wo.json`. (2) Le soglie (8 caratteri / 6 parole) sono stime da tarare; ritararle invalida gli `span` già in allowlist (documentato). (3) Il controllo è per costruzione **fuori dalla CI** (AC4): la sua unica applicazione è locale, durante la revisione obbligatoria — non c'è forcing function automatica a valle, per progetto.
