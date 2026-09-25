---
title: 'Story 3.10: Gli adattatori dietro le porte'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_revision: 'da101ee2cc7cd849cd9076cfc11f997881f16a18'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Il ciclo di ripasso non ha come raggiungere il database in modo testabile. Il dominio dichiara solo due porte (`ReviewRepository.listDue`, `SettingsRepository`); mancano `ContentRepository`, `ProgressRepository` e `Clock`, mancano gli adattatori Supabase per le letture del ciclo, e manca il canale per iniettare le porte in un componente. Senza questo, le schermate (3.11+) non si possono costruire né testare «senza database» (obiettivo di copertura dell'epica).

**Approach:** Dichiarare le porte mancanti nel dominio (le due esistenti restano invariate), implementare i loro adattatori Supabase in `src/data/` — l'unico livello che importa `@supabase/supabase-js` — ciascuno che lancia un `DataError` tipizzato in caso di fallimento, e aggiungere un seam di iniezione `PortsProvider`/`usePorts` (in `features`), provato da un test di componente che rende con porte finte in memoria e senza rete.

## Boundaries & Constraints

**Always:**
- Le cinque porte vivono in `src/domain/ports/` come interfacce PURE (AD-1: nessun import esterno): `Clock`, `ContentRepository`, `ReviewRepository`, `ProgressRepository`, `SettingsRepository`.
- Solo `src/data/` importa `@supabase/supabase-js` (AD-2). Ogni adattatore è una FACTORY che riceve un `SupabaseClient` iniettato, come `createSupabaseAuthGateway`/`createSupabaseSettingsRepository`.
- Gli adattatori di lettura del ciclo (`Content`/`Review`/`Progress`) LANCIANO un `DataError` tipizzato su qualunque errore Supabase o riga malformata: alimentano TanStack Query, i cui stati di errore/retry esigono un reject, non un valore degradato. `DataError` è `instanceof Error`, ha `name === 'DataError'`, porta l'`operation` fallita e preserva la causa sottostante.
- `ReviewRepository.listDue` RISPECCHIA `isDue`, non la reimplementa: l'adattatore mappa le righe in `ReviewState` e filtra con il predicato di dominio `isDue(state, now)` — l'unica autorità della dovutezza (AD-5). `now` è INIETTATO (via `Clock`), mai letto dalla piattaforma.
- `ContentRepository.listLessons` restituisce il curriculum ordinato per `ordinal`, con il titolo di ogni lezione come `BilingualText` (`en` obbligatorio, `it` OMESSO quando la colonna è `null`), RIUSANDO `bilingual.ts` (FR8.5): nessuna forma bilingue parallela.
- Il seam DI è un contesto React (`PortsProvider`/`usePorts`) tipizzato sulle porte di dominio, in `src/features/` (arco `features→domain` ammesso; `app` lo comporrà). `usePorts` fuori da un provider LANCIA (un provider mancante è un crash rumoroso, non un `undefined` silenzioso).
- L'adattatore di `Clock` (`systemClock`) ritorna `new Date()` e vive in `src/data/` (`new Date()` è vietato solo sotto `src/domain/`).

**Block If:**
- _Nessun blocco._ È plumbing puramente additivo sopra uno schema e un pattern d'iniezione già stabiliti; confinamento, `DataError` e iniezione sono tutti fissati da AD-1/AD-2/architettura.

**Never:**
- NESSUN adattatore di SCRITTURA in questa storia: il chiamante della RPC `apply_review` (AD-7, `applyReview`) e lo sblocco lezione (materializzazione, AD-19) nascono con le loro storie di schermata (3.19, 3.13). Qui solo le LETTURE che rendono il ciclo testabile senza DB.
- NON toccare i contratti a CONFINE TOTALE di `AuthGateway`/`AccountGateway`/`SettingsRepository` (non lanciano mai — traduzione errori FR1.5, ripiego i18n). `DataError` governa SOLO le nuove porte-repository del ciclo, non un retrofit degli adattatori a confine totale esistenti.
- NON cablare `PortsProvider` in `main.tsx`: nessun componente di produzione lo consuma finché non arriva la dashboard (3.12); il cablaggio alla composition root nasce col primo consumatore (dichiarazione-in-anticipo, come `reviewRepository` fu fissata prima del suo adattatore).
- Nessuna nuova tabella/migrazione/modifica di dominio; nessuna lettura esercizio-per-id (la aggiungono le storie di sessione); nessun filtro di dovutezza server-side che scavalchi `isDue`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| listLessons ok | righe `lesson` | `readonly LessonSummary[]` ordinate per `ordinal`; `title` bilingue (`it` omesso se `null`) | nessun errore |
| listLessons errore Supabase | `{ error }` | lancia `DataError('listLessons', error)` | reject, non valore degradato |
| listDue misto | righe `review_state`, `now` | SOLO le righe con `isDue(state, now)` vero, mappate in `ReviewState` (`due_at`/`last_reviewed_at`→`Date`) | nessun errore |
| listDue errore Supabase | `{ error }` | lancia `DataError('listDue', error)` | reject |
| listUnlockedLessonIds ok | righe `lesson_progress` | `readonly string[]` dei `lesson_id` | nessun errore |
| listUnlockedLessonIds errore | `{ error }` | lancia `DataError('listUnlockedLessonIds', error)` | reject |
| Clock.now | `systemClock` | una `Date` (`new Date()`) | nessun errore |
| test di componente | porte in memoria via `PortsProvider` | il Probe rende `clock.now()`; le porte-repository iniettate sono le istanze in memoria; le loro letture risolvono SENZA rete | `usePorts` fuori dal provider lancia |

</intent-contract>

## Code Map

- `src/domain/ports/reviewRepository.ts` -- porta ESISTENTE `ReviewRepository.listDue(now): Promise<readonly ReviewState[]>` (righe 15-24); INVARIATA. Modello di docblock per le porte nuove.
- `src/domain/ports/settingsRepository.ts` -- porta ESISTENTE a confine totale (non lancia mai): l'eccezione DELIBERATA che `DataError` NON deve retrofittare. Invariata.
- `src/domain/ports/authGateway.ts`, `accountGateway.ts` -- porte ESISTENTI a confine totale; il contrasto contro cui `DataError` è definito.
- `src/domain/schedule.ts:40` -- `ReviewState` (`exerciseId, stage, dueAt, reviewCount, lapseCount, lastReviewedAt`), ciò che `listDue` restituisce. `:31` `ReviewOutcome`.
- `src/domain/due.ts:26` -- `isDue(state, now)`: l'UNICA autorità della dovutezza che `listDue` rispecchia (AD-5). `:44` `dueQueryKey`.
- `src/domain/bilingual.ts:19-25` -- `bilingualText`/`BilingualText` (`{ en: string; it?: string }`): la forma del `title` che `listLessons` riusa (FR8.5).
- `src/domain/lesson.ts`, `exercise.ts` -- forme di contenuto del dominio (NON restituite grezze; `listLessons` ritorna un `LessonSummary` snello).
- `src/data/settingsRepository.ts`, `authGateway.ts` -- il PATTERN factory `createSupabase*(client)` da rispecchiare; entrambi INGOIANO gli errori (confine totale) — i nuovi adattatori invece LANCIANO `DataError`.
- `src/data/supabaseClient.ts:31` -- `createSupabaseClient` / tipo `SupabaseClient`, punto d'iniezione.
- `supabase/migrations/20260925101500_create_review_and_progress.sql:29-70` -- colonne di `review_state` e `lesson_progress` che gli adattatori leggono (isolate per riga da RLS).
- `supabase/migrations/20260925090000_create_lesson_and_exercise.sql:32-38` -- colonne `lesson` (`id, ordinal, title_en, title_it, grammar_points`).
- `supabase/migrations/20260925140000_create_apply_review.sql` -- la RPC il cui chiamante client è DIFFERITO a 3.19.
- `src/features/settings/SettingsScreen.test.tsx` -- il PATTERN del test di componente da rispecchiare: `renderToStaticMarkup` + porta inerte in memoria, ambiente `node`, nessun jsdom. Nota `import { it as itCatalog }` per non collidere con l'`it` di vitest.
- `src/service-role-confinement.test.ts` -- il PATTERN di test a scansione sorgente (`node:fs`, `stripComments`, anti-vacuità) per i test AC1/AC2.
- `src/boundaries.test.ts:63-69` + `eslint.config.js:102-117` -- `boundaries/external` blocca gli esterni SOLO da `domain`: la regola «solo data importa supabase-js» NON è imposta da ESLint, da qui il test a scansione di AC2.
- `vitest.config.ts` -- `environment: 'node'`, include `.test.tsx`.

## Tasks & Acceptance

**Execution:**
- `src/domain/ports/clock.ts` -- **creare**. `export interface Clock { now(): Date }` con docblock nello stile delle altre porte (pura, nessun import esterno, solo `data` la implementa). Il seam per ottenere «now» senza che il dominio legga l'orologio (AD-1).
- `src/domain/ports/contentRepository.ts` -- **creare**. `export interface LessonSummary { id: string; ordinal: number; title: BilingualText; grammarPoints: readonly string[] }` (import type `BilingualText` da `'../bilingual'`) e `export interface ContentRepository { listLessons(): Promise<readonly LessonSummary[]> }`. Contenuto in sola lettura (tabelle di 3.7).
- `src/domain/ports/progressRepository.ts` -- **creare**. `export interface ProgressRepository { listUnlockedLessonIds(): Promise<readonly string[]> }`. Legge `lesson_progress` (curriculum sbloccato).
- `src/data/dataError.ts` -- **creare**. `export class DataError extends Error` con `readonly operation: string` e causa preservata; `this.name = 'DataError'`. Il fallimento tipizzato che gli adattatori del ciclo lanciano.
- `src/data/clock.ts` -- **creare**. `export const systemClock: Clock = { now: () => new Date() }`.
- `src/data/contentRepository.ts` -- **creare**. `createSupabaseContentRepository(client): ContentRepository`. `listLessons`: `client.from('lesson').select('id, ordinal, title_en, title_it, grammar_points').order('ordinal')`; su `error` lancia `DataError('listLessons', error)`; mappa ogni riga in `LessonSummary` (`title` = `title_it != null ? { en, it } : { en }`); su riga malformata lancia `DataError`.
- `src/data/reviewRepository.ts` -- **creare**. `createSupabaseReviewRepository(client): ReviewRepository`. `listDue(now)`: seleziona le colonne di `review_state`; su `error` lancia `DataError('listDue', error)`; mappa in `ReviewState` (`due_at`/`last_reviewed_at`→`Date`); ritorna SOLO quelle con `isDue(state, now)` (autorità di dominio).
- `src/data/progressRepository.ts` -- **creare**. `createSupabaseProgressRepository(client): ProgressRepository`. `listUnlockedLessonIds`: seleziona `lesson_id` da `lesson_progress`; su `error` lancia `DataError`; mappa in `readonly string[]`.
- `src/features/ports/PortsContext.tsx` -- **creare**. `export interface Ports { clock: Clock; content: ContentRepository; review: ReviewRepository; progress: ProgressRepository }`; `PortsProvider` (provider di contesto); `usePorts()` che LANCIA fuori dal provider. Il seam d'iniezione per le schermate del ciclo (3.11+).

**Test (righe della I/O Matrix + AC1/AC2/AC3):**
- `src/data/dataError.test.ts` -- **creare**. `name === 'DataError'`, `instanceof Error`, porta `operation` e causa.
- `src/data/contentRepository.test.ts` -- **creare**. Client finto; happy path mappa le righe + omette `it` quando `null` + ordina per `ordinal`; errore Supabase → `DataError('listLessons')`; riga malformata → `DataError`.
- `src/data/reviewRepository.test.ts` -- **creare**. Client finto; `listDue` mappa in `ReviewState` e ritorna SOLO le dovute (mix di dovute/non-dovute AL CONFINE, stesso `<=` di `isDue`); errore Supabase → `DataError('listDue')`.
- `src/data/progressRepository.test.ts` -- **creare**. Client finto; ritorna gli id lezione; errore Supabase → `DataError`.
- `src/features/ports/PortsContext.test.tsx` -- **creare**. `renderToStaticMarkup(<PortsProvider value={porteInMemoria}><Probe/></PortsProvider>)`: il Probe rende `clock.now()`; asserisce che il markup mostra il `now` fisso, che le porte-repository iniettate sono le istanze in memoria e che le loro letture risolvono ai dati delle finte SENZA rete (spia su `globalThis.fetch` mai chiamata); `usePorts` fuori dal provider lancia.
- `src/ports-surface.test.ts` -- **creare** (AC1). Scandisce `src/domain/ports/*.ts`; pretende `export interface` per ciascuna di `Clock`, `ContentRepository`, `ReviewRepository`, `ProgressRepository`, `SettingsRepository`; anti-vacuità (cartella non vuota).
- `src/supabase-confinement.test.ts` -- **creare** (AC2). Scandisce `src/**/*.{ts,tsx}` (esclude `*.test.*`, strippa i commenti); ogni file che importa `@supabase/supabase-js` è sotto `src/data/`; anti-vacuità (≥1 file `data` lo importa).

**Acceptance Criteria:**
- **AC1 — Porte dichiarate.** *Given* `src/domain/ports/`, *when* la si ispeziona, *then* dichiara le interfacce `Clock`, `ContentRepository`, `ReviewRepository`, `ProgressRepository`, `SettingsRepository`; `ports-surface.test.ts` va rosso se una viene rinominata/rimossa.
- **AC2 — Adattatori data-only che lanciano DataError.** *Given* `src/data/`, *when* la si ispeziona, *then* è l'UNICA cartella che importa `@supabase/supabase-js` (`supabase-confinement.test.ts`) e i suoi adattatori del ciclo lanciano un `DataError` tipizzato in caso di fallimento (test degli adattatori).
- **AC3 — Test di componente con porte in memoria, senza rete.** *Given* `PortsProvider`, *when* un test di componente inietta implementazioni in memoria delle porte e rende (`renderToStaticMarkup`), *then* il componente legge le porte iniettate senza alcuna chiamata di rete, e `usePorts` fuori da un provider lancia.

## Spec Change Log

_Nessun loopback bad_spec: la spec non è stata emendata._

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 0, low 4)
- defer: 0
- reject: 11: (high 0, medium 0, low 11)
- addressed_findings:
  - `[low]` `[patch]` Una riga `null`/non-oggetto restituita da Supabase lanciava un `TypeError` grezzo invece di `DataError`, violando il contratto «riga malformata ⇒ DataError» della I/O Matrix. Aggiunta una guardia null/non-oggetto in testa a ciascun mapper (`toLessonSummary`, `toReviewState`, il callback di `listUnlockedLessonIds`) che lancia il `DataError` con l'operazione corretta.
  - `[low]` `[patch]` La guardia del timestamp non parsabile in `listDue` (`Number.isNaN(getTime())`) esisteva ma non era testata. Aggiunti casi `due_at: 'not-a-date'` e `last_reviewed_at: 'nope'` (stringa non parsabile) ⇒ `DataError`, più `data` null ⇒ `[]`.
  - `[low]` `[patch]` Rami di `toLessonSummary` non testati (`title_it` non-null non-stringa, `ordinal`/`id` malformati, riga `null`). Aggiunti test ⇒ `DataError`.
  - `[low]` `[patch]` `listUnlockedLessonIds`: `data` null ⇒ `[]` e riga `null` ⇒ `DataError` non erano coperti. Aggiunti.
