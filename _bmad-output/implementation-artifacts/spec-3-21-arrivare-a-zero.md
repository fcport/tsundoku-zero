---
title: 'Story 3.21: Arrivare a zero'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'dc7e1d7ab5785357077fd433f8e3ba9c0eb04fe9'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Sulla schermata di completamento, se la query dello streak
      (`['streak', userId]` → `listReviewLog()`) va in errore, `streakLogQ.data`
      resta undefined e il placeholder grigio resta indefinitamente, senza
      affordance d'errore.
    evidence: |-
      Il ramo di completamento rende la riga streak solo se
      `streakLogQ.data !== undefined`, altrimenti il placeholder `bg-surface-sunken`.
      Su reject di `listReviewLog` i dati restano undefined ⇒ placeholder permanente.
      È il MEDESIMO pattern della dashboard (gate su `logQ.data === undefined` ⇒
      scheletro anche in errore): gap PRE-ESISTENTE app-wide sugli stati d'errore dei
      read-model (cfr. deferred #1 di 3.18), non introdotto da 3.21. Il contenuto
      primario (conferma + dismiss) resta comunque reso e l'uscita funziona.
    location: >-
      src/features/study/SessionScreen.tsx:247-255
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Il ciclo di sessione è chiuso (3.19) e abbandonabile (3.20), ma quando la pila si svuota A ZERO durante la sessione non c'è nessuna CONFERMA di aver finito: il ramo a coda vuota di `SessionScreen` (`currentId === null`) rende un `<main>` neutro e VUOTO, con un commento che rimanda esplicitamente questa schermata alla 3.21. Chi arriva a zero non vede né la conferma sobria di chiusura né lo streak — che pure conta proprio la giornata portata a zero.

**Approach:** Distinguere, dentro il ramo a coda vuota, la SESSIONE TERMINATA (`total > 0`: la sessione è stata avviata e drenata) dalla PILA VUOTA all'ingresso (`total === 0`: deep-link, niente da fare). Solo nel primo caso rendere una schermata di completamento SOBRIA: un testo di conferma PIÙ lo streak AGGIORNATO PIÙ un'affordance visibile per tornare alla dashboard (riusa `onExit`, già cablata dalla 3.20). Lo streak arriva dalla STESSA chiave `['streak', userId]` della dashboard → `review.listReviewLog()` → funzione PURA `streak(log, now, timeZone)`. Nessun cambio di dominio: la 3.21 è pura superficie/orchestrazione, AC3 regge per COSTRUZIONE.

## Boundaries & Constraints

**Always:**
- **Il completamento è `currentId === null && total > 0`.** Dentro il ramo esistente a coda vuota (`currentId === null`, cioè `isComplete(session)`), se `total > 0` (la sessione è stata AVVIATA da `start(dueIds)` con pila non vuota e poi drenata) rendere la schermata di completamento; se `total === 0` (mai avviata: deep-link a pila vuota) restare lo `<main>` neutro e vuoto di OGGI, invariato. `total` è letto dallo store via `getState()` (come le altre letture pure `currentExerciseId`/`remainingCount`), impostato solo da `start`.
- **Lo streak è quello UNICO e DERIVATO (AD-18/AD-5).** Leggere la STESSA chiave `['streak', userId]` della dashboard con `useQuery(queryFn: () => review.listReviewLog())`; i giorni sono `streak(logQ.data, clock.now(), clock.timeZone())` — la funzione PURA di `src/domain/streak.ts`, mai reimplementata, mai memorizzata. `clock.now()`/`clock.timeZone()` ENTRANO dal Clock iniettato (mai letti da global). La `useQuery` è un hook TOP-LEVEL prima di ogni early-return (regola degli hook), con `enabled: !!userId && sessionComplete` così NON fa fetch durante la sessione attiva; al completamento la lettura fresca riflette la risposta di oggi ⇒ streak «aggiornato» (AC1). La mutation di risposta già invalida `['streak', userId]` in `onSettled` (3.19), quindi la chiave è marcata stale al drenaggio.
- **AC3 regge per COSTRUZIONE.** Portare la pila a zero implica ≥1 risposta oggi; `streak` conta una giornata con ≥1 risposta, ancorata a mezzanotte nel `timeZone` iniettato (via `localDayOrdinal`). Quindi «quella giornata conta, ancorata alla mezzanotte del fuso del dispositivo» è già vero: NESSUN codice di dominio nuovo, NESSUNA modifica a `streak.ts`.
- **Copy SOBRIA (AC2), nuovo sotto-namespace `session.complete` in ENTRAMBI i cataloghi** (parità ricorsiva imposta da `i18n.test.tsx`): `body` (conferma di aver finito), `streakLabel` (interpola `{{days}}`, MAI `{{count}}` che innescherebbe il pluralizzatore — coerente con `dashboard.streakLabel`), `dismiss` (torna alla dashboard, verbale e concreta, mai «Continua»). `en` ASCII; nessun `!`, nessuna emoji, nessun CJK, nessun avverbio di lode.
- **Affordance di ritorno = `onExit` (nessun cablaggio nuovo).** Un `<button type="button" onClick={onExit}>` SECONDARIO (token neutri, nessun `bg-accent`, nessun verde): `onExit` naviga già a `ROOT_PATH` (cablata da `AppRoutes` nella 3.20). Esc resta attivo (listener top-level della 3.20) per l'intera vita della schermata, completamento incluso.
- **Confini AD-1.** `features/study` importa `domain`/`ui`/`i18n`/`@tanstack/react-query`/`zustand`, MAI `data` né `react-router`. Lo streak resta puro nel dominio. Nessun global temporale/casuale nel dominio (immutato qui).

**Block If:**
- _Nessun blocco._ Ogni decisione è fissata dall'epica e dai moduli esistenti (`streak` di dominio, chiave `['streak']` e porta `listReviewLog`, navigazione-come-callback `onExit`, ramo a coda vuota). Nessuna migrazione, nessuna azione umana o esterna al repository.

**Never:**
- NON il contratto tastiera COMPLETO — tasti numerici, ordine di tab, `aria-live` region — (3.22): la schermata di completamento NON introduce live region. NON i breakpoint responsive/thumb-zone (3.23).
- NON memorizzare lo streak, NON aggiungere una colonna streak, NON ricalcolarlo fuori dal dominio, NON modificare `streak.ts`. NON reimplementare dovutezza/esito/scheduling. NON cambiare le chiavi `['due']`/`['streak']`.
- NON usare verde/rosso; nessun `!`/emoji/coriandolo/spunta/badge/animazione celebrativa. NON rendere `session.complete.dismiss` un `button-primary` (max uno per schermata). NON auto-navigare via dal completamento (l'utente esce con l'affordance o Esc). NON rendere la schermata di completamento per la pila vuota all'ingresso (`total === 0`). NON rendere la `ProgressMeter` sul completamento (è l'affordance della sessione attiva).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| sessione terminata | store drenato: `total > 0`, coda vuota (`currentId === null`) | schermata di completamento: `body` + streak aggiornato + `dismiss`; nessuna card, nessuna barra | — |
| pila vuota all'ingresso | deep-link: `total === 0`, coda vuota | `<main>` neutro e vuoto, invariato (nessun `body` di completamento) | — |
| streak al completamento | log seminato, `now`/`timeZone` iniettati | i giorni sono `streak(log, now, timeZone)`; la giornata a-zero conta (ancora mezzanotte del fuso) | — |
| streak in caricamento | completamento con cache fredda (deep-link poi sessione) | `body` reso subito; al posto dello streak un placeholder alla stessa altezza, nessuno spinner | — |
| ritorno alla dashboard | click su `dismiss` o Esc sul completamento | `onExit()` ⇒ navigazione a `ROOT_PATH` (dashboard) | — |
| nessuna celebrazione | markup del completamento | nessun `!`, nessun verde/rosso, nessuna emoji/badge/coriandolo/animazione | — |

