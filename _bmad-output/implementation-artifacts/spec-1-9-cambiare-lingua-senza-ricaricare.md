---
title: 'Story 1.9: Cambiare lingua senza ricaricare'
type: 'feature'
created: '2026-09-24'
status: 'awaiting-operator'
baseline_revision: 'e9755bafa115c7456c4007e081524094f492d99c'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Verifica live/e2e del cambio lingua a runtime nel browser reale contro
      l'app deployata (AC1), differita per architettura.
    evidence: |-
      Provare AC1 end-to-end — un click su un'opzione di lingua in Impostazioni
      commuta OGNI testo visibile senza ricaricare la pagina — richiede l'app
      deployata e la sessione reale. L'ambiente di test è node senza jsdom
      (renderToStaticMarkup non esegue eventi né effetti): il click→handler
      (onSelect→changeLocale) è glue d'effetto. Coperto meccanicamente: la
      decisione pura (changeLocale: changeLanguage+saveLocale, ordine, confine
      totale) e l'integrazione del singleton (await i18n.changeLanguage('it')
      poi render ⇒ markup 'it', non 'en'), più il selettore (aria-pressed).
      Nessuna infrastruttura Playwright nello stack; stesso schema del deep-link
      live differito in 1.2/1.8 e della sessione live differita in 1.7.
    location: >-
      src/features/settings/SettingsScreen.tsx + src/features/settings/changeLocale.ts
    severity: low
  - summary: >-
      Verifica live/e2e della persistenza (upsert reale su user_settings, RLS)
      e della continuità cross-device (AC2/AC3), differita per architettura.
    evidence: |-
      Provare AC2 (upsert reale su user_settings.locale, onConflict sulla PK
      user_id, permesso da RLS) e AC3 (impostata la lingua su un dispositivo,
      accedendo da un altro la si ritrova) richiede l'app deployata, la
      migrazione user_settings APPLICATA (operator_actions della storia 1.5) e
      sessioni reali con teardown via l'Edge Function delete-account
      (AD-13/1.10, non ancora esistente). La glue di rehydrate al login
      (AuthRoot: loadLocale→resolveLocale→changeLanguage) è effetto, verificata
      live; coperto meccanicamente: l'adattatore per FORMA della chiamata
      (from('user_settings').upsert({user_id,locale}) con client finto) e la
      decisione pura resolveLocale. Non costruibile in sicurezza qui senza
      teardown né infrastruttura e2e.
    location: >-
      src/data/settingsRepository.ts + src/app/AuthRoot.tsx + storia 1.5 (migrazione) + storia 1.10 (teardown)
    severity: low
  - summary: >-
      Anello di focus visibile (focus-visible) mancante sugli elementi
      interattivi, lacuna di accessibilità app-wide preesistente.
    evidence: |-
      I bottoni del selettore di lingua (come i bottoni di auth di 1.6/1.7 e il
      Disconnetti di 1.7) usano solo border-strong, senza un token/anello di
      focus visibile da tastiera. Non è introdotto da questa storia: è una
      lacuna trasversale a tutti gli interattivi dell'app. Di competenza
      dell'audit di accessibilità con screen reader reale della storia 7.6.
    location: >-
      src/features/settings/LanguageOptions.tsx + src/features/auth/AuthForm.tsx + src/app/AuthenticatedShell.tsx
    severity: low
operator_actions:
  - "Dopo il merge su main (che, tramite .github/workflows/migrate.yml, applica la migrazione user_settings della storia 1.5 — prerequisito: operator_actions di 1.5 completate) e con l'app deployata: accedi con un account reale, apri l'area autenticata (sezione Impostazioni) e verifica AC1 — scegliendo l'altra lingua nel selettore OGNI testo visibile dell'interfaccia cambia immediatamente SENZA ricaricare la pagina."
  - "Verifica AC2/AC3 (persistenza e continuità cross-device): dopo aver scelto una lingua, ricarica la pagina (o accedi da un secondo dispositivo/browser con lo stesso account) e conferma che la lingua scelta viene ritrovata — è persistita in user_settings.locale via upsert diretto e ri-applicata all'accesso. La e2e automatica di questo ciclo è differita alla storia 1.10 (teardown via delete-account, AD-13): un agente non può crearla in sicurezza senza teardown e senza infrastruttura Playwright."
