---
title: '5.1 Quante risposte, e quando'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '67a32dd897ecd37238201c961b53b08cf9344f97'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      StatsScreen (come dashboard e sessione) non ha un ramo di errore di query: se review.listReviewLog() fallisce, logQ.data resta undefined e la schermata mostra uno scheletro aria-busy permanente, senza messaggio di errore né via d'uscita.
    evidence: |-
      In src/features/stats/StatsScreen.tsx l'unico ramo non-contenuto è `if (!userId || logQ.data === undefined) return <scheletro>`; nessuna gestione di isError. Rispecchia il pattern consolidato del repo (DashboardScreen e SessionScreen si fermano allo scheletro sul solo `data === undefined`), quindi è una lacuna trasversale all'app, meglio affrontata in modo uniforme che solo su questa schermata.
    location: >-
      src/features/stats/StatsScreen.tsx
    severity: medium
  - summary: >-
      La serie giornaliera delle risposte è illimitata: answersOverTime emette un elemento per giorno dal primo giorno con risposte fino a oggi (contigua, code di zeri incluse), senza finestra né paginazione, quindi account di lunga data producono liste molto lunghe.
    evidence: |-
      src/domain/answersOverTime.ts costruisce la serie da min(ordinali) a max(oggi, ordinali); un utente che ha studiato mesi fa e poi si è fermato genera decine/centinaia di <li> a conteggio 0 in StatsScreen. L'intento della storia non richiede una finestra e gli utenti attuali hanno cronologie brevi, quindi è una preoccupazione futura di scalabilità/UX, non un difetto di 5.1.
    location: >-
      src/domain/answersOverTime.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** L'utente che studia da settimane non ha modo di vedere l'andamento delle proprie risposte nel tempo, quindi non sa se sta mantenendo il ritmo. È la prima delle statistiche di Epic 5 e apre la vista che le storie 5.2–5.4 arricchiranno.

**Approach:** Una nuova rotta protetta `/statistiche` (`StatsScreen` in `src/features/stats`), raggiungibile con un'affordance dalla dashboard, che mostra le risposte per giorno di calendario. Il conteggio giornaliero è derivato da una funzione PURA del dominio (`answersOverTime`) che opera **solo** su `review_log` letto via la porta `listReviewLog()` — mai da `review_count`/`review_state`.

## Boundaries & Constraints

