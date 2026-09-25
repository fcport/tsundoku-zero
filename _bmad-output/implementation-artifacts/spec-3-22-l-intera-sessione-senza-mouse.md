---
title: "Story 3.22: L'intera sessione senza mouse"
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '07691fbccf5f3b7d788e4093a4b5020532d697ee'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Rispondendo all'ultimo esercizio la sessione passa direttamente al
      completamento e ne' l'esito finale ne' lo stato di completamento sono
      annunciati da alcuna live region all'assistive technology.
    evidence: |-
      Rispondere all'ultimo esercizio svuota la coda (currentId === null): il ramo
      di completamento (SessionScreen.tsx:385-415) sostituisce il ramo di sessione
      attiva che ospita l'unica live region aria-live="polite" (riga 494), senza
      fase di spiegazione intermedia (confermato dal test jsdom AC6, che vede
      session.complete.body subito dopo l'ultima risposta). AC4 esclude
      deliberatamente il completamento dall'avere una live region, quindi l'esito
      dell'ultimo esercizio e il "sei arrivato a zero" non vengono mai annunciati
      all'AT. E' un limite reale ma legato all'audit screen-reader (NVDA/VoiceOver)
      che l'intento delega esplicitamente alla storia 7.6 (DW-10/DW-14); il fix in
      questa storia sarebbe vietato dal vincolo "NON sul completamento".
    location: >-
      src/features/study/SessionScreen.tsx:385-415,494
    severity: medium
---

<intent-contract>

## Intent

**Problem:** La sessione di studio (3.18-3.21) è operabile solo col mouse più il solo `Esc` (3.20): non esiste il contratto tastiera che l'epica esige e che `AD-15` — marcato «da riscrivere» perché il vecchio contratto («spazio rivela, `1`–`4` valutano») descriveva un'autovalutazione che il prodotto non ha più. Senza di esso un utente al portatile deve spostare la mano al mouse a ogni esercizio, non c'è annuncio d'esito/avanzamento per l'assistive technology, e manca la prova (test di componente) che una sessione si porti a zero da sola tastiera.

**Approach:** Scrivere il nuovo contratto tastiera come regola di dominio pura più il montaggio nella superficie di sessione, e REGISTRARLO come aggiornamento di `AD-15` (non come convenzione locale): (1) tasto numerico `1`–`9` → opzione alla posizione corrispondente, con associazione numero↔posizione IDENTICA nei tre tipi (`keyboardSelectionIndex` puro nel dominio, agnostico al tipo); (2) comportamento di overflow DICHIARATO (più opzioni della fila numerica); (3) UNA sola live region `aria-live="polite"` che annuncia esito e avanzamento; (4) ordine di tabulazione = ordine di lettura = ordine dei tasti numerici, con anello di focus visibile (token `focus-ring`) su ogni interattivo; (5) `Enter` avanza in fase di spiegazione, `Esc` esce (già 3.20). La prova è un test di componente in ambiente `jsdom` (per-file) che PILOTA una sessione completa fino a pila zero solo con eventi da tastiera, con porte in memoria.

## Boundaries & Constraints

**Always:**
- **Il contratto è DOMINIO puro dove può esserlo.** La mappa tasto→posizione vive in `src/domain/keyboard.ts`: `keyboardSelectionIndex(key: string, optionCount: number): number | null`, PURA, senza DOM (riceve la stringa `e.key`, mai un `KeyboardEvent`), senza tempo/casualità. Agnostica al tipo di esercizio ⇒ l'associazione numero↔posizione è la STESSA per single-select, select-span e assemble (AC2), per costruzione.
- **Overflow DICHIARATO (AC3).** La fila numerica copre le posizioni `1`–`9` (`NUMERIC_ROW_SIZE = 9`): `'1'`→indice 0 … `'9'`→indice 8, ma SOLO se l'indice `< optionCount`. Un tasto senza opzione corrispondente (`'4'` con 3 opzioni), `'0'`, e ogni tasto non-cifra ⇒ `null` (no-op). Le opzioni oltre la nona NON sono raggiungibili da tasto numerico: si raggiungono con `Tab` + `Enter`/`Space` (percorso di focus, sempre valido per ogni opzione). Questo è il comportamento esplicito, non indefinito.
- **Riuso del percorso di risposta esistente.** Il tasto numerico chiama lo STESSO `onSelect(index)` del click (append per assemble, singolo per gli altri): nessuna seconda pipeline. Attivo solo in fase `consegna` (`!answered`); una tessera già scelta (assemble) è saltata (`selected.includes(idx)`); i tasti con `Ctrl`/`Meta`/`Alt` sono ignorati (non si dirottano le scorciatoie del browser, es. `Cmd+1`).
- **UNA sola live region per sessione (AC4).** Un unico nodo `aria-live="polite"` reso nel ramo di sessione ATTIVA (con la card), che annuncia l'esito (`session.outcome.*`) più l'avanzamento (`session.progress.announce`, `{{completed}}`/`{{total}}` — MAI `{{count}}`, che innescherebbe il pluralizzatore). Reso `sr-only` (l'esito visibile lo porta già l'`ExplanationPanel`). NON sul completamento (3.21 lo esclude), NON sullo scheletro, NON sullo stato vuoto — così resta UNA sola per l'intera sessione.
- **Tab-order e focus visibile (AC5).** L'ordine dei nodi interattivi nel DOM è già l'ordine di `answerOptions` (= ordine di lettura = ordine dei tasti numerici); si preserva, nessun `tabindex` positivo. Ogni interattivo della sessione (opzioni, «mostra la spiegazione», «prossimo esercizio», «esci») porta un anello di focus visibile via `focus-visible:` col token `focus-ring` (in scuro `accent-dark`, come da `theme.css`).
- **`Enter` avanza, `Esc` esce.** In fase `spiegazione` (`answered`), `Enter` con target NON interattivo (`window`/`body`, non un `<button>`/`<a>`/input) chiama `onNext()` — così la sessione è pilotabile da sola tastiera senza dipendere dall'attivazione nativa del bottone (che `jsdom` non sintetizza). `Esc` resta l'uscita (3.20), ora parte del contratto unificato: un solo listener `keydown` a livello `window` (via ref «ultimo valore»).
- **Registrazione dell'aggiornamento di `AD-15` (AC1), non convenzione locale.** Il contratto è scritto in `docs/session-keyboard-contract.md` (stesso pattern durevole di `docs/i18n-boundary.md` per `AD-14`) con un test che ne verifica l'esistenza e i contenuti; e la riga `AD-15`/l'elenco punti-aperti di `SPINE-DELTA.md` è aggiornata a «riscritto», con riferimento al doc. Il doc dichiara che SOSTITUISCE il vecchio contratto («spazio rivela, `1`–`4` valutano»).
- **Confini `AD-1`.** `features/study` importa `domain`/`ui`/`i18n`/`@tanstack/react-query`/`zustand`, MAI `data` né `react-router`. Il nuovo modulo `domain/keyboard.ts` non importa nulla di esterno né tocca il DOM. Parità en/it verde, `en` ASCII, nessun `!`/emoji/CJK nelle copie.
- **AC6 richiede `jsdom` per-file.** L'unico modo di «guidare una sessione completa da sola tastiera» è montare la componente e dispacciare eventi reali; `renderToStaticMarkup` (env `node`) non esegue eventi/effetti. Si aggiunge `jsdom` come devDependency e si marca IL SOLO nuovo file di test con `// @vitest-environment jsdom` (l'env globale resta `node`; i ~915 test esistenti non cambiano). Nessun'altra dipendenza di test (no testing-library): `createRoot` + `act` (da `react`) + `window.dispatchEvent`.

