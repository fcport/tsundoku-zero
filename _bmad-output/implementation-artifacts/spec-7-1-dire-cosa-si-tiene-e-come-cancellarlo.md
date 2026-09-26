---
title: 'Dire cosa si tiene e come cancellarlo'
type: 'feature'
created: '2026-09-26'
baseline_revision: '9d3d7eec4758ec030cc3eacac7eb14f94f6f1836'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      FOCUS_RING è duplicato come costante di modulo in più file (PrivacyScreen, AuthScreen, SettingsScreen, StatsScreen, SessionScreen) invece di un token di design condiviso ed esportato.
    evidence: |-
      La stessa stringa di classi dell'anello di focus è copiata in 4+ file; un singolo token esportato eviterebbe che gli anelli divergano. Pattern pre-esistente, non introdotto da questa storia ma esteso da essa.
    location: >-
      src/features/legal/PrivacyScreen.tsx e sibling
    severity: low
  - summary: >-
      Le schermate-rotta pubbliche standalone (/privacy, /statistiche, /login) rendono l'intestazione di testa come <h2> senza alcun <h1>, quindi da anonimo l'outline dei titoli parte dal livello 2.
    evidence: |-
      PrivacyScreen segue la convenzione delle schermate-rotta di StatsScreen (h2 di testa, nessun aria-labelledby sul <main>). Osservazione di accessibilità a livello app, coerente col tema accessibilità di Epic 7 (storia 7.6); non richiesta dagli AC di 7.1.
    location: >-
      src/features/legal/PrivacyScreen.tsx:36
    severity: low
---

<intent-contract>

## Intent

**Problem:** Uno sconosciuto che sta per consegnare la propria email non ha modo di leggere, prima di registrarsi, cosa il sistema memorizza e come cancellarlo: manca del tutto una pagina di privacy policy e un collegamento pubblico che la renda raggiungibile.

**Approach:** Introdurre una schermata-rotta pubblica `/privacy` (nuova feature `features/legal`) che dichiara — da i18n, con parità en/it — esattamente i dati memorizzati, quelli non raccolti e come cancellare l'account; raggiungibile da un collegamento sulla schermata di Accesso (prima della registrazione) e da uno nelle Impostazioni, cablati come callback al livello app (nessun react-router nelle features).

## Boundaries & Constraints

**Always:**
- La rotta `/privacy` è **ungated**: raggiungibile sia da anonimo (prima della registrazione) sia da autenticato. Vive fuori da entrambe le guardie in `AppRoutes`; il segmento statico `/privacy` ha precedenza sul catch-all `*`.
- Tutta la copy visibile passa da `t()` (AD-14/AD-1): nessuna stringa cablata nei componenti, chiavi aggiunte a **entrambi** i cataloghi `en`/`it` (parità ricorsiva verificata dal test i18n), nessun carattere CJK nei cataloghi.
- Le features (`legal`, `auth`, `settings`) NON importano `react-router` né conoscono stringhe di path (AD-1): la navigazione è una **callback** iniettata dal livello app, come `onExit`/`onViewStats` esistenti.
- La pagina dichiara i dati con precisione fattuale (è un impegno, non boilerplate): memorizza **solo** email, hash della password, lezioni sbloccate, stato di revisione, log delle risposte, preferenze — corrispondenti ad `auth` + `lesson_progress` + `review_state` + `review_log` + `user_settings`. Non raccoglie nome, data di nascita, né analitica sul singolo individuo.
- Tono del sistema (UX): ASCII nell'interfaccia, nessun `!`, nessuna emoji, nessun avverbio di lode; solo classi token del design system (nessun colore letterale — regola ESLint su `src/ui|features`); anello di focus visibile sugli interattivi.
- Invariante single-`<main>`: `PrivacyScreen` è una schermata-rotta col PROPRIO `<main>` (come `StatsScreen`); i collegamenti aggiunti dentro `AuthScreen`/`SettingsScreen` non introducono nuovi landmark.

