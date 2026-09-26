---
title: '5.3 Quale regola non mi entra in testa'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: 'f7917141b3856efbbf6feefeb23f7f80fc9ebe57'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** L'utente non riconosce QUALI punti grammaticali sbaglia piu spesso, quindi non sa su quale lezione tornare. E la terza e centrale statistica di Epic 5 (FR7.3) e arricchisce la vista `/statistiche` gia costruita da 5.1/5.2.

**Approach:** Aggiungere a `StatsScreen` una TERZA sezione — i punti grammaticali ordinati per tasso di errore — derivata da una funzione PURA del dominio (`grammarPointErrorRates`) che opera SOLO su `review_log`: raggruppa le risposte per `grammarPoint` (letto denormalizzato dal log, MAI per esercizio) e calcola `errori/totale` dove errore = esito `again`. Ogni voce NOMINA la lezione che insegna quel punto, risolvendo `grammarPoint` -> lezione dal catalogo (`content.listLessons()`) via un helper puro (`lessonsByGrammarPoint`). Il canale unico `listReviewLog()` viene esteso da (exerciseId/outcome/reviewedAt) a includere anche `grammarPoint`.

## Boundaries & Constraints

**Always:**
- Il tasso di errore deriva ESCLUSIVAMENTE da `review_log` (AD-18), letto via `review.listReviewLog()` sulla STESSA chiave `['streak', userId]` gia condivisa da dashboard/sessione/5.1/5.2. Mai `review_state`/`lapse_count`/`review_count`/`listDue`.
- L'aggregazione raggruppa per `grammarPoint` DEL LOG (denormalizzato, AD-18/AD-23/FR5.7), NON per `exerciseId`: e cio che rende la statistica per-punto-grammaticale e resistente alla riautorazione (un esercizio che cambia identita non intacca la storia gia accumulata sul suo punto).
- L'errore e l'esito `again` (fallito), coerente con la semantica di `REVIEW_OUTCOMES` (`schedule.ts`); `errorRate = errori/totale` in `[0,1]`.
- Ogni voce NOMINA la lezione che insegna il punto (azionabile): titolo risolto via `resolveBilingual(lesson.title, locale)` (FR8.5), con `locale = resolveLocale(i18n.language)`. Il match `grammarPoint` -> lezione scorre i `grammarPoints` di ciascun `LessonSummary`.
- L'aggregazione vive nel DOMINIO come funzione pura, totale, senza mutazione e SENZA parametri di tempo (il tasso non dipende dall'orologio: `grammarPointErrorRates.length === 1`).
- Il punto grammaticale e CONTENUTO giapponese: reso in `<span lang="ja">` (WCAG 3.1.2, pattern di `JapaneseText`/`ExplanationPanel`), mai da `t()`. Il titolo lezione porta `lang={resolved.language}`.
- `features` importa solo `domain`/`ui`/`i18n`/react/@tanstack (mai `data`, mai react-router): porte da `usePorts()`, `userId` prop, navigazione callback (AD-1). Ogni stringa d'interfaccia da `t()` con parita en/it (AD-14), ASCII (il giapponese non passa da `t()`), nessun `{{count}}`; solo token del design system, NESSUN verde di successo, nessun `!`/emoji/avverbio di lode. Il tasso e sempre TESTO, mai veicolato dal solo colore.
- Estendere il canale `listReviewLog()` per esporre la colonna `grammar_point` (gia a DB, `not null`); l'adattatore la valida come stringa (coerente con `exercise_id`) e lancia `DataError('listReviewLog')` su riga malformata.

