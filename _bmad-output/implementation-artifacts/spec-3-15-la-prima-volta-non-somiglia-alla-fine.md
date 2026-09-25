---
title: 'Story 3.15: La prima volta non somiglia alla fine'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '279f70adbce9ff4dea7d224eec08e2954f8295d6'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      unlockMutation non ha onError: un fallimento di progress.unlockLesson non
      produce alcuna superficie d'errore sulla dashboard (pulsante di sblocco 3.13
      e pulsante di inizio 3.15).
    evidence: |-
      Su fallimento della RPC la mutation va in errore, isPending torna false e il
      pulsante si ri-abilita SENZA feedback all'utente. Gap PRE-ESISTENTE: il
      call-site di 3.13 (unlockAction, DashboardScreen.tsx:179-189) ha lo stesso
      onSuccess-senza-onError; 3.15 aggiunge un secondo trigger allo stesso
      unlockMutation condiviso. Fuori dall'intento di 3.15 (stato di primo avvio) e
      non banalmente correggibile: serve una scelta di superficie/copy d'errore
      condivisa dai due pulsanti (nuova chiave i18n + pattern di error-state).
    location: >-
      src/features/dashboard/DashboardScreen.tsx:78-85,149-158
    severity: medium
---

<intent-contract>

## Intent

**Problem:** La dashboard tratta oggi in modo IDENTICO due stati diversi: chi arriva la prima volta (mai sbloccato niente) e chi ha svuotato la pila. Entrambi vedono un conteggio a `0`, uno streak a `0` e la stessa azione «sblocca la successiva». Per uno sconosciuto appena registrato questo è muto: non dice cosa fa l'app né come cominciare, e i due zeri sembrano un errore invece di «non c'è ancora niente». La 3.14 ha rimandato ESPLICITAMENTE a 3.15 «lo stato di primo-avvio DISTINTO e l'occultamento dello zero del `pile-counter`».

**Approach:** Rendere DERIVABILE dallo stato persistito che l'utente è al primo avvio — `unlocked === 0` (nessuna riga `lesson_progress`) — e renderne uno stato DISTINTO: una descrizione di cosa fa l'app più UNA sola azione la cui copy significa *comincia*, SENZA il conteggio a zero né lo streak a zero. L'azione riusa il `unlockMutation` esistente (materializza la prima lezione). Due sole chiavi i18n nuove (`firstRunBody`, `startAction`); nessun nuovo componente (i primitivi restano composti inline, come nel resto della dashboard).

## Boundaries & Constraints