</intent-contract>

## Code Map

- `src/features/study/SessionScreen.tsx:174` -- **calcolare `currentId` più in alto** (subito dopo le letture dello store, righe ~84-86) così è disponibile per la `useQuery` streak; deriva `const sessionComplete = currentId === null && total > 0` (equivalente a `isComplete(session) && total > 0`).
- `src/features/study/SessionScreen.tsx:29` -- **riuso** `useQuery` già importato; **aggiungere** hook top-level `useQuery({ queryKey: ['streak', userId], enabled: !!userId && sessionComplete, queryFn: () => review.listReviewLog() })` accanto a `dueQ`/`exercisesQ` (prima degli early-return). `review` è già da `usePorts()`.
- `src/features/study/SessionScreen.tsx:201-205` -- **modificare** il ramo `currentId === null`: se `total > 0` rendere la schermata di completamento (`t('session.complete.body')`; se `streakLogQ.data !== undefined` la riga streak `t('session.complete.streakLabel', { days: streak(streakLogQ.data, clock.now(), clock.timeZone()) })`, altrimenti un placeholder `bg-surface-sunken` alla stessa altezza; `<button onClick={onExit}>` con `t('session.complete.dismiss')`, secondario). Altrimenti (`total === 0`) restare l'`<main>` neutro vuoto di oggi.
- `src/features/study/SessionScreen.tsx:1-27` -- **aggiornare** l'intestazione: il completamento/zero ora è IN scope (3.21); FUORI SCOPE restano il contratto tastiera completo/live region (3.22) e il responsive (3.23).
- `src/features/study/SessionScreen.tsx:26` -- **aggiungere** import `import { streak } from '../../domain/streak';`.
- `src/features/study/SessionScreen.test.tsx` -- **estendere**: (1) store drenato (`useSessionStore.setState({ session: createSession([]), total: 2, initialIds: ['ex-1','ex-2'] })`) + `['due']=[]` + `['streak', UID]` seminato ⇒ `en.session.complete.body` reso, `en.session.complete.dismiss` reso, streak reso col numero atteso da `streak(log, NOW, 'UTC')`, nessuna `role="progressbar"`, nessun `!`; (2) deep-link `total === 0` (già coperto) ⇒ `en.session.complete.body` ASSENTE.
- `src/i18n/en.ts:88-128` / `src/i18n/it.ts:82-122` -- **aggiungere** `session.complete = { body, streakLabel, dismiss }` in parità (`en` ASCII, niente `!`/emoji/CJK). `streakLabel` usa `{{days}}`.
- `src/domain/streak.ts` -- **riuso INVARIATO** (AC3 per costruzione: giornata a-zero già contata, ancorata al fuso). Nessuna modifica.
- `src/domain/session.ts` -- **riuso INVARIATO** (`currentExerciseId`/`isComplete`/`remainingCount`).
- `src/app/AppRoutes.tsx` / `src/app/AppRoutes.test.tsx` -- **riuso INVARIATO**: `onExit` già cablata a `ROOT_PATH` (3.20); `dismiss` la riusa. Nessun cablaggio nuovo.

