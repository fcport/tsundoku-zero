---
title: 'Story 3.13: Sbloccare la lezione successiva'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '4948769a1045f232b3318148cde7fa9213606d99'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Lo sblocco fallito è silenzioso: `unlockMutation` ha solo `onSuccess`, nessun
      `onError`; se `progress.unlockLesson` rigetta (DataError da RLS/rete) il
      pulsante si riabilita senza alcun messaggio né riprova, e la lezione non si
      sblocca.
    evidence: |-
      `DashboardScreen.tsx` definisce `useMutation({ mutationFn, onSuccess })` senza
      `onError`; la dashboard non ha alcuna superficie d'errore (stesso vuoto della
      lettura, già tracciato in DW-23). L'intento di 3.13 copre solo il percorso
      felice dello sblocco (AC1-4); l'epica sequenzia gli stati non-felici della
      dashboard a 3.15/3.16. Reale ma non richiesto da questa storia: va affrontato
      con gli stati vuoti/d'errore (3.15/3.16 o la storia dedicata di DW-23).
    location: >-
      src/features/dashboard/DashboardScreen.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Non esiste alcun percorso di SCRITTURA per progredire nel curriculum. `review_state` viene solo AGGIORNATA da `apply_review` (3.9), mai INSERITA; `lesson_progress` è oggi in sola lettura (3.8/3.10 la leggono, la scrittura fu esplicitamente differita a 3.13). La dashboard (3.12) mostra la pila POPOLATA e un'unica azione (svuota-pila, inerte), ma quando la pila si svuota l'utente non ha modo di sbloccare la lezione successiva, e le due quest — svuota-pila e sblocca — non sono ancora governate dal cancello che impedisce loro di coesistere.

**Approach:** Consegnare la quest di sblocco per l'intero stack. Un selettore di dominio PURO per la lezione successiva in ordine; una RPC SQL `unlock_lesson` ATOMICA e IDEMPOTENTE che MATERIALIZZA la lezione (una riga `lesson_progress` + una riga `review_state` per ciascun esercizio, `stage = 0`, `due_at` = istante di sblocco); un metodo di porta `ProgressRepository.unlockLesson` che la invoca; e il CANCELLO della dashboard (azione di sblocco SOLO a pila vuota, azione svuota-pila SOLO a pila non vuota — mai entrambe).

## Boundaries & Constraints

