---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-tsundoku-zero-2026-08-19/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-tsundoku-zero-2026-08-19/addendum.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-08-19/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-tsundoku-zero-2026-08-19/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-tsundoku-zero-2026-08-19/EXPERIENCE.md'
---

# tsundoku-zero - Epic Breakdown

## Overview

Questo documento fornisce la scomposizione completa in epiche e storie per **tsundoku-zero**, traducendo i requisiti del PRD, del contratto UX e dell'Architecture Spine in storie implementabili.

**Documenti esclusi deliberatamente:** `product-brief-tsundoku-zero.md` (identico a `tsundoku-zero-brief.md` nella radice) è l'input da cui PRD e Addendum derivano, ed è **superato** da essi. Includerlo reintrodurrebbe requisiti che il PRD ha riformulato — in particolare il funzionamento senza rete, che il brief metteva fuori scope e che il PRD `§8` ha portato dentro come `F9`.

## Requirements Inventory

### Functional Requirements

**F1 — Account e identità**

- FR1.1: L'utente può registrarsi con email e password.
- FR1.2: L'utente può accedere e disconnettersi.
- FR1.3: La sessione persiste fra riavvii del browser fino a disconnessione esplicita.
- FR1.4: L'utente può cancellare definitivamente il proprio account; la cancellazione rimuove **tutti** i suoi dati di revisione.
- FR1.5: Il sistema comunica in modo comprensibile i fallimenti prevedibili: password errata, email già registrata, password troppo debole, email in formato non valido.
- FR1.6: Le rotte che espongono dati dell'utente sono raggiungibili solo da utenti autenticati; un accesso non autenticato viene reindirizzato al login.

**F2 — Dataset del vocabolario**

- FR2.1: Il sistema distribuisce un dataset N5 fisso, in sola lettura per gli utenti.
- FR2.2: Ogni item espone kanji (opzionale), kana, romaji, significato inglese, significato italiano, livello JLPT, categoria grammaticale.
- FR2.3: Il dataset può essere aggiornato o ricaricato senza toccare la cronologia di apprendimento di nessun utente.

**F3 — La pila (dashboard)**

- FR3.1: La dashboard mostra quanti item sono dovuti in questo momento.
- FR3.2: La dashboard mostra lo streak corrente.
- FR3.3: La dashboard espone **una sola** azione primaria per iniziare a studiare.
- FR3.4: Quando la pila è vuota l'azione primaria diventa introdurre nuovi item; se anche il dataset è esaurito, la dashboard lo dichiara esplicitamente.
- FR3.5: Quando l'utente non ha **mai** studiato alcun item, la dashboard presenta uno stato di primo avvio **distinto** da quello di pila svuotata. Stesso stato tecnico, significati opposti: *comincia* contro *hai finito*. Da questo stato dipende `M4`.

**F4 — Sessione di studio**

- FR4.1: Gli item sono presentati uno alla volta.
- FR4.2: Viene mostrato il prompt; l'utente rivela la risposta con un'azione esplicita.
- FR4.3: L'utente si autovaluta su quattro esiti: `again`, `hard`, `good`, `easy`.
- FR4.4: La sessione termina quando la pila raggiunge zero, con una schermata di completamento che conferma il risultato.
- FR4.5: Durante la sessione è sempre visibile quanto manca alla fine.
- FR4.6: L'utente può abbandonare la sessione in qualsiasi momento; le valutazioni già date restano acquisite.
- FR4.7: L'utente può avviare una nuova sessione sugli item ancora dovuti in qualsiasi momento successivo, senza penalità e senza ricominciare da capo.

**F5 — Scheduling**

- FR5.1: Valutare un item aggiorna la sua data di prossima revisione secondo l'algoritmo di scheduling.
- FR5.2: Semantica degli esiti: `again` riporta allo stadio iniziale e incrementa il contatore di ricadute; `good` avanza di uno stadio; `easy` avanza di due; `hard` mantiene lo stadio e riprogramma a intervallo ridotto.
- FR5.3: Gli stadi saturano ai due estremi: mai sotto lo stadio iniziale, mai sopra il massimo.
- FR5.4: Un intervallo pari a zero significa "di nuovo in questa sessione": l'item torna in fondo alla coda corrente.
- FR5.5: Le date di scadenza ricevono una dispersione deterministica, così che la pila non arrivi a grappoli.
- FR5.6: Ogni revisione viene registrata in un log append-only che alimenta le statistiche.

**F6 — Nuovi item**

- FR6.1: Quando la pila dovuta è vuota, l'utente può introdurre item mai visti.
- FR6.2: L'introduzione è limitata da un tetto giornaliero configurabile, predefinito 10.
- FR6.3: La selezione degli item da introdurre è deterministica e ripetibile.
- FR6.4: L'utente può modificare il tetto giornaliero da un'impostazione.

**F7 — Statistiche e streak**

- FR7.1: Una vista statistiche mostra le revisioni nel tempo.
- FR7.2: La stessa vista mostra la distribuzione degli item per stadio di scheduling.
- FR7.3: La stessa vista mostra gli item sbagliati più di frequente.
- FR7.4: Una giornata conta ai fini dello streak quando l'utente porta la pila a zero, oppure completa almeno una revisione se la pila era già vuota. La giornata termina a mezzanotte nel fuso orario locale del dispositivo.
- FR7.5: Con dati insufficienti la vista dichiara cosa manca, invece di mostrare grafici vuoti.

**F8 — Lingua**

- FR8.1: L'interfaccia è disponibile in inglese e italiano.
- FR8.2: La lingua è commutabile a runtime, senza ricaricare la pagina.
- FR8.3: La scelta è persistita per utente e vale su tutti i suoi dispositivi.
- FR8.4: Nessuna stringa visibile all'utente è cablata nel codice.

**F9 — Resilienza di rete**

- FR9.1: All'avvio della sessione, l'intera pila dovuta viene caricata in memoria.
- FR9.2: Le valutazioni date senza rete vengono accodate localmente.
- FR9.3: Al ritorno della rete la coda viene sincronizzata automaticamente, senza intervento dell'utente.
- FR9.4: Uno stato di sincronizzazione in sospeso è visibile ma non invasivo.
- FR9.5: Se l'applicazione viene chiusa con valutazioni non sincronizzate, la coda viene recuperata alla riapertura.
- FR9.6: La sincronizzazione è idempotente: riapplicare la stessa coda non produce revisioni duplicate.

**F10 — Trasparenza e licenza**

- FR10.1: Una pagina di privacy policy dichiara quali dati sono memorizzati e come cancellarli.
- FR10.2: L'applicazione attribuisce la fonte del dataset **su ogni schermata che ne mostra le voci** — dashboard, sessione di studio, statistiche. Una pagina "About" non è sufficiente.

**Totale: 48 requisiti funzionali.** `FR3.5` è stato aggiunto al PRD dopo il contratto UX, che ne ha rilevato l'assenza: era l'unico stato della dashboard non descritto, ed è quello da cui dipende `M4`.

### NonFunctional Requirements

- NFR1 — **Sicurezza dei tipi.** TypeScript in modalità strict. Nessun `any` nel codice applicativo.
- NFR2 — **Purezza dello scheduling.** Il motore è un insieme di funzioni pure senza dipendenze da UI, rete, orologio di sistema o database. L'istante corrente e il fuso orario sono sempre iniettati come parametri.
- NFR3 — **Copertura di test.** Motore di scheduling testato a fondo, casi limite inclusi. Almeno il flusso di studio ha test di componente. Un test end-to-end copre registrazione → studio → pila a zero.
- NFR4 — **Accessibilità.** Schermata di studio interamente operabile da tastiera (spazio rivela, tasti numerici valutano). Ruoli e stati ARIA corretti. Rivelazione e avanzamento annunciati via live region. Contenuto giapponese marcato con l'attributo di lingua corretto.
- NFR5 — **Isolamento dei dati.** Ogni tabella con dati per-utente applica isolamento a livello di riga. Verificato da un test esplicito, non assunto.
- NFR6 — **Privacy.** Memorizzati solo email, hash della password e dati di studio. Nessuna data di nascita, nessun nome, nessuna analitica sul singolo individuo.
- NFR7 — **Prestazioni percepite.** La schermata di studio risponde alla valutazione senza attesa visibile. Aggiornamenti ottimistici, persistenza in background.
- NFR8 — **Licenza e attribuzione.** Licenza del codice e licenza dei dati dichiarate separatamente e rispettate entrambe.

### Additional Requirements

Dall'Architecture Spine. Ogni voce è un invariante citabile per ID e vincola le storie.

**⚠️ Nessun starter template.** L'Architecture Spine **non** specifica un template greenfield: nomina Vite 8.2.1 e React 19.2.8 come componenti dello Stack, non uno scaffold da clonare. La prima storia di Epic 1 è quindi uno **scaffold manuale**, non un `degit`/`create-*`. Va detto esplicitamente perché è la deviazione più comune.

**Struttura e confini**

- `AD-1` — Nucleo di dominio puro, dipendenze a senso unico. `src/domain/` non importa React, Supabase, `fetch`, storage o orologio. Imposto da `eslint-plugin-boundaries`: una violazione è CI rossa. `dependency-cruiser` genera `docs/dependency-graph.svg` a ogni build.
- `AD-2` — Le porte sono dichiarate dal dominio in `src/domain/ports/` (`VocabularyRepository`, `ReviewRepository`, `SettingsRepository`, `Clock`). Solo `src/data/` le implementa ed è l'unica cartella che può importare `@supabase/supabase-js`.
- `AD-20` — Vincolo di dimostrabilità: nessuna storia può rimuovere una voce dello Stack per semplificare. Rimuovere una dipendenza richiede decisione esplicita dell'owner registrata nel memlog.
- Cinque livelli: `domain` → `data` → `ui` → `features` → `app` (composition root). `features` **non** importa `data`.

**Tempo e determinismo**

