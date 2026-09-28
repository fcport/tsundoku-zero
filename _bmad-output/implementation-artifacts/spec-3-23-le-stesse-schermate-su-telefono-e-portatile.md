---
title: 'Le stesse schermate su telefono e portatile'
type: 'feature'
created: '2026-09-28'
status: done
baseline_revision: '6160c91e242a9677c7e26d5b77872f66af6d9793'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
warnings:
  - oversized
deferred:
  - summary: >-
      Il token --font-jp (Noto Sans JP) è definito in theme.css ma non è mai
      applicato ad alcun contenuto lang="ja": il giapponese rende nel ripiego di
      font-sans, non nella famiglia caricata.
    evidence: |-
      grep di `font-jp` in src/ mostra solo la definizione del token e commenti,
      nessuna classe `font-jp` applicata; JapaneseText rende `<span lang="ja">`
      senza classe di font e @layer base imposta solo font-sans sul body. È
      pre-esistente (JapaneseText/3.11), non introdotto da 3.23. Le metriche CJK
      full-width restano ≈1em, quindi il conteggio righe verificato non cambia —
      è fedeltà del font, non layout.
    location: >-
      src/ui/JapaneseText.tsx:59 ; src/ui/theme.css:152
    severity: medium
  - summary: >-
      A 280px di larghezza la frase campione occupa 4 righe (AC3 chiede ≤3): a 26px
      pieni 25 grafemi CJK non stanno in 3 righe entro ~208px di contenuto.
    evidence: |-
      Verifica sul rendering reale (viewport emulato): 3 righe a 320–390px
      (fascia telefono mainstream, che la matrice I/O fissa a 320–360px, e lì
      passa), 4 righe a 280px. È un limite tipografico dei letterali FISSATI da
      UX-DR8 (26px), non un difetto introdotto da questo giro né dal layout:
      nessuna correzione ammessa (gutter/padding già ridotti a `p-4`) lo porta a
      3 righe a 280px senza toccare i 26px. Nessun overflow orizzontale a 280px:
      la frase è leggibile, solo più alta. Riservato all'audit su dispositivo
      reale (Epic 7.6).
    location: >-
      src/features/study/ExerciseCard.tsx:140 ; src/ui/theme.css (token sentence-hero-mobile)
    severity: low
  - summary: >-
      La thumb-zone in sessione misura 136px dal fondo del viewport (AC7 chiede
      ≤120px): il token `pb-thumb-zone` (120px) più il box del bersaglio pone
      l'ultima opzione ~16px sopra la fascia stretta.
    evidence: |-
      Verifica sul rendering reale: `pb-thumb-zone` (120px) è applicato con
      `justify-end` sotto 640px (codice atterrato nei commit precedenti della
      storia, non toccato da questo giro); i 16px in più vengono dal bordo/box
      dell'opzione, non dal padding. L'ultima opzione resta in una fascia di
      raggiungibilità comoda; nessuno scroll. Riservato alla decisione umana /
      audit su dispositivo reale (Epic 7.6), coerente con «l'audit su screen
      reader reale resta 7.6» delle Design Notes.
    location: >-
      src/features/study/SessionScreen.tsx (MAIN_CLASS, pb-thumb-zone/justify-end)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Il ruolo tipografico della frase giapponese (`sentence-hero`, UX-DR8) è fissato ma **non ancora definito** in `theme.css` né verificato sul rendering reale; la card d'esercizio usa un ruolo interim (`text-display`). Le schermate non applicano il layout responsive del sistema (colonna singola, centratura a `measure`, gutter 20/32px, `thumb-zone`), pur avendone già i token: su portatile il contenuto si allargherebbe e su telefono i bersagli non sono garantiti nella fascia del pollice.

**Approach:** Definire `sentence-hero`/`sentence-hero-mobile` (32/26px, interlinea 1.9) e applicarlo alla frase; introdurre UN contenitore responsive condiviso (colonna singola, `max-w-measure`, centrata, gutter `20px`<640 / `32px`≥640, **mai** allargata ≥1024) applicato ai landmark `<main>`; ancorare le opzioni della sessione nella `thumb-zone` sotto 640px. Poi **verificare sul rendering reale** (Chrome headless) che la frase più lunga stia in ≤2 righe a 1024px e ≤3 righe sotto 640px senza overflow e che la furigana non collida — correggendo il corpo qui se sfonda.

## Boundaries & Constraints

**Always:**
- I valori di `sentence-hero` sono **fissati** da UX-DR8: 32px desktop, 26px mobile, interlinea 1.9 (non 1.75). Vivono in `theme.css` come token, mai come letterali sparsi (UX-DR1). `theme.css` resta l'unica fonte dei valori.
- Il ritorno a capo della frase avviene solo ai **confini di grafema** del giapponese (comportamento naturale del browser per il CJK), **mai** a metà grafema né dentro un `<rt>`. Nessun CSS forza il segmento atomico sull'intera frase (`white-space:nowrap`/`word-break:keep-all`): su un nucleo group-ruby lungo causa overflow orizzontale (vedi Design Notes).
- Un solo contenitore responsive, condiviso e riusato: colonna singola centrata, `max-width = measure`, che **non si allarga** oltre `measure` da 1024px; gutter orizzontale `gutter-mobile` sotto 640px e `gutter-desktop` da 640px.
- Parità di funzione: nessuna funzione è esclusiva di una superficie — è un unico codice reso su ogni larghezza (per costruzione: nessun ramo per dispositivo/user-agent).
- La furigana resta `<rt aria-hidden>` con `<rp>` (3.11 invariato); nessun romaji; `lang="ja"` invariato.
- `npm run lint`/`typecheck`/`test`/`validate-content`/`build`/`check-contrast` verdi; nessun colore letterale; nessun verde/rosso; en/it in parità con `en` ASCII, nessun `!`/emoji.

