---
title: 'Story 3.16: Quando non c''è più niente da fare, dirlo'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '06d5c0d713c9ccfecd8b9143af9089a0676d922a'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Quando la pila arriva a zero (`count === 0` con qualcosa GIÀ sbloccato, cioè NON il primo-avvio di 3.15) la dashboard oggi mostra ancora il `pile-counter` con un muto «0» più streak e curriculum. Per chi ha finito è ambiguo: sembra un errore, non «hai terminato». Mancano due stati distinti che l'epica prescrive: pila svuotata **con lezioni disponibili** («hai finito», l'azione diventa sbloccare) e pila a zero a **curriculum esaurito** (unica schermata **senza** azione primaria, che dichiara che non c'è altro). 3.15 ha rimandato ESPLICITAMENTE a 3.16 questi rami `unlocked > 0`.

**Approach:** Far **cambiare stato al `pile-counter`** a zero: a `count === 0` NON rende «0» né `dueLabel`, ma una dichiarazione del PERCHÉ la pila è vuota. La dichiarazione è DERIVATA dallo stato persistito già presente (nessuna nuova lettura): `curriculumCompleteBody` se `next === null` (esaurito); il notice concettuale 3.14 (`noExercisesNotice`) se l'ultima sbloccata è concettuale; altrimenti `clearedBody` («hai svuotato la pila»). Streak e curriculum restano visibili (per un utente di ritorno portano informazione reale, non uno zero). Il cancello 3.13 dell'azione resta invariato: a `next === null` NESSUN pulsante. Due sole chiavi i18n nuove (`clearedBody`, `curriculumCompleteBody`), nessun nuovo componente.

## Boundaries & Constraints

**Always:**
- **Il `pile-counter` a zero cambia stato (AC1).** A `count === 0` (ramo `unlocked > 0`) NON si rende `text-count-hero` né `dueLabel`: al loro posto una dichiarazione del perché è vuoto. A `count > 0` il numero resta invariato.
- **Ogni stato vuoto dichiara il PERCHÉ e offre al più UNA azione (AC3).** La dichiarazione è derivata (AD-5), mai memorizzata, sopravvive al refresh. Priorità del perché: `next === null` ⇒ `curriculumCompleteBody`; altrimenti ultima sbloccata concettuale (`lastUnlocked?.exerciseCount === 0`) ⇒ `noExercisesNotice` (3.14, invariato); altrimenti ⇒ `clearedBody`. Se `next === null` E l'ultima è concettuale, si rendono ENTRAMBE le dichiarazioni (nessuna delle due mente), ma sempre NESSUN pulsante.
- **Curriculum esaurito = unica schermata senza azione (AC2).** `count === 0 && next === null` ⇒ `curriculumCompleteBody` e NESSUN `<button>`. È l'unico stato raggiungibile senza azione primaria.
- **Cancello dell'azione invariato (3.13).** `count > 0` ⇒ solo `primaryAction`; `count === 0 && next !== null` ⇒ solo `unlockAction`; `count === 0 && next === null` ⇒ nessuna. Mai due azioni insieme.
- **Copy neutra, parità en/it.** `clearedBody`/`curriculumCompleteBody` in ENTRAMBI i cataloghi (parità imposta da `i18n.test.tsx`); nessun `!`, emoji, avverbio di lode; `en` resta ASCII (nessun code point ≥ U+2000); nessun colore letterale (solo token del design system). Nessun conteggio nella copy («hai N» vietato).
- **Confini AD-1.** `src/features/dashboard/` importa `domain`/`ui`/`i18n`/`@tanstack/react-query`, MAI `data`. `CONTAINER_HEIGHT` resta condiviso sul `<main>` (nessun salto di layout).

**Block If:**
- _Nessun blocco._ Ogni decisione è fissata dall'epica («tre stati distinti», «pile-counter a zero cambia stato», «ogni stato vuoto dichiara perché») e dai pattern esistenti (cancello 3.13, notice 3.14, `nextLessonToUnlock`/`lastUnlockedLesson`). Nessun input umano né azione esterna al repository.

**Never:**
- NON toccare il ramo di PRIMO AVVIO (3.15, `unlocked === 0`) né il ramo `count > 0`: restano invariati.
- NON cablare l'avvio della sessione (resta 3.18): l'azione a pila vuota è lo sblocco; a curriculum esaurito NON c'è azione.
- NON nascondere streak/curriculum a `count === 0` (portano informazione reale a chi è di ritorno): solo il `pile-counter` cambia stato, non l'intera schermata.
- NON introdurre stato di mutation come sorgente del ramo (sempre derivato da `count`/`next`/`lastUnlocked`, AD-5); nessun nuovo componente `empty-state`/`pile-counter` (composizione inline come nel resto della dashboard); nessun `Date.now()`/`new Date()` (questa storia non tocca il dominio).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pila svuotata, lezioni disponibili | `unlocked>0`, `count 0`, `next≠null`, ultima con esercizi | nessun `text-count-hero`/`dueLabel`; `clearedBody`; UN pulsante `unlockAction`; streak+curriculum resi | — |
| Curriculum esaurito | `unlocked>0`, `count 0`, `next===null` | nessun «0»; `curriculumCompleteBody`; NESSUN pulsante | — |
| Pila svuotata, ultima concettuale, altre disponibili | `count 0`, `lastUnlocked.exerciseCount 0`, `next≠null` | nessun «0»; `noExercisesNotice` (non `clearedBody`); UN pulsante `unlockAction` | — |
| Esaurito e ultima concettuale | `count 0`, `next===null`, `lastUnlocked.exerciseCount 0` | `noExercisesNotice` + `curriculumCompleteBody`; NESSUN pulsante | — |
| Pila piena | `count>0` | ramo esistente: `text-count-hero`=N, `dueLabel`, azione `primaryAction` | — |
| Primo avvio | `unlocked===0` | ramo 3.15 invariato (`firstRunBody`/`startAction`) | — |

</intent-contract>

## Code Map

- `src/features/dashboard/DashboardScreen.tsx:163-224` -- il `return` finale (ramo caricato, `unlocked > 0`). **Sostituire** il `pile-counter` fisso (`:167-168`, `text-count-hero`+`dueLabel`) con un condizionale: `count > 0` ⇒ numero+`dueLabel` (invariato); `count === 0` ⇒ le dichiarazioni del perché (in un `<p className="text-body text-ink-primary">`). **Assorbire** in questo blocco il notice concettuale 3.14 oggi separato (`:190-194`): a `count === 0` renderlo SSE `lastUnlocked?.exerciseCount === 0`, e `clearedBody` SSE l'ultima ha esercizi, e `curriculumCompleteBody` SSE `next === null`. Il **cancello dell'azione** (`:204-223`) resta INVARIATO (già rende `unlockAction` sse `next !== null`, nulla sse `next === null`). Streak (`:171-173`) e curriculum (`:176-178`) restano invariati. Aggiornare il commento d'intestazione (righe 9-15) alla proprietà dei rami vuoti da parte di 3.16.
- `src/i18n/en.ts:33-65`, `src/i18n/it.ts:27-59` -- sezione `dashboard`: **aggiungere** `clearedBody` (dichiara «pila svuotata, niente da rivedere per ora»; `en` ASCII) e `curriculumCompleteBody` (dichiara «tutte le lezioni sbloccate, non ce ne sono altre») in ENTRAMBI (parità). Copy neutra, distinta da `firstRunBody`/`noExercisesNotice`/`unlockAction`.
- `src/features/dashboard/DashboardScreen.test.tsx:290-330` -- **aggiornare** i due test la cui intenzione cambia: «curriculum esaurito» (`:290`) ora deve asserire `curriculumCompleteBody` presente e nessun `text-count-hero`/`>0<`; «pila drenata normale» (`:323`) ora deve asserire `clearedBody` presente. **Aggiungere** un `describe` 3.16: pila svuotata con lezioni ⇒ `clearedBody`+`unlockAction`+nessun «0»; esaurito ⇒ `curriculumCompleteBody`+0 pulsanti+nessun «0»; concettuale+altre ⇒ `noExercisesNotice` non `clearedBody`; parità/no-`!`/ASCII. I test 3.14 che verificano `noExercisesNotice` (`:305-388`) restano verdi (stessa condizione di render).
- `src/domain/curriculum.ts:26-38` -- (SOLO lettura) `nextLessonToUnlock` (`null` a esaurito) e `lastUnlockedLesson` (`null` a nulla sbloccato) sono l'autorità; già calcolati come `next`/`lastUnlocked`. Nessuna modifica.
- `src/app/AuthenticatedShell.test.tsx:37-50`, `src/app/AppRoutes.test.tsx:57-79` -- (SOLO verifica) seminano `count > 0` (ramo numero): non toccati da 3.16.
- `src/ui/theme.css` -- (SOLO lettura) `text-body`/`text-label` esistono; nessun nuovo token.

## Tasks & Acceptance

**Execution:**
- `src/i18n/en.ts` + `src/i18n/it.ts` -- **aggiungere** `dashboard.clearedBody` e `dashboard.curriculumCompleteBody` in entrambi (parità; `en` ASCII; neutra, senza `!`).
- `src/features/dashboard/DashboardScreen.tsx` -- **sostituire** il `pile-counter` a `count === 0` con le dichiarazioni del perché (assorbendo il notice 3.14); cancello dell'azione, streak, curriculum invariati; commento d'intestazione aggiornato.
- `src/features/dashboard/DashboardScreen.test.tsx` -- **aggiornare** i due test con intenzione cambiata; **aggiungere** i test 3.16 (AC1/AC2/AC3) e la copertura delle righe della matrice.

**Acceptance Criteria:**
- **AC1 — Pila svuotata, lezioni disponibili.** *Given* `count === 0`, `unlocked > 0`, `next !== null`, *when* la dashboard è resa, *then* il conteggio NON diventa «0» (nessun `text-count-hero`/`dueLabel`): rende `clearedBody` (o il notice concettuale se l'ultima è concettuale) e l'unica azione primaria è `unlockAction`.
- **AC2 — Curriculum esaurito.** *Given* `count === 0`, `next === null`, *when* è resa, *then* dichiara esplicitamente `curriculumCompleteBody` e NON rende alcun `<button>`; è l'unica schermata dell'app senza azione primaria.
- **AC3 — Ogni stato vuoto dichiara il perché, ≤1 azione.** *Given* uno qualsiasi dei rami vuoti `unlocked > 0`, *then* porta la dichiarazione del perché appropriata (derivata, non memorizzata) e al più un pulsante; il notice concettuale 3.14 resta reso alle sue condizioni.
- **AC4 — Confini / celebrazione / regressione.** *Given* `features/dashboard` e i cataloghi, *then* nessun import di `data`, nessun colore letterale, copy priva di `!`/emoji/lode, parità en/it verde, ramo primo-avvio (3.15) e ramo `count > 0` invariati, notice 3.14 ancora reso alle stesse condizioni; `npm run lint`/`typecheck`/`test` verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 15: (high 0, medium 0, low 15)
- addressed_findings:
  - `[low]` `[patch]` La copy `clearedBody`/`curriculumCompleteBody` (en+it) apriva con «You have»/«Hai», pattern presidiato dai test di microcopy del repo (`not.toContain('you have')`/`'hai '`, framing di possesso). Riformulate senza quelle aperture, significato/neutralità/ASCII invariati; `typecheck`/`lint`/`test` (750/750) verdi.
- reject notevoli (verificati contro il codice reale):
  - **«0 day streak» a pila vuota con log vuoto** (blind-hunter): comportamento PRE-ESISTENTE (a `count === 0` la dashboard rendeva già streak/curriculum prima di 3.16) e SCELTA di design deliberata (a `unlocked > 0` streak è informazione reale per chi è di ritorno, non uno zero degenere da primo-avvio); `streak === 0` è veritiero. Non introdotto da questo diff, non un difetto.
  - **Doppia dichiarazione nel caso «esaurito ed ultima concettuale»** (intent-alignment): decisione deliberata e documentata (Design Notes) — 3.14 AC2 e 3.16 AC2 pretendono ENTRAMBE una dichiarazione in quell'angolo; mostrarle entrambe (entrambe vere, zero azioni) è l'unica lettura che non ne viola nessuna. L'epica «tre stati da non confondere» riguarda i tre stati fra loro, non il numero di dichiarazioni veritiere.
  - **Guard `>to review<` fragile / coperture di test mancanti (boundary count 1→0, ordine DOM, `count>0`+concettuale, parità it della doppia dichiarazione)** (blind-hunter): il verification-gap reviewer ha CONFERMATO indipendentemente la solidità del guard (in `clearedBody` «to review» è preceduto da spazio, mai da `>`); i rami `count>0` non possono rendere corpi vuoti (sono nell'`else`); `count>0`+concettuale è già coperto (test riga 341); la parità en/it è imposta STRUTTURALMENTE da `i18n.test.tsx`. Nit di completezza a valore trascurabile.
  - **click→`mutate`→refetch del pulsante di sblocco non esercitato / `disabled` non testato** (blind-hunter, verification-gap): convenzione documentata del repo (env `node`/`renderToStaticMarkup`, AD-12/13); il pulsante `unlockAction` è quello INVARIATO di 3.13, non toccato da 3.16. Stessa gestione di 3.15.
  - **Verifica sintattica (substring/classe) vs semantica della copy** (intent-alignment): inerente all'harness SSR; il senso della copy è responsabilità della revisione umana dei cataloghi, non asseribile a unità. Non un difetto del diff.
  - **Placeholder `// + AC4 …` nel diff** (blind-hunter): artefatto del riassunto-diff passato al reviewer; il file reale implementa i test (righe 496-535).

## Design Notes

**Perché il `pile-counter` cambia stato invece di una schermata separata.** L'epica dice testualmente che il `pile-counter` «a zero non mostra "0" ma cambia stato» e AC1 parla del *conteggio* che non diventa 0 e dell'*azione* che cambia — entrambi elementi localizzati. A differenza del primo-avvio (3.15, tutto a zero ⇒ schermata pulita), a `unlocked > 0` streak e curriculum portano informazione reale: solo il contatore cambia stato, il resto della dashboard resta. Questa è la lettura minima e fedele; non un gap d'intento.

**Perché tre dichiarazioni a priorità e non un `else` unico.** «Hai svuotato la pila» (`clearedBody`) è vero solo se la pila aveva esercizi e li hai risolti: nel caso concettuale (3.14) la pila non si è mai riempita, quindi lì vale `noExercisesNotice`, mai `clearedBody`. `curriculumCompleteBody` è ortogonale (dipende da `next`), quindi nel raro «concettuale ed esaurito» convivono due dichiarazioni vere. Nessuna delle due mente e resta comunque senza azione.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (chiavi i18n nuove tipizzate).
- `npm run lint` -- expected: exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; boundaries verdi).
- `npm test` -- expected: exit 0 (AC1/AC2/AC3 3.16; parità en/it; nessuna regressione a 3.12/3.13/3.14/3.15 né ai test app).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

## Auto Run Result

Status: done

**Sintesi del cambiamento.** La storia 3.16 fa CAMBIARE STATO al `pile-counter` a zero nel ramo caricato `unlocked > 0`: a `count === 0` la dashboard non rende più il muto «0» (né `text-count-hero` né `dueLabel`), ma DICHIARA il perché la pila è vuota, derivato dallo stato già presente (AD-5), mai memorizzato. Priorità/ortogonalità: `curriculumCompleteBody` sse `next === null` (curriculum esaurito, unica schermata senza azione — AC2); `noExercisesNotice` (3.14, invariato) sse l'ultima sbloccata è concettuale (`exerciseCount === 0`); altrimenti `clearedBody` («pila svuotata» — AC1). «Esaurito» e «concettuale» sono ortogonali: nel raro caso convivono entrambe le dichiarazioni (nessuna mente), sempre senza pulsante. Streak e curriculum restano visibili (a `unlocked > 0` portano informazione reale a chi è di ritorno): cambia SOLO il contatore, non l'intera schermata. Il cancello dell'azione 3.13 resta INVARIATO (`unlockAction` sse `next !== null`, nessun pulsante a `next === null`); il ramo di primo-avvio 3.15 (`unlocked === 0`) e il ramo `count > 0` sono INVARIATI. Due sole chiavi i18n nuove (parità en/it), nessun nuovo componente.

**File modificati:**
- `src/features/dashboard/DashboardScreen.tsx` — il `pile-counter` diventa condizionale: `count > 0` ⇒ numero+`dueLabel` (invariato); `count === 0` ⇒ le dichiarazioni del perché (assorbendo il notice 3.14 prima separato). Cancello azione, streak, curriculum invariati; commento d'intestazione aggiornato alla proprietà dei rami vuoti da parte di 3.16.
- `src/i18n/en.ts` / `it.ts` — `dashboard.clearedBody` e `dashboard.curriculumCompleteBody` in ENTRAMBI (parità), neutre (nessun `!`/emoji/lode), `en` ASCII, nessun conteggio; riformulate in review per non aprire con «You have»/«Hai» (invariante di microcopy del repo).
- `src/features/dashboard/DashboardScreen.test.tsx` — aggiornati i due test con intenzione cambiata (curriculum esaurito ⇒ `curriculumCompleteBody`+nessun «0»; pila drenata normale ⇒ `clearedBody`); aggiunto il `describe` «Storia 3.16» (AC1/AC2/AC3/AC4 + copertura delle 6 righe della matrice + no-`!`/ASCII + parità en/it).

**Ripartizione dei finding (questa passata):** patch applicati 1 (low); differiti 0; respinti 15 (low). Nessun `intent_gap`, nessun `bad_spec`, nessun loopback: `review_loop_iteration` resta 0. L'unico patch (copy che apriva con «You have»/«Hai») è stato riformulato e riverificato.

**Raccomandazione di follow-up review:** `false`. Contano solo i patch di questa passata: high 0, medium 0, low 1 ⇒ punteggio `3×0 + 1×1 = 1` (< 5 e nessun high).

**Verifica eseguita (indipendente, dopo implementazione e dopo il patch):**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; boundaries verdi).
- `npm test` — exit 0 (70 file, 750 test; AC1/AC2/AC3/AC4 3.16; parità en/it; nessuna regressione a 3.12/3.13/3.14/3.15 né ai test app).
- `npm run validate-content` — exit 0.

**Matrix Test Audit:** tutte e 6 le righe della matrice coperte da test eseguiti e verdi — «svuotata, lezioni disponibili» → AC1 (`clearedBody`+`unlockAction`+nessun «0»); «curriculum esaurito» → AC2 (`curriculumCompleteBody`+0 pulsanti); «svuotata, ultima concettuale, altre disponibili» → AC3 (`noExercisesNotice`, non `clearedBody`); «esaurito ed ultima concettuale» → AC3 (entrambe le dichiarazioni, 0 pulsanti); «pila piena» → AC4 (numero invariato); «primo avvio» → describe 3.15 esistente, ancora verde.

**Rischi residui.** (1) La glue click→`mutate`→refetch del pulsante di sblocco non è esercitata sotto l'harness `node`/`renderToStaticMarkup`: convenzione documentata del repo (AD-12/13), differita all'e2e; il pulsante è quello INVARIATO di 3.13. (2) Il gap PRE-ESISTENTE `unlockMutation` senza `onError` resta registrato nel `deferred` di 3.15 (condiviso col pulsante 3.13); 3.16 non aggiunge un nuovo trigger. (3) A `count === 0` con log vuoto la dashboard può rendere «0 day streak»: comportamento pre-esistente e scelta deliberata (streak è informazione reale per un utente di ritorno).
