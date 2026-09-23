---
title: 'Story 1.4: Nessuna stringa cablata, imposto dal compilatore'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_revision: 'a7e47c99c6d21684ee5682a8d7b24ffea90a5e72'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Ogni testo d'interfaccia rischia di nascere cablato nel codice: senza imposizione **meccanica**, `FR8.4`/`AD-14` (nessuna stringa visibile cablata) diventerebbe un'epica di pulizia finale invece di autoimporsi da qui in avanti. Oggi non esiste alcun i18n tipizzato — lo scaffold di 1.1 lo rinvia esplicitamente a questa storia (`src/i18n/index.ts`).

**Approach:** Introdurre **i18next + react-i18next** con cataloghi `en`/`it` `as const` e **declaration merging** su `CustomTypeOptions` (modulo `i18next`), così che `t()` con una chiave inesistente sia un **errore di compilazione `tsc`**, non un fallimento a runtime. I due cataloghi hanno lo stesso insieme di chiavi. Il giapponese resta **dato** (non passa da `t()`, porta `lang="ja"`). Il confine a tre di `AD-14` è documentato in un file versionato.

## Boundaries & Constraints

**Always:**
- i18next inizializzato **una sola volta** in `src/i18n/` (singleton al load del modulo) con `initReactI18next`: `resources` **inline** (nessun backend HTTP/filesystem), `defaultNS: 'translation'`, `supportedLngs: supportedLocales`, `fallbackLng: 'en'`, `lng: 'en'`, `interpolation: { escapeValue: false }`, `react: { useSuspense: false }`.
- Type-safety via declaration merging sul modulo `'i18next'`: `CustomTypeOptions.resources = { translation: typeof en }` e `defaultNS: 'translation'`. Una chiave assente ⇒ errore `tsc` (verificato con `@ts-expect-error`); una presente compila.
- Cataloghi `en` e `it` con lo **stesso insieme di chiavi**, entrambi non vuoti (verifica di parità ricorsiva).
- **Solo `src/i18n/`** importa `i18next`/`react-i18next`. `ui`/`features` ricevono `t`/`useTranslation` **dal livello i18n** (re-export), rispettando gli archi `AD-1` (`ui → i18n`, `features → i18n`).
- Il giapponese (積ん読ゼロ, nome proprio del prodotto) è **dato**: non passa da `t()`, il nodo che lo contiene porta `lang="ja"`, e **nessun carattere CJK** compare nei cataloghi. Le stringhe d'interfaccia effettivamente rese vengono da `t()` (dimostrato dalla tagline del prodotto in `App`).
- Confine a tre di `AD-14` documentato in un file versionato: **interfaccia da `t()`**, **contenuto delle lezioni dal file di lezione**, **giapponese da nessuno dei due**.
- `package-lock.json` rigenerato e committato (la CI usa `npm ci`, mai `npm install`).

**Block If:**
- _Nessun blocco._ Nessuna decisione umana né azione fuori dal repository: tutto è codice e configurazione. Solo un guasto d'ambiente irreparabile (registro npm irraggiungibile che impedisce di installare `i18next`/`react-i18next`) è un blocco.

**Never:**
- Nessuna schermata né copy per storie successive (auth 1.6+, dashboard Epic 3): il catalogo resta **minimo** (la tagline del prodotto); i consumatori arrivano dopo. Nessuna chiave inventata per superfici inesistenti.
- Niente persistenza né **commutazione a runtime** della lingua, niente `LanguageDetector`: è la storia 1.9 (e la persistenza per-utente dipende da `user_settings`, storia 1.5). Qui `lng` è fisso a `'en'`.
- Non far passare il giapponese da `t()`; non introdurre romaji.
- Non modificare i confini `AD-1` di 1.1 né la regola colore di 1.3. Niente `any`; nessuna disattivazione di regole per aggirare la type-safety.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| chiave esistente | `t('app.tagline')` in `ui` | ritorna la stringa localizzata; 0 errori `tsc` | — |
| chiave inesistente | `t('app.nope')` | **errore di compilazione `tsc`** (asserito da `@ts-expect-error`) | typecheck rosso |
| parità cataloghi | keySet(`en`) vs keySet(`it`) | insiemi uguali (ricorsivo), entrambi non vuoti | test rosso se divergono |
| giapponese reso | `<h1 lang="ja">積ん読ゼロ</h1>` | markup contiene `lang="ja"` attorno al giapponese; non è output di `t()` | — |
| CJK nei cataloghi | valori di `en`/`it` | nessun carattere CJK | test rosso se presente |
| confine documentato | doc `AD-14` | dichiara i **tre** lati | test rosso se un lato manca |

