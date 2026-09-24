---
title: 'Story 1.6: Registrazione con email e password'
type: 'feature'
created: '2026-09-24'
status: done
baseline_revision: '41b1ac1841c0a9b987ba37789b365f55072a9b32'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Verifica live/e2e del signup contro il Supabase reale (account creato +
      atterra autenticato) differita per architettura.
    evidence: |-
      AD-13 fissa il teardown della suite alla stessa Edge Function
      delete-account (AD-11), costruita nella storia 1.10 e non ancora
      esistente; AD-12/13 vieta l'istanza locale. Creare utenti reali senza
      teardown inquinerebbe i dati dell'owner (metrica M1). Qui è verificata
      meccanicamente tutta la logica client (classificazione, traduttore
      unico, orchestrazione totale, commutazione di vista) con union chiuse e
      finti iniettati. Stesso schema del test RLS a runtime differito in 1.5.
    location: >-
      src/data/authGateway.ts + storia 1.10 (delete-account)
    severity: low
  - summary: >-
      Precisione della mappa code Supabase -> reason da confermare con la
      verifica live (validation_failed -> invalid-email potenzialmente ampio).
    evidence: |-
      classifySignUpError mappa `validation_failed` a invalid-email (campo
      email). E' un codice generico che potrebbe scattare per ragioni diverse
      da un'email malformata, ancorando il messaggio al campo sbagliato. Il
      caso email-non-valida ha anche il codice specifico email_address_invalid
      (gia gestito). Nel peggiore dei casi l'utente vede un messaggio tradotto
      accanto all'email invece che a livello form: nessuna perdita di stringa
      grezza. Da confermare quando la e2e live (1.10) esercita i codici reali.
    location: >-
      src/data/authGateway.ts (classifySignUpError)
    severity: low
  - summary: >-
      Il seam impuro dell'adattatore (createClient + client.auth.signUp) non ha
      un unit test diretto.
    evidence: |-
      createSupabaseAuthGateway costruisce il proprio client via createClient,
      quindi non e' iniettabile senza un client reale. La compatibilita' di
      forma fra AuthResponse di auth-js e le interfacce strutturali locali e'
      pero' verificata da tsc (assegnabilita' a compile-time), e i parametri
      email/password sono vincolati dal tipo di signUp; il resto e' coperto
      dalla e2e live differita (1.10). E' un deferral acknowledged, non una
      svista.
    location: >-
      src/data/authGateway.ts (createSupabaseAuthGateway)
    severity: low
operator_actions:
  - "Nella console Supabase, in Authentication > Sign In / Providers > Email, disabilita 'Confirm email' (conferma email OFF): senza questo `auth.signUp` ritorna una sessione nulla, l'utente NON atterra autenticato e l'app mostra l'errore generico invece di completare la registrazione (AC1: nessuna conferma via email). E' una modifica di configurazione da console vendor, non applicabile via migrazione o codice."
  - "Verifica che VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY siano impostate nell'ambiente di produzione (Vercel > Project Settings > Environment Variables), cosi' il client di autenticazione le legge a runtime anche in produzione (in locale sono gia' in .env)."
  - "Dopo aver disabilitato la conferma email, esegui una verifica manuale una tantum: registra con un'email nuova e conferma che l'account viene creato e si atterra autenticati; poi ritenta con la stessa email e conferma che compare il messaggio tradotto accanto al campo email. La e2e automatica del signup e' differita alla storia 1.10 (teardown via delete-account, AD-13)."
---

<intent-contract>

## Intent

**Problem:** L'app non ha ancora autenticazione: nessuna porta di dominio per l'auth, nessun client `@supabase/supabase-js`, nessuna schermata. Uno sconosciuto deve poter creare un account con **sola** email e password (nessuna conferma via email, nessun onboarding, nessun questionario di livello) e atterrare autenticato. I fallimenti prevedibili di `FR1.5` (email già registrata, password troppo debole, email in formato non valido, password errata) devono diventare messaggi tradotti e **ancorati al campo responsabile**, senza che alcun messaggio grezzo di Supabase raggiunga l'utente.