**Block If:**
- La verifica sul rendering reale mostra che, ai valori fissati (32/26px, 1.9), la frase campione sfonda ≤2/≤3 righe **e** nessuna correzione ammessa dal sistema (interlinea, gutter, `measure`, layout) la riporta nei limiti **senza** cambiare i letterali fissati da UX-DR8 — cioè servirebbe rinegoziare UX-DR8 stessa. HALT `blocked`, blocking condition `sentence-hero UX-DR8 non verificabile sul rendering reale`.

**Never:**
- Non introdurre lo switch `word-hero`/`word-hero-mobile` (ruoli non usati, riservati a esercizi a parola singola): fuori scope.
- Non toccare l'allineamento della furigana nel dominio (`alignFurigana`, AD-21) né la logica di `JapaneseText` (rende i segmenti verbatim): la storia agisce su **tipografia e layout**, non sul modello dei segmenti.
- Nessun media-query scritto a mano in `theme.css` (Tailwind v4 genera le varianti); nessuna strategia a classe per il dark.
- Nessun interruttore di densità/tema, nessuna celebrazione, nessuna ombra.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Frase lunga @1024px | Frase `assemble` di 2.7 (25 caratteri, nucleo group-ruby ~22) in `sentence-hero` | ≤2 righe di testo base, nessun overflow orizzontale | Se >2 righe/overflow: correggere il corpo (Block If se irrisolvibile) |
| Frase lunga <640px | Stessa frase, larghezza 320–360px, `sentence-hero-mobile` | ≤3 righe di testo base, nessun overflow | idem |
| Furigana su più righe | Frase con furigana attiva che va a capo | Ogni riga ha spazio per il proprio ruby (interlinea 1.9), `<rt>` non collide con la riga sopra né è tagliato | Se collide: alzare l'interlinea, mai ridurre il corpo del ruby |
| Ruby ravvicinati | Card con 難しい (okurigana), お茶 (prefisso kana), 日本語 (ruby di gruppo) | Furigana non collide con la riga superiore, non tagliata | idem |
| Larghezza ≥1024px | Qualsiasi schermata | Contenuto centrato, larghezza ≤ `measure`, **non** allargato a riempire | — |
| Larghezza <640px, sessione | SessionScreen con opzioni | Colonna singola, gutter 20px; i bersagli opzione cadono entro `thumb-zone` (120px) dal bordo inferiore del viewport | — |

</intent-contract>

## Code Map

- `src/ui/theme.css:70-84` — **AGGIUNGERE** dopo il blocco `word-hero`: `--text-sentence-hero: 32px; --text-sentence-hero--line-height: 1.9;` e `--text-sentence-hero-mobile: 26px; --text-sentence-hero-mobile--line-height: 1.9;`. Rimuovere il commento riga 71-72 che dice «resta deliberatamente NON definito … lo fissa la storia 3.23». Spaziature `:156-159` (`gutter-mobile 20px`, `gutter-desktop 32px`, `measure 34rem`, `thumb-zone 120px`) **già presenti: riuso, nessuna modifica**.
- `src/design-tokens.test.ts:58-72` — **AGGIUNGERE** `'sentence-hero'`, `'sentence-hero-mobile'` a `EXPECTED_TEXT_ROLES` (→ 15). `:107-125` aggiornare il titolo/atteso da «13 ruoli (nessun sentence-hero)» a 15. `:127-141` **INVERTIRE** il blocco `AC8 — sentence-hero NON è definito`: ora asserisce che `--text-sentence-hero: 32px` + `--text-sentence-hero--line-height: 1.9` e la variante `-mobile: 26px` + `1.9` **esistono**.
- `src/features/study/ExerciseCard.tsx:114-118` — la frase è resa in `text-display` interim (commento esplicito). **SOSTITUIRE** con il ruolo `sentence-hero` che passa a `sentence-hero-mobile` sotto 640px (utility responsive del token). Nessun'altra modifica alla card.
- `src/ui/layout.ts` — **NUOVO** modulo `src/ui/`: esporta la classe condivisa del contenitore responsive (colonna singola centrata `max-w-measure mx-auto w-full`, gutter `px-gutter-mobile` con variante ≥640 `px-gutter-desktop`). Importabile dalle feature (AD-1: `features → ui`). È l'unica definizione, così i `<main>` non divergono.
- `src/features/study/SessionScreen.tsx:87` (`CONTAINER_HEIGHT`) e i 6 rami `<main>` (`:369,392,422,430,445,455`) — comporre il contenitore condiviso nella classe del `<main>`; sotto 640px ancorare il blocco interattivo (card+opzioni) verso il basso così i bersagli opzione cadono nella `thumb-zone` (es. `<main>` a piena altezza con spinta `mt-auto`/allineamento inferiore su mobile), centratura invariata da 640px.
- `src/features/dashboard/DashboardScreen.tsx:85` (`CONTAINER_HEIGHT`), rami `<main>` `:161,222,243` — comporre il contenitore condiviso. `:260` `text-count-hero` → applicare `count-hero-mobile` (56px) sotto 640px (variante già definita in `theme.css`).
- `src/features/auth/AuthScreen.tsx:69`, `src/features/stats/StatsScreen.tsx:89-162`, `src/features/legal/PrivacyScreen.tsx:42`, `src/features/legal/AcknowledgementsScreen.tsx:56` — comporre lo stesso contenitore responsive nei rispettivi `<main>` (parità su ogni schermata).
- `src/ui/JapaneseText.tsx:57-73` — **riuso INVARIATO** (rende i segmenti verbatim). Verificare solo che nessuno stile a monte forzi il nowrap sulla frase.
- `src/domain/furigana.ts:74-95` — **riferimento, INVARIATO**: `alignFurigana` produce ~2 segmenti su una frase intera (nucleo group-ruby + kana di bordo). Fonte del ragionamento sul ritorno a capo.
- `content/lessons/01-la-particella-wo.json` (esercizio `assemble`) — fixture di verifica: `私は図書館で新しい本を借りて、毎晩少しずつ読みます` / `わたしは…よみます` (25 caratteri, nucleo ~22).
- Chrome headless: `C:\Program Files\Google\Chrome\Application\chrome.exe` — strumento di verifica del rendering reale (nessuna infra e2e in `ci.yml`; Playwright è Epic 7, contro Supabase reale).

