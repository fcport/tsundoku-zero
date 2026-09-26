---
title: '5.4 Un grafico vuoto non è una risposta'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '9d5070b5ff30d3251ff7ef2ad823b8d3f020c0ce'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** L'utente appena iscritto (o con pochi dati) vede sezioni statistiche che si limitano a dire «non ci sono ancora dati», senza dichiarare CHE COSA manca e QUANTO ne serve. Peggio: il grafico temporale (5.1) compare gia con una sola giornata di risposte, dove una serie «nel tempo» non ha ancora senso. E l'ultima storia di Epic 5 (FR7.5): trasformare gli stati a dati insufficienti in dichiarazioni oneste e quantificate, cosi che l'utente capisca perche una vista e vuota e non pensi che l'app sia rotta.

**Approach:** Per ciascuna delle tre viste di `StatsScreen`, indipendentemente (UX-DR18), sostituire il placeholder generico con una dichiarazione «cosa manca e quanto». Il grafico temporale (5.1) diventa MEANINGFUL solo con risposte su almeno `MIN_ANSWER_DAYS` (= 3) giorni distinti: sotto soglia rende una dichiarazione quantificata («servono almeno 3 giorni di risposte»; giorni finora: N), MAI un grafico sparso. La soglia e una costante UNICA del dominio, interpolata nella copy (nessun secondo numero divergente), affiancata da un helper puro `daysWithAnswers(series)`. Le viste distribuzione (5.2) e tassi d'errore (5.3) restano meaningful con qualsiasi dato: la loro insufficienza e «nessun dato» e la dichiarazione quantifica il minimo (almeno un esercizio ripassato / almeno una risposta).

## Boundaries & Constraints

**Always:**
- Le tre viste decidono la sufficienza INDIPENDENTEMENTE (UX-DR18): il grafico temporale puo essere insufficiente mentre distribuzione e tassi rendono dati reali (utente con piu esercizi in un solo giorno), e viceversa.
- Il grafico temporale (5.1) e sufficiente SSE `daysWithAnswers(series) >= MIN_ANSWER_DAYS`; sotto soglia rende SOLO la dichiarazione (nessuna intestazione `<h3>`, nessuna barra), MAI un grafico con 1-2 giorni.
- `MIN_ANSWER_DAYS` e definita UNA volta nel dominio ed e l'UNICA fonte del numero: sia il confronto sia la copy («almeno {{needed}}») la leggono. `daysWithAnswers` conta i soli giorni con `count > 0` (esclude gli zeri interni/di coda della serie), pura, totale, senza tempo.
- Ogni dichiarazione dichiara COSA manca E QUANTO: il grafico temporale nomina la soglia (`{{needed}}`) e i giorni finora (`{{soFar}}`); distribuzione e tassi nominano il minimo («almeno un esercizio ripassato» / «almeno una risposta»).
- Nessun riquadro di grafico vuoto ne schermata muta (AC2, FR7.5): a dati insufficienti c'e SEMPRE una dichiarazione testuale; il titolo di schermata e l'affordance di ritorno compaiono in OGNI stato.
- Ogni stringa d'interfaccia da `t()` con parita en/it (AD-14), nessun `{{count}}` (innescherebbe il pluralizzatore i18next); copy del blocco `stats` ASCII (convenzione locale gia in vigore), nessun `!`/emoji/avverbio di lode; solo token del design system, NESSUN verde di successo. La dichiarazione e sempre TESTO, mai veicolata dal solo colore.
- `features` importa solo `domain`/`ui`/`i18n`/react/@tanstack (AD-1): la soglia e l'helper arrivano dal dominio (`answersOverTime.ts`), non replicati nella vista.

