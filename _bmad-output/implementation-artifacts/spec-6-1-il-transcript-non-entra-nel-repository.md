---
title: 'Il transcript non entra nel repository'
type: 'chore' # feature | bugfix | refactor | chore
created: '2026-09-26'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: 'c50a8e5208e3c5fdbba890c5e01f695cd730255a'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Il materiale della fonte — transcript, sottotitoli, trascrizioni — è opera protetta: un commit distratto trasformerebbe un problema evitato per costruzione in un problema reale. Oggi l'esclusione esiste in `.gitignore` ma non è protetta da nulla (una modifica futura la toglierebbe in silenzio), e non c'è documentazione che dichiari il confine fra **fatto** (libero) e **formulazione** (protetta) che governa l'intera pipeline di autorazione.

**Approach:** Rendere l'esclusione del transcript esplicita e auto-documentata in `.gitignore`; bloccarla con un test di igiene di livello repo (sul modello di `src/deploy-config.test.ts`) che verifica meccanicamente sia i pattern di `.gitignore` sia che un transcript nella cartella di lavoro dell'autore risulti non tracciabile; scrivere la documentazione della pipeline che dichiara i tre principi anti-contaminazione, con l'esempio concreto del caso in cui il progetto stesso ci era caduto.

## Boundaries & Constraints

**Always:**
- Transcript, sottotitoli e trascrizioni non entrano mai nel repository; l'esclusione è dichiarata **esplicitamente** in `.gitignore` con un commento che ne dà la ragione.
- La documentazione della pipeline dichiara: dal transcript si estraggono **fatti**, mai formulazioni; parafrasare con i sinonimi una spiegazione altrui resta opera derivata; le **metafore didattiche** della fonte non si riusano.
- L'esempio concreto nel doc è tratto dalla storia reale del progetto (PRD §2 / commit `c618164`): l'uso di "motori" per le tre chiusure di frase, poi corretto in verbo / copula / aggettivo in い. Non inventarne uno.
- Gli esempi propri del doc usano solo terminologia linguistica standard, mai la metafora della fonte — il doc non deve ricommettere l'errore che documenta.

**Block If:**
- L'esempio concreto della metafora non fosse verificabile nella storia del progetto — non fabbricarne uno di comodo. (Verificato in planning: esiste, non blocca.)