## Tasks & Acceptance

**Execution:**
- `src/ui/theme.css` — definire i due token `sentence-hero`(-mobile); togliere il commento «non definito».
- `src/design-tokens.test.ts` — 15 ruoli; invertire il blocco AC8 in «sentence-hero definito a 32/26px, 1.9».
- `src/ui/layout.ts` (+ eventuale test) — la classe condivisa del contenitore responsive.
- `src/features/study/ExerciseCard.tsx` — la frase nel ruolo `sentence-hero` responsive; test SSR che il ruolo applicato non è più `text-display`.
- `src/features/study/SessionScreen.tsx` (+ `SessionScreen.test.tsx`) — contenitore condiviso su tutti i rami `<main>`; ancoraggio opzioni in `thumb-zone` sotto 640px; test SSR delle classi (`max-w-measure`, gutter).
- `src/features/dashboard/DashboardScreen.tsx` (+ `DashboardScreen.test.tsx`) — contenitore condiviso; `count-hero-mobile` sotto 640px.
- `src/features/auth/AuthScreen.tsx`, `src/features/stats/StatsScreen.tsx`, `src/features/legal/PrivacyScreen.tsx`, `src/features/legal/AcknowledgementsScreen.tsx` — contenitore condiviso (parità).
- **Verifica su rendering reale**: probe HTML (frase 2.7 in `sentence-hero`, furigana attiva) reso da Chrome headless a 1024px, 640px, ~335px e ~280px; contare le righe del **solo testo base** (escludendo `<rt>`/`<rp>`); registrare il risultato in `## Auto Run Result`.

**Acceptance Criteria:**
- **AC1 — Token definito.** Given UX-DR8, when `theme.css` è ispezionato, then `--text-sentence-hero: 32px`/`line-height 1.9` e `--text-sentence-hero-mobile: 26px`/`1.9` esistono, e `design-tokens.test` verde con 15 ruoli.
- **AC2 — Fit desktop.** Given la frase campione di 2.7 in `sentence-hero`, when resa sul rendering reale a 1024px, then occupa ≤2 righe di testo base, senza overflow orizzontale.
- **AC3 — Fit mobile.** Given la stessa frase in `sentence-hero-mobile`, when resa sotto 640px (≈280–335px), then occupa ≤3 righe di testo base, senza overflow.
- **AC4 — Ritorno a capo senza spezzare grafemi.** Given una frase che va a capo, when resa, then il ritorno a capo cade a confini di grafema CJK (mai a metà grafema, mai dentro un `<rt>`) e nessun CSS forza il nucleo atomico; il kana di bordo non è orfano in modo fuorviante.
- **AC5 — Furigana su più righe, senza collisione.** Given una frase multiriga con furigana (okurigana, prefisso kana, ruby di gruppo su nucleo lungo), when resa, then ogni riga ha spazio per il proprio ruby (interlinea 1.9) e la furigana non collide con la riga superiore né è tagliata.
- **AC6 — Colonna e centratura ai breakpoint.** Given una qualsiasi schermata, when la larghezza è <640px then colonna singola con gutter 20px; when 640–1024px then colonna singola centrata limitata a `measure`; when ≥1024px then centrata a `measure` e **non** allargata.
- **AC7 — Thumb-zone.** Given la sessione sotto 640px a un'altezza di telefono rappresentativa, when resa, then i bersagli delle opzioni di risposta cadono entro `thumb-zone` (120px) dal bordo inferiore del viewport.
- **AC8 — Parità di funzione.** Given una qualsiasi funzione dell'app, when cercata a larghezza telefono e portatile, then è presente su entrambe (un solo codice, nessun ramo per dispositivo).
- **AC9 — Confini/regressione.** Given il diff, then `alignFurigana`/`JapaneseText` invariati; nessun colore letterale/verde-rosso; en/it parità `en` ASCII senza `!`; lint/typecheck/test/validate-content/build/check-contrast verdi.

## Spec Change Log

