---
title: 'Story 1.3: Il sistema di design come token, non come valori sparsi'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_revision: '75eb2de116912460c8f08af9e4f511ff6bd497a8'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Ogni schermata futura ha bisogno di colori, tipografia, spaziature e raggi come **token unici**, così che la modalità scura sia uno scambio di variabili e non una riscrittura per componente (`UX-DR1`–`UX-DR9`, `UX-DR38`). Oggi non esiste Tailwind né alcun sistema di stile: senza i token e la loro imposizione meccanica, i valori si spargerebbero nei componenti e la conformità al contrasto e alla modalità scura diventerebbe un'epica di pulizia.

**Approach:** Introdurre **Tailwind CSS v4** (CSS-first) con un unico file di configurazione `src/ui/theme.css` (`@import "tailwindcss"` + blocco `@theme`) che contiene i 27 token colore, i 13 ruoli tipografici, la scala di spaziatura, i quattro raggi e le due famiglie con stack di ripiego — tutti dai valori letterali di `DESIGN.md`. Tre garanzie meccaniche in CI: (1) uno **script di contrasto** che verifica ogni coppia colore/fondo su entrambi i fondi e in entrambe le modalità; (2) una **regola di lint** ERROR che vieta i valori colore letterali nei componenti; (3) test che asseriscono la forma della config. La modalità scura segue `prefers-color-scheme` senza interruttore.

## Boundaries & Constraints

