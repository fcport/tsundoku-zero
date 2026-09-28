# L'audit screen reader della sessione (storia 7.6)

Questo documento è il **record di audit** dell'accessibilità con **screen reader
reale** della schermata di esercizio. Segue lo stesso precedente durevole di
`docs/session-keyboard-contract.md` (AD-15) e di `docs/i18n-boundary.md` (AD-14):
un file di contratto/record con un test che ne verifica esistenza e contenuti.

## Scopo e ambito

Il **contratto di accessibilità** della sessione — furigana in
`<rt aria-hidden="true">` così che una voce giapponese legga la frase UNA volta e
non due; `lang="ja"` sul giapponese; **UNA sola** live region `aria-live="polite"`
che annuncia esito e avanzamento; ordine di lettura
**consegna → frase → opzioni → esito → spiegazione** — è **costruito** e **coperto
da test** di componente/jsdom. Ma quei test girano contro markup statico: asseriscono
gli **attributi** DOM/ARIA, non ciò che uno screen reader reale con voce giapponese
**pronuncia** davvero.

L'unica affermazione di accessibilità che **nessun test automatico può fare** — che
uno screen reader vero percorre la sessione in modo comprensibile e legge la frase
**una sola volta** — è l'oggetto di questo audit. L'agente scrive e verifica tutto
**offline** (inventario, comportamento atteso, procedura); l'**operatore** esegue lo
screen reader reale e ne registra l'esito nella sezione «Esito misurato». Finché non
lo fa, «accessibile» resta **ragionato, non misurato**.

**Ambito:** il **percorso della sessione di esercizio**. Fuori ambito le voci a11y
app-wide differite (vedi «Voci note adiacenti»): sono citate come contorno che
l'operatore può verificare opportunisticamente, non come Acceptance Criteria della 7.6.

## Inventario della copertura automatica ESISTENTE

Questi test girano oggi e asseriscono gli **attributi** DOM/ARIA. Ambiente `node`
(`vitest.config.ts`), resa statica con `renderToStaticMarkup` — nessun runtime di
screen reader:

- **`src/ui/JapaneseText.test.tsx`** — ogni `<rt>` reso porta `aria-hidden="true"`
  (il match `bareRt` fallisce se un `<rt>` è nudo); l'involucro resta `lang="ja"`
  anche a furigana nascosta; il contenuto dell'`<rt>` è la kana **verbatim**, mai
  romaji.
- **`src/features/study/SessionScreen.test.tsx`** — rende **esattamente una** live
  region `aria-live="polite"` nel ramo di sessione attiva; è `sr-only` e **vuota**
  prima della risposta; **nessuna** `aria-live` su scheletro, completamento o stato
  vuoto (così resta una sola per l'intera sessione).
- **`src/features/study/SessionScreen.keyboard.test.tsx`** — la live region annuncia
  **esito + avanzamento** dopo la risposta; una risposta **errata** annuncia
  `session.outcome.incorrect` e **mai** `session.outcome.correct` (copre il ramo
  `incorrect`).
- **`src/features/study/session-keyboard-contract.test.ts`** — verifica il documento
  del **contratto tastiera** (`docs/session-keyboard-contract.md`): ordine di lettura
  = tab-order = ordine dei tasti numerici, anello di focus, `Enter` avanza / `Esc`
  esce, UNA sola `aria-live="polite"`.
- **`src/features/study/ExerciseCard.test.tsx`** — la **presenza** dei nodi della
  card (la consegna/prompt; la frase come `JapaneseText`, con `lang="ja"` + `<ruby>`;
  il **numero** di opzioni per kind), l'ordine **solo fra le opzioni** (`answerOptions`,
  `indexOf` ordinato) e gli stati reveal/esito/spiegazione. **NON** verifica l'ordine
  di lettura **top-level** consegna → frase → opzioni → esito → spiegazione: non fa
  alcun confronto di posizione fra quei nodi.