- reject notevoli (verificati contro il codice reale): (1) tipi `uuid` vs slug per gli id — l'identità di keyspace fra `LessonSummary.id` e `lesson_progress.lesson_id` è GARANTITA dalla FK `lesson_progress.lesson_id → lesson(id)` di 3.8, non implicita; (2) fake client non condivisi / possibile drift dalla forma del query-builder — è lo stile del repo (anche `settingsRepository.test.ts` ha il proprio fake) e la firma è comunque imposta da `tsc`; (3) `isUnderData` con `startsWith('/')` morto su Windows — ramo innocuo, la guardia `..` copre il caso reale; (4) assenza di gate per «non cablato in `main.tsx`» — vincolo TEMPORANEO che la storia 3.12 violerà DI PROPOSITO, un gate sarebbe controproducente; (5) `ports-surface.test.ts` è un check di NOME non di forma — la forma dei contratti è imposta da `tsc` + i test degli adattatori che consumano le interfacce; (6) `now` invalido che maschera il fallimento in `listDue` — `Clock` produce sempre una `Date` valida (`systemClock` = `new Date()`, i test un istante fisso), nessun percorso realistico; (7) `grammarPoints` vuoto — la non-vuotezza è imposta a monte dal dominio (2.1) e dal cancello del seed (2.6), non dall'adattatore; (8) flakiness del test di monotonicità del clock — probabilità di step-back dell'orologio fra due letture sincrone adiacenti trascurabile; (9) `ordinal` negativo/`NaN`/duplicato — impediti dai vincoli `int not null`/`unique` del DB (3.7); (10) commenti che confondono porte nuove vs preesistenti — l'Intent dello spec è accurato; (11) intent-alignment sulla lettura di AC2 (tutte le porte vs solo quelle del ciclo) — descrittivo, conferma la carve-out GIÀ documentata nello spec (le porte a confine totale auth/settings/account non sono retrofittate, per design pregresso).