---

<intent-contract>

## Intent

**Problem:** L'interfaccia i18n di 1.4 è tipizzata ma **congelata** su `lng: 'en'` (nessuna commutazione a runtime, nessun `LanguageDetector`), e la colonna `user_settings.locale` di 1.5 esiste ma **nessun codice la scrive né la legge**: non c'è porta dati né superficie Impostazioni. Gli AC di 1.9 (`FR8.2`/`FR8.3`) sono scoperti — l'utente non può cambiare lingua, la scelta non è persistita, e non ritrova la lingua su un altro dispositivo.

**Approach:** Una superficie **Impostazioni** (feature `settings`) con un selettore di lingua che, alla scelta, commuta la lingua a runtime via `i18n.changeLanguage` (ri-render di ogni consumatore di `t()`, **senza ricaricare**) e persiste con un **upsert diretto** su `user_settings` attraverso una nuova porta `SettingsRepository` (dominio) implementata in `data`. Al boot/accesso autenticato la lingua persistita viene letta e applicata (`resolveLocale` → `changeLanguage`), così ritrova la stessa lingua ovunque. Un **unico** client Supabase, creato nella composition root, è condiviso fra `AuthGateway` e `SettingsRepository` (una sola sessione).

## Boundaries & Constraints

**Always:**
- Il cambio lingua a runtime passa **solo** da `i18n.changeLanguage`: nessun `location.reload`, nessun rimontaggio. Tutto il testo visibile è già da `t()` (AD-14, 1.4), perciò commutare la lingua del singleton ri-rende ogni `useTranslation`.
- La persistenza è un **upsert diretto** su `user_settings` (colonna `locale`), **mai via RPC** (coerente con 1.5). L'adattatore vive **solo** in `src/data/` (unico livello che importa `@supabase/supabase-js`) e implementa la porta `SettingsRepository` dichiarata dal dominio (AD-2); `features` non importa `data` — la porta è iniettata da `app`.
- **Un solo client Supabase** per l'app, creato nella composition root e condiviso fra `AuthGateway` e `SettingsRepository` (una sola sessione / un solo GoTrueClient).
- Le lingue supportate hanno **un'unica fonte** in `src/i18n/locales.ts` (`supportedLocales`/`Locale`). Il valore persistito è testo grezzo (colonna `text` senza `check`): la validazione avviene al confine i18n con `resolveLocale` — valore non supportato/assente/malformato ⇒ fallback `'en'` (coerente con `fallbackLng` e il default della colonna).
- La porta `SettingsRepository` ha **confine totale** (mai reject): `loadLocale(): Promise<string | null>`, `saveLocale(locale: string): Promise<void>`.
- Nuove stringhe visibili **solo** via `t()` con chiavi tipizzate, aggiunte in `en` **e** `it` con parità (1.4); nessun CJK; solo token del design system (1.3), ogni interattivo con `border-strong`, nessun colore letterale, nessuna ombra.
- `react-router` resta imbutato in `app`; `i18next`/`react-i18next` restano imbutati in `i18n` (i consumatori passano dal funnel `../i18n`).

**Block If:**
- _Nessun blocco._ La verifica **live** end-to-end (switch nel browser reale senza reload; persistenza cross-device sul DB reale) richiede l'app deployata, la migrazione `user_settings` **applicata** (azione operatore di 1.5) e sessioni reali con teardown (`AD-13`/1.10, non ancora esistente). Si finalizza a `awaiting-operator` con `operator_actions`, **mai** `blocked` — stesso schema di 1.7/1.8.

