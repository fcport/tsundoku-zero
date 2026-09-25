---
title: 'Story 3.18: Un esercizio per volta, con la sua consegna'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '659355293d6f69adccf3b9da81da3a3ec971d362'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      SessionScreen (come la dashboard) non gestisce lo stato d'errore del read-model:
      se dueQ/exercisesQ falliscono (DataError da porta, retry:false) la query resta
      senza data e la schermata mostra lo scheletro all'infinito.
    evidence: |-
      Entrambe le query decidono lo scheletro solo su `data === undefined`, mai su
      `isError`/`error`. Stessa lacuna trasversale già tracciata in DW-23/DW-24/DW-25
      per la dashboard; l'intento di 3.18 (AC1-4) non copre il percorso d'errore.
      Va affrontato con la storia dedicata allo stato d'errore del read-model.
    location: >-
      src/features/study/SessionScreen.tsx:65,90
    severity: medium
  - summary: >-
      Le opzioni di risposta sono rese come <button aria-pressed> indipendenti senza
      semantica di scelta singola (radiogroup/radio), senza nome accessibile del
      gruppo, e senza associazione programmatica fra consegna, frase e opzioni.
    evidence: |-
      ExerciseCard rende un <ul> di <button aria-pressed>. AC3 di 3.18 (nessun
      colore-solo, etichetta+posizione, >=56px) e' soddisfatto, ma il contratto a11y
      di sessione (ordine di tabulazione, tasto numerico -> opzione, associazione
      numero<->posizione) e' un aggiornamento di AD-15 esplicitamente di competenza
      di 3.22 (L'intera sessione senza mouse); l'anello di focus visibile e' gia'
      DW-10, di competenza dell'audit screen-reader 7.6.
    location: >-
      src/features/study/ExerciseCard.tsx:71-85
    severity: medium
  - summary: >-
      La card presenta le opzioni come scelta a tap-singolo che blocca; per assemble
      (ordinamento) e select-span (span) non compone una risposta valida, e per
      assemble mostra la frase-bersaglio completa sopra le tessere (ne rivela l'ordine).
    evidence: |-
      `selected` e' un singolo indice/opzione: modella single-select. La composizione
      per-tipo (ordinamento delle tessere, span sui segmenti) e la valutazione
      dell'esito sono 3.19 (Rispondere, e sapere perche'), dove la risposta e'
      effettivamente costruita e misurata; li' va anche deciso se assemble mostra la
      frase-bersaglio (in 3.18 non c'e' esito, quindi nessuna misura da falsare).
    location: >-
      src/features/study/ExerciseCard.tsx; src/features/study/SessionScreen.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** La sessione di esercizi non esiste ancora. L'azione primaria della dashboard («svuota-pila») è inerte (l'`onClick` è riservato a 3.18), non c'è una schermata che presenti un esercizio, e `ContentRepository` sa leggere solo i riassunti delle lezioni (`listLessons`), non gli esercizi completi. Serve la PRIMA schermata di sessione: dalla pila dei dovuti, presentare **un esercizio per volta** con la sua **consegna** e il contenuto giapponese, rendere le **opzioni di risposta** (numero determinato dal tipo, ordine deterministico, ≥56px, nessuna distinta per solo colore), e **bloccare** la risposta una volta data (transizione a senso unico).

**Approach:** Aggiungere una rotta `/studia` + `SessionScreen` che legge la STESSA chiave `['due', userId]` (AD-5), carica gli esercizi via un nuovo metodo `ContentRepository.listExercisesByIds`, e presenta l'esercizio corrente tramite un `ExerciseCard` presentazionale e controllato. L'ordine deterministico delle opzioni è una funzione PURA di dominio (`answerOptions`), che riusa `alignFurigana` (segmenti) e un hash `fnv1a` estratto da `schedule.ts` in un modulo condiviso. Il pulsante della dashboard è cablato nel livello app (`AuthenticatedShell` via `useNavigate`), non nelle features. FUORI SCOPE: esito/spiegazione/persistenza/avanzamento (3.19), barra di avanzamento/abbandono (3.20), schermata di completamento (3.21), contratto tastiera (3.22), responsive (3.23).

## Boundaries & Constraints

