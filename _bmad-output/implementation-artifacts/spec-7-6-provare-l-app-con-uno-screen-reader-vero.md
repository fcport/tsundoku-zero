---
title: "Provare l'app con uno screen reader vero"
type: 'chore'
created: '2026-09-28'
baseline_revision: '9d6f0c5feed48b979cdc49b822e9ce76bc23d924'
status: 'awaiting-operator'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/docs/session-keyboard-contract.md'
warnings: ['oversized']
deferred: []
operator_actions:
  - "Abilita uno screen reader reale con una voce TTS giapponese: su Windows, NVDA con una voce giapponese (Windows OneCore / Vocalizer / eSpeak `ja`) abbinato a Firefox oppure Chrome; su macOS, VoiceOver con una voce giapponese (Kyoko/Otoya) abbinato a Safari."
  - "Avvia l'app con `npm run dev` contro il progetto Supabase reale, accedi con un account che abbia almeno la prima lezione sbloccata e raggiungi una sessione di esercizio (card con consegna + frase giapponese + opzioni)."
  - "Percorri la sessione con lo screen reader e registra l'esito in `docs/session-screen-reader-audit.md` → sezione «Esito misurato», una riga per AC (PASS/FAIL + nota di ciò che hai sentito, e la colonna «Data / browser / SR / voce»): AC1 la frase giapponese è pronunciata UNA volta e non due (il `<rt>`/furigana non è vocalizzato); AC2 consegna, opzioni, esito e spiegazione sono annunciati in ordine comprensibile senza salti; AC3 l'avanzamento («X di N completati») è annunciato UNA volta sola dall'unica live region, senza doppioni."
  - "Registra nella sezione «Difetti» del documento ogni discrepanza fra comportamento atteso e ciò che lo screen reader ha fatto davvero (o dichiara esplicitamente «nessun difetto»), poi committa il documento di audit compilato."
---

<intent-contract>

## Intent

**Problem:** Il contratto di accessibilità della sessione di esercizio — furigana in `<rt aria-hidden="true">` così che una voce giapponese legga la frase UNA volta e non due, `lang="ja"` sul giapponese, UNA sola live region `aria-live="polite"` che annuncia esito e avanzamento, ordine di lettura consegna→opzioni→esito→spiegazione — è costruito e coperto da test di componente/jsdom. Ma quei test girano contro jsdom / markup statico: asseriscono gli ATTRIBUTI DOM/ARIA, non ciò che uno screen reader reale con voce giapponese PRONUNCIA davvero. L'unica affermazione di accessibilità che nessun test automatico può fare — che uno screen reader vero percorre la sessione in modo comprensibile e legge la frase una sola volta — non è mai stata misurata, né registrata per iscritto nel repository. Finché non lo è, «accessibile» resta ragionato, non misurato.

**Approach:** Produrre un record di audit versionato in `docs/session-screen-reader-audit.md` (stessa convenzione di `docs/session-keyboard-contract.md`): (a) inventaria cosa i test automatici GIÀ coprono, con anchor; (b) RAGIONA il comportamento atteso dal contratto di codice reale, con anchor; (c) dà una procedura manuale riproducibile (NVDA/VoiceOver con voce giapponese, `npm run dev`, come raggiungere una sessione); (d) espone una sezione «Esito misurato» strutturata per AC e un registro «Difetti» che l'operatore compila durante il run reale. Aggiungere un test companion strutturale `src/features/study/session-screen-reader-audit.test.ts` (stesso precedente di `session-keyboard-contract.test.ts`) che verifica esistenza e punti dichiarati del documento — testa l'ARTEFATTO, non il comportamento a runtime dello screen reader, che resta l'unica affermazione non coperta da automazione (AC3). L'agente scrive e verifica tutto OFFLINE; l'operatore esegue lo screen reader reale e ne registra l'esito ⇒ status `awaiting-operator`.

## Boundaries & Constraints