**Always:**
- La serie giornaliera deriva ESCLUSIVAMENTE da `review_log` (AD-18), letto via `review.listReviewLog()` — la stessa porta e la stessa identità di query `['streak', userId]` già usate da dashboard e sessione per il log. Nessuna lettura di `review_state`/`review_count`/`listDue` in questa vista.
- La logica di aggregazione vive nel DOMINIO come funzione pura, totale, senza mutazione; `now: Date` e `timeZone: string` ENTRANO come parametri espliciti (firma a 3 argomenti come `streak`), mai `Date.now()`/`new Date()` senza argomenti né `Intl…resolvedOptions()`. Il confine di giornata è mezzanotte nel fuso passato, riusando `localDayOrdinal` di `./calendarDay`.
- `features` importa solo `domain`/`ui`/`i18n`/react/@tanstack (mai `data`, mai un'altra feature, mai react-router): le porte arrivano da `usePorts()`, `userId` è una prop, la navigazione è una callback cablata dal livello app.
- Ogni stringa d'interfaccia passa da `t()` con chiavi in `en.ts` e `it.ts` a parità (AD-14); nessuna stringa CJK, nessun `{{count}}` (innesca il pluralizzatore i18next). Solo token del sistema di design per colori/spaziatura; nessun colore letterale; NESSUN verde di successo; nessun `!`/emoji/avverbio di lode. L'informazione non è mai veicolata dal solo colore: ogni giorno porta il proprio conteggio come TESTO.
- Il fuso e l'orologio entrano dal `Clock` iniettato (`clock.now()`/`clock.timeZone()`), come in dashboard/sessione.

**Block If:**
- (nessuna decisione che richieda un umano: l'intento — conteggio di risposte per giorno — è univoco e i dati necessari già esistono)

**Never:**
- NON estendere `ReviewLogEntry`/`listReviewLog()` né toccare `src/data` o le migrazioni: il conteggio per giorno richiede solo `reviewedAt`, già disponibile.
- NON usare `review_count` di `review_state` come fonte (produrrebbe un secondo numero difendibile e divergente).
- NON costruire la ricca dichiarazione «cosa manca e quanto» degli stati a dati insufficienti (è la storia 5.4): a log vuoto rendi un placeholder testuale neutro e minimale, MAI un riquadro di grafico vuoto.
- NON implementare la distribuzione per stadio (5.2) né i tassi d'errore per punto grammaticale (5.3).
- NON scomporre le risposte per esito (`again/hard/good/easy`): questa storia conta «quante risposte, e quando», non l'accuratezza.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Log con più giorni | `review_log` con risposte su giorni diversi | Serie CONTIGUA per giorno dal primo giorno con risposte fino a OGGI (nel fuso), conteggio per giorno; i giorni interni senza risposte compaiono con conteggio `0` | Nessun errore atteso |
| Più risposte stesso giorno | Più voci con lo stesso giorno locale | Un solo elemento per quel giorno con `count` = numero di voci | Nessun errore atteso |
| Ultima risposta nel passato | Ultima voce alcuni giorni prima di `now` | La serie si ESTENDE fino a oggi; gli ultimi giorni compaiono con `0` (onesta sul ritmo interrotto) | Nessun errore atteso |
| Log vuoto | `listReviewLog()` → `[]` | La funzione ritorna `[]`; la vista rende un placeholder testuale neutro (non un grafico vuoto) | Nessun errore atteso |
| `userId` non risolto o cache pending | `userId === null` oppure `logQ.data === undefined` | Scheletro `aria-busy`, stessa altezza del contenuto, nessuno spinner | Nessun errore atteso |

</intent-contract>

## Code Map

- `src/domain/streak.ts` -- `ReviewLogEntry` (solo `reviewedAt`, riga 29-31) da importare; `streak(log, now, timeZone)` (riga 53) è il precedente ESATTO di firma e stile per la nuova funzione.
- `src/domain/calendarDay.ts` -- `localDayOrdinal(instant, timeZone)` (riga 24) e `MS_PER_DAY` (riga 13): il confine di giornata condiviso da riusare per il bucketing e la contiguità.
- `src/domain/ports/reviewRepository.ts` -- `ReviewRepository.listReviewLog()` (riga 52): l'UNICO canale del log; nessun `userId`, RLS isola la riga. NON modificare.
- `src/features/dashboard/DashboardScreen.tsx` -- riga 101-105 usa `useQuery({ queryKey: ['streak', userId], queryFn: () => review.listReviewLog() })`: il pattern da rispecchiare; riga 235+ (ramo contenuto) è dove aggiungere l'affordance «vedi statistiche»; nuova prop `onViewStats`.
- `src/features/study/SessionScreen.tsx` -- il modello di una schermata-rotta con `<main>`, `usePorts()`, prop `userId`/`onExit`, scheletro `aria-busy` (riga 367) e affordance di ritorno secondaria (riga 411-417).
- `src/features/study/ProgressMeter.tsx` -- precedente di barra proporzionale accessibile (da consultare per lo stile della barra per-giorno).
- `src/features/ports/PortsContext.tsx` -- `usePorts()` fornisce `review`/`clock`; `PortsProvider` avvolge `AppRoutes` (AuthRoot.tsx:160), quindi la rotta stats può usarlo.
- `src/app/routes.ts` -- aggiungere `STATS_PATH` (accanto a `STUDY_PATH`, riga 21).
- `src/app/AppRoutes.tsx` -- riga 72-80: modello di rotta VERA sotto `RequireAuth` PRIMA del catch-all; aggiungere la rotta stats con `onExit={() => navigate(ROOT_PATH)}`.
- `src/app/AuthenticatedShell.tsx` -- riga 66/98-102: cablare `onViewStats = () => navigate(STATS_PATH)` e passarlo a `<DashboardScreen>`.
- `src/i18n/en.ts` / `src/i18n/it.ts` -- riga 33-87 (`dashboard`) e struttura generale: aggiungere `dashboard.viewStats` e una sezione `stats.*` a parità.
- `src/i18n/i18n.test.tsx` -- riga 55-64: la parità ricorsiva en/it e l'assenza di CJK sono già testate (vincolo da rispettare).
- `src/features/dashboard/DashboardScreen.test.tsx` -- riga 143-156 `render()` passa le prop: aggiungere `onViewStats`; harness (seed `['streak', UID]`, `renderToStaticMarkup`) da rispecchiare nel nuovo test.
- `src/app/AppRoutes.test.tsx` -- riga 140-145: invariante «un solo `<main>`» a `/` (la rotta stats vive altrove, non lo viola).

## Tasks & Acceptance

**Execution:**
- `src/domain/answersOverTime.ts` -- CREARE `answersOverTime(log: readonly ReviewLogEntry[], now: Date, timeZone: string): readonly DailyAnswerCount[]` più `interface DailyAnswerCount { readonly date: string; readonly count: number }`. Importa `ReviewLogEntry` da `./streak`, `localDayOrdinal`/`MS_PER_DAY` da `./calendarDay`. Bucketizza per `localDayOrdinal`; costruisce la serie CONTIGUA da `min(ordinali)` a `max(oggi, max(ordinali))`; `date` = `new Date(ordinal * MS_PER_DAY).toISOString().slice(0,10)` (deterministico, puro); `[]` per log vuoto. -- Fonte unica e derivata (AD-18), stessa purezza di `streak`.
- `src/domain/answersOverTime.test.ts` -- CREARE i test unitari delle righe della I/O Matrix (più giorni, stesso giorno, ultima risposta nel passato con code a `0`, giorni interni a `0`, log vuoto → `[]`), stile `streak.test.ts` con `NOW`/`TZ` fissi. -- Copre l'aggregazione e la contiguità.
- `src/features/stats/StatsScreen.tsx` -- CREARE la schermata-rotta `StatsScreen({ userId, onExit })`: `usePorts()`→`review`/`clock`; `useQuery({ queryKey: ['streak', userId], enabled: !!userId, queryFn: () => review.listReviewLog() })`; scheletro `aria-busy` se `!userId || logQ.data === undefined`; calcola `answersOverTime(logQ.data, clock.now(), clock.timeZone())`; se vuota rende un placeholder testuale neutro (`t('stats.answersOverTime.empty')`), altrimenti l'intestazione più una lista ordinata di barre per-giorno, ciascuna con conteggio come TESTO (`t('stats.answersOverTime.dayLabel', { date, answers })`) e barra proporzionale (token, nessun verde); affordance di ritorno secondaria → `onExit`. -- La vista delle risposte nel tempo (FR7.1).
- `src/features/stats/StatsScreen.test.tsx` -- CREARE i test (harness di `DashboardScreen.test.tsx`: `renderToStaticMarkup`, `QueryClientProvider` con cache seminata su `['streak', userId]`, `PortsProvider`, `Clock` fisso): serie con dati ⇒ intestazione + conteggi visibili; log vuoto ⇒ placeholder, nessun grafico; `userId===null`/cache vuota ⇒ scheletro; una porta `review` spia che verifica che venga chiamata SOLO `listReviewLog` (mai `listDue`). -- Copre AC1/AC2 alla superficie.
- `src/app/routes.ts` -- AGGIUNGERE `export const STATS_PATH = '/statistiche';`. -- Fonte unica dei path (AD-1).
- `src/app/AppRoutes.tsx` -- AGGIUNGERE la rotta `<Route path={STATS_PATH} element={<StatsScreen userId={userId} onExit={() => navigate(ROOT_PATH)} />} />` sotto `RequireAuth`, PRIMA del catch-all; importare `StatsScreen` e `STATS_PATH`. -- Rotta protetta e uscita speculare alla sessione.
- `src/features/dashboard/DashboardScreen.tsx` -- AGGIUNGERE prop `onViewStats: () => void` e un'affordance secondaria «vedi statistiche» (`t('dashboard.viewStats')`) nel ramo contenuto (riga 235+). -- Punto di ingresso in navigazione dalla dashboard.
- `src/app/AuthenticatedShell.tsx` -- CABLARE `const onViewStats = () => navigate(STATS_PATH)` e passarlo a `<DashboardScreen>`; importare `STATS_PATH`. -- La navigazione vive nel livello app (AD-1).
- `src/i18n/en.ts` + `src/i18n/it.ts` -- AGGIUNGERE `dashboard.viewStats` e `stats: { title, answersOverTime: { heading, dayLabel ('{{date}}'/'{{answers}}'), empty }, back }` a parità, ASCII, senza `{{count}}`. -- Nessuna stringa cablata (AD-14).
- Aggiornare i call-site esistenti di `<DashboardScreen>` per la nuova prop `onViewStats`: `src/features/dashboard/DashboardScreen.test.tsx` (render harness) e verificare `src/app/AuthenticatedShell.test.tsx`. -- Non rompere i test esistenti.

**Acceptance Criteria:**
- Given un `review_log` con risposte su giorni diversi, when si rende `StatsScreen` con l'`userId` risolto, then la vista mostra le risposte per giorno (intestazione delle risposte nel tempo più il conteggio di ciascun giorno come testo).
- Given la vista delle risposte nel tempo, when raccoglie i dati, then li ottiene SOLO da `review.listReviewLog()` (la spia conferma che `listDue`/`review_state` non sono consultati e nessun `review_count` è letto).
- Given la dashboard nel suo ramo contenuto, when è resa, then offre un'affordance di navigazione verso le statistiche (`dashboard.viewStats`).
- Given la rotta `/statistiche` sotto autenticazione, when vi si naviga, then rende `StatsScreen` (un solo `<main>`), e un utente non autenticato è rediretto all'accesso come le altre rotte protette.
- Given un `review_log` vuoto, when si rende `StatsScreen`, then mostra un placeholder testuale neutro e NON un riquadro di grafico vuoto.

## Design Notes

Identità di query: la vista riusa `['streak', userId]` perché è già l'identità del log dei ripassi in questo repo (dashboard/sessione lo leggono con la stessa chiave via `listReviewLog()`); un consumatore in più condivide la cache calda e beneficia dell'invalidazione post-risposta della sessione (`onSettled`), senza introdurre una seconda chiave per lo stesso dato né rifattorizzare i file esistenti.

Inverso ordinale→data (puro): `localDayOrdinal` mappa a `Date.UTC(y,m,d)/MS_PER_DAY`, quindi `new Date(ordinal*MS_PER_DAY).toISOString().slice(0,10)` restituisce esattamente `YYYY-MM-DD` di quel giorno nominale. `new Date(numero)` con argomento è deterministico e ammesso nel dominio (a differenza di `new Date()` senza argomenti).

Barra per-giorno accessibile: il conteggio è sempre TESTO; la barra proporzionale (larghezza = `count/max`) usa token neutri (`bg-ink-secondary`/`bg-surface-sunken`, mai verde), coerente con `ProgressMeter`. La larghezza è una lunghezza inline, non un colore letterale, quindi non viola la regola dei token colore.

## Verification

**Commands:**
- `npm run typecheck` -- expected: 0 errori (chiavi i18n tipizzate, prop `onViewStats`, tipi di `answersOverTime`).
- `npm run lint` -- expected: 0 violazioni (confini AD-1: `features` non importa `data`; dominio senza I/O; nessun colore esadecimale letterale).
- `npm test` -- expected: verdi i nuovi `answersOverTime.test.ts` e `StatsScreen.test.tsx`, la parità en/it di `i18n.test.tsx`, l'invariante «un solo `<main>`» di `AppRoutes.test.tsx`, e i test dashboard aggiornati.
- `npm run build` -- expected: build ok (Tailwind risolve i token usati dalla vista).

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 1, low 2)
- defer: 2: (high 0, medium 1, low 1)
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[medium]` `[patch]` `AppRoutes.test.tsx` copriva `/statistiche` solo da anonimo — aggiunto un test di rotta autenticata che verifica che `StatsScreen` sia reso (`en.stats.back`), la precedenza sul catch-all (assenza di `dashboard.primaryAction`) e un solo `<main>`.
  - `[low]` `[patch]` Chiave i18n `stats.title` definita ma mai resa e schermata senza titolo — resa `stats.title` come `<h2 text-display>` di schermata (in entrambi i rami vuoto/dati), intestazione del grafico declassata a `<h3>`; i test asseriscono il titolo in entrambi gli stati.
  - `[low]` `[patch]` `dayLabel` rendeva la grammatica errata "1 answers"/"1 risposte" — riformulata in forma etichetta-valore ASCII ("{{date}} - answers: {{answers}}" / "... - risposte: ...") preservando l'anti-pluralizzatore e l'invariante ASCII; test aggiornati.

### 2026-09-26 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 2, low 1)
- defer: 0
- reject: 14: (high 0, medium 1, low 13)
- addressed_findings:
  - `[medium]` `[patch]` Il bottone di ritorno di `StatsScreen` ometteva il token `FOCUS_RING` che i bottoni gemelli di `SessionScreen`/`ExerciseCard` portano (e che `SessionScreen.test.tsx` verifica): una schermata-rotta nuova, modellata sulla sessione, senza anello di focus da tastiera. Aggiunto il token condiviso (definizione locale come negli altri file) al bottone di ritorno + asserzione di test `focus-visible:outline-focus-ring`. La dashboard NON è stata toccata: i suoi bottoni preesistenti omettono lo stesso token, quindi la divergenza dashboard↔sessione è preesistente e a livello app, fuori dallo scopo di 5.1.
  - `[medium]` `[patch]` L'affordance «vedi statistiche» della dashboard — la SOLA porta d'ingresso alla `StatsScreen` — aveva la destinazione di navigazione (`onViewStats`→`STATS_PATH`) non verificata: ogni test era `toContain` statico sul markup o render diretto via `initialEntries`. Aggiunto un test guidato dal click (harness di `AuthenticatedShell.prefetch.test.tsx`: `MemoryRouter` + sonda `useLocation`) che clicca il bottone e asserisce `pathname === /statistiche`.
  - `[low]` `[patch]` Il test di `StatsScreen` esercitava la serie contigua solo con giorni adiacenti (24+25), indistinguibili sotto letture alternative dell'intento; la contiguità e le code a 0 dell'AC1 erano verificate solo alla superficie del dominio. Aggiunto un test di vista con ultima risposta nel passato (23, `now` al 25) che asserisce i giorni successivi resi come `answers: 0` in TESTO.
- Nota: i due rilievi ripescati ma NON ri-aperti (assenza di ramo `isError` sulla query; serie giornaliera illimitata) sono già presenti nella lista `deferred` di questo spec dalla pass precedente — lasciati intatti, nessun nuovo defer.

### 2026-09-26 — Review pass (follow-up 2)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 15: (high 0, medium 0, low 15)
- addressed_findings:
  - none
- Nota: pass di verifica su lavoro già `done`, nessuna modifica al codice. Le quattro sonde (blind-hunter, edge-case, verification-gap, intent-alignment) confermano l'allineamento all'intento su OGNI gate: fonte solo `review.listReviewLog()` sulla chiave `['streak', userId]` (mai `listDue`/`review_count`/`review_state`), dominio puro a 3 argomenti, parità en/it, nessun `{{count}}`, nessun verde, orologio/fuso dal `Clock` iniettato. La verification-gap non ha trovato lacune di verifica comportamentale.
- Nota: i due soli rilievi REALI e PREESISTENTI ripescati di nuovo (ramo `isError` assente; serie giornaliera illimitata) sono già nella lista `deferred` di questo spec dalle pass precedenti — lasciati intatti, nessun nuovo defer.
- Nota (rilievi respinti): l'anello di focus del bottone «vedi statistiche» è una divergenza dashboard↔sessione PREESISTENTE e a livello app — TUTTI i bottoni della dashboard (azione primaria, sblocco, primo avvio) omettono il token `FOCUS_RING`, e `viewStats` ne segue la convenzione; aggiungerlo al solo `viewStats` lo renderebbe l'UNICO bottone della dashboard con anello custom (incoerenza interna), e `theme.css` non azzera l'outline di default del browser, quindi il focus da tastiera resta comunque visibile. Il guard divide-by-zero della barra (`Math.max(1, ...)`) copre uno stato IRRAGGIUNGIBILE: la serie inizia sempre dal primo giorno con risposte (count >= 1), quindi `max >= 1` sempre. I casi di data estrema/invalida (RangeError su `toISOString`, ordinale NaN) non sono raggiungibili con i timestamp reali del DB. La parità en/it delle nuove chiavi è già imposta ricorsivamente da `i18n.test.tsx`. Il totale aggregato, la cornice di intervallo e il marcatore «oggi» sono fuori dall'intento (che conta le risposte PER GIORNO). Verifica al click dell'uscita `onExit`→`ROOT_PATH`: convenzione del repo, coerente con la copertura statica di `SessionScreen`.

## Auto Run Result

Status: done
Blocking condition: (nessuna)

**Sintesi della modifica.** Story 5.1 «Quante risposte, e quando»: la prima vista delle statistiche di Epic 5 (FR7.1). Una nuova rotta protetta `/statistiche` (`StatsScreen`) mostra le risposte per giorno di calendario, derivate da una funzione PURA del dominio (`answersOverTime`) che opera solo su `review_log` letto via `review.listReviewLog()` sulla stessa identità di query `['streak', userId]` di dashboard e sessione. Un'affordance secondaria dalla dashboard («vedi statistiche») apre la rotta; il ritorno è speculare all'uscita della sessione. Questa pass è un follow-up review su lavoro già `done`: nessuna modifica al codice.

**File della modifica (diff dal baseline `67a32dd`):**
- `src/domain/answersOverTime.ts` — nuova funzione pura/totale `answersOverTime(log, now, timeZone)` + `interface DailyAnswerCount`; serie contigua dal primo giorno con risposte fino a oggi, buckettizzata per `localDayOrdinal`.
- `src/domain/answersOverTime.test.ts` — test unitari dell'intera I/O Matrix (più giorni, stesso giorno, code a 0, buchi interni, log vuoto, confine di mezzanotte nel fuso, purezza/non-mutazione).
- `src/features/stats/StatsScreen.tsx` — nuova schermata-rotta: scheletro `aria-busy`, placeholder testuale a log vuoto, lista di barre per-giorno col conteggio come TESTO, uscita con anello di focus.
- `src/features/stats/StatsScreen.test.tsx` — test di superficie (AC1/AC2/AC5): conteggi come testo, spia che prova la fonte SOLO `listReviewLog`, scheletro, parità en/it.
- `src/app/routes.ts` — `STATS_PATH = '/statistiche'`.
- `src/app/AppRoutes.tsx` (+ `.test.tsx`) — rotta protetta prima del catch-all, `onExit`→`ROOT_PATH`; test di rotta autenticata.
- `src/app/AuthenticatedShell.tsx` (+ `.prefetch.test.tsx`) — cablaggio `onViewStats`→`STATS_PATH`; test di navigazione al click.
- `src/features/dashboard/DashboardScreen.tsx` (+ `.test.tsx`) — prop `onViewStats` e affordance secondaria; aggiornati i conteggi di bottone nei test.
- `src/i18n/en.ts` + `src/i18n/it.ts` — `dashboard.viewStats` e sezione `stats.*` a parità (ASCII, senza `{{count}}`).

**Esito dei rilievi (questa pass):** patch applicati: 0; deferiti: 0 nuovi (i 2 preesistenti restano nella lista `deferred`); respinti: 15 (tutti low). Intent_gap 0, bad_spec 0.

**Raccomandazione di follow-up review:** `false`. Conteggio dei soli `patch` di questa pass: high 0, medium 0, low 0. Punteggio = 3×0 + 1×0 = 0 (< 5) e nessun patch high ⇒ `false`.

**Verifica eseguita:**
- `npm run typecheck` — 0 errori.
- `npm run lint` — 0 violazioni.
- `npm test` — 1027 test verdi su 90 file (inclusi `answersOverTime.test.ts`, `StatsScreen.test.tsx`, la parità en/it, l'invariante «un solo `<main>`»).
- `npm run build` — build ok (l'avviso sulla dimensione del chunk è generale e preesistente, non una regressione di 5.1).

**Rischi residui:** i due rilievi già `deferred` — (1) `StatsScreen` non ha un ramo `isError` (se `listReviewLog()` fallisce resta lo scheletro `aria-busy`), pattern trasversale all'app; (2) la serie giornaliera è illimitata (nessuna finestra/paginazione), preoccupazione futura di scalabilità/UX. Nessuno dei due è un difetto introdotto da 5.1.

