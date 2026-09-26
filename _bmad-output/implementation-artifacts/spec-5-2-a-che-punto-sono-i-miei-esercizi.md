---
title: '5.2 A che punto sono i miei esercizi'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: 'fcf4b2e323e37852eeb789d93db2dceec2174248'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      listReviewLog legge l'intero review_log senza paginazione né finestra, e la ricostruzione dello stadio (stageDistribution) vi aggiunge una passata O(numero totale di risposte) a ogni render della vista statistiche.
    evidence: |-
      src/data/reviewRepository.ts:listReviewLog fa una select senza limit; src/domain/stageDistribution.ts raggruppa e ripiega tutte le voci del log. Il commento della porta assume «poche righe». Su account di lunga data la lista cresce illimitata. È una preoccupazione PRE-ESISTENTE (la stessa fonte alimenta già streak/answersOverTime, cfr. il deferred analogo di 5.1 sulla serie giornaliera illimitata) e futura di scalabilità: gli utenti attuali hanno cronologie brevi, quindi non è un difetto introdotto da 5.2.
    location: >-
      src/data/reviewRepository.ts / src/domain/stageDistribution.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** L'utente non vede a che punto sono i propri esercizi nella scala di ripasso — quanto studio è consolidato e quanto è ancora fragile. È la seconda statistica di Epic 5 (FR7.2) e arricchisce la vista `/statistiche` aperta dalla storia 5.1.

**Approach:** Aggiungere a `StatsScreen` una SECONDA sezione — la distribuzione degli esercizi per stadio di scheduling (0–5) — derivata da una funzione PURA del dominio (`stageDistribution`) che opera SOLO su `review_log`: raggruppa le risposte per esercizio, rigioca i loro esiti in ordine cronologico attraverso l'UNICA transizione di stadio del motore (`nextStage`, esportata da `schedule.ts`) e conta gli esercizi per stadio finale. L'asse dei sei stadi deriva dalla costante unica `LEITNER_INTERVALS_DAYS` (AD-17). Il canale unico `listReviewLog()` viene esteso da (solo timestamp) a una proiezione COMPLETA della riga (`ReviewLogRecord`: + `exerciseId`, `outcome`), senza mai leggere `review_state`.

## Boundaries & Constraints