**Block If:**
- (nessuna decisione che richieda un umano: la soglia del grafico temporale e fissata dai documenti UX — «servono almeno 3 giorni di revisioni», EXPERIENCE.md/design-handoff — e l'intento non impone alcuna soglia per distribuzione/tassi, il cui minimo onesto e «almeno uno»)

**Never:**
- NON inventare soglie numeriche arbitrarie per distribuzione (5.2) o tassi (5.3): l'intento non ne da e la loro insufficienza resta «array derivato vuoto» (log vuoto). Il minimo dichiarato e «almeno uno», non un numero fabbricato.
- NON duplicare il numero `3`: nessun `3` letterale nella copy o nella vista — sempre da `MIN_ANSWER_DAYS`.
- NON cambiare le funzioni di dominio `answersOverTime`/`stageDistribution`/`grammarPointErrorRates` ne la fonte (AD-18): la soglia e un helper ADDITIVO; la serie/distribuzione/tassi restano identici.
- NON leggere `review_state`/`review_count`/`lapse_count`/`listDue`: la sufficienza si DERIVA dal SOLO log gia caricato (`['streak', userId]`), nessuna nuova query, nessuna nuova porta.
- NON introdurre una singola azione (bottone) negli stati insufficienti oltre all'affordance di ritorno gia presente (UX: «al massimo un'azione» — qui il ritorno la esaurisce).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `daysWithAnswers`: serie vuota | `[]` | `0` | Nessun errore |
| `daysWithAnswers`: solo giorni con risposte | `[{c:1},{c:2}]` | `2` | Nessun errore |
| `daysWithAnswers`: zeri interni/di coda | `[{c:1},{c:0},{c:0}]` | `1` (conta solo `count>0`) | Nessun errore |
| Temporale insufficiente (0 giorni) | log vuoto | Dichiarazione «almeno {{needed}}=3 giorni; finora {{soFar}}=0», nessuna intestazione/barra | Nessun errore |
| Temporale insufficiente (1-2 giorni) | risposte su 2 giorni distinti | Dichiarazione «almeno 3; finora 2», nessun grafico sparso | Nessun errore |
| Temporale sufficiente (soglia) | risposte su 3 giorni distinti | Intestazione + barre per-giorno (compresi zeri interni/coda) | Nessun errore |
| Indipendenza delle viste | 5 esercizi in 1 solo giorno | Temporale insufficiente; distribuzione e tassi rendono dati reali | Nessun errore |
| Distribuzione insufficiente | log vuoto | Dichiarazione «almeno un esercizio ripassato», nessuna intestazione/barra | Nessun errore |
| Tassi insufficienti | log vuoto | Dichiarazione «almeno una risposta», nessuna intestazione/barra | Nessun errore |
| `userId` non risolto o cache pending | `userId===null` o `logQ.data`/`lessonsQ.data===undefined` | Scheletro `aria-busy` (invariato) | Nessun errore |

</intent-contract>

## Code Map

