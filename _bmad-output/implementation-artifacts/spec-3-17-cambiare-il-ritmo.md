---
title: 'Story 3.17: Cambiare il ritmo'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '753b6009b964913e41be5f2bad91df623d26aa30'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Il tetto giornaliero di sblocco (FR6.5/FR6.6) non esiste ancora: l'utente può sbloccare lezioni senza limite e non c'è modo di cambiare il ritmo. Manca (a) la colonna `user_settings.lessons_per_day` (predefinito 1), (b) un controllo in Impostazioni per cambiarla, (c) un cancello che, a tetto raggiunto, sostituisca l'azione di sblocco con una dichiarazione del limite e di quando riapre.

**Approach:** Aggiungere la colonna con una migrazione `ALTER TABLE`; estendere il port `SettingsRepository` con `load/saveLessonsPerDay` (upsert diretto, confine totale, come il locale); portare `unlocked_at` nel read-model del progresso (rinominando `listUnlockedLessonIds`→`listUnlockedLessons`, ritorno `UnlockedLesson[]`, sorgente UNICA di id+istante); una funzione di dominio pura `dailyUnlockLimitReached(unlockedAt, lessonsPerDay, now, timeZone)` (confine di giornata a mezzanotte nel fuso, riusando `localDayOrdinal` estratto in un modulo condiviso); nel cancello della dashboard, a `count === 0 && next !== null`, se il tetto è raggiunto rendere `dailyLimitReachedBody` (NESSUN pulsante) invece di `unlockAction`; in Impostazioni un secondo gruppo di opzioni (modello `LanguageOptions`) che persiste il valore.

## Boundaries & Constraints

**Always:**
- **AC1 — migrazione additiva.** Nuovo file `supabase/migrations/<ts>_add_lessons_per_day_to_user_settings.sql` con `alter table user_settings add column lessons_per_day int not null default 1;`. Timestamp a 14 cifre STRETTAMENTE maggiore di `20260925150000`. Nessuna RLS/policy nuova (la riga è già isolata). Nessun altro DDL nel file.
- **AC2 — upsert diretto.** `saveLessonsPerDay(value)` fa `client.from('user_settings').upsert({ user_id, lessons_per_day: value })` (mai RPC), confine totale (risolve sempre `void`), no-op senza sessione — mirror ESATTO di `saveLocale`. L'upsert invia solo `{ user_id, lessons_per_day }`: su conflitto PK aggiorna SOLO `lessons_per_day`, `locale` resta; su insert nuova riga `locale` prende il suo default. `loadLessonsPerDay()` fa `select('lessons_per_day').maybeSingle()`, difende `typeof value === 'number'`, ritorna `number | null`, mai reject.
- **AC3 — cancello del tetto.** Nel ramo caricato `unlocked > 0`, blocco azione: `count > 0` ⇒ `primaryAction` (invariato, tetto NON consultato); `count === 0 && next !== null && !capReached` ⇒ `unlockAction` (invariato); `count === 0 && next !== null && capReached` ⇒ `dailyLimitReachedBody`, NESSUN `<button>`; `count === 0 && next === null` ⇒ nulla (3.16, invariato). `capReached = dailyUnlockLimitReached(unlockedAt, cap, now, timeZone)`; `cap = lessonsPerDayQ.data ?? DEFAULT_LESSONS_PER_DAY`; `now`/`timeZone` dal Clock iniettato.
- **AC4 — esattamente due impostazioni.** La `<section>` di `SettingsScreen` contiene ESATTAMENTE due gruppi di impostazioni (`role="group"`): lingua e tetto di sblocco. La cancellazione account resta la sua `<section>` separata (1.10, invariata) nella shell.
- **Read-model UNICO del progresso.** `listUnlockedLessons(): readonly UnlockedLesson[]` (`{ lessonId: string; unlockedAt: Date }`) è la sola lettura di `lesson_progress`: da essa la dashboard deriva sia gli id (`.map(u => u.lessonId)` per `nextLessonToUnlock`/`lastUnlockedLesson`/`unlocked.length`) sia gli istanti (`.map(u => u.unlockedAt)` per il tetto). Niente doppia lettura della stessa tabella.
- **Dominio puro (AD-1).** `unlockPace.ts` e `calendarDay.ts`: nessun import esterno, nessun `Date.now()`/`new Date()` senza argomenti, nessun `Intl…resolvedOptions()`, `Math.random()`. `now`/`timeZone` sono SEMPRE parametri (come `streak`). Il confine di giornata è mezzanotte nel `timeZone` PASSATO.
- **Confini AD-1.** `features/settings` e `features/dashboard` importano `domain`/`ui`/`i18n`/`@tanstack/react-query`, MAI `data`; `features` non importa `features`. `SettingsRepository` arriva a `SettingsScreen` come prop (invariato) e a `DashboardScreen` come NUOVA prop (`settings` resta prop, non promosso a `Ports`).
- **Copy neutra, parità en/it, niente pluralizzazione.** Chiavi nuove in ENTRAMBI i cataloghi (parità imposta da `i18n.test.tsx`). Interpolazione con `{{limit}}`/`{{value}}` (MAI `{{count}}`, che innescherebbe il pluralizzatore i18next e romperebbe la parità — vedi `streakLabel`). `en` resta ASCII (nessun code point ≥ U+2000); nessun `!`, emoji, avverbio di lode, colore letterale; nessuna apertura possessiva («you have»/«hai »).

