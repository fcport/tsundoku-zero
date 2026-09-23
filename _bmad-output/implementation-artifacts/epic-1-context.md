# Epic 1 Context: Fondamenta, accesso e URL pubblico

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Questa epica posa le fondamenta su cui poggia tutto il resto del prodotto: uno scaffold applicativo manuale i cui confini architetturali sono imposti meccanicamente in CI prima ancora che esista codice da vincolare, un URL pubblico raggiungibile senza credenziali, il sistema di design come token unici, la sicurezza dei tipi sulle traduzioni, lo schema dati versionato e isolato per riga, e il ciclo completo di autenticazione (registrazione, accesso, sessione persistente, cambio lingua, cancellazione account). Conta perché stabilisce i vincoli portanti — i confini di `AD-1`, il confine a tre di `AD-14`, l'isolamento RLS, la catena di deploy su database reale — che ogni epica successiva dà per acquisiti invece di doverli ricostruire.

## Stories

- Story 1.1: Scaffold con i confini imposti in CI
- Story 1.2: Un indirizzo pubblico raggiungibile
- Story 1.3: Il sistema di design come token, non come valori sparsi
- Story 1.4: Nessuna stringa cablata, imposto dal compilatore
- Story 1.5: Lo schema nasce versionato e isolato
- Story 1.6: Registrazione con email e password
- Story 1.7: Accesso, disconnessione e sessione che resiste
- Story 1.8: Le rotte private sono private
- Story 1.9: Cambiare lingua senza ricaricare
- Story 1.10: Cancellare l'account per davvero

## Requirements & Constraints

- **Autenticazione completa**: registrazione con email e password (nessuna conferma email, nessun onboarding, nessun questionario di livello), accesso, disconnessione esplicita, e sessione che persiste fra riavvii del browser fino alla disconnessione. Un accesso da un dispositivo diverso ritrova la stessa lingua.
- **Fallimenti prevedibili tradotti**: password errata, email già registrata, password troppo debole, email in formato non valido. Passano tutti da un unico traduttore in `features/auth` verso chiavi i18n dedicate; nessun messaggio grezzo di Supabase raggiunge l'utente; il messaggio compare accanto al campo responsabile, non in cima alla pagina. Una password errata non rivela se l'email esista.
- **Rotte protette**: ogni rotta che espone dati utente è raggiungibile solo da autenticati; un visitatore non autenticato è reindirizzato al login. La dashboard reale arriva in Epic 3 — qui la rotta radice protetta è minima e nessuna storia la presuppone.
- **Cancellazione account verificabile**: rimuove tutti i dati di studio dell'utente per cascata su `auth.users`, previa conferma esplicita che ne dichiara la conseguenza. La `service_role` non deve comparire nel bundle client né in variabili `VITE_*`. Dopo la cancellazione, riaccedere con le stesse credenziali fallisce.
- **Lingua**: interfaccia in inglese e italiano, commutabile a runtime senza ricaricare la pagina, persistita per utente e valida su tutti i suoi dispositivi. Nessuna stringa visibile è cablata nel codice.
- **URL pubblico e deploy**: produzione pubblicata al merge su `main`, anteprima dedicata per ogni PR, deep link a rotte interne che non restituiscono 404. La cartella servita è **soltanto** l'artefatto di build, mai la radice del repository (un percorso come `/_bmad-output/...` non deve essere raggiungibile in produzione).
- **Configurazione fail-fast**: una variabile `VITE_*` mancante fa fallire all'avvio uno schema di validazione in `src/app/`, con un messaggio che nomina la variabile; l'app non parte in stato parzialmente configurato.
- **Sicurezza dei tipi**: TypeScript in modalità strict, nessun `any` nel codice applicativo. Nessun SDK di analitica o error tracking di terze parti.

## Technical Decisions