- `src/domain/answersOverTime.ts` -- AGGIUNGERE `export const MIN_ANSWER_DAYS = 3` (la soglia UNICA: giorni distinti con risposte perche il trend sia meaningful; motivata dai documenti UX) e `export function daysWithAnswers(series: readonly DailyAnswerCount[]): number` (pura/totale/senza-tempo; conta i `DailyAnswerCount` con `count > 0`). NON toccare `answersOverTime` ne `DailyAnswerCount`. Aggiornare la docstring del modulo (la soglia di sufficienza del trend e la 5.4).
- `src/domain/answersOverTime.test.ts` -- aggiungere i test di `daysWithAnswers` (serie vuota ⇒ 0; solo giorni pieni ⇒ n; zeri interni/coda esclusi; purezza/non-mutazione) e un'asserzione che pinni `MIN_ANSWER_DAYS === 3` (fonte unica del numero).
- `src/features/stats/StatsScreen.tsx` -- importare `daysWithAnswers`, `MIN_ANSWER_DAYS`. Sostituire il gate della PRIMA sezione: da `series.length === 0` a `daysWithAnswers(series) < MIN_ANSWER_DAYS` ⇒ dichiarazione `t('stats.answersOverTime.insufficient', { needed: MIN_ANSWER_DAYS, soFar: daysWithAnswers(series) })` (nessuna intestazione, nessuna barra); altrimenti intestazione + barre come ora. La copy di distribuzione (5.2) e tassi (5.3): stesso gate `.length === 0`, ma la stringa e ora la dichiarazione quantificata (chiavi `empty` riscritte). Aggiornare il commento di testata (la ricca dichiarazione «cosa manca e quanto» e ORA realizzata, non piu rimandata).
- `src/features/stats/StatsScreen.test.tsx` -- aggiornare i fixture che assumevano il grafico temporale reso con 1-2 giorni: seminare 3 giorni distinti dove il test verifica intestazione/etichette del temporale (`AC1 — serie con dati`, `AC1 — ultima risposta nel passato` ⇒ 3 giorni con coda a 0, `AC1 — piu risposte lo stesso giorno` ⇒ +2 altri giorni, `5.2 ... un solo <main>` a riga ~233, `AC2 — fonte SOLO listReviewLog` a riga ~356, parita `it:` a riga ~523). Sostituire i riferimenti a `answersOverTime.empty` con la resa di `answersOverTime.insufficient` (via `i18n.t(..., { needed: MIN_ANSWER_DAYS, soFar })`). AGGIUNGERE i test 5.4: (a) temporale con <3 giorni ⇒ dichiarazione quantificata, nessuna intestazione, nessun `<ol>` della serie; (b) confine: 2 giorni insufficiente, 3 giorni sufficiente; (c) indipendenza: 5 esercizi in 1 giorno ⇒ temporale insufficiente MA distribuzione e tassi resi; (d) `soFar` interpolato corretto (es. 2). Aggiornare `AC5 — log vuoto` e `it: log vuoto` alle chiavi/dichiarazioni nuove.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- dentro `stats.answersOverTime`: RINOMINARE `empty` ⇒ `insufficient` con `{{needed}}` e `{{soFar}}` (es. en: `This chart needs at least {{needed}} days of answers. Days with answers so far: {{soFar}}.`; it: `Servono almeno {{needed}} giorni di risposte per disegnare questo grafico. Giorni con risposte finora: {{soFar}}.`). RISCRIVERE `stats.stageDistribution.empty` e `stats.grammarPointErrorRates.empty` in dichiarazioni quantificate del minimo (almeno un esercizio ripassato / almeno una risposta). Parita en/it ricorsiva, no CJK, no `{{count}}`, ASCII nel blocco `stats`, nessun `!`. Aggiornare i commenti che dicono «la ricca dichiarazione e la storia 5.4».

## Tasks & Acceptance

**Execution:**
- `src/domain/answersOverTime.ts` -- aggiungere `MIN_ANSWER_DAYS` e `daysWithAnswers`; docstring aggiornata. -- La soglia unica del trend e il conteggio dei giorni con risposte (FR7.5).
- `src/domain/answersOverTime.test.ts` -- test di `daysWithAnswers` e pin di `MIN_ANSWER_DAYS`. -- Copre il conteggio, l'esclusione degli zeri, la purezza, la fonte unica del numero.
- `src/features/stats/StatsScreen.tsx` -- gate del temporale su `daysWithAnswers < MIN_ANSWER_DAYS` con dichiarazione quantificata; dichiarazioni quantificate anche per distribuzione e tassi. -- Ogni vista dichiara «cosa manca e quanto» (FR7.5, AC1/AC2).
- `src/features/stats/StatsScreen.test.tsx` -- aggiornare i fixture al gate a 3 giorni; aggiungere i test 5.4 (insufficiente/confine/indipendenza/`soFar`). -- Copre gli AC alla superficie.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- `answersOverTime.insufficient` con `{{needed}}`/`{{soFar}}`; `empty` di distribuzione/tassi riscritti quantificati. -- Nessuna stringa cablata (AD-14), copy onesta e quantificata.

