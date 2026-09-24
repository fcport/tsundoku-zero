---
title: 'Story 1.10: Cancellare l''account per davvero'
type: 'feature'
created: '2026-09-24'
status: 'awaiting-operator'
baseline_revision: 'f0ddc1c24410c52506f7cdc7e72eb9aa29c62c28'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Verifica live end-to-end della cancellazione reale (AC1/AC2) e del
      riaccesso che fallisce (AC4), differita per architettura.
    evidence: |-
      Provare AC1/AC2 (click su conferma ⇒ l'Edge Function cancella l'utente
      reale; user_settings si svuota per cascata su auth.users) e AC4 (riaccesso
      con le stesse credenziali fallisce) richiede la funzione delete-account
      DEPLOYATA sul progetto reale, l'app deployata e un account reale con
      teardown. L'ambiente di test è node senza jsdom (renderToStaticMarkup non
      esegue eventi né effetti): il click→handler (onConfirm→submitDeleteAccount)
      è glue d'effetto. Coperto meccanicamente: l'adapter per FORMA della
      chiamata (functions.invoke('delete-account') con client finto, ok/errore/
      throw), l'orchestrazione pura (inoltro dell'esito, confine totale), la
      resa statica per fase (idle/confirming, pending, slot errore) e la
      struttura della funzione (getUser + admin.deleteUser + CORS via testo).
      Nessuna infrastruttura Playwright nello stack; stesso schema del live
      differito in 1.2/1.7/1.8/1.9.
    location: >-
      src/features/account/DeleteAccountSection.tsx + supabase/functions/delete-account/index.ts + src/app/AuthRoot.tsx
    severity: low
  - summary: >-
      Ispezione del bundle compilato (dist/) per confermare l'assenza della
      service_role (AC3), conferma dell'operatore.
    evidence: |-
      Il gate meccanico (src/service-role-confinement.test.ts) prova che nessun
      file di codice in src/** contiene service_role/SERVICE_ROLE, che
      .env.example non dichiara alcuna VITE_* di service-role, e per
      anti-vacuità che la funzione server la usa davvero. La conferma finale
      dell'AC3 è l'ispezione dell'artefatto dist/ dopo `npm run build`: un
      controllo dell'operatore sull'output reale del build, fuori dal toolchain
      dei test (che non ispeziona dist/). Verificato in locale a supporto: la
      grep di dist/ dopo il build non trova occorrenze; resta la conferma
      formale dell'operatore sull'artefatto deployato.
    location: >-
      dist/ (artefatto di build) + src/service-role-confinement.test.ts
    severity: low
  - summary: >-
      Sblocco delle e2e live differite di 1.6/1.7/1.8/1.9 (DW-3/6/7/8/9): ora
      esiste il teardown via delete-account (AD-13).
    evidence: |-
      Le verifiche live di 1.6 (registrazione reale), 1.7 (accesso/sessione),
      1.8 (rotte private), 1.9 (persistenza/continuità cross-device) erano
      differite anche perché mancava un teardown sicuro fra la suite e i dati
      reali (AD-13). La funzione delete-account, ora costruita e deployata al
      merge, è quel teardown: email univoca per run + cancellazione via la
      stessa funzione. La costruzione dell'infrastruttura e2e (Playwright,
      account effimeri, teardown) non è nello scope di questa storia né nello
      stack attuale; resta lavoro di una storia/epica di QA dedicata (cfr. 7-x).
    location: >-
      supabase/functions/delete-account/index.ts + suite e2e (non ancora esistente)
    severity: low
  - summary: >-
      Wiring di accessibilità della conferma distruttiva (aria-expanded sul
      grilletto, gestione del focus alla transizione di fase, annuncio live del
      cambio di stato), differito all'audit screen-reader di Epic 7.6.
    evidence: |-
      La conferma a due passi soddisfa AC1 col testo di conseguenza VISIBILE e lo
      slot d'errore in role="alert". Manca però il wiring a11y più fine: nessun
      aria-expanded sul grilletto, nessuno spostamento del focus verso la
      conseguenza/conferma quando si entra in `confirming` né ritorno al grilletto
      su annulla, e il cambio di fase non è annunciato via live region. È la
      stessa classe di lacuna a11y trasversale agli interattivi già differita
      app-wide in DW-10 (anello di focus visibile su auth/settings): di competenza
      dell'audit con screen reader reale della storia 7.6, non introdotta da
      questa storia in modo isolato. Il flusso interattivo è comunque glue
      d'effetto non eseguibile in node (nessun jsdom).
    location: >-
      src/features/account/DeleteAccountConfirm.tsx + src/features/account/DeleteAccountSection.tsx
    severity: low
operator_actions:
  - "Imposta i secret di CI in GitHub > Settings > Secrets and variables > Actions (dovuti dalla storia 1.5, prerequisito del deploy): SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF. Senza, lo step di verifica in migrate.yml fallisce nominando il secret mancante."
  - "Dopo il merge su main, .github/workflows/migrate.yml applica le migrazioni (db push) E deploya l'Edge Function (supabase functions deploy delete-account) al progetto reale. Conferma nel log del workflow che entrambi gli step siano verdi; verifica nello Studio Supabase che la funzione delete-account risulti deployata."
  - "Verifica AC1/AC2 (cancellazione reale + cascata): con l'app deployata, accedi con un account di prova reale, apri l'area autenticata (sezione Cancella account), avvia la conferma esplicita a due passi e conferma. Verifica che l'utente sia cancellato (auth.users) e che la sua riga in user_settings sia sparita per cascata."
  - "Verifica AC4 (riaccesso che fallisce): dopo la cancellazione, tenta di riaccedere con le stesse credenziali e conferma che l'accesso fallisce (l'utente non esiste più)."
  - "Verifica AC3 (bundle compilato): esegui `npm run build` e ispeziona dist/ (es. grep -ri service_role dist/) confermando che la service_role non compare nell'artefatto servito al browser."
---

<intent-contract>

## Intent

**Problem:** FR1.4/`AD-11` sono scoperti: non esiste modo di cancellare l'account, non esiste la Edge Function `delete-account`, e le verifiche live di 1.6/1.7/1.8/1.9 (DW-3/6/7/8/9) restano differite perché mancava proprio il teardown via cancellazione (`AD-13`). La promessa di privacy è dichiarata ma non verificabile.

**Approach:** Una superficie di cancellazione nella shell autenticata con **conferma esplicita** che dichiara la conseguenza (tutti i dati di studio distrutti, statistiche non sopravvivono). Alla conferma, una nuova porta di dominio `AccountGateway` (implementata in `data`) invoca la **unica Edge Function** `delete-account` (Deno, `service_role`): verifica il chiamante dal suo JWT e cancella l'utente con la `service_role`; le tabelle per-utente si svuotano **per cascata** su `auth.users` (`on delete cascade`, già in 1.5). La `service_role` vive **solo** nel runtime della funzione, mai in `src/` né in `VITE_*` — imposto da un test meccanico. Il deploy della funzione al progetto reale è automatizzato al merge su `main` (stessa disciplina di `migrate.yml`), come le migrazioni.

## Boundaries & Constraints

**Always:**
- La cancellazione passa **solo** dalla Edge Function `delete-account` autenticata (`AD-11`): è l'**unico codice server** del progetto. La funzione verifica il chiamante dal JWT (`auth.getUser(jwt)`) e usa la `service_role` per `auth.admin.deleteUser(userId)`; la rimozione dei dati per-utente è **per cascata** su `auth.users`, non cancellazioni tabella-per-tabella dal client.
- La chiamata client passa da una porta `AccountGateway` dichiarata dal dominio (`AD-2`), implementata **solo** in `src/data/` (unico livello che importa `@supabase/supabase-js`) attorno al **client condiviso** (una sola sessione, come 1.9); `features` non importa `data` — la porta è iniettata da `app`. Confine **totale**: la porta ritorna un `AccountDeletionResult` discriminato, non rifiuta mai.
- La conferma è **esplicita e a due passi** (richiesta → conferma), dichiara la conseguenza in copy da `t()` (chiavi tipizzate `AD-14`, parità `en`/`it`, nessun CJK). Solo token del design system (1.3): ogni interattivo con `border-strong`, nessun colore letterale, nessuna ombra, **nessun verde**; il registro voce vieta punti esclamativi, emoji e avverbi di lode (`UX-DR40`).
- Dopo una cancellazione riuscita, il client scarica la sessione locale (ormai morta) e torna anonimo — la transizione di vista vive in `app` (`AuthRoot`), non nella feature.
- La `service_role` non compare **mai** in `src/**` né in una variabile `VITE_*`: un test meccanico lo impone (e verifica per anti-vacuità che la funzione server, fuori da `src/`, la usi davvero).
- La superficie di cancellazione è un `<section>` (non `<main>`): preserva l'invariante single-main di 1.7/1.8.

**Block If:**
- _Nessun blocco._ Il deploy della funzione al progetto reale, l'impostazione dei secret CI (`SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`, dovuti da 1.5) e le prove **live** (cancellazione reale end-to-end — AC1/AC2; cascata svuotata — AC2; riaccesso che fallisce — AC4; ispezione del bundle compilato — AC3) richiedono l'app deployata, la funzione deployata e sessioni reali con teardown. Si finalizza a `awaiting-operator` con `operator_actions`, **mai** `blocked` — stesso schema di 1.5/1.7/1.8/1.9.

**Never:**
- Nessuna `service_role` né alcun secret non-`VITE_*` nel client, in `src/`, in `.env.example` o in `import.meta.env`. Nessuna cancellazione di righe utente dal client (solo la cascata server). Nessun secondo client Supabase.
- Nessun controllo di auth nelle schermate; nessun `@supabase/supabase-js` fuori da `data`; nessun `react-router`/`i18next` fuori dai rispettivi imbuti; `features` non importa `data`.
- Nessuna cancellazione senza la conferma esplicita (nessun one-click). Nessuna copy inventata per superfici future.
- Nessuna migrazione di schema (la cascata di 1.5 è già in `user_settings`); nessuna nuova colonna. Nessun apply/deploy da un ramo di PR (`AD-12`/`AD-13`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| adapter deleteAccount — ok | `functions.invoke` ritorna `{ error: null }` | `{ ok: true }` | — |
| adapter deleteAccount — errore funzione | `functions.invoke` ritorna `{ error }` | `{ ok: false, reason: 'unknown' }` | errore non propagato |
| adapter deleteAccount — throw SDK | `functions.invoke` lancia | `{ ok: false, reason: 'unknown' }` | confine totale |
| orchestrazione submitDeleteAccount | gateway ok / fail | inoltra il risultato del gateway | un throw del finto ⇒ `{ ok:false, reason:'unknown' }` |
| conferma — stato idle | `phase='idle'` | rende il grilletto (`account.delete.trigger`), nessuna copy di conseguenza né conferma | — |
| conferma — stato confirming | `phase='confirming'` | rende la conseguenza (`account.delete.consequence`), i bottoni conferma/annulla, lo slot errore se presente | — |
| conferma — pending | `pending=true` in `confirming` | il bottone di conferma è `disabled` | — |
| conferma — errore | `error=true` in `confirming` | rende il messaggio `account.delete.error` in uno slot `role="alert"` | — |
| edge function — chiamante non valido | JWT assente/invalido | risposta non-2xx (401), nessuna cancellazione | il client mappa a `{ ok:false }` |
| edge function — cancellazione | JWT valido ⇒ `getUser` ⇒ `admin.deleteUser(id)` | utente cancellato, `user_settings` svuotata per cascata, risposta 2xx | throw ⇒ 500 |

</intent-contract>

## Code Map

- `src/domain/ports/accountGateway.ts` -- **NUOVO**: porta `AccountGateway` (tipi puri, nessun import). `deleteAccount(): Promise<AccountDeletionResult>`; `AccountDeletionResult = { ok:true } | { ok:false; reason:'unknown' }`. Confine totale. Modello: `src/domain/ports/authGateway.ts` (union discriminata sull'`ok`).
- `src/data/accountGateway.ts` -- **NUOVO**: `createSupabaseAccountGateway(client: SupabaseClient): AccountGateway` + funzione **pura** esportata `accountDeletionResultFromInvoke(error: unknown): AccountDeletionResult` (mappa l'esito di `functions.invoke` — `error` presente ⇒ `unknown`, assente ⇒ `ok`). `deleteAccount` fa `client.functions.invoke('delete-account')` (il client condiviso allega l'`Authorization` di sessione ⇒ la funzione riceve il JWT del chiamante) e traduce con la pura; try/catch totale. Modello: `authGateway.ts` (pure + adattatore).
- `src/features/account/deleteAccount.ts` -- **NUOVO** (orchestrazione pura): `submitDeleteAccount(account: AccountGateway): Promise<AccountDeletionResult>` con try/catch totale (un throw ⇒ `{ ok:false, reason:'unknown' }`). Modello: `src/features/auth/signOut.ts`.
- `src/features/account/DeleteAccountConfirm.tsx` -- **NUOVO** (presentazionale, controllato da props): `phase:'idle'|'confirming'`, `pending`, `error:boolean`, `onRequestDelete`, `onConfirm`, `onCancel`. In `idle` un solo grilletto (`t('account.delete.trigger')`); in `confirming` la conseguenza (`t('account.delete.consequence')`), conferma (`t('account.delete.confirm')`, `disabled={pending}`), annulla (`t('account.delete.cancel')`) e lo slot errore (`role="alert"`, `t('account.delete.error')`). Solo token, `border-strong`. Modello: `AuthForm.tsx`.
- `src/features/account/DeleteAccountSection.tsx` -- **NUOVO** (container): `useState` di `phase`/`pending`/`error`; riceve `account: AccountGateway` e `onAccountDeleted: () => void` iniettati; alla conferma chiama `submitDeleteAccount(account)`, su `ok` invoca `onAccountDeleted`, su fallimento setta l'errore. È un `<section aria-labelledby>` (NON `<main>`). Modello: `AuthScreen.tsx` (container con stato) + `SettingsScreen.tsx`.
- `src/i18n/en.ts` / `src/i18n/it.ts` -- **MODIFICA**: nuovo ramo `account.delete` con `trigger`, `consequence`, `confirm`, `cancel`, `error` (parità obbligatoria, nessun CJK). La conseguenza dichiara «tutti i dati di studio distrutti, statistiche non sopravvivono, azione irreversibile» (AC1).
- `src/app/main.tsx` -- **MODIFICA**: `const account = createSupabaseAccountGateway(client)` (stesso client condiviso); passa `account` ad `AuthRoot`.
- `src/app/AuthRoot.tsx` -- **MODIFICA**: prop `account: AccountGateway`; la inoltra ad `AppRoutes`; fornisce `onAccountDeleted` = scarica la sessione locale ormai morta (`submitSignOut(gateway)`) e porta lo stato ad `anonymous` (riuso del percorso di sign-out).
- `src/app/AppRoutes.tsx` -- **MODIFICA**: prop `account` in `AppRoutesProps`; inoltrata a `AuthenticatedShell` insieme a `onAccountDeleted`.
- `src/app/AuthenticatedShell.tsx` -- **MODIFICA**: prop `account` + `onAccountDeleted`; compone `<DeleteAccountSection>` **dopo** `<SettingsScreen>` (app compone due feature come sibling, evitando l'arco features→features). Resta un solo `<main>` (la sezione è `<section>`).
- `supabase/functions/delete-account/index.ts` -- **NUOVO** (Deno, unico codice server): gestisce CORS (preflight `OPTIONS`); legge l'header `Authorization`; crea un client `service_role` dai env iniettati dalla piattaforma (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); `auth.getUser(jwt)` verifica il chiamante (401 se assente/invalido); `auth.admin.deleteUser(user.id)` cancella (500 su errore); 200 su successo. `service_role` **solo qui**.
- `supabase/config.toml` -- **MODIFICA**: aggiunge `[functions.delete-account]` con `verify_jwt = false` (verifichiamo il chiamante nel corpo con `getUser`, e serve a lasciar passare il preflight CORS non autenticato — pattern Supabase per funzioni chiamate dal browser).
- `.github/workflows/migrate.yml` -- **MODIFICA**: dopo `db push`, aggiunge uno step `supabase functions deploy delete-account` (riusa `link` + secret, stessa disciplina «solo su push:main, mai su PR»). Aggiorna `name`/commento: applica schema **e** funzioni al progetto reale.
- `src/data/accountGateway.test.ts` -- **NUOVO**: adattatore con `client.functions.invoke` finto (ok/errore/throw) + la pura `accountDeletionResultFromInvoke`. Modello: `settingsRepository.test.ts`.
- `src/features/account/deleteAccount.test.ts` -- **NUOVO**: orchestrazione (inoltro dell'esito; throw ⇒ `unknown`).
- `src/features/account/DeleteAccountConfirm.test.tsx` -- **NUOVO**: resa statica per `phase` (idle/confirming), pending disabilita conferma, slot errore, nessun `<main>`.
- `src/service-role-confinement.test.ts` -- **NUOVO** (AC3, gate meccanico): nessun file `src/**` contiene `service_role`/`SERVICE_ROLE` (case-insensitive); `.env.example` non dichiara alcuna `VITE_*` di service-role; anti-vacuità: `supabase/functions/delete-account/index.ts` esiste e **usa** `SERVICE_ROLE` (la chiave vive solo lato server). Modello: `deploy-config.test.ts` (legge file via `node:fs`).
- `src/edge-functions.test.ts` -- **NUOVO**: la funzione esiste e usa `getUser` + `admin.deleteUser` (struttura AC2); `config.toml` dichiara `[functions.delete-account]`; `migrate.yml` deploya `functions deploy delete-account` su push:main e **mai** su PR (gate `AD-12`/`AD-13`). Modello: `migrations.test.ts`.
- `src/app/{AuthRoot,AppRoutes,AuthenticatedShell}.test.tsx` -- **MODIFICA**: aggiungere una `account` finta inerte e `onAccountDeleted` noop ai render; il single-main resta 1.
- Riferimenti (sola lettura): `supabase/migrations/20260923221517_create_user_settings.sql` (cascata `on delete cascade` su `auth.users` — già presente, non modificata); `src/data/supabaseClient.ts` (client condiviso); `eslint.config.js` (ignora `supabase/**`; `@supabase/supabase-js` confinato a `data`); `tsconfig.json`/`vitest.config.ts` (coprono solo `src` ⇒ il codice Deno resta fuori dal toolchain Node); `.env.example` (documenta perché la `service_role` non è qui).

## Tasks & Acceptance

**Execution:**
- `src/domain/ports/accountGateway.ts` -- dichiarare la porta e l'`AccountDeletionResult` (tipi puri, confine totale).
- `src/data/accountGateway.ts` -- adattatore `functions.invoke('delete-account')` + pura di mappatura.
- `src/features/account/deleteAccount.ts` -- orchestrazione pura, confine totale.
- `src/features/account/DeleteAccountConfirm.tsx` -- conferma presentazionale a due stati.
- `src/features/account/DeleteAccountSection.tsx` -- container con stato, porta iniettata.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- ramo `account.delete.*` (parità, nessun CJK, conseguenza dichiarata).
- `src/app/{main,AuthRoot,AppRoutes,AuthenticatedShell}.tsx` -- wiring: gateway condiviso, inoltro della porta, `onAccountDeleted`, composizione della sezione.
- `supabase/functions/delete-account/index.ts` -- Edge Function (verifica chiamante + `admin.deleteUser` con `service_role` + CORS).
- `supabase/config.toml` -- `[functions.delete-account] verify_jwt = false`.
- `.github/workflows/migrate.yml` -- step di deploy della funzione (solo push:main).
- `src/data/accountGateway.test.ts`, `src/features/account/deleteAccount.test.ts`, `src/features/account/DeleteAccountConfirm.test.tsx`, `src/service-role-confinement.test.ts`, `src/edge-functions.test.ts` -- codificare la I/O Matrix e gli AC meccanici.
- `src/app/{AuthRoot,AppRoutes,AuthenticatedShell}.test.tsx` -- render con la `account` finta e `onAccountDeleted` noop.

**Acceptance Criteria:**
- Given un utente autenticato nella superficie di cancellazione (stato `idle`), when avvia la cancellazione (`phase='confirming'`), then una conferma esplicita dichiara la conseguenza — «tutti i dati di studio distrutti, le statistiche non sopravvivono, azione irreversibile» — resa da `t()` e provata dal render statico della fase `confirming`; il flusso click reale è glue differita (operatore).
- Given la conferma accettata, when la richiesta è inviata, then il client invoca la Edge Function `delete-account` (autenticata dal JWT di sessione) che verifica il chiamante e cancella l'utente con la `service_role`, e le tabelle per-utente si svuotano per cascata su `auth.users` — dimostrato dall'adapter test (forma della chiamata) e dalla struttura della funzione; l'effetto sul progetto reale è verifica live (operatore).
- Given l'albero `src/**`, `.env.example` e `import.meta.env`, when ispezionati, then la `service_role` non compare — dimostrato dal test di confinamento (assente in `src/**`, nessuna `VITE_*` di service-role) che verifica anche che la funzione server la usi davvero; l'ispezione del bundle compilato (`dist/`) è conferma dell'operatore.
- Given l'account cancellato, when l'utente tenta di riaccedere con le stesse credenziali, then l'accesso fallisce — verifica **live** end-to-end (operatore): richiede la funzione deployata e un account reale con teardown (`AD-13`). Sblocca anche le e2e differite di 1.6/1.7/1.8/1.9 (DW-3/6/7/8/9).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano senza regressioni sulle sonde di 1.1–1.9 (confini `AD-1`, funnel i18n, regola colore, parità cataloghi, guard/rotte, single-main), e i nuovi test sono verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 0, medium 0, low 5)
- defer: 1: (high 0, medium 0, low 1)
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[low]` `[patch]` **Edge Function senza guard di metodo** (blind-hunter + edge-case): OPTIONS a parte, ogni metodo raggiungeva il percorso di cancellazione. Aggiunto un guard che rifiuta i non-POST con `405` + `corsHeaders`, coerente con l'`Access-Control-Allow-Methods` dichiarato; asserzione testuale in `edge-functions.test`.
  - `[low]` `[patch]` **Edge Function senza confine sul throw inatteso** (edge-case): un throw da `createClient`/`getUser`/`deleteUser` sarebbe sfuggito come rejection non gestita ⇒ 500 di piattaforma SENZA header CORS. Logica avvolta in try/catch con `500` + `corsHeaders` (helper `jsonResponse`); asserzione testuale in `edge-functions.test`.
  - `[low]` `[patch]` **Annulla attivo durante `pending`** (blind-hunter): in `confirming`, con la cancellazione in volo, "Annulla" restava cliccabile pur non potendo abortire la richiesta (affordance ingannevole su un'azione irreversibile). Aggiunto `disabled={pending}` anche ad Annulla (convenzione del pending come per Disconnetti); asserzione aggiunta a `DeleteAccountConfirm.test`.
  - `[low]` `[patch]` **Copy della conferma identica al grilletto** (blind-hunter): `account.delete.confirm` == `account.delete.trigger` indeboliva il "due passi esplicito". Resa distinta e definitiva (en `Delete permanently`, it `Cancella definitivamente`), parità en/it e no-CJK preservate.
  - `[low]` `[patch]` **Resa statica di `DeleteAccountSection` non asserita** (verification-gap): a differenza del gemello `SettingsScreen`, nessun test copriva il titolo/landmark della sezione ⇒ poteva sparire dalla shell con la suite verde. Aggiunto `DeleteAccountSection.test.tsx` (titolo in `<section>`, nessun `<main>`, grilletto reso).

Findings deferiti: wiring a11y della conferma distruttiva (aria-expanded, gestione focus, annuncio live del cambio fase) → audit screen-reader di Epic 7.6, stessa classe di DW-10 (vedi `deferred`).

Findings rifiutati (rappresentativi): «CORS `Access-Control-Allow-Origin: *` su azione distruttiva» — il flusso è a bearer token (non forgiabile cross-site come un cookie) e le anteprime Vercel hanno URL dinamici: pattern standard Supabase; «adapter ignora `data`/il corpo JSON di `invoke`» — corretto by-design (supabase-js valorizza `error` sul non-2xx; il corpo è diagnostico); «`stripComments` del test di confinamento ha falsi negativi su `//` dentro una stringa» — euristica deliberata, stesso precedente accettato di `stripYamlComments`/`stripSqlComments`, coglie ogni pattern realistico di leak; «il test di confinamento non copre `index.html`/`vite.config`/`.env`» — lo scan di `src/**` + l'ispezione operatore di `dist/` è il gate a due livelli, quei file non nominano secret; «`onAccountDeleted` ingoia il fallimento di sign-out» — rispecchia il pattern `onSignOut` di 1.7 e `submitSignOut` è a confine totale (mai reject): il clear locale è best-effort perché l'account è già cancellato lato server; «slot d'errore stantio» — l'errore È azzerato a ogni transizione (`onRequestDelete`/`onCancel`/`onConfirm`); «la funzione è provata solo come testo» — è codice Deno fuori dal toolchain Node, il runtime è già enumerato in `deferred`/`operator_actions` (verifica live); «`SUPABASE_PROJECT_REF` non documentato» — secret pre-esistente già usato dallo step `link`, documentato in `.env.example` e `operator_actions`; «nessun boundary test per `features/account`» — la regola `boundaries` vieta `features→data` universalmente e `boundaries.test` linta tutto `src/**`; «contrasto del bottone `bg-danger text-surface-raised`» — il rapporto è simmetrico, `danger`↔`surface-raised` = 6.9:1 chiaro / 6.1:1 scuro (già verde in `check-contrast`); «semantica di fallimento parziale del deploy» — il `functions deploy` è idempotente/ri-eseguibile e `operator_actions` chiede di confermare entrambi gli step verdi.

## Design Notes

**Perché una Edge Function e la cascata, non cancellazioni dal client.** `AD-11` confina ogni scrittura privilegiata a un solo server: la `service_role` può cancellare qualunque utente, quindi non può stare nel bundle. Il client autenticato non può cancellare `auth.users` (RLS/privilegi), perciò la cancellazione passa dalla funzione, e la rimozione dei dati per-utente è **strutturale** — `on delete cascade` verso `auth.users`, già dichiarato nella migrazione di 1.5 — non una lista di `delete` che si dimenticherebbe una tabella. Epic 7 (`7-5`) ri-verifica la cascata tabella-per-tabella su tutto lo schema; qui la costruiamo e la proviamo sul solo `user_settings` esistente.

**Perché `verify_jwt = false` + verifica manuale.** La funzione è chiamata dal browser via `supabase.functions.invoke`, che innesca un preflight CORS `OPTIONS` **senza** JWT. Con `verify_jwt = true` la piattaforma respingerebbe il preflight (401) prima del nostro codice. Perciò disattiviamo la verifica di piattaforma e verifichiamo il chiamante **nel corpo** con `auth.getUser(jwt)` usando il client `service_role`: è ciò che l'AC intende con «verifica il chiamante». Nessun JWT valido ⇒ 401, nessuna cancellazione.

**Perché il codice Deno non rompe il toolchain Node.** `tsconfig.json` include solo `src` + i config; `vitest.config.ts` raccoglie solo `src/**/*.test`; `eslint.config.js` ignora `supabase/**`. La funzione (import `esm.sh`, global `Deno`) vive fuori da tutti e tre: lint/typecheck/test/build non la vedono. Golden esempio del confine client→funzione:
```ts
// src/data/accountGateway.ts
const { error } = await client.functions.invoke('delete-account');
return accountDeletionResultFromInvoke(error); // error ⇒ {ok:false,reason:'unknown'}
```

**Perché il deploy è in CI.** Lasciare la funzione come deploy manuale contraddirrebbe l'ethos «versionato e ripetibile» del progetto (le migrazioni si applicano da `migrate.yml`, non dallo Studio). Il deploy della funzione riusa `link` e i secret dello stesso workflow, con la stessa disciplina: solo `push:main`, mai su PR. La parte umana resta i secret e la verifica live.

**Perché `awaiting-operator` e non `done`.** L'agente completa tutto il codice (client, funzione, deploy CI) e i gate meccanici. Le prove **live** — cancellazione reale (AC1/AC2), cascata svuotata (AC2), riaccesso fallito (AC4), bundle compilato ispezionato (AC3) — richiedono la funzione deployata, i secret CI (dovuti da 1.5) e sessioni reali con teardown: non eseguibili qui. Enumerate in `operator_actions`/`deferred` — stesso schema di 1.5/1.7/1.8/1.9.

## Verification

**Commands:**
- `npm run lint` -- expected: 0 errori (`@supabase/supabase-js` solo in `data`; funnel i18n/react-router intatti; `features` non importa `data`; nessun colore letterale; `supabase/**` ignorato).
- `npm run typecheck` -- expected: `tsc` strict senza errori, nessun `any`; union `AccountDeletionResult` esaustiva; chiavi `t()` tipizzate.
- `npm test` -- expected: verdi `accountGateway`, `deleteAccount`, `DeleteAccountConfirm`, `service-role-confinement`, `edge-functions`; parità `en`/`it` + no-CJK con le nuove chiavi; nessuna regressione su 1.1–1.9 (single-main, guard/rotte, sonde di confine).
- `npm run build` -- expected: `tsc --noEmit` + `vite build` producono `dist/` (il codice Deno resta fuori dal build).

**Manual checks (if no CLI):**
- Ispezionare `supabase/functions/delete-account/index.ts`: verifica del JWT con `getUser`, cancellazione con `admin.deleteUser`, `service_role` letta dai env di piattaforma, CORS gestito.
- Ispezionare `src/data/accountGateway.ts`: `functions.invoke('delete-account')`, nessun riferimento a `service_role`, confine totale.
- Ispezionare `src/features/account/DeleteAccountSection.tsx`: `<section>` (non `<main>`), conferma esplicita a due passi, porta iniettata.

## Auto Run Result

Status: awaiting-operator

**Sommario.** La storia rende la **cancellazione account** verificabile invece che dichiarata (FR1.4/`AD-11`). Una superficie di cancellazione nella shell autenticata (feature `account`, resa come `<section>`) espone una **conferma esplicita a due passi**: dal grilletto si passa allo stato `confirming`, che dichiara la conseguenza da `t()` (tutti i dati di studio distrutti, statistiche non sopravvivono, azione irreversibile) e offre conferma/annulla. Alla conferma, la nuova porta di dominio `AccountGateway` (implementata in `data` attorno al **client condiviso** di 1.9) invoca l'**unica Edge Function** `delete-account` (Deno): `functions.invoke` allega il JWT di sessione, la funzione verifica il chiamante con `auth.getUser(jwt)` (guard di metodo POST + confine totale try/catch, tutte le risposte con header CORS) e cancella l'utente con la `service_role` via `auth.admin.deleteUser`; le tabelle per-utente si svuotano per **cascata** su `auth.users` (`on delete cascade` di 1.5). Su successo l'app scarica la sessione morta e torna anonima (`AuthRoot`). La `service_role` vive **solo** nel runtime della funzione: un test di confinamento impone che non compaia in `src/**` né in `VITE_*` (e per anti-vacuità che la funzione la usi davvero). Il deploy della funzione è automatizzato al merge su `main` in `migrate.yml`, con la stessa disciplina delle migrazioni (mai su PR).

**Perché `awaiting-operator` e non `done`.** L'agente ha completato tutto il codice (client, funzione, deploy CI) e i gate meccanici. Le prove **live** — cancellazione reale (AC1/AC2), cascata svuotata (AC2), riaccesso che fallisce (AC4), ispezione del bundle compilato `dist/` (AC3) — richiedono la funzione deployata, i secret CI (dovuti da 1.5) e sessioni reali con teardown: non eseguibili qui. Enumerate in `operator_actions`/`deferred` — stesso schema di 1.5/1.7/1.8/1.9. Questa storia **sblocca** anche il teardown (`AD-13`) delle e2e live differite di 1.6/1.7/1.8/1.9.

**File creati/modificati (uno per riga):**
- `src/domain/ports/accountGateway.ts` — **nuovo**: porta `AccountGateway` + `AccountDeletionResult` (union discriminata, confine totale, tipi puri).
- `src/data/accountGateway.ts` — **nuovo**: `createSupabaseAccountGateway` (invoca `delete-account`, confine totale) + pura `accountDeletionResultFromInvoke`.
- `src/features/account/deleteAccount.ts` — **nuovo**: orchestrazione pura `submitDeleteAccount` (confine totale).
- `src/features/account/DeleteAccountConfirm.tsx` — **nuovo**: conferma presentazionale a due fasi (idle/confirming); conferma **e** annulla disabilitati durante `pending`; token `danger`, nessun verde; slot errore `role="alert"`.
- `src/features/account/DeleteAccountSection.tsx` — **nuovo**: container con stato, porta iniettata, `<section>` (single-main preservato).
- `supabase/functions/delete-account/index.ts` — **nuovo** (unico codice server): CORS, guard POST (405), verifica JWT (`getUser`, 401), `admin.deleteUser` (500/200), confine totale try/catch, tutte le risposte con header CORS.
- `supabase/config.toml` — **modifica**: `[functions.delete-account] verify_jwt = false` (preflight non autenticato + verifica nel corpo).
- `.github/workflows/migrate.yml` — **modifica**: step `supabase functions deploy delete-account` (solo push:main, mai PR); nome/commento aggiornati.
- `src/i18n/en.ts` + `src/i18n/it.ts` — **modifica**: ramo `account.delete` (`title`, `trigger`, `consequence`, `confirm` distinta/definitiva, `cancel`, `error`), parità, nessun CJK.
- `src/app/main.tsx` — **modifica**: crea `account` dal client condiviso, iniettato in `AuthRoot`.
- `src/app/AuthRoot.tsx` — **modifica**: prop `account`; `onAccountDeleted` scarica la sessione morta (`submitSignOut`) e torna anonimo.
- `src/app/AppRoutes.tsx` + `src/app/AuthenticatedShell.tsx` — **modifica**: inoltrano `account`/`onAccountDeleted`; la shell compone `<DeleteAccountSection>` come sibling di `<SettingsScreen>`.
- Test: `src/data/accountGateway.test.ts`, `src/features/account/deleteAccount.test.ts`, `src/features/account/DeleteAccountConfirm.test.tsx`, `src/features/account/DeleteAccountSection.test.tsx`, `src/service-role-confinement.test.ts`, `src/edge-functions.test.ts` — **nuovi**; `src/app/{AuthRoot,AppRoutes,AuthenticatedShell}.test.tsx` — **modifica** (porta `account` finta + `onAccountDeleted` noop).

**Findings di review:** 5 patch applicati (tutti low: guard di metodo dell'Edge Function, confine totale try/catch della funzione, Annulla disabilitato durante pending, copy di conferma distinta, test di regressione di `DeleteAccountSection`), 1 deferito (low: wiring a11y della conferma → Epic 7.6), 0 intent_gap, 0 bad_spec, 14 rifiutati (vedi Review Triage Log). `verification-gap`: la lacuna sulla resa di `DeleteAccountSection` è stata chiusa con un test. `intent-alignment`: implementazione fedele alla lettura operator-handoff dell'intent; le sostituzioni di superficie (AC3 sorgente↔bundle, AC4 interamente live) sono gestite con `operator_actions`.

**Follow-up review recommendation: true.** Patch di questa passata: high 0, medium 0, low 5. Punteggio `3×medium + 1×low = 0 + 5 = 5 ≥ 5` ⇒ `true`. Un'ulteriore passata di review è consigliata (storia sensibile alla sicurezza, cinque patch a basso rischio già applicate).

**Verifica eseguita (tutta verde, rieseguita dopo i patch):** `npm run lint` (0 errori: `@supabase/supabase-js` solo in `data`, funnel i18n/react-router intatti, `features` non importa `data`, nessun colore letterale, `supabase/**` ignorato), `npm run typecheck` (`tsc` strict, nessun `any`, union `AccountDeletionResult` esaustiva, chiavi `t()` tipizzate), `npm test` (**254 test su 31 file**: `accountGateway` 7, `deleteAccount` 5, `DeleteAccountConfirm` 11, `DeleteAccountSection` 3, `service-role-confinement` 5, `edge-functions` 13, più le sonde di 1.1–1.9 senza regressioni — single-main, guard/rotte, parità cataloghi, no-CJK, confini), `npm run build` (`tsc --noEmit` + `vite build` producono `dist/`; avviso chunk >500 kB preesistente e informativo). **Matrix Test Audit:** tutte le righe della I/O Matrix coperte da test eseguiti e passati (le due righe di runtime dell'Edge Function Deno sono coperte strutturalmente via ispezione-testo, coerente col pattern del progetto; il runtime è verifica live differita). **Bonus AC3:** `grep -ri service_role dist/` dopo il build non trova occorrenze.

**Rischi residui / azioni operatore.** (1) Le prove live di AC1/AC2/AC4 e l'ispezione del bundle `dist/` (AC3) dipendono dalla funzione deployata, dai secret CI (dovuti da 1.5) e da sessioni reali con teardown: enumerate in `operator_actions`, con le e2e automatiche differite in `deferred`. (2) Il runtime dell'Edge Function (rami 401/500/200, cascata) è provato solo come testo qui: codice Deno fuori dal toolchain Node, verifica di comportamento differita al live. (3) Il wiring a11y più fine della conferma (aria-expanded, focus, annuncio live) è deferito all'audit screen-reader di Epic 7.6 (stessa classe di DW-10).
