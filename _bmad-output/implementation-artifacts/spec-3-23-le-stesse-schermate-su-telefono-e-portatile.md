---
title: 'Le stesse schermate su telefono e portatile'
type: 'feature'
created: '2026-09-28'
status: 'done'
baseline_revision: 'ef3b1f12a6a3f47a19c0e15a081d01f74a44d8e1'
review_loop_iteration: 0
followup_review_recommended: true
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

## Design Notes

**Il modello group-ruby e la riconciliazione AD-21 ↔ AD-27.** `alignFurigana` (AD-21) opera sull'**intera frase** e stacca solo prefisso/suffisso di kana comuni: una frase intera collassa quindi in **~2 segmenti** — un unico nucleo group-ruby (per la campione, ~22 caratteri con una sola lettura `<rt>`) più il kana di bordo (`みます`). Non esistono ruby per-parola. L'AC dell'epica «a capo solo ai confini dei segmenti … non dividere `読んでいて` fra `読` e `んでいて`» presuppone *segmenti = parole*; con AD-21 questa premessa non regge, e il danno didattico che teme (spezzare una parola dalla sua okurigana) è **strutturalmente impossibile**: non c'è alcun ruby per-parola da frammentare. Costringere il segmento atomico (`white-space:nowrap`/`word-break:keep-all`) impedisce al nucleo di andare a capo e provoca **overflow orizzontale** su frasi lunghe. Perciò il nucleo group-ruby deve andare a capo **da solo**, a confini di grafema CJK (default del browser) — ed è così che AC2/AC3 (fit) e AC4 (nessun grafema spezzato) sono entrambe soddisfatte. Verifica pregressa sul rendering reale: ai 32/26px, interlinea 1.9, la campione sta in 2 righe a `measure` e 3 righe a larghezza telefono, senza overflow.

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
- `npm test` → exit 0 (100 file, 1231 test; inclusi `design-tokens` con 15 ruoli + `sentence-hero` definito a 32/26px 1.9, il test SSR di `ExerciseCard` che asserisce il ruolo `sentence-hero` responsive e NON più `text-display`, e i test SSR di session/dashboard sulle classi responsive `max-w-measure`/`px-gutter-*`/`pb-thumb-zone`/`count-hero-mobile`).
- `npm run validate-content` → exit 0.
- `npm run build` → exit 0. La CSS generata contiene le utility attese dai token: `text-sentence-hero` (32px, line-height 1.9) e `sm:` gated `@media (width>=40rem)` = 640px; base mobile-first `text-sentence-hero-mobile` (26px, 1.9), `px-gutter-mobile` (20px), `pb-thumb-zone` (120px), `text-count-hero-mobile` (56px); varianti ≥640: `sm:text-sentence-hero`, `sm:px-gutter-desktop` (32px), `sm:text-count-hero` (72px), `sm:justify-center`.
- `npm run check-contrast` → exit 0 (32 coppie conformi, invariato).

**Verifica sul rendering reale (Chrome headless, frase 2.7 con furigana attiva).**
Segmenti di `alignFurigana` sulla campione = **2** (nucleo group-ruby `私は図書館で新しい本を借りて、毎晩少しずつ読` con lettura unica + kana di bordo `みます`), come da Design Notes: nessun ruby per-parola, il nucleo va a capo da solo ai confini di grafema CJK. Ai valori FISSATI da UX-DR8 (32/26px, interlinea 1.9), larghezza contenuto = viewport − gutter, capped a `measure` (544px); righe del solo testo base (escludendo `RT`/`RP`):

| Viewport | Ruolo | Larghezza contenuto | Righe testo base | Overflow X | Furigana tagliata |
|----------|-------|---------------------|------------------|------------|-------------------|
| 1024px | `sentence-hero` (32px) | 480px (measure 544 − gutter 32×2) | **2** (≤2 ✓ AC2) | no | no |
| 640px | `sentence-hero` (32px) | 480px (measure cap) | **2** | no | no |
| ~335px | `sentence-hero-mobile` (26px) | 295px (335 − gutter 20×2) | **3** (≤3 ✓ AC3) | no | no |
| ~280px | `sentence-hero-mobile` (26px) | 240px (280 − gutter 20×2) | **3** | no | no |

Esito: la campione sta in **≤2 righe a ≥1024px** e **≤3 righe sotto 640px**, senza overflow orizzontale, con la furigana (rt) mai a altezza/larghezza zero (non tagliata). La condizione **Block If** NON si attiva: i letterali di UX-DR8 sono verificabili sul rendering reale, nessuna correzione del corpo necessaria. A ≥1024px il contenuto è capped a `measure` (`max-w-measure` in CSS, mai allargato). L'ancoraggio thumb-zone è imposto per costruzione dal layout (`min-h-screen` + `justify-end` + `pb-thumb-zone` sotto 640px, che ricentra da 640px con `sm:justify-center`/`sm:min-h-[24rem]`) ed è coperto dal test SSR delle classi. Un secondo probe mirato (難しい okurigana, お茶 prefisso kana, 日本語 ruby di gruppo) a 295px/26px ha reso i 3 `<rt>` senza taglio e senza overflow (copre la riga «Ruby ravvicinati» della matrice).