**Acceptance Criteria:**
- Given un `review_log` con risposte su meno di `MIN_ANSWER_DAYS` giorni distinti (compreso il log vuoto), when si rende `StatsScreen` con l'`userId` risolto, then la sezione delle risposte nel tempo mostra una dichiarazione che nomina il numero di giorni necessari e quanti finora, e NON rende ne l'intestazione ne alcuna barra della serie.
- Given un `review_log` con risposte su almeno `MIN_ANSWER_DAYS` giorni distinti, when si rende `StatsScreen`, then la sezione delle risposte nel tempo rende l'intestazione e le barre per-giorno (come 5.1).
- Given un `review_log` con piu esercizi risposti in un solo giorno di calendario, when si rende `StatsScreen`, then la sezione temporale e insufficiente (dichiarazione) MENTRE la distribuzione per stadio e i tassi d'errore per punto rendono i loro dati reali (le viste sono indipendenti).
- Given un `review_log` vuoto, when si rende `StatsScreen`, then ciascuna delle tre sezioni mostra una dichiarazione quantificata di cosa manca e quanto, e NESSUNA rende un riquadro di grafico vuoto o resta muta; il titolo di schermata e l'affordance di ritorno restano presenti.
- Given una qualsiasi delle dichiarazioni di dati insufficienti, when viene renderizzata in en e in it, then esiste con parita di chiavi, senza CJK, senza `{{count}}`, senza `!`, e non introduce colori celebrativi.

## Design Notes

Perche una soglia REALE a 3 giorni e non solo copy: i documenti UX fissano «servono almeno 3 giorni di revisioni per disegnare questo grafico» (EXPERIENCE.md, design-handoff, ripetuto tre volte) come la copy canonica dello stato insufficiente del grafico TEMPORALE. Se la mostrassimo a 0 giorni ma poi disegnassimo il grafico a 1 giorno, la dichiarazione mentirebbe. Percio il grafico compare SSE `daysWithAnswers >= 3`: la copy e il gate condividono lo stesso numero. Un trend «nel tempo» con uno o due punti non e un trend — la storia 5.1 lasciava questo raffinamento alla 5.4.

Perche l'asimmetria fra le tre viste e principiata (non arbitraria): il grafico temporale ha un asse TEMPORALE (giorni), quindi «abbastanza dati» si misura in giorni e i documenti UX lo quantificano (3). Distribuzione (per stadio) e tassi (per punto grammaticale) hanno assi CATEGORIALI: diventano meaningful con qualunque dato, e l'intento NON da alcuna soglia. Inventare «almeno 3 esercizi» sarebbe fabbricare un numero assente dall'intento (vietato). Il loro minimo onesto e «almeno uno», che soddisfa comunque «cosa manca e quanto». Questo rispetta anche UX-DR18: «vale per ciascuna delle tre viste indipendentemente».

Perche la soglia vive nel dominio: come l'asse dei sei stadi deriva dalla costante unica di `schedule.ts` (AD-17), la soglia del trend e una costante unica di `answersOverTime.ts`, cosi copy e gate non possono divergere (la stessa disciplina anti-«secondo numero» di AD-18). `daysWithAnswers` e un helper puro affiancato, testabile in isolamento; la vista lo compone col confronto.

Esempio (indipendenza): 5 risposte tutte il 25/09 ⇒ `daysWithAnswers = 1 < 3` ⇒ temporale: «servono almeno 3 giorni; finora 1»; distribuzione: gli esercizi ai loro stadi; tassi: i punti coi loro rate. Tre viste, tre esiti coerenti col dato reale.

## Verification