**Block If:**
- _Nessun blocco._ Ogni decisione è fissata dall'epica, da `AD-15`/`AD-22` e dai moduli esistenti. `jsdom` è installabile da agente (registry raggiungibile). La verifica manuale con screen reader reale (NVDA/VoiceOver) è ESPLICITAMENTE di competenza della storia 7.6 (audit a11y, cfr. DW-10/DW-14) e non è un'azione d'operatore di questa storia. Nessuna migrazione, nessun segreto, nessuna console vendor.

**Never:**
- NON introdurre `@testing-library/*` né cambiare l'env di test GLOBALE (`node`) — solo il docblock per-file. NON fare della mappa tastiera una convenzione inline non registrata. NON accoppiare il dominio al DOM (niente `KeyboardEvent` sotto `src/domain`).
- NON una seconda live region, NON metterla su completamento/scheletro/vuoto. NON usare `{{count}}` nelle copie (romperebbe la parità). NON colore d'esito (nessun verde/rosso), nessun `!`/emoji/badge/animazione: il contratto tastiera non tocca la grammatica della celebrazione.
- NON `tabindex` positivi, NON riordinare le opzioni per la tastiera (l'ordine resta quello di `answerOptions`, dominio). NON risolvere le lacune a11y app-wide fuori dalla sessione (anello di focus su auth/settings/shell = DW-10, storia 7.6). NON toccare dominio di scheduling/esito/coda/streak. NON cambiare le chiavi `['due']`/`['exercises']`/`['streak']`.
- NON mostrare numeri d'opzione visibili (non richiesto dagli AC; l'associazione è di comportamento, e per assemble il badge di posizione esiste già sulle tessere piazzate).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| tasto numerico in range | `key='2'`, `optionCount=4` | `keyboardSelectionIndex` ⇒ `1` (posizione 2) | — |
| stessa mappa per ogni tipo | `key='1'`, qualsiasi tipo | ⇒ `0`: la funzione è agnostica al tipo (AC2) | — |
| overflow: cifra senza opzione | `key='4'`, `optionCount=3` | ⇒ `null` (no-op, AC3) | — |
| oltre la fila numerica | `optionCount=12`, `key='9'` | ⇒ `8`; indici ≥9 mai da tasto (solo `Tab`), comportamento dichiarato (AC3) | — |
| tasti non selettori | `key='0'` / `'a'` / `'Enter'` / `''` | ⇒ `null` | — |
| selezione da tastiera | sessione attiva, `consegna`, premo la cifra dell'opzione corretta | `onSelect(idx)` ⇒ risposta valutata, fase `spiegazione` (esito reso) | guardia `answered`/modificatori/tessera già scelta |
| avanzamento da tastiera | fase `spiegazione`, premo `Enter` (target non interattivo) | `onNext()` ⇒ esercizio successivo in `consegna` | target `<button>`/`<a>` ⇒ ignorato (attiva il nativo) |
| uscita da tastiera | qualsiasi fase, premo `Esc` | `onExit()` | — |
| live region unica (attiva) | sessione attiva ispezionata | esattamente un `aria-live="polite"` (esito + avanzamento) | — |
| nessuna live region altrove | scheletro / completamento / vuoto | nessun `aria-live` | — |
| pila a zero da sola tastiera | 2 esercizi, guidati solo da eventi tastiera | la coda si svuota ⇒ schermata di completamento (`session.complete.body`) | — |