**Approach:** Rispettando `AD-1`, il dominio dichiara la porta `AuthGateway` con un `SignUpResult` a **union chiusa** (`ok` oppure `reason` fra i quattro fallimenti + `unknown`); il livello `data` è l'unico a importare `@supabase/supabase-js` e implementa l'adattatore, classificando gli errori Supabase nei `reason` di dominio (una funzione pura `classifySignUpError`); `features/auth` ospita l'**unico traduttore** `reason → { chiave i18n dedicata, campo responsabile }` e la schermata di Accesso; `app` compone il client dalla config validata (storia 1.2) e inietta la porta, alternando fra la schermata di Accesso (non autenticato) e una radice protetta **minima** (autenticato). Poiché `AD-12/13` vieta l'istanza locale e il teardown reale (`delete-account`, storia 1.10) non esiste ancora, la verifica **live** del signup contro Supabase reale è differita; qui tutto ciò che è meccanicamente verificabile lo è tramite union chiuse e finti gateway/response iniettati, senza toccare i dati reali.

## Boundaries & Constraints

**Always:**
- La porta vive in `src/domain/ports/` come tipi **puri** (nessun import esterno): `Credentials`, `AuthFailureReason` (union letterale dei quattro fallimenti di `FR1.5` + `'unknown'`), `SignUpResult` (union discriminata `{ ok: true } | { ok: false; reason }`), `interface AuthGateway { signUp(c): Promise<SignUpResult> }`.
- **Solo** `src/data/` importa `@supabase/supabase-js` (la regola `boundaries/external` continua a vietarlo al dominio). L'adattatore mappa la risposta di Supabase in `SignUpResult` tramite funzioni **pure ed esportate** (`classifySignUpError`, `signUpResultFromResponse`) testabili senza client reale né rete.
- `features/auth` contiene **un unico** traduttore `authFailureMessage(reason) → { key, field }`: ogni `reason` ha una **chiave i18n dedicata e distinta**; `field` è `'email' | 'password' | 'form'`. È l'**unico** punto che trasforma un fallimento in messaggio utente; il suo ingresso è la union chiusa di dominio, perciò per costruzione **nessuna stringa grezza di Supabase** può raggiungere l'utente.
- Il messaggio compare **accanto al campo responsabile** (email o password), non in cima alla pagina; l'`unknown` è generico a livello form.
- Le chiavi i18n nuove vivono sotto il namespace `auth` in **entrambi** i cataloghi `en`/`it` (parità già imposta dal test di 1.4); nessun carattere CJK; voce dell'epica: nessun punto esclamativo, emoji o avverbio di lode. Il messaggio italiano di password errata è esattamente `Password errata.` (coerente con l'AC di 1.7). Tutte le stringhe visibili passano da `t()` (nessuna cablata).
- `features` non importa `data` (`AD-1`): la schermata riceve la porta **iniettata da `app`**. `ui` importa solo `ui`/`i18n`, quindi la schermata è in `features`, non in `ui`.
- Su un signup andato a buon fine, l'utente **atterra autenticato** sulla radice protetta minima (in questa storia: il branding esistente `App`). La commutazione di vista è funzione dello stato di autenticazione ed è resa testabile staticamente.
- I test girano in ambiente `node` (nessun jsdom): la logica d'orchestrazione è in funzioni pure (finto gateway iniettato) e i componenti di presentazione si verificano con `renderToStaticMarkup` per ciascuno stato. Nessuna nuova dipendenza di test.
- Stile solo con i token Tailwind di 1.3 (nessun colore letterale — regola ERROR su `ui`/`features`); ogni interattivo delimitato da `border-strong`; nessun verde di successo.
- `package-lock.json` rigenerato e committato (la CI usa `npm ci`, mai `npm install`).

**Block If:**
- _Nessun blocco._ Le parti fuori dal repository — disabilitare la conferma email nella console Supabase e la verifica live del signup — NON sono un blocco: si finalizza a `awaiting-operator` con `operator_actions`, mai `blocked`.