**Commands:**
- `npm run typecheck` -- expected: 0 errori (nuova costante/funzione, chiavi i18n rinominate e tipizzate, interpolazione `{{needed}}`/`{{soFar}}`).
- `npm run lint` -- expected: 0 violazioni (AD-1: `features` non importa `data`; dominio senza I/O; nessun colore esadecimale letterale).
- `npm test` -- expected: verdi i nuovi test di `daysWithAnswers`, i test aggiornati e nuovi di `StatsScreen`, la parita en/it e l'assenza di CJK di `i18n.test.tsx`, l'invariante «un solo `<main>`».
- `npm run build` -- expected: build ok.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 16: (high 0, medium 0, low 16)
- addressed_findings:
  - none
- Nota (rilievi respinti): edge-case-hunter e verification-gap non hanno prodotto rilievi; l'intent-alignment auditor ha confermato che il diff implementa la lettura piu forte e meglio motivata (soglia temporale asimmetrica ancorata ai documenti UX «almeno 3 giorni», dichiarazioni indipendenti per UX-DR18) — nessun intent gap. I 16 rilievi del blind-hunter (forzato a trovarne >= 10) sono tutti low e respinti: (1) la soppressione del grafico a 1-2 giorni e la scelta di design voluta dai documenti UX e dall'esempio dell'AC, non un difetto; (2) le tre dichiarazioni indipendenti nel log vuoto sono imposte da UX-DR18 («vale per ciascuna delle tre viste indipendentemente»); (3) `daysWithAnswers` non puo divergere da `answersOverTime` (deriva deterministicamente dalla stessa serie; il pattern a piccoli helper puri e idiomatico); (4) le risposte future/con clock sfasato contano legittimamente come giorni di risposte (edge gia gestito difensivamente dal dominio); (5-6) i comportamenti «zeri interni/di coda» e non-mutazione sono gia pinnati (`daysWithAnswers([2,0,3])===2`, snapshot di purezza); (7) il confine 3-giorni e pinnato da un'asserzione POSITIVA dell'intestazione + `soFar` corrispondente; (8) FATTUALMENTE ERRATO — l'assenza delle intestazioni nel log vuoto E asserita (test «NON rende le intestazioni»); (9) «days of answers»/«giorni di risposte» rispecchia l'esempio verbatim dell'AC (cambiarlo devierebbe l'italiano dall'AC); (10) FATTUALMENTE ERRATO — entrambe le lingue portano `{{needed}}` e `{{soFar}}`; (11) il placeholder EN e pinnato da un'asserzione letterale (`Days with answers so far: 2.`), IT verificato presente; (12) `daysWithAnswers` e documentato a fondo; (13) il commento di `max` e accurato («ramo meaningful, series non vuota»); (14) i rami `empty` di distribuzione/tassi restano raggiungibili sul log vuoto (utente appena iscritto, testato); (15) `MIN_ANSWER_DAYS` e pinnato dal test di dominio; (16) nessun salto di livello di intestazione in alcuno stato (h2 + paragrafi e valido).

## Auto Run Result

Status: done
Blocking condition: (nessuna)

**Sintesi della modifica.** Story 5.4 «Un grafico vuoto non e una risposta»: l'ultima storia di Epic 5 (FR7.5). Le tre viste di `StatsScreen` ora dichiarano «cosa manca e quanto» a dati insufficienti, indipendentemente (UX-DR18), MAI un riquadro di grafico vuoto ne una schermata muta. Il grafico temporale (5.1) diventa meaningful SOLO con risposte su almeno `MIN_ANSWER_DAYS` (= 3) giorni distinti: sotto soglia rende SOLO una dichiarazione quantificata («servono almeno 3 giorni di risposte; finora N»), mai un grafico sparso a 1-2 giorni. La soglia e una costante UNICA del dominio (fonte unica del numero, interpolata nella copy — nessun secondo numero divergente), affiancata dall'helper puro `daysWithAnswers(series)` che conta i soli giorni con `count > 0`. Distribuzione (5.2) e tassi d'errore (5.3), assi CATEGORIALI, restano meaningful con qualunque dato: la loro insufficienza e «nessun dato» (log vuoto) e la dichiarazione nomina il minimo onesto («almeno un esercizio ripassato» / «almeno una risposta»), senza soglie fabbricate. Nessuna funzione di dominio esistente ne la fonte (AD-18) e stata toccata: la soglia e additiva.