**Block If:**
- Emergesse che il sistema memorizza o raccoglie un dato non elencato negli AC (oltre a email/hash/sblocchi/revisione/log/preferenze): la policy diventerebbe falsa. HALT con `blocked` e la discrepanza.

**Never:**
- NON aggiungere gestione consensi/cookie banner/tracciamento: la storia dichiara cosa NON si raccoglie, non introduce raccolta.
- NON toccare la logica di cancellazione account (feature `account`, 1.10) né l'Edge Function `delete-account`: qui si DESCRIVE come cancellare, non si cambia il meccanismo.
- NON introdurre una pagina di riconoscimenti, le licenze o il README (storie 7.2/7.3, fuori ambito).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Anonimo apre `/privacy` | `authenticated=false` | `PrivacyScreen` resa (dichiarazioni + ritorno); un solo `<main>` | Nessun errore |
| Autenticato apre `/privacy` | `authenticated=true` | `PrivacyScreen` resa; un solo `<main>` | Nessun errore |
| Collegamento su Accesso | `/login` anonimo | markup contiene `legal.privacy.linkLabel`; `/privacy` raggiungibile con `authenticated=false` | Nessun errore |
| Collegamento in Impostazioni | `SettingsScreen` resa | markup contiene `legal.privacy.linkLabel`; restano ESATTAMENTE 2 `role="group"` | Nessun errore |
| Ritorno dalla pagina | `onExit`, autenticato / anonimo | naviga a `ROOT_PATH` / `LOGIN_PATH` rispettivamente | Nessun errore |

</intent-contract>

## Code Map

- `src/app/routes.ts` -- fonte UNICA dei path; aggiungere `PRIVACY_PATH = '/privacy'` accanto a `LOGIN_PATH`/`ROOT_PATH`/`STUDY_PATH`/`STATS_PATH`.
- `src/app/AppRoutes.tsx` -- tabella rotte + guardie. Aggiungere `<Route path={PRIVACY_PATH}>` come figlio DIRETTO di `<Routes>` (fuori da `RedirectIfAuthenticated`/`RequireAuth`); passare `onViewPrivacy={() => navigate(PRIVACY_PATH)}` ad `AuthScreen`; `onExit` della pagina = `() => navigate(authenticated ? ROOT_PATH : LOGIN_PATH)` (`authenticated` è già una prop). Usa già `useNavigate`.
- `src/app/AppRoutes.test.tsx` -- harness `renderAt(path, authenticated)` con `MemoryRouter` + `renderToStaticMarkup`; aggiungere righe della Matrix (`/privacy` anonimo+autenticato; link su `/login`).
- `src/features/auth/AuthScreen.tsx` -- container `<main>` con `AuthForm`. Aggiungere prop `onViewPrivacy: () => void` e un collegamento (button-affordance, `legal.privacy.linkLabel`) dentro il `<main>`, dopo il form.
- `src/features/settings/SettingsScreen.tsx` -- `<section aria-labelledby>` con due `role="group"`. Aggiungere prop `onViewPrivacy: () => void` e il collegamento alla privacy (fuori dai due group, così il conteggio resta 2).
- `src/features/settings/SettingsScreen.test.tsx` -- passa `SettingsScreen` senza `onViewPrivacy`: aggiornare l'harness `render()` con un NOOP e asserire il link; il test "2 role=group" deve restare verde.
- `src/app/AuthenticatedShell.tsx` -- compone `SettingsScreen`; aggiungere `import PRIVACY_PATH` e passare `onViewPrivacy={() => navigate(PRIVACY_PATH)}` (usa già `useNavigate`).
- `src/i18n/en.ts` / `src/i18n/it.ts` -- cataloghi tipizzati; aggiungere il ramo `legal.privacy.*` a ENTRAMBI (parità).
- `src/features/stats/StatsScreen.tsx` -- MODELLO di riferimento (schermata-rotta col proprio `<main>`, `onExit`, token `FOCUS_RING`); non modificare.

## Tasks & Acceptance