**Never:**
- Nessun ricaricamento della pagina per cambiare lingua; nessun `LanguageDetector` (la fonte di verità è `user_settings`, non il browser).
- Nessun secondo client Supabase; nessuna `service_role` né secret non-`VITE_*` nel client.
- Nessun `check` sul `locale` nel DB (resta come 1.5: la validazione tipata è nell'app); nessuna nuova colonna in `user_settings` (`locale` esiste già).
- Nessun controllo di auth nelle schermate; nessun `react-router`/`i18next` fuori dai rispettivi imbuti; `features` non importa `data`.
- Nessuna copy inventata per superfici future (dashboard Epic 3): il catalogo cresce **solo** delle chiavi di Impostazioni usate ora.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| resolveLocale — valido | `'it'` / `'en'` | ritorna quel `Locale` | — |
| resolveLocale — assente/non supportato | `null` / `undefined` / `'fr'` / `'en-US'` / `''` | ritorna `'en'` (fallback) | — |
| changeLocale — selezione | `'it'` + deps finte | `changeLanguage('it')` **e** `settings.saveLocale('it')` invocati | un reject di `saveLocale` non propaga (confine totale) |
| switch reso a runtime | `i18n.changeLanguage('it')` poi render della superficie | il markup contiene i valori `it` (title/label/tagline), non gli `en`; nessun reload | — |
| selettore — corrente marcato | `current = 'en'` | il bottone `'en'` ha `aria-pressed="true"`, `'it'` `"false"` | — |
| adapter saveLocale | sessione con `user.id` + `'it'` | `from('user_settings').upsert({ user_id, locale: 'it' })` | nessuna sessione ⇒ no-op; throw SDK ⇒ `void` |
| adapter loadLocale | riga presente (`select('locale').maybeSingle()`) | ritorna la stringa `locale` della riga | riga assente/errore/non-stringa ⇒ `null`; throw SDK ⇒ `null` |

</intent-contract>

## Code Map

- `src/domain/ports/settingsRepository.ts` — **NUOVO**: porta `SettingsRepository` (tipi puri, nessun import). `loadLocale(): Promise<string|null>`, `saveLocale(locale: string): Promise<void>`; confine totale. Il locale è `string` (mirror della colonna `text`): il dominio non conosce `Locale` di i18n (arco `domain→i18n` vietato). Modello: `src/domain/ports/authGateway.ts`.
- `src/data/supabaseClient.ts` — **NUOVO**: `createSupabaseClient(config): SupabaseClient` con `auth:{ persistSession:true, autoRefreshToken:true }` (le opzioni oggi in `authGateway.ts:137-139`). `SupabaseClientConfig` = `{ supabaseUrl, supabaseAnonKey }` (sottoinsieme di `AppConfig`). Centralizza la creazione per condividere una sola sessione.
- `src/data/authGateway.ts` — **MODIFICA**: `createSupabaseAuthGateway` accetta un `SupabaseClient` **iniettato** invece di `SupabaseAuthConfig` (rimuovere `createClient`/`SupabaseAuthConfig`, riga 12/27-30/134-139); le funzioni pure `classifyAuthError`/`authResultFromResponse`/`hasSession` restano **invariate**. Unico chiamante: `main.tsx`; `authGateway.test.ts` testa solo le pure ⇒ non si rompe.
- `src/data/settingsRepository.ts` — **NUOVO**: `createSupabaseSettingsRepository(client: SupabaseClient): SettingsRepository`. `saveLocale`: `getSession()` → `user.id`; `from('user_settings').upsert({ user_id, locale })` (conflitto sulla PK `user_id`); `loadLocale`: `from('user_settings').select('locale').maybeSingle()` (RLS restringe alla riga propria). Try/catch totale.
- `src/i18n/locales.ts` — **RIFERIMENTO** (invariato): `supportedLocales = ['en','it'] as const`, `type Locale`. Fonte unica delle lingue.
- `src/i18n/resolveLocale.ts` — **NUOVO**: `isSupportedLocale(v): v is Locale` e `resolveLocale(stored: string|null|undefined): Locale` (fallback `'en'` = `FALLBACK_LOCALE`, coerente con `config.ts` `fallbackLng:'en'` e default colonna).
- `src/i18n/index.ts` — **MODIFICA**: re-export di `resolveLocale`/`isSupportedLocale` dal funnel (righe 17-20).
- `src/i18n/config.ts` — **RIFERIMENTO**: `lng:'en'`, `fallbackLng:'en'`, `useSuspense:false`; `changeLanguage` disponibile sull'istanza (nessuna modifica all'init; la lingua iniziale resta `'en'`, poi la sovrascrive la lingua persistita al boot).
- `src/i18n/en.ts` / `src/i18n/it.ts` — **MODIFICA**: nuovo ramo `settings` con `title`, `language.label`, `language.en`, `language.it` (parità obbligatoria, nessun CJK).
- `src/features/settings/localeLabels.ts` — **NUOVO**: `LOCALE_LABEL_KEY = { en:'settings.language.en', it:'settings.language.it' } as const satisfies Record<Locale, string>` (completezza imposta da `tsc`; chiavi valide per `t()`).
- `src/features/settings/changeLocale.ts` — **NUOVO** (orchestrazione pura): `changeLocale(locale, { changeLanguage, settings })` → `changeLanguage(locale)` poi `settings.saveLocale(locale)`. Modello: `src/features/auth/signOut.ts`.
- `src/features/settings/LanguageOptions.tsx` — **NUOVO** (presentazionale): gruppo etichettato (`role="group"` + `aria-label`) con un bottone per `supportedLocales`; testo da `t(LOCALE_LABEL_KEY[locale])`; `aria-pressed={locale === current}`; `onSelect`. Solo token (border-strong). Modello: `src/features/auth/AuthForm.tsx`.
- `src/features/settings/SettingsScreen.tsx` — **NUOVO** (container feature): riceve la porta `settings`; `useTranslation()` per `t`+`i18n`; `current = resolveLocale(i18n.language)`; rende `<section aria-labelledby>` (NON `<main>`: preserva il single-main) con titolo `t('settings.title')` e `<LanguageOptions onSelect=(l)=>changeLocale(l,{ changeLanguage:i18n.changeLanguage.bind(i18n), settings })>`.
- `src/app/main.tsx` — **MODIFICA** (righe 8/37/42-48): `const client = createSupabaseClient(decision.config)`; `createSupabaseAuthGateway(client)`; `createSupabaseSettingsRepository(client)`; passa `settings` ad `AuthRoot`.
- `src/app/AuthRoot.tsx` — **MODIFICA**: prop `settings: SettingsRepository`; quando lo stato diventa `authenticated` (boot `.then` riga 37-47 e subscription 52-56) applica la lingua persistita: `settings.loadLocale().then(s => i18n.changeLanguage(resolveLocale(s)))` (glue d'effetto, differita live; la decisione `resolveLocale` è pura-testata). Passa `settings` ad `AppRoutes`.
- `src/app/AppRoutes.tsx` — **MODIFICA**: prop `settings` in `AppRoutesProps`; inoltrata a `AuthenticatedShell` (righe 22-28, 48-56).
- `src/app/AuthenticatedShell.tsx` — **MODIFICA**: prop `settings`; compone `<SettingsScreen settings={settings} />` (feature) sotto branding/Disconnetti. `app→features` ammesso; resta senza chiamate dirette alla porta (la delega alla feature).
- `src/app/{AuthRoot,AppRoutes,AuthenticatedShell}.test.tsx` — **MODIFICA**: aggiungere una `settings` finta inerte ai render (nuova prop). Il single-main (`AppRoutes.test:53-59/99-104`, `AuthenticatedShell.test:31-37`) resta 1 (SettingsScreen è `<section>`).
- `supabase/migrations/20260923221517_create_user_settings.sql` — **RIFERIMENTO** (invariato): `locale text not null default 'en'` + 4 policy owner-scoped (`insert`/`update` coprono l'upsert). Nessuna nuova migrazione.
- Riferimenti (sola lettura): `eslint.config.js` (archi AD-1 + funnel + regola colore — nessuna modifica), `vitest.config.ts` (`environment:'node'` ⇒ `renderToStaticMarkup`, `isolate` per-file ⇒ il singleton i18n è fresco per file), `package.json` (`@supabase/supabase-js`/`i18next` già presenti: **nessuna nuova dipendenza**).

## Tasks & Acceptance

**Execution:**
- `src/domain/ports/settingsRepository.ts` — dichiarare la porta (tipi puri, confine totale).
- `src/data/supabaseClient.ts` — factory del client condiviso.
- `src/data/authGateway.ts` — accettare il client iniettato (pure invariate).
- `src/data/settingsRepository.ts` — adattatore Supabase (upsert `user_settings` + load).
- `src/i18n/resolveLocale.ts` + re-export in `src/i18n/index.ts` — validazione/fallback della lingua.
- `src/i18n/en.ts` + `src/i18n/it.ts` — chiavi `settings.*` (parità, nessun CJK).
- `src/features/settings/{localeLabels.ts,changeLocale.ts,LanguageOptions.tsx,SettingsScreen.tsx}` — selettore + orchestrazione pura.
- `src/app/{main,AuthRoot,AppRoutes,AuthenticatedShell}.tsx` — wiring: un client, due porte, rehydrate al boot, superficie Impostazioni.
- `src/i18n/resolveLocale.test.ts`, `src/features/settings/changeLocale.test.ts`, `src/features/settings/SettingsScreen.test.tsx`, `src/data/settingsRepository.test.ts` — codificare la I/O Matrix.
- `src/app/{AuthRoot,AppRoutes,AuthenticatedShell}.test.tsx` — aggiornare i render con la `settings` finta.

**Acceptance Criteria:**
- Given l'interfaccia in inglese, when l'utente sceglie l'italiano nel selettore di Impostazioni (`i18n.changeLanguage('it')`), then ogni testo visibile reso da `t()` passa all'italiano **senza ricaricare la pagina** — dimostrato meccanicamente rendendo la superficie dopo `changeLanguage('it')` e osservando i valori `it` (non `en`); la verifica live sull'app deployata è differita (operatore).
- Given la lingua cambiata, when la scelta viene salvata, then l'adattatore esegue un **upsert diretto** su `user_settings` con `{ user_id = utente corrente, locale }` (nessuna RPC) — dimostrato dall'adapter test con client finto; l'effetto sul DB reale è verificato live (operatore).
- Given una lingua persistita per l'utente, when è autenticato su un altro dispositivo/sessione, then al boot/accesso la lingua viene letta (`loadLocale`) e applicata (`resolveLocale` → `changeLanguage`), ritrovando la stessa lingua — la decisione `resolveLocale` è testata; la lettura live dal DB reale è glue differita (operatore).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano senza regressioni sulle sonde di 1.1–1.8 (confini AD-1, funnel i18n, regola colore, parità cataloghi, guard/rotte, single-main).

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 1: (high 0, medium 0, low 1)
- reject: 15: (high 0, medium 0, low 15)
- addressed_findings:
  - `[low]` `[patch]` **AuthRoot — glue di rehydrate non robusta** (edge-case + blind-hunter): il `.then` che applica `i18n.changeLanguage` non aveva guard `active` né `.catch`, e `rehydrateLocale` scattava a OGNI segnale `authenticated` (boot + ogni `onAuthStateChange`, incluso `TOKEN_REFRESHED`), potendo sovrascrivere con un valore stantio una scelta di lingua fatta in-sessione. Reso **edge-triggered** (un flag locale `authApplied` nell'effetto: rehydrate solo alla transizione *verso* autenticato — boot-già-autenticato o nuovo accesso — resettato su non-autenticato), con guard `active` e `.catch`. Logica fuori dagli updater di `setState` (StrictMode-safe). AC3 preservato; test SSR invariati.
  - `[low]` `[patch]` **changeLocale — confine totale incompleto** (edge-case + blind-hunter): un throw *sincrono* di `changeLanguage` avrebbe fatto rifiutare `changeLocale`, rompendo il contratto «risolve sempre void». `changeLanguage(locale)` spostato **dentro** il try (ordine invariato: switch prima, persistenza poi); aggiunto un test sul throw sincrono che non propaga.
  - `[low]` `[patch]` **LanguageOptions — etichetta del gruppo invisibile** (blind-hunter): il nome accessibile del gruppo lingua era solo un `aria-label` invisibile. Reso **visibile** (`<span id="language-label" class="text-label …">`) e associato con `aria-labelledby`; l'utente vedente ora vede l'etichetta «Lingua/Language», lo screen reader mantiene il nome. Solo token del design system.

Findings rifiutati (rappresentativi): «migrazione `user_settings` assente dal diff» — creata dalla storia 1.5, questa storia non tocca lo schema; «`maybeSingle` fragile su più righe» — `user_id` è PK e RLS restringe alla riga propria ⇒ sempre ≤1 riga; «`saveLocale` non legge l'`error` ritornato dall'upsert» — il confine è totale *by-design* (come l'authGateway di 1.6/1.7), e l'epica vieta SDK di error-tracking di terze parti: nessun uso azionabile dell'errore; «`resolveLocale` non negozia le varianti regionali (`en-GB`→`en`)» — non esiste `LanguageDetector` (per intento): la locale del browser non raggiunge mai la funzione, il sistema chiuso produce solo `'en'`/`'it'`; «`current` stantio al remount di SettingsScreen» — `i18n.language` (singleton) È la fonte live e persiste fra i remount; «nessuno stato pending sui bottoni / doppio click» — l'upsert è idempotente sulla PK, last-write-wins è corretto; «radiogroup invece di toggle `aria-pressed`» — pattern ARIA valido, preferenza di design (audit a11y in Epic 7); «tipo `unknown` per `changeLanguage`» — adeguato per un fire-and-forget; «validare la locale anche in scrittura» — valida per costruzione al call-site (LanguageOptions itera `supportedLocales`), la validazione difensiva vive in lettura (`resolveLocale`); «commenti in italiano» — convenzione stabilita del progetto; «catalogo `ja` senza `settings`» — `ja` non è una locale (`supportedLocales = ['en','it']`); il giapponese è dato; «test della shell composta» — `AuthenticatedShell.test` rende già la shell completa con `SettingsScreen` e asserisce il single-main.

## Design Notes

**Un solo client, una sola sessione.** L'upsert RLS (`(select auth.uid()) = user_id`) e la lettura richiedono la **stessa** sessione dell'accesso. Due `createClient` sullo stesso storage produrrebbero due `GoTrueClient` (warning ufficiale supabase-js, race di refresh). Perciò il client si crea **una volta** in `main.tsx` e si inietta in entrambe le porte. Questo è il motivo del refactor di `createSupabaseAuthGateway` da `config` a `client`: cambio meccanico, nessun test rotto (le pure non toccano il client).

**Perché la porta è `string`, non `Locale`.** La colonna è `text` senza `check` (scelta deliberata di 1.5). Il dominio non può importare `Locale` di i18n (arco `domain→i18n` vietato). La garanzia di tipo vive al **confine i18n**: in scrittura il chiamante passa un `Locale` (assegnabile a `string`), e `LOCALE_LABEL_KEY ... satisfies Record<Locale,string>` impedisce a `tsc` di dimenticare una lingua; in lettura `resolveLocale` valida il testo grezzo contro `supportedLocales` (una lingua rimossa in futuro, o un valore stantio, degrada al fallback invece di rompere). Golden example:
```ts
// src/i18n/resolveLocale.ts
export function resolveLocale(stored: string | null | undefined): Locale {
  return isSupportedLocale(stored) ? stored : 'en';
}
```

**Perché il runtime switch si prova come integrazione i18n.** L'ambiente è `node` senza jsdom: `renderToStaticMarkup` non esegue eventi né effetti. Come per la glue di `AuthScreen`/`AuthRoot`/guard, si testa la **decisione pura** (`changeLocale`, `resolveLocale`) e l'**integrazione del singleton**: `await i18n.changeLanguage('it')` poi `renderToStaticMarkup(<SettingsScreen/>)` contiene i valori `it` — prova che commutare la lingua ri-rende i consumatori **senza reload**. Il click→handler e il boot→load sono glue d'effetto, differiti alla verifica live (idioma del progetto). `vitest` isola i file (`isolate` default) ⇒ il singleton è fresco per file; entro il file un `beforeEach(() => i18n.changeLanguage('en'))` riporta la lingua a `'en'`.

**Perché `awaiting-operator` e non `done`.** L'AC3 (cross-device) e la prova live dell'AC1/AC2 richiedono l'app deployata, la migrazione `user_settings` **applicata** (operator_actions di 1.5) e sessioni reali con teardown (`AD-13`/1.10, non ancora esistente): non costruibili/eseguibili in sicurezza qui. L'agente completa tutto il codice e i gate meccanici; l'effetto sul DB reale e la verifica cross-device sono dell'operatore — come 1.7/1.8.

## Verification

**Commands:**
- `npm run lint` — expected: 0 errori (nessun `react-router`/`i18next` fuori imbuto; `features` non importa `data`; nessun colore letterale; sonde di confine verdi).
- `npm run typecheck` — expected: `tsc` strict senza errori, nessun `any`; `satisfies Record<Locale,string>` completo; chiavi `t()` valide.
- `npm test` — expected: verdi `resolveLocale.test`, `changeLocale.test`, `SettingsScreen.test` (render + switch a runtime), `settingsRepository.test` (upsert/load con client finto); parità `en`/`it` e no-CJK con le nuove chiavi; nessuna regressione su 1.1–1.8 (single-main, guard/rotte).
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/`.

**Manual checks (if no CLI):**
- Ispezionare `src/data/settingsRepository.ts`: upsert su `user_settings` con `user_id`+`locale`, nessuna RPC, try/catch totale.
- Ispezionare `src/features/settings/SettingsScreen.tsx`: switch via `i18n.changeLanguage`, nessun `location.reload`; `<section>` (non `<main>`); solo token con `border-strong`.
- Ispezionare `src/app/main.tsx`: un solo `createSupabaseClient`, iniettato in entrambe le porte.

## Auto Run Result

Status: awaiting-operator

**Sommario.** La storia rende la lingua **commutabile a runtime senza ricaricare** e **persistita per utente**. Una superficie **Impostazioni** (feature `settings`, resa nella shell autenticata come `<section>`) espone un selettore di lingua: alla scelta commuta la lingua del singleton i18next via `i18n.changeLanguage` (ri-render di ogni consumatore di `t()`, nessun reload) e la persiste con un **upsert diretto** su `user_settings` (mai RPC) attraverso la nuova porta di dominio `SettingsRepository`, implementata in `data`. Al boot/accesso autenticato la lingua persistita viene letta (`loadLocale`) e applicata (`resolveLocale` → `changeLanguage`): l'utente ritrova la stessa lingua su ogni dispositivo. Un **unico** client Supabase è creato nella composition root e condiviso fra `AuthGateway` e `SettingsRepository` (una sola sessione / un solo GoTrueClient), il che ha richiesto il refactor di `createSupabaseAuthGateway` da `config` a `client` iniettato (funzioni pure invariate). La colonna `text` senza `check` (1.5) è resa sicura dal confine `resolveLocale` (valore assente/non supportato/malformato ⇒ fallback `'en'`).

**Perché `awaiting-operator` e non `done`.** L'agente ha completato tutto il codice e i gate meccanici. Le prove **live** (switch nel browser reale senza reload — AC1; upsert reale su `user_settings` con RLS — AC2; continuità cross-device — AC3) richiedono l'app deployata, la migrazione `user_settings` **applicata** (operator_actions della storia 1.5) e sessioni reali con teardown via l'Edge Function `delete-account` (`AD-13`/1.10, non ancora esistente). Enumerate in `operator_actions`/`deferred` — stesso schema di 1.5/1.7/1.8.

**File creati/modificati (uno per riga):**
- `src/domain/ports/settingsRepository.ts` — **nuovo**: porta `SettingsRepository` (tipi puri, confine totale, locale `string`).
- `src/data/supabaseClient.ts` — **nuovo**: `createSupabaseClient` (client unico condiviso, `persistSession`/`autoRefreshToken` espliciti).
- `src/data/authGateway.ts` — **modifica**: accetta il `SupabaseClient` iniettato (rimossi `createClient`/`SupabaseAuthConfig`); pure invariate.
- `src/data/settingsRepository.ts` — **nuovo**: adattatore Supabase — upsert diretto su `user_settings` + load via `select('locale').maybeSingle()`; confine totale.
- `src/i18n/resolveLocale.ts` — **nuovo**: `isSupportedLocale`, `resolveLocale`, `FALLBACK_LOCALE` (validazione/fallback della lingua).
- `src/i18n/index.ts` — **modifica**: re-export di `resolveLocale`/`isSupportedLocale`/`FALLBACK_LOCALE` dal funnel.
- `src/i18n/en.ts` + `src/i18n/it.ts` — **modifica**: ramo `settings` (`title`, `language.label/en/it`), parità, nessun CJK.
- `src/features/settings/localeLabels.ts` — **nuovo**: `LOCALE_LABEL_KEY` con `satisfies Record<Locale,string>` (completezza imposta da `tsc`).
- `src/features/settings/changeLocale.ts` — **nuovo**: orchestrazione pura (switch poi persistenza, confine totale — esteso in review anche al throw sincrono di `changeLanguage`).
- `src/features/settings/LanguageOptions.tsx` — **nuovo**: selettore presentazionale (un bottone per `supportedLocales`, `aria-pressed`, etichetta di gruppo **visibile** + `aria-labelledby` dopo la review).
- `src/features/settings/SettingsScreen.tsx` — **nuovo**: container della superficie Impostazioni (`<section>`, switch via `i18n.changeLanguage`, porta iniettata).
- `src/app/main.tsx` — **modifica**: un client, due porte, `settings` iniettata in `AuthRoot`.
- `src/app/AuthRoot.tsx` — **modifica**: prop `settings`; rehydrate della lingua all'accesso (edge-triggered, con guard `active`/`.catch` dopo la review).
- `src/app/AppRoutes.tsx` + `src/app/AuthenticatedShell.tsx` — **modifica**: inoltrano `settings`; la shell compone `<SettingsScreen>`.
- `src/i18n/resolveLocale.test.ts`, `src/features/settings/changeLocale.test.ts`, `src/features/settings/SettingsScreen.test.tsx`, `src/data/settingsRepository.test.ts` — **nuovi**: codificano la I/O Matrix.
- `src/app/{AuthRoot,AppRoutes,AuthenticatedShell}.test.tsx` — **modifica**: `settings` finta inerte per la nuova prop.

**Findings di review:** 3 patch applicati (tutti low: glue di rehydrate in AuthRoot, confine totale di changeLocale, etichetta di gruppo visibile), 1 deferito (low: focus-visible app-wide → Epic 7.6), 0 intent_gap, 0 bad_spec, 15 rifiutati (vedi Review Triage Log). `verification-gap`: nessuna lacuna; `intent-alignment`: implementazione fedele (R-A+R-C+R-D), glue live differita per architettura.

**Follow-up review recommendation: false.** Patch di questa passata: high 0, medium 0, low 3. Punteggio `3×medium + 1×low = 3×0 + 1×3 = 3 < 5` e nessun high ⇒ `false`.

**Verifica eseguita (tutta verde, rieseguita dopo i patch):** `npm run typecheck` (`tsc` strict, nessun `any`; `satisfies Record<Locale,string>` completo; chiavi `t()` tipizzate), `npm run lint` (0 errori: funnel i18n/react-router intatti, `features` non importa `data`, nessun colore letterale, sonde di confine verdi), `npm test` (**210 test su 25 file**: `resolveLocale` 10, `changeLocale` 5, `SettingsScreen` 6, `settingsRepository` 9, più le sonde di 1.1–1.8 senza regressioni — single-main, guard/rotte, parità cataloghi, no-CJK), `npm run build` (`tsc --noEmit` + `vite build` producono `dist/`; l'avviso sul chunk >500 kB è preesistente e informativo). **Matrix Test Audit:** tutte e 7 le righe della I/O Matrix coperte da test eseguiti e passati.

**Rischi residui / azioni operatore.** (1) Le prove live di AC1/AC2/AC3 dipendono dall'app deployata, dalla migrazione `user_settings` applicata (operator_actions di 1.5) e da sessioni reali con teardown (1.10): enumerate in `operator_actions`, con la e2e automatica differita in `deferred`. (2) La persistenza è **best-effort** (confine totale): un fallimento di scrittura non blocca lo switch a runtime già avvenuto — coerente con il pattern dell'authGateway. (3) L'anello di focus visibile sugli interattivi è una lacuna a11y app-wide preesistente, deferita all'audit screen-reader di Epic 7.6.