## Design Notes

**Perché `DataError` per le porte del ciclo ma confine totale per auth/settings.** Le porte di lettura alimentano TanStack Query, i cui stati errore/retry/loading sono GUIDATI da una promise rifiutata: un valore degradato (`null`/`[]`) si spaccerebbe per «caricato, vuoto» e nasconderebbe un fallimento reale. Auth/settings ingoiano di proposito (FR1.5 mappa a `reason` di dominio; i18n ripiega) — lavori diversi, contratti diversi. Perciò `DataError` NON è retrofittato sugli adattatori a confine totale esistenti: questo scioglie la tensione apparente nel testo di AC2.

**Perché `listDue` filtra con `isDue` invece di una `.lte` SQL.** AD-5 fissa UNA sola definizione di dovutezza; l'adattatore la rispecchia CHIAMANDO `isDue`, così un futuro cambio del confine (incluso vs escluso) non può divergere fra DB e dominio. Lo `review_state` di un utente è limitato ai suoi esercizi sbloccati, quindi fetch-poi-filtro è accettabile; spingere `.lte('due_at', now)` server-side è un'ottimizzazione futura che DEVE mantenere `isDue` autoritativo.

**Perché un seam a contesto invece del prop-drilling.** Auth usava le props perché il suo albero è basso (`AuthRoot`→`AppRoutes`). Il ciclo di ripasso (dashboard→sessione→card, 3.11-3.23) è profondo; passare 4 porte come props è rumore. `PortsProvider`/`usePorts` è il punto d'iniezione unico; la composition root (`main.tsx`) fornirà gli adattatori Supabase quando arriva il primo consumatore (3.12). `usePorts` lancia fuori dal provider, così un provider mancante è un crash rumoroso.