**Block If:**
- _Nessun blocco._ Ogni decisione è fissata dall'epica (FR6.5/FR6.6, tetto predefinito 1, modificabile da Impostazioni) e dai pattern esistenti (upsert `saveLocale`, `localDayOrdinal`/confine-giornata di `streak`, cancello 3.13/3.16). La migrazione è additiva e si applica automaticamente al merge su `main` (`migrate.yml`): nessuna azione umana esterna al repository.

**Never:**
- NON toccare la RLS/le 4 policy di `user_settings`, né il vincolo delle colonne esistenti; NESSUN `check` su `lessons_per_day` (minimalità della tabella, come `locale`): l'invariante `≥ 1` è imposta al confine (opzioni UI limitate + valore sempre da `LESSONS_PER_DAY_OPTIONS`).
- NON toccare il ramo `count > 0` (svuota-pila 3.12), il ramo di primo avvio (`unlocked === 0`, 3.15), né le dichiarazioni del pile-counter a zero (3.16 `clearedBody`/`noExercisesNotice`/`curriculumCompleteBody`): il tetto agisce SOLO nel blocco azione, la dichiarazione del perché la pila è vuota resta sopra e complementare.
- NON cablare l'avvio sessione (resta 3.18); NON persistere lo stato del tetto come derivato memorizzato (sempre riletto da `user_settings`); NESSUN nuovo componente `pile-counter`/`empty-state`; NON leggere `lesson_progress` due volte; NON aggiungere `settings` a `Ports` (rework del flusso locale/boot fuori scope).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tetto non raggiunto | `count 0`, `next≠null`, `unlocksToday < cap` | `unlockAction` reso, un `<button>` (invariato) | — |
| Tetto raggiunto | `count 0`, `next≠null`, `unlocksToday ≥ cap` | `dailyLimitReachedBody` (con `{{limit}}`=cap), NESSUN pulsante | — |
| Tetto > 1, parziale | `cap 3`, `unlocksToday 2`, `count 0`, `next≠null` | `unlockAction` (2 < 3) | — |
| Sblocco concettuale conta | lezione senza esercizi sbloccata oggi | incrementa `unlocksToday` (riga `lesson_progress`), può raggiungere il tetto | — |
| Pila piena | `count > 0` | `primaryAction`, tetto NON consultato (invariato) | — |
| Primo avvio | `unlocked === 0` | ramo 3.15 invariato (`unlocksToday 0 < cap`, mai capped) | — |
| Confine giornata | sblocco di ieri (fuso locale), `now` oggi | NON conta in `unlocksToday` | — |
| Persistenza tetto | scelta in Impostazioni | `upsert({ user_id, lessons_per_day })`, ottimistico prima | confine totale: reject ingoiato |
| Lettura tetto | riga assente / valore non-numero / errore | `loadLessonsPerDay` ⇒ `null` ⇒ dashboard/Impostazioni usano `DEFAULT_LESSONS_PER_DAY` | mai reject |
| Riga `lesson_progress` malformata | `lesson_id`/`unlocked_at` mancante o di tipo errato | `DataError('listUnlockedLessons')` | reject (alimenta TanStack) |

</intent-contract>

## Code Map