</intent-contract>

## Code Map

- `src/domain/keyboard.ts` -- **NUOVO** modulo dominio puro: `NUMERIC_ROW_SIZE = 9` e `keyboardSelectionIndex(key, optionCount)` (mappa `'1'`–`'9'`→`0`–`8` se `< min(optionCount, NUMERIC_ROW_SIZE)`, altrimenti `null`). Agnostico al tipo (AC2), overflow dichiarato (AC3). Nessun import, nessun DOM, nessun tempo/casualità (`AD-1`).
- `src/domain/keyboard.test.ts` -- **NUOVO**: unit test della mappa (in-range, overflow, `'0'`/non-cifra/vuoto, `optionCount=12`), più anti-vacuità.
- `src/features/study/SessionScreen.tsx:36-49` -- **importare** `keyboardSelectionIndex` da `../../domain/keyboard`; `useRef` da react.
- `src/features/study/SessionScreen.tsx:100-125` -- **lift a top-level** `onSelect`/`onNext`/`locale` (oggi dopo gli early-return, righe ~298-360) operando su `activeExercise = current?.exercise ?? null` e `activeOptions = activeExercise ? answerOptions(activeExercise) : []`; `onSelect` guarda `activeExercise === null || currentId === null`. Il render della card riusa `current.exercise` (narrowing TS) e gli stessi `onSelect`/`onNext`.
- `src/features/study/SessionScreen.tsx:111-117` -- **sostituire** l'effetto solo-`Esc` con UN listener `window` `keydown` (aggiunto una volta) che chiama `sessionKeyRef.current(e)`; un effetto senza dep-array aggiorna `sessionKeyRef.current = handleSessionKey` a ogni render (pattern «ultimo valore»). `handleSessionKey`: `Esc`→`onExit`; ignora `Ctrl/Meta/Alt`; se `activeExercise` e `!answered` → `keyboardSelectionIndex(e.key, activeOptions.length)` e, se valido e non già scelto, `onSelect(idx)`+`preventDefault`; se `answered` e `Enter` e target non interattivo → `onNext()`.
- `src/features/study/SessionScreen.tsx:364-399` -- **aggiungere**, nel ramo di sessione attiva, un unico `<p aria-live="polite" className="sr-only">` con, se `answered`, `${t(correct?...:...)} ${t('session.progress.announce',{completed,total})}`, altrimenti stringa vuota (AC4). Aggiungere il focus-ring a «prossimo esercizio» e «esci».
- `src/features/study/SessionScreen.tsx:1-35` -- **aggiornare** l'intestazione: 3.22 (contratto tastiera + live region) ora IN scope; resta fuori il responsive (3.23) e l'audit screen-reader reale (7.6).
- `src/features/study/ExerciseCard.tsx:130-160` -- **aggiungere** il focus-ring (`focus-visible:` col token `focus-ring`, in scuro `accent-dark`) ai `<button>` opzione e a «mostra la spiegazione» (AC5). Nessun'altra modifica di comportamento.
- `src/features/study/SessionScreen.test.tsx` -- **estendere** (env `node`): una sola `aria-live="polite"` nella sessione attiva; nessuna `aria-live` su scheletro/completamento/vuoto; focus-ring presente sulle opzioni e su next/exit.
- `src/features/study/SessionScreen.keyboard.test.tsx` -- **NUOVO** (env `jsdom` via `// @vitest-environment jsdom`, `globalThis.IS_REACT_ACT_ENVIRONMENT = true`): monta `SessionScreen` con `QueryClient` seminato (`['due']`, `['exercises']`), `PortsProvider` in memoria (coerenti), store pre-seminato; `createRoot`+`act`(da `react`)+`window.dispatchEvent`. Guida: cifra dell'opzione corretta di ex-1 → `Esc`? no → `Enter` avanza → cifre di ex-2 (assemble) in ordine → pila a zero ⇒ `session.complete.body`. Asserisce anche `Esc`→`onExit`.
- `src/domain/exercise-presentation.ts:56-73` -- **riuso INVARIATO** (`answerOptions`: ordine/numero dominio); `composeResponse`/`selectionComplete` invariati.
- `src/domain/review.ts:42-55` -- **riuso INVARIATO** (`evaluateAnswer`); `src/domain/session.ts` (coda), `schedule`/`outcome`/`due`/`streak` invariati.
- `src/i18n/en.ts:125-127` / `src/i18n/it.ts:119-121` -- **aggiungere** `session.progress.announce` (`'{{completed}} of {{total}} completed'` / `'{{completed}} di {{total}} completati'`) in parità; `en` ASCII, nessun `!`.
- `docs/session-keyboard-contract.md` -- **NUOVO**: il contratto tastiera registrato come aggiornamento di `AD-15` (sostituisce «spazio rivela, `1`–`4` valutano»); dichiara mappa numero↔posizione, overflow, live region unica, tab-order, focus visibile, `Enter`/`Esc`.
- `src/features/study/session-keyboard-contract.test.ts` -- **NUOVO**: legge `docs/session-keyboard-contract.md` (via `repoRoot`) e asserisce che dichiara i punti del contratto e che aggiorna `AD-15` (AC1, «registrato, non convenzione locale»), come `i18n.test` per `docs/i18n-boundary.md`.
- `_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-09-22/SPINE-DELTA.md:38,207` -- **aggiornare** la cella `AD-15` a «riscritto» e il punto aperto #4 con riferimento a `docs/session-keyboard-contract.md`.
- `package.json` -- **aggiungere** `jsdom` a `devDependencies` (per l'env per-file dell'AC6); `package-lock.json` aggiornato da `npm install`.
- `vitest.config.ts` -- **INVARIATO**: env globale resta `node`; il docblock per-file basta. `src/ui/theme.css:53` (token `focus-ring`) **riuso INVARIATO**.