**Execution:**
- `src/i18n/en.ts` -- aggiungere ramo `legal: { privacy: { title, linkLabel, stored, notCollected, deletion, back } }`. `stored` nomina email, hash password, lezioni sbloccate, stato di revisione, log delle risposte, preferenze; `notCollected` nomina nome, data di nascita, analitica sul singolo; `deletion` spiega la cancellazione da Impostazioni → Cancella account e dichiara che distrugge anche il log delle risposte. -- fonte delle chiavi tipizzate, dichiarazioni fattuali.
- `src/i18n/it.ts` -- aggiungere lo STESSO ramo `legal.privacy.*` con la traduzione italiana. -- parità ricorsiva en/it (verificata dal test i18n).
- `src/app/routes.ts` -- aggiungere ed esportare `PRIVACY_PATH = '/privacy'` con commento. -- nessuna stringa di path nelle features.
- `src/features/legal/PrivacyScreen.tsx` -- NUOVA schermata presentazionale: `<main>` unico, copy da `t('legal.privacy.*')`, prop `onExit: () => void` per il ritorno (affordance secondaria con `FOCUS_RING`); nessuna porta, nessuno stato. -- realizza la pagina di privacy policy.
- `src/features/legal/PrivacyScreen.test.tsx` -- NUOVO test (`renderToStaticMarkup`, node): il markup contiene `en.legal.privacy.stored/notCollected/deletion`; un solo `<main>`; dopo `changeLanguage('it')` rende i valori `it`; il testo `stored`/`notCollected`/`deletion` nomina ciascun elemento richiesto (email, password, sbloccate/unlocked, revisione/review, log/answer, preferenze/preferences; nome/name, data di nascita/date of birth, analitica/analytics). -- ancora gli AC di contenuto alla superficie letta.
- `src/features/auth/AuthScreen.tsx` -- prop `onViewPrivacy`, collegamento con `legal.privacy.linkLabel` dentro il `<main>` dopo `AuthForm`. -- collegamento sulla schermata di Accesso.
- `src/features/settings/SettingsScreen.tsx` -- prop `onViewPrivacy`, collegamento con `legal.privacy.linkLabel` nella `<section>`, fuori dai due `role="group"`. -- collegamento in Impostazioni.
- `src/features/settings/SettingsScreen.test.tsx` -- aggiornare `render()` per passare `onViewPrivacy` (NOOP); asserire che il markup contiene `en.legal.privacy.linkLabel`; verificare che i `role="group"` restino 2. -- protegge l'invariante dei gruppi.
- `src/app/AuthenticatedShell.tsx` -- import `PRIVACY_PATH`, passare `onViewPrivacy={() => navigate(PRIVACY_PATH)}` a `SettingsScreen`. -- cablaggio navigazione al livello app.
- `src/app/AppRoutes.tsx` -- rotta ungated `/privacy` + wiring `onViewPrivacy` per `AuthScreen` + `onExit` della pagina. -- rende `/privacy` raggiungibile in entrambi gli stati.
- `src/app/AppRoutes.test.tsx` -- aggiungere: `/privacy` con `authenticated=false` e con `true` rende `PrivacyScreen` (single `<main>`); `/login` anonimo contiene `en.legal.privacy.linkLabel`. -- verifica route-matching e raggiungibilità pre-registrazione.