- `AD-3` — Il tempo è un parametro, mai un ambiente. Ogni funzione di dominio che dipende dal tempo riceve `now: Date` **e** `timeZone: string`. Vietati `Date.now()`, `new Date()` senza argomenti e `Intl.DateTimeFormat().resolvedOptions()` sotto `src/domain/`.
- `AD-4` — Determinismo senza casualità. Dispersione delle scadenze e selezione dei nuovi item sono funzioni pure di input espliciti. Nessun `Math.random()` sotto `src/domain/`, imposto da lint.
- `AD-17` — La scala degli stadi è una sola costante esportata da `src/domain/schedule.ts`: stadi `0`–`5`, intervalli `0, 1, 3, 7, 16, 35` giorni. Il `CHECK` SQL e l'asse di `FR7.2` derivano da lì.

**Dati e persistenza**

- `AD-5` — Una sola definizione di "dovuto". `isDue(state, now)` è pura in `src/domain/`. Dashboard, precarico di sessione e cancello dei nuovi item leggono la **stessa chiave** TanStack `['due', userId]`.
- `AD-7` — Una valutazione è una sola chiamata, transazionale e idempotente. Il dominio calcola il nuovo stato **sul client, nell'istante in cui l'utente valuta**. Una sola RPC `apply_review(review_id, vocabulary_id, outcome, stage, due_at, reviewed_at)` con `ON CONFLICT (review_id) DO NOTHING`, aggiorna `review_state` solo se l'insert ha prodotto una riga. Nessuna logica di scheduling in SQL.
- `AD-9` — Identità del vocabolario derivata dal contenuto: `vocabulary.id = uuidv5(natural_key, NAMESPACE)` con `natural_key = "kana|kanji|meaning_en"` normalizzata (NFKC, trim, minuscole sull'inglese). Seed via upsert su `id`. Un `TRUNCATE` + riseed deve produrre id identici, e un test lo verifica.
- `AD-10` — RLS su `review_state`, `review_log`, `user_settings` con policy `user_id = auth.uid()` su select/insert/update/delete. `vocabulary` con RLS abilitata, sola lettura, **nessuna** policy di scrittura. Test di integrazione: l'utente A non legge le righe di B.
- `AD-12` — Migrazioni versionate in `supabase/migrations/`. Nessuna modifica dallo Studio Supabase. Staging e produzione ricevono le stesse migrazioni dalla stessa pipeline.
- `AD-18` — Le statistiche derivano **solo** da `review_log`. `review_count` e `lapse_count` in `review_state` non sono mai fonte per una statistica. Lo streak è sempre derivato dal log, mai memorizzato in colonna.
- `AD-19` — Introdurre un item lo materializza subito: riga `review_state` con `stage = 0` e `due_at` = istante di introduzione. "Mai visto" significa **assenza di riga**.

**Stato e resilienza**

- `AD-6` — Zustand ospita, il dominio decide. Lo store di sessione delega a `sessionReducer()` in `src/domain/`. Lo store **non** è persistito.
- `AD-8` — La coda offline è TanStack Query con quattro vincoli: (1) `mutationFn` registrata al bootstrap con `setMutationDefaults(['review'], …)` in `src/app/`, mai in un componente; (2) ogni mutation porta `scope: { id: 'review-sync' }` così la coda si drena in serie; (3) persister su IndexedDB con `throttleTime ≤ 250 ms`; (4) `resumePausedMutations()` all'avvio e al ritorno online, indicatore derivato da `useMutationState`.

**Sicurezza, ambienti, licenza**

- `AD-11` — La cancellazione account passa da una Edge Function `delete-account` autenticata che usa la `service_role` per `auth.admin.deleteUser`. La `service_role` non compare mai in codice client né in variabili `VITE_*`. È l'**unico** codice server del progetto.
- `AD-13` — I test e2e non condividono dati: ogni run crea utenti con email univoca e li rimuove tramite la stessa Edge Function. Nessuna fixture condivisa.
- `AD-16` — Attribuzione del dataset su ogni schermata che mostra voci. `LICENSE` (MIT, codice) e `LICENSE-DATA` (CC BY-SA 4.0, dataset) sono file separati e dichiarati nel README.
- `AD-14` — Nessuna stringa visibile cablata. Chiavi tipizzate via declaration merging su `CustomTypeOptions` di i18next: una chiave inesistente è errore di compilazione. Il giapponese **non** passa da i18n.
- `AD-15` — L'accessibilità della sessione è un contratto: spazio rivela, `1`–`4` valutano nell'ordine `again`/`hard`/`good`/`easy`. Una sola live region `aria-live="polite"` per sessione. Un test di componente guida una sessione completa da sola tastiera.

**Vincoli di stack e ambiente**

- TypeScript resta su **5.9.3**, non 7.0.2: TS 7 non espone API programmatica stabile, `typescript-eslint` ha chiuso il supporto come *not planned*, e senza ESLint non esiste la regola meccanica di `AD-1`.
- `npm` con `package-lock.json` versionato. La CI usa `npm ci`, mai `npm install`.
- Configurazione solo da `import.meta.env.VITE_*`, validata con uno schema all'avvio in `src/app/`.
- Due progetti Supabase (produzione e staging). Nessun keep-alive contro la pausa a 7 giorni del piano gratuito: comportamento accettato e dichiarato.
- Nessun SDK di analitica o error tracking di terze parti (`NFR6`).
- Catena di deploy: PR → lint/typecheck/unit → migrazioni su staging → Playwright e2e su staging → Netlify preview → merge → migrazioni produzione → Netlify produzione.

### UX Design Requirements

Dal contratto UX (`DESIGN.md` + `EXPERIENCE.md`, entrambi `status: final`). Ogni voce è abbastanza specifica da generare una storia con criteri di accettazione verificabili.

**Design token**

- UX-DR1: Implementare il sistema colore completo — **27 token**, 14 chiari e 13 scuri, con i valori letterali di `DESIGN.md`. Nessun colore ha la sua unica definizione dentro un blocco `@media (prefers-color-scheme: dark)`.
- UX-DR2: Implementare la scala tipografica — **13 ruoli**: `word-hero`, `word-hero-mobile`, `word-ruby`, `reading`, `meaning`, `count-hero`, `count-hero-mobile`, `display`, `body`, `label`, `label-caps`, `caption`, `attribution`. Due famiglie con confine netto: **Noto Sans JP** per il giapponese, **Inter** per l'interfaccia.
- UX-DR3: Implementare la scala di spaziatura a 4px (`1`–`8`) più i token nominati `gutter-mobile` 20px, `gutter-desktop` 32px, `measure` 34rem, `thumb-zone` 120px.
- UX-DR4: Implementare la scala dei raggi: `sm` 4px, `md` 8px, `lg` 12px, `full` 9999px.
- UX-DR5: **Nessuna ombra nel sistema.** La separazione usa i bordi e il salto tonale fra `surface-base` e `surface-raised`.
- UX-DR6: **Due token di bordo non intercambiabili.** `border-hairline` (1.27:1) solo per separazione decorativa; `border-strong` (3.02:1) per il confine di ogni componente interattivo. Un componente interattivo delimitato da `border-hairline` è un difetto di accessibilità.
- UX-DR7: Verifica automatica del contrasto: uno script controlla ogni coppia colore/fondo su **entrambi** i fondi (`surface-base` e `surface-raised`) e in **entrambe** le modalità, e fallisce sotto 4.5:1 per il testo e 3:1 per il non-testo. Riferimento eseguibile in `.working/check-spines.py`.

**Componenti riusabili — nove**

- UX-DR8: `pile-counter` — numero in `count-hero`, etichetta in `label-caps` **sotto** il numero. A zero non mostra "0": la dashboard cambia stato.
- UX-DR9: `button-primary` — al massimo **uno per schermata**. Piena larghezza su mobile, `accent` pieno, altezza minima 56px.
- UX-DR10: `rating-button` ×4 in riga singola, ordine fisso `again`·`hard`·`good`·`easy`. Tre neutri e identici con `border-strong`; **solo `again`** usa `rating-button-again` (`danger` su `danger-subtle`). Mai quattro tinte diverse.
- UX-DR11: `study-card` — unica superficie `surface-raised` dell'app. Due stati, **prompt** e **rivelato**, transizione a senso unico.
- UX-DR12: `progress-meter` — 4px, senza etichetta numerica. Rappresenta **il completato**, non il rimanente. Riflette lo stato ottimistico locale, non la conferma del server.
- UX-DR13: `attribution-bar` — presente su dashboard, sessione e statistiche. Non condizionale, non richiudibile, non localizzabile in modo da poter sparire. Corpo 11px in `ink-muted`, sopra un filo `border-hairline`.
- UX-DR14: `sync-indicator` — deriva da `useMutationState`, non da uno stato proprio. **Assente** quando la coda è vuota, non "tutto sincronizzato". Non usa `danger`: una valutazione in coda non è un errore.
- UX-DR15: `empty-state` — dichiara **perché** è vuoto e offre al massimo un'azione.
- UX-DR16: `streak-badge` — numero e unità, derivato da `review_log` a ogni lettura.

**Struttura a quest**

- UX-DR17: La dashboard espone **due quest mai simultanee** — *svuota la pila*, poi *introduci nuovi item* — sequenziate dal cancello di `FR6.1`. **Non mostrare mai le due insieme, nemmeno una disabilitata.** Un pulsante grigio "non ancora" reintroduce la scelta che il cancello esiste per rimuovere.
- UX-DR18: **"Primo accesso" e "pila svuotata" sono lo stesso stato tecnico e devono essere due schermate diverse.** Il primo significa *comincia*, il secondo *hai finito*. ✅ Promosso a requisito di prodotto: **`FR3.5`**.

**Rendering del giapponese**

- UX-DR19: Furigana come `<ruby>`/`<rt>`, kana sopra i kanji. **Nascosta nello stato prompt, visibile solo dopo la rivelazione**, insieme al significato — la furigana *è* la risposta.
- UX-DR20: **Funzione di allineamento della furigana** — ✅ risolta da `AD-21`. `alignFurigana(kanji, kana): FuriganaSegment[]` è pura in `src/domain/furigana.ts`: toglie prefisso e suffisso di kana comuni alle due stringhe e applica ruby di gruppo al nucleo rimasto. `src/ui/` riceve i segmenti già calcolati e non contiene logica di allineamento. Tre classi di caso da testare — okurigana (難しい, 新しい, 食べる, 小さい, 話す, 行く), prefisso kana (お茶, お金), jukujikun non separabili (今日, 大人, 一人). Limite accettato: sokuon interno al nucleo (引っ越し).
- UX-DR21: `lang="ja"` su ogni nodo che contiene giapponese. Il giapponese non passa da i18n: è dato, non interfaccia.
- UX-DR22: **Il romaji non compare mai nell'interfaccia**, e non esiste un'impostazione per riattivarlo. Resta nel dataset (`FR2.2`) per usi futuri. ✅ Ratificato: la furigana *è* kana, quindi il romaji non serve chi non legge il kana — gli toglie solo la ragione di impararlo.
- UX-DR23: Interlinea di `word-hero` a 1.75 — vincolo funzionale, riserva lo spazio verticale per il ruby. Va verificata sul rendering reale con parole a due kanji più okurigana.

**Accessibilità**

- UX-DR24: WCAG 2.2 AA su tutta la superficie. ✅ Ratificato; AAA scartato perché imporrebbe `7:1` sul testo, che il fondo carta non regge.
- UX-DR25: Il ruby `<rt>` è `aria-hidden`, con `<rp>` come parentesi di ripiego. ✅ Ratificato: senza voce giapponese non funziona nemmeno il testo base, quindi `aria-hidden` è corretto dove conta e neutro dove non conta. **Richiede una verifica manuale su NVDA o VoiceOver in Epic 5** — è l'unica affermazione di accessibilità non coperta da un test automatico.
- UX-DR26: Ordine di tabulazione uguale all'ordine di lettura — nella sessione: card, poi i quattro pulsanti da sinistra a destra, nello stesso ordine dei tasti `1`–`4`.
- UX-DR27: I quattro esiti non si distinguono mai per solo colore: etichetta, posizione e numero portano l'informazione.
- UX-DR28: Anello di focus visibile su ogni elemento interattivo. Bersagli interattivi alti almeno 56px, nessuna eccezione su mobile.
- UX-DR29: `sync-indicator` è `aria-live="polite"` e annuncia **una volta** al cambio di stato, non a ogni item accodato.

**Layout e responsive**

- UX-DR30: Su mobile i quattro pulsanti di valutazione stanno nella fascia bassa, entro `thumb-zone` (120px) dal bordo inferiore, mai in cima. Vincolo derivato da UJ-1: treno in movimento, una mano.
- UX-DR31: Tre breakpoint — `< 640px` telefono (superficie primaria, colonna singola), `640–1024px` tablet (colonna centrata a `measure`), `≥ 1024px` portatile (contenuto centrato a `measure`, **non allargato**, statistiche eventualmente a due colonne).
- UX-DR32: Modalità scura come **pari**, non opzione secondaria. ✅ Ratificata per la v1, **senza interruttore**: segue `prefers-color-scheme`. Vale a una condizione imposta da `UX-DR1` — nessun componente scrive un colore letterale, altrimenti il costo passa da uno scambio di variabili a una riscrittura per componente.

**Voce e microcopy**

- UX-DR33: Il conteggio arriva prima del verbo — "23 da rivedere", non "hai 23 item".
- UX-DR34: Nessun punto esclamativo, nessuna emoji, nessun avverbio di lode in nessuna stringa dell'interfaccia. Nessuna animazione celebrativa, nessun badge, **nessun verde di successo nel sistema**.
- UX-DR35: Un fallimento dice cosa è successo, non come sentirsi. I quattro fallimenti prevedibili di `FR1.5` passano da un unico traduttore in `features/auth` verso chiavi i18n dedicate.

**Stati**

- UX-DR36: Implementare i **tredici state pattern** censiti in `EXPERIENCE.md`: caricamento a freddo (scheletro all'altezza finale, nessuno spinner), pila piena, pila a zero con dataset disponibile, pila a zero con dataset esaurito (**unica schermata senza azione primaria**), tetto giornaliero raggiunto, sessione in corso, item ripresentato nella stessa sessione (**senza segnalazione**), coda vuota, sessione abbandonata (**nessun "riprendi dove eri"**), rete assente durante la sessione, riapertura con coda non svuotata, dati insufficienti nelle statistiche, errore prevedibile di autenticazione.

**Totale: 36 requisiti di design UX.** Nessuna assunzione non ratificata: le sette voci aperte dalla stesura in fast path sono state tutte decise, e il registro con le motivazioni sta in `EXPERIENCE.md` § Open Items.

### FR Coverage Map

Ogni requisito funzionale è assegnato a esattamente un'epica. **48 su 48 coperti, nessun orfano.**

| FR | Epica | Storia | Dove atterra |
|---|---|---|---|
| FR1.1 | Epic 1 | **1.6** | Registrazione email e password |
| FR1.2 | Epic 1 | **1.7** | Accesso e disconnessione |
| FR1.3 | Epic 1 | **1.7** | Persistenza di sessione fra riavvii |
| FR1.4 | Epic 1 | **1.10 · verifica 5.4** | Cancellazione account via Edge Function (`AD-11`) |
| FR1.5 | Epic 1 | **1.6 · 1.7** | Traduttore unico dei fallimenti prevedibili in `features/auth` |
| FR1.6 | Epic 1 | **1.8** | Guard di rotta unico in `src/app/` |
| FR2.1 | Epic 2 | **2.6** | Dataset N5 distribuito per migrazione, sola lettura |
| FR2.2 | Epic 2 | **2.6** | Schema `vocabulary` con i sette campi |
| FR2.3 | Epic 2 | **2.6** | Riseed non distruttivo via `uuidv5` deterministico (`AD-9`) |
| FR3.1 | Epic 2 | **2.13** | `pile-counter` sulla chiave condivisa `['due', userId]` (`AD-5`) |
| FR3.2 | Epic 2 | **2.13 · calcolo 2.4** | `streak-badge`, derivato da `review_log` (`AD-18`) |
| FR3.3 | Epic 2 | **2.13** | Azione primaria unica (`UX-DR9`) |
| FR3.4 | Epic 2 | **2.14** | Macchina a stati a due quest (`UX-DR17`) |
| FR3.5 | Epic 2 | **2.11** | Stato di primo avvio, distinto da pila svuotata (`UX-DR18`) |
| FR4.1 | Epic 2 | **2.16 · coda 2.3** | Presentazione un item per volta |
| FR4.2 | Epic 2 | **2.16** | `study-card` prompt → rivelato |
| FR4.3 | Epic 2 | **2.17** | Quattro `rating-button` (`UX-DR10`) |
| FR4.4 | Epic 2 | **2.19** | Schermata di completamento |
| FR4.5 | Epic 2 | **2.18** | `progress-meter` (`UX-DR12`) |
| FR4.6 | Epic 2 | **2.18** | Abbandono con valutazioni acquisite |
| FR4.7 | Epic 2 | **2.18** | Ripresa senza penalità, sessione ricostruita (`AD-6`) |
| FR5.1 | Epic 2 | **2.1** | `schedule(state, outcome, now)` puro |
| FR5.2 | Epic 2 | **2.1** | Semantica dei quattro esiti |
| FR5.3 | Epic 2 | **2.1** | Saturazione agli estremi (`AD-17`) |
| FR5.4 | Epic 2 | **2.3** | Intervallo zero = in fondo alla coda corrente |
| FR5.5 | Epic 2 | **2.1** | Dispersione deterministica (`AD-4`) |
| FR5.6 | Epic 2 | **2.7 · scrittura 2.8** | `review_log` append-only |
| FR6.1 | Epic 2 | **2.12** | Cancello: nuovi item solo a pila vuota |
| FR6.2 | Epic 2 | **2.12** | Tetto giornaliero, predefinito 10 |
| FR6.3 | Epic 2 | **2.2 · uso 2.12** | `newItemsFor()` deterministica (`AD-4`) |
| FR6.4 | Epic 2 | **2.15** | Impostazione del tetto |
| FR7.1 | Epic 4 | **4.1** | Revisioni nel tempo |
| FR7.2 | Epic 4 | **4.2** | Distribuzione per stadio, asse derivato da `AD-17` |
| FR7.3 | Epic 4 | **4.3** | Item sbagliati più di frequente |
| FR7.4 | Epic 2 | **2.4 · uso 2.19** | `streak(log, now, timeZone)` — serve a `FR3.2` e `FR4.4`, quindi nasce qui |
| FR7.5 | Epic 4 | **4.4** | Stati di dati insufficienti (`UX-DR15`) |
| FR8.1 | Epic 1 | **1.4 · 1.9** | Risorse en/it, completezza imposta da chiavi tipizzate |
| FR8.2 | Epic 1 | **1.9** | Commutazione a runtime |
| FR8.3 | Epic 1 | **1.9** | Persistenza in `user_settings.locale` |
| FR8.4 | Epic 1 | **1.4** | Nessuna stringa cablata — errore di compilazione (`AD-14`) |
| FR9.1 | Epic 3 | **3.1** | Precarico dell'intera pila dovuta |
| FR9.2 | Epic 3 | **3.2** | Accodamento locale delle valutazioni |
| FR9.3 | Epic 3 | **3.3** | Drenaggio automatico al ritorno online |
| FR9.4 | Epic 3 | **3.4** | `sync-indicator` da `useMutationState` (`UX-DR14`) |
| FR9.5 | Epic 3 | **3.2** | Recupero della coda dopo chiusura, persister IndexedDB (`AD-8`) |
| FR9.6 | Epic 3 | **3.5 · RPC 2.8** | Idempotenza — costruita in Epic 2, **verificata** qui |
| FR10.1 | Epic 5 | **5.1** | Pagina privacy policy |
| FR10.2 | Epic 2 | **2.10 · statistiche 4.1** | `attribution-bar` — invariante di layout (`AD-16`), non rifinitura di lancio |

## Epic List

Cinque epiche, consolidate dalle nove proposte nell'Addendum `§5`. Il lavoro tecnico non sparisce: viene assorbito come storie ordinate dentro l'epica di valore che abilita.

**Perché consolidare.** Lo step chiede di organizzare per valore utente, e *Fondazione*, *Motore di dominio* e *Livello dati* sono livelli tecnici che non consegnano niente da soli. Lo stesso step chiede però di preferire **poche epiche grandi** quando il design è già validato — e qui Architecture Spine e contratto UX sono entrambi `status: final`.

### Epic 1: Accesso, fondamenta e URL pubblico

Uno sconosciuto raggiunge un indirizzo pubblico, si registra, accede, resta autenticato fra riavvii del browser, cambia lingua e può cancellare definitivamente il proprio account.

**FRs covered:** FR1.1, FR1.2, FR1.3, FR1.4, FR1.5, FR1.6, FR8.1, FR8.2, FR8.3, FR8.4

**Implementation notes:** Assorbe *Fondazione*, *Autenticazione* e *Internazionalizzazione* dell'Addendum. **La prima storia è uno scaffold manuale** — l'Architecture Spine non nomina nessuno starter template, e partire da `create-vite` produrrebbe una struttura che viola `AD-1` dalla prima riga. Il confine di `AD-1` va imposto meccanicamente (`eslint-plugin-boundaries`) **prima** che esista codice da vincolare. `AD-14` rende una chiave i18n mancante un errore di compilazione, quindi `FR8.4` si autoimpone da qui in avanti invece di diventare un'epica di pulizia finale. La superficie *Impostazioni* nasce qui, con la sola cancellazione account, e viene estesa da Epic 2.

### Epic 2: La pila — dal dataset alla sessione a zero

L'utente introduce vocabolario mai visto, lo studia un item per volta rivelando e valutando, e porta la pila a zero. È il prodotto.

**FRs covered:** FR2.1, FR2.2, FR2.3, FR3.1, FR3.2, FR3.3, FR3.4, FR3.5, FR4.1, FR4.2, FR4.3, FR4.4, FR4.5, FR4.6, FR4.7, FR5.1, FR5.2, FR5.3, FR5.4, FR5.5, FR5.6, FR6.1, FR6.2, FR6.3, FR6.4, FR7.4, FR10.2

**Implementation notes:** Assorbe *Motore di dominio*, *Livello dati*, *Flusso di studio* e *Nuovi item*.

L'epica è grande (26 FR) per una ragione dirimente, non per pigrizia: un account appena creato ha `review_state` vuoto, quindi pila a zero, quindi niente da studiare. **Senza `F6` nella stessa epica, questa consegnerebbe zero valore a chiunque parta da zero — cioè a tutti.** In più `FR3.4` lega `F3` a `F6`, e `UX-DR17` tratta le due quest come una sola macchina a stati della dashboard: separarle significa riscrivere lo stesso file due volte.

Le storie sono ordinate — dominio puro e testato per primo, poi dati, poi schermate — e ognuna sta nel contesto di un singolo dev agent.

**Una verifica empirica da non dimenticare:** l'interlinea `1.75` di `word-hero` è decisa ma non misurata, ed è l'unico numero del contratto UX in quel dubbio. La storia della card di studio la conferma sul rendering reale nei tre casi che `AD-21` distingue — okurigana (難しい), prefisso kana (お茶), ruby di gruppo su nucleo lungo (日本語) — prima di potersi chiudere. Se il ruby collide si alza l'interlinea, **non** si accorcia la furigana, che è già al suo minimo di leggibilità.

**`UX-DR20` (allineamento della furigana) cade qui, prima delle storie della card di studio**, e ora ha un livello assegnato: `AD-21` la colloca come funzione pura in `src/domain/furigana.ts`, con `src/ui/` che riceve segmenti già calcolati. È una storia di dominio ordinaria, testabile senza montare nulla, e va **prima** della storia della card.

### Epic 3: La sessione sopravvive alla galleria

La valutazione data senza rete non si perde, si sincronizza da sola al ritorno del campo, e sopravvive alla chiusura dell'applicazione.

**FRs covered:** FR9.1, FR9.2, FR9.3, FR9.4, FR9.5, FR9.6

**Implementation notes:** `F9` non aveva un'epica nell'Addendum, che avvertiva: *"da collocare esplicitamente, altrimenti sparisce"*. Eccola.

**Epic 2 non dipende da questa.** Il percorso di scrittura — `apply_review` con `review_id` e `ON CONFLICT` (`AD-7`) — nasce già idempotente in Epic 2, perché è semplicemente come si persiste una valutazione. Qui ci si costruisce sopra la coda durevole, senza toccarlo. I quattro vincoli di `AD-8` sono altrettanti punti di fallimento noti: in particolare `setMutationDefaults` registrata al bootstrap e mai in un componente, altrimenti la reidratazione fallisce con `No mutationFn found`.

### Epic 4: Statistiche che dicono qualcosa di azionabile

L'utente vede le revisioni nel tempo, la distribuzione dei propri item per stadio, e riconosce i vocaboli che sbaglia più spesso.

**FRs covered:** FR7.1, FR7.2, FR7.3, FR7.5

**Implementation notes:** Tutto deriva **esclusivamente** da `review_log` (`AD-18`). `review_count` e `lapse_count` in `review_state` non sono mai fonte per una statistica, anche quando sembrano la strada più corta. L'asse della distribuzione per stadio deriva dalla costante unica di `AD-17`, non da un elenco parallelo. `FR7.3` deve essere azionabile: riconoscere il proprio vocabolo-nemesi, non un grafico decorativo.

### Epic 5: Lancio pubblico difendibile

Il progetto è pubblicamente utilizzabile e pubblicamente ispezionabile: privacy policy, licenze di codice e dati separate e rispettate, README che spiega le scelte, percorso completo verificato end-to-end.

**FRs covered:** FR10.1

**Implementation notes:** Un solo FR, ma contiene la maggior parte della Definition of Done del PRD `§11`. `LICENSE` (MIT, codice) e `LICENSE-DATA` (CC BY-SA 4.0, dataset) come file separati e dichiarati (`AD-16`, `NFR8`). Il test Playwright copre registrazione → studio → pila a zero (`NFR3`) e la cancellazione account verificata su **tutte** le tabelle per-utente (`AD-11`), non dedotta dalle chiavi esterne. Il README risponde alle sette domande della traccia in Addendum `§6`, inclusa l'ultima — come è stato usato il flusso assistito da AI, cosa è stato delegato e cosa rifiutato.

**Contiene anche la sola verifica di accessibilità che nessun test automatico copre** (`UX-DR25`): una storia percorre la sessione di studio con NVDA o VoiceOver e registra l'esito dell'`aria-hidden` sul ruby. Il ragionamento che l'ha ratificato è solido ma resta un ragionamento; qui si misura.

---

## Epic 1: Accesso, fondamenta e URL pubblico

Uno sconosciuto raggiunge un indirizzo pubblico, si registra, accede, resta autenticato fra riavvii del browser, cambia lingua e può cancellare definitivamente il proprio account.

### Story 1.1: Scaffold con i confini imposti in CI

As a sviluppatore del progetto,
I want uno scheletro applicativo in cui il confine architetturale è verificato automaticamente,
So that nessun contributo successivo — mio o di un agente — possa violarlo senza che la CI se ne accorga.

**Acceptance Criteria:**

**Given** una cartella vuota e nessuno starter template
**When** il progetto viene inizializzato manualmente con Vite, React 19 e TypeScript in modalità `strict`
**Then** l'albero sorgente contiene `src/domain/`, `src/data/`, `src/ui/`, `src/features/`, `src/app/`, `src/i18n/`
**And** `npm ci` installa da un `package-lock.json` versionato

**Given** il progetto inizializzato
**When** un file sotto `src/domain/` importa React, `@supabase/supabase-js`, `fetch` o storage
**Then** `eslint-plugin-boundaries` produce un errore
**And** la pipeline di CI fallisce, non emette un avviso

**Given** il progetto inizializzato
**When** un file sotto `src/features/` importa da `src/data/`
**Then** il lint fallisce, perché `AD-1` ammette solo `features → domain | ui | i18n`

**Given** una pull request aperta
**When** la GitHub Action viene eseguita
**Then** lint, typecheck e test unitari girano tutti
**And** `dependency-cruiser` genera `docs/dependency-graph.svg`

### Story 1.2: Un indirizzo pubblico raggiungibile

As a chiunque su internet,
I want raggiungere l'applicazione a un URL pubblico,
So that il progetto esista davvero invece che solo sulla macchina di chi lo scrive.

**Acceptance Criteria:**

**Given** un merge sul ramo principale
**When** la pipeline di deploy viene eseguita
**Then** Netlify pubblica il sito in produzione a un URL raggiungibile senza credenziali

**Given** una pull request aperta
**When** la pipeline viene eseguita
**Then** Netlify pubblica un'anteprima dedicata a quella PR

**Given** una configurazione incompleta — una variabile `VITE_*` mancante
**When** l'applicazione si avvia
**Then** lo schema di validazione in `src/app/` fallisce con un messaggio che nomina la variabile
**And** l'applicazione non parte in uno stato parzialmente configurato

### Story 1.3: Il sistema di design come token, non come valori sparsi

As a sviluppatore che costruirà ogni schermata,
I want colori, tipografia, spaziature e raggi disponibili come token unici,
So that la modalità scura sia uno scambio di variabili e non una riscrittura per componente.

**Acceptance Criteria:**

**Given** la configurazione Tailwind
**When** viene letta
**Then** contiene i 27 token colore, i 13 ruoli tipografici, la scala di spaziatura e i quattro raggi di `DESIGN.md`
**And** nessun colore ha la sua unica definizione dentro un blocco `prefers-color-scheme`

**Given** le famiglie tipografiche
**When** una pagina viene renderizzata
**Then** Noto Sans JP è disponibile per il contenuto giapponese e Inter per l'interfaccia
**And** ogni famiglia ha uno stack di ripiego dichiarato

**Given** la definizione dei token
**When** la CI viene eseguita
**Then** uno script verifica ogni coppia colore/fondo su `surface-base` **e** `surface-raised`, in modalità chiara **e** scura
**And** fallisce sotto `4.5:1` per il testo e sotto `3:1` per il non-testo

**Given** il sistema completo
**When** un componente scrive un valore colore letterale invece di un token
**Then** una regola di lint lo segnala

**Given** i due token di bordo
**When** vengono usati
**Then** `border-hairline` compare solo come separatore decorativo e `border-strong` come confine di ogni componente interattivo
**And** un componente interattivo delimitato dal solo `border-hairline` è un difetto, perché a `1.27:1` sparisce a piena luminosità

**Given** il sistema di elevazione
**When** viene definito
**Then** non esistono ombre: la separazione si ottiene con i bordi e con il salto tonale fra `surface-base` e `surface-raised`

**Given** un dispositivo con preferenza di sistema per il tema scuro
**When** l'applicazione viene aperta
**Then** rende con i token `*-dark`, senza che l'utente debba impostare nulla
**And** non esiste un interruttore del tema in Impostazioni

**Given** il livello di conformità dichiarato
**When** viene verificato
**Then** è WCAG 2.2 AA su tutta la superficie, in entrambe le modalità

### Story 1.4: Nessuna stringa cablata, imposto dal compilatore

As a utente che legge in inglese o in italiano,
I want che ogni testo dell'interfaccia venga da un catalogo di traduzioni,
So that nessuna schermata resti a metà tradotta.

**Acceptance Criteria:**

**Given** i18next configurato con `CustomTypeOptions`
**When** il codice invoca `t()` con una chiave che non esiste nelle risorse
**Then** `tsc` produce un errore di compilazione, non un fallimento a runtime

**Given** i cataloghi `en` e `it`
**When** vengono confrontati
**Then** hanno lo stesso insieme di chiavi

**Given** una stringa giapponese proveniente dal dataset
**When** viene renderizzata
**Then** **non** passa da `t()`, perché è dato e non interfaccia
**And** il nodo che la contiene porta `lang="ja"`

### Story 1.5: Lo schema nasce versionato e isolato

As a proprietario dei miei dati,
I want che ogni tabella che mi riguarda sia leggibile solo da me,
So that il repository possa essere pubblico senza che i dati lo diventino.

**Acceptance Criteria:**

**Given** due progetti Supabase, produzione e staging
**When** la pipeline applica le migrazioni
**Then** entrambi ricevono le stesse migrazioni versionate da `supabase/migrations/`
**And** nessuna modifica di schema avviene dallo Studio Supabase

**Given** la migrazione che crea `user_settings`
**When** viene applicata
**Then** la tabella ha `user_id` come chiave primaria con `on delete cascade` verso `auth.users`
**And** contiene `locale` con predefinito `'en'` — **e nient'altro**: nessuna colonna viene creata prima della storia che la usa

**Given** RLS attiva su `user_settings`
**When** l'utente A interroga la tabella
**Then** vede solo le proprie righe
**And** un test di integrazione dimostra che l'utente A non legge né scrive le righe di B

### Story 1.6: Registrazione con email e password

As a sconosciuto che arriva sul sito,
I want creare un account con email e password,
So that possa cominciare a studiare senza altre formalità.

**Acceptance Criteria:**

**Given** la schermata di Accesso
**When** l'utente inserisce email e password valide e invia
**Then** l'account viene creato e l'utente atterra autenticato sulla rotta radice protetta
**And** non ci sono conferme via email, onboarding o questionari di livello

**Given** un'email già registrata
**When** l'utente tenta di registrarsi
**Then** compare un messaggio tradotto accanto al campo email
**And** nessun messaggio grezzo di Supabase raggiunge l'utente

**Given** una password troppo debole o un'email in formato non valido
**When** l'utente invia
**Then** il messaggio corrispondente compare accanto al campo responsabile, non in cima alla pagina

**Given** i quattro fallimenti prevedibili di `FR1.5`
**When** vengono tradotti
**Then** passano tutti da un unico traduttore in `features/auth` verso chiavi i18n dedicate

### Story 1.7: Accesso, disconnessione e sessione che resiste

As a utente che studia da due dispositivi,
I want restare autenticato fra riavvii del browser,
So that aprire l'app la mattina non richieda di riaccedere ogni volta.

**Acceptance Criteria:**

**Given** un account esistente
**When** l'utente accede con le credenziali corrette
**Then** atterra autenticato sulla rotta radice protetta

**Given** una password errata
**When** l'utente invia
**Then** compare "Password errata." nella lingua corrente, senza rivelare se l'email esista

**Given** una sessione attiva
**When** il browser viene chiuso e riaperto
**Then** l'utente è ancora autenticato

**Given** una sessione attiva
**When** l'utente si disconnette esplicitamente
**Then** la sessione termina e un riavvio del browser non la ripristina

### Story 1.8: Le rotte private sono private

As a utente,
I want che i miei dati non siano raggiungibili da chi non ha effettuato l'accesso,
So that l'indirizzo di una schermata non sia una scorciatoia.

**Acceptance Criteria:**

**Given** un visitatore non autenticato
**When** apre l'URL della dashboard, della sessione di studio, delle statistiche o delle impostazioni
**Then** viene reindirizzato alla schermata di Accesso

**Given** il guard di rotta
**When** il codice viene ispezionato
**Then** esiste in un solo punto, in `src/app/`, e non come controlli sparsi nelle schermate

**Given** un utente autenticato
**When** apre la radice del sito
**Then** raggiunge una rotta protetta che esiste e risponde
**And** il suo contenuto in questa epica è minimo: la dashboard vera arriva in Epic 2, e nessuna storia di Epic 1 la presuppone

### Story 1.9: Cambiare lingua senza ricaricare

As a utente italiano o inglese,
I want cambiare la lingua dell'interfaccia e ritrovarla su ogni dispositivo,
So that l'app parli la mia lingua ovunque io la apra.

**Acceptance Criteria:**

**Given** l'interfaccia in inglese
**When** l'utente sceglie l'italiano da Impostazioni
**Then** ogni testo visibile cambia lingua **senza** ricaricare la pagina

**Given** la lingua cambiata
**When** la scelta viene salvata
**Then** viene persistita in `user_settings.locale` con un upsert diretto sulla tabella

**Given** la lingua impostata su un dispositivo
**When** l'utente accede da un altro dispositivo
**Then** ritrova la stessa lingua

### Story 1.10: Cancellare l'account per davvero

As a utente che se ne va,
I want che cancellare l'account rimuova tutti i miei dati,
So that la promessa di privacy sia verificabile e non dichiarata.

**Acceptance Criteria:**

**Given** un utente autenticato in Impostazioni
**When** avvia la cancellazione dell'account
**Then** una conferma esplicita dichiara la conseguenza: tutti i dati di revisione vengono distrutti e le statistiche non sopravvivono

**Given** la conferma accettata
**When** la richiesta viene inviata
**Then** una Edge Function autenticata verifica il chiamante e cancella l'utente con la `service_role`
**And** le tabelle per-utente si svuotano per cascata su `auth.users`

**Given** il bundle client compilato
**When** viene ispezionato
**Then** la `service_role` non compare, né in codice né in variabili `VITE_*`

**Given** l'account cancellato
**When** l'utente tenta di riaccedere con le stesse credenziali
**Then** l'accesso fallisce

---

## Epic 2: La pila — dal dataset alla sessione a zero

L'utente introduce vocabolario mai visto, lo studia un item per volta rivelando e valutando, e porta la pila a zero. È il prodotto.

### Story 2.1: Il motore di scheduling, puro e saturo

As a revisore tecnico che legge questa codebase,
I want un motore di scheduling che sia una funzione pura senza dipendenze,
So that si possa capire e verificare leggendo un file solo.

**Acceptance Criteria:**

**Given** la scala Leitner
**When** viene definita
**Then** esiste come **una sola** costante esportata da `src/domain/schedule.ts`: stadi `0`–`5`, intervalli `0, 1, 3, 7, 16, 35` giorni

**Given** `schedule(state, outcome, now)`
**When** riceve `good`
**Then** lo stadio avanza di uno; con `easy` avanza di due; con `again` torna a `0` e `lapse_count` cresce di uno; con `hard` lo stadio resta e l'intervallo si riduce a circa il 60%

**Given** un item allo stadio `5`
**When** riceve `easy`
**Then** resta allo stadio `5`, non va a `7`

**Given** un item allo stadio `0`
**When** riceve `again` oppure `hard`
**Then** resta allo stadio `0` con intervallo `0`, senza ramificazioni speciali nel codice

**Given** il modulo `src/domain/schedule.ts`
**When** viene ispezionato
**Then** non contiene `Date.now()`, `new Date()` senza argomenti, `Intl.DateTimeFormat().resolvedOptions()` né `Math.random()`
**And** riceve sempre `now` come parametro esplicito

**Given** due item valutati nello stesso istante allo stesso stadio
**When** le scadenze vengono calcolate
**Then** ricevono una dispersione deterministica derivata da `vocabulary_id` e `stage`
**And** ripetere il calcolo produce esattamente le stesse date

### Story 2.2: Una sola definizione di "dovuto"

As a utente,
I want che il numero mostrato dalla dashboard sia lo stesso numero che la sessione carica,
So that non ci siano due verità sulla stessa pila.

**Acceptance Criteria:**

**Given** `isDue(state, now)` in `src/domain/`
**When** viene invocata
**Then** è pura, riceve `now` come parametro, e restituisce se l'item è dovuto

**Given** `newItemsFor(vocabulary, seen, cap)` in `src/domain/`
**When** viene invocata due volte con gli stessi argomenti
**Then** restituisce esattamente lo stesso insieme, senza `Math.random()`

**Given** la porta `ReviewRepository.listDue`
**When** dashboard, precarico di sessione e cancello dei nuovi item interrogano la pila
**Then** leggono tutti la stessa chiave TanStack `['due', userId]`
**And** nessuna schermata ricalcola la pila per conto proprio

### Story 2.3: La coda di sessione decide il dominio, non la UI

As a utente che sbaglia un item,
I want rivederlo prima della fine della sessione,
So that la sessione finisca solo quando ho davvero risposto a tutto.

**Acceptance Criteria:**

**Given** `sessionReducer(state, event)` in `src/domain/session.ts`
**When** un item riceve una valutazione con intervallo risultante `0`
**Then** torna in fondo alla coda corrente

**Given** una coda di sessione
**When** ogni item ha ricevuto almeno un `good`
**Then** la coda è vuota e la sessione può terminare

**Given** lo store Zustand di sessione
**When** viene ispezionato
**Then** delega ogni calcolo a `sessionReducer()` e non contiene logica di scheduling o di coda
**And** non è persistito

### Story 2.4: Lo streak si calcola, non si memorizza

As a utente che studia ogni giorno,
I want vedere da quanti giorni consecutivi porto la pila a zero,
So that abbia una misura dell'abitudine che sto costruendo.

**Acceptance Criteria:**

**Given** `streak(log, now, timeZone)` in `src/domain/streak.ts`
**When** viene invocata
**Then** riceve **sia** l'istante **sia** il fuso orario come parametri espliciti

**Given** un giorno in cui l'utente ha portato la pila a zero
**When** lo streak viene calcolato
**Then** quel giorno conta; conta anche un giorno con almeno una revisione se la pila era già vuota

**Given** il confine fra due giornate
**When** lo streak viene calcolato
**Then** la giornata termina a mezzanotte nel fuso passato come parametro

**Given** lo streak
**When** viene letto
**Then** è sempre derivato da `review_log` a ogni lettura
**And** non esiste una colonna che lo memorizzi

### Story 2.5: La furigana si allinea nel dominio

As a utente che studia i kanji,
I want vedere il kana sopra la parte giusta della parola,
So that la lettura mi insegni qualcosa invece di confondermi.

**Acceptance Criteria:**

**Given** `alignFurigana(kanji, kana)` in `src/domain/furigana.ts`
**When** riceve `("難しい", "むずかしい")`
**Then** restituisce `難` con ruby `むずか` seguito da `しい` senza ruby

**Given** una parola con prefisso in kana
**When** riceve `("お茶", "おちゃ")`
**Then** restituisce `お` senza ruby seguito da `茶` con ruby `ちゃ`

**Given** una lettura non separabile per carattere
**When** riceve `("今日", "きょう")`, `("大人", "おとな")` o `("一人", "ひとり")`
**Then** restituisce il nucleo intero con ruby di gruppo, che è la resa corretta

**Given** una voce senza kanji, o con `kanji` uguale a `kana`
**When** viene invocata
**Then** restituisce un solo segmento senza ruby

**Given** il modulo
**When** viene ispezionato
**Then** è puro, non importa React, e i casi sopra sono coperti da test unitari

### Story 2.6: Il dataset N5 entra e può rientrare

As a utente che ha già studiato per settimane,
I want che un aggiornamento del dizionario non cancelli i miei progressi,
So that migliorare i dati non costi la mia cronologia.

**Acceptance Criteria:**

**Given** la migrazione che crea `vocabulary`
**When** viene applicata
**Then** la tabella espone `id`, `kanji` (nullable), `kana`, `romaji`, `meaning_en`, `meaning_it`, `jlpt_level`, `part_of_speech`

**Given** il generatore di seed
**When** produce l'identificatore di una voce
**Then** lo calcola come `uuidv5(natural_key, NAMESPACE)` con `natural_key = "kana|kanji|meaning_en"` normalizzata NFKC, con trim e minuscole sul campo inglese

**Given** un dataset già caricato
**When** la tabella viene troncata e il seed rieseguito
**Then** ogni voce riceve lo stesso `id` di prima
**And** un test lo verifica

**Given** RLS su `vocabulary`
**When** un utente autenticato interroga la tabella
**Then** può leggere
**And** non esiste alcuna policy di scrittura: il dataset entra solo per migrazione

### Story 2.7: Il progresso è per-utente e resta per-utente

As a utente,
I want che nessun altro possa leggere il mio storico di studio,
So that lo schema pubblico non sia una porta aperta.

**Acceptance Criteria:**

**Given** le migrazioni
**When** vengono applicate
**Then** esistono `review_state` (chiave `user_id` + `vocabulary_id`, con `stage`, `due_at`, `review_count`, `lapse_count`, `last_reviewed_at`) e `review_log` (append-only, con `id`, `user_id`, `vocabulary_id`, `outcome`, `reviewed_at`)

**Given** il vincolo su `review_state.stage`
**When** viene definito
**Then** il `CHECK` deriva dalla stessa scala di `AD-17`, non da un elenco parallelo

**Given** il tipo dell'esito
**When** viene definito
**Then** il `CHECK` SQL e la union TypeScript ammettono lo stesso insieme `again | hard | good | easy`

**Given** RLS su entrambe le tabelle
**When** l'utente A tenta di leggere o scrivere righe dell'utente B
**Then** l'operazione fallisce
**And** un test di integrazione lo dimostra esplicitamente

### Story 2.8: Una valutazione, una chiamata, nessun doppione

As a utente che valuta un item mentre la rete è instabile,
I want che un ritentativo non conti la valutazione due volte,
So that le mie statistiche restino vere.

**Acceptance Criteria:**

**Given** la funzione RPC
**When** viene definita
**Then** ha firma `apply_review(review_id, vocabulary_id, outcome, stage, due_at, reviewed_at)`

**Given** una chiamata a `apply_review`
**When** viene eseguita
**Then** in una sola transazione inserisce in `review_log` con `ON CONFLICT (review_id) DO NOTHING` e aggiorna `review_state` **solo se** l'insert ha prodotto una riga

**Given** la stessa chiamata ripetuta con lo stesso `review_id`
**When** viene eseguita una seconda volta
**Then** non produce una seconda riga di log né un secondo avanzamento di stadio

**Given** la funzione SQL
**When** viene ispezionata
**Then** non contiene logica di scheduling: riceve `stage` e `due_at` già calcolati dal client

### Story 2.9: Gli adattatori dietro le porte

As a sviluppatore che scrive le schermate,
I want ricevere i dati attraverso interfacce dichiarate dal dominio,
So that il flusso di studio si possa testare senza database.

**Acceptance Criteria:**

**Given** `src/domain/ports/`
**When** viene ispezionata
**Then** dichiara `VocabularyRepository`, `ReviewRepository`, `SettingsRepository` e `Clock`

**Given** `src/data/`
**When** viene ispezionata
**Then** è l'unica cartella che importa `@supabase/supabase-js`
**And** implementa le porte lanciando un `DataError` tipizzato in caso di fallimento

**Given** un test di componente
**When** viene eseguito
**Then** inietta implementazioni in memoria delle porte, senza rete

### Story 2.10: Il giapponese si presenta bene e si attribuisce sempre

As a utente e come titolare della licenza del dataset,
I want vedere il giapponese reso correttamente e la fonte attribuita su ogni schermata che la mostra,
So that la card sia leggibile e la licenza rispettata.

**Acceptance Criteria:**

**Given** il componente ruby
**When** riceve i segmenti da `alignFurigana()`
**Then** li rende in `<ruby>`/`<rt>` con `<rp>` come parentesi di ripiego
**And** non contiene logica di allineamento

**Given** un nodo che contiene giapponese
**When** viene renderizzato
**Then** porta `lang="ja"`

**Given** il `<rt>` della furigana
**When** viene renderizzato
**Then** è `aria-hidden`, perché uno screen reader con voce giapponese legge già il testo base

**Given** il layout di dashboard, sessione di studio e statistiche
**When** una qualsiasi di esse viene renderizzata
**Then** la barra di attribuzione è presente, con il riferimento a JMdict/EDRDG e a tanos.co.uk
**And** non è condizionale, non è richiudibile, e non è una chiave i18n che possa risolvere a stringa vuota

### Story 2.11: La prima volta non somiglia alla fine

As a sconosciuto appena registrato,
I want capire subito cosa fare,
So that possa studiare entro un minuto dall'arrivo.

**Acceptance Criteria:**

**Given** un utente che non ha mai studiato alcun item
**When** apre la dashboard
**Then** vede uno stato di primo avvio che dice cosa fa l'app e offre una sola azione primaria per cominciare

**Given** lo stato di primo avvio
**When** viene confrontato con lo stato di pila svuotata
**Then** i due testi sono diversi: il primo significa *comincia*, il secondo *hai finito*

**Given** lo stato di primo avvio
**When** viene renderizzato
**Then** non mostra un conteggio a zero né uno streak a zero, perché non c'è ancora niente da contare

### Story 2.12: Introdurre vocabolario mai visto

As a utente con la pila vuota,
I want aggiungere item nuovi fino al mio limite giornaliero,
So that possa continuare a imparare senza sommergermi.

**Acceptance Criteria:**

**Given** la pila dovuta vuota
**When** l'utente sceglie di introdurre nuovi item
**Then** vengono selezionati item mai visti, fino al tetto giornaliero

**Given** un item introdotto
**When** l'operazione si completa
**Then** viene creata subito una riga `review_state` con `stage = 0` e `due_at` uguale all'istante di introduzione

**Given** un item mai visto
**When** lo stato viene interrogato
**Then** "mai visto" significa **assenza di riga**, non una riga con uno stato speciale

**Given** il tetto giornaliero già raggiunto
**When** l'utente riapre la dashboard
**Then** la schermata dichiara il tetto e quando si riapre, e rimanda a Impostazioni per cambiarlo

**Given** la pila **non** vuota
**When** la dashboard viene renderizzata
**Then** l'azione di introdurre nuovi item **non è presente**, nemmeno disabilitata

### Story 2.13: La pila, con un numero e un pulsante

As a utente che apre l'app alle 8:10,
I want vedere subito quanto mi resta e come cominciare,
So that possa partire senza decidere nulla.

**Acceptance Criteria:**

**Given** item dovuti esistenti
**When** l'utente apre la dashboard
**Then** vede il conteggio dei dovuti nel corpo tipografico più grande dell'applicazione, con l'etichetta **sotto** il numero

**Given** la dashboard
**When** viene renderizzata
**Then** mostra lo streak corrente
**And** espone **una sola** azione primaria

**Given** la dashboard in caricamento
**When** i dati non sono ancora arrivati
**Then** compare uno scheletro alla stessa altezza del contenuto finale, senza spinner e senza salti di layout

**Given** una qualsiasi stringa visibile dell'applicazione
**When** viene scritta
**Then** il conteggio precede il verbo — "23 da rivedere", non "hai 23 item"
**And** non contiene punti esclamativi, emoji né avverbi di lode

### Story 2.14: Quando non c'è più niente da fare, dirlo

As a utente che ha finito,
I want che l'app me lo dica invece di mostrarmi una schermata muta,
So that sappia che ho terminato e non che si è rotto qualcosa.

**Acceptance Criteria:**

**Given** la pila a zero e item mai visti ancora disponibili
**When** la dashboard viene renderizzata
**Then** il conteggio non diventa "0": lo stato cambia e l'azione primaria diventa introdurre nuovi item

**Given** la pila a zero e il dataset esaurito
**When** la dashboard viene renderizzata
**Then** dichiara esplicitamente che non ci sono più item da introdurre
**And** è l'unica schermata dell'applicazione senza azione primaria

**Given** uno qualsiasi degli stati vuoti
**When** viene renderizzato
**Then** dichiara **perché** è vuoto e offre al massimo un'azione

### Story 2.15: Cambiare il ritmo

As a utente che trova dieci item al giorno troppi o troppo pochi,
I want cambiare il limite giornaliero,
So that il carico resti sostenibile per me.

**Acceptance Criteria:**

**Given** la migrazione di questa storia
**When** viene applicata
**Then** aggiunge a `user_settings` la colonna `new_items_per_day` con predefinito `10`

**Given** Impostazioni
**When** l'utente modifica il numero di nuovi item al giorno
**Then** il valore viene persistito in `user_settings.new_items_per_day` con un upsert diretto

**Given** il valore modificato
**When** l'utente torna alla dashboard
**Then** il cancello dei nuovi item usa il nuovo tetto

**Given** Impostazioni
**When** viene ispezionata
**Then** contiene esattamente due impostazioni — lingua e tetto giornaliero — più la cancellazione account

### Story 2.16: Una parola per volta, rivelata da un gesto

As a utente in sessione,
I want vedere la parola, provare a ricordarla, e poi rivelare la risposta,
So that la sessione misuri il richiamo invece del riconoscimento.

**Acceptance Criteria:**

**Given** una sessione avviata
**When** compare un item
**Then** la card mostra il kanji senza furigana, senza significato e senza romaji

**Given** la card nello stato prompt
**When** l'utente tocca la card o preme spazio
**Then** compaiono la furigana sopra i kanji e il significato nella lingua corrente

**Given** la card nello stato prompt
**When** viene renderizzata
**Then** i quattro pulsanti di valutazione **non sono presenti** — non disabilitati, assenti

**Given** un item rivelato
**When** l'utente tenta di tornare allo stato prompt
**Then** non è possibile: la transizione è a senso unico dentro l'item corrente

**Given** una qualsiasi schermata dell'applicazione
**When** viene renderizzata
**Then** il romaji non compare mai nell'interfaccia

### Story 2.17: Valutare, e vedere il conteggio scendere subito

As a utente,
I want che l'app risponda alla mia valutazione senza attesa,
So that la sessione scorra al ritmo del pensiero.

**Acceptance Criteria:**

**Given** un item rivelato
**When** l'utente valuta
**Then** i quattro esiti sono presentati in riga singola, nell'ordine `again`, `hard`, `good`, `easy` da sinistra a destra

**Given** i quattro pulsanti
**When** vengono renderizzati
**Then** tre sono neutri e identici; solo `again` porta colore
**And** l'informazione dell'ordine è portata anche da etichetta e posizione, mai dal solo colore

**Given** una valutazione
**When** viene registrata
**Then** il nuovo stato è calcolato dal dominio **sul client, in quell'istante**, insieme a un `review_id` generato dal client
**And** la mutation trasporta il risultato già calcolato

**Given** una valutazione
**When** viene applicata
**Then** conteggio e barra di avanzamento si aggiornano prima della conferma del server

**Given** un item ripresentato nella stessa sessione
**When** ricompare
**Then** non porta alcuna segnalazione che lo distingua dagli altri

### Story 2.18: Vedere quanto manca, e potersene andare

As a utente che deve scendere dal treno,
I want abbandonare la sessione senza perdere quello che ho fatto,
So that riprendere più tardi non costi nulla.

**Acceptance Criteria:**

**Given** una sessione in corso
**When** viene renderizzata
**Then** la barra di avanzamento è sempre visibile e rappresenta il **completato**, non il rimanente

**Given** una sessione in corso
**When** l'utente la abbandona con Esc o tornando indietro
**Then** tutte le valutazioni già date restano acquisite

**Given** una sessione abbandonata
**When** l'utente riapre la dashboard
**Then** vede il conteggio residuo come conteggio normale, senza penalità

**Given** item ancora dovuti
**When** l'utente avvia una nuova sessione più tardi nella stessa giornata
**Then** la sessione riparte dagli item ancora dovuti
**And** non esiste un "riprendi dove eri": la sessione si ricostruisce, non si ripristina

### Story 2.19: Arrivare a zero

As a utente che ha svuotato la pila,
I want una conferma sobria di aver finito,
So that la chiusura sia riconoscibile senza essere celebrata.

**Acceptance Criteria:**

**Given** la coda di sessione vuota
**When** la sessione termina
**Then** compare una schermata di completamento che conferma il risultato e mostra lo streak aggiornato

**Given** la schermata di completamento
**When** viene renderizzata
**Then** non contiene spunte verdi, coriandoli, badge o animazioni celebrative
**And** non usa punti esclamativi né emoji

**Given** una giornata in cui la pila arriva a zero
**When** lo streak viene ricalcolato
**Then** quella giornata conta, ancorata alla mezzanotte del fuso del dispositivo

### Story 2.20: L'intera sessione senza mouse

As a utente che studia sul portatile,
I want percorrere la sessione interamente da tastiera,
So that non debba mai spostare la mano.

**Acceptance Criteria:**

**Given** una sessione in corso
**When** l'utente preme spazio
**Then** la risposta viene rivelata

**Given** un item rivelato
**When** l'utente preme `1`, `2`, `3` o `4`
**Then** l'item viene valutato rispettivamente `again`, `hard`, `good`, `easy`

**Given** una sessione in corso
**When** viene ispezionata
**Then** esiste **una sola** live region `aria-live="polite"` che annuncia rivelazione e avanzamento

**Given** la sessione
**When** si percorre con il tasto Tab
**Then** l'ordine è card, poi i quattro pulsanti da sinistra a destra, nello stesso ordine dei tasti `1`–`4`
**And** ogni elemento interattivo mostra un anello di focus visibile

**Given** un test di componente
**When** viene eseguito
**Then** guida una sessione completa fino alla pila a zero usando solo la tastiera

**Given** la sessione su schermo mobile
**When** viene renderizzata
**Then** i quattro pulsanti stanno entro 120px dal bordo inferiore
**And** ogni bersaglio interattivo è alto almeno 56px

### Story 2.21: Le stesse schermate su telefono e portatile

As a utente che studia in metropolitana la mattina e sul portatile la sera,
I want le stesse funzioni su entrambi i dispositivi,
So that non debba imparare due prodotti.

**Acceptance Criteria:**

**Given** una larghezza inferiore a 640px
**When** una qualsiasi schermata viene renderizzata
**Then** usa colonna singola con gutter di 20px
**And** i quattro pulsanti di valutazione stanno nella fascia bassa

**Given** una larghezza fra 640px e 1024px
**When** una schermata viene renderizzata
**Then** il contenuto è in colonna singola centrata, limitata a `measure`

**Given** una larghezza di almeno 1024px
**When** una schermata viene renderizzata
**Then** il contenuto resta centrato a `measure` e **non** si allarga a riempire lo schermo

**Given** una qualsiasi funzione dell'applicazione
**When** viene cercata su telefono o su portatile
**Then** è presente su entrambi: nessuna funzione è esclusiva di una superficie

**Given** la card di studio con l'interlinea di `word-hero` a `1.75`
**When** viene renderizzata con una parola con okurigana (難しい), una con prefisso kana (お茶) e una con ruby di gruppo su nucleo lungo (日本語)
**Then** la furigana non collide con la riga superiore e non viene tagliata, su entrambe le larghezze estreme
**And** se collide, si alza l'interlinea — non si riduce il corpo della furigana, già al suo minimo di leggibilità

---

## Epic 3: La sessione sopravvive alla galleria

La valutazione data senza rete non si perde, si sincronizza da sola al ritorno del campo, e sopravvive alla chiusura dell'applicazione.

### Story 3.1: La sessione si carica tutta in una volta

As a utente che sta per entrare in metropolitana,
I want che la sessione abbia già tutto quello che le serve quando parte,
So that perdere il campo a metà non la interrompa.

**Acceptance Criteria:**

**Given** l'utente avvia una sessione
**When** la sessione si inizializza
**Then** l'intera pila dovuta viene caricata in memoria in quel momento

**Given** la sessione avviata
**When** l'utente avanza di item in item
**Then** nessun item richiede una richiesta di rete per essere mostrato

**Given** il precarico
**When** interroga la pila
**Then** usa la stessa chiave TanStack `['due', userId]` del conteggio della dashboard

### Story 3.2: La coda sopravvive alla chiusura dell'app

As a utente che chiude il browser con valutazioni non ancora inviate,
I want ritrovarle in coda alla riapertura,
So that non perda il lavoro fatto senza rete.

**Acceptance Criteria:**

**Given** il bootstrap dell'applicazione in `src/app/`
**When** il client viene configurato
**Then** la `mutationFn` delle valutazioni è registrata con `setMutationDefaults(['review'], …)`
**And** **non** è registrata dentro un componente

**Given** valutazioni date senza rete
**When** vengono prodotte
**Then** si accodano localmente e la coda viene persistita su IndexedDB con `throttleTime` non superiore a 250 ms

**Given** l'applicazione chiusa con la coda non vuota
**When** viene riaperta
**Then** la coda è ancora presente e il drenaggio parte automaticamente
**And** la reidratazione non fallisce con `No mutationFn found`

### Story 3.3: Il ritorno della rete non chiede il permesso

As a utente che esce dalla galleria,
I want che le valutazioni si sincronizzino da sole e nell'ordine giusto,
So that non debba fare niente e lo stato resti coerente.

**Acceptance Criteria:**

**Given** valutazioni in coda
**When** la rete torna disponibile
**Then** `resumePausedMutations()` viene invocata automaticamente, e lo è anche all'avvio dell'applicazione

**Given** più valutazioni in coda
**When** vengono drenate
**Then** ogni mutation porta `scope: { id: 'review-sync' }` e la coda si drena in serie, preservando l'ordine

**Given** una valutazione data senza rete e sincronizzata mezz'ora dopo
**When** viene applicata
**Then** produce lo stesso `due_at` che avrebbe prodotto al momento della valutazione
**And** il drenaggio non ricalcola nulla

**Given** un fallimento di invio
**When** si verifica
**Then** il ritentativo è automatico e non esiste alcun pulsante "riprova" nell'interfaccia

### Story 3.4: Un indicatore che non spaventa

As a utente,
I want sapere che qualcosa è in attesa di sincronizzazione senza esserne interrotto,
So that non scambi il funzionamento previsto per un guasto.

**Acceptance Criteria:**

**Given** valutazioni in coda
**When** l'indicatore viene renderizzato
**Then** deriva da `useMutationState`, non da uno stato proprio del componente

**Given** la coda vuota
**When** l'interfaccia viene renderizzata
**Then** l'indicatore è **assente**, non mostra "tutto sincronizzato"

**Given** l'indicatore visibile
**When** viene ispezionato
**Then** non usa il colore di allarme, perché una valutazione in coda non è un errore
**And** non è un modale né un toast bloccante

**Given** più item accodati in rapida successione
**When** l'indicatore cambia stato
**Then** annuncia via `aria-live="polite"` una volta al cambio di stato, non a ogni item

### Story 3.5: Riapplicare la coda non falsa niente

As a utente,
I want che un doppio invio non conti le mie revisioni due volte,
So that le statistiche restino una misura e non un'approssimazione.

**Acceptance Criteria:**

**Given** una coda recuperata dopo la riapertura
**When** viene drenata due volte per un ritentativo
**Then** `review_log` non contiene righe duplicate

**Given** lo stesso `review_id` applicato due volte
**When** il secondo tentativo viene eseguito
**Then** lo stadio dell'item non avanza una seconda volta

**Given** uno scenario end-to-end che simula la perdita di rete, la chiusura dell'app e la riapertura
**When** viene eseguito
**Then** le valutazioni date offline risultano applicate esattamente una volta ciascuna

---

## Epic 4: Statistiche che dicono qualcosa di azionabile

L'utente vede le revisioni nel tempo, la distribuzione dei propri item per stadio, e riconosce i vocaboli che sbaglia più spesso.

### Story 4.1: Quante revisioni, e quando

As a utente che studia da settimane,
I want vedere l'andamento delle mie revisioni nel tempo,
So that capisca se sto mantenendo il ritmo.

**Acceptance Criteria:**

**Given** una cronologia di revisioni
**When** l'utente apre le statistiche
**Then** vede le revisioni nel tempo

**Given** il grafico
**When** i dati vengono raccolti
**Then** derivano **esclusivamente** da `review_log`
**And** `review_count` in `review_state` non viene usato come fonte

**Given** la schermata delle statistiche
**When** viene renderizzata
**Then** la barra di attribuzione del dataset è presente

### Story 4.2: A che punto sono i miei item

As a utente,
I want vedere quanti dei miei vocaboli stanno a ciascuno stadio,
So that capisca quanto del mio studio è consolidato e quanto è ancora fragile.

**Acceptance Criteria:**

**Given** item a stadi diversi
**When** l'utente apre le statistiche
**Then** vede la distribuzione degli item per stadio di scheduling

**Given** l'asse degli stadi
**When** viene costruito
**Then** deriva dalla stessa costante di `AD-17` esportata da `src/domain/schedule.ts`
**And** mostra esattamente sei stadi, `0`–`5`, senza un elenco parallelo nel codice della vista

### Story 4.3: Quali parole non mi entrano in testa

As a utente,
I want riconoscere i vocaboli che sbaglio più spesso,
So that possa dedicargli attenzione invece di subirli.

**Acceptance Criteria:**

**Given** una cronologia con esiti `again` ripetuti su alcuni item
**When** l'utente apre le statistiche
**Then** vede l'elenco degli item sbagliati più di frequente, con la parola giapponese e il suo significato

**Given** l'elenco
**When** i dati vengono calcolati
**Then** derivano da `review_log`
**And** `lapse_count` in `review_state` non viene usato come fonte, per non produrre due numeri entrambi difendibili e diversi

**Given** una parola nell'elenco
**When** viene renderizzata
**Then** porta `lang="ja"` e mostra la furigana

### Story 4.4: Un grafico vuoto non è una risposta

As a utente appena iscritto,
I want capire perché le statistiche sono vuote,
So that non pensi che l'applicazione sia rotta.

**Acceptance Criteria:**

**Given** dati insufficienti per un grafico
**When** la vista viene renderizzata
**Then** dichiara **cosa manca e quanto** — per esempio "servono almeno 3 giorni di revisioni"

**Given** una qualsiasi delle tre viste statistiche
**When** non ha abbastanza dati
**Then** non mostra un riquadro di grafico vuoto né una schermata muta

---

## Epic 5: Lancio pubblico difendibile

Il progetto è pubblicamente utilizzabile e pubblicamente ispezionabile: privacy policy, licenze di codice e dati separate e rispettate, README che spiega le scelte, percorso completo verificato end-to-end.

### Story 5.1: Dire cosa si tiene e come cancellarlo

As a sconosciuto che sta per consegnare la propria email,
I want leggere cosa viene memorizzato prima di registrarmi,
So that possa decidere con cognizione.

**Acceptance Criteria:**

**Given** la pagina di privacy policy
**When** viene letta
**Then** dichiara che vengono memorizzati soltanto email, hash della password, stato di revisione, log delle revisioni e preferenze
**And** dichiara che non vengono raccolti nome, data di nascita né analitica sul singolo individuo

**Given** la pagina
**When** viene letta
**Then** spiega come cancellare l'account e dichiara che la cancellazione distrugge anche il log delle revisioni

**Given** la schermata di Accesso
**When** viene renderizzata
**Then** contiene un collegamento alla privacy policy, raggiungibile **prima** della registrazione

**Given** Impostazioni
**When** viene renderizzata
**Then** contiene anch'essa un collegamento alla privacy policy

### Story 5.2: Due licenze, perché sono due cose diverse

As a chiunque ispezioni il repository,
I want vedere dichiarata separatamente la licenza del codice e quella dei dati,
So that possa riusare l'uno o gli altri sapendo a quali condizioni.

**Acceptance Criteria:**

**Given** la radice del repository
**When** viene ispezionata
**Then** contiene `LICENSE` con la licenza MIT del codice e `LICENSE-DATA` con la CC BY-SA 4.0 ereditata dalla fonte del dataset, come due file distinti

**Given** il README
**When** viene letto
**Then** dichiara esplicitamente che le due licenze sono separate e perché

**Given** il README
**When** viene letto
**Then** risponde alle sette domande della traccia: cos'è il progetto, perché Leitner e non SM-2 o FSRS, perché il livello di dominio non dipende dal framework, perché Supabase e cosa cambierebbe su scala maggiore, perché le licenze sono separate, cosa è stato lasciato fuori e perché, e come è stato usato il flusso di lavoro assistito da AI — cosa è stato delegato, cosa rifiutato, dove è costato più tempo di quanto ne abbia risparmiato

### Story 5.3: Il percorso completo, verificato da una macchina

As a proprietario del progetto,
I want che il percorso principale sia coperto da un test end-to-end,
So that una regressione si scopra in CI e non dall'uso.

**Acceptance Criteria:**

**Given** la suite Playwright
**When** viene eseguita contro staging
**Then** un test copre registrazione → introduzione di nuovi item → studio → pila a zero

**Given** un run di test end-to-end
**When** viene avviato
**Then** crea utenti con email univoca per quel run
**And** non usa fixture condivise né utenti di test permanenti

**Given** un run di test end-to-end
**When** termina
**Then** rimuove gli utenti creati tramite la stessa Edge Function di cancellazione account

**Given** la pipeline su una pull request
**When** viene eseguita
**Then** applica le migrazioni a staging e poi esegue i test end-to-end contro staging

### Story 5.4: La cancellazione, verificata tabella per tabella

As a utente che se ne va,
I want la prova che non sia rimasto niente,
So that la promessa non poggi solo sulle chiavi esterne.

**Acceptance Criteria:**

**Given** un utente con dati in `review_state`, `review_log` e `user_settings`
**When** cancella il proprio account
**Then** un test end-to-end interroga **ciascuna** delle tre tabelle e verifica che non resti alcuna riga per quell'utente

**Given** l'account cancellato
**When** il test tenta di riaccedere con le stesse credenziali
**Then** l'accesso fallisce

**Given** la verifica
**When** viene scritta
**Then** controlla le tabelle esplicitamente, senza dedurre il risultato dalla presenza di un vincolo `on delete cascade`

### Story 5.5: Provare l'app con uno screen reader vero

As a utente che non vede lo schermo,
I want che la sessione di studio sia percorribile e comprensibile,
So that l'accessibilità dichiarata sia stata misurata e non solo ragionata.

**Acceptance Criteria:**

**Given** la sessione di studio
**When** viene percorsa con NVDA o VoiceOver
**Then** la parola giapponese viene pronunciata una sola volta, non due, confermando che `aria-hidden` sul `<rt>` è corretto

**Given** la sessione
**When** viene percorsa con uno screen reader
**Then** rivelazione della risposta e avanzamento vengono annunciati dalla live region

**Given** la verifica
**When** viene completata
**Then** l'esito è registrato per iscritto nel repository, inclusi gli eventuali difetti trovati
**And** è l'unica affermazione di accessibilità del progetto che non sia coperta da un test automatico