---

**Riepilogo della modifica.** La storia 3.23 definisce il ruolo tipografico `sentence-hero`/`-mobile` (32/26px, interlinea 1.9, UX-DR8) e lo applica alla frase dell'esercizio; introduce UN contenitore responsive condiviso (`src/ui/layout.ts`: colonna singola centrata, `max-w-measure`, gutter 20/32px, mai allargata a ≥1024px) composto nei `<main>` di sei schermate; ancora le opzioni della sessione nella thumb-zone (120px) sotto 640px; e applica la variante `count-hero-mobile` al pile-counter. La verifica su rendering reale (Chrome headless) conferma i limiti di riga senza correzioni del corpo.

**File modificati.**
- `src/ui/theme.css` — definiti `--text-sentence-hero` (32px/1.9) e `--text-sentence-hero-mobile` (26px/1.9); commento tipografia aggiornato a 15 ruoli.
- `src/ui/layout.ts` (nuovo) — `RESPONSIVE_CONTAINER` condiviso.
- `src/ui/layout.test.ts` (nuovo) — asserisce la stringa esatta della costante.
- `src/features/study/ExerciseCard.tsx` — la frase passa da `text-display` interim a `sentence-hero` responsive.
- `src/features/study/SessionScreen.tsx` — `MAIN_CLASS` con contenitore condiviso + ancoraggio thumb-zone sotto 640px su tutti i rami `<main>`.
- `src/features/dashboard/DashboardScreen.tsx` — `MAIN_CLASS` condiviso; pile-counter `count-hero-mobile sm:count-hero`; scheletro reso responsive `h-[56px] sm:h-[72px]` (patch anti-salto).
- `src/features/auth/AuthScreen.tsx`, `src/features/stats/StatsScreen.tsx`, `src/features/legal/PrivacyScreen.tsx`, `src/features/legal/AcknowledgementsScreen.tsx` — contenitore condiviso nei rispettivi `<main>` (parità).
- `src/design-tokens.test.ts` — 15 ruoli; blocco invertito «sentence-hero È definito».
- `src/features/study/ExerciseCard.test.tsx`, `src/features/study/SessionScreen.test.tsx`, `src/features/dashboard/DashboardScreen.test.tsx` — test SSR di ruolo/classi responsive/thumb-zone/count-hero-mobile.
- `src/features/auth/AuthScreen.test.tsx` (nuovo), `src/features/stats/StatsScreen.test.tsx`, `src/features/legal/PrivacyScreen.test.tsx`, `src/features/legal/AcknowledgementsScreen.test.tsx` — asserzioni sul `<main>` col contenitore condiviso (patch di copertura).

**Esito review.** patch applicate: 3 (medium 1: salto di layout mobile sullo scheletro corretto; low 2: copertura di regressione sul contenitore + refuso commento). Deferite: 1 (medium: `--font-jp` mai applicato al giapponese, pre-esistente). Rigettate: 10 (nessuna conseguenza utente raggiungibile — vedi Review Triage Log).

**Follow-up review consigliata:** `true`. Conteggio delle sole patch di questo giro per severità: high 0, medium 1, low 2 → punteggio `3×1 + 1×2 = 5` (≥ 5).

**Verifica ri-eseguita dopo le patch (indipendente):** `npm run typecheck` → exit 0; `npm run lint` → exit 0; `npm test` → exit 0 (**102 file, 1239 test**); `npm run check-contrast` → exit 0; `npm run build` → exit 0. Probe Chrome headless re-confermato (2/2/3/3 righe, nessun overflow, rt non tagliata).

**Rischi residui.**
- La geometria pixel-perfetta (conteggio righe, collisione furigana, prossimità thumb-zone di 120px) non ha un test di regressione permanente in CI: è verificata una-tantum via Chrome headless (questo giro) e blindata solo indirettamente dai letterali dei token in `design-tokens.test`. È il confine accettato dal repo (nessun layout engine in CI; e2e reale = Epic 7). Un cambio futuro di font/gutter/`measure` o una frase campione più lunga potrebbe alterare il conteggio righe senza far fallire i test SSR.
- `--font-jp` non applicato al giapponese (deferred): la resa usa il ripiego di sistema invece di Noto Sans JP; layout invariato, fedeltà del font no.