**Acceptance Criteria:**
- Given la pagina `/privacy` resa, when letta, then dichiara che vengono memorizzati soltanto email, hash della password, lezioni sbloccate, stato di revisione, log delle risposte e preferenze, and dichiara che non si raccolgono nome, data di nascita né analitica sul singolo individuo.
- Given la pagina `/privacy` resa, when letta, then spiega come cancellare l'account (da Impostazioni, tramite Cancella account) and dichiara che la cancellazione distrugge anche il log delle risposte.
- Given la schermata di Accesso con `authenticated=false`, when resa, then contiene un collegamento alla privacy policy, and la rotta `/privacy` è resa (non rediretta) con `authenticated=false` — raggiungibile prima della registrazione.
- Given la schermata Impostazioni, when resa, then contiene un collegamento alla privacy policy, and continua a esporre esattamente due `role="group"`.
- Given i cataloghi `en`/`it`, when confrontati, then hanno lo stesso insieme di chiavi (parità ricorsiva) and nessun valore contiene caratteri CJK.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 2: (high 0, medium 0, low 2)
- reject: 18: (high 0, medium 0, low 18)
- addressed_findings:
  - `[medium]` `[patch]` Ortografia italiana nei valori `it.legal.privacy` (copy legale utente-facing): ripristinati gli accenti/elisioni richiesti — `cio`→`ciò`, `Nient altro`→`Nient'altro` in `stored`; `ne`→`né` in `notCollected` (anche correzione di significato: congiunzione «né»); `puo`→`può` in `deletion`. Coerente col resto di `it.ts`.
  - `[low]` `[patch]` Rafforzati gli AC1 in `PrivacyScreen.test.tsx`: aggiunte asserzioni di esclusività («only»/«nothing else»/«soltanto») e di negazione («does not»/«non raccoglie»), così un'inversione della dichiarazione non passerebbe più. Adeguato il confronto full-string sullo switch `it` all'apostrofo HTML-escaped di `Nient'altro` (idioma `AuthForm.test`).

## Design Notes

Navigazione come callback (non link react-router) per rispettare AD-1: le features non importano `react-router` né conoscono i path. `AuthScreen`/`SettingsScreen` rendono un `<button>`-affordance (idioma del repo: `onExit`/`onViewStats` sono già button), il livello app inietta `() => navigate(PRIVACY_PATH)`. La rotta `/privacy` è l'UNICA rotta pubblica in entrambi gli stati: va dichiarata come figlio diretto di `<Routes>`, non annidata sotto una guardia, così il match statico batte il catch-all `*`.

`onExit` deterministico dal livello app (niente `navigate(-1)`, che su deep-link diretto sarebbe un vicolo cieco): `authenticated ? ROOT_PATH : LOGIN_PATH`.

Esempio di collegamento (idioma StatsScreen, token + focus ring):

```tsx
<button
  type="button"
  onClick={onViewPrivacy}
  className={`self-center rounded-md border border-border-strong bg-surface-base text-ink-primary px-6 py-3 text-body ${FOCUS_RING}`}
>
  {t('legal.privacy.linkLabel')}
</button>
```

## Verification

**Commands:**
- `npm run lint` -- expected: 0 errori (boundaries: `legal`→`i18n` ok; nessun `react-router` in features; nessun colore letterale).
- `npm run typecheck` -- expected: 0 errori (chiavi `legal.privacy.*` tipizzate; nuove prop richieste onorate da tutti i call-site e dai test).
- `npm test` -- expected: verde, inclusi il test di parità i18n (`i18n.test.tsx`), `PrivacyScreen.test.tsx`, `AppRoutes.test.tsx` e `SettingsScreen.test.tsx` aggiornati.

## Auto Run Result

Status: done

### Sintesi della modifica implementata

Aggiunta la pagina pubblica di privacy policy `/privacy` (nuova feature `features/legal`) che dichiara — da i18n, con parità en/it — i soli dati memorizzati (email, hash della password, lezioni sbloccate, stato di revisione, log delle risposte, preferenze), cosa NON viene raccolto (nome, data di nascita, analitica sul singolo individuo) e come cancellare l'account (da Impostazioni → Cancella account, con distruzione anche del log delle risposte). La pagina è raggiungibile da un collegamento sulla schermata di Accesso (prima della registrazione) e da uno nelle Impostazioni; la rotta è ungated (vive fuori da entrambe le guardie, il match statico batte il catch-all) e la navigazione è cablata come callback dal livello app (nessun `react-router` nelle features, AD-1).

### File modificati/creati