**File della modifica (diff dal baseline `9d5070b`):**
- `src/domain/answersOverTime.ts` — aggiunti `MIN_ANSWER_DAYS = 3` (soglia unica del trend, motivata dai documenti UX) e `daysWithAnswers(series)` (puro/totale/senza-tempo; conta i `count > 0`, esclude zeri interni/coda); docstring del modulo aggiornata.
- `src/domain/answersOverTime.test.ts` — nuovo blocco `daysWithAnswers` (serie vuota ⇒ 0, giorni pieni ⇒ n, zeri interni/coda esclusi, purezza) + pin `MIN_ANSWER_DAYS === 3`.
- `src/features/stats/StatsScreen.tsx` — gate della prima sezione da `series.length === 0` a `daysWithAnswers(series) < MIN_ANSWER_DAYS` ⇒ dichiarazione `stats.answersOverTime.insufficient` interpolata (`needed`/`soFar`), nessuna intestazione/barra sotto soglia; distribuzione/tassi mantengono il gate `.length === 0` con copy quantificata; commento di testata aggiornato.
- `src/features/stats/StatsScreen.test.tsx` — fixture riseminate a 3 giorni distinti dove il test verifica il temporale; test 5.4 aggiunti (sotto soglia ⇒ dichiarazione quantificata senza grafico; confine 2 vs 3 giorni; indipendenza delle viste con 5 esercizi in 1 giorno; `soFar` interpolato); AC5/parita `it:` aggiornati alle chiavi/dichiarazioni nuove.
- `src/i18n/en.ts` + `src/i18n/it.ts` — `answersOverTime.empty` rinominata ⇒ `insufficient` con `{{needed}}`/`{{soFar}}`; `stageDistribution.empty` e `grammarPointErrorRates.empty` riscritte in dichiarazioni quantificate del minimo. Parita en/it, no CJK, no `{{count}}`, ASCII nel blocco `stats`, nessun `!`.

**Esito dei rilievi (questa pass):** patch applicati: 0; deferiti: 0; respinti: 16 (tutti low). Intent_gap 0, bad_spec 0.

**Raccomandazione di follow-up review:** `false`. Conteggio dei soli `patch` di questa pass: high 0, medium 0, low 0. Punteggio = 3×0 + 1×0 = 0 (< 5) e nessun patch high ⇒ `false`.

**Verifica eseguita (indipendente):**
- `npm run typecheck` — 0 errori.
- `npm run lint` — 0 violazioni.
- `npm test` — 1102 test verdi su 92 file (inclusi il nuovo blocco `daysWithAnswers`, i test 5.4 di `StatsScreen`, la parita en/it e l'assenza di CJK di `i18n.test.tsx`, l'invariante «un solo `<main>`»).
- `npm run build` — build ok (l'avviso sulla dimensione del chunk e generale e preesistente, non una regressione di 5.4).

**Matrix Test Audit:** ogni riga della I/O & Edge-Case Matrix e coperta da almeno un test eseguito e verde (dominio `daysWithAnswers` per le prime tre righe; superficie `StatsScreen` per gli stati insufficiente/sufficiente/indipendenza/empty; test scheletro invariati per l'ultima riga).

**Rischi residui:** la lettura illimitata di `review_log` (nessuna paginazione), gia deferita in 5.1/5.2/5.3, resta la scalabilita futura (cronologie attuali brevi), non un difetto di 5.4. La soglia a 3 giorni e una policy di presentazione fissata dai documenti UX: se l'UX la rivedesse, basta cambiare la costante unica `MIN_ANSWER_DAYS` (copy e gate la leggono da li).