</intent-contract>

## Code Map

- `package.json` + `package-lock.json` — **MODIFICA**: deps `i18next` (`^26`) + `react-i18next` (`^17`) (peer verificati: react ≥16.8, i18next ≥26.2, typescript `^5` ⇒ 5.9.3 ok); lock rigenerato e committato.
- `src/i18n/en.ts` — **NUOVO**: `export const en = { app: { tagline: 'A Japanese grammar exercise generator' } } as const;` (fonte unica delle chiavi tipizzate).
- `src/i18n/it.ts` — **NUOVO**: stesse chiavi, valore `it`: `'Un generatore di esercizi di grammatica giapponese'`.
- `src/i18n/resources.ts` — **NUOVO**: `resources = { en: { translation: en }, it: { translation: it } } as const;` + `defaultNS = 'translation'`.
- `src/i18n/i18next.d.ts` — **NUOVO**: declaration merging su `CustomTypeOptions` (`resources: { translation: typeof en }`, `defaultNS: 'translation'`).
- `src/i18n/config.ts` — **NUOVO**: init singleton i18next + `initReactI18next`; esporta l'istanza (default) e la funzione/side-effect di init.
- `src/i18n/index.ts` — **MODIFICA**: mantiene `supportedLocales`/`Locale` (usati come `supportedLngs`); importa `./config` per l'init; re-export di `useTranslation` (da react-i18next), `resources`/`defaultNS` e dell'istanza. Aggiornare il commento «arrivano nella storia 1.4».
- `src/ui/App.tsx` — **MODIFICA**: `useTranslation` da `../i18n`, rende la tagline via `t('app.tagline')`; mantiene `<h1 lang="ja">積ん読ゼロ</h1>` (dato, senza `t()`); rimuove il `<p>Tsundoku Zero</p>` cablato.
- `src/app/main.tsx` — **MODIFICA** (leggera): side-effect import di `../i18n` in testa, così l'init precede il render (l'HTML `<title>` proprio nome resta in `index.html`, fuori scope).
- `docs/i18n-boundary.md` — **NUOVO**: documenta il confine a tre di `AD-14` (interfaccia/contenuto lezione/giapponese), notando che in Epic 1 il lato «contenuto lezione» non ha ancora consumatori.
- `src/i18n/i18n.test.tsx` — **NUOVO**: codifica la matrice e gli AC (parità, assenza CJK, type-safety `@ts-expect-error`+chiave valida, render con `lang="ja"`, doc del confine).
- Riferimenti (sola lettura): `src/boundaries.test.ts` (pattern di test sull'albero reale), `eslint.config.js` (archi `AD-1` + regola colore), `tsconfig.json` (strict; `include: ['src', …]`), `vitest.config.ts` (`environment: 'node'` ⇒ render via `renderToStaticMarkup`), `.github/workflows/ci.yml` (typecheck è un gate).

## Tasks & Acceptance

**Execution:**
- `package.json` + `package-lock.json` — aggiungere `i18next@^26` + `react-i18next@^17`; rigenerare e committare il lock.
- `src/i18n/en.ts`, `it.ts`, `resources.ts` — cataloghi tipizzati `as const` + `resources`/`defaultNS`.
- `src/i18n/i18next.d.ts` — declaration merging su `CustomTypeOptions`.
- `src/i18n/config.ts` — init singleton (risorse inline, `useSuspense:false`).
- `src/i18n/index.ts` — funnel + init side-effect; mantieni `supportedLocales`/`Locale`.
- `src/ui/App.tsx` — tagline via `t()`; giapponese come dato con `lang="ja"`.
- `src/app/main.tsx` — import i18n per l'init pre-render.
- `docs/i18n-boundary.md` — confine a tre di `AD-14`.
- `src/i18n/i18n.test.tsx` — asserire ogni riga della matrice e gli AC sotto.

**Acceptance Criteria:**
- Given i18next con `CustomTypeOptions`, when `t()` è invocata con una chiave che non esiste nelle risorse, then `npm run typecheck` (`tsc`) produce un errore di compilazione, non un fallimento a runtime — reso un gate da un `@ts-expect-error` che diventerebbe «unused» (typecheck rosso) se la chiave fosse valida; and una chiave esistente compila.
- Given i cataloghi `en` e `it`, when vengono confrontati, then hanno lo stesso insieme di chiavi (parità ricorsiva) e sono entrambi non vuoti.
- Given una stringa giapponese proveniente dal contenuto/prodotto, when `App` è resa, then **non** passa da `t()` (nessun CJK nei cataloghi; il markup della tagline è il valore risolto, non la chiave) and il nodo che la contiene porta `lang="ja"`.
- Given il confine a tre di `AD-14`, when documentato in `docs/i18n-boundary.md`, then dichiara che l'interfaccia passa da `t()`, il contenuto delle lezioni dal file di lezione e il giapponese da nessuno dei due (asserito da un test).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano tutti senza regressioni sulle sonde di 1.1/1.2/1.3 (in particolare i confini `AD-1` e la regola colore).

## Design Notes

**Declaration merge (golden example).** La forma esatta che rende `t()` type-safe:
```ts
// src/i18n/i18next.d.ts
import 'i18next';
import type { en } from './en';
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
```

**Perché `@ts-expect-error` è il gate di AC1.** La type-safety è una proprietà di compilazione: committare `t('chiave-inesistente')` «nuda» terrebbe la CI rossa per sempre. Invece `// @ts-expect-error` davanti a `i18n.t('app.nope')` **asserisce** l'errore: se un domani l'augmentation si rompe (`t` accetta qualunque stringa), la direttiva diventa inutilizzata e `tsc` fallisce — così sia l'augmentation rotta sia la chiave-diventata-valida sono colte. `tsc --noEmit` (che copre `src`) è la porta meccanica, già in CI.

**Perché react-i18next e non solo i18next.** `App` è React; `useTranslation` è la via idiomatica e predispone la commutazione a runtime della 1.9 senza riscritture. Il livello `i18n` è l'**unico** che importa i pacchetti; `ui`/`features` passano dal re-export (arco `AD-1`).

**AC3 in `environment: 'node'`.** Nessun jsdom: il test rende `App` con `renderToStaticMarkup` (da `react-dom/server`). Init sincrono con risorse inline ⇒ `useTranslation` è pronto (`useSuspense:false`); il markup contiene il valore `en` della tagline (non la chiave) e `lang="ja"` attorno al giapponese.

**Catalogo minimo, deliberato.** Una sola chiave reale (`app.tagline`, dalla descrizione stessa del prodotto): l'infrastruttura tipizzata è il deliverable di 1.4, i consumatori (auth) arrivano da 1.6. Nessuna copy inventata per schermate inesistenti.

## Verification

**Commands:**
- `npm run lint` — expected: 0 errori sull'albero reale (confini `AD-1` e regola colore invariati; le sonde restano verdi).
- `npm run typecheck` — expected: `tsc` strict senza errori; il `@ts-expect-error` sulla chiave inesistente è **usato** (augmentation corretta).
- `npm test` — expected: `i18n.test.tsx` verde (parità, no-CJK, render `lang="ja"`, doc del confine) + le sonde di 1.1/1.2/1.3 senza regressioni.
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori.

**Manual checks (if no CLI):**
- Ispezionare `src/i18n/i18next.d.ts`: augmentation di `CustomTypeOptions` presente e corretta.
- Ispezionare `docs/i18n-boundary.md`: i tre lati di `AD-14` dichiarati.
- Ispezionare `src/ui/App.tsx`: la tagline passa da `t()`, il giapponese no e porta `lang="ja"`.

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 0
- reject: 17: (high 0, medium 2, low 15)
- addressed_findings:
  - `[low]` `[patch]` **Import circolare `index.ts`↔`config.ts`** (segnalato da 3 reviewer): `index.ts` dichiarava `supportedLocales`/`Locale` e importava `./config`, mentre `config.ts` li reimportava da `./index` — funzionante solo per ordine di dichiarazione. Estratti in un modulo foglia `src/i18n/locales.ts` (senza import); `config.ts` importa da `./locales`; `index.ts` li ri-esporta da `./locales` (API pubblica invariata). Grafo ora aciclico; rimosso il commento sulla fragilità.
  - `[low]` `[patch]` **Funnel i18n non imposto meccanicamente** (`verification-gap`): il codice e lo spec affermavano «solo `src/i18n` importa `i18next`/`react-i18next` (`AD-1`)», ma nessuna regola lo imponeva — solo convenzione, incoerente con l'ethos dell'epica (CI rossa, non avviso). Aggiunta la rule `boundaries/external` che vieta `i18next`/`react-i18next` da `ui`/`features`/`data`/`app` (consentiti solo a `i18n`), più una sonda in `src/boundaries.test.ts` (frammento virtuale `src/ui/__probe__.tsx` ⇒ `boundaries/external` ERROR) sul modello della sonda `domain→react` di 1.1. Albero reale invariato (App/main passano dal re-export).
  - `[low]` `[patch]` **Omoglifo Cirillico** (`blind-hunter`): un commento di `index.ts` conteneva «cycl**е**-safe» con una `е` Cirillica (U+0435). Rimosso con la patch dell'import circolare; verificata l'assenza di omoglifi residui in `src/i18n/**`.

Findings rifiutati (rappresentativi): «AC1 non verificato da `npm test` da solo» — l'auditor di intent-alignment ha **confermato** che `tsconfig.json` non ha `exclude` e usa `include: ["src"]`, e la CI esegue `npm run typecheck` (nessun `continue-on-error`): il gate `@ts-expect-error` è genuinamente portante (dimostrato dal dev con un flip → `TS2578`); «mistraduzione italiana della tagline» — la resa italiana è fedele ed è **letteralmente** l'autodescrizione del prodotto in `epics.md`; «tipizzare `it` con `satisfies typeof en`» — con `as const` i valori sono tipi letterali distinti, quindi `satisfies` fallirebbe: la parità è verificata a runtime (AC2); «test di fallback runtime / `changeLanguage('it')` / drift di `defaultNS` / range CJK astrali (Ext B) / nota XSS su `escapeValue` / drift del doc / import side-effect ridondante in `main.tsx` / `.catch` sull'init inline / re-export "morti" `resources`/`defaultNS`» — miglioramenti non richiesti dall'intento, o basati su premesse inesatte, senza consumatore o impatto sull'utente (commutazione a runtime deferita a 1.9).

## Auto Run Result

Status: done

**Sommario.** La storia introduce l'i18n **type-safe imposto dal compilatore** (`AD-14`): `i18next` + `react-i18next` con cataloghi `en`/`it` `as const` e **declaration merging** su `CustomTypeOptions` (modulo `i18next`, `resources: { translation: typeof en }`), così che `t()` con una chiave inesistente sia un **errore di compilazione `tsc`** e non un fallimento a runtime. I due cataloghi condividono lo stesso insieme di chiavi (parità ricorsiva verificata da test). Il giapponese (積ん読ゼロ, nome proprio del prodotto) resta **dato**: reso con `lang="ja"`, mai da `t()`, e nessun carattere CJK vive nei cataloghi. Il confine a tre di `AD-14` è documentato in `docs/i18n-boundary.md`. Il livello `src/i18n/` è l'unico che importa i pacchetti i18n, e — dopo la review — questo confine è **imposto meccanicamente** da `boundaries/external` (non più solo convenzione).

**File creati/modificati (uno per riga):**
- `src/i18n/en.ts` — **nuovo**: catalogo inglese `as const`, fonte unica delle chiavi tipizzate (chiave reale `app.tagline`).
- `src/i18n/it.ts` — **nuovo**: catalogo italiano con lo stesso insieme di chiavi.
- `src/i18n/resources.ts` — **nuovo**: `resources` inline (namespace `translation`) + `defaultNS`.
- `src/i18n/i18next.d.ts` — **nuovo**: declaration merging su `CustomTypeOptions` (il meccanismo che rende `t()` type-safe).
- `src/i18n/config.ts` — **nuovo**: init singleton di i18next + `initReactI18next`, risorse inline, `lng:'en'`, `useSuspense:false`; esporta l'istanza.
- `src/i18n/locales.ts` — **nuovo** (patch di review): modulo foglia con `supportedLocales`/`Locale`, per un grafo aciclico.
- `src/i18n/index.ts` — **modifica**: funnel — import side-effect di `./config`, re-export di `useTranslation`/`i18n`/`resources`/`defaultNS` e (da `./locales`) `supportedLocales`/`Locale`.
- `src/ui/App.tsx` — **modifica**: tagline via `t('app.tagline')`; `<h1 lang="ja">積ん読ゼロ</h1>` come dato (mai da `t()`); rimosso il `<p>Tsundoku Zero</p>` cablato.
- `src/app/main.tsx` — **modifica**: import side-effect di `../i18n` per l'init prima del render.
- `docs/i18n-boundary.md` — **nuovo**: documenta i tre lati di `AD-14`.
- `eslint.config.js` — **modifica** (patch di review): `boundaries/external` vieta `i18next`/`react-i18next` fuori dal livello `i18n`.
- `src/boundaries.test.ts` — **modifica** (patch di review): sonda `ui→react-i18next ⇒ boundaries/external` ERROR.
- `src/i18n/i18n.test.tsx` — **nuovo**: 12 test che codificano la I/O Matrix e gli AC (type-safety, parità, no-CJK, render `lang="ja"`, doc del confine).
- `package.json` + `package-lock.json` — **modifica**: `i18next@^26` (26.4.2) + `react-i18next@^17` (17.0.15); lock rigenerato (verificato con `npm ci`).

**Findings di review:** 3 patch applicati (tutti low: import circolare, funnel non imposto meccanicamente, omoglifo Cirillico), 0 deferiti, 0 intent_gap, 0 bad_spec, 17 rifiutati (miglioramenti non richiesti dall'intento o su premesse inesatte — vedi Review Triage Log).

**Follow-up review recommendation: false.** Patch di questa passata: high 0, medium 0, low 3. Punteggio `3×medium + 1×low = 3×0 + 1×3 = 3 < 5` e nessun high ⇒ `false`.

**Verifica eseguita (tutta verde, rieseguita dopo le patch):** `npm run lint` (0 errori sull'albero reale; il funnel i18n è ora imposto e la sonda lo dimostra ERROR), `npm run typecheck` (`tsc` strict senza errori; il `@ts-expect-error` sulla chiave inesistente è *usato*, quindi l'augmentation è corretta e portante), `npm test` (**75 test su 8 file**: 12 i18n + la nuova sonda funnel + le sonde di 1.1/1.2/1.3 senza regressioni), `npm run build` (`tsc --noEmit` + `vite build` producono `dist/`). Matrix Test Audit: tutte e 6 le righe della I/O Matrix coperte da test che girano e passano.

**Rischi residui.** (1) La commutazione a runtime della lingua e la persistenza per-utente (`user_settings.locale`) sono **deliberatamente fuori scope** (storie 1.9/1.5): `lng` è fisso a `'en'`, il catalogo `it` è registrato e verificato in parità ma il suo percorso di risoluzione a runtime non è ancora esercitato da uno switch. (2) Il catalogo è minimo (una chiave): i consumatori d'interfaccia reali arrivano con l'autenticazione (1.6+); l'infrastruttura tipizzata è però già completa e imposta. (3) Le vulnerabilità pre-esistenti di `npm audit` (vitest, handlebars via `eslint-plugin-boundaries`) non sono introdotte da questa storia e restano fuori scope.