**Always:**
- Tutti i valori sono i **letterali di `DESIGN.md`** (frontmatter). Nessun valore inventato, arrotondato o "migliorato".
- **27 token colore**: 14 chiari + 13 scuri. `focus-ring-dark` **non** è un token separato: il suo valore `#7FB0DC` è identico ad `accent-dark`, quindi in scuro l'anello di focus riusa `accent-dark` (questa è l'unica riconciliazione del "27" contro le 28 righe di `DESIGN.md`).
- Ogni colore ha la sua definizione nel blocco `@theme` (fuori da qualsiasi `@media`). **Nessun colore** ha la sua unica definizione dentro un blocco `prefers-color-scheme`: il sorgente `theme.css` non contiene alcun blocco `prefers-color-scheme` (le media query scure le genera Tailwind dalle utility `dark:`, che di default in v4 sono `@media (prefers-color-scheme: dark)`).
- Palette **vincolata**: azzerare i default Tailwind (`--color-*: initial`, `--font-*: initial`) prima di definire i token, così esistono solo i colori e le famiglie del sistema (una tinta d'accento, una d'allarme, nessun'altra).
- **Nessuna ombra nel sistema**: azzerare `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*` (`initial`). La separazione è affidata a bordi e salto tonale `surface-base`/`surface-raised`.
- Due famiglie con confine netto: `--font-jp` = `Noto Sans JP` + stack di ripiego giapponese; `--font-sans` = `Inter` + stack di ripiego sans. Entrambe caricate (Google Fonts, come prescrive `DESIGN.md`: nessun self-hosting del font giapponese).
- La regola di lint dei colori è **ERROR** (CI rossa, non avviso) e vale sul codice dei componenti (`src/ui/**`, `src/features/**`), **non** sullo script di contrasto né sui file di token.
- Lo script di contrasto **fallisce con exit non-zero** sotto `4.5:1` (testo) o `3:1` (non-testo); `border-hairline` è **decorativo ed esente** (WCAG 1.4.11) e non deve mai far fallire lo script.

**Block If:**
- _Nessun blocco._ Non servono decisioni umane né azioni fuori dal repository: tutto è codice e configurazione. Solo un guasto d'ambiente irreparabile (registro npm irraggiungibile) è un blocco.

**Never:**
- **Nessun componente né classe di componente** (`button-primary`, `exercise-card`, ecc.): sono Epic 3. Questa storia è **solo** il sistema di token.
- **Non definire `sentence-hero`/`sentence-hero-mobile`** (`UX-DR8`): resta deliberatamente non definito qui; lo fissa e lo verifica sul rendering la storia 3.23 (AC8). I 13 ruoli sono quelli di `DESIGN.md`.
- Niente `darkMode: 'class'`/`@custom-variant dark` verso una strategia a classe, niente interruttore del tema, niente voce di Impostazioni per il tema.
- Niente CSS-in-JS, niente file CSS per componente: solo `theme.css`. Nessun `tailwind.config.js` (v4 è CSS-first).
- Non modificare i confini di `AD-1` di 1.1: la CSS di `ui` è importata da `app/main.tsx` (arco `app→ui` già ammesso).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| coppia testo conforme | `ink-muted` su `surface-base`, chiaro | contrasto `4.54:1` ≥ 4.5 → PASS | — |
| coppia testo scura al limite | `ink-muted-dark` su `surface-raised-dark` | `4.52:1` ≥ 4.5 → PASS | — |
| coppia non-testo al limite | `border-strong-dark` su `surface-raised-dark` | `3.0006:1` ≥ 3.0 → PASS | — |
| bordo decorativo | `border-hairline` (`1.27:1`) | classificato decorativo → **esente**, mai valutato contro una soglia | non fa fallire lo script |
| ipotetica coppia sotto soglia | un token testo < 4.5 su un fondo | script elenca la coppia e **exit non-zero** | CI rossa |
| colore letterale in componente | `className="bg-[#ff0000]"` in `src/ui/**` | `no-restricted-syntax` ERROR | lint exit ≠ 0 → CI rossa |
| colore letterale inline | `style={{ color: '#fff' }}` in `src/ui/**` | `no-restricted-syntax` ERROR | CI rossa |
| componente che usa un token | `className="bg-surface-base"` | 0 errori della regola colore | — |

</intent-contract>

## Code Map

- `package.json` — **MODIFICA**: devDeps `tailwindcss` (`^4`) + `@tailwindcss/vite` (`^4`); se `@tailwindcss/vite` non risolve con Vite `^8`, ripiego su `@tailwindcss/postcss` + `postcss.config.js`. Nuovo script `"check-contrast": "node scripts/check-contrast.mjs"`. `package-lock.json` rigenerato (commit del lock per `npm ci`).
- `vite.config.ts` — **MODIFICA**: aggiungere il plugin `@tailwindcss/vite` a `plugins` (accanto a `react()`).
- `src/ui/theme.css` — **NUOVO**: `@import "tailwindcss";` + `@theme` con reset dei default (`--color-*/--font-*/--shadow-*: initial`) e i token (27 colori, 13 `--text-*` con size/line-height/font-weight/letter-spacing, `--spacing-*`, `--radius-*`, `--font-*`). Un `@layer base` applica `body { background/color }` con i token e le varianti `dark:*-dark` (dimostra lo scambio di variabili). File di token = **unica fonte** dei valori; niente `@media (prefers-color-scheme)` scritto a mano.
- `src/app/main.tsx` — **MODIFICA**: `import '../ui/theme.css';` in testa (arco `app→ui`).
- `index.html` — **MODIFICA**: `<link rel="preconnect">` + `<link>` Google Fonts per Inter e Noto Sans JP.
- `eslint.config.js` — **MODIFICA**: nuovo override `files: ['src/ui/**','src/features/**']` con `no-restricted-syntax` (ERROR) contro hex/funzioni-colore in `Literal` e `TemplateElement`; nuovo override `files: ['scripts/**']` con `globals.node`.
- `scripts/check-contrast.mjs` — **NUOVO**: helper puri (`contrastRatio`, `parseThemeColors`, `TOKEN_ROLES`, `verifyContrast`) + runner `main` che legge `src/ui/theme.css`, valuta le coppie ed esce non-zero sui fallimenti.
- `.github/workflows/ci.yml` — **MODIFICA**: step `Contrast check` (`npm run check-contrast`) dopo i test unitari; nessuno step `continue-on-error`.
- `src/design-tokens.test.ts` — **NUOVO**: assevera la forma di `theme.css` (AC1/AC2/AC6/AC7/AC8).
- `src/color-lint.test.ts` — **NUOVO**: sonda ESLint della regola colore (AC4), sul modello di `src/boundaries.test.ts`.
- `src/contrast.test.ts` — **NUOVO**: importa gli helper dello script, assevera rapporti noti e che la verifica completa sul `theme.css` reale non abbia fallimenti (AC3, dentro `npm test`).
- `_bmad-output/planning-artifacts/ux-designs/ux-tsundoku-zero-2026-08-19/DESIGN.md` — **RIFERIMENTO** (sola lettura): frontmatter con i valori letterali di colori/tipografia/spaziatura/raggi.

## Tasks & Acceptance

**Execution:**
- `package.json` + `package-lock.json` — aggiungere Tailwind v4 + plugin Vite e lo script `check-contrast`; rigenerare e committare il lock.
- `vite.config.ts` — registrare il plugin Tailwind v4.
- `src/ui/theme.css` — definire l'intero sistema di token dai letterali di `DESIGN.md`; reset dei default; base `body` con varianti `dark:`; **nessun** `sentence-hero`, **nessun** blocco `prefers-color-scheme`.
- `src/app/main.tsx` — importare `theme.css`.
- `index.html` — caricare Inter e Noto Sans JP (preconnect + link).
- `eslint.config.js` — regola colore ERROR sui componenti; globals Node per `scripts/**`.
- `scripts/check-contrast.mjs` — implementare il calcolo WCAG e la classificazione (testo ≥4.5, non-testo ≥3.0, decorativo esente); leggere e valutare `theme.css`; exit non-zero sui fallimenti; in scuro l'anello di focus usa `accent-dark`.
- `src/design-tokens.test.ts`, `src/color-lint.test.ts`, `src/contrast.test.ts` — codificare come asserzioni le righe della I/O Matrix e gli AC sotto.

**Acceptance Criteria:**
- Given `src/ui/theme.css`, when lo si legge, then il blocco `@theme` contiene i 27 token colore (14 chiari + 13 scuri, l'insieme esatto di `DESIGN.md`, senza `focus-ring-dark`), i 13 ruoli tipografici, la scala di spaziatura (`1`–`8` più `gutter-mobile`/`gutter-desktop`/`measure`/`thumb-zone`) e i quattro raggi (`sm`/`md`/`lg`/`full`), tutti coi valori letterali di `DESIGN.md`; and nessun colore è definito solo dentro un blocco `prefers-color-scheme` (il sorgente non ne contiene).
- Given la config, when la si legge, then `--font-jp` dichiara `Noto Sans JP` e `--font-sans` dichiara `Inter`, ciascuna con uno stack di ripiego; and `index.html` carica entrambe le famiglie.
- Given `npm run check-contrast` (e lo step CI omonimo), when gira, then valuta ogni coppia colore/fondo su `surface-base` **e** `surface-raised`, in modalità chiara **e** scura, esce 0 se tutte le coppie testo sono ≥ 4.5:1 e non-testo ≥ 3:1, e **esce non-zero** se una scende sotto; and `border-hairline` è esente e non causa mai un fallimento.
- Given un componente in `src/ui/**` o `src/features/**` che scrive un valore colore letterale (hex o `rgb()/hsl()`, in `className`, arbitrary value o `style` inline), when gira `npm run lint`, then la regola lo segnala come ERROR (CI rossa); and un componente che usa un token non è segnalato.
- Given i due token di bordo, when lo script di contrasto li valuta, then `border-strong` supera `3:1` come confine non-testo e `border-hairline` è trattato come decorativo esente — la distinzione che rende un interattivo delimitato dal solo hairline un difetto è imposta a livello di token.
- Given il sistema, when si ispeziona la config, then non esiste alcun token d'ombra (`--shadow-*` azzerati): la separazione resta bordi + salto tonale.
- Given un dispositivo con `prefers-color-scheme: dark`, when l'app viene aperta, then `body` rende coi token `*-dark` senza intervento dell'utente (variante `dark:` su `prefers-color-scheme`); and non esiste alcuna strategia a classe né interruttore del tema.
- Given il ruolo tipografico per il giapponese di frase (`UX-DR8`), when questa storia è chiusa, then `sentence-hero` **non** è definito nella config (deferito a 3.23), verificabile dall'assenza del token; and i ruoli tipografici presenti sono i 13 di `DESIGN.md`.
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano tutti senza regressioni sulle sonde di 1.1/1.2.

## Spec Change Log

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 1, low 0)
- defer: 0
- reject: 20: (high 0, medium 3, low 17)
- addressed_findings:
  - `[medium]` `[patch]` `npm run build` non era in CI: `verification-gap` e `intent-alignment` hanno segnalato lo stesso problema (indipendentemente): una compilazione rotta di `theme.css` (un `@apply`/`@theme`/`@import` errato, o il plugin Tailwind scollegato) passava la CI **verde**, perché lint/typecheck/test/check-contrast leggono i token come **testo** e non compilano mai la CSS. Dimostrato dal vivo (un typo `@apply bg-surface-base-TYPO` faceva fallire solo `build`). Aggiunto lo step `Build (compila i token Tailwind)` a `.github/workflows/ci.yml` dopo il contrast check: chiude la lacuna e dà ad AC7 (dark mode reso via `prefers-color-scheme`) una porta meccanica in CI, non più solo un'assunzione a compile-time.

Findings rifiutati (rappresentativi): token non valutati dal contrasto (`surface-sunken`, `accent-subtle`, `danger-subtle`) — AC3 nomina **esattamente** i due fondi `surface-base` e `surface-raised`, quindi la scoping è fedele all'intento; "irrobustire il margine di `border-strong-dark` (3.0006:1)" — i valori sono i **letterali di DESIGN.md** ("nessun valore cambia"), non modificabili, e il margine sottile è la scelta deliberata del designer; regola colore estesa a `src/app` — l'intento dice "componente" (ui/features), `main.tsx` è il root di composizione con una schermata di boot deliberatamente non-tematizzata; self-hosting dei font / FOUT / preload — DESIGN.md prescrive Google Fonts senza self-hosting e AC2 chiede solo famiglie disponibili con ripiego; stylelint per la CSS — l'architettura vieta CSS per-componente, l'unico CSS è `theme.css` (fonte token); focus=accent in scuro (WCAG 2.4.11) — valori già identici in DESIGN.md e verifica usage-time (Epic 3); casi difensivi senza consumatore attuale (hex a 4/8 cifre, confine `\b`, token duplicati, `@theme` vuoto, modi hardcoded, `tsconfig` che non copre uno script `.mjs`, cross-check di completezza dei ruoli) — i token sono a 6 cifre, il test exact-27 già gate le aggiunte, e `verification-gap` ha confermato che i casi realistici sono coperti.

## Design Notes

**Perché 27 e non 28.** `DESIGN.md` elenca 28 righe colore, ma tre fonti (epic AC, `UX-DR1`, `UX-DELTA` §2) dicono "27 = 14 chiari + 13 scuri". L'unico valore duplicato è `focus-ring-dark` (`#7FB0DC`) identico ad `accent-dark`: piegarlo su `accent-dark` preserva **ogni valore letterale** e onora il conteggio. In chiaro `focus-ring` (`#2F6FB0`) resta un token distinto.

**Contrasto: classificazione, non prodotto cartesiano cieco.** `DESIGN.md` assegna un ruolo a ogni token, e lo script lo rispetta:
- Testo (≥4.5:1): `ink-primary`, `ink-secondary`, `ink-muted`, `accent`, `accent-hover`, `danger`.
- Non-testo (≥3:1): `border-strong`, `focus-ring` (in scuro = `accent-dark`).
- Decorativo esente: `border-hairline`.
- Fondi (non valutati come primo piano): `surface-base/raised/sunken`, `accent-subtle`, `danger-subtle`.

Valutare i fondi-tinta come primo piano li farebbe fallire per progetto: la classificazione è parte del requisito, non una scelta libera. I margini sono voluti e sottili — `border-strong-dark`/`surface-raised-dark` = `3.0006`, `ink-muted-dark`/`surface-raised-dark` = `4.524` — quindi lo script confronta il valore grezzo (`>=`), senza arrotondare a 2 decimali prima del confronto.

**Formula WCAG (l'implementer adatta):**
```js
const lin = c => (c/=255) <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4;
const L = ([r,g,b]) => 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
const ratio = (a,b) => { const [x,y]=[L(a),L(b)]; return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
```

**Regola colore via `no-restricted-syntax`.** Nessuna dip nuova: quattro selettori (hex e `rgb|rgba|hsl|hsla|oklch|oklab` su `Literal` e su `TemplateElement`) coprono sia gli arbitrary value di Tailwind (`bg-[#..]`) sia gli `style` inline (entrambi contengono un literal col colore). Ambito ai soli `src/ui/**`/`src/features/**`, così lo script di contrasto e i file di token — che contengono hex legittimi — restano fuori. La sonda linta frammenti virtuali via `ESLint.lintText` a un `filePath` in `src/ui/`, come le sonde di confine di 1.1, e assevera severità ERROR (2).

**Fonti dei token = un file.** Sia lo script di contrasto sia `design-tokens.test.ts` leggono `theme.css` (regex su `--color-<nome>: <hex>;`): una sola fonte di verità, coerente con lo spirito "niente valori sparsi".

## Verification

**Commands:**
- `npm run lint` — expected: 0 errori sull'albero reale; la sonda dimostra ERROR sui frammenti colore-letterale.
- `npm run typecheck` — expected: `tsc` strict senza errori.
- `npm test` — expected: `design-tokens` + `color-lint` + `contrast` verdi, più le sonde di 1.1/1.2 senza regressioni.
- `npm run check-contrast` — expected: exit 0; report di tutte le coppie su entrambi i fondi e modalità.
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` con la CSS Tailwind compilata.

**Manual checks (if no CLI):**
- Ispezionare `src/ui/theme.css`: 27 `--color-*`, 13 `--text-*`, spaziature e raggi coi valori di `DESIGN.md`; nessun `sentence-hero`; nessun `prefers-color-scheme`; `--shadow-*: initial`.
- Ispezionare `.github/workflows/ci.yml`: step `check-contrast` e `Build` presenti, nessun `continue-on-error`.

## Auto Run Result

Status: done

**Sommario.** La storia introduce il sistema di design come **token unici** con Tailwind v4 CSS-first: un unico `src/ui/theme.css` (`@import "tailwindcss"` + `@theme`) che contiene i 27 token colore (14 chiari + 13 scuri, i letterali esatti di `DESIGN.md`; `focus-ring-dark` piegato su `accent-dark`, unica riconciliazione del "27" contro le 28 righe del documento), i 13 ruoli tipografici, la scala di spaziatura a 4px con i valori derivati, i quattro raggi e le due famiglie con stack di ripiego. Tre garanzie meccaniche in CI: uno **script di contrasto** (`scripts/check-contrast.mjs`) che valuta ogni coppia colore/fondo su `surface-base` **e** `surface-raised`, in chiaro **e** scuro, con exit non-zero sotto 4.5:1 (testo) / 3:1 (non-testo) e `border-hairline` esente (WCAG 1.4.11); una **regola di lint** ERROR che vieta i colori letterali nei componenti; e la **build** che compila davvero i token. La modalità scura segue `prefers-color-scheme` senza interruttore; nessuna ombra; il ruolo di frase giapponese (`UX-DR8`) resta deliberatamente non definito (deferito a 3.23).

**File creati/modificati (uno per riga):**
- `src/ui/theme.css` — **nuovo**: `@theme` con i 27 colori, 13 `--text-*` (size/line-height/weight/letter-spacing), spaziatura, raggi, `--font-jp`/`--font-sans`; reset dei default (`--color-*`/`--font-*`/`--shadow-*`/`--inset-shadow-*`/`--drop-shadow-*: initial`); base `body` con varianti `dark:*-dark`. Nessun `sentence-hero`, nessun `prefers-color-scheme` a mano.
- `scripts/check-contrast.mjs` — **nuovo**: helper WCAG puri + runner CLI; legge i colori da `theme.css` (fonte unica); classificazione dei ruoli (testo/non-testo/esente) fedele a DESIGN.md; in scuro il focus riusa `accent-dark`.
- `vite.config.ts` — **modifica**: plugin `@tailwindcss/vite`.
- `src/app/main.tsx` — **modifica**: `import '../ui/theme.css'`.
- `index.html` — **modifica**: preconnect + `<link>` Google Fonts (Inter + Noto Sans JP).
- `eslint.config.js` — **modifica**: regola colore `no-restricted-syntax` ERROR su `src/ui/**`+`src/features/**` (hex e funzioni-colore, in `Literal` e `TemplateElement`); globals Node per `scripts/**`.
- `package.json` + `package-lock.json` — **modifica**: `tailwindcss@^4` + `@tailwindcss/vite@^4` (risolvono con Vite ^8, nessun ripiego PostCSS); script `check-contrast`; lock rigenerato.
- `.github/workflows/ci.yml` — **modifica**: step `Contrast check` e `Build (compila i token Tailwind)` dopo i test; nessuno `continue-on-error`.
- `src/design-tokens.test.ts` (21), `src/color-lint.test.ts` (8), `src/contrast.test.ts` (13) — **nuovi**: forma della config, sonda ESLint della regola colore, helper di contrasto + verifica completa sul `theme.css` reale.

**Findings di review:** 1 patch applicato (medium: `npm run build` mancante in CI — chiuso), 0 deferiti, 0 intent_gap, 0 bad_spec, ~20 rifiutati (token fuori dai due fondi che AC3 nomina, "irrobustire" valori che sono letterali di DESIGN.md immodificabili, ambito della regola colore, self-hosting/perf dei font contro la prescrizione di DESIGN.md, stylelint per una CSS per-componente che l'architettura vieta, e casi difensivi senza consumatore attuale).

**Follow-up review recommendation: false.** Patch di questa passata: high 0, medium 1, low 0. Punteggio `3×medium + 1×low = 3×1 + 1×0 = 3 < 5` e nessun high ⇒ `false`.

**Verifica eseguita (tutta verde):** `npm run lint` (0 errori sull'albero reale; la sonda dimostra la regola colore a severità ERROR su hex/rgb/hsl in className, style inline e template literal, silente sui token), `npm run typecheck` (`tsc` strict senza errori), `npm test` (62 test su 7 file: 21 design-tokens + 13 contrast + 8 color-lint + le sonde di 1.1/1.2 senza regressioni), `npm run check-contrast` (exit 0; 32 coppie conformi su entrambi i fondi e modalità), `npm run build` (`vite build` produce `dist/` con la CSS Tailwind compilata; le varianti `dark:` compilano in `@media (prefers-color-scheme: dark)`, generate da Tailwind, non scritte a mano).

**Rischi residui.** (1) I token-tinta di fondo (`surface-sunken`, `accent-subtle`, `danger-subtle`) e le combinazioni colore-su-colore non sono coperti dal contrasto: AC3 fissa i due fondi neutri; le coppie su superfici tinte andranno verificate quando i componenti che le usano arriveranno (Epic 3). (2) L'apparenza del focus contro i componenti adiacenti (WCAG 2.4.11) e la regola "un interattivo delimitato dal solo `border-hairline` è un difetto" sono usage-time e si verificano quando esistono componenti interattivi (Epic 3). (3) I font sono serviti da Google Fonts (scelta esplicita di DESIGN.md): senza rete la tipografia ripiega sugli stack dichiarati, ma il giapponese non ha un ripiego locale garantito con copertura piena.