**Always:**
- **Scope 3.18 = presenta + seleziona + blocca.** La card ha DUE stati a senso unico in questa storia: `consegna` (nessuna risposta) → `risposta data` (una scelta committata). Il terzo stato (`spiegazione`), l'esito, la persistenza e l'avanzamento sono 3.19.
- **Nuovo metodo del port.** `listExercisesByIds(ids: readonly string[]): Promise<readonly ExerciseContent[]>` su `ContentRepository`, con `export interface ExerciseContent { readonly id: string; readonly exercise: Exercise }`. L'`id` è quello della RIGA DB (la chiave della pila dovuti); l'`Exercise` di dominio NON porta id (l'identità è DERIVATA, AD-23). Solo `src/data/` lo implementa. `ids` vuoto ⇒ `[]` SENZA query (`.in('id', [])` è degenere).
- **Mappa riga→Exercise riusa `exerciseSchema.parse` (fonte UNICA di validazione, AC1 di 2.2).** Il candidato = payload jsonb (`sentence`/`answer`/`distractors` per single-select) PIÙ `kind` (colonna), `grammarPoint` (da `grammar_point`), `explanation` (`{ en, it? }` da `explanation_en`/`explanation_it`, `it` OMESSO se `null` — forma d'oro di FR8.5). `parse` verifica kind/forma; su `ok:false` o riga malformata (`id`/`grammar_point`/`explanation_en` non stringa, `payload` non oggetto) ⇒ `DataError('listExercisesByIds', …)` (reject, alimenta TanStack), come `listLessons`.
- **Ordine deterministico nel DOMINIO, mai nella UI (AC2).** `answerOptions(exercise): readonly string[]` puro: `single-select` ⇒ `[answer, ...distractors]` permutato per `fnv1a(\`${deriveExerciseId(exercise)}:${opt}\`)` (tie-break lessicografico, stabile); `assemble` ⇒ le tessere (`answer`) permutate allo STESSO modo (mai in ordine di risposta); `select-span` ⇒ i testi dei segmenti di `alignFurigana(kanji, kana)` in ordine NATURALE (già deterministico). Il numero di opzioni deriva dal tipo, mai fisso.
- **Una sola definizione dell'hash.** ESTRARRE `fnv1a` da `src/domain/schedule.ts` in `src/domain/hash.ts` e importarlo in ENTRAMBI (`schedule.ts` e `exercise-presentation.ts`); refactor puro, i test di `schedule` restano verdi (mirror dell'estrazione di `calendarDay` in 3.17).
- **Contenuto giapponese via primitivo esistente (AC1).** Rendere la frase con `ui/JapaneseText` alimentato da `alignFurigana(sentence.kanji, sentence.kana)` e `furiganaVisible(exercise)` (predefinito VISIBILE). Ruolo tipografico ESISTENTE come interim (es. `text-display`); il ruolo `sentence-hero` (32/26px, interlinea 1.9, responsive) è 3.23 — NON definire `--text-sentence-hero` (rompe `design-tokens.test.ts`), vedi [[DW-19]].
- **`ExerciseCard` PRESENTAZIONALE e CONTROLLATO.** Props `{ exercise: Exercise; selected: string | null; onSelect: (option: string) => void }`. Rende: la consegna (chiave i18n per `kind`), `<JapaneseText>`, e un `<button>` per ciascuna `answerOptions(exercise)`. Stato `consegna` (`selected === null`): opzioni ABILITATE. Stato `risposta data` (`selected !== null`, AC4): TUTTE le opzioni `disabled` (senso unico), l'opzione scelta `aria-pressed="true"`, le altre `"false"`. Nessuna distinzione per solo colore (nessun verde/rosso; etichetta e posizione portano l'informazione, AC3); ogni opzione `min-h-[56px]` (AC3). La card è l'UNICA superficie `surface-raised`.
- **`SessionScreen` possiede l'UNICO `<main>` di `/studia`,** lo `useState` di `selected` (senso unico), e legge l'esercizio corrente via dominio `currentExerciseId(createSession(dueIds))` (MAI indicizzando la coda). Caricamento ⇒ scheletro `aria-busy` (stesso pattern della dashboard). Usa `usePorts()` (`content`/`review`/`clock`); `userId` come prop.
- **Rotta e navigazione nel livello app (AD-1).** Aggiungere `STUDY_PATH = '/studia'` in `routes.ts`; una `<Route path={STUDY_PATH} element={<SessionScreen userId={userId} />} />` SOTTO `<RequireAuth>` PRIMA del catch-all `path="*"`. Nessuna stringa di path nelle features: `DashboardScreen` acquisisce la prop `onStartSession: () => void` (cablata SOLO sul pulsante svuota-pila, ramo `count > 0`); `AuthenticatedShell` la fornisce via `useNavigate()` ⇒ `navigate(STUDY_PATH)`.
- **i18n:** NUOVO namespace `session` con `prompt` per i tre `kind`, in ENTRAMBI i cataloghi (parità imposta da `i18n.test.tsx`). `en` ASCII; niente `{{count}}` (pluralizzatore); niente `!`/emoji/avverbi di lode/CJK.
- **Confini AD-1.** `features/study` e `features/dashboard` importano `domain`/`ui`/`i18n`/`@tanstack/react-query`/`react-router`, MAI `data`; `features` non importa `features`. `ui/JapaneseText` invariato. Dominio puro: nessun `Date.now()`/`new Date()` senza argomenti, `Intl…resolvedOptions()`, `Math.random()`.

**Block If:**
- _Nessun blocco._ Ogni decisione è fissata dall'epica (registro chiuso dei tre tipi 2.2, presentazione uno-per-volta, opzioni per tipo, ≥56px, nessuna grammatica della celebrazione) e dai pattern esistenti (`listLessons`/`DataError`, `alignFurigana`/`furiganaVisible`, cancello e scheletro della dashboard, estrazione `calendarDay` di 3.17). Nessuna migrazione, nessuna azione umana o esterna al repository.