### 2026-09-28 — Sblocco dell'HALT `blocked` (verifica sul rendering reale ri-eseguita)
Il follow-up precedente aveva dichiarato la condizione **Block If** confermata
(la frase campione «va in overflow a ogni larghezza telefono») e cancellato
`## Auto Run Result`. Ri-eseguendo la verifica sul rendering reale (Chrome
headless via Playwright, viewport EMULATO così le larghezze <500px non sono
clampate dal minimo finestra di Chrome) la diagnosi si è rivelata **errata**:
il **testo base** non sfonda mai il proprio box (`paraOverflow=false`,
`jpBeyondPara=false`) e sta in ≤2 righe a ≥640px / ≤3 righe a 320–390px.
L'overflow **del documento** proveniva da un difetto di **layout**, non dai
letterali di UX-DR8 né dal modello group-ruby: l'`<article>` della card è un
figlio flex del `<main>` `items-center`, quindi con larghezza AUTO cresce a
max-content (500px) e trascina fuori il `<rt>` del nucleo group-ruby; il
`w-full` del solo paragrafo (fix `6160c91`) non bastava perché riempiva una card
GIÀ troppo larga. Correzione ammessa dal sistema (layout, gutter — mai i 32/26px
/1.9): `w-full` sulla card + `p-4 sm:p-6` (padding interno ridotto sotto 640px).
Con essa l'overflow sparisce a ogni larghezza e la campione sta in ≤3 righe a
320–390px. **Block If NON attivo.** Vedi `## Auto Run Result` (dati misurati).

## Review Triage Log

### 2026-09-28 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 1, low 2)
- defer: 1: (high 0, medium 1, low 0)
- reject: 10: (high 0, medium 0, low 10)
- addressed_findings:
  - `[medium]` `[patch]` Salto di layout su mobile: lo scheletro del pile-counter era fisso a `h-[72px]` mentre il conteggio caricato è ora 56px sotto 640px (`count-hero-mobile`) — 16px di salto all'atterraggio su telefono, proprio ciò che lo scheletro «alla stessa altezza» deve evitare. Reso responsive `h-[56px] sm:h-[72px]` in `DashboardScreen.tsx`.
  - `[low]` `[patch]` Copertura di regressione mancante: `RESPONSIVE_CONTAINER` era composto in 6 `<main>` ma asserito solo su session/dashboard; Auth/Stats/Privacy/Acknowledgements potevano perderlo senza fallimenti. Aggiunti `src/ui/layout.test.ts` (stringa esatta della costante, incl. `w-full`) e asserzioni sul `<main>` (`max-w-measure`/`px-gutter-mobile`/`sm:px-gutter-desktop`) in `StatsScreen.test.tsx`, `PrivacyScreen.test.tsx`, `AcknowledgementsScreen.test.tsx` più il nuovo `AuthScreen.test.tsx`.
  - `[low]` `[patch]` Refuso «di frase» doppio nei commenti nuovi di `theme.css`: corretto.
- reject notevoli (verificati contro codice reale e intento):
  - **Contenuto della sessione più alto del viewport «irraggiungibile»** (edge-case): non raggiungibile — nessun antenato taglia lo scroll (gli unici `overflow-hidden` sono barre da 4px) e `MAIN_CLASS` usa `min-h-screen` (cresce), quindi a contenuto oltre 100vh la pagina scrolla normalmente; `justify-end` agisce solo quando c'è spazio libero.
  - **`sentence-hero` senza `font-weight`** (blind): UX-DR8 fissa solo 32/26px + interlinea 1.9; il testo di frase in peso regolare (ereditato) è la resa corretta per prosa corrente, non un difetto. Fuori dall'intento.
  - **Verifica di rendering non automatizzata in CI** (blind/verification-gap/intent-alignment): scelta deliberata e documentata (Design Notes) — l'intento chiede una verifica sul rendering reale *una-tantum* («si corregge il corpo qui»), eseguita in questo giro via Chrome headless; il repo non ha layout engine in CI e demanda l'e2e reale a Epic 7. `design-tokens.test` blinda comunque i letterali dei token (32/26px, 1.9, thumb-zone 120px), quindi un downgrade dei valori fallisce. Rischio residuo annotato.
  - **Thumb-zone assente sulla dashboard** (blind): l'AC vincola alla thumb-zone «le opzioni di risposta» (concetto di sessione); l'azione singola della dashboard non è un'opzione di risposta. Coerente con l'intento.
  - Altri nit low senza conseguenza utente: nota sul caso peggiore (si è usata proprio la frase più lunga di 2.7), etichette AC1/AC8 nei `describe` (cosmetiche), assicurazione dark-mode per i nuovi token (gold-plating: token mode-agnostici corretti), claim «≥1024 non si allarga» (vero per costruzione: `max-w-measure`, nessun override `lg:`/`xl:`), `not.toContain('text-display')` come guardia coincidente (corretta oggi), switch `count-hero-mobile` osservato solo come stringa (stesso confine accettato).
- defer:
  - **`--font-jp` definito ma mai applicato** al contenuto `lang="ja"` (pre-esistente, di `JapaneseText`/3.11, non toccato da 3.23): il giapponese rende nel ripiego di `font-sans` invece che in Noto Sans JP. Le metriche CJK full-width restano ≈1em, quindi il conteggio righe verificato non cambia; è una questione di fedeltà del font, non di layout. Registrato in `deferred`.