## Tasks & Acceptance

**Execution:**
- `src/features/study/SessionScreen.tsx` (+ `SessionScreen.test.tsx`) -- ramo di completamento (`currentId === null && total > 0`): conferma sobria + streak aggiornato dalla chiave `['streak']` + `dismiss`→`onExit`; `useQuery` streak top-level `enabled` solo al completamento; import `streak`; intestazione aggiornata. Test: completamento su store drenato; deep-link a pila vuota invariato; nessun `!`/barra sul completamento.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- sotto-namespace `session.complete` (`body`, `streakLabel` con `{{days}}`, `dismiss`) in parità (`en` ASCII).

**Acceptance Criteria:**
- **AC1 — Schermata di completamento con streak.** *Given* la coda di sessione vuota dopo una sessione avviata (`total > 0`), *when* è renderizzata, *then* compare una schermata di completamento che conferma il risultato (`session.complete.body`) e mostra lo streak AGGIORNATO, letto dalla chiave `['streak', userId]` e derivato da `streak(log, clock.now(), clock.timeZone())`.
- **AC2 — Chiusura sobria, nessuna celebrazione.** *Given* la schermata di completamento, *when* è renderizzata, *then* non contiene spunte verdi, coriandoli, badge o animazioni celebrative, non usa `!` né emoji, e usa solo token del sistema di design (nessun verde/rosso).
- **AC3 — La giornata a-zero conta, ancorata al fuso.** *Given* una giornata in cui la pila arriva a zero, *when* lo streak è ricalcolato, *then* quella giornata conta, ancorata a mezzanotte del fuso del dispositivo (regge per costruzione: il drenaggio implica ≥1 risposta oggi e `streak` conta a mezzanotte del `timeZone` iniettato; verificato con un log seminato).
- **AC4 — Pila vuota all'ingresso invariata.** *Given* `/studia` con la pila vuota all'ingresso (`total === 0`), *when* è renderizzata, *then* resta lo `<main>` neutro e vuoto di prima (nessun `body` di completamento, nessuna card, nessuna barra).
- **AC5 — Confini / regressione.** *Given* il diff, *then* `features/study` non importa `data`/`react-router`; lo streak resta puro/derivato (mai memorizzato); parità en/it verde, `en` ASCII, copy senza `!`/emoji; nessun verde/rosso; dashboard e sessione invariate nei comportamenti esistenti; `npm run lint`/`typecheck`/`test`/`validate-content` verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 1: (high 0, medium 1, low 0)
- reject: 19: (high 0, medium 0, low 19)
- addressed_findings:
  - none