**Never:**
- Nessuna conferma via email, onboarding o questionario di livello nel flusso.
- Nessun `@supabase/supabase-js` fuori da `src/data/`; nessuna `service_role` né alcun secret non-`VITE_*` nel client.
- **Fuori scope (storie successive, non reimplementarle qui):** persistenza/ripristino della sessione fra riavvii (1.7); il guard di rotta **unico** e un router (1.8) — qui basta una commutazione di vista minima; la persistenza della lingua e la scrittura su `user_settings` (1.9); la cancellazione account e l'Edge Function `delete-account` (1.10). Nessuna dashboard reale (Epic 3).
- Nessuna validazione di formato duplicata client-side che diverga dalla classificazione Supabase: i fallimenti prevedibili hanno **una** fonte (Supabase → classifier → traduttore). Affordance native (`type="email"`, `required`) sono ammesse ma non producono i messaggi di `FR1.5`.
- **Fuori scope (differito):** il test di integrazione/e2e *live* del signup contro Supabase reale — vedi Design Notes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| registrazione valida | finto gateway `signUp → { ok: true }` | `submitSignUp → { ok: true }`; con stato autenticato la radice protetta minima è resa (branding `lang="ja"` + tagline), **non** il form | nessun errore |
| email già registrata | gateway `signUp → { ok:false, reason:'email-already-registered' }` | messaggio `auth.error.emailAlreadyRegistered` reso **accanto al campo email**, non in cima | nessuna stringa grezza |
| password troppo debole | reason `'weak-password'` | messaggio `auth.error.weakPassword` reso **accanto al campo password** | — |
| email formato non valido | reason `'invalid-email'` | messaggio `auth.error.invalidEmail` reso **accanto al campo email** | — |
| fallimento imprevisto | Supabase error non classificato, oppure risposta senza errore ma **senza sessione** | reason `'unknown'` → `auth.error.unknown` a livello form (generico) | il messaggio grezzo NON è nel markup |
| i quattro fallimenti di FR1.5 | ciascuno dei quattro `reason` | `authFailureMessage` ritorna una **chiave i18n dedicata e distinta** per ciascuno + il campo responsabile corretto | — |
| classificazione Supabase | `error.code` ∈ {`user_already_exists`/`email_exists`, `weak_password`, `validation_failed`(email), `invalid_credentials`} | `classifySignUpError` ritorna il `reason` corrispondente | code/forma sconosciuti ⇒ `'unknown'` |

</intent-contract>

## Code Map