**Forma d'oro (mappatura `LessonSummary`):** `title = row.title_it != null ? { en: row.title_en, it: row.title_it } : { en: row.title_en }`.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0 (archi AD-1 intatti; le porte di dominio non importano esterni; `features` importa `react` + `domain`; `data` importa supabase; nessun colore letterale).
- `npm run typecheck` -- expected: exit 0 (`tsc --noEmit`; `strict` + `noUnusedLocals`/`noUnusedParameters`: nessun import/parametro pendente).
- `npm test` -- expected: exit 0 (nuovi test adattatori/contesto/superficie/confinamento verdi; `boundaries` «scaffold pulito» resta 0 errori).
- `npm run validate-content` -- expected: exit 0 (cancello FR2.6 non regredito).

## Auto Run Result

Status: done

**Sintesi del cambiamento.** La storia 3.10 aggiunge il lato di LETTURA che permette al ciclo di ripasso di raggiungere il database in modo testabile. Tre nuove porte di dominio PURE (`Clock`, `ContentRepository`, `ProgressRepository`; `ReviewRepository`/`SettingsRepository` esistevano già), i loro adattatori Supabase in `src/data/` (l'unico livello che importa `@supabase/supabase-js`) che LANCIANO un `DataError` tipizzato in caso di fallimento — l'opposto deliberato del confine totale di auth/settings — e un seam d'iniezione `PortsProvider`/`usePorts` in `src/features/`, provato da un test di componente che rende con porte in memoria e senza rete. `listDue` rispecchia `isDue` (autorità di dominio AD-5) invece di reimplementare la dovutezza; `listLessons` riusa `BilingualText` (FR8.5); `systemClock` è l'unico `new Date()` e vive in data. Cablaggio in `main.tsx` e adattatori di scrittura (RPC `apply_review`, sblocco) differiti alle loro storie consumatrici (3.12/3.13/3.19).

**File creati (esecuzione):**
- `src/domain/ports/clock.ts` — porta `Clock { now(): Date }`.
- `src/domain/ports/contentRepository.ts` — `LessonSummary` + `ContentRepository { listLessons() }`, titolo `BilingualText`.
- `src/domain/ports/progressRepository.ts` — `ProgressRepository { listUnlockedLessonIds() }`.
- `src/data/dataError.ts` — `DataError extends Error` (`name === 'DataError'`, porta `operation`, preserva `cause`).
- `src/data/clock.ts` — `systemClock`.
- `src/data/contentRepository.ts`, `reviewRepository.ts`, `progressRepository.ts` — adattatori Supabase factory-iniettati che lanciano `DataError` su errore/riga malformata.
- `src/features/ports/PortsContext.tsx` — `Ports`, `PortsProvider`, `usePorts()` (lancia fuori dal provider).

**File di test creati:**
- `src/data/dataError.test.ts`, `clock.test.ts`, `contentRepository.test.ts`, `reviewRepository.test.ts`, `progressRepository.test.ts`, `src/features/ports/PortsContext.test.tsx`, `src/ports-surface.test.ts` (AC1), `src/supabase-confinement.test.ts` (AC2).

**Ripartizione dei finding (questa passata):** patch applicati 4 (tutti low); differiti 0; respinti 11. Nessun `intent_gap`, nessun `bad_spec`, nessun loopback: `review_loop_iteration` resta 0. I patch hanno aggiunto una guardia null/non-oggetto nei tre mapper (allineamento al contratto «malformata ⇒ DataError») e chiuso lacune di test su guardie/rami già presenti.

**Raccomandazione di follow-up review:** `false`. Solo i patch di questa passata contano: high 0, medium 0, low 4 ⇒ punteggio `3×0 + 1×4 = 4` (< 5 e nessun high).

**Verifica eseguita (dopo i patch, exit 0):**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (archi AD-1 intatti; porte senza import esterni; `data` importa supabase; `features` importa react + domain).
- `npm test` — exit 0 (67 file, 655 test verdi).
- `npm run validate-content` — exit 0 (cancello FR2.6 non regredito).

**Rischi residui.** Gli adattatori sono verificati con un `SupabaseClient` FINTO (per forma della chiamata e mappatura), senza rete né DB reale — l'effetto contro il progetto Supabase reale (RLS, tipi timestamptz, forma effettiva del query-builder) è verifica live differita (operatore), coerente con gli adattatori esistenti (auth/settings). Il `PortsProvider` non ha ancora un consumatore di produzione: il cablaggio in `main.tsx` nasce con la dashboard (3.12). Esiste un edge latente (fuori portata) in `service-role-confinement.test.ts`: il suo comment-strip usa `/\/\/.*$/`, che con line-ending CRLF potrebbe lasciar passare un token a fine riga; il nuovo `supabase-confinement.test.ts` usa invece `/\/\/[^\r\n]*/` e non ne è affetto.