- `supabase/migrations/20260925160000_add_lessons_per_day_to_user_settings.sql` -- **NUOVO**. `alter table user_settings add column lessons_per_day int not null default 1;` + commento sul perché additivo e senza check (mirror del tono di `20260923221517_create_user_settings.sql:12-16`).
- `src/migrations.test.ts:129-273` -- il test `user_settings` (`_create_user_settings.sql`) resta invariato (la CREATE espone ancora 2 colonne). **Aggiungere** un `describe` per la nuova migrazione: via AST `AlterTableStmt` su `user_settings`, un `AddColumn` `lessons_per_day` di tipo `int`/`int4`, not null, default `1`; + guardia timestamp 14 cifre `> 20260925150000`. Il loop `parsa senza errori` (`:105-114`) copre la sintassi automaticamente.
- `src/domain/ports/settingsRepository.ts:22-34` -- **aggiungere** `loadLessonsPerDay(): Promise<number | null>` e `saveLessonsPerDay(value: number): Promise<void>` all'interfaccia (docstring: mirror del confine totale del locale).
- `src/data/settingsRepository.ts:26-67` -- **implementare** i due metodi come mirror di `saveLocale`/`loadLocale`: upsert `{ user_id, lessons_per_day: value }`; select `'lessons_per_day'` + `maybeSingle()` + guardia `typeof value === 'number'`.
- `src/data/settingsRepository.test.ts` -- **estendere** `FakeClientOptions` (`row?: { lessons_per_day?: unknown }`, cattura `upserts`) e **aggiungere** i `describe` per i due metodi (payload upsert `{ user_id, lessons_per_day }`; null/non-numero/errore ⇒ `null`; no-op senza sessione; SDK throw ingoiato).
- `src/domain/ports/progressRepository.ts:18-40` -- **rinominare** `listUnlockedLessonIds(): Promise<readonly string[]>` in `listUnlockedLessons(): Promise<readonly UnlockedLesson[]>` e **dichiarare** `export interface UnlockedLesson { readonly lessonId: string; readonly unlockedAt: Date }`. `unlockLesson` invariato. Aggiornare le docstring.
- `src/data/progressRepository.ts:20-66` -- select `'lesson_id, unlocked_at'`; mappare a `{ lessonId, unlockedAt: new Date(<iso>) }`; guardia su ENTRAMBI i campi (`lesson_id` stringa, `unlocked_at` stringa parsabile a `Date` valida) ⇒ altrimenti `DataError('listUnlockedLessons')`. Rinominare il metodo e la costante `LESSON_PROGRESS_COLUMNS`.
- `src/data/progressRepository.test.ts` -- rinominare; asserire mappatura `{ lessonId, unlockedAt }` e che `unlocked_at` malformato/assente ⇒ `DataError`.
- `src/domain/streak.ts:32-53` -- **estrarre** `localDayOrdinal` e `MS_PER_DAY` in `calendarDay.ts` e importarli (refactor puro; i test streak restano verdi).
- `src/domain/calendarDay.ts` -- **NUOVO**. `export function localDayOrdinal(instant: Date, timeZone: string): number` (+ `MS_PER_DAY`), copiato verbatim da `streak.ts` (robusto a DST/fine mese).
- `src/domain/unlockPace.ts` -- **NUOVO**. `export const DEFAULT_LESSONS_PER_DAY = 1`; `export const LESSONS_PER_DAY_OPTIONS = [1, 2, 3, 4, 5] as const`; `unlocksToday(unlockedAt: readonly Date[], now, timeZone): number` (conta gli istanti il cui `localDayOrdinal` == quello di `now`); `dailyUnlockLimitReached(unlockedAt, lessonsPerDay, now, timeZone): boolean` (`unlocksToday(...) >= lessonsPerDay`).
- `src/domain/unlockPace.test.ts` -- **NUOVO**. Copre `unlocksToday` (oggi/ieri/domani nel fuso, DST, lista vuota) e `dailyUnlockLimitReached` (cap 1 e >1, uguaglianza) + sanità di `LESSONS_PER_DAY_OPTIONS`/default. Copre transitivamente `calendarDay` (già coperto anche da `streak.test.ts`).
- `src/features/dashboard/DashboardScreen.tsx:33-97,102-134,227-254` -- aggiungere prop `settings`; nuova query `['lessonsPerDay', userId]` (`enabled: !!userId`, `queryFn: () => settings.loadLessonsPerDay()`) **inclusa nel cancello scheletro** (`=== undefined`); `unlockedIds`/`unlockedAt` derivati da `unlockedQ.data`; `capReached` nel blocco azione. Aggiornare il commento d'intestazione (proprietà del tetto da parte di 3.17).
- `src/features/dashboard/DashboardScreen.test.tsx:30-110,265-334` -- aggiornare `inMemoryPorts.progress` (rinominare metodo), `render()` passa una `settings` finta, `seededClient` semina `['unlocked']` come `UnlockedLesson[]` (istante di DEFAULT nel PASSATO, così `unlocksToday=0`) + `['lessonsPerDay', UID]` (default 1), con nuove opzioni `lessonsPerDay?`/`unlockedTodayCount?`. **Aggiungere** il `describe` 3.17.
- `src/features/settings/LessonsPerDayOptions.tsx` -- **NUOVO**. Presentazionale, mirror di `LanguageOptions.tsx`: `role="group"`, `aria-labelledby="lessons-per-day-label"`, un bottone per `LESSONS_PER_DAY_OPTIONS` con `aria-pressed={value === current}`, testo `t('settings.lessonsPerDay.option', { value })`, solo classi token.
- `src/features/settings/changeLessonsPerDay.ts` -- **NUOVO**. Mirror di `changeLocale.ts`: `changeLessonsPerDay(value, { apply, settings })` — `apply(value)` (ottimistico) PRIMA, poi `await settings.saveLessonsPerDay(value)`; confine totale.
- `src/features/settings/changeLessonsPerDay.test.ts` -- **NUOVO**. Mirror di `changeLocale.test.ts` (ordine apply→persist; persistenza best-effort; nessun reject).
- `src/features/settings/SettingsScreen.tsx:24-51` -- aggiungere prop `userId`; `useQuery(['lessonsPerDay', userId])`; `current = data ?? DEFAULT_LESSONS_PER_DAY`; rendere `<LessonsPerDayOptions>` dopo `<LanguageOptions>`; `onSelect` ⇒ `changeLessonsPerDay(v, { apply: (val) => queryClient.setQueryData(['lessonsPerDay', userId], val), settings })`.
- `src/features/settings/SettingsScreen.test.tsx` -- `inertSettings` acquisisce i due nuovi metodi; passare `userId`; **aggiungere** test: opzioni tetto rese con `aria-pressed` sul corrente; ESATTAMENTE due `role="group"` (AC4); chiavi i18n presenti.
- `src/app/AuthenticatedShell.tsx:59-60` -- `<DashboardScreen userId={userId} settings={settings} />` e `<SettingsScreen settings={settings} userId={userId} />`.
- `src/app/main.tsx:55-60` -- **nessuna modifica** (`settings` già propagato via prop; `ports` invariato).
- `src/features/ports/PortsContext.tsx:28-33` -- **nessuna modifica** (`settings` NON entra in `Ports`).
- `src/app/AppRoutes.test.tsx:33-47,66`, `src/app/AuthenticatedShell.test.tsx:21-33,46`, `src/app/AuthRoot.test.tsx:29-43` -- `inertSettings` +2 metodi; `progress` letterale rinominato; dove seminano `['unlocked']` ⇒ `UnlockedLesson[]`; dove rendono la dashboard caricata (AppRoutes/AuthenticatedShell) **seminare** anche `['lessonsPerDay', UID]` (evita lo scheletro). AuthRoot rende `checking`: solo type-fix dei letterali.
- `src/features/ports/PortsContext.test.tsx:57-60,121-125` -- `inMemoryProgress` rinomina il metodo, `sampleUnlocked` diventa `UnlockedLesson[]`, aggiornare l'asserzione a `listUnlockedLessons()`.
- `src/i18n/en.ts:33-79,80-87`, `src/i18n/it.ts:27-73,74-81` -- **aggiungere** `dashboard.dailyLimitReachedBody` (con `{{limit}}`) e `settings.lessonsPerDay` (`{ label, option }`, `option` con `{{value}}`) in ENTRAMBI (parità; `en` ASCII; niente `!`/possessivo).

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/20260925160000_add_lessons_per_day_to_user_settings.sql` -- creare la migrazione `ALTER TABLE` additiva.
- `src/domain/calendarDay.ts` + `src/domain/streak.ts` -- estrarre `localDayOrdinal`/`MS_PER_DAY` e importarli in `streak`.
- `src/domain/unlockPace.ts` (+ `unlockPace.test.ts`) -- default, opzioni, `unlocksToday`, `dailyUnlockLimitReached` con test degli edge (fuso/DST/uguaglianza cap).
- `src/domain/ports/progressRepository.ts` + `src/data/progressRepository.ts` (+ `progressRepository.test.ts`) -- rinominare a `listUnlockedLessons`/`UnlockedLesson`, portare `unlocked_at`, guardia + `DataError`.
- `src/domain/ports/settingsRepository.ts` + `src/data/settingsRepository.ts` (+ `settingsRepository.test.ts`) -- `load/saveLessonsPerDay` come mirror del locale (upsert diretto, confine totale, guardia numero).
- `src/features/settings/{LessonsPerDayOptions.tsx, changeLessonsPerDay.ts, SettingsScreen.tsx}` (+ `changeLessonsPerDay.test.ts`, `SettingsScreen.test.tsx`) -- gruppo opzioni, orchestrazione, wiring query + ESATTAMENTE due gruppi.
- `src/features/dashboard/DashboardScreen.tsx` (+ `DashboardScreen.test.tsx`) -- prop `settings`, query tetto nel cancello scheletro, `capReached` nel blocco azione, read-model rinominato.
- `src/app/AuthenticatedShell.tsx` -- inoltrare `settings` alla dashboard e `userId` a Impostazioni.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- chiavi nuove in parità.
- `src/migrations.test.ts` -- `describe` strutturale per la nuova migrazione.
- Test letterali di app/ports -- allineare `progress`/`inertSettings`/seed (`['unlocked']` shape, `['lessonsPerDay']`).

**Acceptance Criteria:**
- **AC1 — Migrazione.** *Given* la nuova migrazione, *when* è parsata (offline, AD-12/13), *then* è un `ALTER TABLE user_settings ADD COLUMN lessons_per_day int not null default 1`, con timestamp > `20260925150000`, e nient'altro; il test `user_settings` esistente resta verde.
- **AC2 — Persistenza upsert.** *Given* Impostazioni con l'utente autenticato, *when* sceglie un valore, *then* `saveLessonsPerDay` fa `upsert({ user_id, lessons_per_day })` sulla tabella (mai RPC), risolve sempre `void`; senza sessione è no-op; `loadLessonsPerDay` ritorna il numero o `null`.
- **AC3 — Tetto raggiunto.** *Given* `count === 0`, `next !== null` e `unlocksToday ≥ cap`, *when* la dashboard è resa, *then* NON rende `unlockAction` né alcun `<button>`, ma `dailyLimitReachedBody` che dichiara il tetto (`{{limit}}`=cap), che riapre a mezzanotte, e rimanda a Impostazioni; con `unlocksToday < cap` rende ancora `unlockAction`.
- **AC4 — Esattamente due impostazioni.** *Given* `SettingsScreen`, *when* è resa, *then* contiene ESATTAMENTE due gruppi (`role="group"`): lingua e tetto; la cancellazione account resta la sua sezione separata.
- **AC5 — Confini / celebrazione / regressione.** *Given* il diff, *then* nessun import di `data` in `features`; dominio puro (nessun `Date.now()`/`Intl…resolvedOptions()`); parità en/it verde, `en` ASCII, copy senza `!`/possessivo; rami `count > 0`, primo-avvio (3.15) e dichiarazioni 3.16 invariati; `npm run lint`/`typecheck`/`test`/`validate-content` verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 0
- reject: 12: (high 0, medium 0, low 12)
- addressed_findings:
  - `[low]` `[patch]` `loadLessonsPerDay` (`src/data/settingsRepository.ts`) difendeva solo `typeof === 'number'`: un `0`/negativo scritto out-of-band (colonna `int` senza check) rendeva `cap = 0` ⇒ `dailyUnlockLimitReached` sempre vero ⇒ softlock del cancello di sblocco. Guardia stretta a intero `>= 1` (altrimenti `null` ⇒ `DEFAULT_LESSONS_PER_DAY`); +3 test (`0`, `-1`, `2.5`). Il confine di lettura ora impone l'invariante come già faceva la scrittura.
  - `[low]` `[patch]` Docstring stantia di `lastUnlockedLesson` (`src/domain/curriculum.ts`): «senza bisogno di `unlocked_at` nel read-model» era diventata contraddittoria (il read-model 3.17 PORTA `unlocked_at`). Riformulata: la funzione resta `ordinal`-based (prefisso contiguo), non usa l'istante. Aggiornamento che le Design Notes già prescrivevano.
  - `[low]` `[patch]` Migrazione priva di nota sul backfill: aggiunto un commento SQL che dichiara che `not null default 1` popola con `1` anche le righe `user_settings` PREESISTENTI (nessuna UPDATE di backfill separata).
- reject notevoli (verificati contro il codice reale):
  - **AC3 «rimanda a Impostazioni» come prosa, non come link/navigazione** (intent-alignment): l'architettura risolve l'ambiguità — Impostazioni è una `<section>` resa SULLA STESSA pagina della dashboard (`AuthenticatedShell`), e AD-1 vieta `features/dashboard` → `features/settings`: non c'è nulla verso cui «navigare». Nominare «Impostazioni» nella copy è l'unica lettura coerente. «A mezzanotte» risponde pienamente a «quando si riapre». Nessun intent_gap.
  - **NaN/float nel valore del tetto** (edge-case-hunter, 4 varianti dedotte a una): una colonna `int` Postgres non è mai NaN/float; il solo caso reale (`0`/negativo) è coperto dalla patch della guardia di lettura.
  - **Nessun aria-live sulla dichiarazione del tetto** (blind-hunter): stesso pattern `<p>` di TUTTE le dichiarazioni dashboard (3.14/3.15/3.16); la live region `aria-live` del contratto di sessione riguarda la SESSIONE di esercizi, non la dashboard. Introdurla solo qui sarebbe incoerente e fuori scope.
  - **Nessun test d'integrazione Settings→Dashboard sulla chiave condivisa; upsert column-preservation non testato; glue `onSelect`** (blind-hunter, verification-gap): glue di click e semantica di merge Postgres, differite alla verifica live per convenzione del repo (SSR non esegue eventi), come per `changeLocale`/`saveLocale`.
  - **`calendarDay` coperto solo transitivamente; `Intl` per-elemento in `unlocksToday`; id statico `lessons-per-day-label`; parità `{{limit}}` non testata; scheletro attende il tetto; «mezzanotte» vs fuso; `apply` throw** (blind-hunter): estrazione verbatim doppiamente coperta (streak + unlockPace); pattern perf già accettato in `streak`; id sicuro sotto l'assunzione di render singolo (ereditato da `LanguageOptions`); scelta di design documentata; `systemClock` usa il fuso del dispositivo (nessuna divergenza); mirror del confine totale di `changeLocale`.
  - **Commento stantio `listUnlockedLessonIds` in `DashboardScreen.test.tsx:420`** (verification-gap): commento cosmetico, nessun effetto a runtime; la correttezza del rename è pienamente coperta.

## Design Notes

**Read-model UNICO invece di doppia lettura.** Il tetto ha bisogno degli istanti di sblocco; `next`/`lastUnlocked` degli id. Si potrebbe aggiungere un secondo metodo/chiave per gli istanti, ma leggerebbe `lesson_progress` due volte e i due insiemi potrebbero divergere (uno letto prima di uno sblocco, uno dopo): il cancello mostrerebbe `unlockAction` mentre `unlocksToday` è stale. Un solo `listUnlockedLessons(): UnlockedLesson[]` è la sorgente unica: id e istanti concordano sempre. La docstring di `lastUnlockedLesson` va aggiornata (il read-model ora PORTA `unlocked_at`, ma quella funzione resta basata su `ordinal`, non ne ha bisogno).

**«Riapre a mezzanotte» senza formattare un timestamp.** Il tetto si azzera all'inizio del giorno locale successivo = mezzanotte nel fuso dell'utente. «A mezzanotte» è sempre corretto (a differenza di «domani», falso alle 23) e non richiede formattazione di data nella UI. Il cancello usa lo stesso confine di `unlocksToday` (`localDayOrdinal(now, timeZone)`), coerente con la copy.

**`{{limit}}`/`{{value}}`, mai `{{count}}`.** i18next tratta `count` come chiave di pluralizzazione (richiederebbe `_one`/`_other`, fuori dalla parità ricorsiva). Come `streakLabel` usa `{{days}}`, qui si usano `{{limit}}` e `{{value}}`: interpolazione semplice, «{{value}} per day»/«al giorno» grammaticale per ogni N.

**`settings` resta una prop, non entra in `Ports`.** `Ports` è per il ciclo profondo (dashboard→sessione→card); `settings` è iniettato come prop fin da 1.9 (AuthRoot boot + SettingsScreen). Aggiungerlo a `Ports` lo esporrebbe due volte (prop + contesto) o imporrebbe un rework del flusso locale/boot. Si estende la catena prop di UN salto (shell→dashboard), coerente con `userId` (già prop della dashboard). Dashboard e Impostazioni condividono la STESSA chiave `['lessonsPerDay', userId]` (stesso adattatore in `main.tsx`): un cambio in Impostazioni (`setQueryData` ottimistico) si riflette subito nel cancello.

**Niente `check` sul valore.** Come `locale`, la tabella resta minima; l'invariante `≥ 1` è imposta al confine (opzioni UI = `LESSONS_PER_DAY_OPTIONS`, tutte ≥ 1). Un `check` non è richiesto dall'AC e accoppierebbe lo schema alla scelta di prodotto.

**Esempio del cancello azione (dashboard):**
```tsx
{count > 0 ? (
  <button /* primaryAction, invariato */ />
) : next !== null ? (
  capReached ? (
    <p className="text-body text-ink-primary">
      {t('dashboard.dailyLimitReachedBody', { limit: cap })}
    </p>
  ) : (
    <button /* unlockAction, invariato */ />
  )
) : null}
```

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (chiavi i18n nuove tipizzate; `UnlockedLesson`; nuovi metodi del port).
- `npm run lint` -- expected: exit 0 (`features` non importa `data`; dominio senza global temporali; boundaries verdi).
- `npm test` -- expected: exit 0 (AC1 migrazione; AC2 upsert; AC3 tetto; AC4 due gruppi; `unlockPace` edge; parità en/it; nessuna regressione a 3.12/3.13/3.14/3.15/3.16, app e ports).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

## Auto Run Result

Status: done

**Sintesi del cambiamento.** La storia 3.17 consegna il tetto giornaliero di sblocco (FR6.5/FR6.6). (1) Una migrazione additiva aggiunge `user_settings.lessons_per_day int not null default 1` (backfill delle righe esistenti a 1). (2) Il port `SettingsRepository` acquisisce `load/saveLessonsPerDay`, mirror del locale (upsert diretto di `{ user_id, lessons_per_day }`, confine totale; la lettura degrada a `null` — quindi a `DEFAULT_LESSONS_PER_DAY` — per qualunque valore non intero `>= 1`). (3) Il progresso passa a un read-model UNICO `listUnlockedLessons(): UnlockedLesson[]` (`{ lessonId, unlockedAt }`), sorgente sola di id (per `next`/`lastUnlocked`) e istanti (per il tetto). (4) Il dominio puro `unlockPace.ts` (`unlocksToday`, `dailyUnlockLimitReached`, `DEFAULT_LESSONS_PER_DAY`, `LESSONS_PER_DAY_OPTIONS`) con confine di giornata a mezzanotte nel fuso, riusando `localDayOrdinal` estratto in `calendarDay.ts` (condiviso con `streak`). (5) Nel cancello della dashboard, a `count === 0 && next !== null && capReached` si rende `dailyLimitReachedBody` (con `{{limit}}`=tetto, «riapre a mezzanotte», rimanda a Impostazioni) e NESSUN pulsante; altrimenti `unlockAction` invariato. (6) In Impostazioni un secondo gruppo `LessonsPerDayOptions` (modello `LanguageOptions`) che persiste via `changeLessonsPerDay` (ottimistico `setQueryData` sulla chiave condivisa `['lessonsPerDay', userId]`, poi upsert best-effort); esattamente due gruppi (`role="group"`). Rami `count > 0`, primo-avvio (3.15) e dichiarazioni 3.16 invariati.

**File modificati/aggiunti:**
- `supabase/migrations/20260925160000_add_lessons_per_day_to_user_settings.sql` — NUOVO: `ALTER TABLE ... ADD COLUMN lessons_per_day int not null default 1` (+ nota sul backfill).
- `src/migrations.test.ts` — nuovo `describe` strutturale (AST `AT_AddColumn`, `int4`, not null, default `1`, timestamp > `20260925150000`, nessun check/policy).
- `src/domain/ports/progressRepository.ts` / `src/data/progressRepository.ts` (+ test) — rename `listUnlockedLessonIds` → `listUnlockedLessons`, tipo `UnlockedLesson`, `unlocked_at` portato e guardato (malformato ⇒ `DataError`).
- `src/domain/ports/settingsRepository.ts` / `src/data/settingsRepository.ts` (+ test) — `load/saveLessonsPerDay` (upsert diretto, confine totale, guardia intero `>= 1`).
- `src/domain/calendarDay.ts` (NUOVO) + `src/domain/streak.ts` — estrazione di `localDayOrdinal`/`MS_PER_DAY`.
- `src/domain/unlockPace.ts` (+ `unlockPace.test.ts`, NUOVI) — default/opzioni, `unlocksToday`, `dailyUnlockLimitReached` (edge fuso/DST/uguaglianza).
- `src/features/dashboard/DashboardScreen.tsx` (+ test) — prop `settings`, query tetto nel cancello scheletro, `capReached` nel blocco azione, read-model unico.
- `src/features/settings/{LessonsPerDayOptions.tsx, changeLessonsPerDay.ts, SettingsScreen.tsx}` (+ `changeLessonsPerDay.test.ts`, `SettingsScreen.test.tsx`) — gruppo opzioni, orchestrazione, wiring + esattamente due gruppi.
- `src/app/AuthenticatedShell.tsx` — inoltra `settings` alla dashboard e `userId` a Impostazioni.
- `src/i18n/en.ts` / `src/i18n/it.ts` — `dashboard.dailyLimitReachedBody` (`{{limit}}`) e `settings.lessonsPerDay` (`label`, `option` con `{{value}}`), parità en/it, `en` ASCII.
- Test letterali di app/ports (`AppRoutes.test.tsx`, `AuthenticatedShell.test.tsx`, `AuthRoot.test.tsx`, `PortsContext.test.tsx`) — rename metodo, seed `UnlockedLesson[]`/`['lessonsPerDay']`, `inertSettings` +2 metodi.

**Ripartizione dei finding (questa passata):** patch applicati 3 (tutti low); differiti 0; respinti 12 (low). Nessun `intent_gap`, nessun `bad_spec`, nessun loopback: `review_loop_iteration` resta 0. Le tre patch: guardia di lettura `>= 1` (anti-softlock), docstring `lastUnlockedLesson` aggiornata, commento di backfill nella migrazione.

**Raccomandazione di follow-up review:** `false`. Solo i patch di questa passata: high 0, medium 0, low 3 ⇒ punteggio `3×0 + 1×3 = 3` (< 5 e nessun high).

**Verifica eseguita (indipendente, dopo implementazione e dopo le patch):**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (`features` non importa `data`; dominio senza global temporali; boundaries verdi).
- `npm test` — exit 0 (72 file, 802 test; AC1/AC2/AC3/AC4/AC5; `unlockPace` edge; parità en/it; nessuna regressione a 3.12–3.16, app e ports).
- `npm run validate-content` — exit 0.

**Matrix Test Audit:** tutte e 10 le righe coperte da test eseguiti e verdi — tetto non raggiunto/raggiunto/parziale (>1)/valore nella copy (`DashboardScreen.test.tsx` describe 3.17); concettuale conta e confine giornata + DST (`unlockPace.test.ts`); pila piena e primo-avvio invariati (rami 3.12/3.15 esistenti); persistenza upsert + ottimistico + confine totale (`settingsRepository.test.ts` + `changeLessonsPerDay.test.ts`); lettura degradata a default (`settingsRepository.test.ts`); riga `lesson_progress` malformata ⇒ `DataError` (`progressRepository.test.ts`).

**Rischi residui.** (1) La glue `onSelect` → `setQueryData` in Impostazioni e la semantica di merge dell'upsert Postgres (preservazione di `locale` su conflitto) non sono esercitate sotto l'harness `node`/`renderToStaticMarkup`/client finto: differite alla verifica live per convenzione del repo (AD-12/13), come per `changeLocale`/`saveLocale`. (2) La migrazione si applica al merge su `main` (`migrate.yml`); i propri e2e su schema reale si vedono solo dopo il merge. Nessuna azione umana esterna al repository è dovuta.