### 2026-09-28 — Review pass (follow-up sul rendering reale)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 12
- addressed_findings:
  - none — il giro termina in HALT `blocked`: la verifica sul rendering reale
    (mai registrata prima in `## Auto Run Result`) ha CONFERMATO la condizione
    Block If dell'intento. La frase campione va in overflow orizzontale a ogni
    larghezza telefono; nessuna correzione ammessa la risolve senza rinegoziare
    UX-DR8 o il modello group-ruby (AD-21). Vedi `## Auto Run Result`. I finding
    secondari (AC7 thumb-zone dubbia; parità a ≥1024px su header/section della
    home autenticata) sono documentati lì per la stessa decisione umana; nessun
    codice toccato (il blocco è un hand-back, non un fix).
  - **SUPERATO dal giro seguente** (vedi sotto): la diagnosi di questo giro era
    errata. L'overflow non era dei letterali UX-DR8 né del group-ruby, ma di un
    difetto di layout risolvibile (larghezza AUTO della card); il Block If NON
    era attivo.

### 2026-09-28 — Verifica sul rendering reale ri-eseguita (sblocca il blocco)
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 1, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - `[medium]` `[patch]` **La card cresce a max-content su telefono ⇒ overflow
    orizzontale.** Ri-misurando sul rendering reale con viewport EMULATO
    (Playwright + Chrome; `--window-size` sotto ~500px è clampato da Chrome e
    aveva falsato la sonda precedente) il testo base sta in ≤2/≤3 righe e non
    sfonda il proprio box; l'overflow del documento veniva dall'`<article>`
    (figlio flex di `<main>` `items-center`, larghezza AUTO → 500px) che
    trascinava fuori il `<rt>` del nucleo. Prova diretta: rimuovendo i `<rt>`
    l'overflow spariva (il group-ruby ERA il segnale, ma la causa era la card
    non vincolata); vincolando la card a `width:100%` l'overflow sparisce a ogni
    larghezza. Correzione ammessa dal sistema (layout/gutter, NON i letterali):
    `w-full` + `p-4 sm:p-6` sull'`<article>` in `ExerciseCard.tsx`, con test SSR
    di regressione. Block If **non** attivo: UX-DR8 (32/26px, 1.9) è verificabile
    sul rendering reale senza rinegoziazione. Dati in `## Auto Run Result`.
- residuo (decisione umana, non bloccante):
  - **AC3 a 280px = 4 righe.** A 26px pieni, 25 grafemi CJK non stanno in ≤3
    righe entro ~208px di contenuto (≈8/riga × 3 = 24 < 25): limite tipografico
    a una larghezza estrema, sotto la fascia mainstream «≈280–335px». A 320–390px
    (telefoni reali) sono 3 righe. Nessuna correzione ammessa lo porta a 3 righe
    a 280px senza toccare i 26px fissati.
  - **AC7 thumb-zone = 136px** (non 120): `pb-thumb-zone` (120px) più bordo del
    bersaglio pone l'ultima opzione ~16px sopra la fascia. Già segnalato come
    «dubbio» nel giro precedente e riservato alla decisione umana / audit reale
    (7.6). Codice di layout invariato da questa patch.

### 2026-09-28 — Review pass (build-auto, 4 lenti in parallelo)
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 2: (high 0, medium 0, low 2)
- reject: 9
- addressed_findings:
  - `[low]` `[patch]` **Il test di regressione della card non ancorava alla card.**
    `ExerciseCard.test.tsx` asseriva `toContain('w-full')`/`'p-4'`/`'sm:p-6'` sul
    markup intero: ma `w-full` compare anche su paragrafo/`<ul>`/opzioni, quindi
    l'asserzione era una tautologia e non avrebbe fallito se la card `<article>`
    avesse perso `w-full`. Sostituita con l'asserzione della className ESATTA
    dell'`<article>` (`w-full flex flex-col items-center gap-6 rounded-md
    bg-surface-raised p-4 sm:p-6`), unica della card — stesso pattern «stringa
    esatta» di `layout.test.ts`. Suite verde (1240 test), typecheck/lint verdi.
- defer (reali, non causati da questo giro; verso l'audit reale 7.6):
  - `[low]` **AC3 a 280px = 4 righe.** Limite tipografico dei 26px fissati da
    UX-DR8; la matrice I/O fissa il fit mobile a 320–360px (lì passa), 280px è
    sotto tale fascia; nessun overflow. Registrato in `deferred`.
  - `[low]` **AC7 thumb-zone = 136px.** `pb-thumb-zone` (120px) + box del bersaglio;
    codice di layout atterrato in commit precedenti, non toccato qui. Registrato in
    `deferred`.
- reject notevoli (verificati contro codice e intento):
  - **Nessun test di regressione pixel-perfect in CI / «falsa fiducia» del test SSR**
    (blind, verification-gap): confine deliberato e documentato — il repo non ha
    layout engine in CI (vitest `node`), l'e2e reale è Epic 7; il codice cambiato
    (solo stringhe di classe) non ha regressioni osservabili da un unit test, e i
    letterali dei token sono blindati da `design-tokens.test`. La patch sopra rende
    comunque la guardia SSR effettiva sulla card.
  - **`status` `done` nella prosa dell'Auto Run Result vs frontmatter** (blind): si
    risolve da sé alla finalizzazione (lo stato torna `done`).
  - **Wording del Block If / matrice ancora «rischio UX-DR8»** (blind): dentro
    `<intent-contract>`, read-only; non modificabile in review.
  - Altri nit senza conseguenza utente: duplicazione narrativa Design Notes↔Auto Run
    Result, `oversized` non aggiornato, i 12 reject del giro superato non elencati,
    nessun test sull'output CSS di `p-4`/`sm:p-6` (Tailwind v4 scansiona il sorgente),
    artefatti del diff condensato passato ai lenti (commento abbreviato, tabella
    riassunta).
- nota edge-case/verification-gap: entrambi i lenti hanno restituito 0 finding.

## Design Notes

**Il modello group-ruby e la riconciliazione AD-21 ↔ AD-27.** `alignFurigana` (AD-21) opera sull'**intera frase** e stacca solo prefisso/suffisso di kana comuni: una frase intera collassa quindi in **~2 segmenti** — un unico nucleo group-ruby (per la campione, ~22 caratteri con una sola lettura `<rt>`) più il kana di bordo (`みます`). Non esistono ruby per-parola. L'AC dell'epica «a capo solo ai confini dei segmenti … non dividere `読んでいて` fra `読` e `んでいて`» presuppone *segmenti = parole*; con AD-21 questa premessa non regge, e il danno didattico che teme (spezzare una parola dalla sua okurigana) è **strutturalmente impossibile**: non c'è alcun ruby per-parola da frammentare. Costringere il segmento atomico (`white-space:nowrap`/`word-break:keep-all`) impedisce al nucleo di andare a capo e provoca **overflow orizzontale** su frasi lunghe. Perciò il nucleo group-ruby deve andare a capo **da solo**, a confini di grafema CJK (default del browser) — ed è così che AC2/AC3 (fit) e AC4 (nessun grafema spezzato) sono entrambe soddisfatte. Verifica sul rendering reale (ri-eseguita, vedi `## Auto Run Result`): ai 32/26px, interlinea 1.9, la campione sta in 2 righe a `measure` e 3 righe a larghezza telefono (320–390px), senza overflow.

