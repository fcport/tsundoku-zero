---
title: 'Story 3.8: Il progresso è per-utente e resta per-utente'
type: 'feature'
created: '2026-09-25'
status: done
baseline_revision: 'beb3e055ca1dd9a40748324daa0d9f9e5da17cc9'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Prova RLS a runtime (AC5, seconda clausola): dimostrare esplicitamente, per
      ciascuna delle tre tabelle, che l'utente A non legge né scrive le righe di B
      MENTRE entrambi gli account sono vivi; più il comportamento append-only a
      runtime di review_log (il proprietario non può update/delete le proprie righe).
    evidence: |-
      La prova a runtime richiede le migrazioni APPLICATE al progetto reale (solo
      al merge su main, AD-12/AD-13), due account reali con email univoca per run
      e teardown via l'Edge Function delete-account (AD-11/AD-13). Il progetto
      vieta l'istanza Supabase locale e non ha ancora infrastruttura Playwright.
      Ciò che questa storia verifica meccanicamente OFFLINE (pg-query-emscripten):
      RLS abilitata su tutte e tre le tabelle, le policy owner-scoped (4/4/2), la
      cascata su auth.users e l'assenza di policy update/delete su review_log — la
      condizione strutturale NECESSARIA, non l'effetto osservato a query time.
      ATTENZIONE all'instradamento: l'isolamento A↔B a runtime è NFR5 e appartiene
      alla suite e2e (Playwright) introdotta in Epic 7 (storia 7.4). NON è la 7.5,
      i cui AC riguardano il teardown dopo cancellazione account (assenza di righe
      per tabella), una proprietà diversa. Oggi né 7.4 né 7.5 dichiarano un AC
      esplicito «A legge/scrive le righe di B ⇒ fallisce, per ciascuna tabella»:
      questa obbligazione va aggiunta esplicitamente a Epic 7 (7.4/NFR5), altrimenti
      resta senza proprietario. Stesso schema del live differito di 1.5.
    location: >-
      supabase/migrations/*_create_review_and_progress.sql + src/migrations.test.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Il ciclo di ripasso ha il motore di dominio (scheduling, esito, dovuto, streak) ma non ha ancora dove SCRIVERE il progresso. Servono le tre tabelle per-utente — `review_state` (stato SRS corrente), `review_log` (storia append-only, fonte delle statistiche), `lesson_progress` (curriculum sbloccato) — nate isolate per riga (RLS `user_id = auth.uid()`), così che lo schema pubblico non sia una porta aperta sui dati di studio altrui.

**Approach:** Una migrazione versionata crea le tre tabelle con lo schema canonico della spine, RLS abilitata e policy owner-scoped modellate su `user_settings`. Il `CHECK` su `review_state.stage` e quello su `review_log.outcome` NON sono elenchi paralleli: derivano dalla scala Leitner (`AD-17`) e dalla union `ReviewOutcome` del dominio, e un test offline lo dimostra confrontando l'SQL con le costanti di `src/domain/schedule.ts`. La verifica strutturale è offline (`pg-query-emscripten`), come per ogni migrazione (AD-12/AD-13).

## Boundaries & Constraints

**Always:**
- Le tre tabelle nascono con lo schema canonico della spine (§ Design Notes). `user_id uuid` con FK `references auth.users (id) on delete cascade` su **tutte e tre** (AD-11: tutto ciò che è per-utente cancella in cascata sull'account).
- RLS abilitata (`enable row level security`) su tutte e tre. Policy `to authenticated`, condizione `(select auth.uid()) = user_id` (sottoquery, non `auth.uid()` nudo — guida performance RLS come in `user_settings`).
- `review_state` e `lesson_progress`: **quattro** policy owner-scoped, una per operazione (select/insert/update/delete), come `user_settings`.
- `review_log` è **append-only** (AC1, FR5.6, AD-18): **solo** policy `select` e `insert` owner-scoped; **nessuna** policy `update`/`delete` — l'immutabilità è imposta dal default-deny di RLS. La cancellazione dell'account resta possibile via la cascata a livello di FK (che non passa da RLS).
- `review_state.stage`: `CHECK` sui limiti `[0, N]` con `N = LEITNER_INTERVALS_DAYS.length - 1` (oggi 5). Un test importa la costante da `src/domain/schedule.ts` e pretende che il limite superiore SQL la uguagli (drift ⇒ CI rossa).
- `review_log.outcome`: `CHECK (outcome in (...))` con **esattamente** l'insieme di `ReviewOutcome`. Un test importa il testimone runtime da `src/domain/schedule.ts` e pretende `set(SQL) === set(REVIEW_OUTCOMES)`.
- `review_log.grammar_point`: denormalizzato di proposito; un commento SQL dichiara *perché* (una statistica non può dipendere da dati mutabili che una riautorazione riscriverebbe — AD-18/AD-23). Un test pretende che questa motivazione sia presente nel file.
- Convenzione migrazioni: `supabase/migrations/YYYYMMDDHHmmss_slug.sql`, timestamp `>` `20260925090001` (l'ultima esistente). Applicazione **solo** al merge su `main` (`migrate.yml`); validazione offline in `npm test`.

**Block If:**
- _Nessun blocco._ La prova RLS a runtime (AC5, seconda clausola) NON è un blocco: è differita per architettura a Epic 7 (storia 7.5) — vedi `deferred`. I secret e la pipeline `migrate.yml` esistono già (storia 1.5), quindi l'applicazione al merge è flusso normale, non azione d'operatore.

**Never:**
- Nessuna logica di scheduling/valutazione in SQL: le tabelle sono inerti; l'RPC `apply_review` è la storia 3.9.
- Nessuna FK di contenuto su `review_log` (né su `exercise` né su altro): il log è una fonte indipendente e durevole; l'unica FK è `user_id → auth.users`. È il senso della denormalizzazione di `grammar_point`.
- Nessun `created_at`/`updated_at` né colonna oltre quelle canoniche (minimalità, come `user_settings`).
- Nessuna istanza Supabase locale nei test; nessun apply da un ramo di PR.
- Nessun cambiamento di COMPORTAMENTO al dominio: l'unica modifica a `src/domain/schedule.ts` è estrarre `REVIEW_OUTCOMES` come costante e derivarne il tipo `ReviewOutcome`, mantenendo la union identica e tutti i test verdi.
- **Fuori scope (differito):** il test di integrazione RLS *a runtime* (AC5, seconda clausola) — vedi `deferred` e Design Notes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Migrazione ben formata | i tre `create table` + RLS + policy | il parser Postgres accetta senza errori | `npm test` rosso su SQL non parsabile |
| Schema minimo | le tre `create table` | l'AST espone **esattamente** le colonne canoniche per tabella | rosso se ne compare una in più/meno |
| Cascata account | FK `user_id` di ciascuna tabella | `references auth.users (id) on delete cascade` su tutte e tre | rosso se manca su una |
| Isolamento per riga | DDL | RLS abilitata; `review_state`/`lesson_progress` 4 policy owner-scoped, `review_log` 2 (select/insert) | rosso se manca una policy dovuta |
| Append-only del log | policy di `review_log` | **zero** policy `update`/`delete` | rosso se ne compare una |
| Scala dello stadio | `CHECK` su `review_state.stage` | limite superiore `= LEITNER_INTERVALS_DAYS.length - 1` | rosso se diverge dalla scala |
| Insieme degli esiti | `CHECK` su `review_log.outcome` | `= set(REVIEW_OUTCOMES)` | rosso se i due insiemi divergono |

</intent-contract>

## Code Map

- `supabase/migrations/20260923221517_create_user_settings.sql` -- **modello** per RLS: policy per-operazione, `to authenticated`, `(select auth.uid()) = user_id`, FK cascade su `auth.users`.
- `supabase/migrations/20260925090000_create_lesson_and_exercise.sql` -- crea `lesson (id text pk)` ed `exercise (id uuid pk)`: bersagli delle FK di contenuto (`lesson_progress.lesson_id → lesson`, `review_state.exercise_id → exercise`). La migrazione nuova gira dopo questa (timestamp maggiore).
- `src/domain/schedule.ts:18` -- `export type ReviewOutcome = 'again' | 'hard' | 'good' | 'easy'` (da rifondare su una costante). `:42` -- `LEITNER_INTERVALS_DAYS = [0,1,3,7,16,35]`, stadi 0–5 (AD-17): fonte del `CHECK` su `stage`.
- `src/domain/schedule.ts:27-34` -- `interface ReviewState` (`stage`, `dueAt`, `reviewCount`, `lapseCount`, `lastReviewedAt: Date | null`): guida colonne/nullabilità di `review_state`.
- `src/domain/outcome-sole-authority.test.ts:34` -- la sonda intercetta SOLO `return '<esito>'`: una `const REVIEW_OUTCOMES = ['again',...]` NON la fa scattare (verificato). Aggiungere la costante è sicuro.
- `src/migrations.test.ts` -- **da estendere**: validazione offline via `pg-query-emscripten`, asserzioni strutturali via AST + testo, `stripSqlComments`. Modello dei nuovi test (vedi il blocco `lesson`/`exercise` :320-449). I `*.test.ts` sono esclusi da `boundaries` (import da `src/domain` e `node:*` ammessi).
- `_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-09-22/SPINE-DELTA.md:159-197` -- schema canonico delle tre tabelle + nota sulla denormalizzazione di `grammar_point`.
- `_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-08-19/ARCHITECTURE-SPINE.md:121,169,294` -- RLS su tutte le per-utente (AD-10), log append-only fonte unica delle statistiche (AD-18), cascata su `auth.users` (AD-11).

## Tasks & Acceptance

**Execution:**
- `src/domain/schedule.ts` -- introdurre `export const REVIEW_OUTCOMES = ['again', 'hard', 'good', 'easy'] as const;` accanto a `LEITNER_INTERVALS_DAYS`, e ridefinire `export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];`. La union risultante è identica: `OUTCOME_FACTOR`, lo `switch` e ogni consumatore restano validi. È il testimone runtime richiesto da AC4.
- `supabase/migrations/20260925101500_create_review_and_progress.sql` -- **creare**. Le tre `create table` con lo schema canonico (§ Design Notes), FK `user_id → auth.users (id) on delete cascade` su tutte, `review_state.exercise_id → exercise (id) on delete cascade`, `lesson_progress.lesson_id → lesson (id) on delete cascade`, PK composite `(user_id, exercise_id)` e `(user_id, lesson_id)`, `review_log.id uuid primary key`. `CHECK` su `stage` (`between 0 and 5`) e su `outcome` (`in ('again','hard','good','easy')`). RLS abilitata su tutte; 4 policy owner-scoped su `review_state`/`lesson_progress`, 2 (select/insert) su `review_log`. Commenti in italiano nello stile del file esistente, inclusa la motivazione della denormalizzazione di `grammar_point` e dell'append-only.
- `src/migrations.test.ts` -- **estendere** con un blocco per la nuova migrazione: colonne canoniche via AST per le tre tabelle; FK `user_id` cascade verso `auth.users` su tutte (via AST); `review_log` ha **una sola** FK (nessuna FK di contenuto); `review_state.exercise_id → exercise` e `lesson_progress.lesson_id → lesson` cascade; PK composite (testo); RLS su tutte; conteggio policy per tabella (4/4/2) e comandi coperti; `review_log` zero policy update/delete; `stage` limite superiore `=== LEITNER_INTERVALS_DAYS.length - 1` (import da `./domain/schedule`); insieme di `outcome` `=== new Set(REVIEW_OUTCOMES)`; presenza del commento di denormalizzazione (SQL grezzo).

**Acceptance Criteria:**
- **AC1 — Le tre tabelle nascono con lo schema canonico.** *Given* la nuova migrazione, *When* la si parsa offline, *Then* esistono `review_state` (`user_id, exercise_id, stage, due_at, review_count, lapse_count, last_reviewed_at`, PK `(user_id, exercise_id)`), `review_log` (`id, user_id, exercise_id, grammar_point, outcome, used_explanation, reviewed_at`, PK `id`) e `lesson_progress` (`user_id, lesson_id, unlocked_at`, PK `(user_id, lesson_id)`). *(righe matrice: «Migrazione ben formata», «Schema minimo»)*
- **AC2 — La denormalizzazione di `grammar_point` è documentata.** *Given* il file di migrazione, *When* lo si ispeziona, *Then* un commento dichiara che una statistica non può dipendere da dati mutabili che una riautorazione riscriverebbe. *(riga «Migrazione ben formata»)*
- **AC3 — Il `CHECK` sullo stadio deriva dalla scala, non da un elenco parallelo.** *Given* `LEITNER_INTERVALS_DAYS` in `schedule.ts`, *When* si confronta col `CHECK` su `review_state.stage`, *Then* il limite superiore SQL uguaglia `LEITNER_INTERVALS_DAYS.length - 1`. *(riga «Scala dello stadio»)*
- **AC4 — L'insieme degli esiti è lo stesso in SQL e in TypeScript.** *Given* `REVIEW_OUTCOMES` (da cui deriva `ReviewOutcome`), *When* si confronta col `CHECK` su `review_log.outcome`, *Then* i due insiemi sono uguali (`again | hard | good | easy`). *(riga «Insieme degli esiti»)*
- **AC5 — Isolamento per riga imposto e cascata sull'account.** *Given* la migrazione, *When* la si parsa offline, *Then* RLS è abilitata su tutte e tre; `review_state`/`lesson_progress` hanno le 4 policy owner-scoped e `review_log` solo `select`/`insert` (nessuna `update`/`delete`); ogni `user_id` è FK `on delete cascade` verso `auth.users`. La prova a runtime che A non legge/scrive le righe di B è differita a Epic 7 (7.5) — vedi `deferred`. *(righe «Isolamento per riga», «Append-only del log», «Cascata account»)*

## Design Notes

**Schema canonico (SPINE-DELTA §4):**
```sql
review_state
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references exercise (id) on delete cascade,
  stage int not null check (stage between 0 and 5),   -- 5 = LEITNER_INTERVALS_DAYS.length - 1
  due_at timestamptz not null,
  review_count int not null default 0,
  lapse_count int not null default 0,
  last_reviewed_at timestamptz,                        -- null = mai ripassato
  primary key (user_id, exercise_id)

review_log            -- append-only, fonte unica delle statistiche (AD-18)
  id uuid primary key,                                 -- review_id generato dal client (idempotenza, storia 3.9)
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null,                           -- NESSUNA FK di contenuto: il log è indipendente
  grammar_point text not null,                         -- denormalizzato: la fonte non dipende da dati mutabili
  outcome text not null check (outcome in ('again','hard','good','easy')),
  used_explanation boolean not null,
  reviewed_at timestamptz not null

lesson_progress
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references lesson (id) on delete cascade,
  unlocked_at timestamptz not null,
  primary key (user_id, lesson_id)
```

- **Perché `review_log` ha solo select/insert.** «Append-only» (AC1, FR5.6, AD-18) è imposto NON da un trigger ma dall'assenza di policy `update`/`delete`: con RLS attiva, ciò che non ha policy è negato. Un utente non può riscrivere la propria storia (che falserebbe streak e CM2). La cancellazione dell'account funziona lo stesso: la cascata a livello di FK è un'azione referenziale del motore, non DML soggetta a RLS.
- **Perché nessuna FK di contenuto su `review_log`.** Denormalizzare `grammar_point` (delta §4) serve proprio a rendere le statistiche indipendenti dall'esercizio, che una riautorazione può cambiare d'identità (AD-23) o rimuovere. Una FK `on delete cascade` verso `exercise` rifarebbe dipendere il log dal contenuto mutabile — l'opposto dell'intento. `review_state`, invece, è stato SRS *corrente* legato al contenuto vivo: lì la FK cascade verso `exercise` è coerente (come `lesson_progress → lesson`).
- **Perché derivare `ReviewOutcome` da una costante.** È lo stesso schema di `LEITNER_INTERVALS_DAYS`: una sola definizione, da cui derivano sia il tipo sia il testimone runtime che il test confronta con l'SQL. Aggiungere un esito domani è un cambiamento in un solo punto, e il `CHECK` disallineato diventa CI rossa.
- **Perché offline.** AD-12/AD-13: un solo progetto Supabase reale, nessuna istanza locale, apply solo al merge. La prova RLS a runtime (A vs B) esige account reali e teardown (Epic 7); qui si prova la STRUTTURA (RLS + policy + cascata), che è la condizione necessaria e meccanicamente verificabile.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0 (confini AD-1 intatti; la modifica al dominio resta pura).
- `npm run typecheck` -- expected: exit 0 (`tsc --noEmit`; la union `ReviewOutcome` invariata).
- `npm test` -- expected: exit 0 (nuovi test in `src/migrations.test.ts` verdi; sonde di `schedule`/`outcome` ancora verdi).
- `npm run validate-content` -- expected: exit 0 (cancello FR2.6 non regredito).

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 0, medium 3, low 2)
- defer: 0
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[medium]` `[patch]` I test asserivano solo i NOMI delle colonne: aggiunte asserzioni di TIPO e NULLABILITÀ per le tre tabelle via AST (`last_reviewed_at` unica nullable, tutto il resto not-null). Un drift di tipo (`timestamptz`→`timestamp`, `uuid`→`text`) o di nullabilità è ora CI rossa.
  - `[medium]` `[patch]` Il conteggio owner-scoped era `>= 10` (soglia debole: il vero conteggio è 12): reso esatto `=== 12` con commento, così una policy che perde il predicato `(select auth.uid()) = user_id` non è più mascherabile da un'altra.
  - `[medium]` `[patch]` La voce `deferred` instradava la prova RLS a runtime alla storia 7.5, i cui AC riguardano però il teardown post-cancellazione (assenza di righe), non l'isolamento A↔B fra account vivi. Corretta e ampliata: l'isolamento a runtime è NFR5 / suite e2e di 7.4, e va aggiunto un AC esplicito «A legge/scrive le righe di B ⇒ fallisce, per tabella» (oggi non presente in 7.4/7.5); inclusa anche la verifica a runtime dell'append-only di `review_log`.
  - `[low]` `[patch]` Aggiunta asserzione `int not null default 0` su `review_count`/`lapse_count`.
  - `[low]` `[patch]` Aggiunta guardia `/^\d{14}$/` sulla forma del timestamp della migrazione, prima del confronto d'ordine lessicografico.
  - reject principali (verificati contro il codice reale): `reviewed_at`/`id` generati dal client sono per DESIGN (AD-7 idempotenza, AD-24 esito calcolato all'istante della valutazione: un `default now()` userebbe l'ora di sync, sbagliata); nessun down-path/`if not exists` (convenzione forward-only del progetto, come ogni migrazione esistente); `review_log.exercise_id` senza FK di contenuto è deliberato e documentato (il log è fonte durevole indipendente dal contenuto mutabile); l'append-only è provato dall'ASSENZA di policy update/delete (default-deny), il che l'uguaglianza esatta dei set di comandi già coglie; l'ordine di `REVIEW_OUTCOMES` non è consumato da nessuno (la derivazione del tipo è indipendente dall'ordine); brittleness dei commenti coincide con la richiesta di AC2 (che ESIGE proprio quella dichiarazione).

### 2026-09-25 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 20: (high 0, medium 0, low 20)
- addressed_findings:
  - none
- note: secondo pass di review innescato da `followup_review_recommended: true`. Quattro layer (blind-hunter, edge-case-hunter, verification-gap, intent-alignment) eseguiti in parallelo alla stessa capacità del modello. **Verification-gap: nessun gap.** **Intent-alignment: nessuna divergenza, implementazione fedele all'intent** (le "surface mismatch" segnalate — accoppiamento dominio↔SQL imposto dal test, isolamento A↔B verificato solo strutturalmente offline — sono per design e già coperte dal `deferred` verso Epic 7). Tutti i 20 rilievi di blind/edge-case sono stati respinti perché riconducibili a scelte esplicite dell'intent-contract, nit di documentazione sotto soglia, o preoccupazioni speculative su superfici di storie future (3.9).
  - reject notevoli (verificati contro il codice reale): (1) `lesson_progress` con policy update/delete owner-scoped è PRESCRITTO dall'intent ("quattro policy owner-scoped, come `user_settings`") e la conseguenza è self-scoped — un utente altera solo il proprio progresso di curriculum, e il contenuto (lesson/exercise) è comunque già leggibile da ogni utente autenticato via le tabelle pubbliche in sola lettura: non è una breccia d'isolamento; (2) assenza di indici — le tabelle sono INERTI per intent (le query sono la storia 3.9), indicizzare senza pattern d'accesso sarebbe prematuro; (3) `due_at`/`reviewed_at`/`id` senza `default` — già respinto nel pass precedente come design (client-generated, idempotenza AD-7/AD-24); (4) commento append-only "più debole" rispetto a `service_role`/RPC — il commento è accurato nell'ambito di RLS, e il bypass del `service_role` è inerente a Postgres e riguarda la RPC di 3.9; (5) robustezza dei regex/`split(',')`/`TYPE_ALIASES` nei test — i test girano sul SQL reale con tipi ed esiti noti e sono già protetti da guardie `not.toBeNull()`; (6) `DW-21` troncato in `deferred-work.md` — file di proprietà dell'orchestratore, fuori dalla mia autorità (non modificato).

## Auto Run Result

Status: done
Pass: secondo pass di review (follow-up) su storia già `done` e già committata in `729f7ab`.

**Sintesi del cambiamento (invariato rispetto al pass precedente):** la storia introduce le tre tabelle per-utente del ciclo di ripasso — `review_state` (stato SRS corrente), `review_log` (storia append-only, fonte unica delle statistiche), `lesson_progress` (curriculum sbloccato) — isolate per riga con RLS owner-scoped, cascata su `auth.users`, `CHECK` derivati dalle costanti di dominio, e validazione strutturale offline via `pg-query-emscripten`.

**File del diff rivisto (dal baseline `beb3e05`, tutti già committati in `729f7ab`):**
- `src/domain/schedule.ts` — estratta la costante `REVIEW_OUTCOMES` e ridefinito `ReviewOutcome` come `(typeof REVIEW_OUTCOMES)[number]`; union identica, nessun cambiamento di comportamento.
- `supabase/migrations/20260925101500_create_review_and_progress.sql` — nuova migrazione: tre `create table`, RLS abilitata su tutte, 4/4/2 policy owner-scoped, `CHECK` su `stage` e `outcome`, FK cascade.
- `src/migrations.test.ts` — esteso con il blocco di asserzioni strutturali (AC1–AC5) più il wrapper di memoizzazione `parseSql`.

**Ripartizione dei rilievi di review (questo pass):** patch applicate: 0 · differite: 0 · respinte: 20 (tutte `low`). Nessun loopback bad_spec, nessun intent_gap.

**Verifica eseguita (sullo stato committato, nessuna modifica di codice in questo pass):**
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test` → exit 0 (603 test in 59 file; 45 test in `src/migrations.test.ts`)
- `npm run validate-content` → exit 0

**Rischi residui:** nessuno nuovo. L'unico rischio noto resta il differimento architetturale della prova RLS A↔B *a runtime* e dell'append-only a runtime verso Epic 7 (voce `deferred`, AC5 seconda clausola) — condizione necessaria verificata offline; l'effetto osservato a query-time richiede account reali e infrastruttura e2e non ancora esistente.

**Raccomandazione follow-up review:** `false`. Rilievi di questo pass triati `patch`: 0 (high 0, medium 0, low 0); punteggio `3×0 + 1×0 = 0` (< 5), nessun high → nessun ulteriore giro di review raccomandato. La convergenza è raggiunta.