## Tasks & Acceptance

**Execution:**
- `src/domain/keyboard.ts` (+ `keyboard.test.ts`) -- mappa pura tasto→posizione con overflow dichiarato; unit test di tutte le righe della matrix pura (in-range, overflow, non-selettori, `optionCount=12`).
- `src/features/study/SessionScreen.tsx` (+ `SessionScreen.test.tsx`) -- listener `keydown` unificato (numerico/`Enter`/`Esc` via ref), lift di `onSelect`/`onNext`, live region unica `aria-live="polite"`, focus-ring su next/exit; test node della live region e del focus-ring.
- `src/features/study/ExerciseCard.tsx` -- focus-ring col token `focus-ring` sulle opzioni e su «mostra la spiegazione».
- `src/features/study/SessionScreen.keyboard.test.tsx` -- test di componente in `jsdom` che guida una sessione (2 esercizi, tipi diversi) a pila zero SOLO da tastiera (AC6).
- `src/i18n/en.ts` + `src/i18n/it.ts` -- `session.progress.announce` (`{{completed}}`/`{{total}}`) in parità.
- `docs/session-keyboard-contract.md` (+ `session-keyboard-contract.test.ts`) -- registrazione durevole dell'aggiornamento di `AD-15` con test.
- `_bmad-output/planning-artifacts/architecture/.../SPINE-DELTA.md` -- chiudere il punto aperto #4 / segnare `AD-15` riscritto.
- `package.json` -- `jsdom` in devDependencies.

