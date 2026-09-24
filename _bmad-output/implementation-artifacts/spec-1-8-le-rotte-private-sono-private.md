---
title: 'Story 1.8: Le rotte private sono private'
type: 'feature'
created: '2026-09-24'
status: done
baseline_revision: '6790a66b4106cffdd45dace40a6a2ce6bf310eaf'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Verifica live/e2e del guard di rotta nel browser reale contro l'app
      deployata, differita per architettura.
    evidence: |-
      Provare AC1/AC3 end-to-end nel browser — un visitatore anonimo che apre un
      deep link a una rotta privata atterra sulla schermata di Accesso senza 404
      (rewrite Vercel + <Navigate> in useEffect), e un utente autenticato che apre
      la radice raggiunge la rotta protetta — richiede l'app deployata e, per il
      caso autenticato, una sessione reale. renderToStaticMarkup (ambiente node)
      non esegue useEffect, quindi <Navigate> rende null in SSR: la DECISIONE del
      guard è coperta meccanicamente (routeGuards.test: type/to/replace) e il
      route-matching sincrono con MemoryRouter, ma la navigazione reale e il
      no-404 sui deep link no. Nessuna infrastruttura Playwright nello stack; il
      teardown e2e della sessione reale è AD-13/1.10 (delete-account), non ancora
      esistente. Stesso schema del deep-link live differito in 1.2 e della
      sessione live differita in 1.7.
    location: >-
      src/app/routeGuards.tsx + src/app/AppRoutes.tsx + vercel.json + storia 1.10
    severity: low
operator_actions:
  - "Esegui una verifica manuale una tantum del guard di rotta contro l'app deployata (preview o produzione): (1) da NON autenticato, apri direttamente un deep link a una rotta privata (la radice `/` e un percorso interno come `/dashboard` o `/impostazioni`) e conferma di essere reindirizzato alla schermata di Accesso senza 404 — il rewrite di vercel.json serve index.html e il guard lato client reindirizza (AC1 + deep link); (2) accedi con un account reale (prerequisito: operator_actions di 1.6/1.7 completate) e conferma che aprendo la radice del sito raggiungi la rotta protetta che risponde, con branding e bottone Disconnetti (AC3). La e2e automatica di questo ciclo è differita alla storia 1.10 (teardown via delete-account, AD-13): un agente non può crearla in sicurezza senza teardown e senza infrastruttura Playwright."
---

<intent-contract>

## Intent

**Problem:** L'autenticazione di 1.7 commuta fra schermata di Accesso e radice protetta con un BOOLEANO in memoria (`AuthGate`): non esistono URL, rotte, né un guard. `FR1.6` (guard di rotta unico in `src/app/`) e l'AC di 1.8 sono scoperti: un visitatore non autenticato che apre l'URL di una rotta privata (dashboard, sessione, statistiche, impostazioni) non è reindirizzato all'Accesso, e i deep link lato client non esistono ancora (solo il rewrite di `vercel.json` è in posa).

