---
title: 'Story 3.5 — Lo streak si calcola, non si memorizza'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: '6fd0b519f72d9ae953750ce74ecc65c1758be682'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Lo streak (giorni consecutivi in cui l'utente porta la pila a zero)
serve alla dashboard (FR3.2) e alla schermata di completamento (FR4.4), ma una
colonna che lo memorizzi può divergere dalla sua fonte: una statistica derivata da
dati mutabili mente (AD-18). Serve la quinta legge di dominio di Epic 3: lo streak è
una funzione **pura** su `review_log`, ricalcolata a ogni lettura, mai memorizzata.

**Approach:** Un modulo di dominio puro `src/domain/streak.ts` che espone
`streak(log, now, timeZone): number` — conta i giorni di calendario **consecutivi**
(nel `timeZone` passato) con almeno una risposta nel log, a ritroso da un'ancora
(oggi se ha attività, altrimenti ieri, altrimenti `0`). Il confine di giornata è
mezzanotte nel fuso passato; `now` e `timeZone` **entrano** come parametri, il
dominio non legge orologio né fuso ambientale.

## Boundaries & Constraints

**Always:**
- `streak.ts` vive sotto `src/domain/` → purezza `AD-1`: nessun import esterno,
  nessun global vietato (`fetch`/`localStorage`/…), nessun `Date.now()`/`new Date()`
  senza argomenti/`Intl…resolvedOptions()`/`Math.random()`. `now` e `timeZone`
  entrano come parametri (`streak.length === 3`).
- `streak` è pura, sincrona, totale e non muta l'input: stessa terna
  `(log, now, timeZone)` ⇒ stesso numero. Nessuno stato mutabile nel modulo
  (ricalcolo a ogni chiamata).
- Il confine di giornata è mezzanotte nel `timeZone` **passato**: il bucketing usa
  `Intl.DateTimeFormat` con `timeZone` esplicito (mai `resolvedOptions()`), robusto a
  DST/fine mese/anno tramite mappatura del giorno nominale a ordinale.
- Lo streak deriva **solo** da `log`: nessun'altra fonte. `streak.ts` è l'unico punto
  di `src/` che lo calcola; nessuna colonna lo memorizza (`AD-18`).
- Definire un tipo minimo per la voce di log (`ReviewLogEntry`, solo `reviewedAt`),
  strutturalmente compatibile con la futura riga `review_log`; non ridefinire tipi
  esistenti.

**Block If:**
- Nessuna condizione bloccante attesa: gli AC risolvono ogni scelta osservabile. La
  tensione AC2↔AC4 (vedi Design Notes) è risolta, non un blocco.

**Never:**
- Nessuna persistenza/colonna/rete/SQL/client Supabase: lo streak non si memorizza
  (titolo della storia, `AD-18`). La migrazione delle tabelle di review e la guardia
  SQL «nessuna colonna streak» sono di storie successive (3.7+); qui non esiste ancora
  schema di review da toccare.
- Nessuna lettura dell'orologio o del fuso ambientale.
- Nessun badge/schermata di streak (UX-DR19, storie 3.12+): qui si fissa la funzione
  perché i consumatori non nascano divergenti.
- Nessun altro punto di `src/` calcola o memorizza lo streak.

## I/O & Edge-Case Matrix

`streak(log, now, timeZone)` — `log: readonly ReviewLogEntry[]`, `now: Date`,
`timeZone: string`. «Oggi/ieri» sono giorni locali nel `timeZone`.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| log vuoto | `streak([], now, tz)` | `0` | nessun errore |
| solo oggi | 1 risposta oggi | `1` | nessun errore |
| catena consecutiva | risposte oggi, ieri, l'altroieri | `3` | nessun errore |
| più risposte stesso giorno | 3 risposte oggi | `1` (il giorno conta una volta) | nessun errore |
| interruzione | risposte oggi e 3 giorni fa (buco ieri/l'altroieri) | `1` (conta solo la coda che tocca l'ancora) | nessun errore |
| grazia: solo ieri | nessuna attività oggi, risposte ieri + l'altroieri | `2` (streak vivo fino a mezzanotte di oggi) | nessun errore |
| interrotto | ultima risposta 2 giorni fa | `0` | nessun errore |
| confine di mezzanotte | 2 risposte a cavallo di mezzanotte locale nel `tz` | 2 giorni distinti | nessun errore |
| il fuso cambia il giorno | stesso istante UTC, `tz` diversi | giorno locale coerente col `tz` | nessun errore |
| ordine del log irrilevante | stesse voci in ordine diverso | stesso numero | nessun errore |
| non-mutazione | qualunque `log` | il `log` passato è invariato | nessun errore |
| determinismo | stessa terna due volte | risultati uguali | nessun errore |

</intent-contract>

## Code Map

- `src/domain/streak.ts` -- **DA CREARE.** Espone `interface ReviewLogEntry { readonly reviewedAt: Date }` e `streak(log, now, timeZone): number`. Nessun import esterno né altro modulo del dominio necessario.
- `src/domain/schedule.ts:18,27-34` -- `ReviewOutcome`/`ReviewState`: la voce di log **non** è uno `ReviewState` (quello è lo stato corrente, non il registro append-only). Definire il tipo minimo dedicato, non riusare `ReviewState`.
- `src/domain/due.ts:1-28` -- Pattern del modulo di dominio puro (intestazione `AD-1`, JSDoc, `now` come parametro esplicito) da rispecchiare.
- `src/domain/schedule-purity.test.ts:1-62` -- Pattern della sonda di purezza temporale (`stripComments` + regex sui costrutti vietati + anti-vacuità + `fn.length`) da replicare per `streak-purity.test.ts` (`streak.length === 3`).
- `src/domain/due.test.ts:1-100` -- Pattern della I/O Matrix con anti-vacuità, non-mutazione (snapshot) e determinismo da replicare per `streak.test.ts`.
- `src/domain/due-sole-authority.test.ts:1-129` -- Pattern della sonda di **sola autorità** su tutto `src/` (`collectTsFiles`, esclusione dei `.test.ts` e del sorgente-autorità, anti-vacuità del rilevatore) da replicare per `streak-sole-authority.test.ts`.
- `eslint.config.js:174-183` -- `no-restricted-globals` sul dominio copre `fetch`/storage; `Intl.DateTimeFormat({ timeZone })` **non** è vietato. `resolvedOptions()`/`Date.now`/`new Date()`/`Math.random` sono coperti dalla sonda di purezza, non da eslint.
- `src/boundaries.test.ts` -- Linta tutto `src/**` a 0 errori: il nuovo file deve passare.
- `supabase/migrations/` -- Solo `20260923221517_create_user_settings.sql`; nessuna tabella di review esiste ancora. La sonda «nessuna colonna streak» scansiona questa cartella (prospettica finché 3.7+ non crea `review_state`/`review_log`).
- `vitest.config.ts:7` -- Ambiente `node`: la funzione si prova senza React né DOM.
- `tsconfig.json:19-22` -- `strict`, `noUnusedParameters`, `noUnusedLocals` (nessun `noUncheckedIndexedAccess`: la destrutturazione dell'array dà `number`).
- Continuità 3.1–3.4: `now` come parametro (`AD-3`), niente casualità/tempo ambientale nel dominio, e il pattern «legge di dominio prima dei consumatori» (3.3 `isDue`, 3.4 `sessionReducer`).

## Tasks & Acceptance

**Execution:**
- `src/domain/streak.ts` -- Creare il modulo puro. `streak(log, now, timeZone)`: mappa ogni `reviewedAt` al suo **giorno locale ordinale** nel `timeZone` (`Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })` → `Date.UTC(y, m-1, d) / MS_PER_DAY`), costruisci l'insieme dei giorni con attività; ancora = ordinale di `now` se presente, altrimenti ordinale di ieri se presente, altrimenti ritorna `0`; conta i giorni consecutivi presenti a ritroso dall'ancora. Nessun costrutto temporale/di rete/non deterministico; `now`/`timeZone` come parametri.
- `src/domain/streak.test.ts` -- Coprire l'intera I/O Matrix (log vuoto, solo oggi, catena consecutiva, più risposte stesso giorno, interruzione, grazia con attività solo ieri, interrotto se ultima attività ≥2 giorni fa, confine di mezzanotte nel fuso, fuso che cambia il giorno, ordine irrilevante, non-mutazione, determinismo). Anti-vacuità: casi verdi con streak `> 1` **e** streak `= 0`. Usare fusi reali (es. `Asia/Tokyo` UTC+9 senza DST; `America/New_York` per un confine con DST).
- `src/domain/streak-purity.test.ts` -- Sonda meccanica sul sorgente (modellata su `schedule-purity.test.ts`): assenza di `fetch`/`Date.now(`/`new Date()` senza argomenti/`Intl…resolvedOptions(`/`Math.random`; anti-vacuità (file trovato, non vuoto, contiene `export function streak`); `streak.length === 3`.
- `src/domain/streak-sole-authority.test.ts` -- Sonda su tutto `src/` (esclusi `.test.ts` e `streak.ts`): nessun altro modulo **dichiara** una funzione/const `streak` (rilevatore `\b(?:function|const)\s+streak\b`, che deve corrispondere a `streak.ts` per anti-vacuità; le future chiamate `streak(...)` sono call, non dichiarazioni, e non fanno falso positivo). E: nessun file `.sql` di `supabase/migrations/**` contiene un identificatore di colonna `streak` (guardia prospettica di AC4 «nessuna colonna che lo memorizzi»).

**Acceptance Criteria:**
- Given `streak(log, now, timeZone)` in `src/domain/streak.ts`, when la si invoca, then riceve **sia** l'istante `now` **sia** il `timeZone` come parametri espliciti (`streak.length === 3`; il sorgente non legge orologio né fuso ambientale).
- Given un giorno (nel `timeZone`) con almeno una risposta nel `log`, when lo streak viene calcolato, then quel giorno conta — sia che la risposta abbia portato la pila a zero, sia che sia avvenuta a pila già vuota: il log registra la risposta in entrambi i casi.
- Given il confine fra due giornate, when lo streak viene calcolato, then la giornata termina a **mezzanotte nel `timeZone` passato**: due risposte separate da quella mezzanotte cadono in giorni distinti, e lo stesso istante UTC può cadere in giorni diversi con `timeZone` diversi.
- Given lo streak, when viene letto, then è ricalcolato dal **solo** `log` a ogni chiamata (nessuno stato memorizzato; stessa terna ⇒ stesso numero) e **nessuna colonna** di `supabase/migrations/**` lo memorizza né altro modulo di `src/` lo calcola.
- Given `streak`, when la si invoca, then è pura, sincrona, totale e **non muta** l'input; una catena di giorni consecutivi fino all'ancora dà la sua lunghezza, un giorno saltato tronca la parte precedente, e l'assenza di attività oggi non azzera uno streak ancora vivo fino a ieri.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[low]` `[patch]` Il test cross-timezone di `streak.test.ts` («lo stesso istante UTC cade in giorni diversi») asseriva `2` su **entrambi** i fusi, quindi non discriminava il fuso (un'implementazione che ignorasse `timeZone` sarebbe passata; la proprietà era coperta solo incidentalmente dal test DST). Fixture sostituite perché la stessa coppia `(log, now)` dia valori **diversi**: `TOKYO ⇒ 1`, `America/New_York ⇒ 2`.
  - `[low]` `[patch]` L'intestazione di `streak.ts` presentava la metrica come «giorni in cui l'utente porta la pila a zero», leggibile come regola operativa in contrasto con la docstring (un giorno conta con ≥1 risposta). Riscritta: inquadramento rivolto all'utente + regola operativa esplicita sul solo log, con rimando alla docstring.
  - `[low]` `[patch]` La sonda di purezza non vietava `Date.prototype.getTimezoneOffset()` (lettura del fuso ambientale), lacuna on-point per un modulo di fuso. Aggiunto il controllo `non usa getTimezoneOffset(`.

_Note di triage:_ quattro layer in parallelo (blind-hunter, edge-case-hunter,
verification-gap, intent-alignment). Nessun bug di correttezza in `streak.ts`.
**Intent-alignment**: la sola divergenza sostanziale è Reading A («giorno con ≥1
risposta») vs Reading B (le due clausole di stato-pila di FR7.4). Non è un intent_gap:
Reading B richiederebbe di sapere se «la pila era vuota», fatto ricostruibile solo dal
`review_state`/insieme dei dovuti, **non** dal solo `review_log` — che AC4/`AD-18`
impongono come unica fonte. L'intent stesso seleziona quindi Reading A; la scelta è già
documentata nelle Design Notes (riconciliazione analoga a quella di 3.4). **Rifiutati**
(14, tutti low): validazione di input non fidato (fuso IANA non valido ⇒ `RangeError`,
`Date` non valida ⇒ `NaN`/0, «totale» vs throw) — per contratto `AD-1` è responsabilità
del data layer (3.7–3.10), stesso rifiuto già stabilito in 3.1/3.3/3.4; `Date` mutabile
vs epoch-ms (coerente con i moduli fratelli); `en-CA`/`split('-')` vs `formatToParts`
(idioma ISO standard, nessun fallimento reale); completezza residua della sonda oltre
`getTimezoneOffset` (limite intrinseco delle sonde lessicali, coerente con la famiglia);
la sonda SQL `\bstreak\b` che non distingue colonna da vista derivata (sensibilità
accettabile, guardia prospettica documentata); la sonda di dichiarazione cieca a una
ricomputazione con altro nome (limite noto, ammesso nel commento, come `due`/`outcome`);
test marginali mancanti (catena lunga, ms duplicato, `now` a mezzanotte esatta,
voci future) — coperti per costruzione o dai test esistenti; duplicazione `stripComments`
(convenzione deliberata del progetto: sonde indipendenti); voci future ignorate
(comportamento corretto: nessun giorno di streak nel futuro); fuso a offset non intero
(il giorno di calendario nel fuso collassa già l'offset). Nessun defer.

## Design Notes

**Il cuore è il conteggio; il punto è che si *calcola*.** Come `isDue` (3.3) e
`sessionReducer` (3.4), la funzione è poche righe: il valore è che lo streak ha **un
solo** posto che lo produce — una funzione pura sul log — invece di una colonna che
può mentire (titolo della storia, `AD-18`).

```ts
export interface ReviewLogEntry { readonly reviewedAt: Date }

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// giorno locale come ORDINALE intero: formatta nel timeZone ESPLICITO (mai
// resolvedOptions()), poi mappa il nominale Y-M-D a Date.UTC/giorno. Giorni di
// calendario consecutivi differiscono di 1 attraverso DST/fine mese/anno.
function localDayOrdinal(instant: Date, timeZone: string): number {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant);
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

export function streak(log: readonly ReviewLogEntry[], now: Date, timeZone: string): number {
  const days = new Set(log.map((e) => localDayOrdinal(e.reviewedAt, timeZone)));
  const today = localDayOrdinal(now, timeZone);
  let anchor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (anchor === null) return 0;
  let count = 0;
  while (days.has(anchor - count)) count += 1;
  return count;
}
```

**Perché «giorno con attività» e non «giorno in cui la pila è arrivata a zero».**
FR7.4 distingue: un giorno conta se porti la pila a zero, *oppure* se rispondi a pila
già vuota. Ma l'**unico** input di `streak` è `review_log` (AC4, `AD-18`), append-only
per-risposta: **non** vede gli esercizi sbloccati-ma-mai-risposti (una lezione appena
sbloccata materializza righe `review_state`, non righe di log), quindi da solo non può
ricostruire se «la pila era vuota». Entrambe le clausole di FR7.4 hanno però una
condizione comune e necessaria: **quel giorno c'è stata almeno una risposta**. La
regola implementabile e onesta sul solo log è dunque «giorno con ≥1 risposta». È la
stessa riconciliazione di 3.4 (l'«almeno un good» dell'epica descrive il caso
dominante): qui il caso dominante è la sessione che drena la pila a zero.

**La grazia fino a mezzanotte (ancora = oggi *oppure* ieri).** Se oggi non c'è ancora
attività ma ieri sì, lo streak **non** è azzerato: l'utente ha tempo fino a mezzanotte.
L'ancora scende a ieri; solo quando passa un giorno intero senza attività (ultima
attività ≥2 giorni fa) lo streak è `0`. Così la dashboard non punisce prima che la
giornata sia finita.

**Perché la funzione ora e le schermate no.** Come 3.3/3.4, si fissa la legge di
dominio prima dei consumatori (dashboard 3.12+, completamento 3.21) perché nascano dal
`review_log` via questa funzione, non da una colonna. La guardia SQL «nessuna colonna
streak» è prospettica: diventa reale quando 3.7+ crea le tabelle di review.

## Verification

**Commands:**
- `npm run test -- src/domain/streak` -- expected: `streak.test.ts`, `streak-purity.test.ts`, `streak-sole-authority.test.ts` tutti verdi.
- `npm run test` -- expected: suite completa verde, 0 regressioni (la sonda di sola autorità non trova altri offender: nessun modulo esistente dichiara `streak`).
- `npm run typecheck` -- expected: nessun errore (`strict`, `noUnusedParameters`).
- `npm run lint` -- expected: nessuna violazione (`boundaries` `domain`; purezza del dominio; `Intl` con `timeZone` esplicito non è vietato).

## Auto Run Result

Status: done
Follow-up review recommended: false (patch: high 0, medium 0, low 3 → score 3×0 + 1×3 = 3 < 5, nessun high)

**Change implementato:** creata la quinta legge di dominio di Epic 3 (`AD-18`) — **lo
streak si calcola, non si memorizza**. `streak(log, now, timeZone): number` in
`src/domain/streak.ts` è l'UNICO punto di `src/` che produce lo streak: puro, sincrono,
totale, non-mutante. Conta i giorni di calendario **consecutivi** (nel `timeZone`
passato) con almeno una risposta nel `log`, a ritroso da un'ancora — oggi se ha
attività, altrimenti ieri (grazia fino a mezzanotte), altrimenti `0`. Il confine di
giornata è mezzanotte nel fuso **passato**: `localDayOrdinal` formatta l'istante col
fuso esplicito (`Intl.DateTimeFormat('en-CA', { timeZone })`, mai `resolvedOptions()`)
e mappa il giorno nominale a un ordinale via `Date.UTC`, robusto a DST/fine mese/anno.
`now` e `timeZone` entrano come parametri (`streak.length === 3`); nessuna lettura di
orologio o fuso ambientale. Lo streak deriva SOLO dal `log` (`AD-18`): nessuno stato
memorizzato, nessuna colonna. La regola «giorno con ≥1 risposta» è la lettura che il
solo `review_log` può ricostruire onestamente (le due clausole di FR7.4 richiedono
entrambe una risposta quel giorno; la distinzione «pila vuota» non è osservabile dal
log append-only) — riconciliazione documentata nelle Design Notes, analoga a 3.4.
Dashboard (3.12+) e schermata di completamento (3.21) restano fuori ambito.

**File cambiati:**
- `src/domain/streak.ts` -- nuovo: `interface ReviewLogEntry` (minimo: solo `reviewedAt`, strutturalmente compatibile con la futura riga `review_log`) e `streak(log, now, timeZone)` con l'helper puro `localDayOrdinal`. Nessun import esterno/global/costrutto temporale.
- `src/domain/streak.test.ts` -- nuovo: 16 test, intera I/O Matrix (log vuoto, solo oggi, catena consecutiva, più risposte stesso giorno, interruzione, grazia solo-ieri, interrotto, confine di mezzanotte nel fuso, cross-timezone **discriminante** `TOKYO ⇒ 1` vs `America/New_York ⇒ 2`, transizione DST di New York, ordine irrilevante, non-mutazione, determinismo, anti-vacuità su entrambi i lati). Fusi reali `Asia/Tokyo` e `America/New_York`.
- `src/domain/streak-purity.test.ts` -- nuovo: 8 test, sonda meccanica sul sorgente (assenza di `fetch`/`Date.now`/`new Date()`/`resolvedOptions`/`Math.random`/`getTimezoneOffset`), anti-vacuità, `streak.length === 3`.
- `src/domain/streak-sole-authority.test.ts` -- nuovo: 5 test, sonda su tutto `src/` (nessun altro modulo dichiara `streak`) e su `supabase/migrations/**` (nessuna colonna `streak`; guardia prospettica di AC4), con anti-vacuità su entrambe.

**Review findings:** 3 patch (low), 0 deferred, 14 rejected, 0 intent_gap, 0 bad_spec.
Quattro layer in parallelo (blind-hunter, edge-case-hunter, verification-gap,
intent-alignment); dettaglio nel Review Triage Log. Le tre patch — test cross-timezone
reso discriminante, intestazione allineata alla docstring, `getTimezoneOffset` aggiunto
alla sonda di purezza — applicate ri-ingaggiando il subagent di implementazione con
contesto intatto.

**Verifica eseguita (dopo le patch):**
- `npm run test -- src/domain/streak` → 28/28 verdi (3 file).
- `npm run test` (suite completa) → 520/520 verdi, 55 file, 0 regressioni.
- `npm run typecheck` → nessun errore (`strict`, `noUnusedParameters`).
- `npm run lint` → nessuna violazione.
- Matrix Test Audit: tutte le righe della I/O Matrix coperte da test eseguiti e verdi in `streak.test.ts`.

**Rischi residui:** nessuno per l'ambito di questa storia. La validazione degli input
(fuso IANA valido, `Date` valide) resta per contratto `AD-1` responsabilità del data
layer (3.7–3.10), coerentemente con `schedule()`/`isDue()`/`sessionReducer()`. La
guardia SQL «nessuna colonna streak» è prospettica: diventa reale quando 3.7+ creerà le
tabelle di review. I consumatori (dashboard 3.12+, completamento 3.21) leggeranno lo
streak da questa funzione, senza colonna né ricomputazione altrove.