**Always:**
- Il documento vive in `docs/session-screen-reader-audit.md`, prosa in italiano (convenzione: `docs/session-keyboard-contract.md`, `docs/i18n-boundary.md` — un file di contratto/record con un test che ne verifica esistenza e contenuti).
- Inventaria la copertura automatica ESISTENTE con anchor precisi: `src/ui/JapaneseText.test.tsx` (ogni `<rt>` è `aria-hidden`, involucro `lang="ja"`), `src/features/study/SessionScreen.test.tsx` + `SessionScreen.keyboard.test.tsx` (esattamente una `aria-live="polite"`, annuncia esito + avanzamento, `incorrect` per la risposta errata), `session-keyboard-contract.test.ts`, `ExerciseCard.test.tsx`, `ProgressMeter.test.tsx`.
- RAGIONA il comportamento atteso dal codice reale, ancorato: `<rt aria-hidden="true">` + `<rp>` di ripiego in `src/ui/JapaneseText.tsx:59-72`; UNA sola `<p aria-live="polite" className="sr-only">` in `SessionScreen.tsx:498-502` che annuncia p.es. «That answer is correct. 1 of 5 completed»; ordine semantico consegna→frase JA→opzioni→(mostra spiegazione)→esito+spiegazione in `ExerciseCard.tsx:109-174` + `ExplanationPanel.tsx:38-63`; `role="progressbar"` su `ProgressMeter`; ordine tastiera/lettura/tabulazione da `docs/session-keyboard-contract.md`.
- Dà una procedura manuale riproducibile: abilitare NVDA (Windows) o VoiceOver (macOS) con una voce TTS giapponese; `npm run dev` contro un progetto Supabase (con un account e almeno la prima lezione sbloccata, così da raggiungere una sessione con esercizi); percorrere consegna→opzioni→esito→spiegazione e osservare.
- La sezione «Esito misurato» è strutturata per AC (frase letta una volta; ordine comprensibile; avanzamento dalla live region) e il registro «Difetti» è presente; entrambi sono esplicitamente marcati «da eseguire» — MAI risultati fabbricati.
- Il test companion `src/features/study/session-screen-reader-audit.test.ts` rispecchia `session-keyboard-contract.test.ts:1-16` (legge il documento dal repoRoot in ambiente `node`, asserisce i punti dichiarati). Testa il DOCUMENTO, non l'a11y a runtime.
- Solo documentazione + un test: NESSUNA modifica al comportamento di prodotto/`src/` (la 7.6 «non introduce nuovo comportamento»).

**Block If:**
- Se la lettura statica del codice CONTRADDICE un'aspettativa documentata (p.es. `<rt>` NON è `aria-hidden`, oppure esiste più di una live region, oppure i nodi giapponesi non hanno `lang="ja"`) — cioè se il «pavimento» che la prova manuale misura è in realtà rotto nel codice — HALT `blocked` con la discrepanza: è un difetto di codice da correggere nella storia proprietaria, non da mascherare in un documento di audit. (In planning verificato: `rt aria-hidden` ✓ `JapaneseText.tsx:65`; `lang="ja"` ✓ `:59`; esattamente una `aria-live="polite"` ✓ `SessionScreen.tsx:498`.)

**Never:**
- NON modificare il comportamento di prodotto/`src/`, i componenti della sessione, i18n, lo schema, le funzioni o la CI: è una storia di documentazione + test-del-documento.
- NON fabbricare risultati dello screen reader: l'agente non può eseguire uno screen reader reale; «Esito misurato» e «Difetti» sono di proprietà dell'operatore, lasciati esplicitamente in sospeso.
- NON sostenere che il test strutturale del documento «copra» il comportamento a11y: copre l'artefatto; l'esperienza a runtime con screen reader resta l'unica affermazione non coperta da alcun test automatico (AC3).
- NON espandere lo scope per CORREGGERE le voci a11y app-wide differite (DW-10, anello di focus; DW-14, wiring della conferma distruttiva): sono citate come voci note adiacenti da segnalare all'operatore, ma gli AC della 7.6 sono la sessione.
- NON richiedere un Supabase finto/locale o un backend mock per la procedura (AD-12/AD-13: un solo progetto reale).

