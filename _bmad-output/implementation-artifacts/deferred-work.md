### DW-1: Irrigidire la purezza del dominio oltre i quattro casi dell'AC (AD-3/AD-4): vietare in src/domain i global di orologio/casualità (Date.now, new Date senza argomenti, Math.random) e gli import di built
origin: spec-deferred 7ea7adc885fb
location: eslint.config.js (override src/domain/**)
source_spec: `spec-1-1-scaffold-con-i-confini-imposti-in-ci.md`
severity: low
reason: L'AC2 della storia elenca solo React, @supabase/supabase-js, fetch e storage, e la config li impone come ERROR. Ma AD-3 (tempo come parametro) e AD-4 (nessun Math.random nel dominio) diventano vincoli meccanici necessari quando arriva la logica di scheduling/streak del dominio (Epic 3). Oggi il dominio non ha codice tempo/casualità, quindi la conseguenza è nulla: va imposto prima che quel codice esista.
status: open

### DW-2: Unreadable `deferred:` items in spec-1-5-lo-schema-nasce-versionato-e-isolato.md
origin: spec-deferred-malformed 2a994bdadeb8
location: n/a
source_spec: `spec-1-5-lo-schema-nasce-versionato-e-isolato.md`
severity: low
reason: The dev session recorded deferred findings the orchestrator could not parse, so they were NOT filed as entries: item 1: not a mapping (got str); item 2: not a mapping (got str). Read `spec-1-5-lo-schema-nasce-versionato-e-isolato.md`'s frontmatter and re-file them by hand.
status: open

### DW-3: Verifica live/e2e del signup contro il Supabase reale (account creato + atterra autenticato) differita per architettura.
origin: spec-deferred f78c505df789
location: src/data/authGateway.ts + storia 1.10 (delete-account)
source_spec: `spec-1-6-registrazione-con-email-e-password.md`
severity: low
reason: AD-13 fissa il teardown della suite alla stessa Edge Function delete-account (AD-11), costruita nella storia 1.10 e non ancora esistente; AD-12/13 vieta l'istanza locale. Creare utenti reali senza teardown inquinerebbe i dati dell'owner (metrica M1). Qui è verificata meccanicamente tutta la logica client (classificazione, traduttore unico, orchestrazione totale, commutazione di vista) con union chiuse e finti iniettati. Stesso schema del test RLS a runtime differito in 1.5.
status: closed
closed_note: Verificato dal vivo il 24-09-2026 sull'app deployata: registrazione con email nuova -> atterraggio autenticato sulla radice protetta (branding, tagline, Disconnetti), nessuna conferma via email ne' onboarding. Teardown eseguito con la Edge Function delete-account (AD-13): progetto lasciato a 0 utenti.

### DW-4: Precisione della mappa code Supabase -> reason da confermare con la verifica live (validation_failed -> invalid-email potenzialmente ampio).
origin: spec-deferred 9301bb639ee7
location: src/data/authGateway.ts (classifySignUpError)
source_spec: `spec-1-6-registrazione-con-email-e-password.md`
severity: low
reason: classifySignUpError mappa `validation_failed` a invalid-email (campo email). E' un codice generico che potrebbe scattare per ragioni diverse da un'email malformata, ancorando il messaggio al campo sbagliato. Il caso email-non-valida ha anche il codice specifico email_address_invalid (gia gestito). Nel peggiore dei casi l'utente vede un messaggio tradotto accanto all'email invece che a livello form: nessuna perdita di stringa grezza. Da confermare quando la e2e live (1.10) esercita i codici reali.
status: open

### DW-5: Il seam impuro dell'adattatore (createClient + client.auth.signUp) non ha un unit test diretto.
origin: spec-deferred b8608bc87a0b
location: src/data/authGateway.ts (createSupabaseAuthGateway)
source_spec: `spec-1-6-registrazione-con-email-e-password.md`
severity: low
reason: createSupabaseAuthGateway costruisce il proprio client via createClient, quindi non e' iniettabile senza un client reale. La compatibilita' di forma fra AuthResponse di auth-js e le interfacce strutturali locali e' pero' verificata da tsc (assegnabilita' a compile-time), e i parametri email/password sono vincolati dal tipo di signUp; il resto e' coperto dalla e2e live differita (1.10). E' un deferral acknowledged, non una svista.
status: closed
closed_note: Coperto dalla e2e live del 24-09-2026 come previsto: createSupabaseAuthGateway e' stato esercitato contro il Supabase reale in registrazione, accesso, accesso fallito e disconnessione, senza errori in console.

### DW-6: Verifica live/e2e di accesso, persistenza della sessione fra riavvii e disconnessione contro il Supabase reale, differita per architettura.
origin: spec-deferred e7c653fbd606
location: src/data/authGateway.ts + src/app/AuthRoot.tsx + storia 1.10 (delete-account)
source_spec: `spec-1-7-accesso-disconnessione-e-sessione-che-resiste.md`
severity: low
reason: Provare davvero «accedo → atterro autenticato» (AC1), «chiudo e riapro il browser → sono ancora autenticato» (AC3) e «mi disconnetto → un riavvio non ripristina» (AC4) richiede un account reale contro Supabase reale e il suo teardown; AD-13 fissa il teardown alla stessa Edge Function delete-account (AD-11), costruita nella storia 1.10 e non ancora esistente, e AD-12/13 vieta l'istanza locale. Creare utenti reali senza teardown inquinerebbe i dati dell'owner (metrica M1). Qui è verificata meccanicamente tutta la logica (orchestrazioni totali signIn/signOut, classificazione condivisa, mappa session→boolean, selezione modo→submit, resa bimodale, shell autenticata) con union chiuse e finti iniettati. Stesso schema del signup live differito in 1.6 e del test RLS a runtime differito in 1.5.
status: closed
closed_note: Verificato dal vivo il 24-09-2026. AC1 accesso -> radice protetta: confermato. AC2 password errata -> 'Wrong password.' ancorato al contenitore che ha l'input password e NON quello dell'email, identico anche per email inesistente (non rivela l'esistenza dell'account), nessuna stringa grezza di Supabase. AC4 disconnessione -> localStorage a 0 chiavi. AC3 persistenza: il token vive in localStorage (sessionStorage vuoto) e la reidratazione al boot e' confermata dal reload; il riavvio di processo NON e' stato eseguito perche' il demone del browser ricrea il profilo azzerando localStorage - limite dello strumento, non dell'app.

### DW-7: Verifica live/e2e del guard di rotta nel browser reale contro l'app deployata, differita per architettura.
origin: spec-deferred feaa14872271
location: src/app/routeGuards.tsx + src/app/AppRoutes.tsx + vercel.json + storia 1.10
source_spec: `spec-1-8-le-rotte-private-sono-private.md`
severity: low
reason: Provare AC1/AC3 end-to-end nel browser — un visitatore anonimo che apre un deep link a una rotta privata atterra sulla schermata di Accesso senza 404 (rewrite Vercel + <Navigate> in useEffect), e un utente autenticato che apre la radice raggiunge la rotta protetta — richiede l'app deployata e, per il caso autenticato, una sessione reale. renderToStaticMarkup (ambiente node) non esegue useEffect, quindi <Navigate> rende null in SSR: la DECISIONE del guard è coperta meccanicamente (routeGuards.test: type/to/replace) e il route-matching sincrono con MemoryRouter, ma la navigazione reale e il no-404 sui deep link no. Nessuna infrastruttura Playwright nello stack; il teardown e2e della sessione reale è AD-13/1.10 (delete-account), non ancora esistente. Stesso schema del deep-link live differito in 1.2 e della sessione live differita in 1.7.
status: closed
closed_note: Verificato dal vivo il 24-09-2026: /impostazioni, /dashboard e /statistiche/qualcosa rispondono tutti HTTP 200 (rewrite di vercel.json, nessun 404) e da anonimo vengono reindirizzati a /login dal guard; da autenticato la radice serve la rotta protetta.

### DW-8: Verifica live/e2e del cambio lingua a runtime nel browser reale contro l'app deployata (AC1), differita per architettura.
origin: spec-deferred 59aabf76be78
location: src/features/settings/SettingsScreen.tsx + src/features/settings/changeLocale.ts
source_spec: `spec-1-9-cambiare-lingua-senza-ricaricare.md`
severity: low
reason: Provare AC1 end-to-end — un click su un'opzione di lingua in Impostazioni commuta OGNI testo visibile senza ricaricare la pagina — richiede l'app deployata e la sessione reale. L'ambiente di test è node senza jsdom (renderToStaticMarkup non esegue eventi né effetti): il click→handler (onSelect→changeLocale) è glue d'effetto. Coperto meccanicamente: la decisione pura (changeLocale: changeLanguage+saveLocale, ordine, confine totale) e l'integrazione del singleton (await i18n.changeLanguage('it') poi render ⇒ markup 'it', non 'en'), più il selettore (aria-pressed). Nessuna infrastruttura Playwright nello stack; stesso schema del deep-link live differito in 1.2/1.8 e della sessione live differita in 1.7.
status: closed
closed_note: Verificato dal vivo il 24-09-2026 con prova diretta del 'senza ricaricare': piantato un marcatore su window prima del click, sopravvissuto dopo - la pagina non si e' ricaricata - e ogni testo visibile e' passato all'italiano.

### DW-9: Verifica live/e2e della persistenza (upsert reale su user_settings, RLS) e della continuità cross-device (AC2/AC3), differita per architettura.
origin: spec-deferred 020a72dd229b
location: src/data/settingsRepository.ts + src/app/AuthRoot.tsx + storia 1.5 (migrazione) + storia 1.10 (teardown)
source_spec: `spec-1-9-cambiare-lingua-senza-ricaricare.md`
severity: low
reason: Provare AC2 (upsert reale su user_settings.locale, onConflict sulla PK user_id, permesso da RLS) e AC3 (impostata la lingua su un dispositivo, accedendo da un altro la si ritrova) richiede l'app deployata, la migrazione user_settings APPLICATA (operator_actions della storia 1.5) e sessioni reali con teardown via l'Edge Function delete-account (AD-13/1.10, non ancora esistente). La glue di rehydrate al login (AuthRoot: loadLocale→resolveLocale→changeLanguage) è effetto, verificata live; coperto meccanicamente: l'adattatore per FORMA della chiamata (from('user_settings').upsert({user_id,locale}) con client finto) e la decisione pura resolveLocale. Non costruibile in sicurezza qui senza teardown né infrastruttura e2e.
status: closed
closed_note: Verificato dal vivo il 24-09-2026 contro il database reale: dopo la scelta, user_settings conteneva 1 riga con locale='it' (upsert attraverso RLS). Continuita' provata end-to-end: disconnessione, boot pulito in inglese, riaccesso -> interfaccia di nuovo in italiano, letta dal database e non dal browser.

### DW-10: Anello di focus visibile (focus-visible) mancante sugli elementi interattivi, lacuna di accessibilità app-wide preesistente.
origin: spec-deferred 65c548348d1c
location: src/features/settings/LanguageOptions.tsx + src/features/auth/AuthForm.tsx + src/app/AuthenticatedShell.tsx
source_spec: `spec-1-9-cambiare-lingua-senza-ricaricare.md`
severity: low
reason: I bottoni del selettore di lingua (come i bottoni di auth di 1.6/1.7 e il Disconnetti di 1.7) usano solo border-strong, senza un token/anello di focus visibile da tastiera. Non è introdotto da questa storia: è una lacuna trasversale a tutti gli interattivi dell'app. Di competenza dell'audit di accessibilità con screen reader reale della storia 7.6.
status: open

### DW-11: Verifica live end-to-end della cancellazione reale (AC1/AC2) e del riaccesso che fallisce (AC4), differita per architettura.
origin: spec-deferred 23198f3a6b85
location: src/features/account/DeleteAccountSection.tsx + supabase/functions/delete-account/index.ts + src/app/AuthRoot.tsx
source_spec: `spec-1-10-cancellare-l-account-per-davvero.md`
severity: low
reason: Provare AC1/AC2 (click su conferma ⇒ l'Edge Function cancella l'utente reale; user_settings si svuota per cascata su auth.users) e AC4 (riaccesso con le stesse credenziali fallisce) richiede la funzione delete-account DEPLOYATA sul progetto reale, l'app deployata e un account reale con teardown. L'ambiente di test è node senza jsdom (renderToStaticMarkup non esegue eventi né effetti): il click→handler (onConfirm→submitDeleteAccount) è glue d'effetto. Coperto meccanicamente: l'adapter per FORMA della chiamata (functions.invoke('delete-account') con client finto, ok/errore/ throw), l'orchestrazione pura (inoltro dell'esito, confine totale), la resa statica per fase (idle/confirming, pending, slot errore) e la struttura della funzione (getUser + admin.deleteUser + CORS via testo). Nessuna infrastruttura Playwright nello stack; stesso schema del live differito in 1.2/1.7/1.8/1.9.
status: closed
closed_note: Verificato dal vivo il 24-09-2026: la conferma dichiara la conseguenza ('distrugge tutti i tuoi dati di studio / le statistiche non sopravvivono / non si puo' annullare') in italiano e in inglese; confermando, la Edge Function ha cancellato l'utente reale e user_settings si e' svuotata per cascata (0 utenti, 0 righe); il riaccesso con le stesse credenziali fallisce e resta su /login.

### DW-12: Ispezione del bundle compilato (dist/) per confermare l'assenza della service_role (AC3), conferma dell'operatore.
origin: spec-deferred 73b66180bbe8
location: dist/ (artefatto di build) + src/service-role-confinement.test.ts
source_spec: `spec-1-10-cancellare-l-account-per-davvero.md`
severity: low
reason: Il gate meccanico (src/service-role-confinement.test.ts) prova che nessun file di codice in src/** contiene service_role/SERVICE_ROLE, che .env.example non dichiara alcuna VITE_* di service-role, e per anti-vacuità che la funzione server la usa davvero. La conferma finale dell'AC3 è l'ispezione dell'artefatto dist/ dopo `npm run build`: un controllo dell'operatore sull'output reale del build, fuori dal toolchain dei test (che non ispeziona dist/). Verificato in locale a supporto: la grep di dist/ dopo il build non trova occorrenze; resta la conferma formale dell'operatore sull'artefatto deployato.
status: closed
closed_note: Verificato il 24-09-2026 sull'artefatto DEPLOYATO, piu' forte di quanto chiedesse la voce: scaricato /assets/index-BSh92cvL.js dalla produzione (538 KB), 0 occorrenze di service_role / SERVICE_ROLE.

### DW-13: Sblocco delle e2e live differite di 1.6/1.7/1.8/1.9 (DW-3/6/7/8/9): ora esiste il teardown via delete-account (AD-13).
origin: spec-deferred e60399932eba
location: supabase/functions/delete-account/index.ts + suite e2e (non ancora esistente)
source_spec: `spec-1-10-cancellare-l-account-per-davvero.md`
severity: low
reason: Le verifiche live di 1.6 (registrazione reale), 1.7 (accesso/sessione), 1.8 (rotte private), 1.9 (persistenza/continuità cross-device) erano differite anche perché mancava un teardown sicuro fra la suite e i dati reali (AD-13). La funzione delete-account, ora costruita e deployata al merge, è quel teardown: email univoca per run + cancellazione via la stessa funzione. La costruzione dell'infrastruttura e2e (Playwright, account effimeri, teardown) non è nello scope di questa storia né nello stack attuale; resta lavoro di una storia/epica di QA dedicata (cfr. 7-x).
status: open

### DW-14: Wiring di accessibilità della conferma distruttiva (aria-expanded sul grilletto, gestione del focus alla transizione di fase, annuncio live del cambio di stato), differito all'audit screen-reader di E
origin: spec-deferred 882da5df26da
location: src/features/account/DeleteAccountConfirm.tsx + src/features/account/DeleteAccountSection.tsx
source_spec: `spec-1-10-cancellare-l-account-per-davvero.md`
severity: low
reason: La conferma a due passi soddisfa AC1 col testo di conseguenza VISIBILE e lo slot d'errore in role="alert". Manca però il wiring a11y più fine: nessun aria-expanded sul grilletto, nessuno spostamento del focus verso la conseguenza/conferma quando si entra in `confirming` né ritorno al grilletto su annulla, e il cambio di fase non è annunciato via live region. È la stessa classe di lacuna a11y trasversale agli interattivi già differita app-wide in DW-10 (anello di focus visibile su auth/settings): di competenza dell'audit con screen reader reale della storia 7.6, non introdotta da questa storia in modo isolato. Il flusso interattivo è comunque glue d'effetto non eseguibile in node (nessun jsdom).
status: open

### DW-15: Il cancello non valida i confini dello span di select-span (answer.end ≤ numero di segmenti reali della frase).
origin: spec-deferred 33aca6e55040
location: src/domain/content-validation.ts / scripts/validate-content.ts
source_spec: `spec-2-6-la-validazione-blocca-il-merge.md`
severity: medium
reason: exercise.ts flagga questo come «controllo di CONTENUTO in 2.6 (richiede la segmentazione)», ma la segmentazione è alignFurigana() in src/domain/furigana.ts, consegnata in Epic 3 (storia 3.6, AD-21): non esiste ancora. Oggi lo schema accetta solo end > start ≥ 0, quindi un answer.end che eccede i segmenti reali passa il cancello. Da agganciare a questo stesso cancello quando furigana.ts esisterà.
status: open

### DW-16: Il cancello verifica la coerenza kanji/kana solo a livello di carattere (nessun Han in kana), non la piena allineabilità.
origin: spec-deferred 535368285cb7
location: src/domain/content-validation.ts
source_spec: `spec-2-6-la-validazione-blocca-il-merge.md`
severity: medium
reason: AD-25 lega «coerenza kanji/kana» ad AD-21 («richiede che siano allineabili»). La verifica che alignFurigana() produca segmenti validi per la coppia (kanji, kana) richiede quella funzione, che è Epic 3 (storia 3.6). Il controllo attuale (no Han in kana) è la condizione necessaria implementabile ora; l'allineabilità piena resta da agganciare al cancello quando furigana.ts esisterà.
status: open

### DW-17: Il cancello non verifica che la answer di single-select non compaia anche fra i distractors.
origin: spec-deferred 96a981eea1bf
location: src/domain/content-validation.ts
source_spec: `spec-2-6-la-validazione-blocca-il-merge.md`
severity: low
reason: Un esercizio con answer presente anche nei distractors ha due opzioni corrette: è di fatto irrisolvibile. Lo schema non lo esprime e l'intento di 2.6 non lo elenca fra i controlli, ma è un difetto di contenuto che un cancello di validazione dovrebbe cogliere. Candidato controllo di integrità intra-esercizio futuro.
status: open

### DW-18: Lo span di select-span {start:0,end:1} della lezione campione va verificato/aggiustato contro alignFurigana() quando esisterà (Epic 3, storia 3.6).
origin: spec-deferred da13c0765981
location: content/lessons/01-la-particella-wo.json (exercises.2.answer)
source_spec: `spec-2-7-la-lezione-campione-che-è-anche-una-fixture.md`
severity: medium
reason: Lo span indicizza i SEGMENTI di alignFurigana(), che non esiste ancora (solo commenti in exercise.ts/content-validation.ts). Il cancello di 2.6 accetta solo end>start≥0 (segmentSpan, exercise.ts:113-120), quindi non può confermare che il segmento 0 sia davvero 果物. Lo span è autorato assumendo che il jukujikun 果物 (letto くだもの come unità) sia il primo segmento; da riconfermare in 3.6. Si aggancia al deferred già registrato in 2.6 sui confini dello span.
status: open

### DW-19: La conferma sul rendering reale dei valori di sentence-hero (UX-DR8: 32/26px, interlinea 1.9) sulla frase più lunga di questa lezione è dovuta alla storia 3.23.
origin: spec-deferred f02418f1e776
location: src/ui/theme.css (token --text-sentence-hero, da definire in 3.23)
source_spec: `spec-2-7-la-lezione-campione-che-è-anche-una-fixture.md`
severity: medium
reason: UX-DR8 fissa i valori ma epics.md e la storia 3.23 dicono che la verifica sul rendering «si chiude nella storia 3.23»; 1.3 àncora con design-tokens.test.ts l'ASSENZA del token --text-sentence-hero oggi (definirlo ora romperebbe quel test). 2.7 fornisce SOLO la frase più lunga (l'assemble, 25 caratteri) come input di stress; il rendering richiede la UI di presentazione dell'esercizio (Epic 3).
status: open

### DW-20: La rigenerazione del seed crea un nuovo file di migrazione timestamp-ato a ogni esecuzione senza rimuovere o consolidare i seed precedenti, che si accumulano ed eseguono tutti a ogni `db push`.
origin: spec-deferred 8bdd787c863e
location: scripts/generate-content-seed.ts (chooseSeedTimestamp / main writeFile)
source_spec: `spec-3-7-il-contenuto-raggiunge-il-client-e-può-essere-aggiornato.md`
severity: medium
reason: `chooseSeedTimestamp` conta di proposito i seed precedenti come «più recenti» e `main` scrive sempre `<timestamp>_seed_content.sql`; nulla fa prune/overwrite del seed precedente. Lo stato finale del DB resta corretto (upsert idempotente, last-write-wins), ma i file di seed orfani si accumulano nella cartella migrazioni. Serve una politica di consolidamento/prune del seed (fuori dallo scope catturato di 3.7).
status: open

### DW-21: Prova RLS a runtime (AC5, seconda clausola): dimostrare esplicitamente, per ciascuna delle tre tabelle, che l'utente A non legge né scrive le righe di B MENTRE entrambi gli account sono vivi; più il c
origin: spec-deferred 170ff712160a
location: supabase/migrations/*_create_review_and_progress.sql + src/migrations.test.ts
source_spec: `spec-3-8-il-progresso-è-per-utente-e-resta-per-utente.md`
severity: medium
reason: La prova a runtime richiede le migrazioni APPLICATE al progetto reale (solo al merge su main, AD-12/AD-13), due account reali con email univoca per run e teardown via l'Edge Function delete-account (AD-11/AD-13). Il progetto vieta l'istanza Supabase locale e non ha ancora infrastruttura Playwright. Ciò che questa storia verifica meccanicamente OFFLINE (pg-query-emscripten): RLS abilitata su tutte e tre le tabelle, le policy owner-scoped (4/4/2), la cascata su auth.users e l'assenza di policy update/delete su review_log — la condizione strutturale NECESSARIA, non l'effetto osservato a query time. ATTENZIONE all'instradamento: l'isolamento A↔B a runtime è NFR5 e appartiene alla suite e2e (Playwright) introdotta in Epic 7 (storia 7.4). NON è la 7.5, i cui AC riguardano il teardown dopo cancellazione account (assenza di righe per tabella), una proprietà diversa. Oggi né 7.4 né 7.5 dichiarano un AC esplicito «A legge/scrive le righe di B ⇒ fallisce, per ciascuna tabella»: questa obbligazion
status: open

### DW-22: Prova RUNTIME dell'idempotenza (AC3, comportamento osservato): riapplicare lo stesso review_id due volte NON deve produrre una seconda riga di log né un secondo avanzamento di stadio/contatore, esegui
origin: spec-deferred ea5e7d8717a9
location: supabase/migrations/*_create_apply_review.sql + src/migrations.test.ts
source_spec: `spec-3-9-una-risposta-una-chiamata-nessun-doppione.md`
severity: low
reason: pg-query-emscripten PARSA soltanto il SQL: non esegue la funzione, quindi non può osservare l'effetto di una seconda chiamata. Questa storia verifica OFFLINE la condizione STRUTTURALE necessaria — firma esatta, INSERT con ON CONFLICT (id) DO NOTHING su review_log, UPDATE di review_state guardato dal risultato dell'INSERT (from logged), assenza di logica di scheduling — non l'effetto a query-time. La prova a runtime è GIÀ POSSEDUTA da Epic 4, storia 4.5 ("Riapplicare la coda non falsa niente"), i cui AC dichiarano esplicitamente «drenata due volte ⇒ review_log senza duplicati» e «stesso review_id due volte ⇒ lo stadio non avanza una seconda volta». Nessun orfano: non serve aggiungere l'obbligazione altrove. Stesso schema del differimento a runtime di 3.8.
status: open

### DW-23: La dashboard non ha uno stato d'errore: se una lettura del read-model (listDue/listReviewLog/listUnlockedLessonIds/listLessons) fallisce, la query resta senza `data` e la dashboard mostra lo scheletro
origin: spec-deferred 4cc8926dc39b
location: src/features/dashboard/DashboardScreen.tsx
source_spec: `spec-3-12-la-pila-con-un-numero-e-un-pulsante.md`
severity: medium
reason: `DashboardScreen` decide lo scheletro solo su `data === undefined` e non legge mai `isError`/`error`; con `retry: false` un `DataError` da porta non ripiega. L'intento di 3.12 (AC1-4: dashboard popolata + caricamento + microcopy) non copre il percorso d'errore, e l'epica sequenzia gli stati non-felici della dashboard a 3.15/3.16 — quindi è un vuoto reale ma non di questa storia. Va affrontato in modo trasversale (con gli stati vuoti o una storia dedicata allo stato d'errore del read-model).
status: open

### DW-24: Lo sblocco fallito è silenzioso: `unlockMutation` ha solo `onSuccess`, nessun `onError`; se `progress.unlockLesson` rigetta (DataError da RLS/rete) il pulsante si riabilita senza alcun messaggio né ri
origin: spec-deferred f059d59434d2
location: src/features/dashboard/DashboardScreen.tsx
source_spec: `spec-3-13-sbloccare-la-lezione-successiva.md`
severity: medium
reason: `DashboardScreen.tsx` definisce `useMutation({ mutationFn, onSuccess })` senza `onError`; la dashboard non ha alcuna superficie d'errore (stesso vuoto della lettura, già tracciato in DW-23). L'intento di 3.13 copre solo il percorso felice dello sblocco (AC1-4); l'epica sequenzia gli stati non-felici della dashboard a 3.15/3.16. Reale ma non richiesto da questa storia: va affrontato con gli stati vuoti/d'errore (3.15/3.16 o la storia dedicata di DW-23).
status: open

### DW-25: unlockMutation non ha onError: un fallimento di progress.unlockLesson non produce alcuna superficie d'errore sulla dashboard (pulsante di sblocco 3.13 e pulsante di inizio 3.15).
origin: spec-deferred 42eb6e26bd58
location: src/features/dashboard/DashboardScreen.tsx:78-85,149-158
source_spec: `spec-3-15-la-prima-volta-non-somiglia-alla-fine.md`
severity: medium
reason: Su fallimento della RPC la mutation va in errore, isPending torna false e il pulsante si ri-abilita SENZA feedback all'utente. Gap PRE-ESISTENTE: il call-site di 3.13 (unlockAction, DashboardScreen.tsx:179-189) ha lo stesso onSuccess-senza-onError; 3.15 aggiunge un secondo trigger allo stesso unlockMutation condiviso. Fuori dall'intento di 3.15 (stato di primo avvio) e non banalmente correggibile: serve una scelta di superficie/copy d'errore condivisa dai due pulsanti (nuova chiave i18n + pattern di error-state).
status: open

### DW-26: SessionScreen (come la dashboard) non gestisce lo stato d'errore del read-model: se dueQ/exercisesQ falliscono (DataError da porta, retry:false) la query resta senza data e la schermata mostra lo sche
origin: spec-deferred 5dcb92a20976
location: src/features/study/SessionScreen.tsx:65,90
source_spec: `spec-3-18-un-esercizio-per-volta-con-la-sua-consegna.md`
severity: medium
reason: Entrambe le query decidono lo scheletro solo su `data === undefined`, mai su `isError`/`error`. Stessa lacuna trasversale già tracciata in DW-23/DW-24/DW-25 per la dashboard; l'intento di 3.18 (AC1-4) non copre il percorso d'errore. Va affrontato con la storia dedicata allo stato d'errore del read-model.
status: open

### DW-27: Le opzioni di risposta sono rese come <button aria-pressed> indipendenti senza semantica di scelta singola (radiogroup/radio), senza nome accessibile del gruppo, e senza associazione programmatica fra
origin: spec-deferred 3a82d42dd0b2
location: src/features/study/ExerciseCard.tsx:71-85
source_spec: `spec-3-18-un-esercizio-per-volta-con-la-sua-consegna.md`
severity: medium
reason: ExerciseCard rende un <ul> di <button aria-pressed>. AC3 di 3.18 (nessun colore-solo, etichetta+posizione, >=56px) e' soddisfatto, ma il contratto a11y di sessione (ordine di tabulazione, tasto numerico -> opzione, associazione numero<->posizione) e' un aggiornamento di AD-15 esplicitamente di competenza di 3.22 (L'intera sessione senza mouse); l'anello di focus visibile e' gia' DW-10, di competenza dell'audit screen-reader 7.6.
status: open

### DW-28: La card presenta le opzioni come scelta a tap-singolo che blocca; per assemble (ordinamento) e select-span (span) non compone una risposta valida, e per assemble mostra la frase-bersaglio completa sop
origin: spec-deferred 89a97a09a509
location: src/features/study/ExerciseCard.tsx; src/features/study/SessionScreen.tsx
source_spec: `spec-3-18-un-esercizio-per-volta-con-la-sua-consegna.md`
severity: medium
reason: `selected` e' un singolo indice/opzione: modella single-select. La composizione per-tipo (ordinamento delle tessere, span sui segmenti) e la valutazione dell'esito sono 3.19 (Rispondere, e sapere perche'), dove la risposta e' effettivamente costruita e misurata; li' va anche deciso se assemble mostra la frase-bersaglio (in 3.18 non c'e' esito, quindi nessuna misura da falsare).
status: open

### DW-29: Lo store di sessione (singleton di modulo) non viene resettato alla ri-entrata in /studia: alla seconda visita il guard salta `start`, mostrando la coda stale invece della pila fresca.
origin: spec-deferred 11ea48734aa9
location: src/features/study/SessionScreen.tsx (effetto di start della sessione)
source_spec: `spec-3-19-rispondere-e-sapere-perché.md`
severity: medium
reason: `SessionScreen` avvia lo store con un effetto guardato su `initialIds.length === 0`; il singleton conserva `initialIds`/`total` fra visite e cambi utente. La ricostruzione all'ingresso ("la sessione si ricostruisce, non si ripristina", nessun "riprendi dove eri") è esplicitamente la storia 3.20, che deve resettare/ricostruire lo store all'ingresso in /studia.
status: open

### DW-30: A metà sessione, se `currentState` non è nella cache `['due']` (divergenza coda/pila da refetch onSettled o multi-device), la guardia difensiva lascia la card bloccata (opzioni piazzate, mai risposta,
origin: spec-deferred 3b80cf02691f
location: src/features/study/SessionScreen.tsx (onSelect, guardia currentState)
source_spec: `spec-3-19-rispondere-e-sapere-perché.md`
severity: low
reason: `onSelect` fa `if (currentState === undefined) return;` dopo `setSelected(next)`: la selezione resta popolata ma `answered` non passa mai a true. Irraggiungibile nell'happy path (coda ⊆ pila per costruzione); emerge solo con mutazione esterna della pila. Si sovrappone allo stato d'errore/refetch del read-model già differito (3.18 deferred #1); va risolto con una strategia di skip/ricostruzione.
status: open

### DW-31: Sulla schermata di completamento, se la query dello streak (`['streak', userId]` → `listReviewLog()`) va in errore, `streakLogQ.data` resta undefined e il placeholder grigio resta indefinitamente, sen
origin: spec-deferred a33e069019c2
location: src/features/study/SessionScreen.tsx:247-255
source_spec: `spec-3-21-arrivare-a-zero.md`
severity: medium
reason: Il ramo di completamento rende la riga streak solo se `streakLogQ.data !== undefined`, altrimenti il placeholder `bg-surface-sunken`. Su reject di `listReviewLog` i dati restano undefined ⇒ placeholder permanente. È il MEDESIMO pattern della dashboard (gate su `logQ.data === undefined` ⇒ scheletro anche in errore): gap PRE-ESISTENTE app-wide sugli stati d'errore dei read-model (cfr. deferred #1 di 3.18), non introdotto da 3.21. Il contenuto primario (conferma + dismiss) resta comunque reso e l'uscita funziona.
status: open