**Acceptance Criteria:**
- **AC1 — Contratto che sostituisce e aggiorna `AD-15`.** *Given* il nuovo contratto tastiera, *when* è definito, *then* è registrato in `docs/session-keyboard-contract.md` come aggiornamento di `AD-15` (dichiara di sostituire «spazio rivela, `1`–`4` valutano»), verificato da un test, non come convenzione locale.
- **AC2 — Tasto numerico → posizione, stessa associazione per ogni tipo.** *Given* un esercizio presentato (qualunque dei tre tipi), *when* l'utente preme un tasto numerico, *then* seleziona l'opzione alla posizione corrispondente, e l'associazione numero↔posizione è la stessa in ogni tipo (per costruzione: `keyboardSelectionIndex` è agnostica al tipo, verificata da unit test e dal test di componente `jsdom`).
- **AC3 — Overflow dichiarato.** *Given* un esercizio con più opzioni di quante ne copra la fila numerica (`> 9`), *when* il contratto è definito, *then* dichiara esplicitamente il comportamento (posizioni `1`–`9` da tasto, oltre solo via `Tab`; cifra senza opzione = no-op), verificato da unit test.
- **AC4 — Una sola live region.** *Given* una sessione in corso, *when* è ispezionata, *then* esiste ESATTAMENTE una live region `aria-live="polite"` che annuncia esito e avanzamento; scheletro, completamento e stato vuoto non ne hanno alcuna.
- **AC5 — Tab-order e focus visibile.** *Given* la sessione, *when* si percorre con `Tab`, *then* l'ordine segue l'ordine di lettura e coincide con l'ordine dei tasti numerici (ordine di `answerOptions`, nessun `tabindex` positivo), *and* ogni interattivo mostra un anello di focus visibile (token `focus-ring`).
- **AC6 — Sessione completa da sola tastiera.** *Given* un test di componente (`jsdom`, porte in memoria), *when* è eseguito, *then* guida una sessione completa fino alla pila a zero usando SOLO eventi da tastiera (tasti numerici + `Enter`), arrivando alla schermata di completamento.
- **AC7 — Confini / regressione.** *Given* il diff, *then* `domain/keyboard.ts` è puro (nessun DOM/tempo/casualità), `features/study` non importa `data`/`react-router`, l'env di test globale resta `node`, parità en/it verde con `en` ASCII e nessun `!`/emoji, nessun verde/rosso, comportamenti esistenti invariati; `npm run lint`/`typecheck`/`test`/`validate-content` verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 1, low 3)
- defer: 0
- reject: 18: (high 0, medium 0, low 18)
- addressed_findings:
  - `[medium]` `[patch]` Contenuto della live region mai asserito (verification-gap AC4): aggiunta asserzione nel test jsdom che DOPO la risposta il nodo `aria-live="polite"` contiene l'esito (`session.outcome.correct`) e l'avanzamento interpolato (`1 of 2 completed`), e che PRIMA è vuoto.
  - `[low]` `[patch]` Mancava il test negativo «cifra in fase spiegazione»: aggiunto test jsdom che una cifra dopo la risposta (`answered`) è un no-op (non risponde né avanza).
  - `[low]` `[patch]` Mancava il test «modificatori ignorati»: esteso `pressKey` con `ctrlKey`/`metaKey`/`altKey` e aggiunto test che `Ctrl/Meta/Alt`+cifra NON seleziona (resta in consegna).
  - `[low]` `[patch]` Ortografia italiana: ripristinati gli accenti (à/è/é/ì/ò/ù) nei commenti/prosa nuovi o modificati (era ASCII-izzata: «cosi/gia/piu/perche/e»), coerente con la convenzione del repo e la regola di lingua; valori i18n e stringhe cercate dai test invariati.