<!-- I/O & Edge-Case Matrix omessa deliberatamente: la storia non ha scenari di I/O eseguibili offline. Il comportamento osservabile (frase letta una volta, ordine d'annuncio, avanzamento live) è misurabile solo da un operatore con screen reader reale, ed è espresso come Acceptance Criteria [operator]. -->

</intent-contract>

## Code Map

- `docs/session-screen-reader-audit.md` (NUOVO) -- il record di audit: scopo e ambito; inventario della copertura automatica (con anchor); comportamento atteso ragionato dal codice (con anchor); procedura manuale NVDA/VoiceOver; sezione «Esito misurato» per AC + registro «Difetti» (da compilare dall'operatore); nota sulle voci note adiacenti (DW-10/DW-14).
- `src/features/study/session-screen-reader-audit.test.ts` (NUOVO) -- test strutturale che rispecchia `session-keyboard-contract.test.ts`: legge il documento dal repoRoot, asserisce che dichiara `rt aria-hidden` / `lang="ja"` / UNA sola `aria-live="polite"` / l'ordine semantico / l'affermazione «unica non coperta da test automatico» / la presenza delle sezioni «Esito misurato» e «Difetti».
- `src/features/study/session-keyboard-contract.test.ts:1-16` (sola lettura, TEMPLATE) -- l'idioma di risoluzione del percorso (`__dirname`→`repoRoot`, `readFileSync`) che il nuovo test rispecchia.
- `src/ui/JapaneseText.tsx:57-74` (sola lettura) -- `<span lang="ja">` (`:59`) + `<rt aria-hidden="true">` (`:65`) + `<rp>` di ripiego (`:64,66`): la superficie di AC1 (frase letta una volta). Commento del contratto a `:12-16` (UX-DR28).
- `src/ui/JapaneseText.test.tsx` (sola lettura) -- copertura automatica esistente: ogni `<rt>` porta `aria-hidden="true"`, l'involucro resta `lang="ja"`.
- `src/features/study/SessionScreen.tsx:454-503` (sola lettura) -- ramo di sessione ATTIVA: `<main>` → `ProgressMeter` → `ExerciseCard` → «prossimo esercizio» → «esci» → UNA sola `<p aria-live="polite" className="sr-only">` (`:498-502`) che annuncia esito (`session.outcome.*`) + avanzamento (`session.progress.announce`).
- `src/features/study/ExerciseCard.tsx:109-174` (sola lettura) -- ordine semantico: consegna (`:112`) → `JapaneseText` (`:116-118`) → `<ul>` di `<button aria-pressed>` (`:126-154`) → «mostra la spiegazione» (`:159-167`) → `ExplanationPanel` (`:171-173`).
- `src/features/study/ExplanationPanel.tsx:38-63` (sola lettura) -- esito testuale (`session.outcome.correct`|`incorrect`, `:42-46`) + testo della spiegazione con `lang` sulla lingua effettiva (`:52`).
- `src/features/study/ProgressMeter.tsx` (sola lettura) -- `role="progressbar"` + `aria-label`/`aria-valuenow`/`min`/`max`.
- `src/features/study/SessionScreen.test.tsx` + `SessionScreen.keyboard.test.tsx` (sola lettura) -- copertura esistente: esattamente una live region (solo nella card attiva, non su skeleton/completamento/vuoto); annuncia esito + avanzamento; `incorrect` per la risposta errata.
- `docs/session-keyboard-contract.md` (sola lettura) -- il contratto tastiera/lettura/tabulazione che la procedura richiama; già dichiara (`:79-81`) che la prova manuale con screen reader reale è competenza della 7.6.
- `src/i18n/en.ts:164-196` (sola lettura) -- le stringhe annunciate: `outcome.correct` («That answer is correct.»), `outcome.incorrect`, `progress.announce` («{{completed}} of {{total}} completed»), `next`, `exit`.
- `_bmad-output/implementation-artifacts/deferred-work.md` (sola lettura) -- DW-10 (`:79-85`, anello di focus app-wide) e DW-14 (`:113-118`, wiring a11y della conferma distruttiva): voci a11y app-wide parcheggiate «per l'audit 7.6», citate come note adiacenti, fuori dagli AC della sessione.

## Tasks & Acceptance

**Execution:**
- `docs/session-screen-reader-audit.md` -- creare il record di audit (scopo e ambito; inventario della copertura automatica con anchor; comportamento atteso ragionato dal codice con anchor; procedura manuale NVDA/VoiceOver + voce giapponese; sezione «Esito misurato» per AC + registro «Difetti» da compilare dall'operatore; nota sulle voci note adiacenti DW-10/DW-14). -- realizza lo scaffold agent-side di AC1–AC4 e la superficie del record.
- `src/features/study/session-screen-reader-audit.test.ts` -- test strutturale che rispecchia `session-keyboard-contract.test.ts`: il documento esiste e dichiara `rt aria-hidden` / `lang="ja"` / UNA sola `aria-live="polite"` / l'ordine semantico consegna→opzioni→esito→spiegazione / che l'esperienza con screen reader è l'unica affermazione a11y non coperta da test automatico / la presenza delle sezioni «Esito misurato» e «Difetti». -- protegge l'artefatto dal degrado e dà un check offline.

**Acceptance Criteria:**
- Given il repository, when si apre `docs/session-screen-reader-audit.md`, then esso inventaria la copertura automatica ESISTENTE (test di `JapaneseText`/`SessionScreen`/tastiera) con anchor di file e dichiara ESPLICITAMENTE che l'esperienza con screen reader reale è l'UNICA affermazione di accessibilità non coperta da alcun test automatico. [agent]
- Given il documento, when si legge la sezione «Comportamento atteso», then esso ragiona — ancorato a `JapaneseText.tsx`, `SessionScreen.tsx`, `ExerciseCard.tsx` — che uno screen reader dovrebbe leggere la frase giapponese UNA volta (`rt aria-hidden`), annunciare consegna→opzioni→esito→spiegazione in ordine, e sentire l'avanzamento dall'unica live region. [agent]
- Given `npm test`, when eseguito, then `session-screen-reader-audit.test.ts` passa (il documento esiste e dichiara i punti richiesti) e l'intera suite resta verde senza che alcun comportamento di `src/` sia cambiato. [agent]
- Given NVDA o VoiceOver con voce giapponese sull'app in esecuzione, when l'operatore percorre una sessione, then la frase giapponese è pronunciata UNA volta (non due) e ciò è registrato in «Esito misurato». [operator]
- Given lo stesso percorso, when l'operatore prosegue, then consegna/opzioni/esito/spiegazione sono annunciati in ordine comprensibile e l'avanzamento è annunciato dalla live region — registrato per iscritto, difetti inclusi. [operator]

## Spec Change Log

## Review Triage Log

### 2026-09-28 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 0, medium 1, low 6)
- defer: 0
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[medium]` `[patch]` La riga d'inventario diceva che `ExerciseCard.test.tsx` asserisce «l'ordine semantico dei nodi della card» — sopravvalutazione: quel test asserisce la PRESENZA dei nodi (consegna, frase `JapaneseText`, numero opzioni) e l'ordine SOLO fra le opzioni, NON l'ordine di lettura top-level. Riscritta la riga con precisione e aggiunta l'affermazione esplicita che l'ordine di lettura top-level NON è coperto da alcun test automatico — è ciò che l'audit manuale misura (AC2). Rafforza la premessa della storia.
  - `[low]` `[patch]` La sezione «Esito misurato» non diceva COME registrare. Aggiunta la convenzione «Come registrare»: per ogni AC, ESITO PASS/FAIL + nota + colonna «Data / browser / SR / voce»; segnaposto `_da eseguire_` mantenuti (nessun risultato fabbricato).
  - `[low]` `[patch]` Il comportamento di `aria-live`/`lang` è browser-dipendente. Nominati gli abbinamenti raccomandati (NVDA + Firefox/Chrome; VoiceOver + Safari) e aggiunto «browser» all'intestazione di colonna della tabella (riproducibilità dell'audit).
  - `[low]` `[patch]` La procedura non diceva come rilevare a runtime «più di una live region». Aggiunto al passo 3.3 il check dell'annuncio esito+avanzamento UNA volta (non duplicato), speculare al check «frase letta una volta vs due» di AC1.
  - `[low]` `[patch]` Mancava la convenzione di staleness dei documenti-contratto. Aggiunta la sezione «Definizione di completo e quando ri-eseguire»: completo con tutte le righe AC registrate + difetti elencati; da ri-eseguire dopo modifiche a `JapaneseText.tsx`, `ExerciseCard.tsx`/`ExplanationPanel.tsx` o alla live region in `SessionScreen.tsx`.
  - `[low]` `[patch]` Due formulazioni dell'ordine (con/senza «frase»). Armonizzate: aggiunta la nota che l'ordine di lettura completo è consegna → frase (AC1) → opzioni → esito → spiegazione, e che AC2 osserva gli elementi che nomina; terminologia resa coerente.
  - `[low]` `[patch]` Il test companion asseriva parole sparse (passerebbe su un documento sventrato o con ordine sbagliato). Indurito: asserisce i marcatori per-AC `**AC1**`/`**AC2**`/`**AC3**`, l'ordine di lettura come sequenza contigua (`consegna → opzioni → esito → spiegazione`), e la prossimità `una sola live region`; mantenute le guardie `da eseguire`/`da compilare`, senza asserzioni per-riga che si romperebbero al completamento dell'operatore.

I 13 finding **rigettati** (tutti low): percorso di `deferred-work.md` presunto errato (falso — il documento reale porta il percorso completo `_bmad-output/implementation-artifacts/deferred-work.md`, il rilievo nasceva dal riassunto passato al reviewer); variante «furigana nascosta» nella procedura (a furigana nascosta non c'è alcun `<rt>`, quindi il doppio-annuncio di AC1 non può verificarsi — la variante non aggiunge segnale); verifica del ripiego `<rp>` (fallback per browser senza supporto ruby, fuori dai browser moderni della procedura); asserzione dei precedenti AD-14/AD-15 nel test (non sono il soggetto del documento, a differenza di `session-keyboard-contract.test.ts` per AD-15); helper condiviso / messaggio d'errore per `readFileSync` (l'idioma `__dirname`→`repoRoot` rispecchia esattamente `session-keyboard-contract.test.ts`; un file mancante fa comunque fallire il test, che è lo scopo della guardia); ascolto del romaji nel `<rt>` (essendo `aria-hidden`, il contenuto del `<rt>` non è vocalizzato a prescindere da kana/romaji); densità della prosa (cosmetico; il documento è già strutturato in sezioni e passi); asserzione dei filename limitata alla sezione «Inventario» (brittle); allentamento dei regex della frase-AC3 / «una volta» / `aria-hidden="true"` (indebolirebbe la guardia: sono frasi-contratto deliberate); asserzione per-riga «da eseguire» nella tabella (si romperebbe legittimamente quando l'operatore compila PASS/FAIL); risoluzione di `repoRoot` da percorso fisso (rispecchia l'idioma del test sorella); osservazione «anchor-drift» del reviewer verification-gap (proprietà generale di ogni doc-test, gli attributi a11y reali restano coperti dai test di componente — `JapaneseText.test.tsx`/`SessionScreen.test.tsx`; correggere il drift dei numeri di riga è fuori scope per questa storia).

Nota: nessun intent_gap e nessun bad_spec. Il rilievo dell'audit di intent-alignment (la superficie del diff — documento markdown + test regex — diverge dalla superficie dell'intento — app reale sotto screen reader) NON è un difetto: è la scissione autorizzata dall'orchestratore per una storia con azione solo-umana. È risolta dalla finalizzazione a `awaiting-operator` con `operator_actions`, coerente con 7.4/7.5.

## Design Notes

**Perché lo stato finale è `awaiting-operator`.** L'agente non può eseguire uno screen reader reale né udire una voce TTS giapponese: la superficie VERA di AC1/AC2 è l'app in esecuzione sotto NVDA/VoiceOver, osservabile solo da un umano. L'agente scrive e verifica OFFLINE l'audit completo — inventario della copertura automatica, comportamento atteso ragionato dal codice (con anchor), procedura riproducibile — e la superficie del record; l'operatore MISURA e registra. È la stessa scissione di 7.4/7.5 (l'agente costruisce offline, l'operatore produce il risultato reale).

**Perché un test strutturale del documento non viola AC3.** Il test asserisce l'ARTEFATTO (il documento esiste e dichiara le aspettative), stesso precedente di `session-keyboard-contract.test.ts` e di `i18n.test` per `docs/i18n-boundary.md`. L'esperienza a runtime con screen reader resta non coperta da alcun test automatico — è precisamente ciò che l'operatore misura. Il documento lo dichiara esplicitamente per non lasciare ambiguità.

**Ambito rispetto alle voci differite.** DW-10 (anello di focus app-wide su auth/settings/shell) e DW-14 (wiring a11y della conferma distruttiva: `aria-expanded`, gestione del focus, annuncio live del cambio di fase) erano state parcheggiate «per l'audit 7.6», ma NON sono negli AC della 7.6 (il percorso della sessione). Il documento le cita come voci note adiacenti che l'operatore può verificare opportunisticamente mentre ha lo screen reader attivo; correggerle è fuori scope e sono code-change, non ciò che la 7.6 chiede.

**Perché la procedura richiede una sessione reale.** Registrazione/accesso e caricamento della sessione passano da Supabase; l'operatore ha bisogno di un account con almeno la prima lezione sbloccata per raggiungere gli esercizi. Nessun backend finto/locale (AD-12/AD-13: un solo progetto reale).

## Verification

**Commands (agent-side, offline):**
- `npm test` -- expected: verde, incluso il nuovo `session-screen-reader-audit.test.ts`; i test a11y esistenti (`JapaneseText`, `SessionScreen`, tastiera) invariati.
- `npm run lint` -- expected: 0 errori.
- `npm run typecheck` -- expected: 0 errori.
- `npm run build` -- expected: verde.

**Manual checks (operator):**
- Eseguire NVDA/VoiceOver con voce giapponese contro l'app in esecuzione, percorrere una sessione e compilare «Esito misurato»/«Difetti» in `docs/session-screen-reader-audit.md`, poi committare (vedi `operator_actions` nel frontmatter).

## Auto Run Result

Status: awaiting-operator

### Sintesi della modifica implementata

Creato il record di audit versionato `docs/session-screen-reader-audit.md` (convenzione di `docs/session-keyboard-contract.md` / `docs/i18n-boundary.md`): (a) inventaria la copertura automatica ESISTENTE del contratto a11y della sessione con anchor precisi (`JapaneseText.test.tsx`, `SessionScreen.test.tsx`, `SessionScreen.keyboard.test.tsx`, `session-keyboard-contract.test.ts`, `ExerciseCard.test.tsx`, `ProgressMeter.test.tsx`) e dichiara esplicitamente che l'esperienza a runtime con screen reader reale è l'UNICA affermazione a11y non coperta da test automatico (AC3); (b) RAGIONA dal codice reale il comportamento atteso, ancorato (`<rt aria-hidden="true">` + `lang="ja"` in `JapaneseText.tsx:59,65`; ordine consegna→frase→opzioni→esito→spiegazione in `ExerciseCard.tsx:109-174` + `ExplanationPanel.tsx:38-63`; UNA sola `<p aria-live="polite">` in `SessionScreen.tsx:498-502`); (c) dà una procedura manuale riproducibile (NVDA+Firefox/Chrome o VoiceOver+Safari con voce giapponese, `npm run dev` contro il Supabase reale, come raggiungere una sessione); (d) espone «Esito misurato» (una riga per AC, con convenzione PASS/FAIL) e «Difetti», più «Definizione di completo e quando ri-eseguire» e una nota sulle voci a11y app-wide adiacenti fuori scope (DW-10/DW-14). Aggiunto il test companion strutturale `src/features/study/session-screen-reader-audit.test.ts` (idioma di `session-keyboard-contract.test.ts`) che verifica esistenza e punti dichiarati del documento — l'ARTEFATTO, non l'a11y a runtime.

L'agente ha completato tutto ciò che è realizzabile e verificabile offline. La MISURA vera (AC1/AC2 e l'esito registrato di AC3) richiede un umano che esegua uno screen reader reale con voce giapponese: azione fuori dal repo, enumerata nel frontmatter `operator_actions`. Per questo lo status finale è `awaiting-operator`, non `done` (stessa scissione di 7.4/7.5).

### File creati / modificati

- `docs/session-screen-reader-audit.md` (nuovo) — il record di audit: scopo/ambito, inventario della copertura automatica (con anchor), comportamento atteso ragionato dal codice (con anchor), procedura manuale NVDA/VoiceOver, «Esito misurato» per AC + «Difetti» (da compilare dall'operatore), «Definizione di completo e quando ri-eseguire», voci note adiacenti (DW-10/DW-14).
- `src/features/study/session-screen-reader-audit.test.ts` (nuovo) — test strutturale (9 test): il documento esiste e dichiara `rt aria-hidden` / `lang="ja"` / UNA sola `aria-live="polite"` / i marcatori per-AC / l'ordine di lettura come sequenza contigua / l'affermazione «unica non coperta» / le sezioni «Esito misurato» e «Difetti».

### Esito della review

- Patch applicate: 7 (1 medium, 6 low) — vedi Review Triage Log. In sintesi: correzione della sopravvalutazione di copertura di `ExerciseCard.test.tsx` (medium); convenzione di registrazione PASS/FAIL; abbinamenti screen reader↔browser + colonna «browser»; check dell'annuncio non-duplicato della live region; sezione di staleness/ri-esecuzione; armonizzazione dell'ordine AC2; indurimento del test companion (marcatori per-AC + sequenza d'ordine + prossimità live region).
- Deferiti: 0.
- Rigettati: 13 (tutti low) — vedi Review Triage Log.

### Raccomandazione di review di follow-up

`true`. Patch di questo passaggio: high 0, medium 1, low 6. Punteggio `3×medium(1) + 1×low(6) = 9` (≥ 5) ⇒ review di follow-up raccomandata. (Modifiche a basso rischio — solo documentazione + un doc-test — ma il punteggio meccanico supera la soglia.)

### Verifica eseguita (offline, dopo le patch)

- `npm run lint` — 0 errori.
- `npm run typecheck` — 0 errori.
- `npm test` — 1222 test verdi su 100 file (il nuovo `session-screen-reader-audit.test.ts` porta 9 test; i test a11y esistenti invariati).
- `npm run build` — verde (solo l'avviso preesistente di chunk-size).

### Rischi residui

- L'affermazione VERA di accessibilità (screen reader reale) non è verificabile offline: dipende dall'esecuzione manuale dell'operatore (`operator_actions`). Finché non è fatta, «accessibile» resta ragionato, non misurato — ed è per costruzione l'unica affermazione a11y del progetto senza copertura automatica.
- Il doc-test asserisce il TESTO del documento, non la coerenza fra i suoi anchor e il codice: un futuro drift dei numeri di riga citati non verrebbe colto da questo test (gli attributi a11y reali restano però coperti da `JapaneseText.test.tsx`/`SessionScreen.test.tsx`). La sezione «quando ri-eseguire» del documento è il presidio umano contro questo drift.
- Le voci a11y app-wide DW-10/DW-14 restano aperte nelle loro storie proprietarie: fuori dagli AC della 7.6, citate come contorno che l'operatore può verificare opportunisticamente.
