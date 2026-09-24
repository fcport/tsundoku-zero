---
title: 'Story 1.7: Accesso, disconnessione e sessione che resiste'
type: 'feature'
created: '2026-09-24'
status: 'awaiting-operator'
baseline_revision: '963ac53cfe549d535a67420eeb7a87394ed85011'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Verifica live/e2e di accesso, persistenza della sessione fra riavvii e
      disconnessione contro il Supabase reale, differita per architettura.
    evidence: |-
      Provare davvero «accedo → atterro autenticato» (AC1), «chiudo e riapro il
      browser → sono ancora autenticato» (AC3) e «mi disconnetto → un riavvio
      non ripristina» (AC4) richiede un account reale contro Supabase reale e il
      suo teardown; AD-13 fissa il teardown alla stessa Edge Function
      delete-account (AD-11), costruita nella storia 1.10 e non ancora
      esistente, e AD-12/13 vieta l'istanza locale. Creare utenti reali senza
      teardown inquinerebbe i dati dell'owner (metrica M1). Qui è verificata
      meccanicamente tutta la logica (orchestrazioni totali signIn/signOut,
      classificazione condivisa, mappa session→boolean, selezione modo→submit,
      resa bimodale, shell autenticata) con union chiuse e finti iniettati.
      Stesso schema del signup live differito in 1.6 e del test RLS a runtime
      differito in 1.5.
    location: >-
      src/data/authGateway.ts + src/app/AuthRoot.tsx + storia 1.10 (delete-account)
    severity: low
operator_actions:
  - "Esegui una verifica manuale una tantum del ciclo di sessione contro il Supabase reale (prerequisito: aver già completato le operator_actions di 1.6 — conferma email disabilitata, VITE_SUPABASE_* impostate anche in produzione — e disporre di un account reale creato via registrazione): (1) accedi con le credenziali corrette e conferma di atterrare autenticato sulla radice protetta (AC1); (2) inserisci una password errata e conferma che compare \"Password errata.\" accanto al campo password, senza rivelare se l'email esista (AC2); (3) con sessione attiva, chiudi e riapri il browser e conferma di essere ancora autenticato (AC3); (4) disconnettiti con il bottone Disconnetti e conferma che un riavvio del browser NON ripristina la sessione (AC4). La e2e automatica di questo ciclo è differita alla storia 1.10 (teardown via delete-account, AD-13), perché un agente non può crearla in sicurezza senza teardown."
---

<intent-contract>

## Intent

**Problem:** L'autenticazione di 1.6 sa solo **registrare**: la porta `AuthGateway` espone il solo `signUp`, lo stato autenticato nasce a `false` in `AuthRoot` e non c'è modo di **accedere** con un account esistente, di **disconnettersi**, né di **ritrovare la sessione** dopo un riavvio del browser. FR1.2 (accesso e disconnessione) e FR1.3 (sessione persistente fino a disconnessione esplicita) sono ancora scoperti.