- reject notevoli (verificati contro codice reale e intento):
  - **`isInteractiveTarget` incompleto** (blind/edge, B3/E3): omette `role="button"`, `<a>` senza `href`, `<summary>`; irraggiungibile — la sessione rende SOLO `<button>` reali (opzioni/reveal/next/exit), nessun `<a>`/role custom. Nessuna conseguenza raggiungibile.
  - **`dark:...outline-accent-dark` «ridondante»** (blind, B14): affermazione ERRATA — non esiste `--color-focus-ring-dark`, quindi senza la variante `dark:` il focus in scuro userebbe il colore chiaro (#2F6FB0) su fondo scuro; la variante è RICHIESTA dal design («in scuro il focus usa accent-dark», theme.css).
  - **`jsdom ^29.1.1` sospetta** (blind, B7): verificata empiricamente — `npm install` stabile e i test girano in `jsdom` (948 verdi); la versione risolve.
  - **Test semina lo store, salta l'effetto `start`** (blind, B8): stessa convenzione di `SessionScreen.test.tsx`; AC6 chiede di guidare la sessione da tastiera, non di testare l'effetto `start` (glue verificata live).
  - **`Esc`+modificatore esce** (blind, B5): accettabile — uscire è non distruttivo (risposte persistite per-risposta, ricostruzione all'ingresso); `Esc` che esce sempre è comportamento ragionevole.
  - **No-lock in-flight / primo keydown pre-effetto** (blind, B9/B10): non raggiungibile con input reale (keydown separati, React committa fra i task; l'effetto senza dep-array aggiorna il ref al primo commit); guardie esistenti (`answered`, bottoni `disabled`).
  - **`dueQueryKey(userId ?? '')`** (blind, B13): `onSelect` guarda `currentId === null`; con `userId` nullo la sessione è a scheletro (nessuna card, `activeExercise` null) ⇒ mai eseguito.
  - **IME cifre full-width** (edge, E5): senza campo di testo non c'è composizione IME; i tasti numerici fisici producono `'1'`-`'9'`.
  - Altri nit low senza conseguenza utente: concatenazione di due `t()` per l'annuncio (legge naturalmente in en/it), Enter in consegna/Shift+Enter/cifra-tessera-già-scelta-senza-preventDefault (le cifre non hanno azione di default), boundary `optionCount=10` (coperto da `optionCount=12`), DRY di `FOCUS_RING` fra due file (costante di una riga), select-span non guidato dal test di componente (agnosticità garantita per costruzione + unit test), tab-order provato per costruzione (nessun `tabindex` positivo) e non con un focus-walk, base `ARCHITECTURE-SPINE.md` non aggiornata (snapshot storico; il delta `SPINE-DELTA.md` è la fonte viva delle variazioni di AD ed è aggiornato).

### 2026-09-25 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 1, low 0)
- defer: 1
- reject: 18: (high 0, medium 0, low 18)
- addressed_findings:
  - `[medium]` `[patch]` Ramo `incorrect` della live region mai asserito (verification-gap AC4): il nodo `aria-live="polite"` usa `t(answeredCorrect ? 'session.outcome.correct' : 'session.outcome.incorrect')` (SessionScreen.tsx:496) ma solo il ramo corretto era coperto dal test jsdom; un regresso che fissasse l'esito a «corretto» (perdendo il ramo `false`) sarebbe passato verde annunciando l'esito SBAGLIATO all'AT — proprio il pubblico per cui la live region esiste. Aggiunto un caso in `SessionScreen.keyboard.test.tsx` che risponde con un distrattore (esito errato) e asserisce che la live region contiene `outcome.incorrect`, NON `outcome.correct` (le due stringhe sono distinte: «correct.» non è sottostringa di «not correct.»), più `of 2 completed`.
- defer notevole:
  - **Ultimo esito/completamento non annunciato all'AT** (edge/verification): rispondere all'ultimo esercizio svuota la coda ⇒ il ramo di completamento (SessionScreen.tsx:385-415) sostituisce il ramo attivo con l'unica live region (riga 494), senza fase spiegazione intermedia. AC4 esclude deliberatamente il completamento; il fix qui sarebbe vietato dal vincolo «NON sul completamento». Reale ma di competenza dell'audit screen-reader (storia 7.6, DW-10/DW-14) — registrato in `deferred`.
- reject notevoli (verificati contro codice reale e giro precedente):
  - **Doppio dispatch per due cifre nello stesso frame** (edge E1): non raggiungibile con input reale — i keydown fisici sono task separati e React committa `answered` fra l'uno e l'altro; guardie esistenti (`answered`, bottoni `disabled`). Stessa conclusione del giro precedente (B9/B10).
  - **`isInteractiveTarget` incompleto** (blind): irraggiungibile — la sessione rende SOLO `<button>` reali; nessun `role`/`<a>`/`<summary>`. Già rigettato nel giro precedente (B3/E3).
  - **Race del primo render (ref «ultimo valore»)** (blind): non raggiungibile — React esegue l'effetto che aggiorna il ref al primo commit, prima di qualunque keydown utente. Già rigettato (B10).
  - **`jsdom ^29.1.1` sospetta / lockfile mancante** (blind): il lockfile È aggiornato (523 righe nel diffstat, escluse dal diff passato al reviewer come rumore); versione verificata empiricamente (949 test verdi in questo giro). Già rigettato (B7).
  - **`Enter` sul bottone focalizzato non testato / `onNext` idempotente**, **`preventDefault` non asserito**, **DRY di `FOCUS_RING` fra due file**, **asserzione focus-ring `>= 2`**, **polyfill `crypto.randomUUID` non ripristinato** (branch morto: node/jsdom lo forniscono), **doc contraddizione sul razionale di `'0'`**, **select-span non guidato dal test di componente** (agnosticità per costruzione + unit test), **parità placeholder en/it non asserita** (chiavi in parità), **conteggio `completed` durante la spiegazione** (è corretto: 1 esercizio completato) — nit low senza conseguenza utente raggiungibile.

## Design Notes

**Perché il dominio decide la mappa, la UI monta.** Come `answerOptions`/`composeResponse` (ordine e composizione in `exercise-presentation.ts`), la corrispondenza tasto→posizione è una decisione PURA e agnostica al tipo: metterla in `src/domain/keyboard.ts` rende l'invariante di AC2 («stessa associazione per ogni tipo») vero per COSTRUZIONE (una sola funzione, senza ramo per tipo) e unit-testabile senza DOM. Il dominio riceve `e.key` (stringa), mai un `KeyboardEvent`: nessun accoppiamento al DOM, `AD-1` intatto.

**Perché `jsdom` per-file, e solo qui.** L'AC6 chiede di GUIDARE («guida una sessione completa … usando solo la tastiera») la componente resa, non una funzione pura: è la superficie più esterna che l'intento nomina, e l'epica la elenca come copertura obbligatoria («una sessione completa fino a pila zero pilotabile da sola tastiera», «porte iniettate in memoria»). `renderToStaticMarkup` (env `node`) non esegue eventi né effetti, quindi un test di componente pilotato da tastiera è impossibile in `node`. Si abilita `jsdom` col docblock `// @vitest-environment jsdom` sul SOLO nuovo file (l'env globale resta `node`, i ~915 test invariati) — esattamente l'appiglio previsto dal commento di `vitest.config.ts` («un futuro test di componente non deve essere saltato in silenzio»). Nessuna testing-library: `createRoot` + `act` (da `react`, disponibile in React 19) + `window.dispatchEvent(new KeyboardEvent(...))`; le porte in memoria restituiscono dati COERENTI così un eventuale refetch da `invalidateQueries` è innocuo.

**Perché `Enter` avanza (oltre all'attivazione nativa).** Rispondendo, lo store è GIÀ avanzato (`dispatch` al momento della risposta, 3.19); l'avanzamento visivo è l'azione «prossimo esercizio». Per pilotare tutto da tastiera senza dipendere dalla traduzione Enter→click del bottone nativo (che `jsdom` non sintetizza), il listener `window` intercetta `Enter` in fase `spiegazione` SOLO quando il target non è un controllo (`<button>`/`<a>`/input): così sul bottone focalizzato agisce il nativo (nessun doppio avanzamento) e altrove agisce il contratto. È anche una migliore ergonomia «senza mouse»: numero per rispondere, `Enter` per proseguire, `Esc` per uscire.

**Perché un listener unico via ref «ultimo valore».** `Esc` (3.20) e i nuovi tasti condividono un solo listener `window` (coerente con «l'accessibilità è UN contratto»). Il handler dipende da stato che vive dopo gli early-return (`activeExercise`, `answered`, `selected`): un `sessionKeyRef` aggiornato a ogni render evita closure stantie senza violare la regola degli hook (il listener è aggiunto una volta, in un effetto top-level).

**Registrazione durevole (AC1).** Il repo registra i contratti architetturali come file `docs/` con test (vedi `docs/i18n-boundary.md` + `i18n.test` per `AD-14`). Si segue quel precedente: `docs/session-keyboard-contract.md` è la fonte del contratto, un test ne verifica l'esistenza e i punti, e `SPINE-DELTA.md` (che marca `AD-15` «da riscrivere», punto aperto #4) è aggiornato a «riscritto» — così l'aggiornamento di `AD-15` è registrato, non una convenzione sparsa nel codice.

**Fuori scope, con motivo.** L'anello di focus app-wide (auth/settings/shell) resta DW-10, di competenza dell'audit screen-reader reale 7.6; qui si copre la SESSIONE (ciò che AC5 richiede). La verifica manuale su NVDA/VoiceOver (UX-DELTA) è l'unica affermazione non coperta da test automatico e resta 7.6. Il responsive/thumb-zone è 3.23.

## Verification

**Commands:**
- `npm install` -- expected: aggiunge `jsdom` a devDependencies, aggiorna `package-lock.json` (poi la CI usa `npm ci`).
- `npm run typecheck` -- expected: exit 0 (chiavi i18n `session.progress.announce`; `keyboardSelectionIndex` tipizzata; nessun `any`).
- `npm run lint` -- expected: exit 0 (`domain/keyboard.ts` puro; `features/study` non importa `data`/`react-router`; nessun colore letterale).
- `npm test` -- expected: exit 0 (unit `keyboard.test`; live region/focus-ring in `node`; `SessionScreen.keyboard.test` in `jsdom` guida la sessione a zero; parità en/it; doc del contratto; nessuna regressione sui ~915 test).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

**Manual checks (live):**
- In `/studia` da tastiera: un tasto numerico seleziona l'opzione alla posizione; `Enter` avanza; `Esc` esce; anello di focus visibile su ogni interattivo; una sola live region annuncia esito/avanzamento. La verifica con screen reader reale (NVDA/VoiceOver) è la storia 7.6.

## Auto Run Result

Status: done (giro di review di follow-up su spec `done`, avviato perché `followup_review_recommended: true`)

**Riepilogo della modifica.** La storia 3.22 introduce il contratto tastiera unificato della sessione di studio: mappa pura tasto→posizione agnostica al tipo (`domain/keyboard.ts`), montaggio in `SessionScreen` con un solo listener `keydown` a livello window (numerici `1`-`9`, `Enter` avanza in spiegazione, `Esc` esce), una sola live region `aria-live="polite"` che annuncia esito+avanzamento, anello di focus visibile su ogni interattivo, e registrazione dell'aggiornamento di `AD-15` in `docs/session-keyboard-contract.md`. La prova end-to-end è un test di componente `jsdom` per-file che pilota una sessione a pila zero da sola tastiera. Questo giro di follow-up NON ha ri-derivato codice (nessun intent_gap/bad_spec); ha aggiunto una sola patch di test e registrato un defer.

**File modificati in questo giro (follow-up).**
- `src/features/study/SessionScreen.keyboard.test.tsx` — aggiunto un caso jsdom che copre il ramo `incorrect` della live region (risposta con distrattore ⇒ annuncio `session.outcome.incorrect`, non `correct`).
- `_bmad-output/implementation-artifacts/spec-3-22-l-intera-sessione-senza-mouse.md` — triage log del giro, voce `deferred`, questo risultato, frontmatter `status`/`followup_review_recommended`.

(Il diff della storia — dal baseline `07691fbc` — copre inoltre: `domain/keyboard.ts`(+test), modifiche a `SessionScreen.tsx`/`ExerciseCard.tsx`/`SessionScreen.test.tsx`, `docs/session-keyboard-contract.md`(+test), `i18n/en.ts`/`it.ts`, `SPINE-DELTA.md`, `package.json`+`package-lock.json`.)

**Esito della review (questo giro).**
- Patch applicate: 1 (medium) — copertura del ramo `incorrect` della live region (verification-gap AC4).
- Deferite: 1 (medium) — ultimo esito/completamento non annunciati all'AT, di competenza dell'audit screen-reader (storia 7.6, `deferred` in frontmatter).
- Rigettate: 18 (tutte low) — perlopiù eco dei reject del giro precedente, verificate non raggiungibili con input reale o marginali (dettaglio nel Review Triage Log).

**Raccomandazione di follow-up.** `false`. Patch di questo giro per severità: high 0, medium 1, low 0; punteggio `3×1 + 1×0 = 3` (< 5), nessun high ⇒ nessun ulteriore giro raccomandato.

**Verifica eseguita.**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0.
- `npm test` — 949 test verdi (era 948; +1 dal nuovo caso jsdom), 82 file, nessuna regressione.
- `npm run validate-content` — OK, nessun problema.

**Rischi residui.** L'unica affermazione non coperta da test automatico resta la verifica manuale con screen reader reale (NVDA/VoiceOver) e, come annotato nel `deferred`, l'annuncio dell'ultimo esito/completamento all'AT: entrambi di competenza esplicita della storia 7.6 (audit a11y). Nessun altro rischio raggiungibile individuato.