- **`AD-1` (confine di dominio puro, dipendenze a senso unico)** è il vincolo più importante del progetto. Cinque livelli: `domain` → `data` → `ui` → `features` → `app`, più `i18n`. `src/domain/` non importa React, `@supabase/supabase-js`, `fetch`, storage o orologio. `src/features/` **non** importa `src/data/` (ammette solo `features → domain | ui | i18n`); gli adattatori nascono in `app` e arrivano alle schermate come porte. Imposto da `eslint-plugin-boundaries`: una violazione è **CI rossa**, non un avviso. `dependency-cruiser` genera `docs/dependency-graph.svg`.
- **Scaffold manuale, non starter template.** Né lo Spine né il Delta nominano uno scaffold da clonare: partire da `create-vite` produrrebbe una struttura che viola `AD-1` dalla prima riga. Il progetto si inizializza a mano con Vite, React 19 e TypeScript strict, creando l'albero `src/domain/`, `src/data/`, `src/ui/`, `src/features/`, `src/app/`, `src/i18n/`. Il confine va imposto **prima** che esista codice da vincolare.
- **Stack vincolato (`AD-20`)**: Vite + React (non Next — ogni schermata è dietro autenticazione, un secondo confine ortogonale ad `AD-1` è indesiderato, e le API route aprirebbero una porta su `AD-11`). Hosting Vercel con `vercel.json` che riscrive verso `index.html` per i deep link. TypeScript resta a 5.9.3 (non 7.x): senza API programmatica stabile non esiste `typescript-eslint`, quindi non esiste la regola meccanica di `AD-1`. `npm` con `package-lock.json` versionato; la CI usa `npm ci`, mai `npm install`. Configurazione solo da `import.meta.env.VITE_*`, validata all'avvio in `src/app/`.
- **`AD-14` — confine a tre.** Nessuna stringa visibile cablata; chiavi i18n tipizzate via declaration merging su `CustomTypeOptions` di i18next, così che una chiave inesistente sia un **errore di compilazione `tsc`**, non un fallimento a runtime. I cataloghi `en` e `it` hanno lo stesso insieme di chiavi. Il confine ha tre lati: **interfaccia da `t()`, contenuto delle lezioni dal file di lezione, giapponese da nessuno dei due** — il giapponese è dato, marcato `lang="ja"`. In Epic 1 il lato "contenuto lezione" non ha ancora consumatori (arriva in Epic 2), ma il confine va documentato e imposto qui.
- **`AD-2` — porte dichiarate dal dominio.** Le interfacce vivono in `src/domain/ports/` (`ContentRepository`, `ProgressRepository`, `ReviewRepository`, `SettingsRepository`, `Clock`). Solo `src/data/` le implementa ed è l'unica cartella che può importare `@supabase/supabase-js`; `src/app/` istanzia e inietta gli adattatori.
- **`AD-11` — cancellazione via Edge Function.** L'unica Edge Function `delete-account`, autenticata, verifica il chiamante e cancella l'utente con la `service_role`. È l'**unico codice server del progetto**; la `service_role` vive solo nei secret Supabase, mai lato client né in `VITE_*`.
- **`AD-12` / `AD-13` — un solo progetto Supabase, quello reale**, condiviso da sviluppo, CI ed e2e (niente staging, niente istanza locale). Le migrazioni versionate in `supabase/migrations/` si applicano **soltanto al merge su `main`**, mai da un ramo di PR: i dati di studio dell'owner sono la metrica di accettazione `M1` e una migrazione rotta da una PR li distruggerebbe. Conseguenza dichiarata: una PR che cambia lo schema vede i propri e2e solo dopo il merge; in CI una migrazione di PR è validata sintatticamente ma non applicata. `AD-13` (email univoca per run, teardown via la stessa Edge Function di `AD-11`) diventa l'unica difesa fra la suite di test e i dati reali: il teardown va verificato, non sperato.
- **`AD-10` — RLS su ogni tabella per-utente**, policy `user_id = auth.uid()` su ogni operazione; il contenuto ha RLS in sola lettura. Un test di integrazione dimostra che l'utente A non legge né scrive le righe di B. In Epic 1 nasce `user_settings`: `user_id` come chiave primaria con `on delete cascade` verso `auth.users`, e la sola colonna `locale` con predefinito `'en'` — nessuna colonna prima della storia che la usa (`lessons_per_day` arriva in Epic 3). La lingua si scrive con un **upsert diretto** sulla tabella, non via RPC.
- **Un solo guard di rotta** in `src/app/` (non controlli sparsi nelle schermate). Sessione `supabase-js` persistita per FR1.3.
- **Design token, non valori sparsi (`UX-DR1`–`UX-DR9`)**: nella config Tailwind vivono 27 token colore (14 chiari, 13 scuri, valori letterali di `DESIGN.md`), i ruoli tipografici, la scala di spaziatura a 4px (più `gutter-mobile` 20px, `gutter-desktop` 32px, `measure` 34rem, `thumb-zone` 120px) e i quattro raggi (`sm` 4px, `md` 8px, `lg` 12px, `full` 9999px). Regole non negoziabili: nessun colore ha la sua unica definizione dentro `prefers-color-scheme: dark`; una regola di lint segnala ogni valore colore letterale scritto al posto di un token; **nessuna ombra** (la separazione usa bordi e il salto tonale fra `surface-base` e `surface-raised`); due token di bordo non intercambiabili (`border-hairline` solo decorativo, `border-strong` per il confine di ogni interattivo — un interattivo delimitato dal solo hairline è un difetto di accessibilità). Due famiglie con confine netto: **Noto Sans JP** per il giapponese, **Inter** per l'interfaccia, ciascuna con stack di ripiego.
- **Verifica del contrasto in CI (`UX-DR7`)**: uno script verifica ogni coppia colore/fondo su `surface-base` **e** `surface-raised`, in modalità chiara **e** scura, fallendo sotto `4.5:1` per il testo e `3:1` per il non-testo.
- **Modalità scura come pari, senza interruttore (`UX-DR38`)**: segue `prefers-color-scheme` e rende con i token `*-dark` senza intervento dell'utente. Le impostazioni restano due (lingua e — da Epic 3 — tetto di sblocco) più la cancellazione account; **non esiste un interruttore del tema**.
- **Convenzioni rilevanti**: componenti React `PascalCase.tsx`, moduli di dominio `camelCase.ts`, cartelle `kebab-case`, test accanto al soggetto come `*.test.ts`. Tabelle/colonne SQL `snake_case` al singolare, RPC in forma verbale. Union letterali per gli enumerati, mai `enum`. Nessun `.env` versionato; `.env.example` documenta i nomi, mai i valori. Stile solo Tailwind, nessun CSS-in-JS né file CSS per componente.

