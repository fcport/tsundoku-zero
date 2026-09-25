---
title: 'Story 3.9: Una risposta, una chiamata, nessun doppione'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_revision: '2761bfed9f4b5c7d63aa1f9d81b6770db28a5aab'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Prova RUNTIME dell'idempotenza (AC3, comportamento osservato): riapplicare
      lo stesso review_id due volte NON deve produrre una seconda riga di log né
      un secondo avanzamento di stadio/contatore, eseguito contro un database
      reale con auth.uid() vivo.
    evidence: |-
      pg-query-emscripten PARSA soltanto il SQL: non esegue la funzione, quindi
      non può osservare l'effetto di una seconda chiamata. Questa storia verifica
      OFFLINE la condizione STRUTTURALE necessaria — firma esatta, INSERT con ON
      CONFLICT (id) DO NOTHING su review_log, UPDATE di review_state guardato dal
      risultato dell'INSERT (from logged), assenza di logica di scheduling — non
      l'effetto a query-time. La prova a runtime è GIÀ POSSEDUTA da Epic 4,
      storia 4.5 ("Riapplicare la coda non falsa niente"), i cui AC dichiarano
      esplicitamente «drenata due volte ⇒ review_log senza duplicati» e «stesso
      review_id due volte ⇒ lo stadio non avanza una seconda volta». Nessun
      orfano: non serve aggiungere l'obbligazione altrove. Stesso schema del
      differimento a runtime di 3.8.
    location: >-
      supabase/migrations/*_create_apply_review.sql + src/migrations.test.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** Le tre tabelle del ciclo di ripasso esistono (storia 3.8) ma sono INERTI: non c'è ancora un modo di persistere una risposta. Serve la scrittura, e deve nascere IDEMPOTENTE: un ritentativo su rete instabile (la coda offline di Epic 4) non deve contare la stessa risposta due volte, altrimenti streak e statistiche (CM2) diventano una menzogna.

**Approach:** Una migrazione versionata crea la funzione RPC `apply_review` con la firma canonica di AD-7. In UNA sola istruzione (quindi una transazione) inserisce in `review_log` con `ON CONFLICT (id) DO NOTHING` — dove `id` è il `review_id` generato dal client, la chiave di idempotenza — e aggiorna `review_state` SOLO SE l'insert ha prodotto una riga. La funzione NON ricalcola nulla: riceve `outcome`, `stage` e `due_at` già calcolati dal dominio sul client (AD-7/AD-24). La verifica strutturale è offline (`pg-query-emscripten`), come ogni migrazione (AD-12/AD-13); l'effetto a runtime è di Epic 4 (4.5).

## Boundaries & Constraints

**Always:**
- Firma ESATTA (AC1): `apply_review(review_id uuid, exercise_id uuid, outcome text, stage int, due_at timestamptz, reviewed_at timestamptz, used_explanation boolean)`, `returns void`. Ordine e tipi come sopra.
- UNA sola istruzione nel corpo (AC2): un `update public.review_state` con `with logged as (insert into public.review_log … on conflict (id) do nothing returning …)` e `from logged` — così l'update esiste SOLO SE l'insert ha prodotto una riga. Una sola istruzione ⇒ una sola transazione implicita (atomicità).
- `review_log` insert: `id = review_id`, `user_id = auth.uid()`, `grammar_point` LETTO da `public.exercise` per `exercise_id` (denormalizzazione: SNAPSHOT del punto grammaticale all'istante del ripasso — AD-18/AD-23), gli altri campi dai parametri.
- L'update di `review_state` scrive `stage`/`due_at`/`last_reviewed_at` DAI PARAMETRI (passthrough, nessun ricalcolo) e incrementa `review_count = review_count + 1` e `lapse_count = lapse_count + (case when outcome = 'again' then 1 else 0 end)`. Il guardiano `from logged` rende questi incrementi non-idempotenti SICURI: un ritentativo trova il conflitto, non ri-incrementa.
- `security invoker` + `set search_path = ''`, tabelle schema-qualificate (`public.*`, `auth.users`/`auth.uid()`): l'isolamento è imposto dalle POLICY RLS di 3.8 (l'utente scrive solo le proprie righe), non da controlli manuali nella funzione.
- Convenzione migrazioni: `supabase/migrations/YYYYMMDDHHmmss_slug.sql`, timestamp `>` `20260925101500` (l'ultima esistente). Apply SOLO al merge su `main`; validazione offline in `npm test`. Forward-only: `create function` (non `create or replace`, nessun `if not exists`), come ogni migrazione del progetto.

**Block If:**
- _Nessun blocco._ La prova a runtime dell'idempotenza (AC3, comportamento) NON è un blocco: è verificata per architettura in Epic 4 / storia 4.5 — vedi `deferred`. La pipeline `migrate.yml` e i secret esistono (storia 1.5): l'apply al merge è flusso normale.

**Never:**
- NESSUNA logica di scheduling o valutazione in SQL (AC4): la funzione non ricalcola `stage`/`due_at` (nessuna scala Leitner, nessun `interval`, nessuna aritmetica sullo stadio) e non deriva `outcome` (nessun uso di `used_explanation` per decidere l'esito: `used_explanation` finisce solo nel log). Il `case … outcome = 'again'` NON è valutazione: è un conteggio di un esito GIÀ deciso dal client.
- Nessuna FK di contenuto aggiunta, nessun cambiamento allo schema delle tre tabelle (3.8) né al dominio (`schedule.ts`): questa storia aggiunge SOLO la funzione e i suoi test.
- Nessun `grammar_point` nella firma: viene dallo snapshot server-side su `exercise`, coerente con i 7 parametri fissati dall'AC.
- Nessuna istanza Supabase locale nei test; nessun apply da un ramo di PR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Funzione ben formata | la `create function` | il parser Postgres accetta senza errori | `npm test` rosso su SQL non parsabile |
| Firma canonica | AST della funzione | 7 parametri, nomi/tipi/ordine esatti, `returns void` | rosso se un tipo/nome/ordine diverge |
| Prima applicazione | `review_id` mai visto | insert in `review_log`; update di `review_state` (stadio/scadenza/contatori) | — |
| Ritentativo (idempotenza) | stesso `review_id` | `on conflict (id) do nothing` ⇒ nessun log; `from logged` vuoto ⇒ nessun update | rosso (strutturale) se manca il conflitto o la guardia |
| Nessun ricalcolo | corpo della funzione | `stage`/`due_at` assegnati dai parametri (ColumnRef), niente `interval`/scala | rosso se assegnati da un'espressione calcolata |

</intent-contract>

## Code Map

- `supabase/migrations/20260925101500_create_review_and_progress.sql` -- **le tabelle bersaglio** (3.8): `review_log (id uuid pk, user_id, exercise_id, grammar_point, outcome, used_explanation, reviewed_at)`, `review_state (user_id, exercise_id, stage, due_at, review_count, lapse_count, last_reviewed_at, pk (user_id, exercise_id))`. RLS owner-scoped già presente (4/4/2). `id` è il review_id del client (commento riga 41-42).
- `supabase/migrations/20260925090000_create_lesson_and_exercise.sql` -- `exercise (id uuid, …, grammar_point text not null)`: FONTE dello snapshot di `grammar_point` (RLS select `to authenticated`, quindi leggibile dall'invoker).
- `src/domain/schedule.ts:23` -- `REVIEW_OUTCOMES = ['again','hard','good','easy']`; `:31` `ReviewOutcome`; `:142` `schedule()` calcola `stage`/`dueAt`/`reviewCount+1`/`lapseCount+(again?1:0)` SUL CLIENT — la funzione SQL è il gemello che PERSISTE, non ricalcola. Non va modificato.
- `src/migrations.test.ts` -- **da estendere**: `parseSql` (WASM memoizzato), `stripSqlComments`, `createTableOf`, `TYPE_ALIASES` (int↔int4, boolean↔bool). Modello per AST via tipi locali (vedi `CreatePolicyStmt`). Il loop generico «ogni *.sql parsa» include già la nuova migrazione.
- `_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-08-19/ARCHITECTURE-SPINE.md:93-97` -- AD-7 (firma, transazione, guardia, review_id chiave di idempotenza); `:208` convenzione nomi RPC verbali.
- `_bmad-output/planning-artifacts/epics.md:190,1164-1186` -- AD-7 modificato (7 param) e AC della storia 3.9; `:1660-1678` storia 4.5 che verifica l'idempotenza a runtime.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/20260925140000_create_apply_review.sql` -- **creare**. La `create function public.apply_review(...)` con la firma canonica, `returns void`, `language sql`, `security invoker`, `set search_path = ''`. Corpo = una sola istruzione: `with logged as ( insert into public.review_log (id, user_id, exercise_id, grammar_point, outcome, used_explanation, reviewed_at) select apply_review.review_id, auth.uid(), apply_review.exercise_id, e.grammar_point, apply_review.outcome, apply_review.used_explanation, apply_review.reviewed_at from public.exercise e where e.id = apply_review.exercise_id on conflict (id) do nothing returning 1 ) update public.review_state rs set stage = apply_review.stage, due_at = apply_review.due_at, last_reviewed_at = apply_review.reviewed_at, review_count = rs.review_count + 1, lapse_count = rs.lapse_count + (case when apply_review.outcome = 'again' then 1 else 0 end) from logged where rs.user_id = auth.uid() and rs.exercise_id = apply_review.exercise_id;`. Parametri qualificati con `apply_review.` per disambiguare dai nomi di colonna. Commenti in italiano nello stile dei file esistenti: idempotenza (review_id/ON CONFLICT), guardia (from logged), snapshot di grammar_point, nessuna logica di scheduling.
- `src/migrations.test.ts` -- **estendere** con un blocco per la nuova migrazione: (AC1) via AST — la `CreateFunctionStmt` con `funcname` ultimo segmento `apply_review`, 7 `parameters` con nomi/ordine esatti e tipi via `TYPE_ALIASES`, `returnType` `void`; (AC2) estrarre il corpo dall'opzione `as` (`arg.List.items[0].String.sval`), ri-parsarlo: ESATTAMENTE 1 statement, `UpdateStmt` su `review_state`, `withClause` con 1 CTE `logged` la cui query è `InsertStmt` su `review_log` con `onConflictClause.action === 'ONCONFLICT_NOTHING'` e infer su `id`, e `fromClause` che contiene `logged` (la guardia); (AC4) i `targetList` di `stage` e `due_at` sono `ColumnRef` a `apply_review.stage`/`apply_review.due_at` (passthrough, non `A_Expr`), e il corpo (senza commenti) non contiene `interval` né i valori della scala Leitner. Guardia anti-vacuità: la migrazione esiste e il timestamp `>` `20260925101500`.

**Acceptance Criteria:**
- **AC1 — Firma canonica.** *Given* la migrazione, *When* si parsa la `create function` offline, *Then* `apply_review` ha i 7 parametri `(review_id uuid, exercise_id uuid, outcome text, stage int, due_at timestamptz, reviewed_at timestamptz, used_explanation boolean)` in quest'ordine e `returns void`. *(righe «Funzione ben formata», «Firma canonica»)*
- **AC2 — Una transazione: insert idempotente + update guardato.** *Given* il corpo della funzione, *When* lo si ispeziona, *Then* è UNA sola istruzione che inserisce in `review_log` con `on conflict (id) do nothing` e aggiorna `review_state` solo se l'insert ha prodotto una riga (`from logged`). *(righe «Prima applicazione», «Ritentativo»)*
- **AC3 — Idempotenza sullo stesso `review_id`.** *Given* la struttura di AC2, *When* la stessa chiamata si ripete con lo stesso `review_id`, *Then* `on conflict (id) do nothing` impedisce una seconda riga di log e `from logged` (vuoto) impedisce un secondo avanzamento di stadio/contatore. La prova a RUNTIME è di Epic 4 / storia 4.5 — vedi `deferred`. *(riga «Ritentativo»)*
- **AC4 — Nessuna logica di scheduling né di valutazione.** *Given* la funzione, *When* la si ispeziona, *Then* `stage` e `due_at` sono assegnati dai parametri (nessun ricalcolo Leitner, nessun `interval`) e `outcome` è ricevuto, non derivato (`used_explanation` finisce solo nel log). *(riga «Nessun ricalcolo»)*

## Design Notes

**Perché il corpo è UNA sola istruzione.** L'atomicità di AC2 non richiede un blocco `begin/end`: una funzione `language sql` con una sola istruzione è già una transazione. La CTE data-modifying `logged` esegue l'INSERT esattamente una volta; il suo `returning` alimenta il `from logged` dell'UPDATE.

**Perché `from logged` È la guardia.** `on conflict (id) do nothing` fa sì che l'INSERT restituisca 0 righe quando `review_id` esiste già. Con `from logged`, l'UPDATE fa un prodotto con quelle righe: 0 righe ⇒ 0 update. Questo è letteralmente «aggiorna review_state SOLO SE l'insert ha prodotto una riga» (AD-7). Senza la guardia, un ritentativo ri-incrementerebbe `review_count`/`lapse_count` (setup non-idempotente) e falserebbe CM2: è proprio ciò che AD-7 previene.

**Perché lo snapshot di `grammar_point` server-side.** La firma fissata dall'AC ha 7 parametri, senza `grammar_point`. Leggerlo da `exercise` all'istante del ripasso È lo snapshot voluto da AD-18/AD-23: cattura il valore corrente, così una futura riautorazione dell'esercizio non riscrive la storia già registrata.

**Perché incrementare i contatori qui.** `schedule()` sul client calcola `reviewCount+1` e `lapseCount+(again?1:0)`, ma la firma non li trasporta: la funzione li deriva sull'esito RICEVUTO. È bookkeeping, non scheduling (nessuna scala, nessuno stadio calcolato) né valutazione (l'esito è già deciso). Tenerli coerenti evita uno stato interno incoerente (review_count che cresce mentre lapse_count resta 0).

**Perché `security invoker`.** Tutte le scritture sono owner-scoped e le policy RLS di 3.8 le impongono (insert con `with check auth.uid()=user_id`, update `using auth.uid()=user_id`). L'invoker non ha bisogno di privilegi elevati né di controlli manuali: least privilege, l'isolamento resta dichiarativo. `set search_path=''` + schema-qualificazione evita l'iniezione di search_path.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0 (nessun file TS di dominio toccato; i confini AD-1 restano intatti).
- `npm run typecheck` -- expected: exit 0 (`tsc --noEmit`; il test usa tipi locali per l'AST, come per `CreatePolicyStmt`).
- `npm test` -- expected: exit 0 (nuovo blocco in `src/migrations.test.ts` verde; la nuova migrazione passa anche il loop «ogni *.sql parsa»).
- `npm run validate-content` -- expected: exit 0 (cancello FR2.6 non regredito).

## Spec Change Log

_Nessun loopback bad_spec: la spec non è stata emendata._

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 2, low 2)
- defer: 0
- reject: 11: (high 0, medium 0, low 11)
- addressed_findings:
  - `[medium]` `[patch]` La guardia `from logged` regge SOLO se la CTE `logged` ha un `returning` che produce righe, ma nessun test lo asseriva: un `returning` rimosso in un refactor sarebbe parsato senza errori e avrebbe invertito in silenzio l'update (mai eseguito). Aggiunta asserzione AST che `insert.returningList` è non vuoto.
  - `[medium]` `[patch]` Lo SNAPSHOT server-side di `grammar_point` da `exercise` (AD-18/AD-23, boundary «Always») era verificato solo dalla parola "snapshot" in un commento. Aggiunte asserzioni AST: la lista colonne dell'insert è esatta e in ordine (`id,user_id,exercise_id,grammar_point,outcome,used_explanation,reviewed_at`), il `select` legge `from exercise`, e il valore di `grammar_point` è un `ColumnRef` dalla tabella joinata (`e`), non un parametro.
  - `[low]` `[patch]` AC4 non asseriva che `outcome` fosse passthrough (simmetria mancante con stage/due_at). Aggiunta asserzione che il valore di `outcome` nell'insert è un `ColumnRef` a `apply_review.outcome` — l'esito è RICEVUTO, non derivato da `used_explanation`.
  - `[low]` `[patch]` Il test di passthrough AC4 copriva `stage`/`due_at` ma non `last_reviewed_at` (anch'esso passthrough nel `set`). Aggiunto `last_reviewed_at → apply_review.reviewed_at` al ciclo, completando la copertura del `set`.
- reject notevoli (verificati contro il codice reale): (1) no-op silenzioso su `exercise` mancante/invisibile — è per DESIGN (grammar_point non snapshottabile, e la riga `review_state` sarebbe già sparita per cascata; la funzione è persistenza inerte, non validazione); (2) riga `review_state` mancante ⇒ log orfano — precluso dalla materializzazione allo sblocco (AD-19/storia 3.13: la riga esiste prima di `apply_review`); (3) `auth.uid()` nullo — fallisce in modo SICURO (NOT NULL sull'insert e/o default-deny RLS), l'accesso anonimo alla RPC non è nell'intent; (4) `stage` fuori range / `due_at`/`reviewed_at` nulli — imposti ATOMICAMENTE dai CHECK/NOT NULL di 3.8 (una violazione annulla l'intera istruzione, log incluso), aggiungere validazione in-funzione sarebbe scope creep contro il design «inerte»; (5) overflow int4 dei contatori — irraggiungibile (2.1G ripassi); (6) `on conflict (id)` vs `review_id` — già riconciliato dai commenti («id = review_id»); (7) forward-only senza rollback — convenzione del progetto (ogni migrazione; down-path già respinto in 3.8); (8) spec `oversized` / `in-review` — warning atteso e fase corrente; (9) test-commenti «brittle» — le parole (`snapshot`, `scheduling`) sono loanword del vocabolario tecnico del repo; (10) test «tocca solo due tabelle» — già implicato dall'asserzione di istruzione singola (1 update su review_state, 1 CTE insert su review_log); (11) verifica strutturale degli incrementi dei contatori — bookkeeping fuori dagli AC, sovra-specificazione.

### 2026-09-25 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 0
- reject: 15: (high 0, medium 0, low 15)
- addressed_findings:
  - `[medium]` `[patch]` Le opzioni di sicurezza della funzione — `language sql`, `security invoker`, `set search_path = ''` — sono confini «Always» espliciti e LOAD-BEARING (l'atomicità di AC2 poggia su `language sql`; l'isolamento poggia su `security invoker` + RLS di 3.8), ma NESSUNA asserzione le copriva: la firma AC1 verificava solo funcname/parametri/return. Un refactor a `security definer` (che BYPASSA la RLS, aprendo la scrittura cross-utente) o un `set search_path` caduto sarebbe passato verde in silenzio. Aggiunto un test AST che pretende `language.String.sval === 'sql'`, la clausola `security` PRESENTE con `Boolean.boolval === false` (invoker) e un `set` su `VariableSetStmt.name === 'search_path'` con valore `''`.
  - `[low]` `[patch]` L'insert scrive `user_id = auth.uid()` — l'ANCORA di ownership su cui poggia l'intera isolazione RLS (`with check auth.uid() = user_id`) — ma la fonte non era asserita (lo erano invece `grammar_point` e `outcome`). `user_id` non è nella firma, quindi non spoofabile senza cambiare i 7 parametri, ma la copertura era asimmetrica. Aggiunta asserzione AST che il valore alla colonna 1 del select è un `FuncCall` a `auth.uid()` (funcname `[auth, uid]`), completando la verifica di provenienza di tutte le colonne a sorgente speciale.
- reject notevoli di questo passaggio: (a) FALSO POSITIVE del blind-hunter «i quattro `it` sono vuoti/senza `expect`» — artefatto della sola porzione di diff mostrata al reviewer; il file reale (`src/migrations.test.ts`) contiene tutte le asserzioni, verificate riga per riga prima della classificazione; (b) tutti i finding runtime (riga `review_state` mancante, `exercise` assente, `auth.uid()` nullo, `stage`/`outcome`/`due_at` invalidi) — ri-sollevati dall'edge-case-hunter ma già respinti nel passaggio precedente come by-design o imposti atomicamente da CHECK/NOT NULL/RLS di 3.8, e la prova runtime è comunque differita a Epic 4/4.5; (c) `grant execute`, `replace = false`, unicità del timestamp, guardia anti-`--` in literal, documentazione della visibilità della CTE — sovra-specificazione o convenzioni di progetto fuori dagli AC; (d) intent-alignment: puramente descrittivo, conferma che il diff implementa la lettura «contratto strutturale verificato offline» autorizzata dall'intent, con la sola divergenza (runtime non eseguito) esplicitamente differita.

## Auto Run Result

Status: done

**Sintesi del cambiamento.** La storia 3.9 aggiunge la RPC `apply_review` (migrazione forward-only `supabase/migrations/20260925140000_create_apply_review.sql`) — la sola via per persistere una risposta — con la firma canonica di AD-7 (7 parametri, `returns void`). Il corpo è UNA sola istruzione: un `update public.review_state` guardato da un CTE `logged` il cui `insert` su `review_log` usa `on conflict (id) do nothing` (idempotenza sul `review_id` del client) e `from logged` (la guardia: l'update avviene solo se l'insert ha prodotto una riga). `grammar_point` è uno snapshot server-side letto da `exercise`; `stage`/`due_at`/`last_reviewed_at` sono passthrough dai parametri; i contatori sono bookkeeping sull'esito ricevuto; nessuna logica di scheduling/valutazione in SQL. La verifica è strutturale/offline via `pg-query-emscripten` (AD-12/AD-13). Questa passata di follow-up ha rafforzato la suite di test.

**File modificati in questa passata (follow-up):**
- `src/migrations.test.ts` — aggiunto un test AST per le opzioni della funzione (`language sql`, `security invoker`, `set search_path = ''`) e un'asserzione che `user_id` è alimentato da `auth.uid()`; estesi i tipi locali `CreateFunctionStmt` (forme `arg` delle opzioni) e `SelectStmt` (`FuncCall`).

**File della storia (baseline `2761bfe`):**
- `supabase/migrations/20260925140000_create_apply_review.sql` — la funzione `apply_review` (invariata in questa passata).
- `src/migrations.test.ts` — blocco strutturale AC1–AC4 (esteso in questa passata).

**Ripartizione dei finding (questa passata):** patch applicati 2 (1 medium, 1 low); differiti 0; respinti 15. Nessun `intent_gap`, nessun `bad_spec`, nessun loopback: `review_loop_iteration` resta 0.

**Raccomandazione di follow-up review:** `false`. Solo i patch di questa passata contano: high 0, medium 1, low 1 ⇒ punteggio `3×1 + 1×1 = 4` (< 5 e nessun high).

**Verifica eseguita:**
- `npm run lint` — exit 0.
- `npm run typecheck` — exit 0.
- `npm test` — exit 0 (59 file, 612 test verdi; il blocco `apply_review` ora con 3 asserzioni in più).
- `npm run validate-content` — exit 0 (cancello FR2.6 non regredito).

**Rischi residui.** La prova a RUNTIME dell'idempotenza (riapplicare lo stesso `review_id` non deve produrre un secondo log né un secondo avanzamento) resta differita a Epic 4 / storia 4.5, come già registrato in `deferred` — `pg-query-emscripten` parsa soltanto, non esegue. La correttezza a runtime dipende da invarianti architetturali di altre storie (materializzazione della riga `review_state` allo sblocco, AD-19/storia 3.13; CHECK/NOT NULL/RLS di 3.8), non verificabili offline in questa storia.

