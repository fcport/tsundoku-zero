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
status: open

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
status: open

### DW-6: Verifica live/e2e di accesso, persistenza della sessione fra riavvii e disconnessione contro il Supabase reale, differita per architettura.
origin: spec-deferred e7c653fbd606
location: src/data/authGateway.ts + src/app/AuthRoot.tsx + storia 1.10 (delete-account)
source_spec: `spec-1-7-accesso-disconnessione-e-sessione-che-resiste.md`
severity: low
reason: Provare davvero «accedo → atterro autenticato» (AC1), «chiudo e riapro il browser → sono ancora autenticato» (AC3) e «mi disconnetto → un riavvio non ripristina» (AC4) richiede un account reale contro Supabase reale e il suo teardown; AD-13 fissa il teardown alla stessa Edge Function delete-account (AD-11), costruita nella storia 1.10 e non ancora esistente, e AD-12/13 vieta l'istanza locale. Creare utenti reali senza teardown inquinerebbe i dati dell'owner (metrica M1). Qui è verificata meccanicamente tutta la logica (orchestrazioni totali signIn/signOut, classificazione condivisa, mappa session→boolean, selezione modo→submit, resa bimodale, shell autenticata) con union chiuse e finti iniettati. Stesso schema del signup live differito in 1.6 e del test RLS a runtime differito in 1.5.
status: open

### DW-7: Verifica live/e2e del guard di rotta nel browser reale contro l'app deployata, differita per architettura.
origin: spec-deferred feaa14872271
location: src/app/routeGuards.tsx + src/app/AppRoutes.tsx + vercel.json + storia 1.10
source_spec: `spec-1-8-le-rotte-private-sono-private.md`
severity: low
reason: Provare AC1/AC3 end-to-end nel browser — un visitatore anonimo che apre un deep link a una rotta privata atterra sulla schermata di Accesso senza 404 (rewrite Vercel + <Navigate> in useEffect), e un utente autenticato che apre la radice raggiunge la rotta protetta — richiede l'app deployata e, per il caso autenticato, una sessione reale. renderToStaticMarkup (ambiente node) non esegue useEffect, quindi <Navigate> rende null in SSR: la DECISIONE del guard è coperta meccanicamente (routeGuards.test: type/to/replace) e il route-matching sincrono con MemoryRouter, ma la navigazione reale e il no-404 sui deep link no. Nessuna infrastruttura Playwright nello stack; il teardown e2e della sessione reale è AD-13/1.10 (delete-account), non ancora esistente. Stesso schema del deep-link live differito in 1.2 e della sessione live differita in 1.7.
status: open