## UX & Interaction Patterns

- **Errori di autenticazione** come stato progettato: dicono cosa è successo, non come sentirsi; nessun punto esclamativo, emoji o avverbio di lode. Il messaggio è ancorato al campo responsabile.
- **Impostazioni** nascono qui con due sole voci utente — lingua e cancellazione account — senza interruttore del tema. Il tetto di sblocco si aggiunge in Epic 3.
- **Ruolo tipografico per il giapponese di frase (`UX-DR8`)**: fissato a 32/26px con interlinea 1.9, ma resta **deliberatamente non applicato/non verificato** in questa epica perché la verifica sul rendering reale richiede una frase lunga vera, che arriva con la lezione campione di Epic 2 e si chiude nella storia 3.23.
- Voce: il conteggio prima del verbo, nessuna animazione celebrativa, nessun verde di successo nel sistema (rilevante come principio di identità già dalla config dei token).

## Cross-Story Dependencies

- **La storia 1.1 (scaffold + confini in CI) precede tutto**: senza l'albero sorgente e i confini imposti, ogni storia successiva rischia di nascere fuori norma. `AD-14` reso meccanico qui fa sì che l'assenza di stringhe cablate si autoimponga da questo punto in avanti, invece di diventare un'epica di pulizia finale.
- **Prerequisiti di provisioning già verificati** (fuori dalle storie perché richiedono OAuth interattivo): 1.1 presuppone il repository GitHub, 1.2 il progetto Vercel collegato, 1.5 il progetto Supabase reale. Mancano ancora i secret `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` in GitHub Actions.
- **Verso Epic 3**: la superficie Impostazioni è estesa con il tetto di sblocco; `user_settings` acquisisce `lessons_per_day`. La rotta radice protetta di 1.8 ospiterà la dashboard vera.
- **Verso Epic 2/3**: il ruolo tipografico di frase (`UX-DR8`) si chiude solo dopo che esistono frasi reali (lezione campione di Epic 2, verifica in 3.23).
- **`AD-11` (cancellazione via Edge Function)**: costruita in 1.10, ri-verificata su tutte le tabelle per-utente in Epic 7 (inclusa `lesson_progress`).