**Approach:** Introdurre **React Router** (la libreria fissata dall'architettura, pacchetto `react-router` v8) montato in `src/app/`. Un **unico** guard puro `RequireAuth` avvolge tutte le rotte private; il suo contraltare simmetrico `RedirectIfAuthenticated` protegge la sola rotta pubblica di Accesso. `AuthRoot` **riusa invariato** lo stato di sessione reale di 1.7 (lettura al boot + subscription + placeholder `checking`) e alimenta il booleano `authenticated` nella tabella delle rotte (`AppRoutes`). La decisione del guard è una funzione **pura** prop→elemento (invocabile direttamente nei test: non autenticato → `<Navigate to="/login" replace>`, autenticato → `<Outlet/>`); il route-matching è verificato con `MemoryRouter` + `renderToStaticMarkup`. Le schermate (features) restano **prive** di controlli di auth (AC2). La commutazione booleana `AuthGate` di 1.7 è sostituita dal routing per URL.

## Boundaries & Constraints

**Always:**
- Tutto il codice di routing/guard vive **solo** in `src/app/` (composition root, `AD-1`). `react-router` è importato solo in `app` (`boundaries/external` ammette l'esterno per `app`; il funnel i18n non è toccato).
- Il guard è un **unico** componente puro `RequireAuth({ authenticated })` in `src/app/`: `authenticated ? <Outlet/> : <Navigate to={LOGIN_PATH} replace/>`. Nessun hook → invocabile direttamente nei test. Il contraltare pubblico `RedirectIfAuthenticated({ authenticated })` → `authenticated ? <Navigate to={ROOT_PATH} replace/> : <Outlet/>`. **Nessun** check di auth in AuthScreen o AuthenticatedShell.
- I path sono **costanti** in un modulo puro (`LOGIN_PATH = '/login'`, `ROOT_PATH = '/'`): nessuna stringa di path sparsa.
- Tabella rotte (`AppRoutes`): la rotta pubblica `/login` sotto `RedirectIfAuthenticated` → `AuthScreen`; **tutto il resto** (`path="*"`) sotto `RequireAuth` → `AuthenticatedShell` (la radice protetta minima). Un catch-all dietro il guard protegge OGNI path non-`/login` (dashboard/sessione/statistiche/impostazioni incluse — nessuna esiste ancora): più forte che elencare rotte future, coerente con «nessuna rotta prima della storia che la usa».
- `AuthRoot` invariato nel modello di 1.7: `checking` → placeholder neutro (niente flash, AC3), poi passa `authenticated = status === 'authenticated'` ad `AppRoutes`; lettura al boot guardata + subscription + cleanup + handler `onSignOut` preservati.
- `main.tsx` avvolge l'albero in `<BrowserRouter>`: i deep link sono serviti dal rewrite di `vercel.json` (`/(.*) → /index.html`, già fissato da `deploy-config.test.ts`).
- I redirect usano `replace` (nessun inquinamento della cronologia di navigazione).
- Nessuna nuova stringa visibile (guard e rotte non rendono copy) ⇒ nessuna nuova chiave i18n, nessun impatto su parità cataloghi o regola colore. Solo token Tailwind di 1.3 dove qualcosa rende (qui nulla di nuovo rende).

**Block If:**
- _Nessun blocco._ La verifica **live** end-to-end del guard nel browser reale contro l'app deployata (anonimo su deep link → Accesso senza 404; autenticato → radice protetta) richiede un URL deployato e, per il caso autenticato, una sessione reale (il cui teardown e2e è `AD-13`/1.10, non ancora esistente). Si finalizza a `awaiting-operator` con `operator_actions`, mai `blocked`.

**Never:**
- Nessun `react-router` fuori da `src/app/`; nessun controllo di auth dentro le schermate (features/ui); nessun secondo guard sparso.
- Non enumerare schermate future come rotte reali (dashboard/sessione arrivano in Epic 3, statistiche in Epic 5): il catch-all le copre.
- Non aggiungere infrastruttura e2e/browser (Playwright non è nello stack): differita. Non reimplementare lo stato di sessione di 1.7: **riusarlo**.
- Non usare data-router / loader di rotta (eccessivo): le `Routes` dichiarative bastano.
- **Fuori scope (storie successive):** persistenza della lingua e scrittura `user_settings` (1.9); cancellazione account (1.10); dashboard reale (Epic 3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| guard, non autenticato | `RequireAuth({ authenticated: false })` (invocazione diretta) | ritorna un elemento `Navigate` con `to === LOGIN_PATH` (`/login`) e `replace === true` | — |
| guard, autenticato | `RequireAuth({ authenticated: true })` | ritorna un elemento `Outlet` | — |
| rotta pubblica, autenticato | `RedirectIfAuthenticated({ authenticated: true })` | ritorna `Navigate` con `to === ROOT_PATH` (`/`), `replace === true` | — |
| rotta pubblica, anonimo | `RedirectIfAuthenticated({ authenticated: false })` | ritorna `Outlet` | — |
| radice protetta, autenticato | `MemoryRouter` `/` + `authenticated=true` | markup rende `AuthenticatedShell`: branding `lang="ja"` `積ん読ゼロ` + tagline + Disconnetti; **non** il form | — |
| deep link protetto, autenticato | `MemoryRouter` `/dashboard` + `authenticated=true` | markup rende la radice protetta minima (branding) | — |
| radice protetta, anonimo | `MemoryRouter` `/` + `authenticated=false` | markup **non** contiene branding né Disconnetti (guard blocca; `Navigate`→null in SSR) | — |
| deep link protetto, anonimo | `MemoryRouter` `/statistiche` + `authenticated=false` | markup **non** contiene branding (guard blocca) | — |
| rotta di Accesso, anonimo | `MemoryRouter` `/login` + `authenticated=false` | markup rende il form (`id="auth-email"`, `id="auth-password"`) | — |
| rotta di Accesso, autenticato | `MemoryRouter` `/login` + `authenticated=true` | markup **non** contiene il form (rediretto; `Navigate`→null in SSR) | — |
| resa iniziale checking | `<AuthRoot>` con `isAuthenticated()` non risolta | placeholder neutro: né form né shell (1.7, invariato) | — |

</intent-contract>

## Code Map

- `src/app/routes.ts` — **NUOVO** (app): costanti pure `LOGIN_PATH = '/login'`, `ROOT_PATH = '/'`. Nessun import: fonte unica dei path (nessuna stringa sparsa).
- `src/app/routeGuards.tsx` — **NUOVO** (app): `RequireAuth({ authenticated })` (IL guard: `authenticated ? <Outlet/> : <Navigate to={LOGIN_PATH} replace/>`) e `RedirectIfAuthenticated({ authenticated })` (contraltare pubblico: `authenticated ? <Navigate to={ROOT_PATH} replace/> : <Outlet/>`). Puri prop→elemento, **nessun hook** → invocabili direttamente nei test. Import `{ Navigate, Outlet }` da `react-router` (app→external ammesso, `eslint.config.js:106`).
- `src/app/AppRoutes.tsx` — **NUOVO** (app): la tabella `<Routes>`. Props `{ authenticated, gateway, onAuthenticated, onSignOut, signOutPending }`. Rende: `<Route element={<RedirectIfAuthenticated authenticated/>}><Route path={LOGIN_PATH} element={<AuthScreen gateway onAuthenticated/>}/></Route>` e `<Route element={<RequireAuth authenticated/>}><Route path="*" element={<AuthenticatedShell onSignOut signOutPending/>}/></Route>`. Import `{ Routes, Route }` da `react-router`; `AuthScreen` da `../features/auth/AuthScreen` (app→features ok); `AuthenticatedShell` da `./AuthenticatedShell`; tipo `AuthGateway` da `../domain/ports/authGateway`.
- `src/app/AuthRoot.tsx` — **MODIFICA** (app): sostituire il render di `<AuthGate .../>` con `<AppRoutes authenticated={status === 'authenticated'} gateway={gateway} onAuthenticated={() => setStatus('authenticated')} onSignOut={…} signOutPending={signOutPending} />`. **Invariati**: stato `checking|authenticated|anonymous`, lettura al boot guardata + subscription + cleanup, placeholder neutro in `checking` (AC3), handler `onSignOut` (`submitSignOut` → `status='anonymous'`). Rimuovere import di `./AuthGate`, aggiungere `./AppRoutes`.
- `src/app/main.tsx` — **MODIFICA** (app): avvolgere `<AuthRoot gateway=…/>` in `<BrowserRouter>` (import da `react-router`). Il rewrite di `vercel.json` serve i deep link a BrowserRouter senza 404. Nessun'altra modifica alla composizione (`decideBoot`, `createSupabaseAuthGateway` invariati).
- `src/app/AuthGate.tsx` — **ELIMINA** (app): la commutazione booleana di 1.7 è sostituita dal routing per URL. Eliminare anche `src/app/AuthGate.test.tsx`.
- `src/app/AuthenticatedShell.tsx` — **RIFERIMENTO** (invariato): la radice protetta minima (`<header>` Disconnetti + `<App/>`). Resta l'elemento della rotta protetta. Non modificare.
- `src/features/auth/AuthScreen.tsx` — **RIFERIMENTO** (invariato): la schermata di Accesso bimodale, elemento della rotta `/login`. Nessun check di auth qui (AC2). Non modificare.
- `src/ui/App.tsx` — **RIFERIMENTO** (invariato): branding `積ん読ゼロ` + tagline dentro `AuthenticatedShell`.
- `package.json` + `package-lock.json` — **MODIFICA**: aggiungere `react-router` `^8.4.0` (peer `react >= 19.2.7`, soddisfatto da `^19.3.0`). Installare con `npm install react-router@^8.4.0` per aggiornare il lockfile (la CI usa `npm ci`).
- `eslint.config.js` — **MODIFICA** (da review): rendere MECCANICO il confine «react-router solo in `app`». Aggiungere alla regola `boundaries/external` l'entry `{ from: ['ui', 'features', 'data'], disallow: ['react-router'] }` (NON `app`, che lo importa legittimamente): react-router è imbutato verso `app` come `@supabase/supabase-js` verso `data`; un import da un altro livello è CI rossa (AC5/AC2).
- Test **NUOVI**: `src/app/routeGuards.test.tsx` (invocazione diretta: `RequireAuth(false)`→`Navigate` a `LOGIN_PATH` con `replace`; `RequireAuth(true)`→`Outlet`; `RedirectIfAuthenticated(true)`→`Navigate` a `ROOT_PATH`; `false`→`Outlet`); `src/app/AppRoutes.test.tsx` (`MemoryRouter` + `renderToStaticMarkup`: le 6 righe di route-matching della Matrix, **più** l'invariante di landmark «esattamente un `<main>`» sulla radice protetta autenticata e su `/login` — ripristinata dalla review dopo l'eliminazione di `AuthGate.test.tsx`).
- Test **MODIFICA** (da review): `src/boundaries.test.ts` — nuova sonda: un frammento virtuale `src/features/__probe__.ts` che importa `react-router` deve produrre `boundaries/external` a severità ERROR (react-router confinato ad `app`).
- Test **ELIMINATO**: `src/app/AuthGate.test.tsx`.
- Test **INVARIATO**: `src/app/AuthRoot.test.tsx` (resa `checking` = placeholder; `checking` ritorna **prima** di `<Routes>`, quindi non serve un Router nel test).
- **Finti `AuthGateway` nei test**: `AppRoutes` riceve `gateway` ma lo passa solo ad `AuthScreen` (non invocato in SSR senza submit): usare un finto inerte **completo** inline (schema di 1.7: `signUp/signIn/signOut/isAuthenticated/onAuthStateChange`).

## Tasks & Acceptance

**Execution:**
- `src/app/routes.ts` — costanti `LOGIN_PATH`/`ROOT_PATH`.
- `src/app/routeGuards.tsx` — `RequireAuth` + `RedirectIfAuthenticated` puri (prop→elemento, nessun hook).
- `src/app/AppRoutes.tsx` — tabella `Routes` (login pubblica sotto `RedirectIfAuthenticated`; catch-all protetto sotto `RequireAuth`).
- `src/app/AuthRoot.tsx` — rendere `AppRoutes` al posto di `AuthGate`; sessione/placeholder invariati.
- `src/app/main.tsx` — `BrowserRouter` attorno ad `AuthRoot`.
- Eliminare `src/app/AuthGate.tsx` + `src/app/AuthGate.test.tsx`.
- `package.json`/`package-lock.json` — aggiungere `react-router`.
- Test — codificare **ogni** riga della I/O Matrix: guardie via invocazione diretta (tipo+props dell'elemento, incl. bersaglio del redirect e `replace`); route-matching via `MemoryRouter`+`renderToStaticMarkup` (autenticato⇒contenuto protetto reso; anonimo⇒assente; `/login` pubblica; autenticato su `/login`⇒niente form); resa `checking` invariata.

**Acceptance Criteria:**
- Given un visitatore non autenticato e una qualsiasi rotta privata (la radice o un deep link tipo `/dashboard`, `/statistiche`, `/impostazioni`), when la apre, then il guard unico `RequireAuth` decide il redirect verso la schermata di Accesso (`<Navigate to="/login" replace>`) e **nessun** contenuto protetto è reso (AC1; il landing nel browser reale è verifica live dell'operatore).
- Given il guard di rotta, when il codice è ispezionato, then esiste in un solo punto in `src/app/` (`routeGuards.tsx` + tabella in `AppRoutes.tsx`) e **nessuna** schermata (features) contiene controlli di autenticazione (AC2).
- Given un utente autenticato, when apre la radice del sito, then raggiunge la rotta protetta minima (`AuthenticatedShell`: branding `lang="ja"` + tagline + Disconnetti) che **esiste e risponde**; il contenuto resta minimo (la dashboard vera è Epic 3) (AC3).
- Given un deep link a una rotta interna aperto direttamente, when `vercel.json` riscrive verso `index.html`, then il routing lato client (`BrowserRouter`) prende il controllo e applica il guard (nessun 404) (config già fissata da `deploy-config.test.ts`).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check-contrast`, when girano, then passano senza regressioni sulle sonde 1.1–1.7 (confini `AD-1`, funnel i18n, regola colore, parità cataloghi), con `react-router` importato **solo** in `src/app/`.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 1: (high 0, medium 0, low 1)
- reject: 16: (high 0, medium 0, low 16)
- addressed_findings:
  - `[medium]` `[patch]` **Confine «react-router solo in app» non imposto meccanicamente (AC5/AC2)**: `boundaries/external` faceva da funnel solo per i18n; un import di `react-router` da `features`/`ui`/`data` passava `npm run lint` con CI verde, quindi l'invariante era solo convenzionale (contro la tesi del progetto: «una violazione è CI rossa, non un avviso»). Aggiunta l'entry `{ from:['ui','features','data'], disallow:['react-router'] }` in `eslint.config.js` + una sonda in `src/boundaries.test.ts` (`features`→`react-router` ⇒ `boundaries/external` ERROR). Ora reintrodurre logica di routing/auth nelle schermate è CI rossa.
  - `[low]` `[patch]` **Invariante di landmark persa con l'eliminazione di `AuthGate.test.tsx`**: il test eliminato asseriva «esattamente un `<main>`, nessun `<main>` annidato»; `AppRoutes.test.tsx` non lo ricopriva. Aggiunti due `it` («esattamente un `<main>`») sulla radice protetta autenticata e sulla rotta `/login`.

Findings deferiti: (1) e2e/verifica live del guard nel browser reale contro l'app deployata — differita per architettura a 1.10 (teardown via `delete-account`, `AD-13`; nessuna infrastruttura Playwright nello stack), come il deep-link live di 1.2 e la sessione live di 1.7.

Findings rifiutati (rappresentativi): «nessuna rotta 404 esplicita / un URL sconosciuto rende la shell» — Epic 1 è minimale per intento (radice protetta minima, dashboard in Epic 3), il catch-all→shell è deliberato; «anonimo su deep link perde la destinazione (nessun return-to)» — nessun AC lo richiede e in Epic 1 c'è una sola superficie protetta; «`BrowserRouter` in `main.tsx` non testato» — glue del composition root senza rami deterministici, mai testata (come nelle storie precedenti); «`/login` autenticato: il test verifica solo l'assenza del form, non il redirect» — la DECISIONE del redirect è coperta da `routeGuards.test` (`RedirectIfAuthenticated`→`Navigate` a `ROOT_PATH`); «doppia asserzione costante+letterale nei test» — documenta il valore atteso, innocua; «`package-lock.json`/`vercel.json` non nel diff» — limiti dell'artefatto di review, file pre-esistenti e invariati (`vercel.json` già fissato da `deploy-config.test.ts`); «`basename` per deploy in sottocartella» — Vercel serve alla radice; «resa `null` post-login su `/login`» — glue d'effetto, nel browser reale `<Navigate>` reindirizza subito (verifica live differita).

## Design Notes

**Perché React Router (`react-router` v8).** `ARCHITECTURE-SPINE.md` §Stack lo fissa («React Router — Rotte e guard»), `EXPERIENCE.md` dichiara «Accesso: rotta non autenticata, redirect da qualsiasi rotta protetta», e `vercel.json` riscrive i deep link verso `index.html` (routing lato client). v7+ ha unificato il pacchetto: si importa da `react-router` (non `react-router-dom`, fermo a v7). Modalità **dichiarativa** (`BrowserRouter`/`Routes`/`Route`/`Navigate`/`Outlet`), non data-router: nessun loader, il guard è pura funzione stato→vista.

**Guard puro, redirect testabile senza effetti.** `renderToStaticMarkup` (ambiente node, nessun jsdom) **non** esegue `useEffect`, e `<Navigate>` naviga in un effetto ⇒ in SSR rende `null`. Perciò il redirect nel browser è "glue" d'effetto (come la glue `useEffect` di `AuthRoot` in 1.7). Ma la DECISIONE del guard è pura:
```tsx
export function RequireAuth({ authenticated }: { authenticated: boolean }) {
  return authenticated ? <Outlet /> : <Navigate to={LOGIN_PATH} replace />;
}
```
Senza hook, un test la invoca DIRETTAMENTE e asserisce tipo+props dell'elemento (`el.type === Navigate`, `el.props.to === '/login'`, `el.props.replace`), coprendo meccanicamente il bersaglio del redirect (AC1). Il route-matching è **sincrono** (senza effetti) e si verifica con `MemoryRouter`+`renderToStaticMarkup`: autenticato⇒contenuto protetto reso; anonimo⇒contenuto protetto assente.

**Catch-all sotto il guard invece di enumerare schermate future.** Dashboard, sessione, statistiche, impostazioni non esistono in Epic 1 (arrivano in Epic 3/5). Una sola rotta `path="*"` dietro `RequireAuth` protegge OGNI path non-`/login`: più forte che elencare quattro rotte fittizie, e coerente con «nessuna rotta prima della storia che la usa». La radice `/` e ogni deep link autenticato rendono la stessa radice protetta minima; le rotte vere sostituiranno il catch-all in Epic 3.

**Un solo guard, schermate pulite (AC2).** `RequireAuth` è l'unica autorizzazione delle rotte private; `RedirectIfAuthenticated` è il suo contraltare **simmetrico** sulla rotta pubblica (evita di mostrare il form a chi è già dentro dopo il login, senza navigazione imperativa nelle features). Entrambi in `src/app/`; nessun controllo di auth in `AuthScreen`/`AuthenticatedShell`.

**Verifica live differita, per architettura (come 1.2/1.7).** La conferma end-to-end nel browser reale — anonimo su deep link → schermata di Accesso senza 404 (rewrite Vercel + guard), e autenticato → radice protetta — richiede l'app deployata e, per il caso autenticato, una sessione reale (il cui teardown e2e è `AD-13`/1.10). La e2e automatica è differita (nessuna infrastruttura Playwright nello stack); la verifica manuale è `operator_action`.

## Verification

**Commands:**
- `npm run lint` — expected: 0 errori sull'albero reale; `react-router` confinato a `src/app/` in modo MECCANICO (funnel `boundaries/external`, CI rossa se sfugge in `ui`/`features`/`data`); confini `AD-1` invariati; funnel i18n invariato.
- `npm run typecheck` — expected: `tsc` strict senza errori, nessun `any`; import da `react-router` tipizzati; le props delle rotte accettate.
- `npm test` — expected: verdi i nuovi test (ogni riga della I/O Matrix) + le sonde di 1.1–1.7 senza regressioni (parità cataloghi inclusa); `AuthGate.test` rimosso senza riferimenti penzolanti.
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori.
- `npm run check-contrast` — expected: nessuna regressione (token invariati).

**Manual checks (if no CLI):**
- Ispezionare `src/app/routeGuards.tsx`: guardie pure senza hook; `RequireAuth` ⇒ `Navigate` a `LOGIN_PATH`; import `react-router` solo in `app`.
- Ispezionare `src/app/AppRoutes.tsx`: `/login` sotto `RedirectIfAuthenticated`; catch-all `*` sotto `RequireAuth`; nessun check di auth nelle schermate.

## Auto Run Result

Status: awaiting-operator

**Sommario.** Le rotte private diventano private introducendo **React Router** (`react-router` v8, la libreria fissata dall'architettura) montato in `src/app/`. Un **unico** guard puro `RequireAuth` avvolge tutte le rotte private (catch-all `path="*"` → `AuthenticatedShell`); il suo contraltare simmetrico `RedirectIfAuthenticated` protegge la sola rotta pubblica `/login` → `AuthScreen`. Le guardie sono funzioni pure prop→elemento **senza hook**: la decisione del redirect (bersaglio + `replace`) è verificata invocandole direttamente, e il route-matching (sincrono) con `MemoryRouter` + `renderToStaticMarkup`. `AuthRoot` **riusa invariato** lo stato di sessione di 1.7 (boot + subscription + placeholder `checking`) e alimenta il booleano `authenticated` nella tabella; la commutazione booleana `AuthGate` di 1.7 è **sostituita** dal routing per URL. Le schermate (features) restano **prive** di controlli di auth (AC2). `main.tsx` avvolge l'albero in `<BrowserRouter>`; i deep link sono serviti dal rewrite di `vercel.json` (già fissato da `deploy-config.test.ts`). Parte fuori dal repo (operatore): la verifica **live** end-to-end del guard nel browser reale contro l'app deployata (anonimo su deep link → Accesso senza 404; autenticato → radice protetta) — richiede l'app deployata e, per il caso autenticato, una sessione reale. Per questo lo stato finale è `awaiting-operator`, non `done` (come per 1.2/1.5/1.6/1.7).

**File creati/modificati/eliminati (uno per riga):**
- `src/app/routes.ts` — **nuovo**: costanti pure `LOGIN_PATH = '/login'`, `ROOT_PATH = '/'` (fonte unica dei path).
- `src/app/routeGuards.tsx` — **nuovo**: `RequireAuth` (il guard unico) e `RedirectIfAuthenticated` (contraltare pubblico), puri prop→elemento senza hook. Import `react-router` solo in `app`.
- `src/app/AppRoutes.tsx` — **nuovo**: tabella `<Routes>` (`/login` sotto `RedirectIfAuthenticated`; catch-all `*` sotto `RequireAuth`).
- `src/app/AuthRoot.tsx` — **modifica**: rende `AppRoutes` al posto di `AuthGate`; sessione/placeholder `checking` invariati.
- `src/app/main.tsx` — **modifica**: `<BrowserRouter>` attorno ad `AuthRoot`; composizione (`decideBoot`/`createSupabaseAuthGateway`) invariata.
- `src/app/AuthGate.tsx` + `src/app/AuthGate.test.tsx` — **eliminati**: la commutazione booleana è sostituita dal routing.
- `eslint.config.js` — **modifica** (da review): funnel `boundaries/external` per `react-router` verso `app` (CI rossa se importato da `ui`/`features`/`data`).
- `package.json` + `package-lock.json` — **modifica**: aggiunto `react-router` `^8.4.0` (installato 8.4.0; peer `react >= 19.2.7` soddisfatto da 19.3.0).
- Test **nuovi/modificati**: `src/app/routeGuards.test.tsx` (decisione del guard via invocazione diretta), `src/app/AppRoutes.test.tsx` (route-matching via `MemoryRouter` + invariante «un solo `<main>`»), `src/boundaries.test.ts` (sonda react-router→app).

**Findings di review:** 2 patch applicati (1 medium: confine react-router non meccanico; 1 low: invariante di landmark persa con l'eliminazione di `AuthGate.test.tsx`), 1 deferito (low: e2e/verifica live del guard), 0 intent_gap, 0 bad_spec, 16 rifiutati (vedi Review Triage Log).

**Follow-up review recommendation: false.** Patch di questa passata: high 0, medium 1, low 1. Punteggio `3×medium + 1×low = 3 + 1 = 4 < 5` (nessun high) ⇒ `false`.

**Verifica eseguita (tutta verde, rieseguita dopo i patch):** `npm run typecheck` (`tsc` strict, nessun `any`), `npm run lint` (0 errori; `react-router` confinato ad `app` in modo meccanico; funnel i18n e confini `AD-1` invariati), `npm test` (**180 test su 21 file**: ogni riga della I/O Matrix + i patch + le sonde di 1.1–1.7 senza regressioni, parità cataloghi inclusa), `npm run build` (`tsc --noEmit` + `vite build` producono `dist/`), `npm run check-contrast` (32/32 coppie conformi). Matrix Test Audit: tutte le 11 righe della I/O Matrix coperte da test che girano e passano (`routeGuards.test` 4 + `AppRoutes.test` 9 + `AuthRoot.test` 2 per la riga `checking`).

**Rischi residui / azioni operatore.** (1) La verifica **live** del guard (anonimo su deep link → Accesso senza 404; autenticato → radice protetta) contro l'app deployata è un'azione dell'operatore (prerequisito: le operator_actions di 1.6/1.7 completate + un account reale per il caso autenticato): `operator_actions`. (2) La e2e **automatica** dello stesso ciclo è differita a 1.10 (teardown via `delete-account`, `AD-13`; nessuna infrastruttura Playwright): `deferred`. (3) La navigazione reale di `<Navigate>` (in `useEffect`) e la glue `useEffect` di `AuthRoot` restano verificate solo nella parte sincrona/pura (decisione del guard, route-matching, resa `checking`), come la glue delle storie precedenti coperta dalla verifica live differita. (4) Il pre-esistente avviso di Vite sul chunk >500 kB (ora include react-router) resta un avviso, non un errore, fuori scope.

## Operator Confirmation

Confirmed 2026-09-24: the external actions this story owed were carried out.

- Esegui una verifica manuale una tantum del guard di rotta contro l'app deployata (preview o produzione): (1) da NON autenticato, apri direttamente un deep link a una rotta privata (la radice `/` e un percorso interno come `/dashboard` o `/impostazioni`) e conferma di essere reindirizzato alla schermata di Accesso senza 404 — il rewrite di vercel.json serve index.html e il guard lato client reindirizza (AC1 + deep link); (2) accedi con un account reale (prerequisito: operator_actions di 1.6/1.7 completate) e conferma che aprendo la radice del sito raggiungi la rotta protetta che risponde, con branding e bottone Disconnetti (AC3). La e2e automatica di questo ciclo è differita alla storia 1.10 (teardown via delete-account, AD-13): un agente non può crearla in sicurezza senza teardown e senza infrastruttura Playwright.

_Appended by the bmad-loop orchestrator (`bmad-loop confirm`, #335): a human confirmed these external actions out of band, and the story was advanced from `awaiting-operator` to `done`._