**Never:**
- Non versionare alcun transcript, sottotitolo o trascrizione, nemmeno come fixture.
- Non trasformare il confronto anti-contaminazione in un cancello di CI: il transcript non è nel repo, quindi la CI non ha il testo con cui confrontare (è dominio della storia 6.3, da dichiarare lì).
- Non implementare la procedura operativa completa (storia 6.2) né lo strumento di confronto (storia 6.3): 6.1 stabilisce solo il confine con la fonte.
- Non scrivere né modificare `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Transcript in cartella di lavoro | `.authoring/cure-dolly-12.txt` | `git check-ignore` → ignorato (exit 0) | — |
| Sottotitoli | `lezione.vtt`, `lezione.srt` | ignorati | — |
| Transcript per estensione | `x.transcript`, `x.transcript.txt`, `transcripts/x.txt` | ignorati | — |
| Contenuto di lezione (controllo) | `content/lessons/01-la-particella-wo.json` | **NON** ignorato (tracciato) | atteso: `git check-ignore` exit 1 |

</intent-contract>

## Code Map

- `.gitignore` -- righe ~44-65: sezione FR11.7 già presente, esclude `*.transcript`, `*.transcript.txt`, `*.vtt`, `*.srt`, `transcripts/`, `.transcripts/`, `.authoring/`. Il commento cita `storie 2.1 e 2.9` (2.9 non esiste). Da rifinire: nominare esplicitamente transcript/sottotitoli/trascrizioni, correggere il rinvio, **preservare tutti i pattern esistenti**.
- `docs/i18n-boundary.md`, `docs/session-keyboard-contract.md` -- stile di casa dei doc di confine in `docs/` (registro, struttura a sezioni). Il nuovo doc lo rispecchia.
- `src/deploy-config.test.ts` -- **template** del test di igiene: legge un file di config di livello repo e ne blocca la regressione ("CI rossa, non produzione rotta"), citando l'azione-operatore quando il comportamento reale è esterno. Modellare il nuovo test su questo (`readFileSync` + `resolve(here, '..')`).
- `src/boundaries.test.ts` -- precedente di test di configurazione di livello repo eseguiti da `src/`.
- `_bmad-output/planning-artifacts/prds/prd-tsundoku-zero-2026-09-22/prd.md` -- §2 (righe 49-84): fonte canonica delle regole fatto/formulazione e dell'esempio concreto (tabella Consentito/Vietato; "Le metafore però sono sue"). Distillare, non copiare.
- commit `c618164` ("Chiude OQ-7 e UX-DR8…") -- evidenza del caso concreto: il PRD usava "motori", il registro OQ-7 proponeva "riconoscere il motore"; corretto in verbo / copula / aggettivo in い.
- `content/lessons/01-la-particella-wo.json` -- percorso di controllo per l'asserzione "non ignorato".

## Tasks & Acceptance

**Execution:**
- `.gitignore` -- rifinire la sezione FR11.7: il commento nomina esplicitamente **transcript, sottotitoli e trascrizioni** e ne dà la ragione (fonte protetta; si estraggono fatti, si riscrive da zero; la parafrasi resta derivata); correggere il rinvio obsoleto (`storie 2.1 e 2.9` → PRD §2 · storia 6.1). Preservare intatti i pattern di esclusione esistenti.
- `docs/authoring-pipeline.md` (nuovo) -- documentazione della pipeline che dichiara i tre principi (fatti non formulazioni; parafrasi con sinonimi = opera derivata; metafore didattiche non riusate) con l'esempio concreto del caso "motori"/treno del progetto e la correzione in terminologia standard. Dichiarare qual è la cartella di lavoro dell'autore (`.authoring/`) e che il suo contenuto non entra nel repo. Stile allineato a `docs/i18n-boundary.md`.
- `src/source-boundary.test.ts` (nuovo) -- test di igiene di livello repo: (1) `.gitignore` contiene i pattern richiesti e il commento con la ragione, nominando le tre categorie; (2) `git check-ignore` riporta come ignorati i percorsi transcript/sottotitoli/trascrizioni della matrice I/O e come **non** ignorato il file di controllo `content/lessons/01-la-particella-wo.json`; (3) `docs/authoring-pipeline.md` esiste e dichiara i tre principi e l'esempio concreto (ancore di testo). Coprire le righe della matrice I/O.

**Acceptance Criteria:**
- Given il repository, when `.gitignore` viene ispezionato, then esclude esplicitamente transcript, sottotitoli e trascrizioni, con un commento che ne dice la ragione.
- Given una cartella di lavoro dell'autore contenente un transcript, when `git status`/`git check-ignore` viene eseguito, then il file non compare fra quelli tracciabili (è ignorato), mentre un file di contenuto di lezione resta tracciato.
- Given `docs/authoring-pipeline.md`, when viene letta, then dichiara che dal transcript si estraggono fatti mai formulazioni, che parafrasare con i sinonimi resta opera derivata, e che le metafore didattiche della fonte non si riusano, con l'esempio concreto del caso "motori"/treno in cui il progetto stesso ci era caduto.
- Given la suite di test, when `npm test` viene eseguito, then `src/source-boundary.test.ts` passa (transcript ignorati, contenuto tracciato, asserzioni su `.gitignore` e sul doc verdi).

## Design Notes

- **Perché un test che invoca `git`.** Rispecchia `deploy-config.test.ts`: senza guardia, una futura modifica a `.gitignore` esporrebbe la fonte in silenzio; con la guardia, la regressione è CI rossa. Usare `execFileSync('git', ['check-ignore', …], { cwd: repoRoot })`: exit 0 = ignorato, exit 1 (throw) = tracciato.
- **Collocazione del doc.** `docs/authoring-pipeline.md` segue la convenzione dei doc di confine in `docs/`. La storia 6.2 lo estenderà con la procedura operativa; 6.1 stabilisce solo il confine con la fonte — non anticipare i passi di 6.2.

## Verification

**Commands:**
- `npx vitest run src/source-boundary.test.ts` -- expected: pass (transcript ignorati, contenuto tracciato, `.gitignore` e doc verdi).
- `git check-ignore .authoring/lezione.txt transcripts/x.vtt sub.srt x.transcript` -- expected: ogni percorso stampato (ignorato).
- `git check-ignore content/lessons/01-la-particella-wo.json` -- expected: nessun output, exit 1 (tracciato).
- `npm run typecheck` -- expected: nessun errore.

**Manual checks (if no CLI):**
- Leggere `docs/authoring-pipeline.md`: conferma i tre principi e l'esempio concreto "motori"/treno, con i propri esempi in terminologia linguistica standard.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 0, medium 1, low 4)
- defer: 0
- reject: 15: (high 0, medium 0, low 15)
- addressed_findings:
  - `[medium]` `[patch]` `isIgnored` confondeva exit-1 (git: "non ignorato") con errori git reali (git assente / fuori work-tree / exit 128), rendendo illeggibili i fallimenti e facendo passare il controllo per la ragione sbagliata → il `catch` ora distingue `status === 1` (`return false`) da ogni altro throw (`throw error`).
  - `[low]` `[patch]` il file di controllo era hard-coded senza guardia di esistenza → aggiunta precondizione `existsSync` sul campione di lezione, così la guardia anti-vacuità non erode in silenzio se il file sparisce.
  - `[low]` `[patch]` la negativa `not.toMatch(/2\.9/)` era troppo larga (falso fallimento su un "2.9" incidentale) → ristretta alla coppia specifica `/2\.1 e 2\.9/`.
  - `[low]` `[patch]` il pattern `.transcripts/` non aveva copertura comportamentale → aggiunto caso `git check-ignore` annidato (`.transcripts/deep/x.txt`).
  - `[low]` `[patch]` le asserzioni di presenza pattern usavano substring (un pattern commentato o incluso in un altro passerebbe) → ancorate a riga attiva (`split`/`trim`).

Findings scartati (reject): ampliamenti del doc fuori dagli AC (link a 6.3/FR11.8, esempio frase before/after — territorio della 6.2, sfumatura compiler-vs-test, allineamento dei set di rinvii, asserire il commento di `.authoring/`) e edge speculativi (estensioni maiuscole, `transcripts` come file nudo, `*.transcript.md/.json`, crash all'import se manca `.gitignore`, encoding del kana, path con `-` iniziale). La verification-gap non ha trovato lacune; l'intent-alignment ha confermato l'implementazione della lettura massimale (dichiarativa + comportamentale + anti-regressione) senza divergenze.

### 2026-09-26 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - none

Follow-up su spec `done` (era `followup_review_recommended: true`). Quattro layer eseguiti alla stessa capacità del modello di sessione. Edge-case-hunter ha restituito `[]`; intent-alignment nessuna divergenza (il diff implementa la lettura congiuntiva dichiarazione ∧ comportamento ∧ confine-doc ∧ no-content-gate ∧ no-fixture); i file di implementazione risultano già committati in `e18df80`, nessuna ri-derivazione. Findings scartati e perché: (blind-hunter) estensioni maiuscole `.VTT`/`.SRT` — negligibile, `.authoring/` è ignorata per intero e la matrice I/O è deliberatamente scoped su minuscole; scansione di contenuto sotto nome non-matching — esplicitamente dominio della storia 6.3 per intent; negativa `not.toMatch(/2\.1 e 2\.9/)` — forma deliberata del pass precedente, con la positiva `storia 6.1` già presente; throw opaco senza work-tree git — il re-throw è il comportamento voluto (non mascherare gli errori reali) e la suite richiede intrinsecamente il repo; file di controllo hard-coded — prescritto dalla matrice I/O e già guardato da `existsSync`; ridondanza `*.transcript`/`*.transcript.txt` — già coperta dal test comportamentale (una rimozione andrebbe CI-rossa); rot dei cross-reference, sync doc↔gitignore, `.authoring` come file nudo, commento di negation-safety, rafforzamento dell'header, tensione doc/metafora (l'intent *impone* l'esempio "motori"/treno e citare-per-ripudiare non è riuso) — cosmetici/speculativi od over-engineering. (verification-gap) il layer `check-ignore` non fissa da solo il `.gitignore` *tracciato* (consulterebbe anche gli exclude locali) — l'invariante è comunque protetta dal describe delle stringhe che legge il file tracciato: conseguenza quasi nulla, non vale l'accoppiamento all'output di `check-ignore -v`.

## Auto Run Result

Status: done
Pass: review di follow-up su spec `done` — review-only, nessuna modifica al codice.

**Riepilogo del cambiamento** (già in commit `e18df80`):
- `.gitignore` — sezione FR11.7 rifinita: nomina esplicitamente transcript/sottotitoli/trascrizioni, ne dà la ragione, rinvia al test di igiene e corregge il rinvio obsoleto (`storie 2.1 e 2.9` → PRD §2 · storia 6.1 · doc).
- `docs/authoring-pipeline.md` (nuovo) — doc di confine con i tre principi anti-contaminazione e l'esempio concreto "motori"/treno (PRD §2, commit `c618164`) corretto in verbo / copula (だ) / aggettivo in い; dichiara `.authoring/` come cartella di lavoro dell'autore.
- `src/source-boundary.test.ts` (nuovo) — test di igiene di livello repo: pattern di `.gitignore` come righe attive, `git check-ignore` sulla matrice I/O (transcript ignorati, contenuto di lezione tracciato), esistenza + ancore del doc.

**Files changed in questo pass:** nessuno (review-only). L'implementazione era già stata committata; il diff dal baseline è stato ispezionato in sola lettura.

**Review findings breakdown:** patch applicati 0 · deferiti 0 · respinti 14 (tutti low).

**Follow-up review recommendation:** patch di questo pass per severità high 0 / medium 0 / low 0; score = 3×0 + 1×0 = 0 (< 5) e nessun high → `followup_review_recommended: false`.

**Verifica eseguita:** diff costruito dal baseline `c50a8e5208e3c5fdbba890c5e01f695cd730255a` (sola ispezione, nessun `git add`); i quattro subagent di review confermano la suite verde (12/12) e le asserzioni allineate alla matrice I/O; nessun comando di ri-verifica necessario in assenza di patch.

**Rischi residui:**
- Il confine è basato su nome/estensione: contenuto della fonte incollato in un file dal nome tracciato non è intercettato — per costruzione dominio della storia 6.3 (strumento di confronto), non della 6.1.
- Le estensioni dei sottotitoli sono minuscole: un file `.VTT`/`.SRT` fuori da `.authoring/` su filesystem case-sensitive non sarebbe intercettato — scenario negligibile dato che i transcript dell'autore vivono in `.authoring/`, ignorata per intero.