- defer notevole:
  - **Errore della query streak ⇒ placeholder permanente** (edge/blind): pre-esistente e app-wide (identico alla dashboard, che su errore resta a scheletro); registrato in frontmatter `deferred`.
- reject notevoli (verificati contro codice reale e intento):
  - **«0 day streak» renderizzabile / streak=0 non guardato** (edge primario, blind, intent-align): a REGIME lo streak è ≥1 per COSTRUZIONE (drenare implica ≥1 risposta oggi, che `streak` conta a mezzanotte del fuso). «0 giorni di fila» è già una resa ACCETTATA nel ramo popolato della dashboard, quindi mostrarlo (nell'impossibile/transitorio) è coerente, non un difetto; l'unico percorso a 0 è una race transitoria auto-corretta dall'invalidazione `onSettled`. Un guard `> 0` in presentazione scavalcherebbe la fonte-unica di dominio (AD-18) e divergerebbe dalla policy della dashboard.
  - **AC3: lettura stretta «conta PERCHÉ la pila è a zero» non implementata** (intent-align): architetturalmente esclusa dall'epica (3.5/AD-18: il log per-risposta non può osservare se la pila si è svuotata; un giorno conta con ≥1 risposta). Unica lettura difendibile ⇒ nessun intent gap; AC3 soddisfatto da C' («la giornata a-zero ha ≥1 risposta ⇒ conta»).
  - **AC3 timezone testato come pass-through / anchoring non ri-testato** (intent-align, verification-gap): l'ancoraggio a mezzanotte del fuso vive nel dominio (`calendarDay`/`streak`), INVARIATO e testato da `streak.test.ts`/`streak-*`. 3.21 inoltra correttamente `clock.timeZone()`; il test di componente verifica il wiring (output reso == funzione pura). Il verification-gap reviewer ha concluso «no gaps».
  - **AC1 «aggiornato»/invalidazione non ri-testata; race del fetch streak** (intent-align, edge): l'invalidazione `['streak']` in `onSettled` è pre-esistente (3.19) e INVARIATA; la query abilitata al completamento fa una lettura fresca e l'invalidazione garantisce il refetch ⇒ «aggiornato» regge. La race (fetch prima del commit) è runtime-only e auto-corretta; ri-testare la 3.19 è fuori scope.
  - **Scope pila-di-prodotto vs coda-di-sessione** (intent-align): AC1 parla di «coda di sessione vuota» ⇒ la lettura session-scoped (`total > 0` + coda vuota) è quella corretta; `total` disambigua dal deep-link a pila vuota (`total === 0`).
  - **A11y: heading/landmark, focus-management alla transizione, aria-busy sul placeholder, contratto tastiera** (blind): l'a11y completa (focus/tastiera/live region) è la story 3.22 per split dell'epica; coerente con le schermate sorelle (dashboard/card usano `<p>`, non heading). Fuori scope per intento.
  - Altri nit low senza conseguenza utente: DRY di `streakLabel` vs `dashboard.streakLabel` (namespace per-schermata deliberato), brittleness di `not.toContain('!')` (nessuna classe `!important` nel markup reso, asserzione valida), dimensioni approssimate del placeholder di caricamento (transitorio, materia di design-review), `dismiss` non asserito come `<button>` (glue del click verificata-live come per tutte le 20 storie precedenti), confine drenato-vs-id-assente (condizioni mutuamente esclusive), conteggio esercizi completati non mostrato (non nell'intento), interpolazione `days` non-numerica (garantita dal tipo).

## Design Notes

**Perché distinguere su `total` e non solo su `currentId === null`.** Il ramo a coda vuota è AMBIGUO: copre sia il deep-link a pila vuota (mai avviata: niente da fare) sia la sessione drenata a zero (appena finita). `total` disambigua senza stato nuovo: è impostato SOLO da `start(dueIds)` quando la pila era non vuota, quindi `total > 0` ⟺ una sessione è stata avviata e drenata ⇒ completamento; `total === 0` ⟺ mai avviata ⇒ neutro. Nessun flash: in produzione, prima dello `start` l'utente è nello scheletro (`dueQ.data === undefined`), poi `start` popola lo store; il completamento appare solo dopo il drenaggio.

**Lo streak «aggiornato» è gratis.** La schermata legge la STESSA chiave `['streak']` della dashboard; la mutation di risposta la invalida a ogni `onSettled` (3.19), e la query — abilitata solo al completamento — fa una lettura fresca di `listReviewLog()` che include la risposta di oggi. AC3 regge per costruzione (drenare = rispondere oggi; `streak` conta a mezzanotte del fuso iniettato) — nessuna modifica al dominio.

**Nessuna live region qui.** L'annuncio `aria-live` dell'esito/avanzamento è il contratto tastiera completo della 3.22; la 3.21 rende solo la conferma statica.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (chiavi i18n `session.complete.*`; `useQuery` streak tipizzata).
- `npm run lint` -- expected: exit 0 (`features/study` non importa `data`/`react-router`; confini AD-1 verdi).
- `npm test` -- expected: exit 0 (AC1-AC5: completamento reso con streak; deep-link a pila vuota invariato; parità en/it; nessuna regressione).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

**Manual checks (live):**
- In `/studia`: completare tutti gli esercizi ⇒ compare la conferma sobria di aver finito con lo streak aggiornato; `dismiss` ed Esc tornano alla dashboard; un deep-link a `/studia` con pila già vuota resta lo stato neutro (nessuna schermata di completamento).

## Auto Run Result

Status: done.

### Sintesi del cambiamento implementato
La storia 3.21 aggiunge la schermata di COMPLETAMENTO («arrivare a zero»): quando la coda di sessione si svuota DOPO una sessione avviata (`currentId === null && total > 0`), il ramo a coda vuota di `SessionScreen` — che prima rendeva un `<main>` neutro e vuoto — rende una conferma SOBRIA di aver finito, lo streak AGGIORNATO e un'affordance per tornare alla dashboard. È pura superficie/orchestrazione: NESSUN codice di dominio nuovo. Lo streak arriva dalla STESSA chiave `['streak', userId]` della dashboard (porta `listReviewLog()`) ed è derivato dalla funzione PURA `streak(log, clock.now(), clock.timeZone())`, con la query `enabled` solo al completamento (nessun fetch durante la sessione attiva); la lettura fresca al drenaggio riflette la risposta di oggi (AC1 «aggiornato»). AC3 regge per COSTRUZIONE: drenare implica ≥1 risposta oggi e `streak` conta quel giorno a mezzanotte del fuso INIETTATO. La pila vuota all'INGRESSO (`total === 0`, deep-link) resta invariata (neutro). Nessuna celebrazione (nessun verde/rosso, `!`, emoji, badge, coriandolo, animazione); l'affordance `dismiss` riusa `onExit` (già cablata a `ROOT_PATH` dalla 3.20) ed Esc resta attivo.

### File cambiati (rispetto al baseline `dc7e1d7ab5785357077fd433f8e3ba9c0eb04fe9`)
- `src/features/study/SessionScreen.tsx` (+ test) -- `currentId`/`sessionComplete` derivati in alto (regola degli hook); `useQuery` streak top-level `enabled: !!userId && sessionComplete`; ramo di completamento sobrio (conferma + streak dalla funzione pura, o placeholder alla stessa altezza in caricamento + `dismiss`→`onExit`); intestazione aggiornata (3.21 in scope; 3.22/3.23 fuori scope). Rimosso il `currentId` duplicato più in basso.
- `src/i18n/en.ts` / `src/i18n/it.ts` -- sotto-namespace `session.complete` = `{ body, streakLabel (`{{days}}`), dismiss }` in parità (`en` ASCII; niente `!`/emoji/CJK; `dismiss` verbale, mai «Continua»).

### Ripartizione dei rilievi di review (questo pass)
- Patch applicati: 0.
- Item deferiti: 1 (medium) — errore della query streak ⇒ placeholder permanente (pre-esistente app-wide, identico alla dashboard); vedi frontmatter `deferred` e `## Review Triage Log`.
- Item respinti: 19 (tutti low) — vedi `## Review Triage Log`. Verificati contro codice reale e intento: «0 day streak» irraggiungibile a regime (streak ≥1 per costruzione, e comunque resa accettata nella dashboard), AC3 nella sua unica lettura difendibile (design streak dell'epica 3.5/AD-18) è soddisfatto, dominio streak testato altrove, a11y completa (focus/tastiera/live region) di competenza della 3.22, e nit di stile/test senza conseguenza utente.

### Raccomandazione di follow-up
`followup_review_recommended: false`. Rilievi `patch` di questo pass: 0 (high 0, medium 0, low 0); punteggio `3×0 + 1×0 = 0` (< 5) e nessun patch high. Nessun ulteriore ciclo necessario.

### Verifica eseguita
Tutte e quattro le verifiche dichiarate sono verdi (eseguite indipendentemente dopo l'implementazione):
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0 (confini AD-1 verdi; `features/study` non importa `data`/`react-router`).
- `npm test` -- exit 0 (79 file, 915 test; +4 rispetto alla 3.20, nessuna regressione).
- `npm run validate-content` -- exit 0.
Matrix Test Audit: ogni riga della I/O matrix è coperta da un test eseguito e verde a livello di superficie resa (completamento con `body`/streak/`dismiss`; deep-link `total === 0` invariato; streak da `streak(log, now, tz)`; placeholder in caricamento; nessuna celebrazione). La riga «ritorno alla dashboard» ha l'affordance `dismiss` asserita come resa; l'invocazione `onExit` (click/Esc) è glue verificata-live per convenzione del repo (test in node/SSR senza jsdom), identica alla 3.20.

### Rischi residui
- **Errore di caricamento dello streak** (deferito): su reject di `listReviewLog` il placeholder resta indefinitamente; il contenuto primario (conferma + `dismiss`) resta reso e l'uscita funziona. Pattern pre-esistente app-wide.
- **Effetti verificabili solo live**: listener Esc, `onExit`→`navigate` e il fetch dello streak sono glue non eseguita da `renderToStaticMarkup`; la logica pura sottostante (`streak`) e l'output reso sono testati.
