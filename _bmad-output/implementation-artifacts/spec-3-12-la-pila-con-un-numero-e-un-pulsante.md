---
title: 'Story 3.12: La pila, con un numero e un pulsante'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'db9b99c466f9066ddef13b7ef1fdd485472d8bb2'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      La dashboard non ha uno stato d'errore: se una lettura del read-model
      (listDue/listReviewLog/listUnlockedLessonIds/listLessons) fallisce, la
      query resta senza `data` e la dashboard mostra lo scheletro all'infinito,
      senza messaggio d'errore né riprova.
    evidence: |-
      `DashboardScreen` decide lo scheletro solo su `data === undefined` e non
      legge mai `isError`/`error`; con `retry: false` un `DataError` da porta
      non ripiega. L'intento di 3.12 (AC1-4: dashboard popolata + caricamento +
      microcopy) non copre il percorso d'errore, e l'epica sequenzia gli stati
      non-felici della dashboard a 3.15/3.16 — quindi è un vuoto reale ma non
      di questa storia. Va affrontato in modo trasversale (con gli stati vuoti
      o una storia dedicata allo stato d'errore del read-model).
    location: >-
      src/features/dashboard/DashboardScreen.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Il dominio ha tutte le autorità del read-model (pila `isDue`+`dueQueryKey`, streak `streak()`, curriculum) e i dati esistono dietro le porte (3.7-3.10), ma NESSUNA schermata li rende: l'utente autenticato atterra sul placeholder di branding `App`. Manca la dashboard, e mancano i canali per accenderla: `@tanstack/react-query` non è installato (pur essendo il read-model mandato da AD-5), non c'è modo di ottenere l'`userId` per la chiave `['due', userId]`, non c'è una lettura di `review_log` per lo streak, né un fuso per il confine di giornata.

**Approach:** Accendere il read-model al SUO primo consumatore (la dashboard): introdurre TanStack Query e montare `QueryClient`+`PortsProvider` alla composition root; esporre l'`userId` estendendo `AuthGateway` con `currentUserId()`; aggiungere `listReviewLog()` a `ReviewRepository` e `timeZone()` a `Clock`. La dashboard (una feature nuova) legge dovuti/streak/curriculum via porte iniettate, con le chiavi TanStack, e rende il conteggio grande con l'azione unica; uno scheletro alla stessa altezza copre il caricamento. Rende la dashboard POPOLATA (dovuti esistenti); gli stati vuoti/primo-avvio e lo sblocco arrivano nelle storie successive.

## Boundaries & Constraints

**Always:**
- **Read-model via TanStack Query (AD-5).** Introdurre `@tanstack/react-query` come dipendenza runtime e montare UN `QueryClient` con `defaultOptions.queries.retry: false` (test deterministici, nessun refetch fantasma). La pila dei dovuti usa la chiave di DOMINIO `dueQueryKey(userId)` (`src/domain/due.ts:44`) VERBATIM: nessuna schermata ricalcola la pila, nessuna chiave divergente.
- **`userId` dalla porta di auth.** Estendere `AuthGateway` con `currentUserId(): Promise<string | null>` (mirror di `isAuthenticated`: `getSession()` → `data.session?.user.id ?? null`, confine TOTALE → `null` su throw/assenza). Il dominio non vede MAI la `Session`. L'app risolve l'`userId` e lo consegna alla dashboard come prop.
- **Streak calcolato da `review_log` a ogni lettura (AD-18).** Aggiungere `listReviewLog(): Promise<readonly ReviewLogEntry[]>` a `ReviewRepository` (legge `reviewed_at` da `review_log`, RLS isola l'utente, `DataError('listReviewLog')` su errore/riga malformata/timestamp invalido). Calcolarlo con l'autorità di dominio `streak(log, clock.now(), clock.timeZone())`. Il fuso ENTRA dal Clock: aggiungere `timeZone(): string` alla porta `Clock` (impl in `src/data/` via `Intl…resolvedOptions().timeZone`, vietato nel dominio).
- **Conteggio come corpo più grande.** Il conteggio dei dovuti è reso nel ruolo tipografico `text-count-hero` (`src/ui/theme.css:99`, il più grande dell'app), con l'ETICHETTA resa SOTTO il numero.
- **Una sola azione primaria.** Esattamente un `button-primary` (verbale e concreto, mai "Continua"), senza doppioni né varianti disabilitate.
- **Scheletro senza salti.** Finché `userId` non è risolto o una query è `pending`, rendere uno scheletro alla STESSA altezza del contenuto finale (stessa classe di altezza/min-height sul contenitore), senza spinner e senza salto di layout.
- **Microcopy (AC4/UX).** Il conteggio PRECEDE il verbo ("23 da rivedere", mai "hai 23 esercizi"); nessun `!`, emoji o avverbio di lode; nessuna grammatica della celebrazione (niente verde per il giusto). Le nuove chiavi vivono in ENTRAMBI i cataloghi `en`/`it` (parità ricorsiva imposta da `i18n.test.tsx`).
- **Confini AD-1.** `src/features/dashboard/` importa `domain` (porte, `streak`, `dueQueryKey`), `ui`, `i18n` e `@tanstack/react-query`, MAI `data`; le porte arrivano da `usePorts()` (contesto), l'`userId` da prop. `@tanstack/react-query` NON entra in `domain`/`ui`. Solo token del sistema di design (regola colore ERROR su `ui`/`features`).

**Block If:**
- _Nessun blocco._ Ogni decisione (TanStack come read-model, chiave `['due', userId]`, streak da `review_log`, fuso e orologio dal `Clock`, fuso = quello locale del browser) è già fissata dall'epica (AD-5/AD-18) e dai helper predisposti (`dueQueryKey`, `PortsContext` «cablato al primo consumatore 3.12»); nessuna richiede input umano.

**Never:**
- NON introdurre le superfici delle storie successive: sessione di esercizi e cablaggio dell'azione all'avvio sessione (3.18+), sblocco della lezione (3.13), gli stati DISTINTI di primo-avvio / pila-svuotata-con-lezioni / curriculum-esaurito (3.15/3.16). Questa storia rende la dashboard POPOLATA (dovuti esistenti) + lo scheletro; l'azione primaria è PRESENTE con la sua copy ma il suo `onClick`/rotta è 3.18.
- NON memorizzare lo streak né la pila (AD-18/AD-5): sempre derivati; NON reimplementare `isDue`/`streak` fuori dal dominio.
- NON usare `Date.now()`/`new Date()` senza argomenti/`Intl…resolvedOptions()` sotto `src/domain/`: il fuso e l'orologio entrano dal `Clock`.
- NON estrarre ancora i primitivi `ui` come file a sé (pile-counter, streak-badge, curriculum-progress, button-primary): comporli inline nella dashboard con i token; l'estrazione nasce col SECONDO consumatore (sessione/stati vuoti), coerente con l'ethos «niente prima della storia che lo usa».
- NON usare colori letterali; nessun emoji, nessun punto esclamativo, nessuna animazione celebrativa.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| dashboard popolata | cache seminata: `dueQueryKey(uid)`=N stati, `['streak',uid]` log, `['unlocked',uid]`=u id, `['lessons']`=t lezioni; `userId=uid` | rende N nel ruolo `text-count-hero` con etichetta SOTTO; streak; "u di t lezioni"; UN `button-primary` | nessun errore |
| caricamento | cache vuota (o `userId` null) | scheletro alla stessa altezza del contenuto finale, nessuno spinner, nessun salto | nessun errore |
| microcopy | dashboard resa | il conteggio precede l'etichetta; nessun `!`, nessuna emoji/CJK, nessun "hai N" | nessun errore |
| azione unica | dashboard resa | il markup contiene ESATTAMENTE un `button-primary` (una sola azione primaria) | nessun errore |
| `currentUserId` presente | sessione con `user.id` | ritorna l'`id` (stringa) | — |
| `currentUserId` assente | nessuna sessione o SDK lancia | ritorna `null` (confine totale) | non rifiuta |
| `listReviewLog` valido | righe `{reviewed_at: ISO}` | `readonly ReviewLogEntry[]` con `reviewedAt: Date` | — |
| `listReviewLog` errore | errore Supabase o riga/timestamp malformato | LANCIA `DataError('listReviewLog')` | reject, non degrada |
| `clock.timeZone` | ambiente reale | ritorna una stringa IANA non vuota (es. `Europe/Rome`) | — |

</intent-contract>

## Code Map

- `src/domain/due.ts:26,44` -- `isDue(state, now)` (autorità della dovutezza) e `dueQueryKey(userId): ['due', userId]` (l'UNICA chiave della pila, da usare verbatim; commenti nominano «3.12+» come consumatore).
- `src/domain/schedule.ts:40-47` -- forma `ReviewState` (`dueAt` ecc.), ritornata da `listDue`.
- `src/domain/streak.ts:28-30,75` -- `ReviewLogEntry { reviewedAt: Date }` e `streak(log, now, timeZone): number` (autorità dello streak; da importare in features).
- `src/domain/ports/reviewRepository.ts:15-24` -- `ReviewRepository`, oggi solo `listDue(now)`; **aggiungere** `listReviewLog()` (import `ReviewLogEntry` da `../streak`).
- `src/domain/ports/progressRepository.ts:18-25` -- `listUnlockedLessonIds(): Promise<readonly string[]>` (conteggio sbloccate = `.length`).
- `src/domain/ports/contentRepository.ts:34-41` -- `listLessons(): Promise<readonly LessonSummary[]>` (totale = `.length`).
- `src/domain/ports/clock.ts:19-22` -- `Clock.now()`; **aggiungere** `timeZone(): string`.
- `src/domain/ports/authGateway.ts:67-81` -- `AuthGateway` (solo booleani; il commento `:63-65` prevede l'`userId` «quando lo useranno»); **aggiungere** `currentUserId()`.
- `src/data/reviewRepository.ts:98-118` -- `createSupabaseReviewRepository`; `listDue` mostra il pattern (select→map→`DataError`); **specchiare** in `listReviewLog` su tabella `review_log`, colonna `reviewed_at`, SENZA filtro `isDue`.
- `src/data/authGateway.ts:168-176` -- `isAuthenticated` via `getSession()`; **specchiare** in `currentUserId` (`data.session?.user.id ?? null`, confine totale).
- `src/data/clock.ts:13-14` -- `systemClock.now`; **aggiungere** `timeZone` via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- `src/data/progressRepository.ts`, `src/data/contentRepository.ts` -- letture già pronte, riusare tal quali.
- `src/features/ports/PortsContext.tsx:28-33,59` -- `Ports { clock, content, review, progress }` e `usePorts()` (lancia fuori dal provider); membri invariati (i tipi `review`/`clock` acquistano i nuovi metodi). Il commento `:12-15` fissa il cablaggio del provider a 3.12.
- `src/app/main.tsx:41-55` -- composition root: oggi crea client/gateway/settings/account; **aggiungere** review/progress/content repos + `systemClock`, costruire `ports`, creare `QueryClient`, avvolgere in `<QueryClientProvider>`, passare `ports`+`gateway` ad `AuthRoot`.
- `src/app/AuthRoot.tsx:30-146` -- macchina a stati auth; **aggiungere** stato `userId` (risolto via `gateway.currentUserId()` alla transizione→autenticato, `null` su anonimo), avvolgere `<AppRoutes>` in `<PortsProvider value={ports}>`, passare `userId`.
- `src/app/AppRoutes.tsx:35-71` -- tabella rotte; **inoltrare** `userId` (e `ports` se serve) ad `AuthenticatedShell` (il catch-all protetto).
- `src/app/AuthenticatedShell.tsx:34-63` -- oggi rende `<App/>` (branding placeholder) + Settings + DeleteAccount; **sostituire** `<App/>` con `<DashboardScreen userId={userId}/>` (unico `<main>`), lasciando le due `<section>` sotto.
- `src/features/settings/SettingsScreen.tsx` + `.test.tsx:1-75` -- precedente di schermata di feature: `<section>`, `t()`, `renderToStaticMarkup` in env `node`, parità en/it; da imitare.
- `src/i18n/en.ts:11-52`, `src/i18n/it.ts:5-46` -- cataloghi `as const`; **aggiungere** la sezione `dashboard` in ENTRAMBI (stessa forma). `src/i18n/i18n.test.tsx` impone parità ricorsiva e vieta CJK.
- `src/ui/theme.css:99-107` -- `text-count-hero` (72px / 56px mobile), il ruolo più grande; token superfici/spaziatura via classi Tailwind. `eslint.config.js:141-169` regola colore (ERROR su `ui`/`features`); `:81-88` archi di layer; `vitest.config.ts:7` env `node`.

## Tasks & Acceptance

**Execution:**
- `package.json` -- aggiungere `@tanstack/react-query` alle `dependencies` (installazione: aggiorna anche il lockfile).
- `src/domain/ports/authGateway.ts` -- aggiungere `currentUserId(): Promise<string | null>` all'interfaccia, con docblock (il dominio non vede la `Session`; confine totale).
- `src/data/authGateway.ts` -- implementare `currentUserId` (`getSession()` → `data.session?.user.id ?? null`; `try/catch` → `null`).
- `src/data/authGateway.test.ts` -- estendere: sessione con `user.id` ⇒ id; nessuna sessione / SDK che lancia ⇒ `null`.
- `src/domain/ports/reviewRepository.ts` -- aggiungere `listReviewLog(): Promise<readonly ReviewLogEntry[]>` (import type `ReviewLogEntry` da `../streak`), docblock: canale unico dello streak, `now` non serve.
- `src/data/reviewRepository.ts` -- implementare `listReviewLog` (costanti `REVIEW_LOG_TABLE='review_log'`, colonna `reviewed_at`; map riga→`{ reviewedAt: Date }`; `DataError('listReviewLog')` su errore Supabase, riga non-oggetto, `reviewed_at` non stringa o timestamp `NaN`).
- `src/data/reviewRepository.test.ts` -- estendere: righe valide ⇒ entries con `Date`; errore Supabase ⇒ `DataError`; riga/timestamp malformato ⇒ `DataError`.
- `src/domain/ports/clock.ts` -- aggiungere `timeZone(): string` con docblock (fuso IANA per il confine di giornata dello streak; iniettato, mai letto dal dominio).
- `src/data/clock.ts` -- implementare `timeZone` via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- `src/data/clock.test.ts` -- estendere: `timeZone()` ritorna una stringa non vuota.
- `src/features/dashboard/DashboardScreen.tsx` -- **creare**. `export interface DashboardScreenProps { readonly userId: string | null }`. Rende un `<main>`. `usePorts()`; quattro `useQuery`: `dueQueryKey(userId!)`, `['streak', userId]`, `['unlocked', userId]`, `['lessons']`, tutte con `enabled: !!userId` (tranne `['lessons']` che può restare abilitata). QueryFn: `review.listDue(clock.now())`, `review.listReviewLog()`, `progress.listUnlockedLessonIds()`, `content.listLessons()`. Derivare: conteggio = `due.length`; streak = `streak(log, clock.now(), clock.timeZone())`; progresso = `unlocked.length`/`lessons.length`. Se `!userId` o una query è `pending` ⇒ scheletro (contenitore con la STESSA classe di altezza del contenuto). Altrimenti rende: conteggio in `text-count-hero` con etichetta SOTTO (`da rivedere`/`t('dashboard.dueLabel')`), streak, "u di t lezioni", e UN `button-primary` (`t('dashboard.primaryAction')`). Solo classi token; nessun import da `data`.
- `src/features/dashboard/DashboardScreen.test.tsx` -- **creare**. Env `node`, `renderToStaticMarkup`. Helper `render(el)` che avvolge in `<QueryClientProvider client={qc}>` + `<PortsProvider value={inMemoryPorts}>`; per lo stato caricato seminare `qc.setQueryData(...)` sulle quattro chiavi prima del render. Coprire le righe della I/O Matrix + gli AC (conteggio in `text-count-hero`, etichetta sotto, un solo button-primary, scheletro stessa altezza, microcopy senza `!`/emoji/"hai").
- `src/app/main.tsx` -- istanziare `createSupabaseReviewRepository`/`createSupabaseProgressRepository`/`createSupabaseContentRepository` + `systemClock`; costruire `ports`; creare `QueryClient` (`retry:false`); avvolgere l'albero in `<QueryClientProvider>`; passare `ports`+`gateway` (+ esistenti) ad `AuthRoot`.
- `src/app/AuthRoot.tsx` -- aggiungere prop `ports`; stato `userId: string | null` (`null` iniziale); risolverlo con `gateway.currentUserId()` alla PRIMA transizione→autenticato (boot e subscription, `active`-guarded), riportarlo a `null` su anonimo; avvolgere `<AppRoutes>` in `<PortsProvider value={ports}>` e passargli `userId`.
- `src/app/AppRoutes.tsx` -- accettare `userId` (e ciò che serve) e inoltrarlo ad `AuthenticatedShell`.
- `src/app/AuthenticatedShell.tsx` -- ricevere `userId`; sostituire `<App/>` con `<DashboardScreen userId={userId}/>` (rimuovere l'import `App` se resta l'unico consumatore); mantenere le `<section>` Settings/DeleteAccount.
- `src/app/AuthRoot.test.tsx`, `src/app/AppRoutes.test.tsx`, `src/app/AuthenticatedShell.test.tsx` -- aggiornare (additivo) per i nuovi prop/porte/provider; conservare gli invarianti esistenti (placeholder `checking`, single-main).
- `src/i18n/en.ts` + `src/i18n/it.ts` -- aggiungere la sezione `dashboard` (`dueLabel`, `streakLabel`, `curriculumLabel`, `primaryAction`) in ENTRAMBI, con microcopy conteggio-prima-del-verbo, senza `!`/emoji.

**Acceptance Criteria:**
- **AC1 — Conteggio grande, etichetta sotto.** *Given* dovuti esistenti (N), *when* la dashboard è resa, *then* N compare nel ruolo `text-count-hero` (il più grande dell'app) e l'etichetta è resa SOTTO il numero.
- **AC2 — Streak, curriculum, azione unica.** *Given* dati presenti, *when* la dashboard è resa, *then* mostra lo streak (da `streak()` su `review_log`), "u di t lezioni" (sbloccate su totale) ed ESATTAMENTE una azione primaria (`button-primary`).
- **AC3 — Scheletro senza salti.** *Given* `userId` non risolto o una query `pending`, *when* la dashboard è resa, *then* compare uno scheletro alla stessa altezza del contenuto finale, senza spinner e senza salto di layout.
- **AC4 — Microcopy.** *Given* le stringhe visibili, *then* il conteggio precede il verbo ("23 da rivedere", mai "hai 23 esercizi") e non compaiono `!`, emoji o avverbi di lode.
- **AC5 — Chiave unica della pila.** *Given* la lettura dei dovuti, *then* usa `dueQueryKey(userId)` verbatim (nessun ricalcolo della pila, nessuna chiave divergente).
- **AC6 — Read-model puro.** *Given* il read-model, *when* è letto, *then* streak e pila non sono memorizzati (derivati a ogni lettura); `isDue`/`streak` restano l'autorità di dominio e orologio/fuso entrano dal `Clock`.
- **AC7 — Confini.** *Given* il modulo `features/dashboard`, *when* è compilato e verificato, *then* non importa `data` (porte via `usePorts`, `userId` via prop), non usa colori letterali, e `npm run lint`/boundaries restano verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 1: (high 0, medium 1, low 0)
- reject: 18: (high 0, medium 0, low 18)
- addressed_findings:
  - `[low]` `[patch]` `currentUserId` usava `data.session?.user.id` (accesso duro su `user`) con un commento che attribuiva erroneamente al `?? null` la copertura di `user` assente. Indurita la catena in `data.session?.user?.id ?? null` (sessione/`user`/`id` assenti ⇒ `null` senza throw) e corretto il commento (il throw dell'SDK resta coperto dal `catch`).
- deferred (1): stato d'errore assente sulla dashboard (fallimento di una lettura del read-model ⇒ scheletro infinito, nessun messaggio/riprova). Reale ma non richiesto dall'intento di 3.12; da affrontare con gli stati non-felici (3.15/3.16) o una storia dedicata.
- reject notevoli (verificati contro il codice reale):
  - **Intent-alignment (superficie di verifica).** Gli AC vivono sulla resa VISIVA (ruolo più grande, etichetta sotto, stessa altezza, nessun salto); i test la verificano sulla superficie markup/classi sotto `renderToStaticMarkup` (env `node`, niente CSS). Dove la classe è un proxy fedele (ordine conteggio→etichetta, un solo `<button>`, niente emoji, copy presente) le due superfici coincidono. «Ruolo più grande» e «stessa altezza/nessun salto» restano non provati dal CSS — ma `text-count-hero` (72px) È il ruolo più grande, e in pratica ENTRAMBI i rami (scheletro ~316px, contenuto ~324px) sono sotto `min-h-[24rem]` (384px) e ancorano al minimo ⇒ nessun salto reale. La verifica visiva è deferita alla e2e live, come da convenzione del repo.
  - **Responsive/mobile (`text-count-hero-mobile` non applicato).** Fuori scope per autorità dell'epica: il responsive a tre breakpoint è la storia 3.23.
  - **Azione primaria inerte (nessun `onClick`).** Fuori scope: l'avvio sessione (destinazione del pulsante) è 3.18; l'AC richiede solo che l'azione sia PRESENTE. Un pulsante `disabled` confonderebbe l'invariante «una sola azione primaria».
  - **Glue di `AuthRoot` (risoluzione/azzeramento di `userId`) non testata a unità.** Coerente con la convenzione del repo (env `node`/`renderToStaticMarkup` non esegue effetti; la glue d'effetto — come `rehydrateLocale` già presente — è verificata dalla e2e live differita); nessun harness jsdom esiste. Il metodo `currentUserId` è comunque coperto a unità.
  - **Input impossibili dalla sorgente reale.** `curriculumLabel` con `total===0` o `unlocked>total` ("3 of 0 lessons") non è producibile: il curriculum committato è non vuoto e le sbloccate sono un sottoinsieme delle lezioni esistenti; lo scheletro copre fino a dati presenti.
  - **Chiavi di cache non-pila inline / `dueQueryKey('')` / nome `['streak']`.** La chiave della PILA (l'unica su cui l'AD insiste) è la factory di dominio `dueQueryKey` verbatim; le altre sono chiavi feature semplici. `['due','']` è inerte (`enabled:false` + early-return su `!userId`). Preferenze di naming/DRY senza conseguenza.
  - **Copy `{{days}} giorni di fila` a `days===1`.** Trade-off documentato in Design Notes: la pluralizzazione i18next romperebbe la parità ricorsiva en/it, e spostare il numero violerebbe il conteggio-prima-del-verbo (AC4). Basso e raro.
  - **Robustezza dei test (`!` sull'intero markup, «no spinner» per sottostringa, CJK ≥U+2000, uso del Clock vs `new Date()`, fixture duplicate).** Guardie ragionevoli e attualmente verdi; il codice di produzione usa correttamente `clock.now()`/`clock.timeZone()`. Preferenze di test.
  - **`App` non più reso in produzione.** Il branding placeholder era esplicitamente destinato a essere sostituito dalla dashboard (Epic 3); `App` resta un componente referenziato da un test, non codice morto, e l'epica non richiede branding sulla dashboard.

## Design Notes

**Perché TanStack Query ORA (3.12).** `due.ts:5-6` e `PortsContext.tsx:12-15` nominano esplicitamente 3.12 come il PRIMO consumatore che accende il read-model; `dueQueryKey` esiste già in dominio, pronto per essere usato «da livelli esterni (TanStack in data/features) senza che il dominio conosca TanStack». Rimandare significherebbe leggere la pila con una `useEffect` ad-hoc (non testabile in questo harness) e riscriverla in 3.13 — churn che il repo evita. Testabilità: con `renderToStaticMarkup` (env `node`, nessun jsdom) una cache SEMINATA (`setQueryData`) fa risolvere `useQuery` in modo SINCRONO al primo render (stato caricato); una cache vuota resta `pending` (scheletro). Entrambi gli stati sono resi staticamente, senza effetti né timer.

**Golden example (dashboard + scheletro):**
```tsx
const { clock, review, progress, content } = usePorts();
const dueQ = useQuery({ queryKey: dueQueryKey(userId ?? ''), enabled: !!userId,
  queryFn: () => review.listDue(clock.now()) });
const logQ = useQuery({ queryKey: ['streak', userId], enabled: !!userId,
  queryFn: () => review.listReviewLog() });
// ...unlockedQ, lessonsQ...
if (!userId || dueQ.isPending || logQ.isPending /* ...*/)
  return <main className="min-h-[...]" aria-busy="true">{/* scheletro stessa altezza */}</main>;
const count = dueQ.data.length;
const days = streak(logQ.data, clock.now(), clock.timeZone());
return (
  <main className="min-h-[...]">
    <p className="text-count-hero">{count}</p>
    <p className="text-label">{t('dashboard.dueLabel')}</p>{/* etichetta SOTTO */}
    {/* streak-badge, curriculum-progress */}
    <button type="button" className="…">{t('dashboard.primaryAction')}</button>
  </main>
);
```

**Perché `currentUserId` sulla porta e non un accesso diretto.** La chiave `['due', userId]` richiede l'id al livello feature, ma `features` non può importare `data` né vedere la `Session` (AD-1). Estendere `AuthGateway` (mirror di `isAuthenticated`) mantiene il dominio agnostico dal vendor; l'app risolve l'id e lo consegna come prop, coerente con il prop-drilling già usato da `AuthRoot` per `settings`/`account`. Con `userId` `null` (in risoluzione) la dashboard mostra lo scheletro: nessun ramo speciale.

**Perché il fuso dal Clock.** `streak()` esige un `timeZone` esplicito (AD-1: niente `resolvedOptions()` nel dominio). Aggiungerlo al `Clock` (unico canale di accesso al «tempo di piattaforma») lo rende iniettabile e i test deterministici (fuso fisso). Il default operativo è il fuso LOCALE del browser: la scelta ovvia per uno streak personale.

**Perché comporre inline invece di estrarre primitivi ui.** Pile-counter, streak-badge, curriculum-progress e button-primary hanno per ora UN solo consumatore. Comporli inline con i token (la regola colore vale anche su `features`) evita 4 file+test prematuri; l'estrazione a `src/ui/` nasce col secondo consumatore (schermate di sessione/stati vuoti), come già per `PortsProvider` (dichiarato in 3.10, cablato qui).

**Perché `listReviewLog` legge tutto il log.** `streak()` prende il log completo; a questo stadio (RLS per-utente, poche righe) leggere `reviewed_at` senza finestra è corretto e semplice. Un'eventuale finestratura è un'ottimizzazione differita, non un requisito.

## Verification

**Commands:**
- `npm install` -- expected: aggiunge `@tanstack/react-query` e aggiorna il lockfile (exit 0).
- `npm run typecheck` -- expected: exit 0 (`tsc --noEmit`; nuovi metodi di porta implementati ovunque; `DashboardScreenProps` coerente).
- `npm run lint` -- expected: exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; `@tanstack/react-query` fuori da `domain`/`ui`; boundaries verdi).
- `npm test` -- expected: exit 0 (test dashboard/porte/data verdi; parità en/it; nessuna regressione ai test app aggiornati).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto; cancello FR2.6 non regredito).

## Auto Run Result

Status: done

**Sintesi del cambiamento.** La storia 3.12 accende il read-model al suo PRIMO consumatore: la dashboard. Introduce `@tanstack/react-query`, monta un solo `QueryClient` (`retry:false`) alla composition root e cabla il `PortsProvider` (predisposto in 3.10) attorno alle rotte protette. La schermata `DashboardScreen` (nuova feature) legge — via porte iniettate — la pila dei dovuti con la chiave di DOMINIO `dueQueryKey(userId)` verbatim, lo streak (`streak()` su `review_log`), lo sblocco e il curriculum, e rende il conteggio nel ruolo più grande (`text-count-hero`) con l'etichetta sotto, lo streak, "u di t lezioni" e UN'unica azione primaria; uno scheletro alla stessa altezza (`min-h-[24rem]`, `aria-busy`, nessuno spinner) copre il caricamento. Per alimentare la chiave per-utente, `AuthGateway` guadagna `currentUserId()` (mirror di `isAuthenticated`, confine totale), risolto da `AuthRoot` e passato come prop; per lo streak, `ReviewRepository` guadagna `listReviewLog()` e `Clock` guadagna `timeZone()`. La microcopy mette il conteggio prima del verbo, senza `!`/emoji/lode; le chiavi i18n vivono in entrambi i cataloghi. La dashboard resa è quella POPOLATA (dovuti esistenti); stati vuoti/primo-avvio (3.15/3.16), avvio sessione (3.18) e responsive (3.23) restano fuori scope.

**File modificati:**
- `package.json` / `package-lock.json` — aggiunta dipendenza `@tanstack/react-query`.
- `src/domain/ports/authGateway.ts` — `currentUserId(): Promise<string|null>` (il dominio non vede la `Session`).
- `src/data/authGateway.ts` (+ `.test.ts`) — impl `currentUserId` (`session?.user?.id ?? null`, confine totale) + test id/null/throw.
- `src/domain/ports/reviewRepository.ts` — `listReviewLog(): Promise<readonly ReviewLogEntry[]>` (canale unico dello streak).
- `src/data/reviewRepository.ts` (+ `.test.ts`) — impl `listReviewLog` (tabella `review_log`, `DataError` su errore/riga/timestamp) + test valido/vuoto/errore/malformato.
- `src/domain/ports/clock.ts` — `timeZone(): string`.
- `src/data/clock.ts` (+ `.test.ts`) — impl via `Intl…resolvedOptions().timeZone` + test stringa non vuota.
- `src/features/dashboard/DashboardScreen.tsx` (nuovo) — la schermata (4 `useQuery`, scheletro, pile-counter/streak/curriculum/azione, token only).
- `src/features/dashboard/DashboardScreen.test.tsx` (nuovo) — righe I/O Matrix + AC1-5 (cache seminata/ vuota via `renderToStaticMarkup`).
- `src/app/main.tsx` — istanzia repos+clock, costruisce `ports`, crea `QueryClient`, avvolge in `QueryClientProvider`, passa `ports` ad `AuthRoot`.
- `src/app/AuthRoot.tsx` (+ `.test.ts`) — stato `userId` (risolto/azzerato sull'edge-trigger), `PortsProvider` attorno ad `AppRoutes`.
- `src/app/AppRoutes.tsx` (+ `.test.tsx`) — inoltra `userId` alla shell.
- `src/app/AuthenticatedShell.tsx` (+ `.test.tsx`) — rende `<DashboardScreen>` (unico `<main>`) al posto di `<App/>`.
- `src/features/auth/{signIn,signOut,signUp}.test.ts`, `src/features/ports/PortsContext.test.tsx` — porte finte estese ai nuovi metodi.
- `src/i18n/en.ts` / `it.ts` — sezione `dashboard` (parità en/it, conteggio-prima-del-verbo).

**Ripartizione dei finding (questa passata):** patch applicati 1 (low); differiti 1 (medium); respinti 18 (tutti low). Nessun `intent_gap`, nessun `bad_spec`, nessun loopback: `review_loop_iteration` resta 0. L'unico patch ha indurito la catena opzionale di `currentUserId` (`session?.user?.id`) e corretto il commento. Il differito è l'assenza di uno stato d'errore sulla dashboard (fallimento di lettura ⇒ scheletro infinito), reale ma non richiesto dall'intento di 3.12.

**Raccomandazione di follow-up review:** `false`. Contano solo i patch di questa passata: high 0, medium 0, low 1 ⇒ punteggio `3×0 + 1×1 = 1` (< 5 e nessun high).

**Verifica eseguita (dopo il patch, indipendente):**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (`features/dashboard` non importa `data`; nessun colore letterale; boundaries verdi).
- `npm test` — exit 0 (69 file, 698 test verdi; parità en/it; matrix I/O coperta).
- `npm run validate-content` — exit 0 (cancello FR2.6 non regredito).

**Rischi residui.** (1) Percorso d'errore del read-model non gestito (differito): una lettura fallita lascia lo scheletro indefinito. (2) La verifica VISIVA (ruolo più grande reale, altezza in pixel, breakpoint mobile) e la glue d'effetto di `AuthRoot` (`userId`) non sono provate a unità sotto l'harness `node`/`renderToStaticMarkup`: sono deferite alla e2e live, come da convenzione del repo; in pratica scheletro e contenuto ancorano entrambi a `min-h-[24rem]` (nessun salto reale) e `currentUserId` è coperto a unità. (3) L'azione primaria è presente ma inerte finché 3.18 non ne cabla l'avvio sessione.