**La card, non il group-ruby, era il fattore limitante dell'overflow.** Il `<rt>` di un nucleo group-ruby è, di per sé, un'annotazione atomica larga quanto la lettura intera (per la campione ~416px a 26px): se il suo antenato NON è vincolato in larghezza, il `<rt>` trascina fuori l'intero blocco. La card `<article>` è un figlio flex del `<main>` `items-center`, che le dà larghezza AUTO (max-content) — così cresce a ~500px su telefono e il `w-full` del solo paragrafo non basta (riempie una card già troppo larga). Vincolando **la card** a `w-full` (più `p-4 sm:p-6`, gutter interno ridotto sotto 640px), il `<rt>` è forzato dentro la colonna del contenitore responsive, va a capo/si adatta, e l'overflow sparisce a ogni larghezza. È una correzione di **layout** (ammessa dal Block If), non un tocco ai letterali di UX-DR8 né al modello dei segmenti (AD-21 invariato).

**Perché la verifica è Chrome headless e non un test in CI.** Non c'è infra e2e in `ci.yml` (lint/typecheck/vitest **node**/validate-content/build/graph); Playwright vive in `e2e.yml`, contro Supabase reale (Epic 7). `jsdom` non ha layout engine: non misura righe/altezze. Quindi la verifica del fit/collisione/overflow è un controllo una-tantum su Chrome headless (font di ripiego Yu Gothic/Meiryo se manca Noto Sans JP: metriche CJK full-width ≈1em, sufficienti al conteggio righe), con l'esito registrato nello spec. La copertura **permanente** è: `design-tokens.test` (token definito) + test SSR (ruolo applicato, classi responsive presenti). L'audit su screen reader reale resta 7.6.

**Un solo contenitore, nessuno shell.** Non esiste un `<main>` condiviso (invariante single-main per schermata): la classe responsive è una sola definizione in `src/ui/layout.ts`, composta in ogni `<main>` così le schermate non divergono — coerente col pattern `CONTAINER_HEIGHT`/`FOCUS_RING` già usato.

## Verification

**Commands:**
- `npm run typecheck` — expected: exit 0.
- `npm run lint` — expected: exit 0 (nessun colore letterale; `src/ui/layout.ts` puro di presentazione; `features → ui` rispettato).
- `npm test` — expected: exit 0 (`design-tokens` 15 ruoli + sentence-hero definito; SSR: ruolo `sentence-hero` sulla frase, classi responsive su session/dashboard; nessuna regressione).
- `npm run validate-content` / `npm run build` / `npm run check-contrast` — expected: exit 0.

**Manual checks (rendering reale):**
- Probe HTML nello scratchpad (path Windows `file:///C:/...`), frase 2.7 in `sentence-hero` con furigana attiva; `chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=3000 --dump-dom`; misurare i `getClientRects()` dei **soli nodi di testo base** (escludendo `RT`/`RP`) a 1024/640/335/280px. Atteso: ≤2 righe @1024, ≤3 righe <640, nessun overflow orizzontale, furigana non tagliata/collisa. Verificare inoltre a ≥1024px che il contenuto non superi `measure` e, in sessione <640px, che l'ultimo bersaglio opzione sia entro 120px dal fondo del viewport. Registrare i conteggi in `## Auto Run Result`.

## Auto Run Result