- **`src/features/study/ProgressMeter.test.tsx`** — `role="progressbar"` con
  `aria-label` / `aria-valuenow` / `aria-valuemin` / `aria-valuemax`.

**L'ordine di lettura top-level fra i nodi della card (consegna → frase → opzioni →
esito → spiegazione) NON è asserito da alcun test automatico** — nessun test confronta
le posizioni di quei nodi fra loro. È precisamente parte di ciò che l'audit manuale
misura (AC2): un lettore reale percorre i nodi nell'ordine del DOM, e solo l'operatore
può udire se l'ordine risultante è comprensibile.

**L'esperienza a runtime con screen reader reale è l'UNICA affermazione di
accessibilità NON coperta da alcun test automatico.** Nessuno dei test qui sopra
esegue una voce TTS o un lettore di schermo: asseriscono l'artefatto DOM, non la
pronuncia. È precisamente ciò che l'operatore misura in «Esito misurato» (AC3). Il
test companion `src/features/study/session-screen-reader-audit.test.ts` verifica
questo **documento** (l'artefatto), non il comportamento a runtime.

## Comportamento atteso (ragionato dal codice)

Ragionato dal codice reale, ancorato. Sono **aspettative** che l'operatore conferma
o smentisce; non sono misurazioni.

### AC1 — la frase giapponese è letta UNA volta

- In `src/ui/JapaneseText.tsx:57-74` l'involucro è `<span lang="ja">` (`:59`) — il
  giapponese è dato, non passa da i18n (AD-14/UX-DR24) — reso **sempre**, anche a
  furigana nascosta.
- Ogni annotazione ruby è `<rt aria-hidden="true">` (`:65`) con `<rp>` di ripiego a
  parentesi (`:64,66`). Motivazione nel commento del contratto (`:12-16`, UX-DR28):
  uno screen reader con voce giapponese legge già il testo base; un `<rt>` **non**
  nascosto lo farebbe leggere **due volte** (base + lettura kana).
- **Attesa:** con voce giapponese, la frase è pronunciata **una** volta — il testo
  base — e la furigana (`<rt>`) **non** è vocalizzata.

### AC2 — ordine comprensibile consegna → opzioni → esito → spiegazione

L'ordine di lettura **completo** dei nodi è consegna → **frase (AC1)** → opzioni →
esito → spiegazione. AC2 osserva l'ordine degli elementi che **nomina** — consegna,
opzioni, esito, spiegazione; la **frase** giapponese è competenza di AC1 (letta una
volta) e sta fra la consegna e le opzioni. Le due formulazioni descrivono la stessa
sequenza del DOM, viste da AC diversi.

- L'ordine semantico dei nodi della card è, in `src/features/study/ExerciseCard.tsx:109-174`:
  consegna (`<p>` con la chiave i18n del kind, `:112`) → **frase giapponese**
  (`JapaneseText`, `:116-118`) → `<ul>` di `<button aria-pressed>`, uno per opzione,
  nell'ordine del dominio (`:126-154`) → «mostra la spiegazione» (`:159-167`) →
  `ExplanationPanel` (`:171-173`).
- `src/features/study/ExplanationPanel.tsx:38-63` rende, a risposta data, l'esito
  **testuale** (`session.outcome.correct` | `incorrect`, `:42-46`) e il testo della
  spiegazione con `lang` sulla lingua **effettiva** resa (`:52`) — così una voce
  legge italiano/inglese con la lingua giusta, non trattato come giapponese.
- L'ordine di lettura = tab-order = ordine dei tasti numerici è fissato dal contratto
  tastiera (`docs/session-keyboard-contract.md`, sezioni 1 e 4).
- **Attesa:** navigando col lettore, i nodi sono annunciati in quest'ordine, senza
  salti né inversioni; ogni opzione è un bottone con stato `aria-pressed`.

### AC3 — l'avanzamento è annunciato dalla live region unica

- In `src/features/study/SessionScreen.tsx:454-503`, il ramo di **sessione attiva**
  rende `<main>` → `ProgressMeter` → `ExerciseCard` → «prossimo esercizio» → «esci» e
  **UNA sola** `<p aria-live="polite" className="sr-only">` (`:498-502`).
- Alla risposta la live region annuncia **esito + avanzamento**: p.es. «That answer is
  correct. 1 of 5 completed» — `session.outcome.*` più
  `session.progress.announce` («{{completed}} of {{total}} completed», in
  `src/i18n/en.ts:164-196`). Prima della risposta è **vuota** (stringa vuota).
- La `ProgressMeter` (`src/features/study/ProgressMeter.tsx`) porta in parallelo
  `role="progressbar"` con `aria-valuenow`/`min`/`max` per lo stato numerico.
- È `sr-only`: l'esito visibile lo dà già l'`ExplanationPanel`, l'avanzamento la barra;
  la live region serve alla sola assistive technology. **Non** è resa su
  scheletro/completamento/vuoto — così resta esattamente una per l'intera sessione.
- **Attesa:** dopo aver risposto, il lettore annuncia da solo l'esito e «X di N
  completati» da una sola live region `aria-live="polite"`, una volta sola e senza
  doppioni (nessun annuncio duplicato indice di più d'una live region).

## Procedura manuale riproducibile

L'operatore esegue questa procedura con uno screen reader reale e una voce TTS
giapponese, poi compila «Esito misurato» e «Difetti».

### 1. Abilitare uno screen reader con voce giapponese

Il comportamento di `aria-live` e la commutazione di `lang` sono **dipendenti dal
browser**: usare un abbinamento screen reader ↔ browser raccomandato, così l'audit è
riproducibile.

- **Windows — NVDA:** installare NVDA; installare/attivare una voce TTS giapponese
  (p.es. Windows OneCore giapponese, o una voce Vocalizer/eSpeak con supporto `ja`).
  In NVDA → Preferenze → Impostazioni → Voce, verificare che il giapponese venga
  vocalizzato (NVDA usa la lingua del documento; l'involucro `lang="ja"` la guida).
  **Abbinamento raccomandato: NVDA + Firefox oppure NVDA + Chrome.**
- **macOS — VoiceOver:** Preferenze di Sistema → Accessibilità → VoiceOver;
  aggiungere una voce giapponese (Kyoko/Otoya) in VoiceOver Utility → Speech.
  VoiceOver commuta lingua sui nodi con `lang="ja"`. **Abbinamento raccomandato:
  VoiceOver + Safari.**

### 2. Avviare l'app e raggiungere una sessione

- `npm run dev` contro un progetto **Supabase reale** (nessun backend finto/locale —
  AD-12/AD-13: un solo progetto reale).
- Accedere con un account che abbia **almeno la prima lezione sbloccata**, così da
  raggiungere una sessione con esercizi. Avviare la sessione fino a vedere una card
  (consegna + frase giapponese + opzioni).

### 3. Percorrere la sessione

Con lo screen reader attivo:

1. **Consegna → frase → opzioni.** Navigare dall'alto (consegna, poi la frase
   giapponese, poi le opzioni). Ascoltare come viene letta la **frase giapponese**:
   annotare se il testo base è letto **una** volta o se la lettura kana (`<rt>`) viene
   vocalizzata, facendola sentire **due** volte.
2. **Rispondere** (click o tasto numerico `1`-`9`, cfr. contratto tastiera).
3. **Esito → spiegazione → avanzamento.** Verificare che il lettore annunci l'esito
   («That answer is correct/not correct.») e l'avanzamento («X of N completed»)
   dalla live region, e che la spiegazione sia letta nella **lingua giusta**
   (`lang` sul nodo). Annotare se l'esito + avanzamento è annunciato **UNA volta (non
   ripetuto/doppio)**: un annuncio duplicato rivela a runtime il fallimento «più di una
   live region / annuncio duplicato» che il test automatico non può cogliere
   (specularmente al check «frase letta una volta vs due» di AC1).
4. Osservare l'**ordine** complessivo: consegna → opzioni → esito → spiegazione,
   senza salti.

## Esito misurato

> **DA ESEGUIRE dall'operatore.** Questa sezione è vuota di risultati finché uno
> screen reader reale non ha percorso la sessione. NON fabbricare risultati: l'agente
> non può eseguire uno screen reader né udire una voce TTS giapponese.

**Come registrare.** Per ogni AC, sostituire il segnaposto `_da eseguire_` nella
colonna «Esito misurato» con **ESITO: PASS** oppure **ESITO: FAIL** più una breve nota
testuale di ciò che si è sentito (p.es. «PASS — frase letta una sola volta, kana non
vocalizzata»), e compilare l'ultima colonna con **data / browser / screen reader /
voce** usati. Non lasciare celle a metà: o `_da eseguire_` (non ancora misurato) o un
esito PASS/FAIL con nota.

| AC | Aspettativa | Esito misurato | Data / browser / SR / voce |
| --- | --- | --- | --- |
| **AC1** | La frase giapponese è pronunciata **una** volta (non due); `<rt>` non è vocalizzato. | _da eseguire_ | _da eseguire_ |
| **AC2** | Ordine comprensibile: consegna → opzioni → esito → spiegazione, senza salti. | _da eseguire_ | _da eseguire_ |
| **AC3** | L'avanzamento («X di N completati») è annunciato dall'unica live region `aria-live="polite"`. | _da eseguire_ | _da eseguire_ |

## Difetti

> **DA COMPILARE dall'operatore durante il run reale.** Registrare qui ogni
> discrepanza fra il comportamento atteso e ciò che lo screen reader ha fatto
> davvero (p.es. frase letta due volte, ordine invertito, avanzamento non annunciato).
> Se nessun difetto emerge, dichiararlo esplicitamente. Nessun difetto è
> pre-registrato: la lista è vuota finché l'operatore non misura.

- _(nessun difetto registrato — da compilare al run)_

## Definizione di completo e quando ri-eseguire

- **Completo quando:** tutte e tre le righe AC («Esito misurato») hanno un esito
  registrato (PASS/FAIL con nota) **e** i difetti sono elencati, oppure è dichiarato
  esplicitamente «nessun difetto». Finché una riga AC resta `_da eseguire_`, l'audit è
  incompleto.
- **Ri-eseguire dopo ogni modifica a:** `src/ui/JapaneseText.tsx` (ruby /
  `aria-hidden` — superficie di AC1), `src/features/study/ExerciseCard.tsx` o
  `src/features/study/ExplanationPanel.tsx` (ordine di lettura — superficie di AC2), o
  la live region in `src/features/study/SessionScreen.tsx` (annuncio esito/avanzamento
  — superficie di AC3). È la convenzione dei documenti-contratto durevoli del repo
  (`docs/session-keyboard-contract.md`, `docs/i18n-boundary.md`): il record diventa
  **stale** quando la sua superficie di codice cambia, e va rimisurato.

## Voci note adiacenti (fuori ambito 7.6)

Queste voci a11y **app-wide** erano state parcheggiate «per l'audit 7.6», ma **non**
sono negli Acceptance Criteria della 7.6 (il percorso della sessione). Sono
**code-change** di altre storie, non ciò che la 7.6 chiede; correggerle è fuori
scope. L'operatore, mentre ha lo screen reader attivo, **può** verificarle
opportunisticamente e annotarle, ma la loro correzione appartiene alle storie
proprietarie:

- **DW-10** (`_bmad-output/implementation-artifacts/deferred-work.md:79-85`) — anello
  di focus visibile (`focus-visible`) mancante sugli interattivi **app-wide**
  (auth/settings/shell). Nella sessione l'anello di focus è invece presente
  (contratto tastiera, sezione 5).
- **DW-14** (`_bmad-output/implementation-artifacts/deferred-work.md:113-118`) —
  wiring a11y della **conferma distruttiva** (cancellazione account): manca
  `aria-expanded` sul grilletto, la gestione del focus alla transizione di fase e
  l'annuncio live del cambio di stato.