**Always:**
- **Materializzazione = UNA RPC atomica e idempotente.** Creare `unlock_lesson(lesson_id text, unlocked_at timestamptz) returns void`, modellata VERBATIM su `apply_review` (`20260925140000_create_apply_review.sql`): `language sql` con UNA SOLA istruzione (transazione implicita, atomicità di AD-7), `security invoker`, `set search_path = ''`, tabelle schema-qualificate (`public.*`, `auth.uid()`). Inserisce la riga `lesson_progress` (utente/lezione/`unlocked_at`) E una riga `review_state` per CIASCUN esercizio della lezione, letti SERVER-SIDE da `public.exercise where lesson_id = …` (come `apply_review` legge `exercise` per lo snapshot), con `stage = 0` e `due_at = unlocked_at`. ENTRAMBE le insert sono `on conflict … do nothing` (idempotenza: un ri-tentativo — doppio click o replay offline — non raddoppia mai le righe).
- **Sequenzialità nel DOMINIO, non in SQL.** Creare `nextLessonToUnlock(lessons, unlockedIds): LessonSummary | null` PURA in `src/domain/curriculum.ts`: ordina per `ordinal` e ritorna la lezione con `ordinal` più basso NON ancora sbloccata, oppure `null` a curriculum esaurito. «Non si salta» è garantito perché ritorna sempre la SUCCESSIVA immediata. La UI passa alla RPC solo questo `id`.
- **«Mai incontrato» = ASSENZA di riga (AD-19).** La RPC crea righe `review_state` SOLO per gli esercizi della lezione sbloccata; niente pre-crea righe, nessuno «stato speciale». L'assenza di riga È l'informazione.
- **La scrittura passa dalla PORTA.** Estendere `ProgressRepository` con `unlockLesson(lessonId: string, now: Date): Promise<void>` (docblock: scrittura atomica/idempotente via RPC; `now` iniettato dal Clock, il dominio non legge l'orologio). L'adattatore in `src/data/` chiama `client.rpc('unlock_lesson', { lesson_id, unlocked_at: now.toISOString() })` e LANCIA `DataError('unlockLesson', error)` su `error` (mirror del contratto d'errore delle letture: reject, non valore degradato).
- **Il CANCELLO della dashboard (AC4 + epica).** Pila NON vuota (`count > 0`) ⇒ rende SOLO l'azione svuota-pila (`dashboard.primaryAction`, invariata da 3.12), l'azione di sblocco NON è presente, nemmeno disabilitata. Pila VUOTA (`count === 0`) con una lezione successiva ⇒ rende SOLO l'azione di sblocco (`dashboard.unlockAction`) cablata a un `useMutation` che chiama `progress.unlockLesson(next.id, clock.now())` e, in `onSuccess`, invalida `dueQueryKey(userId)` e `['unlocked', userId]`. Le due quest NON compaiono MAI insieme.
- **Migrazioni solo al merge su main (AD-12/AD-13).** La RPC non si applica da un ramo di PR: è validata OFFLINE da test strutturali AST in `src/migrations.test.ts`, rispecchiando quelli di `apply_review`. L'effetto DB dal vivo è verificato dall'e2e differita (come per `apply_review` di 3.9).
- **i18n a parità.** `dashboard.unlockAction` in ENTRAMBI i cataloghi `en`/`it` (parità ricorsiva imposta da `i18n.test.tsx`), verbale e concreta (mai «Continua»), senza `!`/emoji/avverbi di lode.
- **Confini AD-1.** `src/features/dashboard/` importa `domain` (`curriculum`, `dueQueryKey`, `streak`), `ui`, `i18n`, `@tanstack/react-query`, MAI `data`; la scrittura arriva da `usePorts().progress`. Solo token del sistema di design.

**Block If:**
- _Nessun blocco._ Ogni decisione (RPC per l'atomicità, sequenza nel dominio, `due_at` = istante di sblocco, idempotenza `on conflict`) è già fissata dall'epica («sbloccare una lezione materializza gli esercizi», «mai incontrato = assenza di riga», «sequenziale, non si salta») e dai pattern esistenti (`apply_review`). Nessuna richiede input umano né azioni esterne al repository (nessun dominio/DNS/API-key/console vendor): la migrazione si applica dalla pipeline CI esistente al merge.

**Never:**
- NON mettere logica di sequenza o di business in SQL (mirror `apply_review`): nessun confronto di `ordinal`, nessuna aritmetica di scheduling/`interval`. La RPC è un materializzatore ATOMICO e MUTO; la sequenza è compito del dominio. (Saltare una lezione tocca SOLO i propri dati di studio, già isolati da RLS: è una regola di prodotto, non un confine di sicurezza.)
- NON fare il lavoro di 3.15/3.16: nessuna schermata di stato vuoto DISTINTA (primo-avvio «comincia» vs pila-svuotata «hai finito»), nessun occultamento del conteggio/streak a zero, nessuna dichiarazione «perché è vuoto», nessuna schermata unica SENZA azione per il curriculum esaurito. Qui il ramo vuoto è UNICO e grezzo (mostra ancora il conteggio); quando `count === 0` E `next === null` (esaurito) NON rendere l'azione di sblocco (la sua schermata senza-azione è 3.16) — non crashare, non inventare.
- NON fare il lavoro di 3.14 (la dichiarazione «questa lezione non ha esercizi»): la RPC gestisce già una lezione senza esercizi (solo la riga di progresso), ma la sua dichiarazione UI è 3.14.
- NON fare il lavoro di 3.17 (tetto giornaliero di sblocco): fuori scope; un'azione sblocca UNA lezione.
- NON memorizzare pila/sbloccate: sempre DERIVATE a ogni lettura (AD-5); NON reimplementare `isDue`/`streak` fuori dal dominio.
- NON cablare l'`onClick` di avvio sessione (resta 3.18): l'azione svuota-pila resta sola-copy, inerte, come in 3.12.
- NON estrarre i primitivi `ui` come file a sé, NON usare colori letterali/emoji/`!`, NON usare `Date.now()`/`new Date()`/`resolvedOptions()` sotto `src/domain/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| selettore: prima lezione | lessons `ordinal` 1..5, `unlocked` ∅ | ritorna la lezione con `ordinal` più basso | — |
| selettore: prefisso sbloccato | lessons 1..5, `unlocked` = {ord 1,2} | ritorna la lezione `ordinal` 3 (la successiva) | — |
| selettore: esaurito | tutte le lezioni sbloccate | ritorna `null` | — |
| selettore: input disordinato | lessons non ordinate per `ordinal` | ordina per `ordinal`, ritorna la più bassa non sbloccata | — |
| selettore: nessuna lezione | lessons ∅ | ritorna `null` | — |
| `unlockLesson` valido | `lessonId` + `now` | chiama `client.rpc('unlock_lesson', { lesson_id, unlocked_at: now.toISOString() })`; risolve `void` | — |
| `unlockLesson` errore | la RPC ritorna `{ error }` | LANCIA `DataError('unlockLesson')` con causa preservata | reject, non degrada |
| cancello: pila non vuota | `count > 0` | rende SOLO l'azione svuota-pila; NESSUN unlock (AC4); un solo `<button>` | — |
| cancello: pila vuota + next | `count === 0`, `next ≠ null` | rende SOLO l'azione unlock; NESSUN svuota-pila; un solo `<button>` | — |
| cancello: pila vuota + esaurito | `count === 0`, `next === null` | rende NESSUNA delle due azioni (schermata esaurita = 3.16) | — |

</intent-contract>

## Code Map

- `src/domain/ports/contentRepository.ts:22-27,40` -- `LessonSummary { id, ordinal, title, grammarPoints }` (input del selettore) e `listLessons()` ORDINATO per `ordinal`.
- `src/domain/ports/progressRepository.ts:18-25` -- `ProgressRepository`, oggi solo `listUnlockedLessonIds()`; **aggiungere** `unlockLesson(lessonId: string, now: Date): Promise<void>` con docblock (scrittura atomica/idempotente via RPC; `now` dal Clock).
- `src/domain/due.ts:26,44` -- `isDue` e `dueQueryKey(userId)`: il cancello legge `count = listDue.length`; invalidare questa chiave dopo lo sblocco.
- `src/domain/curriculum.ts` -- **creare**: `nextLessonToUnlock(lessons, unlockedIds): LessonSummary | null` (autorità sequenziale AC3, puro; ordina per `ordinal`, ritorna il più basso non sbloccato o `null`). Import `type { LessonSummary }` da `./ports/contentRepository`. Nessun costrutto temporale (dominio puro AD-1).
- `src/domain/curriculum.test.ts` -- **creare**: le 5 righe «selettore» della matrix.
- `supabase/migrations/20260925150000_create_unlock_lesson.sql` -- **creare**: RPC `unlock_lesson`, mirror di `20260925140000_create_apply_review.sql`. Corpo in Design Notes.
- `src/migrations.test.ts:28-43,86-92,951-973,975-1340` -- helper (`listMigrations`, `parseSql`, `lastSegment`, `createFunctionOf`, `functionBodyOf`) e lo STILE dei test AST di `apply_review`; **aggiungere** un `describe('migrazione unlock_lesson …')` che rispecchia: firma canonica (2 parametri `lesson_id text`/`unlocked_at timestamptz`, `returns void`, schema `public`); `language sql` / `security invoker` / `set search_path = ''`; UNA sola istruzione; INSERT su `review_state` che legge da `exercise` filtrando `lesson_id` (`stage` letterale 0, `due_at` passthrough da `unlock_lesson.unlocked_at`); una CTE che inserisce in `lesson_progress`; ENTRAMBE `on conflict … do nothing`; NESSUNA aritmetica di scheduling; NESSUN confronto di `ordinal` (la sequenza NON è in SQL).
- `src/data/progressRepository.ts:29-59` -- `createSupabaseProgressRepository`; **aggiungere** `unlockLesson` che chiama `client.rpc('unlock_lesson', { lesson_id: lessonId, unlocked_at: now.toISOString() })` e LANCIA `DataError('unlockLesson', error)` su `error`. Costante nome RPC (`UNLOCK_LESSON_RPC = 'unlock_lesson'`) accanto ai nomi tabella.
- `src/data/progressRepository.test.ts:11-38,69-95` -- pattern del fake client e delle asserzioni `DataError`; **aggiungere** un fake `.rpc` (mirror del fake `functions.invoke` di `accountGateway.test.ts:28-45`, che registra `{ name, params }`) e i test: happy (nome+params corretti, `unlocked_at` ISO), errore ⇒ `DataError('unlockLesson')`.
- `src/data/accountGateway.ts:59-61` + `.test.ts:28-45,77` -- precedente di chiamata NON-select (`client.functions.invoke`) e del suo fake/spy: da imitare per il fake `.rpc` (nessun `.rpc` esiste ancora nel data layer).
- `src/features/dashboard/DashboardScreen.tsx:38-127` -- **modificare**: derivare `count = dueQ.data.length` e `next = nextLessonToUnlock(lessonsQ.data, unlockedQ.data)`; sostituire il blocco azione singolo con il CANCELLO (count>0 ⇒ svuota-pila; count===0 && next ⇒ unlock via `useMutation`; count===0 && !next ⇒ nessuna azione). `useMutation` + `useQueryClient` da `@tanstack/react-query`; `onSuccess` invalida `dueQueryKey(userId)` e `['unlocked', userId]`.
- `src/features/dashboard/DashboardScreen.test.tsx:30-102,111-251` -- harness (`inMemoryPorts`, `seededClient`, `render`, `renderToStaticMarkup`); **aggiungere** `unlockLesson: async () => {}` al fake `progress`; estendere `seededClient` a `dueCount: 0`; **aggiungere** i test del cancello (pila non vuota ⇒ solo svuota-pila, nessun unlock; pila vuota+next ⇒ unlock, nessun svuota-pila, un solo `<button>`; pila vuota+esaurito ⇒ nessuna azione).
- `src/i18n/en.ts:33-46`, `src/i18n/it.ts:27-40` -- sezione `dashboard`; **aggiungere** `unlockAction` in ENTRAMBI (`Unlock the next lesson` / `Sblocca la lezione successiva`; no `!`/emoji).
- `src/features/ports/PortsContext.test.tsx:51-53`, `src/app/AppRoutes.test.tsx:47`, `src/app/AuthRoot.test.tsx:43`, `src/app/AuthenticatedShell.test.tsx:33` -- fake `ProgressRepository`; **aggiungere** `unlockLesson: async () => {}` per soddisfare il tipo esteso.
- `src/ports-surface.test.ts:20-26` -- verifica solo l'ESISTENZA delle interfacce porta: aggiungere un metodo a `ProgressRepository` non la rompe (nessuna modifica richiesta).
- `eslint.config.js` -- boundaries (features→domain/`@tanstack` ammesso; features NON importa data) e regola colore (ERROR su `ui`/`features`): nessun colore letterale nel gate.

## Tasks & Acceptance

**Execution:**
- `src/domain/curriculum.ts` -- **creare** `nextLessonToUnlock(lessons: readonly LessonSummary[], unlockedIds: readonly string[]): LessonSummary | null` (puro: copia+ordina per `ordinal`, ritorna il primo `id` non in `unlockedIds`, o `null`). Docblock: autorità sequenziale AC3.
- `src/domain/curriculum.test.ts` -- **creare**: le 5 righe «selettore» della matrix (prima, prefisso, esaurito, disordinato, nessuna).
- `supabase/migrations/20260925150000_create_unlock_lesson.sql` -- **creare** la RPC come da Design Notes (commenti che documentano idempotenza «on conflict», materializzazione, assenza di logica di sequenza).
- `src/migrations.test.ts` -- **aggiungere** il `describe` strutturale per `unlock_lesson` (vedi Code Map), riusando gli helper esistenti.
- `src/domain/ports/progressRepository.ts` -- **aggiungere** `unlockLesson` all'interfaccia con docblock.
- `src/data/progressRepository.ts` -- **implementare** `unlockLesson` (RPC + `DataError`).
- `src/data/progressRepository.test.ts` -- **estendere**: fake `.rpc`, test happy (params) + errore ⇒ `DataError('unlockLesson')`.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- **aggiungere** `dashboard.unlockAction` in entrambi.
- `src/features/dashboard/DashboardScreen.tsx` -- **modificare**: cancello + `useMutation`/`useQueryClient` + invalidazione.
- `src/features/dashboard/DashboardScreen.test.tsx` -- **estendere**: `unlockLesson` nel fake, `dueCount:0` in `seededClient`, i tre test del cancello.
- `src/features/ports/PortsContext.test.tsx`, `src/app/AppRoutes.test.tsx`, `src/app/AuthRoot.test.tsx`, `src/app/AuthenticatedShell.test.tsx` -- **aggiungere** `unlockLesson: async () => {}` ai fake `progress` (additivo; conservare gli invarianti esistenti).

**Acceptance Criteria:**
- **AC1 — Materializzazione.** *Given* una lezione con esercizi, *when* `unlock_lesson(lesson_id, unlocked_at)` è eseguita, *then* inserisce UNA riga `lesson_progress` e UNA riga `review_state` per CIASCUN esercizio della lezione (letti server-side da `exercise`) con `stage = 0` e `due_at = unlocked_at`; ri-eseguirla NON duplica righe (`on conflict do nothing`). Verificato dai test strutturali AST della migrazione; l'effetto DB dal vivo è e2e-differito (AD-12/13, come `apply_review`).
- **AC2 — Mai incontrato = assenza di riga.** *Given* un esercizio di una lezione non ancora sbloccata, *when* il suo stato di ripasso viene interrogato, *then* NON esiste alcuna riga `review_state` per esso (nessuno stato speciale): solo lo sblocco crea le righe, e solo per gli esercizi di QUELLA lezione.
- **AC3 — Sequenziale, non si salta.** *Given* il curriculum e le lezioni sbloccate, *when* si sceglie cosa sbloccare, *then* `nextLessonToUnlock` ritorna la successiva in ordine (`ordinal` più basso non sbloccato), mai una saltata; `null` a curriculum esaurito.
- **AC4 — Cancello.** *Given* la pila NON vuota, *when* la dashboard è resa, *then* l'azione di sbloccare NON è presente (nemmeno disabilitata) e le due quest non compaiono mai insieme.
- **AC5 — Atomicità / least-privilege dell'RPC.** *Given* la migrazione `unlock_lesson`, *when* la sua struttura è analizzata (AST), *then* è un'UNICA istruzione `language sql`, `security invoker`, `set search_path = ''`, senza logica di sequenza/scheduling in SQL; l'owner-scoping è imposto dalle policy insert di `review_state`/`lesson_progress` (3.8).
- **AC6 — Confini / porta.** *Given* `features/dashboard`, *then* non importa `data` (lo sblocco passa da `usePorts().progress.unlockLesson`), nessun colore letterale, `npm run lint`/boundaries verdi.
- **AC7 — Read-model coerente dopo lo sblocco.** *Given* uno sblocco riuscito, *when* la mutation ha successo, *then* invalida `dueQueryKey(userId)` e `['unlocked', userId]` (pila e sblocco ri-derivati, mai memorizzati).

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 1, low 0)
- defer: 1: (high 0, medium 1, low 0)
- reject: 14: (high 0, medium 1, low 13)
- addressed_findings:
  - `[medium]` `[patch]` Il test AST di `unlock_lesson` verificava l'INSERT su `review_state` colonna-per-colonna ma dell'INSERT del CTE `unlocked` su `lesson_progress` controllava solo `relname`, `on conflict` e le infer cols — non le colonne né i VALUES: una migrazione con colonne sbagliate o un valore cablato in `lesson_progress` sarebbe passata. Aggiunte, nello stesso stile, le asserzioni: `cols === ['user_id','lesson_id','unlocked_at']` e i tre VALUES (`auth.uid()`, `unlock_lesson.lesson_id` passthrough, `unlock_lesson.unlocked_at` passthrough). `npm test` verde (716).
- deferred (1): sblocco fallito silenzioso (nessun `onError`/superficie d'errore sulla dashboard). Reale ma non richiesto dall'intento di 3.13; da affrontare con gli stati non-felici (3.15/3.16) o la storia d'errore di DW-23.
- reject notevoli (verificati contro il codice reale):
  - **Glue click→mutation non testata a unità (verification-gap/blind-hunter/intent-alignment).** `onClick={() => unlockMutation.mutate(next.id)}` + `useMutation` non sono esercitati: `renderToStaticMarkup` (env `node`, nessun jsdom) non fa scattare eventi. È la STESSA convenzione documentata del repo (la glue d'effetto è e2e-differita), già applicata in 3.12 (glue `userId` di `AuthRoot`) e 3.9 (scrittura dal vivo di `apply_review`). Le parti sostanziali SONO coperte: la scelta della lezione (`nextLessonToUnlock`, dominio), la chiamata RPC + `DataError` (`unlockLesson`, dati), la struttura SQL (AST). Introdurre un harness jsdom per 3 righe di glue è un'espansione d'infrastruttura, non un patch di storia.
  - **Effetto DB dal vivo non verificato (intent-alignment: superficie).** Gli AC1/AC2 vivono sullo stato persistito; i test esercitano l'AST SQL + il client finto. È la convenzione AD-12/AD-13 (le migrazioni si applicano solo al merge; niente e2e da un ramo di PR), esplicita nello spec — non una scorciatoia. Verifica dal vivo differita all'e2e come per `apply_review`.
  - **`nextLessonToUnlock`: prefisso non contiguo / ordinal duplicato o NaN.** L'unico percorso di scrittura è sequenziale ⇒ le sbloccate sono sempre un prefisso contiguo; e `lesson.ordinal` è `int not null unique` a schema ⇒ né duplicati né NaN dai dati reali. Ritornare comunque il più basso non sbloccato è il comportamento corretto e auto-riparante («non si salta» tiene).
  - **`now` Invalid Date ⇒ `toISOString()` lancia RangeError.** `systemClock.now()` ritorna sempre una `Date` valida; il caso non è producibile dalla sorgente reale.
  - **`onSuccess` non invalida lo streak / chiavi «incoerenti».** Lo sblocco non scrive `review_log` ⇒ lo streak non cambia (giusto non invalidarlo). Le chiavi d'invalidazione rispecchiano VERBATIM quelle delle query (`dueQueryKey(userId ?? '')`, `['unlocked', userId]`): coerenti, non divergenti.
  - **Doppio click ⇒ due chiamate.** `disabled={isPending}` copre il caso comune; il micro-race residuo è reso innocuo dall'idempotenza (`on conflict do nothing`), che È la difesa dichiarata.
  - **Copy IT dello sblocco / etichetta esaurito / stato-morto esaurito / label AC4 duplicata / filtro Leitner `>1` / A_Const dello `stage`.** Preferenze/robustezza di test o scope di 3.16 (schermata esaurita) per autorità dell'epica; la parità en/it è già imposta da `i18n.test.tsx`, il describe del cancello è già disambiguato con «(3.13)», e il filtro `>1` è CORRETTO perché il corpo contiene legittimamente `stage = 0`.

## Design Notes

**Golden example — la RPC `unlock_lesson` (mirror di `apply_review`).**
```sql
create function public.unlock_lesson(
  lesson_id text,
  unlocked_at timestamptz
)
returns void
language sql
security invoker
set search_path = ''
as $$
  -- CTE modificante: materializza il PROGRESSO. Idempotente (on conflict do nothing):
  -- un doppio sblocco non raddoppia. Le CTE modificanti girano sempre una volta.
  with unlocked as (
    insert into public.lesson_progress (user_id, lesson_id, unlocked_at)
    values (auth.uid(), unlock_lesson.lesson_id, unlock_lesson.unlocked_at)
    on conflict (user_id, lesson_id) do nothing
  )
  -- MATERIALIZZA gli esercizi: una riga review_state per ciascun esercizio della
  -- lezione, letti server-side da `exercise` (stage 0, due_at = istante di sblocco).
  -- Nessuna logica di sequenza qui: la successiva è scelta dal dominio.
  insert into public.review_state (user_id, exercise_id, stage, due_at)
  select auth.uid(), e.id, 0, unlock_lesson.unlocked_at
  from public.exercise e
  where e.lesson_id = unlock_lesson.lesson_id
  on conflict (user_id, exercise_id) do nothing;
$$;
```

**Perché una RPC e non due insert dal client.** Lo sblocco scrive DUE tabelle e deve essere ATOMICO: un insert `lesson_progress` seguito da un insert `review_state` NON atomico, se il secondo fallisse, lascerebbe una lezione «sbloccata senza esercizi» — indistinguibile dalla lezione concettuale di 3.14: una menzogna nel read-model. `apply_review` scelse l'RPC per la stessa ragione (atomicità di AD-7). Leggere gli esercizi server-side (come `apply_review` legge `exercise` per lo snapshot) evita di fidarsi di id inviati dal client.

**Perché la sequenza nel dominio, non in SQL.** L'epica impone «nessuna logica in SQL» (`apply_review` non ricalcola niente). `nextLessonToUnlock` è puro e testabile a unità; la RPC resta un materializzatore muto. Sbloccare fuori ordine toccherebbe SOLO i propri dati di studio, già isolati da RLS: è una regola di prodotto (una superficie UI che offre solo la successiva), non un confine di sicurezza — quindi la sua sede è il dominio.

**Perché `due_at` = `unlocked_at` passato dal client.** `apply_review` riceve i timestamp già calcolati (nessun `now()` in SQL). Qui, con `stage = 0`, `due_at` è l'istante di sblocco: un solo parametro serve a entrambe le righe. L'istante entra dal Clock (`clock.now()`), coerente con AD-1 (il tempo è iniettato), e mantiene l'SQL libero da letture di tempo di piattaforma.

**Confine con 3.14/3.15/3.16/3.17 e testabilità.** Qui il ramo vuoto è UNICO (mostra ancora il conteggio grezzo, come 3.12 renderebbe): 3.15 distingue primo-avvio, 3.16 distingue pila-svuotata-con-lezioni ed esaurito e nasconde gli zeri, 3.14 dichiara la lezione senza esercizi, 3.17 aggiunge il tetto. Il CANCELLO (presenza/assenza dei pulsanti) è verificabile con `renderToStaticMarkup` (env `node`); il MECCANISMO (selettore, RPC, `unlockLesson`) con test di dominio/dati/migrazione; la GLUE click→`mutate`→invalidazione è e2e-differita, come la glue `userId` di `AuthRoot` in 3.12 e la scrittura dal vivo di `apply_review` in 3.9 (env `node` non esegue effetti; nessun harness jsdom nel repo).

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (`unlockLesson` implementata ovunque; fake porte estesi; `DashboardScreen` coerente).
- `npm run lint` -- expected: exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; `@tanstack` fuori da `domain`/`ui`; boundaries verdi).
- `npm test` -- expected: exit 0 (selettore `curriculum`; AST di `unlock_lesson`; `unlockLesson` data; cancello dashboard; parità en/it; nessuna regressione ai test 3.12).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

## Auto Run Result

Status: done

**Sintesi del cambiamento.** La storia 3.13 apre l'intera quest di sblocco. Nasce l'autorità sequenziale nel dominio (`nextLessonToUnlock`, puro: la lezione con `ordinal` più basso non ancora sbloccata, o `null` a curriculum esaurito — «non si salta» è garantito strutturalmente). Nasce la RPC atomica e idempotente `unlock_lesson(lesson_id, unlocked_at)`, modellata verbatim su `apply_review`: una sola istruzione `language sql`/`security invoker`/`set search_path=''` che, in una CTE, inserisce la riga `lesson_progress` e poi MATERIALIZZA una riga `review_state` per ciascun esercizio della lezione letto server-side da `exercise` (`stage=0`, `due_at=unlocked_at`), entrambe `on conflict … do nothing` (un ri-sblocco non raddoppia). La scrittura passa dalla porta (`ProgressRepository.unlockLesson`, che chiama `client.rpc(...)` e lancia `DataError('unlockLesson')`), coi timestamp iniettati dal Clock. La dashboard guadagna il CANCELLO delle quest sequenziali (AC4): pila non vuota ⇒ solo svuota-pila; pila vuota con una successiva ⇒ solo l'azione di sblocco (cablata a un `useMutation` che invalida `dueQueryKey`/`['unlocked']` in `onSuccess`); pila vuota a curriculum esaurito ⇒ nessuna azione (la schermata dedicata è 3.16). Restano fuori scope, per autorità dell'epica: gli stati vuoti DISTINTI (3.15/3.16), la dichiarazione della lezione senza esercizi (3.14), il tetto giornaliero (3.17) e la verifica DB dal vivo (e2e differita, AD-12/13).

**File modificati/creati:**
- `src/domain/curriculum.ts` (nuovo) + `.test.ts` (nuovo) — `nextLessonToUnlock` puro + le 5 righe «selettore» della matrix.
- `supabase/migrations/20260925150000_create_unlock_lesson.sql` (nuovo) — la RPC `unlock_lesson`.
- `src/migrations.test.ts` — blocco strutturale AST per `unlock_lesson` (firma, posture di sicurezza, una sola istruzione, insert `review_state` colonna-per-colonna, CTE `lesson_progress` colonna-per-colonna + VALUES, idempotenza, nessuna sequenza/scheduling in SQL, commenti).
- `src/domain/ports/progressRepository.ts` — aggiunto `unlockLesson(lessonId, now): Promise<void>`.
- `src/data/progressRepository.ts` (+ `.test.ts`) — impl `unlockLesson` via `.rpc('unlock_lesson', { lesson_id, unlocked_at: ISO })` + `DataError`; fake `.rpc` e test happy/errore.
- `src/features/dashboard/DashboardScreen.tsx` (+ `.test.tsx`) — cancello + `useMutation`/`useQueryClient` + invalidazione; i tre test del cancello.
- `src/i18n/en.ts` / `it.ts` — `dashboard.unlockAction` (parità en/it).
- `src/features/ports/PortsContext.test.tsx`, `src/app/{AppRoutes,AuthRoot,AuthenticatedShell}.test.tsx` — `unlockLesson` nei fake `ProgressRepository`.

**Ripartizione dei finding (questa passata):** patch applicati 1 (medium); differiti 1 (medium); respinti 14 (medium 1, low 13). Nessun `intent_gap`, nessun `bad_spec`, nessun loopback: `review_loop_iteration` resta 0. L'unico patch ha reso simmetrica la copertura del test AST della migrazione (asserito l'INSERT del CTE su `lesson_progress` colonna-per-colonna + VALUES passthrough). Il differito è lo sblocco fallito silenzioso (nessuna superficie d'errore sulla dashboard), reale ma sequenziato dall'epica agli stati non-felici (3.15/3.16, cfr. DW-23).

**Raccomandazione di follow-up review:** `false`. Contano solo i patch di questa passata: high 0, medium 1, low 0 ⇒ punteggio `3×1 + 1×0 = 3` (< 5 e nessun high).

**Verifica eseguita (dopo il patch, indipendente):**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; `@tanstack` fuori da `domain`/`ui`; boundaries verdi).
- `npm test` — exit 0 (70 file, 716 test; selettore `curriculum`, AST `unlock_lesson`, `unlockLesson` data, cancello dashboard, parità en/it; nessuna regressione 3.12).
- `npm run validate-content` — exit 0 (cancello FR2.6 non regredito).

**Matrix Test Audit:** tutte e 10 le righe coperte da test eseguiti e verdi (5 in `curriculum.test.ts`, 2 in `progressRepository.test.ts`, 3 in `DashboardScreen.test.tsx`).

**Rischi residui.** (1) Sblocco fallito silenzioso (differito): un fallimento della RPC lascia il pulsante senza feedback. (2) La glue click→`mutate`→invalidazione e l'effetto DB dal vivo non sono provati a unità sotto l'harness `node`/`renderToStaticMarkup`: differiti all'e2e come da convenzione del repo (AD-12/13); il meccanismo — selettore, RPC, `unlockLesson` — è coperto a dominio/dati/migrazione. (3) Il ramo vuoto è grezzo (mostra ancora il conteggio) finché 3.15/3.16 non distinguono e rifiniscono gli stati vuoti.