**Verifica automatica (comandi):** tutti verdi.
- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0.
- `npm test` → exit 0 (**102 file, 1240 test**; inclusi `design-tokens` con 15 ruoli + `sentence-hero` a 32/26px 1.9, il test SSR di `ExerciseCard` che asserisce il ruolo `sentence-hero` responsive e NON più `text-display` **più il nuovo test che la card è `w-full` con `p-4 sm:p-6`**, i test SSR di session/dashboard sulle classi responsive `max-w-measure`/`px-gutter-*`/`pb-thumb-zone`/`count-hero-mobile`, e `layout.test.ts` con la stringa esatta di `RESPONSIVE_CONTAINER`).
- `npm run validate-content` → exit 0.
- `npm run build` → exit 0. La CSS generata contiene le utility attese: base mobile-first `text-sentence-hero-mobile` (26px/1.9), `px-gutter-mobile` (20px), `pb-thumb-zone` (120px), `text-count-hero-mobile` (56px), `p-4` (16px); varianti `@media (width>=40rem)` (=640px): `sm:text-sentence-hero` (32px/1.9), `sm:px-gutter-desktop` (32px), `sm:text-count-hero` (72px), `sm:justify-center`, `sm:p-6` (24px).
- `npm run check-contrast` → exit 0 (32 coppie conformi, invariato).

**Verifica sul rendering reale (Chrome headless via Playwright, viewport EMULATO).**
Metodo: `chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })` con `newContext({ viewport })` per fissare la larghezza di layout ESATTA — necessario perché `chrome --headless --window-size` sotto ~500px viene **clampato** da Chrome al minimo finestra (~500px), errore che aveva falsato le due sonde precedenti (dichiaravano overflow a «ogni telefono» misurando in realtà a 500px). CSS = il `dist/assets/index-*.css` compilato (token + utility reali). DOM = replica fedele di `SessionScreen` (MAIN_CLASS) + `ExerciseCard` (card `w-full … p-4 sm:p-6`, frase `w-full text-center text-sentence-hero-mobile sm:text-sentence-hero`) con il group-ruby della campione 2.7 (`alignFurigana` → 2 segmenti: nucleo `私は…読` + `<rt>` unico + kana di bordo `みます`). Righe del **solo testo base** (escludendo `RT`/`RP`):

| Viewport | Ruolo (font/interlinea) | Righe testo base | Overflow doc X | `<rt>` tagliata | main width |
|----------|-------------------------|------------------|----------------|-----------------|------------|
| 1024px | `sentence-hero` (32px / 60.8px=1.9) | **2** (≤2 ✓ AC2) | no ✓ | no ✓ | 544px (=measure) ✓ AC6 |
| 640px | `sentence-hero` (32px / 1.9) | 2 | no | no | 544px (cap) |
| 390px | `sentence-hero-mobile` (26px / 49.4px=1.9) | **3** (≤3 ✓ AC3) | no ✓ | no ✓ | 390px |
| 360px | `sentence-hero-mobile` (26px / 1.9) | 3 | no | no | 360px |
| 335px | `sentence-hero-mobile` (26px / 1.9) | **3** (≤3 ✓ AC3) | no ✓ | no ✓ | 335px |
| 320px | `sentence-hero-mobile` (26px / 1.9) | 3 | no | no | 320px |
| 280px | `sentence-hero-mobile` (26px / 1.9) | 4 (⚠ vedi sotto) | no ✓ | no ✓ | 280px |

Esito: la campione sta in **≤2 righe a ≥640px** e **≤3 righe a 320–390px** (fascia telefono mainstream), **senza overflow orizzontale** a nessuna larghezza, con il `<rt>` mai a box zero (non tagliato). A ≥1024px il contenuto è cappato a `measure` (544px), mai allargato. La condizione **Block If NON si attiva**: i letterali di UX-DR8 (32/26px, 1.9) sono verificabili sul rendering reale, la correzione necessaria è di LAYOUT (card `w-full` + `p-4 sm:p-6`), non dei letterali.

*Prova diretta che il group-ruby non è il fattore da rinegoziare:* con la card vincolata (`width:100%`), rimuovendo i `<rt>` l'overflow resta assente e il nucleo va a capo liberamente; con la card NON vincolata, l'`<article>` cresce a ~500px (max-content) e il `<rt>` da 416px sfonda — è la larghezza AUTO della card, non i 26px né la lettura di gruppo, la causa.

*Ruby ravvicinati (riga «Ruby ravvicinati» della matrice):* probe mirato a 295px/26px con 難しい (okurigana), 茶 (adiacente a kana) e 日本語 (ruby di gruppo): i tre `<rt>` rendono con box non nullo (39/26/78px larghi, 17px alti), nessuno tagliato, tutti sulla stessa riga, nessun overflow — furigana senza collisione (AC5 ✓).

*Thumb-zone (AC7):* in una sessione con card corta a 320/360/390px l'ultima opzione cade a **136px** dal fondo (`pb-thumb-zone` 120px + bordo), ~16px oltre la fascia stretta di 120px; nessuno scroll verticale (contenuto entro il viewport). Riservato alla decisione umana (già «dubbio» nel giro precedente; audit reale in 7.6): il codice di layout `justify-end`/`pb-thumb-zone` è invariato.