- `src/domain/ports/authGateway.ts` — **NUOVO** (domain): `Credentials`, `AuthFailureReason` (`'email-already-registered' | 'weak-password' | 'invalid-email' | 'wrong-password' | 'unknown'`), `SignUpResult`, `AuthGateway`. Tipi puri, nessun import esterno (la regola `boundaries/external` vieta ogni import al dominio — sonda in `src/boundaries.test.ts:63` `domain→supabase ⇒ ERROR`).
- `src/data/authGateway.ts` — **NUOVO** (data): `createSupabaseAuthGateway(config: AppConfig): AuthGateway` usa `createClient(config.supabaseUrl, config.supabaseAnonKey)` e `client.auth.signUp`; più le funzioni **pure** `classifySignUpError(error) → AuthFailureReason` e `signUpResultFromResponse({ data, error }) → SignUpResult`. `AppConfig` è quello di `src/app/env.ts:15` (iniettato da app). È l'unica cartella che può importare `@supabase/supabase-js` (regola `boundaries/external`, `eslint.config.js:97`).
- `src/features/auth/authFailureMessage.ts` — **NUOVO** (features): il **traduttore unico** `authFailureMessage(reason) → { key: AuthErrorKey; field: 'email' | 'password' | 'form' }`. `AuthErrorKey` è la union letterale delle chiavi `auth.error.*` (compatibile con `t()` type-safe di 1.4).
- `src/features/auth/signUp.ts` — **NUOVO** (features): `submitSignUp(gateway, credentials) → Promise<{ ok:true } | { ok:false; message:{key,field} }>` orchestrazione pura (finto gateway iniettabile).
- `src/features/auth/SignUpForm.tsx` — **NUOVO** (features): componente **presentazionale** (props `values`, `error`, `pending`, `onSubmit`, `onChange`) — resa statica per ogni stato. Gruppi di campo `<div>` con `<label>`+`<input>`+slot d'errore reso **solo** quando `error.field` combacia col campo; `field:'form'` in slot a livello form (non in cima). `useTranslation` da `../../i18n`; classi token (`bg-surface-raised`, `text-ink-primary`, `border-border-strong`, `text-danger`, `rounded-md`, spaziature) — nessun colore letterale.
- `src/features/auth/SignUpScreen.tsx` — **NUOVO** (features): container che tiene lo stato (`useState`), chiama `submitSignUp(gateway, …)` e ne smista l'esito col dispatch puro `applySignUpOutcome` (`{ ok:true }` ⇒ `onAuthenticated`; fallimento ⇒ `setError`). Rende un **unico** `<main>` contenente la sola `SignUpForm` (che ha già la propria intestazione `<h2>`); il branding `App` vive **solo** sulla radice protetta autenticata (via `AuthGate`), per non annidare due `<main>` — deciso in review, patch F5.
- `src/app/AuthGate.tsx` — **NUOVO** (app): presentazionale, `{ authenticated, gateway, onAuthenticated }` → `authenticated ? <App/> (radice protetta minima) : <SignUpScreen …/>`. Resa statica per entrambi i booleani.
- `src/app/AuthRoot.tsx` — **NUOVO** (app): container con `useState(authenticated=false)`; rende `<AuthGate …/>`; `onAuthenticated` porta a `true`.
- `src/app/main.tsx` — **MODIFICA**: dopo `decideBoot()` ok, `const gateway = createSupabaseAuthGateway(decision.config)`; rende `<AuthRoot gateway={gateway} />` invece di `<App/>` (punto d'iniezione già previsto nel commento a `src/app/main.tsx:31`).
- `src/ui/App.tsx` — **RIFERIMENTO** (invariato): resta il branding `<h1 lang="ja">積ん読ゼロ</h1>` + `t('app.tagline')`; è la radice protetta minima e resta il soggetto del test di render di 1.4 (`src/i18n/i18n.test.tsx:81`). Non modificarlo.
- `src/i18n/en.ts` + `src/i18n/it.ts` — **MODIFICA**: aggiungere il namespace `auth` (labels email/password, submit, titolo, e `error.{emailAlreadyRegistered,invalidEmail,weakPassword,wrongPassword,unknown}`). Stesso insieme di chiavi (parità imposta da `src/i18n/i18n.test.tsx:56`); nessun CJK; niente `!`.
- `package.json` + `package-lock.json` — **MODIFICA**: dependency `@supabase/supabase-js@^2`; lock rigenerato e verificato con `npm ci`.
- Test **NUOVI**: `src/data/authGateway.test.ts`, `src/features/auth/authFailureMessage.test.ts`, `src/features/auth/signUp.test.ts`, `src/features/auth/SignUpForm.test.tsx`, `src/app/AuthGate.test.tsx` — una per riga della I/O Matrix (vedi Tasks).
- `src/boundaries.test.ts` — **RIFERIMENTO**: la sonda `scaffold pulito ⇒ 0 errori` (`:100`) lintà l'albero reale; i nuovi file devono passare i confini `AD-1` senza regressioni. `*.test.*` sono fuori dal grafo (`eslint.config.js:53`).

## Tasks & Acceptance

**Execution:**
- `src/domain/ports/authGateway.ts` — dichiarare `Credentials`/`AuthFailureReason`/`SignUpResult`/`AuthGateway` (tipi puri).
- `src/data/authGateway.ts` — `classifySignUpError`, `signUpResultFromResponse` (puri) e `createSupabaseAuthGateway` (usa `createClient` + `auth.signUp`).
- `src/features/auth/authFailureMessage.ts` — il traduttore unico `reason → { key, field }`.
- `src/features/auth/signUp.ts` — `submitSignUp` (orchestrazione con gateway iniettato).
- `src/features/auth/SignUpForm.tsx` + `SignUpScreen.tsx` — presentazione + container della schermata di Accesso.
- `src/app/AuthGate.tsx` + `AuthRoot.tsx` — commutazione di vista e composizione del gateway.
- `src/app/main.tsx` — comporre il gateway dalla config e rendere `AuthRoot`.
- `src/i18n/en.ts` + `it.ts` — namespace `auth` in parità.
- `package.json` + `package-lock.json` — `@supabase/supabase-js`; rigenerare il lock.
- Test — codificare **ogni** riga della I/O Matrix: classificazione Supabase e `signUpResultFromResponse` (incl. sessione assente ⇒ `unknown`); `authFailureMessage` (chiavi dedicate/distinte + campo, `unknown`→form); `submitSignUp` (ok ⇒ `{ok:true}`; ogni reason ⇒ messaggio col campo giusto; `message.key` sempre fra le chiavi note); `SignUpForm` (campi+label da `t()`; errore email accanto al campo email e NON al password né in cima; errore password accanto al password; il grezzo NON compare); `AuthGate` (autenticato ⇒ radice protetta `lang="ja"`+tagline e NON il form; non autenticato ⇒ il form).

**Acceptance Criteria:**
- Given la schermata di Accesso con un gateway che accetta le credenziali, when l'utente invia email e password valide, then `submitSignUp` ritorna `{ ok:true }` e, a stato autenticato, `AuthGate` rende la radice protetta minima (branding con `lang="ja"` + tagline) e non il form — senza conferme via email, onboarding o questionari (nessun passo del genere esiste nel flusso).
- Given un `reason` fra i quattro fallimenti di `FR1.5`, when `authFailureMessage` lo traduce, then ritorna una **chiave i18n dedicata e distinta** per ciascuno e il campo responsabile corretto; è l'unico traduttore in `features/auth` e nessuna stringa grezza di Supabase compare nel messaggio o nel markup.
- Given una risposta di errore di Supabase, when l'adattatore la mappa, then `classifySignUpError`/`signUpResultFromResponse` producono il `reason` di dominio (email già registrata/debole/invalid-email; sessione assente o forma ignota ⇒ `unknown`), e `@supabase/supabase-js` è importato **solo** da `src/data/`.
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check-contrast`, when girano, then passano tutti senza regressioni sulle sonde di 1.1–1.5 (confini `AD-1`, regola colore, i18n type-safe/parità).

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 0, medium 2, low 3)
- defer: 3: (high 0, medium 0, low 3)
- reject: 9: (high 0, medium 0, low 9)
- addressed_findings:
  - `[medium]` `[patch]` **Wiring del successo non verificato (AC1)**: la glue submit→onAuthenticated→commutazione vista era testata solo a pezzi (ambiente node, nessun jsdom). Estratto il dispatch PURO `applySignUpOutcome(outcome, { onAuthenticated, onError })` in `signUp.ts`, usato da `SignUpScreen`, e coperto da test (`{ok:true}` chiama solo `onAuthenticated`; fallimento chiama solo `onError` col messaggio esatto). Chiude il gap senza introdurre jsdom (la e2e interattiva resta differita con la e2e live).
  - `[medium]` `[patch]` **Gateway che lancia non gestito**: `submitSignUp` e `createSupabaseAuthGateway.signUp` non catturavano i throw (auth-js rilancia i fallimenti non-AuthError, es. rete caduta) ⇒ nessun messaggio all'utente + unhandled rejection. Reso TOTALE il confine: l'adattatore cattura e ritorna `unknown` (la porta non rifiuta mai); `submitSignUp` cattura e risolve a `unknown` a livello form. Nuovo test con finto gateway che rigetta/lancia.
  - `[low]` `[patch]` **`<main>` annidato**: `SignUpScreen` avvolgeva `<App/>` (già un `<main>`) in un `<main>` ⇒ due landmark. Ora la schermata rende un unico `<main>` con la sola `SignUpForm`; il branding vive solo sulla radice protetta autenticata. Test di `AuthGate` aggiornato (asserisce un solo `<main>` da non autenticato).
  - `[low]` `[patch]` **Associazione a11y degli errori**: rafforza AC3 «accanto al campo responsabile» per utenti non vedenti — `aria-invalid`/`aria-describedby` sull'input in errore (con `id` sul `<p>` del messaggio) e `role="alert"` sull'errore a livello form. Test aggiunti.
  - `[low]` `[patch]` **`pending` disabilita il submit: non testato**: aggiunto un test statico che con `pending={true}` il bottone porta `disabled`.

Findings deferiti: (1) e2e live del signup — differita per architettura a 1.10 (teardown via delete-account, AD-13); (2) precisione mappa `validation_failed`→invalid-email — da confermare con la e2e live; (3) seam impuro dell'adattatore — coperto da assegnabilità `tsc` + e2e live differita.

Findings rifiutati (rappresentativi): «validazione formato client-side prima della rete» — l'intento vieta una seconda fonte oltre il traduttore unico; «autocomplete/name sugli input» — enhancement non legato ad alcun AC; «rationale di `wrong-password` nei cataloghi» — già documentato nel port (è pre-mappato per 1.7); «`invalid_credentials` speculativo» — dead-mapping intenzionale per 1.7, coperto dal test del traduttore; «diagnostica runtime per l'operatore» — coperta da `operator_actions`, e gli SDK di error-tracking di terze parti sono vietati dall'epica; «password non azzerata dopo il successo» — moot: la schermata si smonta al successo (AuthGate commuta su `App`); «test di non-vuoto sui valori `it`» — parità di chiavi già imposta; la resa italiana è di 1.9 (`lng` fisso a `'en'`); «sign-out / transizione a senso unico» — 1.7; «disabilita input durante pending / doppio submit» — enhancement, bottone già disabilitato.

## Design Notes

**Perché la classificazione sta in `data` e la traduzione in `features`.** `AD-1`: il dominio dichiara i `reason` (union chiusa), `data` conosce Supabase e vi mappa gli errori, `features` traduce in chiavi i18n. Così «un unico traduttore» (`authFailureMessage`) ha per ingresso una union chiusa: non c'è alcun canale per far passare una stringa grezza di Supabase all'utente — la garanzia di `FR1.5` è **strutturale**, non una promessa. `features` non importa `data`: la porta arriva iniettata da `app`.

**Golden shape (dominio + traduttore).**
```ts
// domain/ports/authGateway.ts
export type AuthFailureReason =
  | 'email-already-registered' | 'weak-password'
  | 'invalid-email' | 'wrong-password' | 'unknown';
export type SignUpResult = { ok: true } | { ok: false; reason: AuthFailureReason };
// features/auth/authFailureMessage.ts  (chiavi type-safe di 1.4)
export type AuthErrorKey =
  | 'auth.error.emailAlreadyRegistered' | 'auth.error.invalidEmail'
  | 'auth.error.weakPassword' | 'auth.error.wrongPassword' | 'auth.error.unknown';
```
`wrong-password` è incluso perché `FR1.5`/AC4 richiede che **tutti e quattro** i fallimenti passino da questo traduttore; il signup non lo produce (lo produrrà l'accesso, 1.7), ma il traduttore lo copre già e il suo test lo verifica.

**Test senza jsdom.** Il progetto gira in `node` con `renderToStaticMarkup` (vedi `src/i18n/i18n.test.tsx`). L'orchestrazione (`submitSignUp`) è pura e si testa con un finto `AuthGateway`; l'ancoraggio del messaggio al campo si testa rendendo `SignUpForm` con uno stato d'errore dato e asserendo che il testo risolto da `t()` compaia nel gruppo del campo responsabile e **non** in cima; il «lands authenticated» si testa rendendo `AuthGate` con `authenticated=true` (radice protetta) vs `false` (form). Nessuna nuova dipendenza di test.

**Sessione assente ⇒ `unknown` (dipendenza dall'operatore, resa visibile).** Con la conferma email attiva, `auth.signUp` ritorna `session: null` e l'utente non sarebbe autenticato; l'AC richiede «nessuna conferma via email». Perciò l'operatore deve **disabilitare la conferma email** nella console Supabase (azione vendor-console). Finché non è fatto, `signUpResultFromResponse` mappa «nessun errore ma sessione assente» a `'unknown'` (errore generico, mai stato silente rotto): la dipendenza è strutturalmente visibile ed è enumerata in `operator_actions`.

**Verifica live differita, per architettura.** Provare davvero che un signup crea un account e atterra autenticato richiede utenti reali contro Supabase reale e il loro teardown; `AD-13` fissa il teardown alla stessa Edge Function `delete-account` (`AD-11`, storia 1.10, non ancora esistente) con email univoca per run, e `AD-12/13` vieta l'istanza locale. Quindi la e2e live è **differita** a quando esistono teardown (1.10) — registrata in `deferred` — mentre questa storia verifica meccanicamente tutta la logica client (classificazione, traduzione, orchestrazione, commutazione di vista) con union chiuse e finti iniettati. Stesso schema del test RLS a runtime differito in 1.5.

## Verification

**Commands:**
- `npm run lint` — expected: 0 errori sull'albero reale; `@supabase/supabase-js` importato solo da `src/data/`; nessun colore letterale in `ui`/`features`; confini `AD-1` invariati.
- `npm run typecheck` — expected: `tsc` strict senza errori, nessun `any`; le chiavi `auth.error.*` sono accettate da `t()` (type-safe di 1.4).
- `npm test` — expected: verdi i nuovi test (ogni riga della I/O Matrix) + le sonde di 1.1–1.5 senza regressioni (parità cataloghi inclusa).
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori.
- `npm run check-contrast` — expected: nessuna regressione (i token restano quelli di 1.3).

**Manual checks (if no CLI):**
- Ispezionare `src/data/authGateway.ts`: unico importatore di `@supabase/supabase-js`; `classifySignUpError`/`signUpResultFromResponse` puri.
- Ispezionare `src/features/auth/authFailureMessage.ts`: unico traduttore; una chiave dedicata per reason; `unknown`→form.
- Ispezionare `SignUpForm.tsx`: messaggio nel gruppo del campo responsabile, non in cima; solo classi token.

## Auto Run Result

Status: awaiting-operator

**Sommario.** L'autenticazione nasce rispettando `AD-1`. Il dominio dichiara la porta `AuthGateway` con `SignUpResult` a **union chiusa** (i quattro fallimenti di `FR1.5` + `unknown`); `src/data/` è l'**unico** importatore di `@supabase/supabase-js` e implementa l'adattatore con due funzioni **pure** (`classifySignUpError`, `signUpResultFromResponse`) più `createSupabaseAuthGateway`; `features/auth` ospita l'**unico traduttore** `reason → { chiave i18n dedicata, campo responsabile }` (mappa `Record` esaustiva a compile-time), l'orchestrazione **totale** `submitSignUp` (cattura anche i throw ⇒ mai una promise rifiutata) e la schermata di Accesso; `app` compone il client dalla config validata (storia 1.2) e inietta la porta, alternando fra la schermata di Accesso (non autenticato) e la radice protetta **minima** (autenticato, il branding `App`). Poiché l'ingresso del traduttore è una union chiusa, **nessuna stringa grezza di Supabase** può raggiungere l'utente: la garanzia di `FR1.5` è strutturale. Parte fuori dal repo (operatore): disabilitare la conferma email nella console Supabase (senza cui `signUp` ritorna `session:null` e l'utente non atterra autenticato) e la verifica live — enumerate in `operator_actions`. Per questo lo stato finale è `awaiting-operator`, non `done` (come per le storie 1.2 e 1.5).

**File creati/modificati (uno per riga):**
- `src/domain/ports/authGateway.ts` — **nuovo**: `Credentials`, `AuthFailureReason` (union chiusa), `SignUpResult`, `AuthGateway`. Tipi puri, nessun import esterno.
- `src/data/authGateway.ts` — **nuovo**: unico importatore di `@supabase/supabase-js`; `classifySignUpError`/`signUpResultFromResponse` puri; `createSupabaseAuthGateway` (con `try/catch` ⇒ la porta non rifiuta mai). Config strutturale locale `SupabaseAuthConfig` (sottoinsieme di `AppConfig`), per non introdurre l'arco vietato `data→app`.
- `src/features/auth/authFailureMessage.ts` — **nuovo**: il traduttore unico `reason → { key, field }` (chiavi dedicate/distinte; `unknown`→form).
- `src/features/auth/signUp.ts` — **nuovo**: `submitSignUp` (orchestrazione totale) + `applySignUpOutcome` (dispatch puro dell'esito, aggiunto in review).
- `src/features/auth/SignUpForm.tsx` — **nuovo**: form presentazionale; messaggio ancorato al campo responsabile (con `aria-invalid`/`aria-describedby`), errore form-level con `role="alert"`; solo classi token.
- `src/features/auth/SignUpScreen.tsx` — **nuovo**: container; un unico `<main>` con la sola `SignUpForm`; smista l'esito con `applySignUpOutcome`.
- `src/app/AuthGate.tsx` — **nuovo**: commutazione di vista pura (`authenticated ? App : SignUpScreen`).
- `src/app/AuthRoot.tsx` — **nuovo**: container dello stato di autenticazione.
- `src/app/main.tsx` — **modifica**: compone il gateway dalla config validata e rende `AuthRoot`.
- `src/i18n/en.ts` + `src/i18n/it.ts` — **modifica**: namespace `auth` in parità (nessun CJK, nessun `!`; italiano `Password errata.` esatto).
- `package.json` + `package-lock.json` — **modifica**: dependency `@supabase/supabase-js@^2` (2.117.1); lock rigenerato e verificato con `npm ci`.
- Test **nuovi**: `src/data/authGateway.test.ts`, `src/features/auth/authFailureMessage.test.ts`, `src/features/auth/signUp.test.ts`, `src/features/auth/SignUpForm.test.tsx`, `src/app/AuthGate.test.tsx`.

**Findings di review:** 5 patch applicati (2 medium: wiring del successo non verificato, gateway che lancia non gestito; 3 low: `<main>` annidato, associazione a11y degli errori, test `pending`-disabilita-submit), 3 deferiti (tutti low), 0 intent_gap, 0 bad_spec, 9 rifiutati (vedi Review Triage Log).

**Follow-up review recommendation: true.** Patch di questa passata: high 0, medium 2, low 3. Punteggio `3×medium + 1×low = 6 + 3 = 9 ≥ 5` ⇒ `true` (nessun high).

**Verifica eseguita (tutta verde, rieseguita dopo i patch):** `npm run lint` (0 errori sull'albero reale; `@supabase/supabase-js` solo in `src/data/`; nessun colore letterale; confini `AD-1` invariati), `npm run typecheck` (`tsc` strict, nessun `any`; chiavi `auth.error.*` type-safe), `npm test` (**141 test su 14 file**: i nuovi test della I/O Matrix + i patch + le sonde di 1.1–1.5 senza regressioni), `npm run build` (`tsc --noEmit` + `vite build` producono `dist/`), `npm run check-contrast` (32/32 coppie conformi). Matrix Test Audit: tutte e 7 le righe della I/O Matrix coperte da test che girano e passano.

**Rischi residui / azioni operatore.** (1) La conferma email va disabilitata nella console Supabase, altrimenti `signUp` ritorna `session:null` e l'utente non atterra autenticato (l'app mostra l'errore generico, mai uno stato silente rotto): `operator_actions`. (2) Le `VITE_SUPABASE_*` vanno impostate anche in produzione (Vercel): `operator_actions`. (3) La e2e live del signup è differita a 1.10 (teardown via `delete-account`, `AD-13`): `deferred`. (4) La precisione della mappa `code→reason` e il seam impuro dell'adattatore sono coperti da `tsc` + e2e live differita: `deferred`.

## Operator Confirmation

Confirmed 2026-09-24: the external actions this story owed were carried out.

- Nella console Supabase, in Authentication > Sign In / Providers > Email, disabilita 'Confirm email' (conferma email OFF): senza questo `auth.signUp` ritorna una sessione nulla, l'utente NON atterra autenticato e l'app mostra l'errore generico invece di completare la registrazione (AC1: nessuna conferma via email). E' una modifica di configurazione da console vendor, non applicabile via migrazione o codice.
- Verifica che VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY siano impostate nell'ambiente di produzione (Vercel > Project Settings > Environment Variables), cosi' il client di autenticazione le legge a runtime anche in produzione (in locale sono gia' in .env).
- Dopo aver disabilitato la conferma email, esegui una verifica manuale una tantum: registra con un'email nuova e conferma che l'account viene creato e si atterra autenticati; poi ritenta con la stessa email e conferma che compare il messaggio tradotto accanto al campo email. La e2e automatica del signup e' differita alla storia 1.10 (teardown via delete-account, AD-13).

_Appended by the bmad-loop orchestrator (`bmad-loop confirm`, #335): a human confirmed these external actions out of band, and the story was advanced from `awaiting-operator` to `done`._