**Block If:**
- (nessuna decisione che richieda un umano: l'intento e univoco; AD-18 e la denormalizzazione di `grammar_point` selezionano senza ambiguita la fonte e la chiave di aggregazione)

**Never:**
- NON leggere `review_state`/`lapse_count`/`review_count`/lo `stage` memorizzato: il tasso si DERIVA, non si legge (darebbe un secondo numero difendibile e divergente).
- NON raggruppare per `exerciseId` ne dedurre il punto grammaticale dall'esercizio corrente: si legge SOLO il `grammarPoint` denormalizzato del log.
- NON toccare la migrazione di `review_log` ne la RPC `apply_review`: la colonna `grammar_point` esiste gia; qui si estende solo la LETTURA.
- NON modificare `answersOverTime`/`streak`/`stageDistribution` ne i loro test: consumano `ReviewLogEntry`/`ReviewLogRecord`, cui `grammarPoint` e aggiunta in modo additivo.
- NON costruire la ricca dichiarazione "cosa manca e quanto" (storia 5.4): a log vuoto rendi un placeholder testuale neutro, MAI un riquadro di grafico vuoto.
- NON filtrare via i punti con 0 errori: si mostrano TUTTI i punti praticati, ordinati per tasso decrescente (vedi Design Notes). NON introdurre una soglia arbitraria assente dall'intento.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Punti a tassi diversi | log con `grammarPoint` vari, esiti misti | Una voce per punto: `{ grammarPoint, total, errors, errorRate }`, ordinate per `errorRate` desc | Nessun errore atteso |
| Stesso punto, piu esercizi/identita | due `exerciseId` diversi, STESSO `grammarPoint` | Aggregati in UNA voce (per punto, non per esercizio): la storia sopravvive alla riautorazione | Nessun errore atteso |
| Tutti `again` per un punto | esiti `[again, again]` | `errorRate === 1` per quel punto | Nessun errore atteso |
| Nessun `again` per un punto | esiti `[good, easy]` | `errorRate === 0`, la voce compare comunque (in fondo all'ordine) | Nessun errore atteso |
| Pareggio sul tasso | due punti con stesso `errorRate` | Tie-break: `total` desc, poi `grammarPoint` asc (deterministico) | Nessun errore atteso |
| Log vuoto | `listReviewLog()` -> `[]` | La funzione ritorna `[]`; la vista rende il placeholder testuale neutro | Nessun errore atteso |
| Punto -> lezione | `grammarPoint` presente nei `grammarPoints` di una lezione | La voce NOMINA quella lezione (titolo risolto); punto reso in `lang="ja"` | Nessun errore atteso |
| Punto orfano (drift contenuti) | `grammarPoint` del log assente da ogni lezione corrente | La voce compare col punto + tasso e un fallback neutro (`unknownLesson`), mai un crash | Nessun errore atteso |
| Punto in piu lezioni | stesso `grammarPoint` in due `LessonSummary` | Vince la lezione con `ordinal` piu basso (deterministico) | Nessun errore atteso |
| Adattatore: riga malformata | `grammar_point` non stringa | `DataError('listReviewLog')` (reject) | Reject, non valore degradato |
| `userId` non risolto o cache pending | `userId === null`, oppure `logQ.data`/`lessonsQ.data === undefined` | Scheletro `aria-busy` | Nessun errore atteso |

</intent-contract>

## Code Map

- `src/domain/streak.ts` -- `ReviewLogRecord` (riga 44): AGGIUNGERE `readonly grammarPoint: string`. Additivo: `ReviewLogEntry`/`streak`/`answersOverTime`/`stageDistribution` restano invariati (leggono solo i campi che gia usano). Aggiornare la docstring (la proiezione completa ora porta anche il punto grammaticale, fonte di 5.3).
- `src/domain/grammarPointErrorRates.ts` -- CREARE `grammarPointErrorRates(log: readonly ReviewLogRecord[]): readonly GrammarPointErrorRate[]` + `interface GrammarPointErrorRate { grammarPoint; total; errors; errorRate }`. Pura, totale, senza tempo. `[]` a log vuoto. Errore = `outcome === 'again'`. Ordine `errorRate` desc, poi `total` desc, poi `grammarPoint` asc. Import `ReviewLogRecord` da `./streak`. Stile di `stageDistribution.ts`.
- `src/domain/grammarPointErrorRates.test.ts` -- CREARE i test della I/O Matrix del dominio (tassi diversi; stesso punto + esercizi diversi => una voce; tutti `again` => 1; nessun `again` => 0; pareggio => tie-break; log vuoto => `[]`; purezza/non-mutazione/determinismo; anti-vacuita).
- `src/domain/curriculum.ts` -- AGGIUNGERE `lessonsByGrammarPoint(lessons: readonly LessonSummary[]): ReadonlyMap<string, LessonSummary>` (mappa OGNI `grammarPoint` di OGNI lezione alla lezione; scorre per `ordinal` crescente; primo occupante vince alla collisione). Import `LessonSummary` gia presente (riga 13). NON toccare `nextLessonToUnlock`/`lastUnlockedLesson`.
- `src/domain/curriculum.test.ts` -- aggiungere i test di `lessonsByGrammarPoint` (una lezione con piu punti => tutti mappati; collisione => ordinal piu basso vince; lista vuota => mappa vuota).
- `src/domain/ports/reviewRepository.ts` -- `listReviewLog()` (riga 57) resta `Promise<readonly ReviewLogRecord[]>`; aggiornare SOLO la docstring (il canale unico ora porta anche `grammarPoint`).
- `src/data/reviewRepository.ts` -- `REVIEW_LOG_COLUMNS` (riga 38): aggiungere `grammar_point`. `ReviewLogRow` (riga 50): aggiungere `grammar_point: unknown`. `toReviewLogRecord` (riga 70): mappare/validare `grammar_point` (stringa, come `exercise_id`) -> `grammarPoint`, `DataError('listReviewLog')` su riga malformata.
- `src/data/reviewRepository.test.ts` -- blocco `listReviewLog` (riga 223+): aggiungere `grammar_point` alle righe finte valide e alle asserzioni `toEqual`; `expect(calls.columns).toContain('grammar_point')`; aggiungere un caso malformato (`grammar_point` non stringa => `DataError`).
- `src/features/stats/StatsScreen.tsx` -- aggiungere la porta `content` a `usePorts()`; `const { t, i18n } = useTranslation(); const locale = resolveLocale(i18n.language)`; nuova query `lessonsQ = useQuery({ queryKey: ['lessons'], queryFn: () => content.listLessons() })` (STESSA chiave della dashboard, cache condivisa); aggiungere `lessonsQ.data === undefined` al gate scheletro. Inserire la TERZA sezione dopo la distribuzione, prima del bottone di ritorno (riga ~189): `grammarPointErrorRates(logQ.data)` + `lessonsByGrammarPoint(lessonsQ.data)`; placeholder se vuota, altrimenti `<h3>` + `<ol>` di voci (punto in `<span lang="ja">`, tasso come TESTO, nome lezione o `unknownLesson`, barra proporzionale a `errorRate`, token neutri).
- `src/features/stats/StatsScreen.test.tsx` -- `seededClient` (riga 53): seminare ANCHE `['lessons']` (default `[]`) cosi il gate scheletro non scatta. `logAt` (riga 40): aggiungere un default ASCII per `grammarPoint` (es. `'gp-1'`). Aggiungere i test 5.3: voce col punto giapponese in `lang="ja"` + nome lezione; punto orfano => fallback; log vuoto => nessun `<ol>` della terza sezione; fonte solo `listReviewLog`/`listLessons`; parita en/it.
- `src/i18n/en.ts` (riga ~114) + `src/i18n/it.ts` (riga ~107) -- dentro `stats`, dopo `stageDistribution`: AGGIUNGERE `grammarPointErrorRates: { heading, entryLabel ('{{errors}}'/'{{total}}'), lessonLabel ('{{lesson}}'), unknownLesson, empty }` a parita, ASCII, senza `{{count}}`.
- `src/features/ports/PortsContext.test.tsx` -- `sampleLog` (riga 72): aggiungere `grammarPoint` (il ritorno tipizzato `ReviewLogRecord[]` ora lo esige).
- `src/domain/stageDistribution.test.ts` -- `rec` (riga 16) e il literal a riga ~160: aggiungere `grammarPoint` (costruiscono `ReviewLogRecord`; il valore e irrilevante per `stageDistribution`).
- `src/i18n/i18n.test.tsx` -- parita en/it e assenza di CJK gia imposte ricorsivamente (vincolo da rispettare; nessuna modifica).

## Tasks & Acceptance

**Execution:**
- `src/domain/streak.ts` -- AGGIUNGERE `grammarPoint: string` a `ReviewLogRecord`; docstring aggiornata. -- La proiezione completa del log porta il punto grammaticale (fonte di 5.3).
- `src/domain/grammarPointErrorRates.ts` -- CREARE la funzione pura e il tipo `GrammarPointErrorRate`. -- Il tasso di errore per punto grammaticale (FR7.3), derivato dal solo log (AD-18).
- `src/domain/grammarPointErrorRates.test.ts` -- CREARE i test della I/O Matrix di dominio. -- Copre aggregazione per punto, errore=again, ordine e tie-break, purezza.
- `src/domain/curriculum.ts` -- AGGIUNGERE `lessonsByGrammarPoint`. -- Il join puro punto -> lezione per l'azionabilita ("nomina la lezione").
- `src/domain/curriculum.test.ts` -- aggiungere i test di `lessonsByGrammarPoint`. -- Copre multi-punto, collisione, lista vuota.
- `src/domain/ports/reviewRepository.ts` -- aggiornare la docstring di `listReviewLog`. -- Canale unico esteso (AD-18).
- `src/data/reviewRepository.ts` -- estendere `REVIEW_LOG_COLUMNS`/`ReviewLogRow`/`toReviewLogRecord` con `grammar_point`. -- L'adattatore porta il punto grammaticale validato.
- `src/data/reviewRepository.test.ts` -- aggiornare i fixture/asserzioni e aggiungere il caso malformato. -- Copre la mappa/validazione estesa.
- `src/features/stats/StatsScreen.tsx` -- aggiungere la porta `content`, la query `['lessons']` (nel gate scheletro) e la terza sezione (tassi per punto + nome lezione). -- La terza vista statistica (FR7.3).
- `src/features/stats/StatsScreen.test.tsx` -- seminare `['lessons']`, aggiornare `logAt`, aggiungere i test 5.3. -- Copre gli AC alla superficie.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- aggiungere `stats.grammarPointErrorRates` a parita, ASCII, senza `{{count}}`. -- Nessuna stringa cablata (AD-14).
- `src/features/ports/PortsContext.test.tsx` + `src/domain/stageDistribution.test.ts` -- aggiungere `grammarPoint` ai `ReviewLogRecord` costruiti. -- Adeguare al tipo esteso.

**Acceptance Criteria:**
- Given un `review_log` con esiti `again` ripetuti su piu punti grammaticali, when si rende `StatsScreen` con l'`userId` risolto, then la vista mostra l'elenco dei PUNTI GRAMMATICALI (non dei singoli esercizi) ordinati per tasso di errore decrescente, ciascuno col tasso come testo.
- Given l'aggregazione, when viene calcolata, then raggruppa per `grammarPoint` letto da `review.listReviewLog()` e NON consulta `review_state`/`lapse_count`/`listDue`; due esercizi con identita diverse ma stesso `grammarPoint` contano in UNA sola voce (la storia sopravvive alla riautorazione).
- Given un punto grammaticale nell'elenco che una lezione insegna, when viene renderizzato, then NOMINA quella lezione (titolo risolto per la lingua corrente) e il punto giapponese e reso in `lang="ja"`.
- Given un punto grammaticale del log assente da ogni lezione corrente, when viene renderizzato, then la voce compare comunque col punto e il tasso e un fallback neutro (nessun crash).
- Given un `review_log` vuoto, when si rende `StatsScreen`, then la terza sezione mostra un placeholder testuale neutro e NON un riquadro di grafico vuoto.

## Design Notes

Perche per `grammarPoint` del LOG e non per esercizio: FR7.3 chiede "quale REGOLA non ti e entrata", non "quale frase sbagli". Il log porta `grammar_point` denormalizzato (snapshot al momento della risposta, `apply_review`): raggruppare su questo campo rende la statistica interrogabile anche dopo che un esercizio e stato riautorato e ha cambiato identita (AD-23) o e stato rimosso. Se il punto vivesse solo su `exercise`, una riautorazione riscriverebbe la storia. Questo e anche cio che soddisfa l'AC "aggrega per grammar_point, non per singolo esercizio" in un colpo solo.

Perche il join vive fuori dall'aggregazione: `grammarPointErrorRates` resta puro sul SOLO log (AD-18), come `stageDistribution`/`answersOverTime`. Il nome della lezione e un ARRICCHIMENTO che dipende dal catalogo (`content.listLessons()`), quindi la mappa punto -> lezione e un helper puro separato (`lessonsByGrammarPoint`) e la risoluzione bilingue avviene nella vista. Cosi la statistica non nasce accoppiata al contenuto vivo.

Perche mostrare TUTTI i punti (anche a tasso 0) ordinati per tasso desc, e non solo quelli con errori: coerente con l'intero Epic 5, che mostra il quadro completo senza nascondere dati (5.1 giorni contigui inclusi gli zeri; 5.2 tutti i sei stadi inclusi gli zeri). L'AC chiede "l'elenco ... con il tasso di errore piu alto": un ORDINAMENTO decrescente lo soddisfa, coi peggiori in cima. Alternativa considerata e scartata: filtrare `errorRate > 0` introdurrebbe una soglia assente dall'intento e romperebbe la simmetria con le altre due viste.

Caso orfano (drift contenuti): il log e uno snapshot storico; l'unicita del `grammarPoint` fra lezioni NON e imposta (solo `lessonId = grammarPoints[0]`), e il contenuto puo evolvere. Se `lessonsByGrammarPoint` non trova la lezione, la vista rende `unknownLesson` (neutro) senza perdere la voce: la statistica resta onesta.

Bar accessibile: come 5.1/5.2, il tasso e sempre TESTO (`Errori: {{errors}} su {{total}}`); la barra e larghezza inline = `errorRate` (gia in `[0,1]`, nessuna normalizzazione al massimo), token neutri (`bg-ink-secondary`/`bg-surface-sunken`, mai verde). A tasso 0 la barra e vuota, come i bucket a 0 di 5.2.

Esempio (ordine): punti A `2/2` (1.0), B `1/4` (0.25), C `0/3` (0.0) => elenco `[A, B, C]`.

## Verification

**Commands:**
- `npm run typecheck` -- expected: 0 errori (nuovo campo `grammarPoint`, funzione e helper nuovi, chiavi i18n tipizzate).
- `npm run lint` -- expected: 0 violazioni (confini AD-1: `features` non importa `data`; dominio senza I/O; nessun colore esadecimale letterale).
- `npm test` -- expected: verdi il nuovo `grammarPointErrorRates.test.ts`, i test aggiornati di `curriculum`/`StatsScreen`/`reviewRepository`/`PortsContext`/`stageDistribution`, la parita en/it e l'assenza di CJK di `i18n.test.tsx`, l'invariante "un solo `<main>`".
- `npm run build` -- expected: build ok (Tailwind risolve i token usati).

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 0, low 2)
- defer: 0
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[low]` `[patch]` Il titolo della lezione, interpolato via `{{lesson}}` in `lessonLabel`, non portava `lang` — il vincolo intent-contract "Il titolo lezione porta `lang={resolved.language}`" era disatteso (con UI italiana e titolo solo-inglese l'AT avrebbe pronunciato l'inglese con fonemi italiani, WCAG 3.1.2). Reso ora in un nodo proprio `<span lang={resolved.language}>{resolved.text}</span>` dopo `lessonLabel` reso etichetta STATICA (`Lesson:`/`Lezione:`, parita en/it, ASCII); il ripiego it->en e ora marcato `lang="en"`.
  - `[low]` `[patch]` Il ramo del gate scheletro `lessonsQ.data === undefined` non era pinnato da alcun test (ogni test seminava entrambe le chiavi o nessuna): aggiunto un test che semina SOLO `['streak', UID]` (lezioni pending) e asserisce lo scheletro (`aria-busy="true"`, nessuna delle tre intestazioni). Senza il ramo, `lessonsByGrammarPoint(undefined)` andrebbe in crash non rilevato.
- Nota (rilievi respinti, tutti low): la navigazione cliccabile alla lezione e oltre l'AC3 (che chiede di NOMINARE la lezione, non di collegarla); il passaggio `resolveLocale(i18n.language)` (`Locale`) a `resolveBilingual` (`BilingualLanguage`) e identico al pattern gia accettato di `ExerciseCard`; il drop silenzioso di una riga in `apply_review` e il backfill di `review_log` riguardano il write path/migrazione non toccati (colonna `grammar_point not null` dalla creazione della tabella, nessuna riga legacy possibile); i tre predicati di vuoto (`series`/`distribution`/`errorRates`) coincidono sempre (tutti `[]` sse e solo se il log e vuoto); nessuna divisione per zero nella barra (`errorRate` gia in `[0,1]`); la barra e un `<div>` decorativo coerente con 5.1/5.2 (nessun ruolo, non annunciata); un `grammar_point` vuoto non e raggiungibile (il contenuto e validato `nonEmptyString` e la colonna e `not null`); la copy "errori: 0 su 1" e accurata e neutra; l'ordine di tie-break e garantito dal dominio e preservato dal render; `typecheck` verde prova che tutti i costruttori di `ReviewLogRecord` sono stati aggiornati; il gate scheletro su `['lessons']` e deliberato e coerente con la dashboard (disaccoppiare introdurrebbe un flash fuorviante "lezione rimossa" durante il caricamento normale).

## Auto Run Result

Status: done
Blocking condition: (nessuna)

**Sintesi della modifica.** Story 5.3 «Quale regola non mi entra in testa»: la terza e centrale vista statistica di Epic 5 (FR7.3). `StatsScreen` ora ha una TERZA sezione — i punti grammaticali ordinati per tasso di errore decrescente — derivata da una funzione PURA del dominio (`grammarPointErrorRates`) che opera SOLO su `review_log` (AD-18): raggruppa le risposte per `grammarPoint` DEL LOG (denormalizzato, MAI per esercizio), conta gli esiti `again` come errori e calcola `errori/totale`. Ogni voce NOMINA la lezione che insegna quel punto — arricchimento risolto dal catalogo (`content.listLessons()`) via l'helper puro `lessonsByGrammarPoint` + `resolveBilingual` per la lingua corrente; un punto orfano (drift contenuti) rende un fallback neutro. Il punto grammaticale, contenuto giapponese, e reso in `<span lang="ja">`; il titolo lezione porta `lang={resolved.language}`. Il canale unico `listReviewLog()` e stato esteso con `grammar_point` (colonna gia a DB), lasciando intatti `ReviewLogEntry`/`streak`/`answersOverTime`/`stageDistribution`.

**File della modifica (diff dal baseline `f791714`):**
- `src/domain/streak.ts` — aggiunto `grammarPoint: string` a `ReviewLogRecord` (additivo); docstring aggiornata.
- `src/domain/grammarPointErrorRates.ts` — nuova funzione pura/totale/senza-tempo `grammarPointErrorRates(log)` + tipo `GrammarPointErrorRate`; aggrega per punto, errore = `again`, ordine tasso desc / total desc / punto asc; `[]` a log vuoto.
- `src/domain/grammarPointErrorRates.test.ts` — I/O Matrix di dominio (tassi diversi, un punto su due esercizi ⇒ una voce, tutti again ⇒ 1, nessun again ⇒ 0, tie-break, log vuoto, purezza, anti-vacuita).
- `src/domain/curriculum.ts` (+ `.test.ts`) — nuovo helper puro `lessonsByGrammarPoint` (mappa ogni punto alla lezione; collisione ⇒ ordinal piu basso vince); `nextLessonToUnlock`/`lastUnlockedLesson` intatti.
- `src/domain/ports/reviewRepository.ts` — docstring di `listReviewLog` aggiornata (il canale porta anche `grammarPoint`).
- `src/data/reviewRepository.ts` (+ `.test.ts`) — `REVIEW_LOG_COLUMNS`/`ReviewLogRow`/`toReviewLogRecord` estesi con `grammar_point` (validato stringa ⇒ `DataError` su malformata); nessuna migrazione/RPC toccata.
- `src/features/stats/StatsScreen.tsx` (+ `.test.tsx`) — porta `content`, query `['lessons']` (chiave della dashboard, nel gate scheletro), terza sezione (punto in `lang="ja"`, tasso come TESTO, nome lezione con `lang` o fallback neutro, barra proporzionale a `errorRate`); test 5.3 (punto+lezione, orfano, log vuoto, fonte-solo, parita en/it, scheletro con lezioni pending).
- `src/i18n/en.ts` + `src/i18n/it.ts` — `stats.grammarPointErrorRates: { heading, entryLabel, lessonLabel, unknownLesson, empty }` a parita (ASCII, senza `{{count}}`).
- `src/features/ports/PortsContext.test.tsx` + `src/domain/stageDistribution.test.ts` — `grammarPoint` aggiunto ai `ReviewLogRecord` costruiti.

**Esito dei rilievi (questa pass):** patch applicati: 2 (low 2); deferiti: 0; respinti: 13 (tutti low). Intent_gap 0, bad_spec 0.

**Raccomandazione di follow-up review:** `false`. Conteggio dei soli `patch` di questa pass: high 0, medium 0, low 2. Punteggio = 3×0 + 1×2 = 2 (< 5) e nessun patch high ⇒ `false`.

**Verifica eseguita (indipendente, dopo i patch):**
- `npm run typecheck` — 0 errori.
- `npm run lint` — 0 violazioni.
- `npm test` — 1089 test verdi su 92 file (inclusi `grammarPointErrorRates.test.ts`, i test aggiornati di `curriculum`/`StatsScreen`/`reviewRepository`/`PortsContext`/`stageDistribution`, la parita en/it e l'assenza di CJK, l'invariante «un solo `<main>`»).
- `npm run build` — build ok (l'avviso sulla dimensione del chunk e generale e preesistente, non una regressione di 5.3).

**Rischi residui:** la lettura illimitata di `review_log` (nessuna paginazione), gia deferita in 5.1/5.2, ora alimenta anche l'aggregazione per punto: O(numero di risposte) per render. Pre-esistente e futura di scalabilita (cronologie attuali brevi), non un difetto introdotto da 5.3. Il gate scheletro accoppia l'intera vista statistiche alla query `['lessons']` (coerente con la dashboard): un fallimento di `listLessons()` lascerebbe la vista sullo scheletro — trade-off deliberato, come per ogni query bloccante delle schermate di questo codebase.