**Never:**
- NON calcolare l'esito (`outcomeOf`/uso di `check` per il feedback), NON rendere il pannello spiegazione, NON generare il `review_id` client, NON invocare `apply_review`, NON fare aggiornamenti ottimistici di conteggio/barra (tutto 3.19).
- NON rendere la barra di avanzamento, NON gestire l'abbandono (Esc/indietro) né la ricostruzione/conteggio residuo della sessione (3.20); NESSUNA schermata di completamento/zero (3.21).
- NESSUN contratto tastiera completo (tasti numerici/ordine di tab/live region, 3.22); NESSUN breakpoint responsive/thumb-zone/lavoro specifico dark-mode oltre i token esistenti (3.23).
- NON cablare lo store Zustand `sessionStore` né il dispatch `reviewed` (l'avanzamento è 3.19); NON mettere logica di coda/scheduling nello store o nella schermata.
- NON definire `--text-sentence-hero`/il ruolo `sentence-hero` (3.23, [[DW-19]]). NESSUN campo `id` sul tipo di dominio `Exercise`. Nessun verde/rosso/emoji/`!`. NESSUNA seconda definizione di `fnv1a`. NON leggere `lesson_progress` né cambiare la chiave `['due', userId]`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| single-select presentata | `exercise` single-select, `selected=null` | consegna + `<JapaneseText>` + `(1 + distractors.length)` bottoni opzione, ordine deterministico, ciascuno `min-h-[56px]`, abilitati | — |
| assemble presentata | `exercise` assemble, `selected=null` | consegna + `answer.length` opzioni (tessere) in ordine deterministico (permutato, non l'ordine-risposta) | — |
| select-span presentata | `exercise` select-span, `selected=null` | consegna + `alignFurigana(kanji,kana).length` opzioni (segmenti) in ordine naturale | — |
| risposta data (senso unico) | `selected` = un'opzione | tutte le opzioni `disabled`; la scelta `aria-pressed="true"`, le altre `"false"` (AC4) | — |
| ordine deterministico | stesso `exercise`, due chiamate `answerOptions` | sequenza IDENTICA; la permutazione dipende da `deriveExerciseId` (esercizi diversi ⇒ in genere ordine diverso) | — |
| caricamento | `userId` null OPPURE `dueQ`/`exercisesQ` pending | scheletro `<main aria-busy="true">`, nessuno spinner | — |
| pila vuota (deep-link) | `dueIds = []` | stato neutro senza card (il completamento è 3.21) | — |
| id corrente assente dal caricato | `currentId` non presente nella mappa esercizi | stato neutro senza card (bordo di contenuto) | — |
| riga exercise malformata | `payload` non oggetto / `kind` fuori registro / `grammar_point`/`explanation_en` non stringa | `DataError('listExercisesByIds')` (reject) | reject ⇒ stato d'errore TanStack |
| ids vuoti | `listExercisesByIds([])` | `[]` senza colpire il DB | — |
| `explanation_it` null | riga con `explanation_it` = null | `exercise.explanation = { en }` (`it` OMESSO) | — |

</intent-contract>

## Code Map

- `src/app/routes.ts:11` -- **aggiungere** `export const STUDY_PATH = '/studia';` (fonte unica dei path; commento coerente con «le rotte vere sostituiscono il catch-all»).
- `src/app/AppRoutes.tsx:61-75` -- **aggiungere** dentro `<Route element={<RequireAuth …/>}>`, PRIMA di `path="*"`, `<Route path={STUDY_PATH} element={<SessionScreen userId={userId} />} />`. Import di `STUDY_PATH` e `SessionScreen`. `userId` è già una prop di `AppRoutes`.
- `src/app/AuthenticatedShell.tsx:16-19,44-59` -- **importare** `useNavigate` (`react-router`) e `STUDY_PATH` (`./routes`); `const navigate = useNavigate();`; passare `onStartSession={() => navigate(STUDY_PATH)}` a `<DashboardScreen>` (riga 59). Firma di `AuthenticatedShell` INVARIATA (la navigazione è interna).
- `src/features/dashboard/DashboardScreen.tsx:55-69,288-296` -- **aggiungere** prop `onStartSession: () => void` a `DashboardScreenProps`; wire `onClick={onStartSession}` sul pulsante `primaryAction` (svuota-pila, ramo `count > 0`). Aggiornare il commento d'intestazione (l'avvio sessione ora è cablato). NON toccare gli altri rami.
- `src/domain/ports/contentRepository.ts:13,42-49` -- **importare** `type { Exercise } from '../exercise'`; **dichiarare** `export interface ExerciseContent { readonly id: string; readonly exercise: Exercise }` e **aggiungere** `listExercisesByIds(ids: readonly string[]): Promise<readonly ExerciseContent[]>` all'interfaccia (docstring: id = chiave pila; Exercise senza id, identità derivata AD-23).
- `src/data/contentRepository.ts:25-27,116-141` -- **implementare** `listExercisesByIds`: `.from('exercise').select('id, kind, payload, grammar_point, explanation_en, explanation_it').in('id', ids)`; `ids` vuoto ⇒ `[]` senza query; errore Supabase ⇒ `DataError('listExercisesByIds', error)`; mappare ogni riga con `toExerciseContent`. **Aggiungere** `interface ExerciseRow` e `toExerciseContent(row): ExerciseContent` (assembla il candidato e chiama `exerciseSchema.parse`; guardie + `DataError` come `toLessonSummary`). Nuova costante `EXERCISE_COLUMNS`.
- `src/data/contentRepository.test.ts` -- **estendere** il finto client (cattura `from('exercise')`, filtro `.in`, riga `payload`) e **aggiungere** i `describe` per `listExercisesByIds` (mappa per i tre kind; `explanation_it` null ⇒ `{ en }`; `ids` vuoto ⇒ `[]` senza query; errore/riga malformata ⇒ `DataError`).
- `src/domain/exercise.ts:139-165` -- **riusare** `exerciseSchema`/`Exercise` (validazione, AC1) e `furiganaVisible` (predefinito furigana). INVARIATO.
- `src/domain/exercise-identity.ts:79-81` -- **riusare** `deriveExerciseId` come SEME della permutazione delle opzioni. INVARIATO.
- `src/domain/furigana.ts:33-36,74-95` -- **riusare** `alignFurigana` (segmenti per il contenuto e per le opzioni select-span) e il tipo `FuriganaSegment`. INVARIATO.
- `src/domain/schedule.ts:102-125` -- **rimuovere** la definizione privata `fnv1a` e **importarla** da `./hash`; `fraction` la usa invariata (refactor puro).
- `src/domain/hash.ts` -- **NUOVO**. `export function fnv1a(input: string): number` (copiato VERBATIM da `schedule.ts`, FNV-1a 32-bit puro).
- `src/domain/hash.test.ts` -- **NUOVO**. Determinismo (stessa stringa ⇒ stesso valore), stringhe diverse ⇒ (in genere) valori diversi, stringa vuota, un vettore pinnato.
- `src/domain/exercise-presentation.ts` -- **NUOVO**. `export function answerOptions(exercise: Exercise): readonly string[]` (switch chiuso con guardia `never`); helper interno `orderByHash(options, exercise)`.
- `src/domain/exercise-presentation.test.ts` -- **NUOVO**. Per i tre kind: conteggio corretto; determinismo (stessa sequenza a chiamate ripetute); single-select include answer+distractors; assemble include tutte le tessere; select-span = testi dei segmenti di `alignFurigana` in ordine naturale; permutazione dipendente dall'identità.
- `src/ui/JapaneseText.tsx:38-74` -- **riusare** (props `segments`+`showFurigana`). INVARIATO.
- `src/features/study/ExerciseCard.tsx` -- **NUOVO**. Presentazionale/controllato (vedi Boundaries). Usa `useTranslation`, `answerOptions`, `alignFurigana`, `furiganaVisible`, compone `<JapaneseText>`.
- `src/features/study/ExerciseCard.test.tsx` -- **NUOVO**. Stato consegna (consegna presente, `<JapaneseText>` reso, N opzioni per kind, `min-h-[56px]`, nessun verde/rosso, abilitate) e stato risposta-data (`selected` impostato ⇒ opzioni `disabled`, scelta `aria-pressed="true"`).
- `src/features/study/SessionScreen.tsx` -- **NUOVO**. Container: `usePorts()`, query `['due', userId]` (`dueQueryKey`, `enabled: !!userId`) e `['exercises', dueIds]` (`enabled` quando `dueQ.data` è definito e `dueIds.length > 0`), scheletro/neutro/card, `useState` `selected`.
- `src/features/study/SessionScreen.test.tsx` -- **NUOVO**. `userId` null ⇒ scheletro; due+exercises seminati ⇒ card dell'esercizio corrente (consegna, opzioni); due vuoto ⇒ neutro; un solo `<main>`.
- `src/features/study/sessionStore.ts:38-42` -- **NON cablato** in questa storia (l'avanzamento è 3.19); la lettura corrente usa i puri `createSession`/`currentExerciseId`.
- `src/domain/session.ts:42-93` -- **riusare** `createSession`/`currentExerciseId` (letture pure della coda). INVARIATO.
- `src/domain/due.ts:44-46` -- **riusare** `dueQueryKey` (chiave unica della pila, AD-5). INVARIATO.
- `src/i18n/en.ts:88-103` / `src/i18n/it.ts` -- **aggiungere** `session.prompt.{singleSelect,selectSpan,assemble}` in parità (`en` ASCII).
- `src/app/AppRoutes.test.tsx:47-52,60-106` -- **aggiungere** `listExercisesByIds` a `inertPorts.content`; seminare `['exercises', ['a']]`; **aggiungere** un `describe` per `/studia` (autenticato ⇒ rende `SessionScreen`/consegna; anonimo ⇒ bloccato).
- `src/app/AuthenticatedShell.test.tsx:33-38,62-77` -- **avvolgere** il `render` in `<MemoryRouter>` (ora usa `useNavigate`); **aggiungere** `listExercisesByIds` a `inertPorts.content`.
- `src/features/dashboard/DashboardScreen.test.tsx:33-41,142-151` -- **aggiungere** `listExercisesByIds` a `inMemoryPorts.content`; passare `onStartSession={() => {}}` nel render helper.
- `src/app/AuthRoot.test.tsx:47` / `src/features/ports/PortsContext.test.tsx:54-55` -- **aggiungere** `listExercisesByIds` ai finti `content`.

## Tasks & Acceptance

**Execution:**
- `src/domain/hash.ts` (+ `hash.test.ts`) -- estrarre `fnv1a`; `src/domain/schedule.ts` importarlo (refactor puro).
- `src/domain/exercise-presentation.ts` (+ `exercise-presentation.test.ts`) -- `answerOptions` per i tre kind con ordine deterministico e conteggio da tipo.
- `src/domain/ports/contentRepository.ts` + `src/data/contentRepository.ts` (+ `contentRepository.test.ts`) -- `ExerciseContent` + `listExercisesByIds`, mappa via `exerciseSchema.parse`, `DataError` su malformato, `ids` vuoto ⇒ `[]`.
- `src/features/study/ExerciseCard.tsx` (+ `ExerciseCard.test.tsx`) -- card presentazionale controllata, due stati a senso unico, opzioni ≥56px senza colore-solo.
- `src/features/study/SessionScreen.tsx` (+ `SessionScreen.test.tsx`) -- container: due→exercises→card corrente, scheletro/neutro, `selected`.
- `src/app/routes.ts` + `src/app/AppRoutes.tsx` (+ `AppRoutes.test.tsx`) -- `STUDY_PATH` e rotta `/studia` sotto `RequireAuth`.
- `src/app/AuthenticatedShell.tsx` (+ `AuthenticatedShell.test.tsx`) -- `useNavigate`→`onStartSession`; test avvolto in Router.
- `src/features/dashboard/DashboardScreen.tsx` (+ `DashboardScreen.test.tsx`) -- prop `onStartSession` sul pulsante svuota-pila.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- namespace `session.prompt` in parità.
- Finti `content` di app/ports -- allineare al nuovo metodo (`AuthRoot.test.tsx`, `PortsContext.test.tsx`, e i due sopra).

**Acceptance Criteria:**
- **AC1 — Consegna + giapponese.** *Given* una sessione avviata con almeno un dovuto, *when* la `SessionScreen` è resa, *then* la card mostra la consegna (da `t('session.prompt.*')` per il `kind`) e la frase giapponese resa da `<JapaneseText>` con i segmenti di `alignFurigana` e la visibilità di `furiganaVisible`.
- **AC2 — Opzioni per tipo, deterministiche.** *Given* un esercizio, *when* è reso, *then* il numero di opzioni è determinato dal `kind` (single-select `1 + |distractors|`, assemble `|answer|`, select-span `|segmenti|`), non fisso, e l'ordine è deterministico (`answerOptions` ritorna la stessa sequenza a chiamate ripetute).
- **AC3 — Opzioni accessibili.** *Given* le opzioni rese, *then* ciascuna ha `min-h-[56px]` e nessuna si distingue per il solo colore (nessun verde/rosso; etichetta e posizione portano l'informazione).
- **AC4 — Senso unico.** *Given* un esercizio con `selected !== null`, *when* la card è resa, *then* ogni opzione è `disabled` (non si può cambiare) e la scelta ha `aria-pressed="true"`, le altre `"false"`.
- **AC5 — Caricamento esercizi.** *Given* un elenco di id, *when* `listExercisesByIds` è invocato, *then* ritorna `ExerciseContent[]` (`{ id, exercise }`) mappati via `exerciseSchema.parse` (con `explanation` `{ en, it? }`); `ids` vuoto ⇒ `[]` senza query; riga/payload malformato ⇒ `DataError('listExercisesByIds')`.
- **AC6 — Confini / celebrazione / regressione.** *Given* il diff, *then* `features` non importa `data`; dominio puro (nessun global temporale/casuale, `fnv1a` in una sola sede); parità en/it verde, `en` ASCII, copy senza `!`/emoji/lode; rotte esistenti, dashboard (3.12-3.17) e `ui/JapaneseText` invariati nei comportamenti; `npm run lint`/`typecheck`/`test`/`validate-content` verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 1, low 2)
- defer: 3: (high 0, medium 3, low 0)
- reject: 17: (high 0, medium 0, low 17)
- addressed_findings:
  - `[low]` `[patch]` Consegna single-select italiana con apostrofo mancante (`src/i18n/it.ts`): «Scegli l opzione…» → «Scegli l'opzione…» (apici doppi, come `account.delete.error`). Copy utente + regola ortografica; `en` resta ASCII e invariato.
  - `[medium]` `[patch]` Selezione basata sul VALORE stringa (`aria-pressed={selected === option}` in `ExerciseCard.tsx`): testi opzione duplicati (tessere/segmenti/particelle ripetute, realistici in assemble/select-span) marcavano più bottoni come premuti. Passata a selezione per INDICE (`selected: number | null`, `onSelect(index)`, `aria-pressed={selected === i}`; `SessionScreen` `useState<number|null>`; test AC4 per indice). Più coerente con AC3 («la posizione porta l'informazione») e garantisce ESATTAMENTE un `aria-pressed="true"`.
  - `[low]` `[patch]` Riga vuota spuria in `src/data/contentRepository.test.ts` (dentro il test `listLessons` «exercise count non numero»): rimossa.
- reject notevoli (verificati contro il codice reale):
  - **Glue di navigazione dashboard→/studia non testata** (verification-gap): il click `onClick={onStartSession}` → `navigate(STUDY_PATH)` è glue d'effetto non eseguibile sotto `renderToStaticMarkup`/node (nessun jsdom/Playwright nello stack), differita alla verifica live per convenzione del repo, come `changeLocale`/`unlockMutation`/`deleteAccount` nelle storie precedenti. La rotta `/studia` è comunque coperta (AppRoutes.test) e il pulsante è reso (presenza copy).
  - **AC4 «senso unico» provato via markup e non via evento** (intent-alignment): la card è controllata e `disabled` impedisce il secondo click a livello DOM (`onClick` è `undefined` quando risposta data); l'irreversibilità è enforced dall'attributo, la verifica comportamentale è live per convenzione.
  - **Stato vuoto/deep-link a pila zero mostra un `<main>` neutro senza messaggio** (blind/edge): la schermata di completamento/zero è esplicitamente 3.21 («Arrivare a zero»); il pulsante svuota-pila appare solo a `count > 0`, quindi il percorso felice non raggiunge il vuoto. Fuori dall'intento di 3.18.
  - **`.in('id', ids)` non deduplica / `toExerciseContent` non verifica appartenenza** (blind/edge): `id` è PK, `.in` ritorna un sottoinsieme senza duplicati; il caso «id corrente assente dal caricato» è già coperto in `SessionScreen`.
  - **Payload jsonb che sovrascrive kind/grammarPoint/explanation** (edge): le colonne vincono per costruzione (autoritative) e il generatore di seed non emette mai quei campi nel payload; comportamento corretto.
  - Altri respinti: `key={i}` (ordine deterministico, coerente con `JapaneseText`), stabilità della chiave `['exercises', dueIds]` (hashing strutturale di TanStack), DRY dello scheletro, brittleness dell'asserzione `red`/`green`, test di render in italiano (la parità en/it copre l'esistenza delle chiavi), accoppiamento router della shell (sempre montata sotto Router), stati d'errore read-model e semantica a11y del gruppo opzioni e composizione per-tipo (questi ultimi tre DEFERiti, non respinti).

### 2026-09-25 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 16: (high 0, medium 0, low 16)
- addressed_findings:
  - none
- note: pass di conferma su spec `done` (`followup_review_recommended: true` del pass precedente). Quattro layer rilanciati (blind, edge-case, verification-gap, intent-alignment). L'edge-case hunter non ha trovato nulla; gli altri hanno risollevato in gran parte gli stessi rilievi già adjudicati.
- reject notevoli (verificati contro codice reale e intento):
  - **select-span: span di dominio (`{start,end}`) vs opzioni per-segmento con selezione a indice** (blind + intent-alignment): l'intento prescrive ESPLICITAMENTE `select-span` ⇒ testi dei segmenti di `alignFurigana` in ordine naturale, conteggio `|segmenti|`, e mette esito/composizione FUORI SCOPE (3.19). L'implementazione è fedele all'unica lettura che l'intento autorizza; la riconciliazione indice→span è già il **deferred #3** del frontmatter, non un difetto di 3.18.
  - **Glue dashboard→/studia non testata end-to-end** (verification-gap): l'intero stack di test è `node`/SSR (nessun jsdom), quindi il click→`navigate(STUDY_PATH)` è glue d'effetto non eseguibile nei test unitari, differita alla verifica live per convenzione del repo (come `changeLocale`/`unlockMutation`/`deleteAccount`). La rotta `/studia` e il rendering di `SessionScreen` sono comunque coperti (AppRoutes.test); il pulsante è reso. Già respinta nel pass precedente.
  - **Heading/landmark del `<main>` di sessione e nome accessibile dello scheletro** (blind): coincidono col pattern della dashboard che l'intento cita esplicitamente («stesso pattern della dashboard»): la dashboard non ha `<h1>` sul suo `<main>` e il suo scheletro asserisce l'ASSENZA di `role="status"`. È una convenzione a livello di app, l'a11y di sessione è già DEFERita (deferred #2 → audit 7.6/3.22).
  - **Stato neutro = `<main>` vuoto senza messaggio** (blind/edge): l'intento prescrive esplicitamente «stato neutro senza card» per pila vuota (deep-link) e per id corrente assente; la schermata di completamento/zero è 3.21.
  - Altri respinti (cosmetici/qualità-test, nessuna conseguenza utente nello scope 3.18, molti già adjudicati): comparator di `orderByHash` che ritorna magnitudini invece di ±1 (numericamente corretto), DRY dello scheletro duplicato nei due rami, chiave `['exercises', dueIds]` con array fresco (hashing strutturale), test colore con sottostringa `red`/`green` over-broad, ternario `onClick` ridondante con `disabled`, copy del prompt single-select, test anonimo `/studia` che asserisce assenza e non redirect, mancanza di test di round-trip `listExercisesByIds`→`answerOptions`, mancanza di test con opzioni a testo duplicato (la selezione per INDICE lo garantisce strutturalmente), mancanza di guard che l'`explanation` non trapeli (rendering spiegazione è 3.19).

## Design Notes

**L'ordine delle opzioni è dominio, non UI.** Se ogni schermata permutasse le opzioni per conto suo, due superfici mostrerebbero ordini diversi e i test perderebbero stabilità. `answerOptions` vive nel dominio (puro), la card RENDE ciò che riceve — stessa disciplina di `session.ts` (la coda) e `JapaneseText` (i segmenti). La permutazione è seminata da `deriveExerciseId` così è STABILE per esercizio ma non «risposta prima»; per `assemble` questo evita di regalare la sequenza corretta.

**`fnv1a` in una sola sede.** `schedule.ts` già usa FNV-1a per la dispersione delle scadenze; l'ordine delle opzioni ha bisogno dello stesso hash deterministico. Estrarlo in `hash.ts` (mirror dell'estrazione di `localDayOrdinal`→`calendarDay.ts` in 3.17) evita due definizioni che un giorno divergono; i test di `schedule` restano verdi perché è un refactor puro.

**`ExerciseContent { id, exercise }`.** Il tipo di dominio `Exercise` NON porta id: l'identità è DERIVATA dal contenuto (AD-23) e l'id della RIGA DB è la chiave autoritativa della pila (potrebbe differire dall'id derivato se il contenuto cambiasse). La sessione indicizza per id DB (`currentExerciseId`), quindi il port accoppia i due senza inquinare `Exercise`.

**Rotta + navigazione nel livello app.** I path vivono in `routes.ts` (nessuna stringa sparsa); `features` resta senza `react-router` per la navigazione — la dashboard riceve `onStartSession`, la shell la cabla con `useNavigate`. Una rotta reale (`/studia`) prepara l'abbandono con «indietro» di 3.20 e tiene il ciclo osservabile dall'URL. La `SessionScreen` legge la STESSA chiave `['due', userId]` (AD-5): niente id passati per router-state, nessuna pila ricalcolata.

**Lettura pura della coda invece dello store.** Lo store Zustand (3.4) serve all'EVOLUZIONE stateful (dispatch `reviewed`), che nasce con l'esito in 3.19. Per la sola presentazione 3.18 basta `currentExerciseId(createSession(dueIds))`: puro, senza effetto di `start` al mount, quindi testabile in SSR (`renderToStaticMarkup` non esegue effetti). Lo store si cabla in 3.19.

**Opzioni di select-span = segmenti.** Per uniformità (un'unica via di rendering delle opzioni) i segmenti di `alignFurigana` sono resi come opzioni ≥56px; la frase resta mostrata sopra come contesto. Un'interazione inline più ricca (tap sulla frase) non è richiesta dagli AC di 3.18. Questa è la prima messa in opera reale di `alignFurigana` sul contenuto di esercizio (frase campione 果物 → segmento 0), cfr. [[DW-18]]/[[DW-15]] (aggancio al cancello di validazione, fuori scope qui).

**Tipografia interim della frase.** In attesa di `sentence-hero` (3.23) si usa un ruolo esistente (`text-display`): definire il token ora romperebbe `design-tokens.test.ts` che ne verifica l'ASSENZA ([[DW-19]]).

**Esempio (opzione della card):**
```tsx
<button
  type="button"
  aria-pressed={selected === option}
  disabled={selected !== null}
  onClick={selected === null ? () => onSelect(option) : undefined}
  className="min-h-[56px] rounded-md border border-border-strong bg-surface-base text-ink-primary p-3 text-body"
>
  {option}
</button>
```

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (nuovo metodo del port, `ExerciseContent`, chiavi i18n `session.*`, props `onStartSession`).
- `npm run lint` -- expected: exit 0 (`features` non importa `data`; dominio senza global temporali/casuali; boundaries verdi).
- `npm test` -- expected: exit 0 (AC1-AC6; `answerOptions` per kind; `listExercisesByIds` mappa/DataError; card due stati; rotta `/studia`; parità en/it; nessuna regressione a `schedule`, dashboard 3.12-3.17, app e ports).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

## Auto Run Result

Status: done (pass di review di follow-up su spec `done`; nessuna modifica al codice applicata in questo pass).

### Sintesi del cambiamento implementato
La storia 3.18 introduce la PRIMA schermata di sessione (`/studia` + `SessionScreen`): dalla pila dei dovuti (`['due', userId]`, AD-5) presenta UN esercizio per volta con la sua consegna e il contenuto giapponese, rende le opzioni di risposta (numero derivato dal tipo, ordine deterministico di dominio, ≥56px, nessuna distinzione per solo colore) e blocca la risposta a senso unico una volta scelta. Il codice era già committato in `148e616`; questo pass ne ha eseguito una review indipendente a quattro layer e confermato lo stato `done`.

### File cambiati (rispetto al baseline `659355293d6f69adccf3b9da81da3a3ec971d362`)
- `src/app/routes.ts` -- nuova costante `STUDY_PATH = '/studia'`.
- `src/app/AppRoutes.tsx` (+ `AppRoutes.test.tsx`) -- rotta `/studia` sotto `RequireAuth`, prima del catch-all.
- `src/app/AuthenticatedShell.tsx` (+ `AuthenticatedShell.test.tsx`) -- `useNavigate` → `onStartSession` verso `STUDY_PATH`; test avvolto in `MemoryRouter`.
- `src/features/dashboard/DashboardScreen.tsx` (+ `DashboardScreen.test.tsx`) -- prop `onStartSession` cablata sul pulsante svuota-pila (ramo `count > 0`).
- `src/domain/ports/contentRepository.ts` -- `ExerciseContent { id, exercise }` + `listExercisesByIds`.
- `src/data/contentRepository.ts` (+ `contentRepository.test.ts`) -- implementazione `listExercisesByIds` via `exerciseSchema.parse`, `DataError` su malformato, `ids` vuoto ⇒ `[]` senza query.
- `src/domain/hash.ts` (+ `hash.test.ts`) -- estrazione pura di `fnv1a` da `schedule.ts`.
- `src/domain/schedule.ts` -- importa `fnv1a` da `./hash` (refactor puro).
- `src/domain/exercise-presentation.ts` (+ `exercise-presentation.test.ts`) -- `answerOptions` per i tre kind (conteggio dal tipo, ordine deterministico).
- `src/features/study/ExerciseCard.tsx` (+ `ExerciseCard.test.tsx`) -- card presentazionale controllata, due stati a senso unico, selezione per INDICE.
- `src/features/study/SessionScreen.tsx` (+ `SessionScreen.test.tsx`) -- container: due→exercises→card corrente, scheletro/neutro, `selected`.
- `src/i18n/en.ts` / `src/i18n/it.ts` -- namespace `session.prompt` in parità.
- Finti `content` allineati al nuovo metodo (`AuthRoot.test.tsx`, `PortsContext.test.tsx`).

### Ripartizione dei rilievi di review (questo pass)
- Patch applicati: 0.
- Item deferiti (nuovi): 0 — le lacune sostanziali (stato d'errore del read-model, semantica a11y del gruppo opzioni, composizione per-tipo select-span/assemble) sono GIÀ tracciate nei deferred #1-3 del frontmatter e non sono state riaperte.
- Item respinti: 16 (tutti low). Vedi `## Review Triage Log` (2026-09-25, follow-up) per i reject notevoli, verificati contro il codice reale e l'intento: select-span span-vs-indice (fedele all'intento, riconciliazione = 3.19/deferred #3), glue di navigazione non unit-testabile (SSR/node, verifica live per convenzione), heading/nome accessibile dello scheletro (coincidono col pattern dashboard, a11y deferita a 7.6/3.22), stato neutro vuoto (prescritto dall'intento, completamento = 3.21), più rilievi cosmetici/qualità-test.

### Raccomandazione di follow-up
`followup_review_recommended: false`. Conteggio dei soli rilievi `patch` di questo pass = 0 (high 0, medium 0, low 0); punteggio `3×0 + 1×0 = 0` (< 5). L'edge-case hunter non ha trovato nulla; gli altri layer hanno risollevato rilievi già adjudicati. Nessun ulteriore ciclo di review necessario.

### Verifica eseguita
Nessuna modifica al codice in questo pass, quindi il working tree `src/` è identico a `148e616`. Rieseguite comunque le quattro verifiche dichiarate, tutte verdi:
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0.
- `npm test` -- exit 0 (76 file, 850 test passati).
- `npm run validate-content` -- exit 0 (nessun problema in `content/lessons`).

### Rischi residui
- **select-span**: le opzioni sono i singoli segmenti scelti per indice, mentre la risposta di dominio è uno span `{start,end}` (potenzialmente multi-segmento). Fedele all'intento di 3.18 (presenta+seleziona+blocca), ma la composizione/valutazione va riconciliata in 3.19 (già deferred #3).
- **Verifica interattiva**: click dashboard→`/studia` e transizione a senso unico dopo il tap sono glue d'effetto verificabili solo live (stack di test node/SSR); la rotta e i rami di rendering sono coperti dai test SSR.
- **Stato d'errore del read-model** (`dueQ`/`exercisesQ` che falliscono ⇒ scheletro infinito): lacuna trasversale già tracciata (deferred #1), da affrontare con la storia dedicata.