- `src/features/legal/PrivacyScreen.tsx` (nuovo) -- schermata-rotta presentazionale col proprio `<main>`, copy da `t('legal.privacy.*')`, `onExit` per il ritorno; nessuna porta/stato.
- `src/features/legal/PrivacyScreen.test.tsx` (nuovo) -- AC di contenuto (stored/notCollected/deletion + esclusività/negazione), single `<main>`, affordance di ritorno, switch en→it.
- `src/i18n/en.ts` / `src/i18n/it.ts` -- ramo `legal.privacy.{title,linkLabel,stored,notCollected,deletion,back}` in entrambi (parità); italiano con ortografia corretta.
- `src/app/routes.ts` -- costante `PRIVACY_PATH = '/privacy'`.
- `src/app/AppRoutes.tsx` -- rotta ungated `/privacy` + `onExit` deterministico + `onViewPrivacy` per `AuthScreen`.
- `src/app/AppRoutes.test.tsx` -- rotte `/privacy` (anonimo/autenticato) rendono la pagina; `/login` anonimo contiene il collegamento.
- `src/features/auth/AuthScreen.tsx` -- prop `onViewPrivacy` + collegamento dentro il `<main>`.
- `src/features/settings/SettingsScreen.tsx` -- prop `onViewPrivacy` + collegamento fuori dai due `role="group"`.
- `src/features/settings/SettingsScreen.test.tsx` -- passa `onViewPrivacy`, asserisce il collegamento, mantiene 2 `role="group"`.
- `src/app/AuthenticatedShell.tsx` -- cabla `onViewPrivacy={() => navigate(PRIVACY_PATH)}` a `SettingsScreen`.
- `_bmad-output/implementation-artifacts/epic-7-context.md` (nuovo) -- contesto compilato di Epic 7.

### Esito della review

- Patch applicate: 2 — (1) ortografia italiana della copy legale (medium); (2) rafforzamento delle asserzioni AC1 su esclusività/negazione (low).
- Deferiti: 2 (low) — duplicazione di `FOCUS_RING` come token condiviso; outline dei titoli senza `<h1>` sulle rotte pubbliche standalone (accessibilità, tema Epic 7 / 7.6).
- Rigettati: 18 — per lo più oltre l'enumerazione esplicita dell'intent (sezioni GDPR, processori, retention, cookie, contatto/data), by-design del repo (link come `<button>` per AD-1, `<h2>` di testa, `aria-labelledby` come StatsScreen), glue di navigazione differita alla verifica live per convenzione documentata, ed edge non generati dall'app (sub-path/casing, closure su session-expiry).

### Raccomandazione di review di follow-up

`false`. Nessuna patch `high`; punteggio `3×medium(1) + 1×low(1) = 4` (< 5). Patch per severità: high 0, medium 1, low 1.

### Verifica eseguita

- `npm run typecheck` -- 0 errori.
- `npm run lint` -- 0 errori.
- `npm test` -- 97 file, 1174 test passati (inclusi parità i18n, `PrivacyScreen.test.tsx`, `AppRoutes.test.tsx`, `SettingsScreen.test.tsx`). Rieseguita anche dopo le patch: verde.
- Matrix Test Audit: ogni riga della I/O Matrix coperta da un test eseguito e verde; la navigazione `onExit`/`onViewPrivacy` è glue differita alla verifica live per convenzione del repo (l'affordance è testata come presente).

### Rischi residui

- Le affermazioni di navigazione (collegamento→`/privacy`, `onExit`→ROOT/LOGIN) sono glue non eseguita da `renderToStaticMarkup` in ambiente node: verificate come presenza dell'affordance + struttura delle rotte, non come click end-to-end (convenzione documentata del repo; la copertura reale arriva dai test live/e2e, previsti in Epic 7 storia 7.4).
- L'esclusività dell'elenco «solo questi dati» è un impegno dichiarato in copy e ora asserito nei test come parola-chiave, ma la corrispondenza con lo schema reale del database non è audit-ata qui (il Block-If non è scattato: l'enumerazione è quella imposta dall'intent).