**Approach:** Estendere — non reimplementare — la superficie di 1.6. Il dominio dichiara sulla stessa porta `signIn`, `signOut`, `isAuthenticated(): Promise<boolean>` e `onAuthStateChange(listener): Unsubscribe`, esponendo al dominio **solo booleani** (mai un oggetto sessione del vendor). `src/data/` implementa i nuovi metodi riusando le mappe pure condivise di 1.6 (l'accesso e la registrazione hanno la **stessa** forma d'esito e la **stessa** classificazione degli errori: `invalid_credentials → wrong-password`) e crea il client con `persistSession`/`autoRefreshToken` **espliciti**, così la persistenza di FR1.3 è una decisione dichiarata. La **schermata di Accesso** resta **una sola** (EXPERIENCE.md) e diventa bimodale via un `mode` (`sign-up` default / `sign-in`) su un unico `AuthForm` parametrizzato; `app` riflette la sessione reale (letta al boot e via subscription). La verifica **live** contro Supabase reale è differita come in 1.6 (serve un account reale e il teardown di 1.10; `AD-12/13` vieta l'istanza locale): tutto ciò che è meccanicamente verificabile lo è con funzioni pure e finti iniettati.

## Boundaries & Constraints

**Always:**
- Le aggiunte al dominio sono tipi/firme **puri** (nessun import esterno): `AuthResult` (forma condivisa), `SignInResult = AuthResult`, `Unsubscribe = () => void`; `AuthGateway` cresce con `signIn(c): Promise<SignInResult>`, `signOut(): Promise<void>`, `isAuthenticated(): Promise<boolean>`, `onAuthStateChange(listener: (authenticated: boolean) => void): Unsubscribe`. Il dominio non vede mai una `Session` di Supabase — solo `boolean`.
- **Solo** `src/data/` importa `@supabase/supabase-js`. L'adattatore riusa le mappe **pure** condivise (`classifyAuthError`, `authResultFromResponse`) per l'accesso, e una nuova pura `hasSession(session): boolean`. Il client è creato con `{ auth: { persistSession: true, autoRefreshToken: true } }` **esplicito**: la persistenza fra riavvii (AC3/FR1.3) è dichiarata, non un default implicito.
- Confine **TOTALE** su ogni metodo della porta: la porta non rifiuta mai. Un throw dell'SDK diventa `unknown` per l'accesso, un `false` per `isAuthenticated`, un `void` risolto per `signOut`.
- L'**unico traduttore** resta `authFailureMessage` (1.6): l'accesso riusa `wrong-password → auth.error.wrongPassword` (campo `password`), già presente, con italiano esatto `Password errata.`. Nessun nuovo punto reason→messaggio.
- **AC2 non rivela l'esistenza dell'email**: password errata ed email inesistente danno entrambe `invalid_credentials → wrong-password → "Password errata."`. Nessun messaggio distinto per "email non trovata".
- **Una sola schermata di Accesso** (EXPERIENCE.md §Superfici): ospita registrazione (1.6) e accesso (1.7) via `mode: 'sign-up' | 'sign-in'`, default `'sign-up'` (metrica M4 registration-first, coerente con 1.6). Un solo `button-primary` per schermata (EXPERIENCE.md); il passaggio di modo è un affordance secondario testuale (un interattivo non è delimitato dal solo `border-hairline`).
- Nuove chiavi i18n sotto `auth` in **parità** en/it (test di parità), **nessun CJK**, nessun `!`: `signInTitle`, `signInSubmit`, `switchToSignIn`, `switchToSignUp`, `signOut`. Ogni stringa visibile passa da `t()` (type-safe di 1.4).
- La sessione è riflessa al boot: `AuthRoot` legge `isAuthenticated()` all'avvio e si iscrive a `onAuthStateChange`; finché lo stato è indeterminato rende un **placeholder neutro** (niente flash del form su sessione persistita, AC3).
- Solo token Tailwind di 1.3; ogni bottone interattivo con `border-strong`; nessuna ombra; nessun verde di successo.
- Nessuna nuova dipendenza (runtime o di test): ambiente `node`, resa via `renderToStaticMarkup`, logica pura con finti iniettati (schema di 1.6). `package-lock.json` resta invariato.

**Block If:**
- _Nessun blocco._ La verifica **live** di accesso/persistenza/disconnessione contro il Supabase reale richiede un account reale e il teardown (`delete-account`, 1.10, non ancora esistente); `AD-12/13` vieta l'istanza locale. Si finalizza a `awaiting-operator` con `operator_actions`, mai `blocked`.

**Never:**
- Nessun `@supabase/supabase-js` fuori da `src/data/`; nessun oggetto sessione del vendor esposto sopra `data` (solo booleani).
- Non reimplementare 1.6 (porta/traduttore/registrazione): **estenderli**. Non duplicare il form: **un solo** `AuthForm` parametrizzato dal modo.
- **Fuori scope (storie successive):** il guard di rotta unico + router e il redirect da rotte protette (1.8); persistenza della lingua e scrittura su `user_settings` (1.9); cancellazione account (1.10); dashboard reale (Epic 3). La radice protetta resta il branding minimo + il bottone Disconnetti.
- Nessuna validazione formato client-side che duplichi la classificazione (una sola fonte, 1.6).
- **Fuori scope (differito):** la e2e *live* di accesso/persistenza/disconnessione contro Supabase reale — vedi Design Notes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| accesso valido | finto gateway `signIn → { ok:true }` | `submitSignIn → { ok:true }`; `applyAuthOutcome` chiama **solo** `onAuthenticated` | nessuno |
| password errata | `signIn → { ok:false, reason:'wrong-password' }` | `submitSignIn → { ok:false, message:{ key:'auth.error.wrongPassword', field:'password' } }` ("Password errata." accanto al campo password) | nessuna stringa grezza |
| non rivela l'email | `error.code = 'invalid_credentials'` (password errata **o** email inesistente) | `classifyAuthError → 'wrong-password'` per entrambi ⇒ **identico** messaggio | code ignoto ⇒ `unknown` |
| gateway signIn che lancia | `signIn` rigetta o lancia (rete caduta) | `submitSignIn` risolve `{ ok:false, message: auth.error.unknown (form) }`, mai reject | confine totale |
| disconnessione | finto gateway `signOut` risolve | `submitSignOut` risolve; il chiamante porta lo stato ad `anonymous` | — |
| signOut che lancia | `signOut` rigetta o lancia | `submitSignOut` risolve comunque (`void`), mai reject | confine totale |
| sessione persistita al boot | `hasSession(<sessione presente>) = true` | `AuthRoot` riflette autenticato; **nessun flash** del form | — |
| nessuna sessione al boot | `hasSession(null) = false` | `AuthRoot` rende la schermata di Accesso | — |
| modo della schermata | `AuthForm` in modo `sign-in` vs `sign-up` (default) | rende titolo/submit/toggle del modo da `t()` (`signInTitle`/`signInSubmit` vs `title`/`submit`); un solo submit primario | — |
| radice protetta autenticata | `AuthGate authenticated=true` | `AuthenticatedShell`: branding `lang="ja"` + tagline **+** bottone `Disconnetti` (`auth.signOut`); **non** il form | — |

</intent-contract>

## Code Map

- `src/domain/ports/authGateway.ts` — **MODIFICA** (domain): aggiungere `AuthResult` (forma condivisa `{ ok:true } | { ok:false; reason }`), rendere `SignUpResult = AuthResult` (alias, invariato per 1.6) e `SignInResult = AuthResult`, `type Unsubscribe = () => void`; estendere `AuthGateway` con `signIn`, `signOut`, `isAuthenticated`, `onAuthStateChange`. Tipi puri: `boundaries/external` vieta ogni import (`src/boundaries.test.ts:63`).
- `src/data/authGateway.ts` — **MODIFICA** (data): rinominare `classifySignUpError → classifyAuthError` e `signUpResultFromResponse → authResultFromResponse` (nomi neutri: la mappa è condivisa fra registrazione e accesso; aggiornare i commenti). Aggiungere la pura `hasSession(session: unknown): boolean` (`session != null`). `createSupabaseAuthGateway`: creare il client con `{ auth: { persistSession: true, autoRefreshToken: true } }` e implementare `signIn` (`client.auth.signInWithPassword` + `authResultFromResponse`, `try/catch → unknown`), `signOut` (`client.auth.signOut`, `try/catch → void`), `isAuthenticated` (`client.auth.getSession` + `hasSession`, `try/catch → false`), `onAuthStateChange` (`client.auth.onAuthStateChange((_e, s) => listener(hasSession(s)))`, ritorna `() => data.subscription.unsubscribe()`). Unico importatore di `@supabase/supabase-js` (`eslint.config.js:104`).
- `src/features/auth/authOutcome.ts` — **NUOVO** (features): estrarre da `signUp.ts` il tipo `AuthSubmitOutcome` (`{ ok:true } | { ok:false; message: AuthErrorMessage }`) e il dispatch puro `applyAuthOutcome(outcome, { onAuthenticated, onError })`. Condivisi da registrazione e accesso.
- `src/features/auth/signUp.ts` — **MODIFICA** (features): importare `AuthSubmitOutcome`/`applyAuthOutcome` da `./authOutcome` (rimuovere le definizioni locali `SubmitSignUpOutcome`/`applySignUpOutcome`); mantenere `submitSignUp` invariato nel comportamento.
- `src/features/auth/signIn.ts` — **NUOVO** (features): `submitSignIn(gateway, credentials): Promise<AuthSubmitOutcome>`, gemello totale di `submitSignUp` sulla porta `signIn` (riusa `authFailureMessage`).
- `src/features/auth/signOut.ts` — **NUOVO** (features): `submitSignOut(gateway): Promise<void>` — chiama `gateway.signOut()` con confine totale (`try/catch`, mai reject).
- `src/features/auth/AuthForm.tsx` — **RINOMINA** da `SignUpForm.tsx`, generalizzato (features): props `values`, `error`, `pending`, `onSubmit`, `onChange` **più** `titleKey: 'auth.title' | 'auth.signInTitle'`, `submitKey: 'auth.submit' | 'auth.signInSubmit'`, `toggleKey: 'auth.switchToSignIn' | 'auth.switchToSignUp'`, `onToggle: () => void`. Rende `t(titleKey)`/`t(submitKey)` e, dopo lo slot d'errore a livello form, un bottone testuale secondario `t(toggleKey)` (`type="button"`). Invariati: ancoraggio errore al campo, `aria-invalid`/`aria-describedby`, `role="alert"` sul form-error, `pending` disabilita il submit, solo classi token. Ordine preservato: titolo → email → password → submit → form-error → toggle.
- `src/features/auth/AuthScreen.tsx` — **RINOMINA** da `SignUpScreen.tsx` (features): `useState` per `values`, `error`, `pending` **e** `mode` (default `'sign-up'`). Rende un unico `<main>` con `AuthForm`; `onSubmit` smista su `submitSignUp` o `submitSignIn` secondo il modo e applica `applyAuthOutcome({ onAuthenticated, onError: setError })`; `onToggle` alterna il modo e azzera l'errore; passa `titleKey`/`submitKey`/`toggleKey` del modo.
- `src/app/AuthenticatedShell.tsx` — **NUOVO** (app): presentazionale `{ onSignOut, signOutPending }` → un `<header>` con il bottone `Disconnetti` (`t('auth.signOut')`, `border-strong`, `disabled={signOutPending}`) **più** `<App/>` (branding). Non modifica `App`. Solo token.
- `src/app/AuthGate.tsx` — **MODIFICA** (app): `authenticated ? <AuthenticatedShell onSignOut signOutPending/> : <AuthScreen gateway onAuthenticated/>`; props cresciute con `onSignOut`, `signOutPending`. Resta una pura commutazione di vista.
- `src/app/AuthRoot.tsx` — **MODIFICA** (app): stato `status: 'checking' | 'authenticated' | 'anonymous'` e `signOutPending`. `useEffect` al mount: `isAuthenticated()` → `status`, `onAuthStateChange((a) => setStatus(a ? 'authenticated' : 'anonymous'))`, cleanup con l'`Unsubscribe`. `onAuthenticated` → `status='authenticated'`; `onSignOut` → `signOutPending`, `submitSignOut(gateway)`, poi `status='anonymous'`. Render: `checking` → placeholder neutro; altrimenti `<AuthGate .../>`. La glue `useEffect` è sottile (come la glue interattiva di 1.6, coperta dalla e2e live differita); la resa iniziale (`checking`) è verificata staticamente.
- `src/app/main.tsx` — **RIFERIMENTO** (invariato): compone `createSupabaseAuthGateway(decision.config)` e rende `<AuthRoot gateway=.../>`. La porta più ricca è iniettata allo stesso punto; nessuna modifica.
- `src/ui/App.tsx` — **RIFERIMENTO** (invariato): branding `<h1 lang="ja">積ん読ゼロ</h1>` + tagline; soggetto del render-test di 1.4. Non modificare.
- `src/i18n/en.ts` + `src/i18n/it.ts` — **MODIFICA**: aggiungere sotto `auth` le chiavi `signInTitle`, `signInSubmit`, `switchToSignIn`, `switchToSignUp`, `signOut`, in parità (`src/i18n/i18n.test.tsx:56`), senza CJK né `!`. en: `signInTitle:'Sign in'`, `signInSubmit:'Sign in'`, `switchToSignIn:'Already have an account? Sign in'`, `switchToSignUp:"Don't have an account? Sign up"`, `signOut:'Sign out'`. it: `signInTitle:'Accesso'`, `signInSubmit:'Accedi'`, `switchToSignIn:'Hai già un account? Accedi'`, `switchToSignUp:'Non hai un account? Registrati'`, `signOut:'Disconnetti'`.
- Test **NUOVI**: `src/features/auth/authOutcome.test.ts` (dispatch, spostato da signUp.test), `src/features/auth/signIn.test.ts`, `src/features/auth/signOut.test.ts`, `src/features/auth/AuthForm.test.tsx` (**rinomina** da `SignUpForm.test.tsx`, assertion 1.6 preservate col modo sign-up + nuove per sign-in/toggle), `src/app/AuthenticatedShell.test.tsx`, `src/app/AuthRoot.test.tsx` (resa `checking`).
- Test **MODIFICA**: `src/data/authGateway.test.ts` (nomi `classifyAuthError`/`authResultFromResponse` + righe `hasSession` e riuso accesso), `src/features/auth/signUp.test.ts` (import da `./authOutcome`; togliere il describe del dispatch, spostato), `src/app/AuthGate.test.tsx` (ramo autenticato asserisce `AuthenticatedShell` + bottone `Disconnetti`).
- **Finti `AuthGateway` nei test**: la porta cresce con metodi **richiesti**, perciò ogni finto (`signUp.test.ts` `fakeGateway`/gateway che lanciano, `AuthGate.test.tsx` `inertGateway`, e i nuovi test) va reso **completo** — stub inerti dei metodi non esercitati (`signIn: async () => ({ ok:true })`, `signOut: async () => {}`, `isAuthenticated: async () => false`, `onAuthStateChange: () => () => {}`) oltre a quello sotto test. Definirli inline nei file di test (i `.test.*` sono fuori dal grafo dei confini, `eslint.config.js:53`); nessun helper condiviso in codice non-test.

## Tasks & Acceptance

**Execution:**
- `src/domain/ports/authGateway.ts` — aggiungere `AuthResult`/`SignInResult`/`Unsubscribe` ed estendere `AuthGateway` (tipi puri).
- `src/data/authGateway.ts` — rinominare le due mappe pure a nomi neutri; aggiungere `hasSession`; implementare `signIn`/`signOut`/`isAuthenticated`/`onAuthStateChange` con confine totale; opzioni client `persistSession`/`autoRefreshToken` esplicite.
- `src/features/auth/authOutcome.ts` — estrarre `AuthSubmitOutcome` + `applyAuthOutcome`.
- `src/features/auth/signUp.ts` — riusare `./authOutcome` (nessun cambio di comportamento).
- `src/features/auth/signIn.ts` + `signOut.ts` — orchestrazioni totali `submitSignIn`/`submitSignOut`.
- `src/features/auth/AuthForm.tsx` + `AuthScreen.tsx` — form parametrizzato dal modo + container bimodale con toggle.
- `src/app/AuthenticatedShell.tsx` — branding + bottone Disconnetti.
- `src/app/AuthGate.tsx` + `AuthRoot.tsx` — commutazione con shell autenticata; stato di sessione reale (boot + subscription + placeholder) e handler di disconnessione.
- `src/i18n/en.ts` + `it.ts` — nuove chiavi `auth` in parità.
- Test — codificare **ogni** riga della I/O Matrix: `submitSignIn` (ok/reason/throw), `submitSignOut` (ok/throw), `applyAuthOutcome` (ok⇒solo onAuthenticated; fail⇒solo onError), `classifyAuthError` (`invalid_credentials`⇒`wrong-password`) e `hasSession` (presente⇒true, `null`⇒false), `AuthForm` per entrambi i modi (titolo/submit/toggle giusti; ancoraggio errore invariato) e il toggle presente, `AuthenticatedShell` (branding + `Disconnetti` + `disabled` con pending), `AuthGate` (autenticato⇒shell con Disconnetti e non il form; non autenticato⇒form), `AuthRoot` (resa iniziale `checking` = né form né shell).

**Acceptance Criteria:**
- Given un account esistente e un gateway che accetta le credenziali, when l'utente accede, then `submitSignIn → { ok:true }` e, a stato autenticato, `AuthGate` rende la radice protetta (branding `lang="ja"` + tagline + bottone Disconnetti) e non il form (AC1).
- Given una password errata (o un'email inesistente), when l'utente invia in modo accesso, then compare `auth.error.wrongPassword` = `Password errata.` **accanto al campo password**, identico nei due casi (non rivela se l'email esista), e nessuna stringa grezza di Supabase compare (AC2).
- Given una sessione persistita, when l'app si avvia, then `AuthRoot` la riflette via `isAuthenticated()`/`onAuthStateChange` senza flash del form; e la persistenza è dichiarata dal client (`persistSession: true`) (AC3, parte meccanica; verifica live differita).
- Given una sessione attiva, when l'utente si disconnette, then `submitSignOut` invoca `gateway.signOut()` (confine totale) e lo stato torna `anonymous` (AC4, parte meccanica; verifica live differita).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check-contrast`, when girano, then passano tutti senza regressioni sulle sonde di 1.1–1.6 (confini `AD-1`, `@supabase/supabase-js` solo in `data`, regola colore, i18n type-safe/parità).

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 0, medium 2, low 3)
- defer: 1: (high 0, medium 0, low 1)
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[medium]` `[patch]` **Wiring modo→orchestratore non coperto (cuore di 1.7)**: la selezione `mode === 'sign-up' ? submitSignUp : submitSignIn` viveva inline in `AuthScreen`, raggiungibile solo via stato React ⇒ nessun test (invertire il ternario passava comunque). Estratto il modulo PURO `src/features/auth/authMode.ts` (`AuthMode`, `AUTH_MODE_COPY` per-modo, `submitForMode(mode)`); `AuthScreen` ora lo consuma; nuovo `authMode.test.ts` asserisce l'uguaglianza per riferimento (`submitForMode('sign-in') === submitSignIn`, `'sign-up' === submitSignUp`), le chiavi per-modo e `toggleTo` = l'altro modo.
  - `[medium]` `[patch]` **Copy d'errore fuorviante sull'accesso**: `auth.error.unknown` («The account could not be created… / Impossibile creare l'account…») era inquadrato sulla registrazione ma compare anche su un accesso fallito. Reso neutro (en «Something went wrong. Try again.», it «Qualcosa è andato storto. Riprova.»), solo il valore, chiave invariata.
  - `[low]` `[patch]` **Confine totale mancante su `onAuthStateChange`**: unico metodo della porta senza `try/catch` ⇒ un throw sincrono dell'SDK sfuggiva nell'useEffect di AuthRoot (crash al boot). Avvolto in try/catch con `Unsubscribe` no-op su throw.
  - `[low]` `[patch]` **Guardia landmark mancante sulla shell autenticata**: `AuthenticatedShell` rende `<header>` + `<App/>` (unico `<main>`) senza un test che lo asserisca (1.6 trattava il `<main>` annidato come difetto). Aggiunto il test «esattamente un `<main>`».
  - `[low]` `[patch]` **La lettura di boot poteva sovrascrivere un evento di subscription più recente**: `isAuthenticated()` tardiva sovrascriveva uno stato già mosso da un evento. Reso l'update funzionale no-op fuori da `'checking'` (`prev === 'checking' ? … : prev`); gli eventi restano incondizionati.

Findings deferiti: (1) e2e live di accesso/persistenza/disconnessione contro Supabase reale — differita per architettura a 1.10 (teardown via delete-account, AD-13), come il signup live di 1.6.

Findings rifiutati (rappresentativi): «`hasSession({})` classifica come sessione» — il contratto di supabase-js è `Session | null`, `!= null` è corretto; «autoComplete/aria-busy/aria-live/annuncio di caricamento» — enhancement non legati ad alcun AC (autocomplete già rifiutato in 1.6); «toggle senza `border-strong`» — lo spec sanziona l'affordance testuale (nessun bordo ≠ solo-hairline); «parità i18n delle nuove chiavi non testata» — il test di parità ricorsivo copre già ogni chiave (verde); «toggle potrebbe diventare submit» — il test «un solo submit» lo guarda già; «`isAuthenticated()` che si blocca / setState dopo unmount» — AuthRoot è la radice permanente, `getSession` legge lo storage locale; «sign-out swallow lascia sessione viva» — `signOut` pulisce comunque lo storage locale (ciò che AC4 osserva); «toggle durante il pending» — finestra minima, submit già disabilitato.

## Design Notes

**Perché booleani al confine, non la `Session`.** `AD-1`: il dominio non conosce Supabase. La porta espone `isAuthenticated(): Promise<boolean>` e `onAuthStateChange(listener: (authenticated: boolean) => void)`: l'id utente non serve ad alcun AC di 1.7 (lo introdurranno 1.8/1.9 quando lo useranno — «nessun campo prima della storia che lo usa», come per `user_settings`). Così l'accesso ottiene un contratto puro e la subscription resta testabile come mappa `session → boolean` (`hasSession`).

**Accesso e registrazione condividono forma e classificazione.** Su Supabase, `signInWithPassword` ritorna la stessa forma `{ data:{ session }, error }` di `signUp`, e `invalid_credentials → wrong-password` è **già** mappato dalla classify di 1.6. Perciò l'accesso **riusa** `classifyAuthError`/`authResultFromResponse` (rinominate da `*SignUp*` a nomi neutri) invece di duplicarle; `submitSignIn` è il gemello di `submitSignUp` sulla porta `signIn`. AC2 (non rivelare l'email) è **strutturale**: password errata ed email inesistente collassano entrambe su `invalid_credentials`, quindi sullo stesso messaggio.

**Persistenza dichiarata + niente flash (AC3).**
```ts
createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
// AuthRoot: 'checking' finché isAuthenticated() risolve ⇒ nessuna resa del form
// su una sessione già valida; onAuthStateChange tiene lo stato in sincrono.
```
`persistSession` è di default `true` in supabase-js, ma renderlo esplicito trasforma FR1.3 in una decisione leggibile invece che in un default implicito.

**Verifica live differita, per architettura (come 1.6/1.5).** Provare *davvero* «accedo → atterro autenticato», «chiudo e riapro il browser → sono ancora autenticato», «mi disconnetto → un riavvio non ripristina» richiede un account reale contro Supabase reale e il suo teardown; `AD-13` lo fissa alla `delete-account` (`AD-11`, 1.10, non ancora esistente) con email univoca per run, e `AD-12/13` vieta l'istanza locale. La e2e live è quindi **differita** (registrata in `deferred`), mentre qui è verificato meccanicamente tutto il resto (orchestrazioni totali, classificazione, mappa `session→boolean`, resa bimodale, shell autenticata) con union chiuse e finti iniettati.

## Verification

**Commands:**
- `npm run lint` — expected: 0 errori sull'albero reale; `@supabase/supabase-js` solo in `src/data/`; nessun colore letterale in `ui`/`features`; confini `AD-1` invariati.
- `npm run typecheck` — expected: `tsc` strict senza errori, nessun `any`; le chiavi `auth.*` nuove accettate da `t()`.
- `npm test` — expected: verdi i nuovi test (ogni riga della I/O Matrix) + le sonde di 1.1–1.6 senza regressioni (parità cataloghi inclusa).
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori.
- `npm run check-contrast` — expected: nessuna regressione (token invariati).

**Manual checks (if no CLI):**
- Ispezionare `src/data/authGateway.ts`: unico importatore di `@supabase/supabase-js`; opzioni `persistSession`/`autoRefreshToken` esplicite; ogni metodo con confine totale.
- Ispezionare `AuthForm.tsx`: un solo submit; il messaggio d'errore resta nel gruppo del campo responsabile; toggle secondario testuale.

## Auto Run Result

Status: awaiting-operator

**Sommario.** L'accesso, la disconnessione e la sessione persistente nascono **estendendo** la superficie di 1.6, non reimplementandola. Il dominio dichiara sulla stessa porta `signIn`, `signOut`, `isAuthenticated(): Promise<boolean>` e `onAuthStateChange(listener): Unsubscribe`, esponendo **solo booleani** (mai un oggetto `Session` del vendor). `src/data/` implementa i nuovi metodi con confine **totale**, riusando le mappe pure condivise (rinominate a nomi neutri `classifyAuthError`/`authResultFromResponse`) più la pura `hasSession`, e crea il client con `persistSession`/`autoRefreshToken` **espliciti**: la persistenza di FR1.3 è una decisione dichiarata. AC2 è **strutturale**: password errata ed email inesistente collassano entrambe su `invalid_credentials → wrong-password → "Password errata."`, senza rivelare l'esistenza dell'email. La **schermata di Accesso** resta una sola (EXPERIENCE.md) e diventa bimodale via `mode` (default `sign-up`) su un unico `AuthForm`; `app` riflette la sessione reale (letta al boot con placeholder anti-flash e via subscription) e ospita la shell autenticata con il bottone Disconnetti. Parte fuori dal repo (operatore): la verifica **live** del ciclo di sessione contro Supabase reale — richiede un account reale e il teardown (`delete-account`, 1.10) che non esiste ancora, e `AD-12/13` vieta l'istanza locale. Per questo lo stato finale è `awaiting-operator`, non `done` (come per 1.2/1.5/1.6).

**File creati/modificati (uno per riga):**
- `src/domain/ports/authGateway.ts` — **modifica**: `AuthResult` condiviso, `SignUpResult`/`SignInResult` come alias, `Unsubscribe`, e `AuthGateway` esteso con `signIn`/`signOut`/`isAuthenticated`/`onAuthStateChange`. Tipi puri.
- `src/data/authGateway.ts` — **modifica**: mappe pure a nomi neutri; `hasSession`; `signIn`/`signOut`/`isAuthenticated`/`onAuthStateChange` con confine totale (incl. il try/catch su `onAuthStateChange` da review); client con `persistSession`/`autoRefreshToken` espliciti.
- `src/features/auth/authOutcome.ts` — **nuovo**: `AuthSubmitOutcome` + `applyAuthOutcome` (condivisi registrazione/accesso).
- `src/features/auth/authMode.ts` — **nuovo** (da review): `AuthMode`, `AUTH_MODE_COPY`, `submitForMode` — selezione modo→orchestratore pura e testabile.
- `src/features/auth/signUp.ts` — **modifica**: riusa `./authOutcome` (comportamento invariato).
- `src/features/auth/signIn.ts` + `signOut.ts` — **nuovi**: orchestrazioni totali `submitSignIn`/`submitSignOut`.
- `src/features/auth/AuthForm.tsx` — **nuovo** (rinomina da `SignUpForm.tsx`): form parametrizzato dal modo (title/submit/toggle) + toggle secondario testuale.
- `src/features/auth/AuthScreen.tsx` — **nuovo** (rinomina da `SignUpScreen.tsx`): container bimodale che consuma `authMode`.
- `src/app/AuthenticatedShell.tsx` — **nuovo**: branding + bottone Disconnetti.
- `src/app/AuthGate.tsx` — **modifica**: commutazione con shell autenticata; props `onSignOut`/`signOutPending`.
- `src/app/AuthRoot.tsx` — **modifica**: stato `checking|authenticated|anonymous`, boot read (guardato) + subscription + placeholder + handler di disconnessione.
- `src/i18n/en.ts` + `src/i18n/it.ts` — **modifica**: nuove chiavi `auth` (`signInTitle`, `signInSubmit`, `switchToSignIn`, `switchToSignUp`, `signOut`) in parità; `auth.error.unknown` reso neutro (da review).
- File eliminati: `src/features/auth/SignUpForm.tsx`, `SignUpScreen.tsx`, `SignUpForm.test.tsx` (rinominati in `Auth*`).
- Test **nuovi/modificati**: `authOutcome.test.ts`, `authMode.test.ts`, `signIn.test.ts`, `signOut.test.ts`, `AuthForm.test.tsx`, `AuthenticatedShell.test.tsx`, `AuthRoot.test.tsx`; aggiornati `authGateway.test.ts`, `signUp.test.ts`, `AuthGate.test.tsx`.

**Findings di review:** 5 patch applicati (2 medium: wiring modo→submit non coperto, copy d'errore fuorviante; 3 low: confine totale su `onAuthStateChange`, guardia landmark shell, guardia sulla lettura di boot), 1 deferito (low: e2e live), 0 intent_gap, 0 bad_spec, 14 rifiutati (vedi Review Triage Log).

**Follow-up review recommendation: true.** Patch di questa passata: high 0, medium 2, low 3. Punteggio `3×medium + 1×low = 6 + 3 = 9 ≥ 5` ⇒ `true` (nessun high).

**Verifica eseguita (tutta verde, rieseguita dopo i patch):** `npm run typecheck` (`tsc` strict, nessun `any`), `npm run lint` (0 errori; `@supabase/supabase-js` solo in `src/data/`; nessun colore letterale; confini `AD-1` invariati), `npm test` (**171 test su 20 file**: ogni riga della I/O Matrix + i patch + le sonde di 1.1–1.6 senza regressioni, parità cataloghi inclusa), `npm run build` (`tsc --noEmit` + `vite build` producono `dist/`), `npm run check-contrast` (32/32 coppie conformi). Matrix Test Audit: tutte le 10 righe della I/O Matrix coperte da test che girano e passano.

**Rischi residui / azioni operatore.** (1) La verifica **live** del ciclo di sessione (accesso, persistenza fra riavvii, disconnessione) contro Supabase reale è un'azione dell'operatore (prerequisito: le operator_actions di 1.6 completate + un account reale): `operator_actions`. (2) La e2e **automatica** dello stesso ciclo è differita a 1.10 (teardown via `delete-account`, `AD-13`): `deferred`. (3) La glue `useEffect` di `AuthRoot` (boot read + subscription) resta sottile e verificata solo nella resa iniziale `checking`, come la glue interattiva di 1.6, coperta dalla e2e live differita.