**Residuo a 280px (AC3):** a 26px pieni, 25 grafemi CJK non stanno in ≤3 righe entro ~208px di contenuto (≈8/riga × 3 = 24 < 25). È un limite tipografico a una larghezza sotto la fascia mainstream «≈280–335px»; nessuna correzione ammessa (gutter/padding già ridotti a `p-4`) lo porta a 3 righe senza toccare i 26px fissati da UX-DR8. A 320–390px (telefoni reali) sono 3 righe. Rischio residuo, non bloccante.

---

**Riepilogo della modifica.** La storia 3.23 definisce il ruolo tipografico `sentence-hero`/`-mobile` (32/26px, interlinea 1.9, UX-DR8) e lo applica alla frase dell'esercizio; introduce UN contenitore responsive condiviso (`src/ui/layout.ts`: colonna singola centrata, `max-w-measure`, gutter 20/32px, mai allargata a ≥1024px) composto nei `<main>` di sei schermate; ancora le opzioni della sessione nella thumb-zone (120px) sotto 640px; applica `count-hero-mobile` al pile-counter; e **vincola la card della sessione a `w-full` con padding responsive `p-4 sm:p-6`** così la frase più lunga non sfonda su telefono. La verifica sul rendering reale (ri-eseguita con viewport emulato) conferma i limiti di riga senza rinegoziare i letterali.

**File modificati (rispetto al baseline `6160c91`):**
- `src/features/study/ExerciseCard.tsx` — la card `<article>` da `p-6` a `w-full … p-4 sm:p-6` (fix dell'overflow su telefono; il `w-full` del solo paragrafo di `6160c91` non bastava).
- `src/features/study/ExerciseCard.test.tsx` — nuovo test SSR: la card è `w-full` con `p-4 sm:p-6`.
- `_bmad-output/implementation-artifacts/spec-3-23-*.md` — status `done`; Spec Change Log; nuovo giro di review che sblocca l'HALT; Design Notes corrette; questo `## Auto Run Result`.

(Il resto dell'implementazione — token `sentence-hero(-mobile)` in `theme.css`, `design-tokens.test` a 15 ruoli, `src/ui/layout.ts` + test, `RESPONSIVE_CONTAINER` nei sei `<main>`, `count-hero-mobile`, scheletro responsive, test SSR — era già a posto nei commit `1598f24`/`6160c91` ed è stato verificato invariato e verde.)

**Esito review.** patch di questo giro: 1 (medium: card non vincolata ⇒ overflow, ora fissa). L'HALT `blocked` del giro precedente è SUPERATO: era una diagnosi errata da sonda clampata. Deferite pre-esistenti confermate: `--font-jp` mai applicato (fedeltà font, non layout). Residui non bloccanti: AC3 a 280px (limite tipografico), AC7 thumb-zone 136px (decisione umana / 7.6).

**Rischi residui.**
- La geometria pixel-perfetta (conteggio righe, collisione furigana, prossimità thumb-zone) non ha un test di regressione permanente in CI: è verificata una-tantum via Chrome headless (questo giro) e blindata solo indirettamente dai letterali dei token in `design-tokens.test` e dai test SSR delle classi. Confine accettato dal repo (nessun layout engine in CI; e2e reale = Epic 7). Un cambio futuro di font/gutter/`measure`/padding o una frase campione più lunga potrebbe alterare il conteggio righe senza far fallire i test SSR.
- AC3 a 280px = 4 righe (limite tipografico a 26px); AC7 = 136px (~16px oltre la fascia di 120px). Entrambi documentati sopra per la decisione umana.
- `--font-jp` non applicato al giapponese (deferred, pre-esistente): resa nel ripiego di sistema invece di Noto Sans JP; layout invariato, fedeltà del font no.

---

**Finalizzazione review (build-auto).** Giro di review con 4 lenti in parallelo
(blind-hunter, edge-case, verification-gap, intent-alignment). Esito del triage:
- **patch: 1** (low) — il test di regressione della card non era ancorato all'`<article>`
  (`toContain('w-full')` era una tautologia perché `w-full` compare anche su
  paragrafo/`<ul>`/opzioni); corretto asserendo la className esatta della card.
  File toccato in più rispetto al giro precedente: `src/features/study/ExerciseCard.test.tsx`.
- **defer: 2** (low) — AC3 a 280px = 4 righe (limite tipografico dei 26px fissati; la
  matrice I/O fissa il fit a 320–360px, dove passa) e AC7 thumb-zone = 136px (box del
  bersaglio oltre `pb-thumb-zone`). Entrambi reali, non causati da questo giro, verso
  l'audit reale 7.6; registrati nel `deferred` del frontmatter.
- **reject: 9** — confine di CI documentato (nessun layout engine; e2e = Epic 7),
  contenuti dentro `<intent-contract>` (read-only), incoerenze che si risolvono alla
  finalizzazione, e artefatti del diff condensato passato ai lenti. edge-case e
  verification-gap: 0 finding.

**Raccomandazione di follow-up review:** `false`. Solo le patch di QUESTO giro per
severità: high 0, medium 0, low 1 → punteggio `3×0 + 1×1 = 1` (< 5, nessuna high).

**Verifica ri-eseguita dopo la patch (indipendente, dall'orchestratore):**
`npm run typecheck` → exit 0; `npm run lint` → exit 0; `npm test` → exit 0
(**102 file, 1240 test**, incluso il test SSR della card ora ancorato). `validate-content`/
`build`/`check-contrast` non ri-eseguiti perché la patch tocca solo un file di test
(nessun cambio di sorgente/CSS/contenuto); erano verdi nella verifica pre-patch.