**Always:**
- **Il primo avvio è DERIVATO, mai memorizzato (AD-5).** Segnale canonico: `unlocked === 0` (= `unlockedQ.data.length`, cioè «mai sbloccato niente» = zero righe `lesson_progress`). Nessuna nuova lettura: riusa le quattro query già presenti sulla dashboard. Sopravvive al refresh (finché nulla è sbloccato resta primo avvio).
- **Niente conteggi a zero (AC3).** Il ramo di primo avvio NON rende il `pile-counter` (né il ruolo `text-count-hero` né l'etichetta `dueLabel`), NON rende lo `streak-badge`, NON rende il `curriculum-progress` («u di t» degenererebbe in «0 di N», un altro zero): «non c'è ancora niente da contare».
- **Una sola azione primaria (AC1), copy = «comincia» (AC2).** Al più UN `<button>`, cablato a `unlockMutation.mutate(next.id)` (la prima lezione, `ordinal` minimo). La sua etichetta (`dashboard.startAction`) significa *inizia*, DISTINTA da `dashboard.unlockAction` («sblocca la successiva») dello stato a pila svuotata. `dashboard.firstRunBody` dichiara cosa fa l'app.
- **Copy neutra (nessuna grammatica della celebrazione).** `firstRunBody`/`startAction` in ENTRAMBI i cataloghi `en`/`it` (parità imposta da `i18n.test.tsx`). Nessun `!`, emoji, avverbio di lode; `en` resta ASCII (nessun code point ≥ U+2000). Solo token del sistema di design (`text-body`/`text-label`/`text-ink-primary`/`bg-accent`…), nessun colore letterale.
- **Confini AD-1.** `src/features/dashboard/` importa `domain` (`curriculum`, `due`, `streak`), `ui`, `i18n`, `@tanstack/react-query`, MAI `data`. Il ramo condivide `CONTAINER_HEIGHT` sul `<main>` (nessun salto di layout col resto).

**Block If:**
- _Nessun blocco._ Ogni decisione è fissata dall'epica («primo avvio → "comincia", senza conteggi a zero»; «i tre stati non si confondono») e dai pattern esistenti (`unlockMutation`, `nextLessonToUnlock`, cataloghi i18n, cancello 3.13). Nessun input umano né azione esterna al repository (nessun dominio/DNS/API-key/console vendor).

**Never:**
- NON fare il lavoro di 3.16: nessuna copy «hai finito» per la pila SVUOTATA (stato con `unlocked > 0`), nessun occultamento dello zero della pila svuotata, nessuna schermata unica SENZA azione per il curriculum esaurito. Questa storia tocca SOLO il ramo `unlocked === 0`; il cancello 3.13 e la dichiarazione 3.14 (rami `unlocked > 0`) restano INVARIATI.
- NON cablare l'avvio della sessione di esercizi (resta 3.18): l'azione di primo avvio materializza la prima lezione, non apre la sessione.
- NON estrarre un componente `empty-state` né `pile-counter`: composizione inline come nel resto della dashboard (l'estrazione nasce col secondo consumatore).
- NON introdurre stato transiente di mutation come sorgente del ramo (sempre derivato da `unlocked`, AD-5); nessun `Date.now()`/`new Date()`/`resolvedOptions()` sotto `src/domain/` (questa storia non tocca il dominio).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Primo avvio, curriculum disponibile | `unlocked 0`, `total > 0` | `firstRunBody` + UN pulsante `startAction` (→ `mutate(next.id)`); nessun conteggio/streak/curriculum | — |
| Primo avvio vs pila svuotata | primo avvio (`unlocked 0`) e svuotata (`unlocked ≥1`, `count 0`, `next≠null`) | i testi differiscono: primo avvio porta `firstRunBody`/`startAction`, la svuotata porta `unlockAction` (mai `firstRunBody`/`startAction`) | — |
| Primo avvio, nessun conteggio | `unlocked 0` | markup privo di `text-count-hero`, di `dueLabel` e di «day streak» | — |
| Primo avvio, curriculum vuoto | `unlocked 0`, `total 0` (`next === null`, mai in produzione) | solo `firstRunBody`, NESSUN pulsante | — |
| Non primo avvio (pila piena) | `unlocked ≥1`, `count > 0` | ramo esistente (cancello 3.13): `primaryAction`, nessuna copy di primo avvio | — |

</intent-contract>

## Code Map

- `src/features/dashboard/DashboardScreen.tsx:116-127,129-192` -- calcolati già `count`, `days`, `unlocked`, `total`, `next`, `lastUnlocked`. **Aggiungere**, DOPO queste derivazioni e PRIMA del `return` esistente, un ramo `if (unlocked === 0) { return <main …>… }`: un `<main>` con la stessa classe `CONTAINER_HEIGHT`, un `<p className="text-body text-ink-primary">{t('dashboard.firstRunBody')}</p>` e, sse `next !== null`, un `<button onClick={() => unlockMutation.mutate(next.id)} disabled={unlockMutation.isPending} className="rounded-md border border-border-strong bg-accent text-surface-raised p-3 text-label">{t('dashboard.startAction')}</button>`. Nessun `pile-counter`/`streak`/`curriculum` nel ramo. Il resto del file resta INVARIATO.
- `src/i18n/en.ts:33-55`, `src/i18n/it.ts:27-49` -- sezione `dashboard`: **aggiungere** `firstRunBody` (descrive cosa fa l'app; `en` ASCII) e `startAction` (etichetta = *comincia*, distinta da `unlockAction`) in ENTRAMBI (parità en/it).
- `src/features/dashboard/DashboardScreen.test.tsx:71-99,178-190,251-259` -- l'helper `seededClient` resta valido; **aggiornare** le due semine che usavano `unlocked: 0` in modo INCIDENTALE (il test altezza a `178-190` e il test chiave pila a `251-259`) a `unlocked: 1` così restano nello stato caricato normale (il primo avvio è ora un ramo distinto); **aggiungere** un `describe` per AC1/AC2/AC3 (primo avvio: descrizione + una azione; testo distinto dalla svuotata; nessun conteggio/streak a zero; microcopy senza `!`; curriculum vuoto ⇒ nessun pulsante).
- `src/app/AuthenticatedShell.test.tsx:37-46`, `src/app/AppRoutes.test.tsx:57-66` -- (aggiornamento indotto) i `seededClient` seminano `['unlocked'] = []` con `count 1` e si aspettano `dashboard.primaryAction`: con il nuovo ramo `unlocked === 0` renderebbe il primo avvio (niente `primaryAction`). **Aggiornare** la semina a uno stato NON di primo avvio (`['unlocked'] = ['lesson-0']`, `['lessons'] = [{ id:'lesson-0', ordinal:0, title:{en:'L0'}, grammarPoints:[], exerciseCount:1 }]`), così la dashboard rende lo stato caricato con `primaryAction` (invariante del test: la shell mostra la dashboard). Nessun altro assert cambia.
- `src/domain/curriculum.ts:26-38` -- (SOLO lettura) `nextLessonToUnlock` è già l'autorità: a `unlocked 0` ritorna la lezione con `ordinal` minimo; a curriculum vuoto ritorna `null`. Nessuna modifica.
- `src/ui/theme.css:113-119` -- (SOLO lettura) ruoli `text-body` (16px) e `text-label` (14px) esistono; usati dal ramo. Nessun nuovo token.

## Tasks & Acceptance

**Execution:**
- `src/i18n/en.ts` + `src/i18n/it.ts` -- **aggiungere** `dashboard.firstRunBody` e `dashboard.startAction` in entrambi (parità; `en` ASCII; copy neutra senza `!`).
- `src/features/dashboard/DashboardScreen.tsx` -- **aggiungere** il ramo `if (unlocked === 0)` con descrizione + azione di inizio (al più un pulsante); nessun conteggio/streak/curriculum; `CONTAINER_HEIGHT` sul `<main>`.
- `src/features/dashboard/DashboardScreen.test.tsx` -- **aggiornare** le due semine `unlocked: 0` incidentali a `unlocked: 1`; **aggiungere** i test AC1/AC2/AC3 di primo avvio.
- `src/app/AuthenticatedShell.test.tsx` + `src/app/AppRoutes.test.tsx` -- **aggiornare** la semina a uno stato non-primo-avvio così `primaryAction` resta reso.

**Acceptance Criteria:**
- **AC1 — Stato di primo avvio.** *Given* un utente che non ha mai sbloccato alcuna lezione (`unlocked === 0`), *when* apre la dashboard, *then* vede uno stato che dice cosa fa l'app (`firstRunBody`) e offre UNA sola azione primaria per cominciare (`startAction`, un solo `<button>`).
- **AC2 — Primo avvio ≠ pila svuotata.** *Given* lo stato di primo avvio confrontato con lo stato di pila svuotata (`unlocked ≥1`, `count 0`, `next≠null`), *then* i due testi differiscono: il primo porta `firstRunBody`/`startAction` (significa *comincia*) e NON `unlockAction`; il secondo porta `unlockAction` (significa *procedi*) e NON `firstRunBody`/`startAction`.
- **AC3 — Nessuno zero.** *Given* lo stato di primo avvio, *when* è reso, *then* NON mostra un conteggio a zero (nessun `text-count-hero`, nessun `dueLabel`) né uno streak a zero (nessun «day streak»): non c'è ancora niente da contare.
- **AC4 — Azione = materializza la prima lezione.** *Given* il primo avvio con curriculum disponibile, *when* l'azione è cliccata, *then* invoca `unlockMutation.mutate(next.id)` (la prima lezione, `ordinal` minimo). *And* a curriculum vuoto (`next === null`) NON si rende alcun pulsante (solo la descrizione).
- **AC5 — Confini / celebrazione / regressione.** *Given* `features/dashboard` e i cataloghi, *then* `features/dashboard` non importa `data`, nessun colore letterale, la copy di primo avvio è priva di `!`/emoji/lode, parità en/it verde, i rami `unlocked > 0` (cancello 3.13, dichiarazione 3.14) restano invariati; `npm run lint`/`npm run typecheck`/`npm test` verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 1: (high 0, medium 1, low 0)
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - none
- deferred (1):
  - `[medium]` `unlockMutation` senza `onError` (edge-case-hunter). Gap PRE-ESISTENTE condiviso col pulsante di sblocco 3.13 (stesso call-site): il diff aggiunge solo un secondo trigger. Fuori dall'intento di 3.15 e non banalmente correggibile (serve una superficie/copy d'errore condivisa). Registrato in frontmatter `deferred`.
- reject notevoli (verificati contro il codice reale):
  - **Glue click→`mutate`→refetch non esercitata (`mutate(next.id)`, `disabled={isPending}`)** (blind-hunter, edge-case-hunter): convenzione documentata del repo (AD-12/13; env `node`/`renderToStaticMarkup` senza jsdom, `DashboardScreen.test.tsx:15`), identica al pulsante gemello `unlockAction` di 3.13; il verification-gap reviewer l'ha esplicitamente esclusa come «già alla frontiera di verifica scelta». Il meccanismo (ramo, condizione, copy, un solo pulsante) è coperto a unità.
  - **`firstRunBody` nomina la «review pile» non ancora visibile / copy che «mente» a curriculum vuoto** (blind-hunter): la copy DESCRIVE la meccanica dell'app (AC1: «dice cosa fa l'app»), non afferma una pila presente; il caso `next === null` è `total 0`, «mai in produzione» (contenuto sempre seminato da migrazione) — copy distinta per uno stato irraggiungibile sarebbe over-engineering.
  - **Assenza di test IT espliciti del primo avvio / scansione ASCII su `it`** (blind-hunter): la parità en/it è imposta STRUTTURALMENTE da `i18n.test.tsx` (confronto ricorsivo delle chiavi + scansione CJK sui valori foglia); stesso motivo per cui 3.14 respinse «assert IT esplicito del notice».
  - **Estrazione della classe `<main>`/del pulsante duplicata (DRY)** (blind-hunter): scelta DELIBERATA del repo (solo `CONTAINER_HEIGHT`, la parte critica per «nessun salto», è condivisa; il resto è inline «l'estrazione nasce col secondo consumatore»); estrarre il primitivo pulsante toccherebbe il codice di 3.13/3.14 (scope creep). 3.14 respinse finding di stile analoghi.
  - **Salto scheletro(5 blocchi)→primo avvio(2 elementi)** (blind-hunter): l'altezza del contenitore (`min-h-[24rem]`) è PRESERVATA e TESTATA anche sul ramo di primo avvio (nuovo test «un solo `<main>` con la classe di altezza»); la minor densità interna è propria di uno stato vuoto, non un layout shift.
  - **Precedenza del ramo / stato impossibile `unlocked === 0 && count > 0`** (blind-hunter): irrealizzabile (zero sbloccate ⇒ zero righe `review_state` ⇒ `count 0`); non vale un test.
  - **Commento d'intestazione del file non aggiornato al ramo 3.15** (blind-hunter): l'intestazione è una nota storica di 3.13 già non aggiornata da 3.14 (precedente del repo: nuovi rami documentati INLINE); il nuovo ramo ha un commento inline esaustivo (`:129-140`).
  - **AC2 «hai finito» solo metà-verificabile in 3.15** (intent-alignment, descrittivo): confine di scope DELIBERATO fissato dall'epica (la copy «hai finito» della pila svuotata e la schermata del curriculum esaurito appartengono a 3.16); autorità d'intento, non un difetto.

## Design Notes

**Perché `unlocked === 0` come segnale.** «Mai sbloccato niente» è esattamente «zero righe `lesson_progress`», cioè `unlockedQ.data.length === 0`. Non è `count === 0` (una lezione concettuale sbloccata dà `count 0` ma NON è primo avvio — è il caso 3.14) né `lastUnlocked === null` (equivalente qui, ma `unlocked` è il conteggio diretto e più leggibile). Le sbloccate sono un prefisso contiguo: a zero sbloccate `next` è sempre la prima lezione, quindi l'azione «comincia» materializza `ordinal` minimo.

**Perché nascondere anche il curriculum.** AC3 nomina conteggio e streak; il progresso del curriculum a primo avvio sarebbe «0 di N», un altro zero. L'epica prescrive «senza conteggi a zero» e «ogni stato vuoto dichiara perché è vuoto e offre al massimo un'azione»: il ramo è una empty-state pulita (descrizione + una azione), non una schermata di statistiche a zero.

**Perché non è il lavoro di 3.16.** 3.16 possiede i rami `unlocked > 0`: la copy «hai finito» della pila svuotata e la schermata senza azione del curriculum esaurito. Qui si tocca SOLO `unlocked === 0`. AC2 verifica la distinzione al livello che 3.15 possiede: il primo avvio ha copy propria («comincia») che lo stato svuotato NON porta (quest'ultimo resta, per ora, `unlockAction` — la sua copy «hai finito» arriva in 3.16).

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (chiavi i18n nuove tipizzate; `DashboardScreen` coerente).
- `npm run lint` -- expected: exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; boundaries verdi).
- `npm test` -- expected: exit 0 (primo avvio AC1/AC2/AC3; parità en/it; nessuna regressione a 3.12/3.13/3.14 né ai test app).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

## Auto Run Result

Status: done

**Sintesi del cambiamento.** La storia 3.15 aggiunge alla dashboard uno stato di PRIMO AVVIO distinto, reso SSE nulla è ancora sbloccato (`unlocked === 0`, segnale canonico «mai sbloccato niente» = zero righe `lesson_progress`). Il ramo dichiara cosa fa l'app (`dashboard.firstRunBody`) e offre UNA sola azione la cui copy significa *comincia* (`dashboard.startAction`), riusando il `unlockMutation` esistente per materializzare la prima lezione (`ordinal` minimo). NON rende conteggi a zero: né il `pile-counter` (`text-count-hero`/`dueLabel`), né lo `streak-badge`, né il `curriculum-progress` («0 di N» sarebbe un altro zero) — non c'è ancora niente da contare (AC3). Il testo di primo avvio è DISTINTO da quello della pila svuotata (AC2): il primo porta `firstRunBody`/`startAction`, la svuotata porta `unlockAction`. La copy «hai finito» della pila svuotata e la schermata del curriculum esaurito restano fuori scope per autorità dell'epica (appartengono a 3.16); i rami `unlocked > 0` (cancello 3.13, dichiarazione 3.14) sono INVARIATI. Due sole chiavi i18n nuove (parità en/it), nessun nuovo componente (composizione inline come nel resto della dashboard).

**File modificati/creati:**
- `src/features/dashboard/DashboardScreen.tsx` — nuovo ramo `if (unlocked === 0)` (dopo le derivazioni, prima del `return` esistente): `<main>` con `CONTAINER_HEIGHT`, `<p text-body text-ink-primary>{firstRunBody}</p>` e, sse `next !== null`, un solo `<button>` cablato a `unlockMutation.mutate(next.id)` con `disabled={isPending}` e copy `startAction`. Nessun conteggio/streak/curriculum nel ramo; il resto del file invariato.
- `src/i18n/en.ts` / `it.ts` — `dashboard.firstRunBody` (descrive cosa fa l'app; `en` ASCII) e `dashboard.startAction` (etichetta *comincia*, distinta da `unlockAction`), in ENTRAMBI (parità), copy neutra (nessun `!`/emoji/lode/colore).
- `src/features/dashboard/DashboardScreen.test.tsx` — aggiornate le due semine `unlocked: 0` INCIDENTALI (test altezza, test chiave pila) a `unlocked: 1` (ora il primo avvio è un ramo distinto); aggiunti i test AC1/AC2/AC3/AC4 (descrizione + una azione; testo distinto dalla svuotata; nessun conteggio/streak/curriculum a zero; microcopy senza `!`; solo ASCII; pulsante cablato; curriculum vuoto ⇒ nessun pulsante).
- `src/app/AuthenticatedShell.test.tsx` / `src/app/AppRoutes.test.tsx` — aggiornamento indotto: semina portata a uno stato NON di primo avvio (`unlocked ['lesson-0']` + una lezione con `exerciseCount 1`), così la dashboard rende ancora `primaryAction`; nessun assert cambiato.

**Ripartizione dei finding (questa passata):** patch applicati 0; differiti 1 (medium); respinti 14 (medium 0, low 14). Nessun `intent_gap`, nessun `bad_spec`, nessun loopback: `review_loop_iteration` resta 0. L'unico differito (`unlockMutation` senza `onError`) è un gap PRE-ESISTENTE condiviso col pulsante di sblocco 3.13, emerso incidentalmente e fuori dall'intento di 3.15; registrato in frontmatter `deferred` per attenzione focalizzata.

**Raccomandazione di follow-up review:** `false`. Contano solo i patch di questa passata: high 0, medium 0, low 0 ⇒ punteggio `3×0 + 1×0 = 0` (< 5 e nessun high).

**Verifica eseguita (indipendente, dopo l'implementazione):**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; boundaries verdi).
- `npm test` — exit 0 (70 file, 743 test; primo avvio AC1/AC2/AC3/AC4; parità en/it; nessuna regressione a 3.12/3.13/3.14 né ai test app-level).
- `npm run validate-content` — exit 0.

**Matrix Test Audit:** tutte e 5 le righe della matrice coperte da test eseguiti e verdi (riga «primo avvio, curriculum disponibile» → AC1; «primo avvio vs pila svuotata» → AC2; «nessun conteggio» → AC3; «curriculum vuoto» → AC4; «non primo avvio, pila piena» → test del cancello 3.13 esistente, ancora verdi).

**Rischi residui.** (1) La glue click→`mutate`→refetch del pulsante di primo avvio non è esercitata sotto l'harness `node`/`renderToStaticMarkup` (nessun jsdom): differita all'e2e come da convenzione del repo (AD-12/13), identica al pulsante gemello 3.13; il meccanismo (ramo, condizione di render, copy, un solo pulsante) è coperto a unità. (2) `unlockMutation` non ha `onError` (differito): su fallimento della RPC il pulsante si ri-abilita senza feedback — gap pre-esistente condiviso con 3.13, registrato in `deferred`. (3) La copy «hai finito» della pila svuotata e la schermata del curriculum esaurito appartengono a 3.16 (autorità dell'epica): AC2 è soddisfatto qui al livello che 3.15 possiede (copy di primo avvio distinta da quella svuotata).