**Always:**
- La distribuzione deriva ESCLUSIVAMENTE da `review_log` (AD-18), letto via `review.listReviewLog()` sulla STESSA identità di query `['streak', userId]` già condivisa da dashboard/sessione/5.1. Mai `review_state`/`listDue`/lo `stage` memorizzato.
- Lo stadio corrente di un esercizio si RICOSTRUISCE rigiocando i suoi esiti in ordine di `reviewedAt` crescente, dallo stadio 0, attraverso l'UNICA transizione di stadio del motore, esportata da `schedule.ts` come `nextStage(stage, outcome)`. NON duplicare la logica di transizione né i valori della scala nel nuovo codice.
- L'asse mostra ESATTAMENTE gli stadi `0..LEITNER_INTERVALS_DAYS.length - 1` (sei, AD-17), CONTIGUO, inclusi gli stadi con conteggio 0; nessun elenco parallelo di stadi nel codice della vista.
- L'aggregazione vive nel DOMINIO come funzione pura, totale, senza mutazione e SENZA parametri di tempo (lo stadio non dipende dall'orologio: `stageDistribution.length === 1`).
- `features` importa solo `domain`/`ui`/`i18n`/react/@tanstack (mai `data`, mai un'altra feature, mai react-router): porte da `usePorts()`, `userId` prop, navigazione callback (AD-1). Ogni stringa d'interfaccia da `t()` con parità en/it (AD-14), ASCII, nessun `{{count}}` (innesca il pluralizzatore i18next); solo token del design system, nessun colore letterale, NESSUN verde di successo, nessun `!`/emoji/avverbio di lode. Il conteggio di ogni stadio è sempre TESTO, mai veicolato dal solo colore.
- Estendere il canale `listReviewLog()` per esporre le colonne GIÀ presenti a DB (`exercise_id`, `outcome`); l'adattatore VALIDA `outcome` contro `REVIEW_OUTCOMES` (fonte unica di `schedule.ts`) e lancia `DataError('listReviewLog')` su riga malformata, coerente con la mappa esistente.

**Block If:**
- (nessuna decisione che richieda un umano: l'intento è univoco e AD-18 seleziona senza ambiguità che la distribuzione copra i SOLI esercizi presenti nel log)

**Never:**
- NON leggere `review_state`/`review_count`/`lapse_count`/lo `stage` memorizzato: la distribuzione si DERIVA, non si legge.
- NON includere gli esercizi MAI ripassati (assenti dal log): sarebbero «stadio 0» solo in `review_state`, la cui lettura è vietata (AD-18). La distribuzione descrive gli esercizi che l'utente ha effettivamente risposto.
- NON toccare la migrazione di `review_log` né la RPC `apply_review`: le colonne `exercise_id`/`outcome` esistono già; qui si estende solo la LETTURA.
- NON modificare `answersOverTime`/`streak` né i loro test: consumano solo `reviewedAt` (tipo `ReviewLogEntry`, invariato); `ReviewLogRecord` gli è assegnabile.
- NON costruire la ricca dichiarazione «cosa manca e quanto» (storia 5.4): a log vuoto rendi un placeholder testuale neutro, MAI un riquadro di grafico vuoto. NON implementare i tassi d'errore per punto grammaticale (5.3).
- NON nominare gli stadi con etichette mnemoniche o con l'intervallo in giorni: l'AC chiede «sei stadi, 0–5»; una mappa nome↔stadio introdurrebbe un elenco parallelo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Esercizi a stadi diversi | log con più `exerciseId`, esiti vari | Sei `StageCount` (stadi 0–5); `count` = numero di esercizi il cui stadio finale = quell'indice | Nessun errore atteso |
| Un esercizio, più risposte | stesso `exerciseId`, esiti in sequenza | L'esercizio conta UNA volta, allo stadio finale della fold cronologica dei suoi esiti | Nessun errore atteso |
| `again` nella storia | esiti `[good, good, again]` per un esercizio | Stadio finale `0` (reset), l'esercizio cade nel bucket 0 | Nessun errore atteso |
| Saturazione | molti `good`/`easy` oltre lo stadio 5 | Stadio clampato a 5 (bucket 5); mai un bucket 6+ | Nessun errore atteso |
| Ordine di input irrilevante | stesse voci in ordine sparso | Stessa distribuzione (fold per `reviewedAt`, non per ordine d'arrivo) | Nessun errore atteso |
| Log vuoto | `listReviewLog()` → `[]` | La funzione ritorna `[]`; la vista rende il placeholder testuale neutro | Nessun errore atteso |
| Adattatore: riga malformata | `outcome` fuori da `REVIEW_OUTCOMES`, o `exercise_id` non stringa | `DataError('listReviewLog')` (reject) | Reject, non valore degradato |
| `userId` non risolto o cache pending | `userId === null` o `logQ.data === undefined` | Scheletro `aria-busy` (ramo esistente 5.1) | Nessun errore atteso |

</intent-contract>

## Code Map

- `src/domain/schedule.ts` -- `nextStageFor` (riga 96, privato) + il clamp dentro `schedule` (riga 136) sono l'UNICA transizione di stadio. ESPORTARE `nextStage(stage, outcome)` che incapsula `Math.max(0, Math.min(MAX_STAGE, nextStageFor(...)))` e farla usare da `schedule` (nessuna duplicazione). `LEITNER_INTERVALS_DAYS` (riga 62, già esportata) → la scala (sei stadi); `REVIEW_OUTCOMES`/`ReviewOutcome` (riga 30/38) → l'insieme esiti per la validazione dell'adattatore.
- `src/domain/streak.ts` -- `ReviewLogEntry` (riga 29, solo `reviewedAt`): resta il tipo MINIMO consumato da `streak`/`answersOverTime` — NON modificarlo. AGGIUNGERE `ReviewLogRecord extends ReviewLogEntry` con `exerciseId: string` e `outcome: ReviewOutcome` (import `ReviewOutcome` da `./schedule`): la proiezione COMPLETA della riga `review_log` restituita dal canale unico. NON toccare `streak`.
- `src/domain/answersOverTime.ts` -- consuma `ReviewLogEntry` (solo timestamp): INVARIATO; `ReviewLogRecord` gli è assegnabile.
- `src/domain/ports/reviewRepository.ts` -- `listReviewLog()` (riga 52): cambiare il ritorno in `Promise<readonly ReviewLogRecord[]>` e aggiornarne la docstring (il canale unico ora porta anche `exerciseId`/`outcome`; le statistiche di stato li derivano, AD-18).
- `src/data/reviewRepository.ts` -- `REVIEW_LOG_COLUMNS` (riga 35): estendere a `'exercise_id, outcome, reviewed_at'`. `ReviewLogRow` (riga 45) + `toReviewLogEntry` (riga 56, rinominare `toReviewLogRecord`): mappare/validare `exercise_id` (stringa) e `outcome` (membro di `REVIEW_OUTCOMES`, importato da `../domain/schedule`) → `DataError('listReviewLog')` su riga malformata; `listReviewLog` (riga 162) ritorna `ReviewLogRecord[]`.
- `src/features/stats/StatsScreen.tsx` -- inserire la SECONDA sezione dopo quella delle risposte nel tempo, prima del bottone di ritorno (riga 137): `stageDistribution(logQ.data)` (nessun clock), placeholder se vuota, altrimenti `<h3>` + `<ol>` di barre per-stadio col conteggio come TESTO (stessa barra proporzionale a token neutri di 5.1).
- `src/i18n/en.ts` (riga 106) + `src/i18n/it.ts` (riga 100) -- dentro `stats`, dopo `answersOverTime`: AGGIUNGERE `stageDistribution: { heading, stageLabel ('{{stage}}'/'{{exercises}}'), empty }` a parità, ASCII, senza `{{count}}`.
- `src/domain/schedule.test.ts` -- aggiungere un test focalizzato su `nextStage` (transizioni per esito + clamp agli estremi), la nuova export.
- `src/data/reviewRepository.test.ts` -- blocco `listReviewLog` (riga 221+): aggiornare le righe finte (aggiungere `exercise_id`/`outcome`) e le asserzioni; aggiungere casi malformati (`outcome` fuori insieme; `exercise_id` non stringa).
- `src/features/stats/StatsScreen.test.tsx` -- `logAt` (riga 36)/`seededClient` (riga 45) producono `ReviewLogRecord` (con `exerciseId`/`outcome`); aggiungere i test della sezione distribuzione.
- `src/features/ports/PortsContext.test.tsx` -- `sampleLog` (riga 72): diventa `ReviewLogRecord[]` (aggiungere `exerciseId`/`outcome`) per adeguarsi al ritorno esteso.
- `src/i18n/i18n.test.tsx` -- la parità en/it e l'assenza di CJK sono già imposte ricorsivamente (vincolo da rispettare; nessuna modifica).

## Tasks & Acceptance

**Execution:**
- `src/domain/schedule.ts` -- ESPORTARE `nextStage(stage: number, outcome: ReviewOutcome): number` = `Math.max(0, Math.min(MAX_STAGE, nextStageFor(stage, outcome)))`; rifattorizzare `schedule` perché la usi. -- Fonte UNICA della transizione di stadio, condivisa da scheduling e derivazione della distribuzione.
- `src/domain/streak.ts` -- AGGIUNGERE `export interface ReviewLogRecord extends ReviewLogEntry { readonly exerciseId: string; readonly outcome: ReviewOutcome }` (import `ReviewOutcome` da `./schedule`); docstring che distingue `ReviewLogEntry` (minimo: giorno/streak) da `ReviewLogRecord` (riga completa: statistiche di stato). NON toccare `streak`. -- La proiezione completa del log per le statistiche di stato (5.2/5.3).
- `src/domain/stageDistribution.ts` -- CREARE `stageDistribution(log: readonly ReviewLogRecord[]): readonly StageCount[]` + `interface StageCount { readonly stage: number; readonly count: number }`. Raggruppa per `exerciseId`; per ogni esercizio ordina per `reviewedAt` crescente e fa la fold degli `outcome` da stadio 0 via `nextStage`; conta gli esercizi per stadio finale; ritorna un `StageCount` per OGNI stadio `0..LEITNER_INTERVALS_DAYS.length - 1` (contiguo, zeri inclusi); `[]` per log vuoto. Pura, totale, senza tempo, senza mutazione. -- La distribuzione per stadio (FR7.2), derivata dal solo log (AD-18).
- `src/domain/stageDistribution.test.ts` -- CREARE i test della I/O Matrix (stadi diversi; un esercizio più risposte ⇒ conta una volta allo stadio finale; `again` resetta; saturazione clamp a 5; ordine di input irrilevante; log vuoto ⇒ `[]`; asse = sei stadi derivati da `LEITNER_INTERVALS_DAYS.length`; purezza/non-mutazione/determinismo; anti-vacuità). -- Copre l'aggregazione e la contiguità dell'asse.
- `src/domain/ports/reviewRepository.ts` -- cambiare `listReviewLog(): Promise<readonly ReviewLogRecord[]>` e aggiornarne la docstring. -- Canale unico esteso (AD-18).
- `src/data/reviewRepository.ts` -- estendere `REVIEW_LOG_COLUMNS`; `toReviewLogEntry`→`toReviewLogRecord` mappa+valida `exercise_id`/`outcome` (contro `REVIEW_OUTCOMES` importato) e lancia `DataError('listReviewLog')` su riga malformata; `listReviewLog` ritorna `ReviewLogRecord[]`. -- L'adattatore porta la riga completa validata.
- `src/data/reviewRepository.test.ts` -- aggiornare i fixture di `review_log` (aggiungere `exercise_id`/`outcome`) e le asserzioni; aggiungere i casi malformati. -- Copre la mappa/validazione estesa.
- `src/features/stats/StatsScreen.tsx` -- aggiungere la sezione distribuzione: `const distribution = stageDistribution(logQ.data)`; se `distribution.length === 0` rendi `t('stats.stageDistribution.empty')`, altrimenti `<h3>{t('stats.stageDistribution.heading')}</h3>` + `<ol>` di `<li>` per stadio con `t('stats.stageDistribution.stageLabel', { stage, exercises })` come TESTO + barra proporzionale (max sui `count`, token neutri, nessun verde). Nessun clock per questa sezione. -- La seconda vista statistica (FR7.2).
- `src/features/stats/StatsScreen.test.tsx` -- aggiornare `logAt`/`seededClient` a `ReviewLogRecord`; aggiungere i test della distribuzione (dati ⇒ heading + sei stadi + conteggi come testo, incluso uno stadio a 0; log vuoto ⇒ placeholder, nessun `<ol>` della distribuzione; fonte solo `listReviewLog`). -- Copre gli AC alla superficie.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- aggiungere `stats.stageDistribution: { heading, stageLabel, empty }` a parità, ASCII, senza `{{count}}`. -- Nessuna stringa cablata (AD-14).
- `src/features/ports/PortsContext.test.tsx` -- aggiornare `sampleLog` a `ReviewLogRecord` (aggiungere `exerciseId`/`outcome`). -- Adeguare il mock al ritorno esteso.

**Acceptance Criteria:**
- Given un `review_log` con esercizi a stadi finali diversi, when si rende `StatsScreen` con l'`userId` risolto, then la vista mostra la distribuzione per stadio (intestazione della distribuzione più, per ciascuno stadio 0–5, il conteggio degli esercizi come testo).
- Given l'asse degli stadi, when la vista lo rende, then mostra ESATTAMENTE sei stadi (0–5) derivati dalla costante `LEITNER_INTERVALS_DAYS` di `schedule.ts`, senza un elenco parallelo di stadi nel codice della vista; anche gli stadi senza esercizi compaiono con conteggio 0.
- Given la distribuzione, when raccoglie i dati, then derivano SOLO da `review.listReviewLog()` (né `listDue`/`review_state`/lo `stage` memorizzato sono consultati) e lo stadio è ricostruito rigiocando gli esiti via l'unica transizione del motore.
- Given un esercizio con più risposte nella sua storia, when la distribuzione è calcolata, then quell'esercizio conta una sola volta, allo stadio risultante dalla sequenza cronologica dei suoi esiti.
- Given un `review_log` vuoto, when si rende `StatsScreen`, then la sezione distribuzione mostra un placeholder testuale neutro e NON un riquadro di grafico vuoto.

## Design Notes

Perché DERIVARE e non leggere: lo stadio corrente vive in `review_state.stage`, ma AD-18 vieta le statistiche da `review_state` (darebbe un secondo numero difendibile e divergente). `review_log` non porta `stage`, ma porta `exercise_id` + `outcome` + `reviewed_at`. Rigiocare gli esiti di un esercizio dallo stadio 0 attraverso la STESSA transizione che `schedule` usa (`nextStage`) ricostruisce lo stadio corrente — l'idempotenza della RPC `apply_review` (`on conflict do nothing`) tiene log e stato allineati — ma dal SOLO log, che è la definizione AD-18-corretta.

Transizione senza tempo: `nextStage` dipende solo da `(stage, outcome)`; jitter, intervallo e `dueAt` non toccano lo STADIO. Perciò `stageDistribution` è pura e SENZA `now`/`timeZone` (a differenza di `answersOverTime`): un solo argomento.

Esercizi mai ripassati: assenti dal log, non compaiono. È l'unica lettura possibile senza `review_state` (vietato). La distribuzione descrive lo studio effettivo, non l'intero catalogo — coerente con l'intento («i miei esercizi», quelli che ho risposto).

Fold di esempio (ordine `reviewedAt`): esiti `[good, good, again, good]` ⇒ `0 → 1 → 2 → 0 → 1`: stadio finale `1`.

Barra per-stadio accessibile: come in 5.1, il conteggio è sempre TESTO; la barra è larghezza inline proporzionale (`count/max`) con token neutri (`bg-ink-secondary`/`bg-surface-sunken`, mai verde). `max = Math.max(1, ...count)` evita la divisione per zero quando qualche stadio è a 0.

## Verification

**Commands:**
- `npm run typecheck` -- expected: 0 errori (nuovo tipo `ReviewLogRecord`, porta e adattatore aggiornati, export `nextStage`, chiavi i18n tipizzate).
- `npm run lint` -- expected: 0 violazioni (confini AD-1: `features` non importa `data`; dominio senza I/O; nessun colore esadecimale letterale).
- `npm test` -- expected: verdi il nuovo `stageDistribution.test.ts`, i test aggiornati di `StatsScreen`/`reviewRepository`/`PortsContext`, il test di `nextStage`, la parità en/it di `i18n.test.tsx`, l'invariante «un solo `<main>`» di `AppRoutes.test.tsx`.
- `npm run build` -- expected: build ok (Tailwind risolve i token usati).

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 0, low 2)
- defer: 1: (high 0, medium 0, low 1)
- reject: 15: (high 0, medium 0, low 15)
- addressed_findings:
  - `[low]` `[patch]` Docstring di `ReviewLogRecord` in `src/domain/streak.ts` con l'omografo goffo «la porta unica ora la porta» — riformulata la prima frase («come la restituisce ora il canale unico `listReviewLog`»), significato invariato.
  - `[low]` `[patch]` Mancava la copertura dell'esito `hard` nella fold di `src/domain/stageDistribution.test.ts` — aggiunto un test `[good, hard, good]` per `ex-1` (0→1→1→2) che asserisce stadio finale 2 e totale esercizi 1, distinguendo `hard` (tiene) da `good` (darebbe 3) e `again` (darebbe 0).
- Nota (rilievi respinti, tutti low): `stageDistribution(undefined)` al render è irraggiungibile — il ramo scheletro (`logQ.data === undefined`) ritorna prima; `exercise_id` vuoto / `outcome` fuori insieme / `reviewedAt` NaN sono irraggiungibili (colonna `uuid not null`, validazione dell'adattatore su `outcome`/`reviewed_at`); «log incompleto → divergenza» non si dà (review_log è append-only, nessuna policy update/delete); il tie su `reviewedAt` per lo stesso esercizio nello stesso millisecondo non avviene (un esercizio è risposto una volta per istante), quindi «ordine irrilevante» vale per ogni input raggiungibile; la struttura a11y (h3+ol, `<p>` a vuoto con copy auto-descrittiva) è il pattern di 5.1 già accettato; il riuso della chiave `['streak', userId]` è deliberato (cache calda condivisa, Design Notes 5.1); l'allineamento adattatore↔CHECK SQL deriva già dalla costante unica `REVIEW_OUTCOMES`; il test di vista con le sei stringhe letterali spot-verifica il render mentre la derivazione dall'asse è provata al livello dominio (`stageDistribution.test.ts`).

## Auto Run Result

Status: done
Blocking condition: (nessuna)

**Sintesi della modifica.** Story 5.2 «A che punto sono i miei esercizi»: la seconda vista statistica di Epic 5 (FR7.2). `StatsScreen` ora ha una SECONDA sezione — la distribuzione degli esercizi per stadio di scheduling (0–5) — derivata da una funzione PURA del dominio (`stageDistribution`) che opera SOLO su `review_log` (AD-18): raggruppa le risposte per esercizio, rigioca gli esiti in ordine di `reviewedAt` attraverso l'UNICA transizione di stadio del motore (`nextStage`, ora esportata da `schedule.ts`) e conta gli esercizi per stadio finale. L'asse dei sei stadi deriva dalla costante unica `LEITNER_INTERVALS_DAYS` (AD-17); lo stadio corrente non si legge mai da `review_state`. Il canale unico `listReviewLog()` è stato esteso da (solo timestamp) alla proiezione completa della riga (`ReviewLogRecord`: + `exerciseId`, `outcome`), lasciando intatti `ReviewLogEntry`/`streak`/`answersOverTime`.

**File della modifica (diff dal baseline `fcf4b2e`):**
- `src/domain/schedule.ts` — esportata `nextStage(stage, outcome)` (clamp + `nextStageFor`); `schedule` rifattorizzata per usarla (unica transizione).
- `src/domain/streak.ts` — aggiunto `ReviewLogRecord extends ReviewLogEntry` (`exerciseId`, `outcome`); `ReviewLogEntry`/`streak` invariati.
- `src/domain/stageDistribution.ts` — nuova funzione pura/totale/senza-tempo `stageDistribution(log)`: fold per esercizio dallo stadio 0 via `nextStage`, asse contiguo `0..LEITNER_INTERVALS_DAYS.length-1`, `[]` a log vuoto.
- `src/domain/stageDistribution.test.ts` — I/O Matrix completa (stadi diversi, un esercizio conta una volta, `again` reset, `hard` tiene, saturazione clamp, ordine input irrilevante, log vuoto, asse da costante, purezza, anti-vacuità).
- `src/domain/ports/reviewRepository.ts` — `listReviewLog()` ritorna `ReviewLogRecord[]`; docstring aggiornata.
- `src/data/reviewRepository.ts` (+ `.test.ts`) — colonne `exercise_id, outcome, reviewed_at`; `toReviewLogRecord` valida `exercise_id`/`outcome` (contro `REVIEW_OUTCOMES`) → `DataError('listReviewLog')`; nessuna migrazione/RPC toccata.
- `src/features/stats/StatsScreen.tsx` (+ `.test.tsx`) — seconda sezione (distribuzione) senza clock; placeholder a vuoto, altrimenti `<h3>` + `<ol>` di barre per-stadio col conteggio come TESTO; test dei sei stadi, fonte-solo-log, parità en/it.
- `src/i18n/en.ts` + `src/i18n/it.ts` — `stats.stageDistribution: { heading, stageLabel, empty }` a parità (ASCII, senza `{{count}}`).
- `src/features/ports/PortsContext.test.tsx` — `sampleLog` adeguato al tipo esteso.

**Esito dei rilievi (questa pass):** patch applicati: 2 (low 2); deferiti: 1 nuovo (low, lettura illimitata del log); respinti: 15 (tutti low). Intent_gap 0, bad_spec 0.

**Raccomandazione di follow-up review:** `false`. Conteggio dei soli `patch` di questa pass: high 0, medium 0, low 2. Punteggio = 3×0 + 1×2 = 2 (< 5) e nessun patch high ⇒ `false`.

**Verifica eseguita:**
- `npm run typecheck` — 0 errori.
- `npm run lint` — 0 violazioni.
- `npm test` — 1059 test verdi su 91 file (inclusi `stageDistribution.test.ts`, i test aggiornati di `StatsScreen`/`reviewRepository`/`PortsContext`, il test di `nextStage`, la parità en/it, l'invariante «un solo `<main>`»).
- `npm run build` — build ok (l'avviso sulla dimensione del chunk è generale e preesistente, non una regressione di 5.2).

**Rischi residui:** il rilievo `deferred` — la lettura illimitata di `review_log` (nessuna paginazione), che ora alimenta anche la ricostruzione dello stadio, O(numero di risposte) per render. Pre-esistente e futura di scalabilità (cronologie attuali brevi), non un difetto introdotto da 5.2.
