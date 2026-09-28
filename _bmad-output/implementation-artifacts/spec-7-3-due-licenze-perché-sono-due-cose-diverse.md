---
title: 'Due licenze, perché sono due cose diverse'
type: 'feature'
created: '2026-09-28'
baseline_revision: 'ee96f2acdbda31cd71d9a2c206d0485ef02326c4'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/contamination-check.md'
  - '{project-root}/docs/authoring-pipeline.md'
warnings: ['oversized']
deferred:
  - summary: >-
      I file di lezione (`content/lessons/*.json`) non portano un identificatore di licenza al proprio interno (es. un campo SPDX o un `content/lessons/LICENSE`): un singolo file copiato fuori dal repository non porta con sé la licenza CC BY-SA 4.0.
    evidence: |-
      La licenza del contenuto vive solo alla radice (LICENSE-CONTENT). L'argomento del README «riusare il contenuto in modo indipendente» è più solido se ogni file dati porta il proprio marcatore. Fuori ambito per 7.3 (aggiungere un campo tocca lo schema di lezione, territorio Epic 2/AD-25); miglioramento reale da valutare più avanti.
    location: >-
      content/lessons/*.json
    severity: low
  - summary: >-
      Il README non ha una sezione «Getting started» (npm ci / npm run dev / configurazione delle chiavi Supabase / comandi di test): un contributore non può eseguire il progetto leggendo solo il README.
    evidence: |-
      Gli AC di 7.3 enumerano sette domande di progettazione e il brief dichiara «the README is not a feature list», quindi il getting-started è fuori dall'ambito imposto dall'intento; ma per un repository «destinato al deploy pubblico» è un'aggiunta utile prima del lancio (Epic 7).
    location: >-
      README.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** La radice del repository non contiene né le licenze né un README: chi lo ispetta non sa a quali condizioni riusare il codice e a quali il contenuto delle lezioni (due cose diverse, con esigenze giuridiche diverse), né trova spiegate le scelte progettuali che rendono il codice difendibile riga per riga.

**Approach:** Aggiungere alla radice due file di licenza distinti — `LICENSE` (codice, MIT) e `LICENSE-CONTENT` (contenuto delle lezioni, CC BY-SA 4.0) — e un `README.md` (in italiano, come il resto di `docs/`) che dichiara esplicitamente perché le due licenze sono separate e risponde alle sette domande della traccia; l'ultima descrive la pipeline di autorazione assistita da AI (Epic 6) come caso concreto, con il controllo anti-contaminazione e il suo limite dichiarato. Un test di igiene ancora meccanicamente esistenza e contenuti-chiave, secondo il precedente durevole del repo (`deploy-config.test.ts`, `source-boundary.test.ts`).

## Boundaries & Constraints

**Always:**
- I file vivono nella **radice del repository**: `LICENSE`, `LICENSE-CONTENT`, `README.md` come tre file distinti, non annidati.
- `LICENSE` è la **licenza del codice** (MIT), con titolare `Federico Casadei` e anno `2026`. `LICENSE-CONTENT` è la **licenza del contenuto** delle lezioni (Creative Commons Attribution-ShareAlike 4.0 International), autoidentificata dal nome completo, dall'identificatore SPDX `CC-BY-SA-4.0` e dall'URL canonico del testo legale. Sono due file **fisicamente distinti** con contenuto diverso.
- Il README **dichiara esplicitamente** che le due licenze sono separate **e perché**: codice e contenuto sono due tipi di opera diversi, governati da famiglie di licenze diverse (MIT parla di «the Software»; le lezioni sono opera creativa/didattica, non software). La separazione è la conseguenza diretta del principio «il contenuto è aperto, la forma è chiusa».
- Il README **risponde alle sette domande** della traccia, ciascuna in una sezione riconoscibile: (1) cos'è il progetto; (2) perché Leitner e non SM-2 o FSRS; (3) perché il livello di dominio non dipende dal framework; (4) perché Supabase e cosa cambierebbe su scala maggiore; (5) perché Vite e non Next; (6) cosa è stato lasciato fuori e perché; (7) come è stato usato il flusso assistito da AI — cosa delegato, cosa rifiutato, dove è costato più tempo di quanto ne abbia risparmiato.
- La **settima risposta** descrive la pipeline di autorazione come **caso concreto**: il confine fatto/formulazione, il controllo anti-contaminazione (`npm run check-contamination`) e il suo **limite dichiarato** — è l'unico anello della catena di qualità che **non è un cancello di CI**, perché il transcript della fonte resta fuori dal repository (6.1) e la CI non ha nulla con cui confrontare; vive in locale, nella rilettura umana obbligatoria. Rimanda a `docs/authoring-pipeline.md` e `docs/contamination-check.md` per il dettaglio, senza riscriverli.
- Le risposte sono **fedeli al codice reale** (progetto post-pivot: grammatica strutturale, non il vocabolario del brief pre-pivot): fatti tratti da `SPINE-DELTA.md`, dai `docs/` e dal `package.json`, mai inventati.
- Tono del sistema (UX applica): niente iperboli né avverbi di lode; prosa sobria, coerente con `docs/`.

**Block If:**
- Emergesse che un file di licenza con lo stesso nome esiste già alla radice con contenuto in conflitto irriconciliabile con MIT/CC BY-SA 4.0: HALT `blocked` con la discrepanza. (Verificato in planning: nessun `LICENSE*` esiste alla radice.)

**Never:**
- NON introdurre codice applicativo, rotte, componenti o stringhe i18n: questa storia è documentazione + licenze, non tocca `src/features`, `src/app`, `src/domain`.
- NON riscrivere o duplicare il contenuto di `docs/authoring-pipeline.md` / `docs/contamination-check.md`: il README vi **rimanda**.
- NON riusare metafore didattiche della fonte nel README (es. treno/vagone/motore): solo terminologia linguistica standard, come impone il documento stesso che si cita.
- NON toccare la privacy policy (7.1) né la pagina riconoscimenti (7.2): fuori ambito.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ispezione radice | working tree | `LICENSE`, `LICENSE-CONTENT`, `README.md` presenti come tre file distinti | Test rosso se manca uno |
| Lettura `LICENSE` | file letto | Testo MIT, titolare `Federico Casadei`, anno `2026`, parla del software | Test rosso se non-MIT |
| Lettura `LICENSE-CONTENT` | file letto | CC BY-SA 4.0: nome completo + SPDX `CC-BY-SA-4.0` + URL canonico | Test rosso se non-CC-BY-SA |
| Lettura README — separazione | file letto | Nomina `LICENSE` e `LICENSE-CONTENT`, dichiara che sono separate e perché | Test rosso se non le nomina entrambe |
| Lettura README — sette domande | file letto | Ogni domanda ha la sua ancora (Leitner/SM-2/FSRS; dominio+framework; Supabase+scala; Vite+Next; lasciato fuori; flusso AI) | Test rosso se ne manca una |
| Lettura README — 7ª risposta | file letto | Nomina il controllo anti-contaminazione e il suo limite (non è un cancello di CI) | Test rosso se manca il limite |

</intent-contract>

## Code Map

- `LICENSE` (nuovo, radice) -- licenza del **codice**: testo MIT integrale, `Copyright (c) 2026 Federico Casadei`. Il brief e Epic 1 dichiarano MIT per il codice.
- `LICENSE-CONTENT` (nuovo, radice) -- licenza del **contenuto** delle lezioni: intestazione di grant (`Copyright (c) 2026 Federico Casadei`, opera = contenuto in `content/lessons/`), licenza `Creative Commons Attribution-ShareAlike 4.0 International`, SPDX `CC-BY-SA-4.0`, URL canonico `https://creativecommons.org/licenses/by-sa/4.0/legalcode`, più il riassunto ufficiale dei termini (BY + SA). Sostituisce il `LICENSE-DATA` della v1 (vedi AD-16 in `SPINE-DELTA.md`).
- `README.md` (nuovo, radice) -- front door del repo: intro + sezione «Le due licenze» + le sette risposte. Fonti fattuali sotto.
- `_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-09-22/SPINE-DELTA.md` -- (sola lettura) fonte per: Vite-non-Next (§3, tre motivi), un solo progetto Supabase e cosa cambia a scala (§3), AD-1 dominio puro (§1), pivot/cosa è caduto (§4 «Sparisce: vocabulary», JMdict).
- `_bmad-output/planning-artifacts/product-brief-tsundoku-zero.md` -- (sola lettura) fonte per: Leitner «più semplice di SM-2, più difendibile» (§8), non-goal e out-of-scope (§2), confine di dominio (§6, NFR2).
- `docs/authoring-pipeline.md`, `docs/contamination-check.md`, `docs/authoring-runbook.md` -- (sola lettura) fonte e **rimando** per la 7ª risposta (confine fatto/formulazione; controllo anti-contaminazione; limite «non è un cancello di CI»; esempio del «motore»/treno corretto).
- `package.json` -- (sola lettura) stack reale: React 19, Vite, TypeScript strict, Supabase, i18next, Vitest; script `check-contamination`.
- `src/deploy-config.test.ts` -- **modello** del test di igiene su file di radice (legge `resolve(here, '..', <file>)`); non modificare.
- `src/domain/`, `eslint.config.js` -- (sola lettura) evidenza dell'AD-1: `src/domain/` puro, confini imposti dal lint (`eslint-plugin-boundaries`), verificati da `src/boundaries.test.ts`.
- `src/license-content-readme.test.ts` (nuovo) -- test di igiene: ancora esistenza e contenuti-chiave dei tre file (vedi Tasks).

## Tasks & Acceptance

**Execution:**
- `LICENSE` -- creare con testo MIT integrale, `Copyright (c) 2026 Federico Casadei`. -- licenza del codice, richiesta dall'AC1.
- `LICENSE-CONTENT` -- creare con grant CC BY-SA 4.0 sul contenuto delle lezioni: copyright, nome completo della licenza, SPDX `CC-BY-SA-4.0`, URL canonico del legalcode, riassunto ufficiale dei termini. -- licenza del contenuto, distinta dal codice, richiesta dall'AC1.
- `README.md` -- creare in italiano: intro (cos'è il progetto, post-pivot); sezione «Le due licenze» che nomina `LICENSE` e `LICENSE-CONTENT`, dichiara la separazione e la motiva; sei sezioni per le restanti domande (Leitner vs SM-2/FSRS; dominio senza framework; Supabase + scala; Vite vs Next; cosa lasciato fuori; flusso AI). La sezione sul flusso AI descrive la pipeline di autorazione con il controllo anti-contaminazione e il suo limite (non-CI), rimandando ai `docs/`. -- realizza AC2, AC3, AC4.
- `src/license-content-readme.test.ts` -- test node (idioma `deploy-config.test.ts`): (a) i tre file esistono ed hanno contenuto diverso; (b) `LICENSE` contiene «MIT License», «Federico Casadei», «2026», «Software»; (c) `LICENSE-CONTENT` contiene «Attribution-ShareAlike 4.0», «CC-BY-SA-4.0», l'URL canonico; (d) `README.md` nomina `LICENSE` **e** `LICENSE-CONTENT` e una parola-radice di «separat»; (e) il README contiene le ancore delle sette domande (`Leitner`, `SM-2`, `FSRS`, `Vite`, `Next`, `Supabase`, `dominio`, `framework`); (f) la sezione flusso-AI contiene «anti-contaminazione» e l'affermazione del limite (una sottostringa stabile come «non è un cancello di CI»). -- ancora meccanicamente gli AC alla superficie letta.

**Acceptance Criteria:**
- Given la radice del repository, when ispezionata, then contiene `LICENSE` (codice) e `LICENSE-CONTENT` (contenuto) come due file distinti, and `LICENSE` è MIT mentre `LICENSE-CONTENT` è CC BY-SA 4.0 autoidentificata (nome + SPDX + URL).
- Given il README, when letto, then dichiara esplicitamente che le due licenze sono separate and ne dà la ragione (codice e contenuto sono opere diverse; «il contenuto è aperto, la forma è chiusa»).
- Given il README, when letto, then risponde a tutte e sette le domande della traccia, ciascuna in una sezione riconoscibile.
- Given l'ultima risposta, when letta, then descrive la pipeline di autorazione di Epic 6 come caso concreto (cosa delegato / rifiutato / costato più tempo) and nomina il controllo anti-contaminazione e il suo limite dichiarato (non è un cancello di CI, perché il transcript resta fuori dal repo).
- Given la suite, when eseguita (`npm test`, `npm run lint`, `npm run typecheck`), then è verde, incluso il nuovo test di igiene.

## Review Triage Log

### 2026-09-28 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 2: (high 0, medium 0, low 2)
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[low]` `[patch]` L'ancora `/\bLICENSE\b/` nel test combaciava anche dentro `LICENSE-CONTENT` (il trattino è confine di parola in regex), quindi non discriminava il file di licenza del **codice**. Sostituita con ancore backtickate `/`LICENSE`/` e `/`LICENSE-CONTENT`/`, che rispecchiano il markup reale del README e distinguono i due file.
  - `[low]` `[patch]` Il blocco «sette domande» del test ancorava solo le domande 2-5. Aggiunte ancore per la domanda 1 (`/grammatica giapponese/i`) e la domanda 6 (`/lasciato fuori/i`); la domanda 7 è già coperta dal blocco anti-contaminazione, così tutte e sette sono ora ancorate.
  - `[low]` `[patch]` In `LICENSE-CONTENT` l'intestazione «Riassunto ufficiale dei termini (dal deed Creative Commons)» sovra-affermava che il riassunto italiano fosse autoritativo. Cambiata in «Riassunto dei termini (traduzione di cortesia del deed Creative Commons)»; il legalcode all'URL canonico resta il testo autoritativo.

I due finding **deferiti** (entrambi low, fuori ambito per l'autorità dell'intento) sono nel frontmatter `deferred`: nessun identificatore di licenza dentro i singoli file di lezione (tocca lo schema, Epic 2/AD-25) e l'assenza di una sezione «Getting started» nel README (gli AC enumerano sette domande di progettazione; il brief dichiara «the README is not a feature list»).

I 13 finding **rigettati** (tutti low): il presunto placeholder in `LICENSE-CONTENT` era un artefatto del riassunto passato a un reviewer (il file su disco è completo); la dicitura «spiegazioni bilingui» è coerente col ripiego it→en dichiarato (2.5/FR8.5) e la parità del contenuto è territorio Epic 2; un'asserzione «negativa» incrociata fallirebbe perché `LICENSE-CONTENT` cita legittimamente MIT per spiegare la separazione; `/separat/i`, l'ancoraggio per titoli di sezione e i nomi dei tre tipi di esercizio sono ancore adeguate o marginali; `docs/contamination-check.md` è già citato nella 7ª risposta; i riferimenti `AD-N` sono cross-ref di cortesia e la prosa circostante è autoesplicativa; l'interazione share-alike/MIT e l'attribuzione via schermata riconoscimenti sono oltre le sette domande; l'anno di copyright fisso e il suo pin nel test sono convenzione standard; la lunghezza/scannabilità della prosa segue lo stile di `docs/`; il `read()` a tempo di collezione che lancia su file mancante segue il precedente del repo (`deploy-config.test.ts`) e comunque rende la CI rossa come voluto; l'osservazione «documenti statici senza consumer a runtime» è informativa, non un gap.

## Design Notes

**Licenza del contenuto = CC BY-SA 4.0.** Il brief impone MIT per il **codice** (§2, Epic 1); per il **contenuto** `SPINE-DELTA.md` (AD-16) lascia la scelta fra MIT e CC BY-SA. Si sceglie **CC BY-SA 4.0**: è scritta per opere creative/didattiche (MIT parla di «the Software» e sarebbe un errore di categoria sulla prosa), impone attribuzione, e lo *share-alike* mantiene aperti i derivati — coerente col principio «il contenuto è aperto» e con l'etica anti-contaminazione (i fatti sono liberi, l'espressione va accreditata). Scelta difendibile e reversibile; l'AC non vincola *quale* licenza di contenuto, solo che esistano due file distinti e che il README ne spieghi la separazione.

**Perché due file e non uno.** Codice e contenuto sono due tipi di opera con esigenze giuridiche diverse. Un solo file confonderebbe quali termini valgono su cosa; due file lasciano riusare **il codice o il contenuto in modo indipendente**, ciascuno alle proprie condizioni. Questo è il «perché» che il README deve rendere esplicito (AC2).

**README in italiano.** Tutti i `docs/` del repo e tutte le spec sono in italiano; il README ne segue la convenzione (e il workflow impone la scrittura in italiano). Nessun requisito di bilinguismo nell'AC.

**Contenuto self-contained ma accurato per `LICENSE-CONTENT`.** Invece di trascrivere ~7500 parole di legalcode CC (rischio di refusi), il file grant identifica la licenza in modo non ambiguo — nome completo + SPDX `CC-BY-SA-4.0` + URL canonico del legalcode + il riassunto ufficiale del deed. È un grant valido e machine-readable (riconosciuto da licensee/SPDX), senza il rischio di citare male un testo lungo.

**La 7ª risposta rimanda, non riscrive.** `docs/authoring-pipeline.md` e `docs/contamination-check.md` sono già la fonte canonica; il README ne dà la sintesi (delega: estrarre fatti dal transcript e bozzare esercizi; rifiuto: riusare formulazioni/metafore — es. il «motore»/treno poi corretto — e l'LLM a runtime; costo: la rilettura umana obbligatoria + il controllo anti-contaminazione, l'unico anello non chiuso in CI) e vi rimanda per il dettaglio.

## Verification

**Commands:**
- `npm run lint` -- expected: 0 errori (nessun file `src` di feature toccato; il nuovo test rispetta i confini).
- `npm run typecheck` -- expected: 0 errori.
- `npm test` -- expected: verde, incluso `src/license-content-readme.test.ts`.

**Manual checks:**
- Aprire `README.md` e verificare a occhio che le sette risposte siano fedeli al codice (stack in `package.json`, decisioni in `SPINE-DELTA.md`) e sobrie nel tono.

## Auto Run Result

Status: done

### Sintesi della modifica implementata

Aggiunti alla radice del repository i due file di licenza distinti richiesti dalla storia e il README che li spiega. `LICENSE` è la licenza del **codice** (MIT, `Copyright (c) 2026 Federico Casadei`); `LICENSE-CONTENT` è la licenza del **contenuto** delle lezioni (Creative Commons Attribution-ShareAlike 4.0 International), autoidentificata da nome completo, identificatore SPDX `CC-BY-SA-4.0` e URL canonico del legalcode (più il riassunto del deed e la formula di attribuzione), senza trascrivere le ~7500 parole del testo legale. Il `README.md` (in italiano, come `docs/`) dichiara esplicitamente che le due licenze sono **separate e perché** (codice e contenuto sono opere diverse; MIT parla di «the Software», le lezioni sono opera creativa/didattica; conseguenza del principio «il contenuto è aperto, la forma è chiusa») e risponde a tutte e sette le domande della traccia; la settima descrive la **pipeline di autorazione** (Epic 6) come caso concreto — cosa delegato, cosa rifiutato, dove è costato più tempo — nominando il controllo **anti-contaminazione** e il suo **limite dichiarato** (è l'unico anello che **non è un cancello di CI**, perché il transcript resta fuori dal repository), con rimando a `docs/authoring-pipeline.md` e `docs/contamination-check.md`. Un test di igiene ancora meccanicamente esistenza e contenuti-chiave dei tre file, secondo il precedente del repo (`deploy-config.test.ts`).

Nota sull'attribuzione: l'AC della traccia cita «pipeline di autorazione di Epic 2», ma il controllo anti-contaminazione e il suo limite dichiarato sono definiti in **Epic 6** (storie 6.1/6.2/6.3), mentre la pipeline **produce** il contratto di schema di Epic 2. Il README attribuisce correttamente il controllo a Epic 6, risolvendo per sostanza la svista dell'etichetta (confermato dall'audit di intent-alignment).

### File creati

- `LICENSE` — testo MIT integrale, licenza del codice.
- `LICENSE-CONTENT` — grant CC BY-SA 4.0 sul contenuto delle lezioni (nome + SPDX + URL canonico + riassunto del deed + formula di attribuzione).
- `README.md` — front door in italiano: intro (cos'è il progetto post-pivot), sezione «Le due licenze» e le sette risposte (Leitner vs SM-2/FSRS; dominio senza framework; Supabase + scala; Vite vs Next; cosa lasciato fuori; flusso assistito da AI con controllo anti-contaminazione e limite non-CI).
- `src/license-content-readme.test.ts` — test di igiene di livello repo (idioma `deploy-config.test.ts`): esistenza e distinzione dei tre file; marcatori MIT e CC BY-SA 4.0; il README nomina entrambe le licenze e ne dichiara la separazione; le ancore di tutte e sette le domande; il controllo anti-contaminazione e il suo limite.

### Esito della review

- Patch applicate: 3 (tutte low) — ancora `LICENSE` discriminante nel test; copertura delle sette domande completata (domande 1 e 6); intestazione del deed in `LICENSE-CONTENT` resa non sovra-affermativa.
- Deferiti: 2 (low) — nessun marcatore di licenza dentro i file di lezione; nessuna sezione «Getting started» nel README.
- Rigettati: 13 (tutti low) — vedi Review Triage Log.

### Raccomandazione di review di follow-up

`false`. Nessuna patch `high`; punteggio `3×medium(0) + 1×low(3) = 3` (< 5). Patch per severità: high 0, medium 0, low 3.

### Verifica eseguita

- `npm run typecheck` — 0 errori (prima e dopo le patch).
- `npm run lint` — 0 errori (nessun file di feature toccato; il nuovo test rispetta i confini AD-1).
- `npm test` — 99 file, 1213 test verdi (dopo le patch; erano 1211 prima delle due ancore aggiunte). Il test di igiene `src/license-content-readme.test.ts` esegue 18 casi, tutti verdi.
- Matrix Test Audit: tutte e 6 le righe della I/O Matrix sono coperte da test eseguiti e verdi (esistenza+distinzione; LICENSE=MIT; LICENSE-CONTENT=CC BY-SA 4.0; README separazione; sette domande; 7ª risposta con limite).

### Rischi residui

- Le sette risposte sono verificate meccanicamente solo come **presenza di ancore** (superficie lessicale); la **fedeltà e completezza** del testo (superficie semantica) resta affidata alla rilettura umana, per costruzione, come per gli altri documenti-con-test del repo. Le affermazioni portanti sono state riscontrate contro `SPINE-DELTA.md`, i `docs/` e il `package.json` in fase di planning e review.
- I due elementi deferiti (marcatore di licenza nei file di lezione; sezione «Getting started») restano aperti come miglioramenti fuori ambito, registrati nel frontmatter `deferred`.
