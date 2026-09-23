---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-tsundoku-zero-2026-09-22/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-08-19/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-09-22/SPINE-DELTA.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-tsundoku-zero-2026-08-19/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-tsundoku-zero-2026-08-19/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-tsundoku-zero-2026-09-22/UX-DELTA.md'
---

# tsundoku-zero - Epic Breakdown

## Overview

Questo documento fornisce la scomposizione completa in epiche e storie per **tsundoku-zero**, traducendo i requisiti del PRD, del contratto UX e dell'Architecture Spine in storie implementabili.

**Il progetto ha virato il 22 settembre 2026.** Il prodotto non è più un SRS di vocabolario N5 ma un **generatore di esercizi di grammatica giapponese** alimentato lezione per lezione dallo studio dell'owner. La scomposizione precedente è conservata in `_bmad-output/.backup-pre-pivot-2026-09-22/`.

**Documenti di input e come si compongono.** Il PRD vigente è quello del 22 settembre; quello del 19 agosto è superato e escluso. L'architettura è letta come **coppia**: `ARCHITECTURE-SPINE.md` del 19 agosto porta i 12 invarianti intatti, le convenzioni e l'albero sorgente; `SPINE-DELTA.md` del 22 settembre porta il verdetto su ciò che cambia e i 5 invarianti nuovi. In conflitto **vince il delta**. Il contratto UX si legge allo stesso modo: `DESIGN.md` + `EXPERIENCE.md` del 19 agosto, corretti da `UX-DELTA.md` del 22 settembre.

**Documenti esclusi deliberatamente:** `product-brief-tsundoku-zero.md` (identico a `tsundoku-zero-brief.md` nella radice) descrive il prodotto pre-pivot ed è superato due volte. `addendum.md` del 19 agosto è escluso come modello dati — che il pivot ha sostituito — ma le sue sezioni §4 (alternative di scheduling scartate) e §6 (traccia del README) restano vincolanti e sono riportate fra i requisiti aggiuntivi.

## Prerequisiti di provisioning

Nessuna storia copre la creazione degli account e dei progetti esterni, **ed è deliberato**: richiedono OAuth interattivo e scelte sul profilo dell'owner, quindi una sessione automatica non può eseguirle. Restano qui perché il piano le dia per verificate invece che per assunte — la storia 1.1 presuppone un repository, la 1.2 un progetto Vercel collegato, la 1.5 un progetto Supabase.

| Prerequisito | Stato al 2026-09-23 |
|---|---|
| Repository git locale con `.gitignore` | ✅ `main`, transcript e skill BMad esclusi |
| Repository GitHub pubblico | ✅ `github.com/fcport/tsundoku-zero` |
| Progetto Supabase di produzione | ✅ `tsundoku-zero`, West EU (Ireland) |
| Progetto Vercel collegato al repository | ✅ scope personale `fcdev's projects`, integrazione GitHub attiva |
| Secret in GitHub Actions | 🟡 impostati `SUPABASE_PROJECT_REF`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` · mancano `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` |
| ~~`VERCEL_TOKEN`~~ | ➖ non serve: con l'integrazione Git, Vercel pubblica da sé — Actions non fa deploy |
| `.env.example` versionato | ✅ nomi documentati, nessun valore |
| `.env` locale | ⬜ da compilare con i valori del progetto Supabase |

**Nessuna variabile di questo elenco contiene la `service_role`** lato client: `AD-11` la confina alla Edge Function, e la chiave vive solo nei secret del progetto Supabase.

## Requirements Inventory

### Functional Requirements

**F1 — Account e identità** *(invariata rispetto al prodotto pre-pivot)*

- FR1.1: L'utente può registrarsi con email e password.
- FR1.2: L'utente può accedere e disconnettersi.
- FR1.3: La sessione persiste fra riavvii del browser fino a disconnessione esplicita.
- FR1.4: L'utente può cancellare definitivamente il proprio account; la cancellazione rimuove **tutti** i suoi dati di studio.
- FR1.5: Il sistema comunica in modo comprensibile i fallimenti prevedibili: password errata, email già registrata, password troppo debole, email in formato non valido.
- FR1.6: Le rotte che espongono dati dell'utente sono raggiungibili solo da utenti autenticati; un accesso non autenticato viene reindirizzato al login.

**F2 — Contenuto: lezioni ed esercizi**

- FR2.1: Il sistema distribuisce un insieme di **lezioni** versionate nel repository, in sola lettura per gli utenti. Una lezione ha un numero d'ordine, un titolo, i punti grammaticali che insegna e zero o più esercizi.
- FR2.1a: Titolo e identificatore di una lezione derivano dal **punto grammaticale che insegna**, mai dal numero o dal titolo di un episodio di una fonte esterna.
- FR2.2: Ogni esercizio espone: il tipo, il contenuto giapponese necessario a presentarlo, la risposta corretta, i distrattori quando previsti dal tipo, e una **spiegazione** che dice perché la risposta è quella.
- FR2.3: Ogni frase giapponese di un esercizio espone kanji e kana separati, così che la furigana sia derivabile nel dominio.
- FR2.4: Una lezione **può non avere esercizi** e resta comunque parte del curriculum.
- FR2.5: Il contenuto può essere corretto o riautorato **senza toccare il progresso di nessun utente** sugli esercizi che non sono cambiati.
- FR2.6: Un esercizio o una lezione malformati non raggiungono la produzione: la validazione è parte dell'integrazione continua.

**F3 — La pila (dashboard)**

- FR3.1: La dashboard mostra quanti esercizi sono dovuti in questo momento.
- FR3.2: La dashboard mostra lo streak corrente.
- FR3.3: La dashboard espone **una sola** azione primaria.
- FR3.4: Quando la pila è vuota, l'azione primaria diventa sbloccare la lezione successiva; se non ci sono altre lezioni disponibili, la dashboard lo dichiara esplicitamente.
- FR3.5: Quando l'utente non ha **mai** sbloccato alcuna lezione, la dashboard presenta uno stato di primo avvio **distinto** da quello di pila svuotata.
- FR3.6: La dashboard indica a che punto del curriculum si trova l'utente: quante lezioni ha sbloccato su quante ne esistono.

**F4 — Sessione di esercizi**

- FR4.1: Gli esercizi sono presentati uno alla volta.
- FR4.2: Viene mostrata la consegna; l'utente risponde con un'azione esplicita. La risposta è una scelta fra opzioni presentate, non testo libero.
- FR4.3: Dopo la risposta il sistema dichiara se è corretta e mostra la spiegazione di FR2.2.
- FR4.4: La sessione termina quando la pila raggiunge zero, con una schermata di completamento.
- FR4.5: Durante la sessione è sempre visibile quanto manca alla fine.
- FR4.6: L'utente può abbandonare la sessione in qualsiasi momento; le risposte già date restano acquisite.
- FR4.7: L'utente può avviare una nuova sessione sugli esercizi ancora dovuti in qualsiasi momento successivo, senza penalità.
- FR4.8: L'utente può consultare la spiegazione **prima** di rispondere; non è vietato ed è registrato, perché cambia il significato della risposta.

**F5 — Scheduling**

- FR5.1: Rispondere a un esercizio aggiorna la sua data di prossima revisione secondo l'algoritmo di scheduling.
- FR5.2: **L'esito è derivato, non dichiarato.** Funzione pura della risposta: `again` se sbagliata; `hard` se corretta dopo aver consultato la spiegazione; `good` se corretta senza aiuto; `easy` se corretta senza aiuto e dichiarata tale dall'utente.
- FR5.3: Semantica degli esiti sugli stadi: `again` torna allo stadio iniziale e incrementa le ricadute; `good` avanza di uno; `easy` di due; `hard` mantiene lo stadio a intervallo ridotto.
- FR5.4: Gli stadi **saturano** ai due estremi.
- FR5.5: Un intervallo pari a zero significa "di nuovo in questa sessione": l'esercizio torna in fondo alla coda corrente.
- FR5.6: Le date di scadenza ricevono una dispersione deterministica.
- FR5.7: Ogni risposta viene registrata in un log **append-only**, e porta con sé il punto grammaticale dell'esercizio.

**F6 — Progressione del curriculum**

- FR6.1: Quando la pila dovuta è vuota, l'utente può **sbloccare** la lezione successiva non ancora sbloccata.
- FR6.2: Sbloccare una lezione materializza subito i suoi esercizi come dovuti.
- FR6.3: Le lezioni si sbloccano **in ordine**: la progressione è sequenziale, non si salta.
- FR6.4: Una lezione senza esercizi si sblocca comunque, non aggiunge nulla alla pila, e l'interfaccia dice perché.
- FR6.5: Un tetto giornaliero configurabile limita quante lezioni si possono sbloccare in una giornata, predefinito 1.
- FR6.6: L'utente può modificare il tetto da un'impostazione.

**F7 — Statistiche e streak**

- FR7.1: Una vista statistiche mostra le risposte nel tempo.
- FR7.2: La stessa vista mostra la distribuzione degli esercizi per stadio di scheduling.
- FR7.3: La stessa vista mostra **i punti grammaticali con il tasso di errore più alto**, non i singoli esercizi.
- FR7.4: Una giornata conta per lo streak quando l'utente porta la pila a zero, oppure completa almeno un esercizio se la pila era già vuota. La giornata termina a mezzanotte nel fuso locale del dispositivo.
- FR7.5: Con dati insufficienti la vista dichiara cosa manca, invece di mostrare grafici vuoti.

**F8 — Lingua**

- FR8.1: L'interfaccia è disponibile in inglese e italiano.
- FR8.2: La lingua è commutabile a runtime, senza ricaricare la pagina.
- FR8.3: La scelta è persistita per utente e vale su tutti i suoi dispositivi.
- FR8.4: Nessuna stringa visibile all'utente è cablata nel codice.
- FR8.5: Le **spiegazioni** degli esercizi sono contenuto, non interfaccia: vivono bilingui nel file di lezione. Una lezione priva dell'italiano è valida e ricade sull'inglese, dichiarandolo.

**F9 — Resilienza di rete** *(invariata rispetto al prodotto pre-pivot)*

- FR9.1: All'avvio della sessione, l'intera pila dovuta viene caricata in memoria.
- FR9.2: Le risposte date senza rete vengono accodate localmente.
- FR9.3: Al ritorno della rete la coda viene sincronizzata automaticamente.
- FR9.4: Uno stato di sincronizzazione in sospeso è visibile ma non invasivo.
- FR9.5: Se l'applicazione viene chiusa con risposte non sincronizzate, la coda viene recuperata alla riapertura.
- FR9.6: La sincronizzazione è idempotente: riapplicare la stessa coda non produce risposte duplicate.

**F10 — Trasparenza e licenza**

- FR10.1: Una pagina di privacy policy dichiara quali dati sono memorizzati e come cancellarli.
- FR10.2: Una pagina di riconoscimenti attribuisce a Cure Dolly l'origine del modello grammaticale, con collegamento al canale, e dichiara che il contenuto degli esercizi è originale del progetto.
- FR10.3: La licenza del codice e quella del contenuto delle lezioni sono dichiarate separatamente, in file distinti.

**F11 — Pipeline di autorazione** *(capacità nuova)*

- FR11.1: Esiste un flusso documentato e ripetibile che, da una lezione vista, produce un file di lezione conforme allo schema.
- FR11.2: Il flusso è assistito da un LLM in autorazione e prevede una **revisione umana obbligatoria** prima del commit.
- FR11.3: Aggiungere una lezione **non richiede modifiche al codice**. Aggiungere un *tipo* di esercizio le richiede, insieme al validatore e ai test.
- FR11.4: Il file di una lezione è validato contro uno schema; un file malformato fallisce la CI.
- FR11.5: L'identificatore di un esercizio è **derivato dal suo contenuto**.
- FR11.6: Il registro dei tipi di esercizio è **chiuso**: una lezione non può introdurre un tipo che il dominio non dichiara.
- FR11.7: Transcript, sottotitoli e trascrizioni della fonte sono **input privato** e non entrano mai nel repository; l'esclusione è dichiarata in `.gitignore`.
- FR11.8: Prima del commit, ogni frase e spiegazione prodotte sono confrontate automaticamente con il testo di partenza; ogni sovrapposizione non banale è segnalata e riscritta. **Non può essere un cancello di CI**, perché FR11.7 tiene il transcript fuori dal repository.

**Totale: 67 requisiti funzionali.**

### NonFunctional Requirements

- NFR1 — **Sicurezza dei tipi.** TypeScript in modalità strict. Nessun `any` nel codice applicativo.
- NFR2 — **Purezza del dominio.** Motore di scheduling **e valutazione delle risposte** sono funzioni pure senza dipendenze da UI, rete, orologio o database. Istante e fuso sempre iniettati.
- NFR3 — **Copertura di test.** Scheduling testato a fondo con casi limite. **Ogni tipo di esercizio ha i test del suo validatore.** Flusso di esercizio con test di componente. Un e2e copre registrazione → sblocco lezione → esercizi → pila a zero.
- NFR4 — **Accessibilità.** Schermata di esercizio interamente operabile da tastiera. ARIA corretti. Risposta e avanzamento annunciati via live region. Giapponese marcato con l'attributo di lingua.
- NFR5 — **Isolamento dei dati.** Isolamento a livello di riga su ogni tabella per-utente, verificato da un test esplicito.
- NFR6 — **Privacy.** Solo email, hash password e dati di studio. Nessuna analitica sul singolo individuo.
- NFR7 — **Prestazioni percepite.** La schermata risponde senza attesa visibile. Aggiornamenti ottimistici, persistenza in background.
- NFR8 — **Licenza e attribuzione.** Codice e contenuto con licenze dichiarate separatamente e rispettate entrambe.
- NFR9 — **Costo di autorazione.** La pipeline di F11 regge 90 lezioni senza degradare: nessun passaggio manuale il cui costo cresca con il numero di lezioni già autorate. Condizione di sopravvivenza del prodotto (M5 ≤ 30 minuti per lezione).

### Additional Requirements

Dall'Architecture Spine e dallo Spine Delta. Ogni voce è un invariante citabile per ID e vincola le storie.

**⚠️ Nessun starter template.** Né lo Spine né il Delta specificano un template greenfield: nominano Vite e React come componenti dello Stack, non uno scaffold da clonare. La prima storia è quindi uno **scaffold manuale**, non un `degit`/`create-*`. Va detto esplicitamente perché è la deviazione più comune.

**Struttura e confini**

- `AD-1` — Nucleo di dominio puro, dipendenze a senso unico. `src/domain/` non importa React, Supabase, `fetch`, storage o orologio. Imposto da `eslint-plugin-boundaries`: una violazione è CI rossa. `dependency-cruiser` genera `docs/dependency-graph.svg`.
- `AD-2` — *(modificato)* Le porte sono dichiarate dal dominio in `src/domain/ports/`. `VocabularyRepository` diventa **`ContentRepository`**; si aggiunge **`ProgressRepository`** per le lezioni sbloccate. Restano `ReviewRepository`, `SettingsRepository`, `Clock`. Solo `src/data/` le implementa.
- `AD-20` — Vincolo di dimostrabilità: nessuna storia può rimuovere una voce dello Stack per semplificare.
- Cinque livelli: `domain` → `data` → `ui` → `features` → `app`. `features` **non** importa `data`.

**Tempo e determinismo**

- `AD-3` — Il tempo è un parametro, mai un ambiente. Ogni funzione di dominio che dipende dal tempo riceve `now: Date` **e** `timeZone: string`.
- `AD-4` — *(rafforzato)* Determinismo senza casualità. Si estende alla **selezione degli esercizi** e all'**ordine dei distrattori**, che non può essere casuale se i test devono essere stabili. Nessun `Math.random()` sotto `src/domain/`.
- `AD-17` — La scala degli stadi è una sola costante esportata da `src/domain/schedule.ts`: stadi `0`–`5`, intervalli `0, 1, 3, 7, 16, 35` giorni. Il `CHECK` SQL e l'asse di FR7.2 derivano da lì.

**Contenuto ed esercizi** *(invarianti nuovi)*

- `AD-22` — **Il registro dei tipi di esercizio è chiuso e vive nel dominio.** Union discriminata in `src/domain/exercise.ts`; ogni tipo porta la forma dei dati, un validatore puro `check(exercise, response): Outcome`, e i suoi test. Un `kind` sconosciuto è errore di validazione dello schema, non un caso ignorato a runtime.
- `AD-23` — **Identità dell'esercizio derivata dal contenuto.** `uuidv5` su una chiave naturale costruita da tipo, frase e risposta corretta, normalizzata NFKC — **esclusi** spiegazione e distrattori, così che correggere un refuso non cambi l'identità mentre cambiare la frase sì. Un test verifica entrambe le direzioni.
- `AD-24` — **L'esito è calcolato, non dichiarato.** `outcomeOf(response, usedExplanation, declaredEasy)` puro in `src/domain/`. Nessun altro punto del sistema decide un esito. Calcolabile interamente sul client e senza rete.
- `AD-25` — **Il contenuto delle lezioni è dato validato, mai codice.** File in `content/lessons/`, schema unico da cui derivano tipo TypeScript e validatore a runtime. Validazione in CI che blocca il merge: schema, `kind` nel registro, spiegazione inglese presente, unicità degli id di `AD-23`, coerenza `kanji`/`kana` per `AD-21`.
- `AD-26` — **Sbloccare una lezione materializza i suoi esercizi.** Riga `review_state` per ciascun esercizio con `stage = 0` e `due_at` = istante di sblocco, più una riga `lesson_progress`. "Mai incontrato" significa assenza di riga. Una lezione senza esercizi produce la sola riga di progresso.

**Dati e persistenza**

- `AD-5` — Una sola definizione di "dovuto". `isDue(state, now)` pura; dashboard, precarico di sessione e cancello di sblocco leggono la **stessa chiave** TanStack.
- `AD-7` — *(modificato)* Una risposta è una sola chiamata, transazionale e idempotente. RPC `apply_review(review_id, exercise_id, outcome, stage, due_at, reviewed_at, used_explanation)` con `ON CONFLICT (review_id) DO NOTHING`; aggiorna `review_state` solo se l'insert ha prodotto una riga. Nessuna logica di scheduling in SQL.
- `AD-10` — *(esteso)* RLS su `review_state`, `review_log`, `user_settings` e **`lesson_progress`**, policy `user_id = auth.uid()` su tutte le operazioni. Il contenuto ha RLS abilitata in sola lettura, nessuna policy di scrittura. Test di integrazione: A non legge le righe di B.
- `AD-12` — *(modificato)* Migrazioni versionate in `supabase/migrations/`. Nessuna modifica dallo Studio. **Un solo progetto Supabase, quello reale**: niente staging e niente istanza locale. Le migrazioni vi sono applicate **al merge su `main`**, mai da un ramo di pull request — i dati di studio dell'owner sono ciò che `M1` misura, e una migrazione rotta da una PR li distruggerebbe insieme alla metrica di accettazione del progetto. Conseguenza dichiarata: una PR che introduce un cambio di schema vede i propri e2e solo dopo il merge.
- `AD-18` — *(rafforzato)* Le statistiche derivano **solo** da `review_log`, che acquisisce `grammar_point` denormalizzato — perché FR7.3 deve restare interrogabile anche dopo che un esercizio è stato riautorato e ha cambiato identità. Lo streak è sempre derivato dal log, mai memorizzato.

**Stato e resilienza**

- `AD-6` — Zustand ospita, il dominio decide. Lo store di sessione delega a `sessionReducer()` in `src/domain/`. Lo store **non** è persistito.
- `AD-8` — La coda offline è TanStack Query con quattro vincoli: `setMutationDefaults(['review'], …)` al bootstrap in `src/app/` e mai in un componente; `scope: { id: 'review-sync' }` su ogni mutation; persister IndexedDB con `throttleTime ≤ 250 ms`; `resumePausedMutations()` all'avvio e al ritorno online, indicatore da `useMutationState`.

**Sicurezza, ambienti, licenza**

- `AD-11` — La cancellazione account passa da una Edge Function `delete-account` autenticata con `service_role`, mai in codice client né in variabili `VITE_*`. È l'**unico** codice server del progetto — invariante riconfermato dal divieto di LLM a runtime.
- `AD-13` — *(promosso a portante)* I test e2e non condividono dati: email univoca per run, rimozione tramite la stessa Edge Function di `AD-11`. **Girando contro il database reale, questa regola smette di essere igiene e diventa l'unica difesa** fra la suite di test e i dati di studio dell'owner. Una pulizia che fallisce lascia righe di `review_log` che falsano le statistiche di `F7`: il teardown va verificato, non sperato.
- `AD-16` — *(allentato)* Senza JMdict cade l'obbligo EDRDG di attribuzione per schermata. Diventa pagina di riconoscimenti (FR10.2). `LICENSE` e `LICENSE-CONTENT` restano file separati e dichiarati nel README.
- `AD-14` — *(modificato)* Nessuna stringa visibile cablata; chiavi tipizzate via `CustomTypeOptions` di i18next, una chiave inesistente è errore di compilazione. Confine a tre: **interfaccia da `t()`, contenuto dal file di lezione, giapponese da nessuno dei due**.
- `AD-15` — *(da riscrivere)* L'accessibilità della sessione è un contratto. Il contratto vecchio — spazio rivela, `1`–`4` valutano — non descrive più il prodotto; sopravvive solo Esc. Resta valida una sola live region `aria-live="polite"` per sessione e un test di componente che guida una sessione completa da sola tastiera.
- `AD-21` — La furigana è segmentata nel dominio. `alignFurigana(kanji, kana): FuriganaSegment[]` pura in `src/domain/furigana.ts`: toglie prefisso e suffisso di kana comuni e applica ruby di gruppo al nucleo. Tre classi da testare — okurigana (難しい), prefisso kana (お茶), jukujikun (今日, 大人, 一人). Limite accettato: sokuon interno al nucleo. `src/ui/` riceve segmenti già calcolati.

**Vincoli di stack e ambiente**

- **Framework: Vite + React, non Next.** Valutato e scartato: niente da renderizzare sul server (ogni schermata è dietro autenticazione), un secondo confine ortogonale ad `AD-1`, e le API route come porta aperta su `AD-11`. Condizione di revisione: se i punti grammaticali diventassero pagine pubbliche indicizzabili.
- **Hosting: Vercel**, non Netlify. Richiede `vercel.json` con rewrite verso `index.html` per i deep link. Piano Hobby: uso commerciale vietato, limite dichiarato.
- TypeScript resta su **5.9.3**, non 7.x: senza API programmatica stabile non esiste `typescript-eslint`, quindi non esiste la regola meccanica di `AD-1`.
- `npm` con `package-lock.json` versionato. La CI usa `npm ci`, mai `npm install`.
- Configurazione solo da `import.meta.env.VITE_*`, validata con uno schema all'avvio in `src/app/`.
- **Un solo progetto Supabase**, quello reale, usato da sviluppo, CI ed e2e. Nessun keep-alive contro la pausa a 7 giorni del piano gratuito — non serve: la CI che gira su ogni PR lo tiene sveglio da sola.
- **Limite accettato e da dichiarare nel README:** i test end-to-end girano contro il database che contiene i dati di studio veri. È la configurazione che si vuole esercitare davvero — Auth, RLS e limiti sono quelli di produzione, non un'approssimazione — e il prezzo è che la correttezza del teardown di `AD-13` diventa portante.
- Nessun SDK di analitica o error tracking di terze parti (`NFR6`).
- Catena di deploy: PR → lint/typecheck/unit/validazione lezioni → Playwright e2e contro Supabase reale, **schema corrente** → anteprima Vercel → merge → migrazioni applicate a Supabase → e2e di collaudo post-merge → Vercel produzione.

**Dall'addendum del 19 agosto, ancora vincolante**

- **Alternative di scheduling scartate**, da riportare nel README: SM-2 (più complesso da difendere, sovradimensionato) e FSRS (richiede dati di calibrazione che un utente al giorno zero non ha). Entrambe restano raggiungibili perché `AD-1` le confina a un modulo.
- **Traccia del README**, sette domande: cos'è il progetto; perché Leitner e non SM-2 o FSRS; perché il dominio non dipende dal framework; perché Supabase e cosa cambierebbe su scala maggiore; perché le licenze sono separate; cosa è stato lasciato fuori e perché; **come è stato usato il flusso assistito da AI — cosa delegato, cosa rifiutato, dove è costato più tempo di quanto ne abbia risparmiato**.

### UX Design Requirements

Da `DESIGN.md` + `EXPERIENCE.md`, corretti da `UX-DELTA.md`. Ogni voce è abbastanza specifica da generare una storia con criteri verificabili.

**Design token**

- UX-DR1: Implementare il sistema colore completo — **27 token**, 14 chiari e 13 scuri, con i valori letterali di `DESIGN.md`. Nessun colore ha la sua unica definizione dentro un blocco `prefers-color-scheme: dark`.
- UX-DR2: Implementare la scala tipografica di `DESIGN.md` — 13 ruoli. Due famiglie con confine netto: **Noto Sans JP** per il giapponese, **Inter** per l'interfaccia, ciascuna con stack di ripiego.
- UX-DR3: Implementare la scala di spaziatura a 4px (`1`–`8`) più i token nominati `gutter-mobile` 20px, `gutter-desktop` 32px, `measure` 34rem, `thumb-zone` 120px.
- UX-DR4: Implementare la scala dei raggi: `sm` 4px, `md` 8px, `lg` 12px, `full` 9999px.
- UX-DR5: **Nessuna ombra nel sistema.** La separazione usa i bordi e il salto tonale fra `surface-base` e `surface-raised`.
- UX-DR6: **Due token di bordo non intercambiabili.** `border-hairline` (1.27:1) solo decorativo; `border-strong` (3.02:1) per il confine di ogni componente interattivo — ora i pulsanti di risposta. Un interattivo delimitato da `border-hairline` è un difetto di accessibilità.
- UX-DR7: Verifica automatica del contrasto in CI: ogni coppia colore/fondo su **entrambi** i fondi e in **entrambe** le modalità, fallendo sotto 4.5:1 per il testo e 3:1 per il non-testo.
- UX-DR8: **Un ruolo tipografico nuovo per il giapponese di frase.** `word-hero` a 64px è dimensionato per una parola sola; una frase di nove caratteri supera `measure` prima ancora della furigana, e manda a capo in punti arbitrari — dannoso su una lingua senza spazi fra le parole. Corpo e interlinea `[DA DECIDERE]`, vedi UX-DR34.
- UX-DR9: Una regola di lint segnala qualsiasi componente che scriva un valore colore letterale invece di un token. È la condizione che rende la modalità scura uno scambio di variabili e non una riscrittura.

**Componenti — sette sopravvivono, tre nuovi**

- UX-DR10: `pile-counter` — conteggio in `count-hero`, etichetta in `label-caps` **sotto** il numero. A zero non mostra "0": la dashboard cambia stato.
- UX-DR11: `button-primary` — al massimo **uno per schermata**. Piena larghezza su mobile, `accent` pieno, altezza minima 56px, testo verbale e concreto mai "Continua".
- UX-DR12: `exercise-card` — sostituisce `study-card`. Unica superficie `surface-raised` dell'app. **Tre stati**: consegna, risposta data, spiegazione. La transizione è a senso unico dentro l'esercizio corrente.
- UX-DR13: `answer-option` ×n — sostituisce `rating-button`. **Il numero è variabile secondo il tipo di esercizio**, non fisso a quattro: ogni assunzione di layout che dipendeva dal quattro va rifatta. Bersagli da 56px dentro `thumb-zone` su mobile.
- UX-DR14: `explanation-panel` — la spiegazione di FR2.2, mostrata dopo la risposta o consultata prima. È l'unico contenuto di prosa lunga dell'app: `body` a 16px va verificato su testo vero.
- UX-DR15: `curriculum-progress` — FR3.6, lezioni sbloccate su totale. Senza precedente nel contratto vecchio.
- UX-DR16: `progress-meter` — 4px, senza etichetta numerica. Rappresenta **il completato**, non il rimanente. Riflette lo stato ottimistico locale, non la conferma del server.
- UX-DR17: `sync-indicator` — deriva da `useMutationState`, non da uno stato proprio. **Assente** quando la coda è vuota, non "tutto sincronizzato". Non usa `danger`: una risposta in coda non è un errore.
- UX-DR18: `empty-state` — dichiara **perché** è vuoto e offre al massimo un'azione.
- UX-DR19: `streak-badge` — numero e unità, derivato da `review_log` a ogni lettura.
- UX-DR20: Pagina di riconoscimenti al posto di `attribution-bar` su ogni schermata (FR10.2, `AD-16` allentato).

**Struttura a quest**

- UX-DR21: La dashboard espone **due quest mai simultanee** — *svuota la pila*, poi *sblocca la lezione successiva* — sequenziate dal cancello di FR6.1. **Non mostrarle mai insieme, nemmeno una disabilitata.** Un pulsante grigio "non ancora" reintroduce la scelta che il cancello esiste per rimuovere.
- UX-DR22: **"Primo accesso" e "pila svuotata" sono lo stesso stato tecnico e devono essere due schermate diverse** (FR3.5). Il primo significa *comincia*, il secondo *hai finito*.

**Rendering del giapponese**

- UX-DR23: Furigana come `<ruby>`/`<rt>` con `<rp>` di ripiego, kana sopra i kanji, segmenti ricevuti già calcolati da `alignFurigana()` — **nessuna logica di allineamento in `src/ui/`**.
- UX-DR24: `lang="ja"` su ogni nodo che contiene giapponese. Il giapponese non passa da i18n: è dato, non interfaccia.
- UX-DR25: **Il romaji non compare mai nell'interfaccia**, e non esiste un'impostazione per riattivarlo.
- UX-DR26: **Quando mostrare la furigana va deciso per tipo di esercizio, non globalmente.** Nel prodotto vecchio era *la risposta*, quindi nascosta nel prompt; in un esercizio di grammatica è supporto alla lettura e nasconderla testerebbe i kanji mentre si crede di testare la grammatica. `[DA DECIDERE]`, vedi UX-DR34 — ricade su `AD-22` e sullo schema di lezione.

**Accessibilità**

- UX-DR27: WCAG 2.2 AA su tutta la superficie, in entrambe le modalità. AAA scartato: imporrebbe 7:1, che il fondo carta non regge.
- UX-DR28: Il ruby `<rt>` è `aria-hidden`, con `<rp>` come parentesi di ripiego. **Richiede una verifica manuale su NVDA o VoiceOver** — l'unica affermazione di accessibilità non coperta da un test automatico.
- UX-DR29: Una sola live region `aria-live="polite"` per sessione, che annuncia risposta e avanzamento. Una sola, non una per componente.
- UX-DR30: Ordine di tabulazione uguale all'ordine di lettura, e coerente con l'ordine dei tasti numerici.
- UX-DR31: **Nessuna opzione di risposta si distingue per solo colore**: etichetta e posizione portano l'informazione. Trasferimento del principio che valeva per i quattro esiti.
- UX-DR32: Anello di focus visibile su ogni elemento interattivo. Bersagli alti almeno 56px, nessuna eccezione su mobile.
- UX-DR33: `sync-indicator` è `aria-live="polite"` e annuncia **una volta** al cambio di stato, non a ogni risposta accodata.

**Decisioni UX aperte**

- UX-DR34: Cinque decisioni sono **deliberatamente rimandate a dopo l'autorazione di tre lezioni vere**, perché dipendono da quali tipi di esercizio esistono davvero (PRD `OQ-7`): (1) corpo e interlinea del ruolo tipografico di frase, e se `word-hero` sopravviva per gli esercizi a parola singola; (2) forma e numero massimo di `answer-option`, con il vincolo dei 56px dentro `thumb-zone`; (3) **come si comunica l'esito di una risposta, senza verde per il giusto né rosso per lo sbagliato**; (4) il contratto tastiera, che è anche un aggiornamento di `AD-15`; (5) quando mostrare la furigana, per tipo di esercizio.

  Nessuna è rifinitura: la 1 e la 2 determinano se una schermata di esercizio sta fisicamente su un telefono, la 3 se il prodotto tradisce la propria postura, la 5 se gli esercizi misurano la grammatica o la lettura dei kanji.

**Layout e responsive**

- UX-DR35: Tre breakpoint — `< 640px` telefono (superficie primaria, colonna singola, gutter 20px), `640–1024px` tablet (colonna centrata a `measure`), `≥ 1024px` portatile (centrato a `measure`, **non allargato**, statistiche eventualmente a due colonne).
- UX-DR36: Su mobile le opzioni di risposta stanno nella fascia bassa, entro `thumb-zone` (120px) dal bordo inferiore, mai in cima. Vincolo derivato da UJ-1: treno in movimento, una mano.
- UX-DR37: **Nessuna funzione è esclusiva di una superficie.**
- UX-DR38: Modalità scura come **pari**, non opzione secondaria, **senza interruttore**: segue `prefers-color-scheme`. Le impostazioni restano due — lingua e tetto di sblocco — più la cancellazione account.

**Voce e microcopy**

- UX-DR39: Il conteggio arriva prima del verbo — "23 da rivedere", non "hai 23 esercizi".
- UX-DR40: Nessun punto esclamativo, nessuna emoji, nessun avverbio di lode. Nessuna animazione celebrativa, nessun badge, **nessun verde di successo nel sistema**.
- UX-DR41: Un fallimento dice cosa è successo, non come sentirsi. I quattro fallimenti prevedibili di FR1.5 passano da un unico traduttore in `features/auth` verso chiavi i18n dedicate.

**Stati**

- UX-DR42: Implementare i **quattordici state pattern** di `EXPERIENCE.md`, tutti sopravvissuti al pivot, alcuni con il testo da riscrivere: caricamento a freddo (scheletro all'altezza finale, nessuno spinner), primo avvio, pila piena, pila a zero con lezioni disponibili, pila a zero con curriculum esaurito (**unica schermata senza azione primaria**), tetto di sblocco raggiunto, sessione in corso, esercizio ripresentato nella stessa sessione (**senza segnalazione**), coda vuota, sessione abbandonata (**nessun "riprendi dove eri"**), rete assente, riapertura con coda non svuotata, dati insufficienti nelle statistiche, errore prevedibile di autenticazione.
- UX-DR43: Tre stati **nuovi** da progettare: lezione senza esercizi sbloccata (FR6.4) — senza uno stato dedicato sembra che lo sblocco non abbia funzionato; risposta data con spiegazione mostrata (FR4.3); spiegazione consultata prima di rispondere (FR4.8) — l'interfaccia non deve far sentire in colpa, è un percorso previsto.

**Totale: 43 requisiti di design UX**, di cui uno (UX-DR34) raccoglie le cinque decisioni deliberatamente rimandate.

### FR Coverage Map

Ogni requisito funzionale è assegnato a esattamente un'epica. **67 su 67 coperti, nessun orfano.**

| FR | Epica | Dove atterra |
|---|---|---|
| FR1.1 | Epic 1 | Registrazione email e password |
| FR1.2 | Epic 1 | Accesso e disconnessione |
| FR1.3 | Epic 1 | Persistenza di sessione fra riavvii |
| FR1.4 | Epic 1 · verifica Epic 6 | Cancellazione account via Edge Function (`AD-11`) |
| FR1.5 | Epic 1 | Traduttore unico dei fallimenti prevedibili in `features/auth` |
| FR1.6 | Epic 1 | Guard di rotta unico in `src/app/` |
| FR2.1 | Epic 2 | Schema di lezione, contenuto versionato in `content/lessons/` |
| FR2.1a | Epic 2 | Identificatore e titolo derivati dal punto grammaticale |
| FR2.2 | Epic 2 | Forma dell'esercizio: tipo, contenuto, risposta, distrattori, spiegazione |
| FR2.3 | Epic 2 | `kanji` e `kana` separati nello schema, per `AD-21` |
| FR2.4 | Epic 2 · uso Epic 3 | Lezione senza esercizi ammessa dallo schema |
| FR2.5 | Epic 2 | Riautorazione non distruttiva via `AD-23` |
| FR2.6 | Epic 2 | Validazione in CI che blocca il merge (`AD-25`) |
| FR3.1 | Epic 3 | `pile-counter` sulla chiave condivisa (`AD-5`) |
| FR3.2 | Epic 3 | `streak-badge`, derivato da `review_log` (`AD-18`) |
| FR3.3 | Epic 3 | Azione primaria unica (`UX-DR11`) |
| FR3.4 | Epic 3 | Macchina a stati a due quest (`UX-DR21`) |
| FR3.5 | Epic 3 | Stato di primo avvio, distinto da pila svuotata (`UX-DR22`) |
| FR3.6 | Epic 3 | `curriculum-progress` |
| FR4.1 | Epic 3 | Presentazione un esercizio per volta |
| FR4.2 | Epic 3 | `exercise-card` e `answer-option` ×n |
| FR4.3 | Epic 3 | `explanation-panel` dopo la risposta |
| FR4.4 | Epic 3 | Schermata di completamento |
| FR4.5 | Epic 3 | `progress-meter` (`UX-DR16`) |
| FR4.6 | Epic 3 | Abbandono con risposte acquisite |
| FR4.7 | Epic 3 | Ripresa senza penalità, sessione ricostruita (`AD-6`) |
| FR4.8 | Epic 3 | Spiegazione consultabile prima, registrata |
| FR5.1 | Epic 3 | `schedule(state, outcome, now)` puro |
| FR5.2 | Epic 3 | `outcomeOf()` puro — l'esito è calcolato (`AD-24`) |
| FR5.3 | Epic 3 | Semantica dei quattro esiti sugli stadi |
| FR5.4 | Epic 3 | Saturazione agli estremi (`AD-17`) |
| FR5.5 | Epic 3 | Intervallo zero = in fondo alla coda corrente |
| FR5.6 | Epic 3 | Dispersione deterministica (`AD-4`) |
| FR5.7 | Epic 3 | `review_log` append-only con `grammar_point` (`AD-18`) |
| FR6.1 | Epic 3 | Cancello: sblocco solo a pila vuota |
| FR6.2 | Epic 3 | Sblocco materializza gli esercizi (`AD-26`) |
| FR6.3 | Epic 3 | Progressione sequenziale, non si salta |
| FR6.4 | Epic 3 | Lezione senza esercizi: sblocco che non muove la pila |
| FR6.5 | Epic 3 | Tetto giornaliero di sblocco, predefinito 1 |
| FR6.6 | Epic 3 | Impostazione del tetto |
| FR7.1 | Epic 5 | Risposte nel tempo |
| FR7.2 | Epic 5 | Distribuzione per stadio, asse derivato da `AD-17` |
| FR7.3 | Epic 5 | Punti grammaticali con tasso di errore più alto |
| FR7.4 | Epic 3 | `streak(log, now, timeZone)` — serve a FR3.2 e FR4.4, quindi nasce lì |
| FR7.5 | Epic 5 | Stati di dati insufficienti (`UX-DR18`) |
| FR8.1 | Epic 1 | Risorse en/it, completezza imposta da chiavi tipizzate |
| FR8.2 | Epic 1 | Commutazione a runtime |
| FR8.3 | Epic 1 | Persistenza in `user_settings.locale` |
| FR8.4 | Epic 1 | Nessuna stringa cablata — errore di compilazione (`AD-14`) |
| FR8.5 | Epic 2 · uso Epic 3 | Spiegazioni bilingui nello schema, ripiego su `en` dichiarato |
| FR9.1 | Epic 4 | Precarico dell'intera pila dovuta |
| FR9.2 | Epic 4 | Accodamento locale delle risposte |
| FR9.3 | Epic 4 | Drenaggio automatico al ritorno online |
| FR9.4 | Epic 4 | `sync-indicator` da `useMutationState` (`UX-DR17`) |
| FR9.5 | Epic 4 | Recupero della coda, persister IndexedDB (`AD-8`) |
| FR9.6 | Epic 4 · RPC in Epic 3 | Idempotenza — costruita in Epic 3, **verificata** qui |
| FR10.1 | Epic 6 | Pagina privacy policy |
| FR10.2 | Epic 6 | Pagina di riconoscimenti a Cure Dolly (`AD-16` allentato) |
| FR10.3 | Epic 6 | `LICENSE` e `LICENSE-CONTENT` separati e dichiarati |
| FR11.1 | Epic 2 | Flusso di autorazione documentato e ripetibile |
| FR11.2 | Epic 2 | Revisione umana obbligatoria prima del commit |
| FR11.3 | Epic 2 | Aggiungere una lezione non tocca il codice |
| FR11.4 | Epic 2 | Schema unico, validazione in CI |
| FR11.5 | Epic 2 | Identificatore derivato dal contenuto (`AD-23`) |
| FR11.6 | Epic 2 | Registro dei tipi chiuso (`AD-22`) |
| FR11.7 | Epic 2 | Transcript fuori dal repository, `.gitignore` |
| FR11.8 | Epic 2 | Controllo anti-contaminazione in autorazione |

## Epic List

**Sei epiche.** Il piano precedente ne consolidava cinque, motivando la scelta con il fatto che *"Architecture Spine e contratto UX sono entrambi `status: final`"* — quando il disegno è validato si preferiscono poche epiche grandi.

**Quella premessa oggi è falsa, ed è la ragione della struttura.** `OQ-7` del PRD e `UX-DR34` dichiarano aperte nove decisioni — quali tipi di esercizio esistono, la tipografia di frase, la forma delle opzioni di risposta, come si comunica l'esito, il contratto tastiera, quando mostrare la furigana. Tutte hanno la **stessa condizione di sblocco**: aver autorato tre lezioni vere.

Ne discende l'unica scelta strutturale non ovvia di questo piano: **la pipeline di autorazione è Epic 2, prima della sessione di esercizi.** Non per ordine tecnico, ma perché è l'epica che produce le informazioni senza le quali Epic 3 progetterebbe a indovinare. Costruire prima la schermata di esercizio significherebbe riscriverla.

### Epic 1: Fondamenta, accesso e URL pubblico

Uno sconosciuto raggiunge un indirizzo pubblico, si registra, accede, resta autenticato fra riavvii del browser, cambia lingua e può cancellare definitivamente il proprio account.

**FRs covered:** FR1.1, FR1.2, FR1.3, FR1.4, FR1.5, FR1.6, FR8.1, FR8.2, FR8.3, FR8.4

**Implementation notes:** **La prima storia è uno scaffold manuale** — né lo Spine né il Delta nominano uno starter template, e partire da `create-vite` produrrebbe una struttura che viola `AD-1` dalla prima riga. Il confine di `AD-1` va imposto meccanicamente (`eslint-plugin-boundaries`) **prima** che esista codice da vincolare. `AD-14` rende una chiave i18n mancante un errore di compilazione, quindi FR8.4 si autoimpone da qui in avanti invece di diventare un'epica di pulizia finale. La superficie *Impostazioni* nasce qui con la sola lingua e cancellazione account, ed è estesa da Epic 3 con il tetto di sblocco. Hosting Vercel con `vercel.json` per i deep link. I design token di `UX-DR1`–`UX-DR7` e `UX-DR9` nascono qui, **escluso** `UX-DR8` (tipografia di frase) che dipende da Epic 2.

### Epic 2: Dalla lezione vista al file committato

L'owner, nel ruolo di autore, trasforma una lezione appena studiata in esercizi validati e committati in meno di trenta minuti, senza toccare il codice.

**FRs covered:** FR2.1, FR2.1a, FR2.2, FR2.3, FR2.4, FR2.5, FR2.6, FR8.5, FR11.1, FR11.2, FR11.3, FR11.4, FR11.5, FR11.6, FR11.7, FR11.8

**Implementation notes:** È l'epica che **chiude `OQ-7` e le cinque decisioni di `UX-DR34`**, e per farlo le sue storie hanno un ordine vincolante: si autorano prima tre lezioni vere con uno schema provvisorio, **poi** si congela il registro dei tipi (`AD-22`) sull'evidenza raccolta. Lo schema scritto prima di aver visto contenuto reale sarebbe sbagliato, e correggerlo dopo costa più che deciderlo tardi.

L'epica consegna anche il **modello di dominio dell'esercizio**: la union discriminata e i validatori puri `check()` con i loro test. Epic 3 li userà, non li costruirà. La separazione è netta e utile — qui un esercizio *esiste ed è verificabile*, là viene *presentato e risolto*.

`NFR9` è il vincolo di accettazione dell'epica, non una nota: nessun passaggio manuale il cui costo cresca con il numero di lezioni già autorate, perché ne restano 79.

### Epic 3: La pila — dalla lezione sbloccata alla sessione a zero

L'utente sblocca una lezione, risolve i suoi esercizi uno per volta leggendo perché la risposta è quella, e porta la pila a zero. È il prodotto.

**FRs covered:** FR3.1, FR3.2, FR3.3, FR3.4, FR3.5, FR3.6, FR4.1, FR4.2, FR4.3, FR4.4, FR4.5, FR4.6, FR4.7, FR4.8, FR5.1, FR5.2, FR5.3, FR5.4, FR5.5, FR5.6, FR5.7, FR6.1, FR6.2, FR6.3, FR6.4, FR6.5, FR6.6, FR7.4

**Implementation notes:** L'epica è grande (28 FR) per la stessa ragione dirimente del piano precedente: un account appena creato non ha lezioni sbloccate, quindi pila a zero, quindi niente da fare. **Senza F6 nella stessa epica, questa consegnerebbe zero valore a chiunque parta da zero — cioè a tutti.** In più FR3.4 lega F3 a F6, e `UX-DR21` tratta le due quest come una sola macchina a stati della dashboard.

Assorbe il motore di dominio — `schedule()`, `outcomeOf()`, `isDue()`, `sessionReducer()`, `streak()`, `alignFurigana()` — perché un livello tecnico non consegna niente da solo. Le storie sono ordinate: dominio puro e testato per primo, poi dati e RPC, poi schermate.

FR7.4 nasce qui e non in Epic 5: lo streak serve alla dashboard (FR3.2) e al completamento (FR4.4), quindi vive dove viene usato per primo.

Il percorso di scrittura nasce già idempotente (`AD-7` con `review_id` e `ON CONFLICT`), perché è semplicemente come si persiste una risposta — non perché Epic 4 lo richieda.

### Epic 4: La sessione sopravvive alla galleria

La risposta data senza rete non si perde, si sincronizza da sola al ritorno del campo, e sopravvive alla chiusura dell'applicazione.

**FRs covered:** FR9.1, FR9.2, FR9.3, FR9.4, FR9.5, FR9.6

**Implementation notes:** **Epic 3 non dipende da questa.** Qui ci si costruisce sopra la coda durevole, senza toccare la RPC. I quattro vincoli di `AD-8` sono altrettanti punti di fallimento noti: in particolare `setMutationDefaults` registrata al bootstrap e mai in un componente, altrimenti la reidratazione fallisce con `No mutationFn found`.

`AD-24` rende questa epica più economica di quanto fosse nel piano precedente: l'esito è calcolato sul client da una funzione pura, quindi una risposta data in galleria produce lo stesso esito e la stessa scadenza che avrebbe prodotto online. Il drenaggio non ricalcola nulla.

### Epic 5: Statistiche che dicono quale regola non ti è entrata

L'utente vede le proprie risposte nel tempo, la distribuzione dei propri esercizi per stadio, e riconosce **i punti grammaticali** su cui sbaglia di più.

**FRs covered:** FR7.1, FR7.2, FR7.3, FR7.5

**Implementation notes:** Tutto deriva **esclusivamente** da `review_log` (`AD-18`). L'asse della distribuzione per stadio deriva dalla costante unica di `AD-17`, non da un elenco parallelo.

FR7.3 è il salto di qualità rispetto al prodotto precedente, e va difeso in implementazione: si aggrega per `grammar_point`, **non** per esercizio. "Sbagli questa frase" non è azionabile; "non hai capito に di destinazione" lo è. È la ragione per cui `grammar_point` è denormalizzato dentro `review_log` — una statistica non può dipendere da dati mutabili che una riautorazione riscriverebbe.

### Epic 6: Lancio pubblico difendibile

Il progetto è pubblicamente utilizzabile e pubblicamente ispezionabile: privacy policy, riconoscimenti corretti alla fonte del metodo, licenze separate, README che spiega le scelte, percorso completo verificato end-to-end.

**FRs covered:** FR10.1, FR10.2, FR10.3

**Implementation notes:** Tre FR, ma contiene la maggior parte della Definition of Done del PRD §11. Il test Playwright copre registrazione → sblocco lezione → esercizi → pila a zero (`NFR3`), e la cancellazione account è verificata su **tutte** le tabelle per-utente — incluse `lesson_progress` — non dedotta dalle chiavi esterne.

`FR10.2` è più delicato di una pagina di crediti: deve attribuire l'origine del modello senza suggerire un'affiliazione, e dichiarare che il contenuto è originale del progetto. Il README risponde alle sette domande dell'addendum §6, inclusa l'ultima sul flusso assistito da AI — che qui vale più che nel piano precedente, perché la pipeline di Epic 2 **è** quella risposta.

Contiene anche la sola verifica di accessibilità che nessun test automatico copre (`UX-DR28`): una storia percorre la sessione con NVDA o VoiceOver e registra l'esito dell'`aria-hidden` sul ruby.

---

## Epic 1: Fondamenta, accesso e URL pubblico

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
**Then** Vercel pubblica il sito in produzione a un URL raggiungibile senza credenziali

**Given** una pull request aperta
**When** la pipeline viene eseguita
**Then** Vercel pubblica un'anteprima dedicata a quella PR

**Given** un deep link a una rotta interna aperto direttamente
**When** il server risponde
**Then** `vercel.json` riscrive verso `index.html` e il routing lato client prende il controllo
**And** l'URL non restituisce 404

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
**Then** contiene i 27 token colore, i ruoli tipografici, la scala di spaziatura e i quattro raggi di `DESIGN.md`
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

**Given** il ruolo tipografico per il giapponese di frase (`UX-DR8`)
**When** questa storia viene chiusa
**Then** resta **deliberatamente non definito**, perché il suo corpo dipende dalla lunghezza delle frasi reali che Epic 2 produrrà
**And** la storia 3.23 lo fissa e lo verifica sul rendering

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

**Given** una stringa giapponese proveniente dal contenuto
**When** viene renderizzata
**Then** **non** passa da `t()`, perché è dato e non interfaccia
**And** il nodo che la contiene porta `lang="ja"`

**Given** il confine a tre di `AD-14`
**When** viene documentato
**Then** dichiara che l'interfaccia passa da `t()`, il contenuto delle lezioni dal file di lezione, e il giapponese da nessuno dei due

### Story 1.5: Lo schema nasce versionato e isolato

As a proprietario dei miei dati,
I want che ogni tabella che mi riguarda sia leggibile solo da me,
So that il repository possa essere pubblico senza che i dati lo diventino.

**Acceptance Criteria:**

**Given** il progetto Supabase reale, unico ambiente del progetto
**When** la pipeline applica le migrazioni
**Then** lo fa **soltanto al merge su `main`**, da `supabase/migrations/` versionate
**And** nessuna modifica di schema avviene dallo Studio Supabase

**Given** una pull request che contiene una migrazione
**When** la CI viene eseguita
**Then** la migrazione viene validata sintatticamente ma **non applicata**
**And** i dati di studio dell'owner non sono esposti a uno schema non ancora revisionato

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
**When** apre l'URL della dashboard, della sessione, delle statistiche o delle impostazioni
**Then** viene reindirizzato alla schermata di Accesso

**Given** il guard di rotta
**When** il codice viene ispezionato
**Then** esiste in un solo punto, in `src/app/`, e non come controlli sparsi nelle schermate

**Given** un utente autenticato
**When** apre la radice del sito
**Then** raggiunge una rotta protetta che esiste e risponde
**And** il suo contenuto in questa epica è minimo: la dashboard vera arriva in Epic 3, e nessuna storia di Epic 1 la presuppone

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
**Then** una conferma esplicita dichiara la conseguenza: tutti i dati di studio vengono distrutti e le statistiche non sopravvivono

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

## Epic 2: Dalla lezione vista al file committato

L'owner, nel ruolo di autore, trasforma una lezione appena studiata in esercizi validati e committati in meno di trenta minuti, senza toccare il codice.

### Story 2.1: Il transcript non entra nel repository

As a autore che lavora da materiale protetto,
I want che la fonte resti fuori dal progetto per costruzione,
So that nessun commit distratto trasformi un problema evitato in un problema reale.

**Acceptance Criteria:**

**Given** il repository
**When** `.gitignore` viene ispezionato
**Then** esclude esplicitamente transcript, sottotitoli e trascrizioni, con un commento che ne dice la ragione

**Given** una cartella di lavoro dell'autore contenente un transcript
**When** `git status` viene eseguito
**Then** il file non compare fra quelli tracciabili

**Given** la documentazione della pipeline
**When** viene letta
**Then** dichiara che il transcript è input privato della sessione di autorazione e che da esso si estraggono **fatti**, mai formulazioni
**And** dichiara che parafrasare con i sinonimi una spiegazione altrui resta opera derivata

### Story 2.2: Uno schema minimo per autorare la prima lezione

As a autore,
I want una forma di file abbastanza definita da poterci scrivere dentro la prima lezione,
So that si possa cominciare senza aver già deciso tutto.

**Acceptance Criteria:**

**Given** nessun contenuto esistente
**When** lo schema provvisorio viene definito
**Then** copre lezione (ordine, titolo, punti grammaticali) ed esercizio (tipo, contenuto, risposta, distrattori, spiegazione)
**And** è dichiarato **provvisorio** nel file stesso, con il riferimento a `OQ-7`

**Given** lo schema provvisorio
**When** viene usato
**Then** ammette **un solo** tipo di esercizio iniziale, scelto fra quelli proposti, perché il resto va scoperto e non ipotizzato

**Given** questa storia
**When** viene chiusa
**Then** **non** introduce validazione in CI: il cancello arriva in 2.6, quando lo schema è definitivo
**And** una lezione malformata a questo stadio è un problema dell'autore, non della pipeline

### Story 2.3: Tre lezioni vere, e i tipi che ne emergono

As a autore che ha già visto undici lezioni,
I want trasformarne tre in esercizi reali e annotare cosa serve davvero,
So that il registro dei tipi nasca dall'evidenza invece che da un'ipotesi.

**Acceptance Criteria:**

**Given** tre transcript di lezioni già studiate
**When** vengono autorati
**Then** esistono tre file di lezione conformi allo schema provvisorio, ciascuno con almeno cinque esercizi
**And** ogni esercizio è stato riletto e approvato da un umano prima del commit

**Given** le tre lezioni autorate
**When** vengono esaminate
**Then** esiste un documento che elenca **i tipi di esercizio effettivamente serviti**, con quante volte ciascuno è comparso
**And** elenca i tipi proposti che **non** sono serviti, perché eliminarli è informazione quanto aggiungerne

**Given** le frasi prodotte
**When** vengono misurate
**Then** la loro lunghezza in caratteri è registrata, perché è l'input di `UX-DR8` e della storia 3.23

**Given** il processo appena percorso
**When** viene cronometrato
**Then** il tempo per lezione è registrato, come prima misura di `M5`

### Story 2.4: Il registro dei tipi si chiude

As a sviluppatore che manterrà questo codice per novanta lezioni,
I want che i tipi di esercizio siano un insieme chiuso e verificabile,
So that il contenuto possa crescere senza che l'interfaccia diventi uno zoo.

**Acceptance Criteria:**

**Given** l'evidenza raccolta dalla storia 2.3
**When** il registro viene definito in `src/domain/exercise.ts`
**Then** è una union discriminata chiusa, e ogni tipo dichiara la forma dei propri dati

**Given** ciascun tipo del registro
**When** viene implementato
**Then** porta una funzione pura `check(exercise, response): Outcome`
**And** porta i propri test unitari, inclusi i casi limite

**Given** `src/domain/exercise.ts`
**When** viene ispezionato
**Then** non importa React, Supabase, rete o orologio
**And** l'ordine dei distrattori è deterministico, senza `Math.random()`

**Given** un file di lezione che dichiara un `kind` non presente nel registro
**When** viene elaborato
**Then** è un errore, non un caso ignorato a runtime

**Given** la decisione presa in questa storia
**When** viene registrata
**Then** chiude `OQ-7` del PRD e abilita le cinque decisioni di `UX-DR34`

### Story 2.5: L'identità di un esercizio resiste alla riautorazione

As a utente che ha studiato per settimane,
I want che correggere un refuso in una spiegazione non cancelli i miei progressi,
So that migliorare il contenuto non costi la mia cronologia.

**Acceptance Criteria:**

**Given** un esercizio
**When** il suo identificatore viene calcolato
**Then** è `uuidv5` di una chiave naturale costruita da tipo, frase e risposta corretta, normalizzata NFKC

**Given** lo stesso esercizio con la spiegazione corretta o i distrattori riordinati
**When** l'identificatore viene ricalcolato
**Then** è **identico**, perché la sostanza non è cambiata
**And** un test lo verifica

**Given** lo stesso esercizio con la frase o la risposta corretta modificate
**When** l'identificatore viene ricalcolato
**Then** è **diverso**, perché è un esercizio diverso
**And** un test lo verifica

**Given** una lezione riautorata da capo senza modifiche sostanziali
**When** i suoi identificatori vengono confrontati con i precedenti
**Then** coincidono tutti

### Story 2.6: Lo schema definitivo e il cancello in CI

As a chiunque apra una pull request di contenuto,
I want che una lezione malformata venga fermata prima del merge,
So that nessun utente incontri un esercizio rotto in produzione.

**Acceptance Criteria:**

**Given** il registro chiuso della storia 2.4
**When** lo schema definitivo viene scritto
**Then** tipo TypeScript e validatore a runtime derivano dalla **stessa** definizione, non da due elenchi paralleli

**Given** una lezione
**When** viene validata
**Then** il controllo verifica: conformità allo schema, `kind` presente nel registro, spiegazione inglese presente, unicità degli identificatori, e coerenza fra `kanji` e `kana` di ogni frase

**Given** l'identificatore e il titolo di una lezione
**When** vengono definiti
**Then** derivano dal **punto grammaticale** che insegna
**And** non riproducono numerazione, titolo o ordine delle lezioni di una fonte esterna

**Given** una pull request che modifica `content/lessons/`
**When** la CI viene eseguita
**Then** la validazione gira e un file malformato **blocca il merge**

**Given** una lezione nuova conforme allo schema
**When** viene aggiunta
**Then** non richiede alcuna modifica al codice

### Story 2.7: Una lezione può non avere esercizi

As a autore,
I want registrare anche le lezioni che non si prestano a esercizi,
So that la progressione racconti il percorso vero invece di saltare pezzi.

**Acceptance Criteria:**

**Given** una lezione che riorienta il modo di pensare senza avere una risposta giusta
**When** viene autorata con zero esercizi
**Then** lo schema la accetta e la validazione passa

**Given** una lezione senza esercizi
**When** viene ispezionata
**Then** dichiara comunque i punti grammaticali che insegna, perché alimentano le statistiche di Epic 5 quando altre lezioni li riprendono

### Story 2.8: Spiegazioni bilingui con ripiego dichiarato

As a utente italiano,
I want leggere la spiegazione nella mia lingua quando esiste,
So that non debba tradurre mentalmente mentre imparo.

**Acceptance Criteria:**

**Given** un esercizio
**When** viene autorato
**Then** la spiegazione in inglese è **obbligatoria** e quella in italiano è facoltativa

**Given** un esercizio con la sola spiegazione inglese
**When** un utente con interfaccia italiana lo incontra
**Then** vede la spiegazione inglese
**And** l'interfaccia dichiara che quella spiegazione non è ancora tradotta, invece di far sembrare che l'italiano sia quello

**Given** le spiegazioni
**When** vengono implementate
**Then** **non** passano da i18n: sono contenuto del file di lezione, non chiavi di interfaccia

### Story 2.9: Il confronto che impedisce la contaminazione

As a autore che genera da un testo protetto,
I want un controllo meccanico che intercetti le sovrapposizioni,
So that la separazione fra fatto e formulazione non dipenda solo dalla mia attenzione.

**Acceptance Criteria:**

**Given** una sessione di autorazione conclusa
**When** il controllo viene eseguito
**Then** confronta ogni frase giapponese e ogni spiegazione prodotte con il testo del transcript di partenza
**And** segnala ogni sovrapposizione non banale

**Given** una sovrapposizione segnalata
**When** viene esaminata
**Then** il contenuto viene riscritto prima del commit, oppure la segnalazione è motivata per iscritto se si tratta di un esempio canonico pubblico

**Given** il controllo
**When** la sua collocazione viene documentata
**Then** dichiara che **non può essere un cancello di CI**, perché il transcript non entra nel repository per la storia 2.1
**And** dichiara che è l'unico anello della catena di qualità che non si chiude a valle

**Given** le tre lezioni già autorate dalla storia 2.3, prodotte quando questo controllo non esisteva ancora
**When** il controllo diventa disponibile
**Then** viene applicato **retroattivamente** anche a quelle
**And** l'esito è registrato, perché sono le uniche lezioni del progetto passate senza la verifica meccanica

### Story 2.10: Il flusso che regge novanta lezioni

As a autore con settantanove lezioni ancora da vedere,
I want una procedura ripetibile che non peggiori con l'accumularsi del contenuto,
So that il prodotto non muoia di fame di contenuto invece che di difetti.

**Acceptance Criteria:**

**Given** la procedura documentata
**When** viene letta da qualcuno che non l'ha mai eseguita
**Then** è sufficiente a produrre una lezione valida senza chiedere aiuto

**Given** la procedura
**When** viene esaminata per `NFR9`
**Then** nessun passaggio manuale ha un costo che cresce con il numero di lezioni già autorate

**Given** una lezione qualsiasi
**When** viene autorata seguendo la procedura
**Then** il tempo dalla visione all'esercizio giocabile è al massimo trenta minuti (`M5`)
**And** il tempo misurato viene registrato, perché la soglia è una stima da tarare

**Given** il repository
**When** viene ispezionato
**Then** contiene almeno cinque lezioni autorate e validate, come richiede la Definition of Done del PRD §11

---

## Epic 3: La pila — dalla lezione sbloccata alla sessione a zero

L'utente sblocca una lezione, risolve i suoi esercizi uno per volta leggendo perché la risposta è quella, e porta la pila a zero. È il prodotto.

### Story 3.1: Il motore di scheduling, puro e saturo

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

**Given** un esercizio allo stadio `5`
**When** riceve `easy`
**Then** resta allo stadio `5`, non va a `7`

**Given** un esercizio allo stadio `0`
**When** riceve `again` oppure `hard`
**Then** resta allo stadio `0` con intervallo `0`, senza ramificazioni speciali nel codice

**Given** il modulo `src/domain/schedule.ts`
**When** viene ispezionato
**Then** non contiene `Date.now()`, `new Date()` senza argomenti, `Intl.DateTimeFormat().resolvedOptions()` né `Math.random()`
**And** riceve sempre `now` come parametro esplicito

**Given** due esercizi valutati nello stesso istante allo stesso stadio
**When** le scadenze vengono calcolate
**Then** ricevono una dispersione deterministica derivata da `exercise_id` e `stage`
**And** ripetere il calcolo produce esattamente le stesse date

### Story 3.2: L'esito si calcola, non si dichiara

As a utente,
I want che il sistema giudichi la mia risposta invece di chiedermi quanto mi sia sembrata facile,
So that il mio streak non possa mentirmi.

**Acceptance Criteria:**

**Given** `outcomeOf(response, usedExplanation, declaredEasy)` in `src/domain/`
**When** viene invocata
**Then** è pura e restituisce `again`, `hard`, `good` o `easy`

**Given** una risposta sbagliata
**When** l'esito viene derivato
**Then** è `again`, indipendentemente da tutto il resto

**Given** una risposta corretta data dopo aver consultato la spiegazione
**When** l'esito viene derivato
**Then** è `hard`

**Given** una risposta corretta data senza aiuto
**When** l'esito viene derivato
**Then** è `good`, oppure `easy` se l'utente lo ha dichiarato esplicitamente

**Given** il codice dell'applicazione
**When** viene ispezionato
**Then** **nessun altro punto** decide un esito: l'interfaccia raccoglie fatti e il dominio li traduce

**Given** la funzione
**When** viene eseguita
**Then** non richiede rete, così che una risposta data in galleria produca lo stesso esito che avrebbe prodotto online

### Story 3.3: Una sola definizione di "dovuto"

As a utente,
I want che il numero mostrato dalla dashboard sia lo stesso numero che la sessione carica,
So that non ci siano due verità sulla stessa pila.

**Acceptance Criteria:**

**Given** `isDue(state, now)` in `src/domain/`
**When** viene invocata
**Then** è pura, riceve `now` come parametro, e restituisce se l'esercizio è dovuto

**Given** la porta `ReviewRepository.listDue`
**When** dashboard, precarico di sessione e cancello di sblocco interrogano la pila
**Then** leggono tutti la stessa chiave TanStack `['due', userId]`
**And** nessuna schermata ricalcola la pila per conto proprio

### Story 3.4: La coda di sessione decide il dominio, non la UI

As a utente che sbaglia un esercizio,
I want rivederlo prima della fine della sessione,
So that la sessione finisca solo quando ho davvero risposto a tutto.

**Acceptance Criteria:**

**Given** `sessionReducer(state, event)` in `src/domain/session.ts`
**When** un esercizio riceve un esito con intervallo risultante `0`
**Then** torna in fondo alla coda corrente

**Given** una coda di sessione
**When** ogni esercizio ha ricevuto almeno un `good`
**Then** la coda è vuota e la sessione può terminare

**Given** lo store Zustand di sessione
**When** viene ispezionato
**Then** delega ogni calcolo a `sessionReducer()` e non contiene logica di scheduling o di coda
**And** non è persistito

### Story 3.5: Lo streak si calcola, non si memorizza

As a utente che studia ogni giorno,
I want vedere da quanti giorni consecutivi porto la pila a zero,
So that abbia una misura dell'abitudine che sto costruendo.

**Acceptance Criteria:**

**Given** `streak(log, now, timeZone)` in `src/domain/streak.ts`
**When** viene invocata
**Then** riceve **sia** l'istante **sia** il fuso orario come parametri espliciti

**Given** un giorno in cui l'utente ha portato la pila a zero
**When** lo streak viene calcolato
**Then** quel giorno conta; conta anche un giorno con almeno una risposta se la pila era già vuota

**Given** il confine fra due giornate
**When** lo streak viene calcolato
**Then** la giornata termina a mezzanotte nel fuso passato come parametro

**Given** lo streak
**When** viene letto
**Then** è sempre derivato da `review_log` a ogni lettura
**And** non esiste una colonna che lo memorizzi

### Story 3.6: La furigana si allinea nel dominio

As a utente che legge frasi con i kanji,
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

**Given** un segmento senza kanji, o con `kanji` uguale a `kana`
**When** viene invocata
**Then** restituisce un solo segmento senza ruby

**Given** il modulo
**When** viene ispezionato
**Then** è puro, non importa React, e i casi sopra sono coperti da test unitari

### Story 3.7: Il contenuto raggiunge il client e può essere aggiornato

As a utente,
I want che una correzione al contenuto arrivi senza che io debba fare niente,
So that gli errori si possano riparare invece che sopportare.

**Acceptance Criteria:**

**Given** la decisione di `OQ-8`
**When** viene presa in questa storia
**Then** il contenuto viaggia come **righe di Postgres popolate da migrazione**, non incluso nel bundle
**And** la ragione è registrata: 90 lezioni nel bundle peserebbero su ogni visitatore indipendentemente dal suo progresso, una correzione richiederebbe un redeploy, e `AD-12` governa già le migrazioni

**Given** le migrazioni che creano `lesson` ed `exercise`
**When** vengono applicate
**Then** `lesson` espone `id`, `ordinal`, `title_en`, `title_it`, `grammar_points`
**And** `exercise` espone `id`, `lesson_id`, `kind`, `payload`, `grammar_point`, `explanation_en`, `explanation_it`

**Given** il seed generato dai file di `content/lessons/`
**When** viene eseguito una seconda volta
**Then** è un upsert su `id` e ogni esercizio invariato conserva il proprio identificatore

**Given** RLS su `lesson` ed `exercise`
**When** un utente autenticato interroga
**Then** può leggere
**And** non esiste alcuna policy di scrittura: il contenuto entra solo per migrazione

### Story 3.8: Il progresso è per-utente e resta per-utente

As a utente,
I want che nessun altro possa leggere il mio storico di studio,
So that lo schema pubblico non sia una porta aperta.

**Acceptance Criteria:**

**Given** le migrazioni
**When** vengono applicate
**Then** esistono `review_state` (chiave `user_id` + `exercise_id`, con `stage`, `due_at`, `review_count`, `lapse_count`, `last_reviewed_at`), `review_log` (append-only, con `id`, `user_id`, `exercise_id`, `grammar_point`, `outcome`, `used_explanation`, `reviewed_at`) e `lesson_progress` (chiave `user_id` + `lesson_id`, con `unlocked_at`)

**Given** `review_log.grammar_point`
**When** la scelta di denormalizzarlo viene documentata
**Then** dichiara che una statistica non può dipendere da dati mutabili che una riautorazione riscriverebbe

**Given** il vincolo su `review_state.stage`
**When** viene definito
**Then** il `CHECK` deriva dalla stessa scala di `AD-17`, non da un elenco parallelo

**Given** il tipo dell'esito
**When** viene definito
**Then** il `CHECK` SQL e la union TypeScript ammettono lo stesso insieme `again | hard | good | easy`

**Given** RLS su tutte e tre le tabelle
**When** l'utente A tenta di leggere o scrivere righe dell'utente B
**Then** l'operazione fallisce
**And** un test di integrazione lo dimostra esplicitamente per ciascuna tabella

### Story 3.9: Una risposta, una chiamata, nessun doppione

As a utente che risponde mentre la rete è instabile,
I want che un ritentativo non conti la risposta due volte,
So that le mie statistiche restino vere.

**Acceptance Criteria:**

**Given** la funzione RPC
**When** viene definita
**Then** ha firma `apply_review(review_id, exercise_id, outcome, stage, due_at, reviewed_at, used_explanation)`

**Given** una chiamata a `apply_review`
**When** viene eseguita
**Then** in una sola transazione inserisce in `review_log` con `ON CONFLICT (review_id) DO NOTHING` e aggiorna `review_state` **solo se** l'insert ha prodotto una riga

**Given** la stessa chiamata ripetuta con lo stesso `review_id`
**When** viene eseguita una seconda volta
**Then** non produce una seconda riga di log né un secondo avanzamento di stadio

**Given** la funzione SQL
**When** viene ispezionata
**Then** non contiene logica di scheduling né di valutazione: riceve `outcome`, `stage` e `due_at` già calcolati dal client

### Story 3.10: Gli adattatori dietro le porte

As a sviluppatore che scrive le schermate,
I want ricevere i dati attraverso interfacce dichiarate dal dominio,
So that il flusso di esercizio si possa testare senza database.

**Acceptance Criteria:**

**Given** `src/domain/ports/`
**When** viene ispezionata
**Then** dichiara `ContentRepository`, `ReviewRepository`, `ProgressRepository`, `SettingsRepository` e `Clock`

**Given** `src/data/`
**When** viene ispezionata
**Then** è l'unica cartella che importa `@supabase/supabase-js`
**And** implementa le porte lanciando un `DataError` tipizzato in caso di fallimento

**Given** un test di componente
**When** viene eseguito
**Then** inietta implementazioni in memoria delle porte, senza rete

### Story 3.11: Il giapponese si presenta bene

As a utente che studia i kanji,
I want frasi rese correttamente con la loro lettura,
So that la card sia leggibile senza essere un indovinello tipografico.

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

**Given** una qualsiasi schermata dell'applicazione
**When** viene renderizzata
**Then** il romaji non compare mai

**Given** la decisione su quando mostrare la furigana
**When** viene presa
**Then** è un campo dichiarato dal **tipo di esercizio**, non una regola globale
**And** il valore predefinito è *visibile*, perché in un esercizio di grammatica la lettura è supporto e non soluzione — nasconderla testerebbe i kanji mentre si crede di testare la grammatica

### Story 3.12: La pila, con un numero e un pulsante

As a utente che apre l'app alle 8:10,
I want vedere subito quanto mi resta e come cominciare,
So that possa partire senza decidere nulla.

**Acceptance Criteria:**

**Given** esercizi dovuti esistenti
**When** l'utente apre la dashboard
**Then** vede il conteggio dei dovuti nel corpo tipografico più grande dell'applicazione, con l'etichetta **sotto** il numero

**Given** la dashboard
**When** viene renderizzata
**Then** mostra lo streak corrente
**And** mostra quante lezioni sono sbloccate sul totale esistente
**And** espone **una sola** azione primaria

**Given** la dashboard in caricamento
**When** i dati non sono ancora arrivati
**Then** compare uno scheletro alla stessa altezza del contenuto finale, senza spinner e senza salti di layout

**Given** una qualsiasi stringa visibile dell'applicazione
**When** viene scritta
**Then** il conteggio precede il verbo — "23 da rivedere", non "hai 23 esercizi"
**And** non contiene punti esclamativi, emoji né avverbi di lode

### Story 3.13: Sbloccare la lezione successiva

As a utente con la pila vuota,
I want accedere alla lezione successiva del percorso,
So that possa andare avanti senza sommergermi.

**Acceptance Criteria:**

**Given** la pila dovuta vuota
**When** l'utente sblocca la lezione successiva
**Then** viene creata una riga `lesson_progress` e una riga `review_state` per **ciascuno** dei suoi esercizi, con `stage = 0` e `due_at` uguale all'istante di sblocco

**Given** un esercizio mai incontrato
**When** lo stato viene interrogato
**Then** "mai incontrato" significa **assenza di riga**, non una riga con uno stato speciale

**Given** il curriculum
**When** l'utente sceglie cosa sbloccare
**Then** può sbloccare solo la successiva in ordine: la progressione è sequenziale e non si salta

**Given** la pila **non** vuota
**When** la dashboard viene renderizzata
**Then** l'azione di sbloccare **non è presente**, nemmeno disabilitata

### Story 3.14: Una lezione senza esercizi si sblocca lo stesso

As a utente che incontra una lezione concettuale,
I want che sbloccarla abbia comunque un effetto visibile,
So that non pensi che il pulsante sia rotto.

**Acceptance Criteria:**

**Given** una lezione senza esercizi
**When** l'utente la sblocca
**Then** viene creata la riga `lesson_progress` e **nessuna** riga `review_state`

**Given** lo sblocco appena avvenuto
**When** la dashboard viene renderizzata
**Then** dichiara esplicitamente che quella lezione non ha esercizi e perché
**And** la pila resta a zero senza che sembri un fallimento

**Given** il progresso del curriculum
**When** viene mostrato
**Then** conta la lezione come sbloccata

### Story 3.15: La prima volta non somiglia alla fine

As a sconosciuto appena registrato,
I want capire subito cosa fare,
So that possa risolvere il primo esercizio entro un minuto dall'arrivo.

**Acceptance Criteria:**

**Given** un utente che non ha mai sbloccato alcuna lezione
**When** apre la dashboard
**Then** vede uno stato di primo avvio che dice cosa fa l'app e offre una sola azione primaria per cominciare

**Given** lo stato di primo avvio
**When** viene confrontato con lo stato di pila svuotata
**Then** i due testi sono diversi: il primo significa *comincia*, il secondo *hai finito*

**Given** lo stato di primo avvio
**When** viene renderizzato
**Then** non mostra un conteggio a zero né uno streak a zero, perché non c'è ancora niente da contare

### Story 3.16: Quando non c'è più niente da fare, dirlo

As a utente che ha finito,
I want che l'app me lo dica invece di mostrarmi una schermata muta,
So that sappia che ho terminato e non che si è rotto qualcosa.

**Acceptance Criteria:**

**Given** la pila a zero e lezioni non ancora sbloccate disponibili
**When** la dashboard viene renderizzata
**Then** il conteggio non diventa "0": lo stato cambia e l'azione primaria diventa sbloccare la lezione successiva

**Given** la pila a zero e il curriculum esaurito
**When** la dashboard viene renderizzata
**Then** dichiara esplicitamente che non ci sono altre lezioni
**And** è l'unica schermata dell'applicazione senza azione primaria

**Given** uno qualsiasi degli stati vuoti
**When** viene renderizzato
**Then** dichiara **perché** è vuoto e offre al massimo un'azione

### Story 3.17: Cambiare il ritmo

As a utente che trova una lezione al giorno troppo o troppo poco,
I want cambiare il limite giornaliero di sblocco,
So that il carico resti sostenibile per me.

**Acceptance Criteria:**

**Given** la migrazione di questa storia
**When** viene applicata
**Then** aggiunge a `user_settings` la colonna `lessons_per_day` con predefinito `1`

**Given** Impostazioni
**When** l'utente modifica il numero di lezioni al giorno
**Then** il valore viene persistito con un upsert diretto sulla tabella

**Given** il tetto già raggiunto
**When** l'utente riapre la dashboard
**Then** la schermata dichiara il tetto e quando si riapre, e rimanda a Impostazioni per cambiarlo

**Given** Impostazioni
**When** viene ispezionata
**Then** contiene esattamente due impostazioni — lingua e tetto di sblocco — più la cancellazione account

### Story 3.18: Un esercizio per volta, con la sua consegna

As a utente in sessione,
I want vedere una consegna chiara e scegliere una risposta,
So that la sessione misuri se ho capito la regola.

**Acceptance Criteria:**

**Given** una sessione avviata
**When** compare un esercizio
**Then** la card mostra la consegna e il contenuto giapponese necessario a rispondere

**Given** un esercizio presentato
**When** viene renderizzato
**Then** le opzioni di risposta sono presenti in numero determinato dal tipo di esercizio, non fisso
**And** l'ordine delle opzioni è deterministico

**Given** le opzioni di risposta
**When** vengono renderizzate
**Then** nessuna si distingue per il solo colore: etichetta e posizione portano l'informazione
**And** ciascuna è alta almeno 56px

**Given** un esercizio già risolto
**When** l'utente tenta di cambiare la risposta
**Then** non è possibile: la transizione è a senso unico dentro l'esercizio corrente

### Story 3.19: Rispondere, e sapere perché

As a utente,
I want capire perché la risposta è quella,
So that l'esercizio insegni invece di limitarsi a valutarmi.

**Acceptance Criteria:**

**Given** un esercizio presentato
**When** l'utente sceglie una risposta
**Then** il sistema dichiara se è corretta e mostra la spiegazione

**Given** l'esito comunicato
**When** viene renderizzato
**Then** non usa verde per il corretto né rosso per lo sbagliato
**And** l'informazione è portata dal contenuto della spiegazione, non dalla tinta, coerentemente con il rifiuto della grammatica della celebrazione

**Given** un esercizio non ancora risolto
**When** l'utente sceglie di consultare la spiegazione prima di rispondere
**Then** è possibile, l'azione viene registrata, e l'interfaccia non lo tratta come una scorciatoia da scoraggiare

**Given** una risposta
**When** viene registrata
**Then** l'esito è calcolato dal dominio **sul client, in quell'istante**, insieme a un `review_id` generato dal client
**And** la mutation trasporta il risultato già calcolato

**Given** una risposta
**When** viene applicata
**Then** conteggio e barra di avanzamento si aggiornano prima della conferma del server

**Given** un esercizio ripresentato nella stessa sessione
**When** ricompare
**Then** non porta alcuna segnalazione che lo distingua dagli altri

### Story 3.20: Vedere quanto manca, e potersene andare

As a utente che deve scendere dal treno,
I want abbandonare la sessione senza perdere quello che ho fatto,
So that riprendere più tardi non costi nulla.

**Acceptance Criteria:**

**Given** una sessione in corso
**When** viene renderizzata
**Then** la barra di avanzamento è sempre visibile e rappresenta il **completato**, non il rimanente

**Given** una sessione in corso
**When** l'utente la abbandona con Esc o tornando indietro
**Then** tutte le risposte già date restano acquisite

**Given** una sessione abbandonata
**When** l'utente riapre la dashboard
**Then** vede il conteggio residuo come conteggio normale, senza penalità

**Given** esercizi ancora dovuti
**When** l'utente avvia una nuova sessione più tardi nella stessa giornata
**Then** la sessione riparte dagli esercizi ancora dovuti
**And** non esiste un "riprendi dove eri": la sessione si ricostruisce, non si ripristina

### Story 3.21: Arrivare a zero

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

### Story 3.22: L'intera sessione senza mouse

As a utente che studia sul portatile,
I want percorrere la sessione interamente da tastiera,
So that non debba mai spostare la mano.

**Acceptance Criteria:**

**Given** il contratto tastiera
**When** viene definito
**Then** sostituisce quello di `AD-15`, che descriveva l'autovalutazione e non descrive più il prodotto
**And** il nuovo contratto è registrato come aggiornamento di `AD-15`, non come convenzione locale

**Given** un esercizio presentato
**When** l'utente preme un tasto numerico
**Then** seleziona l'opzione corrispondente, e l'associazione fra numero e posizione è la stessa in ogni tipo di esercizio

**Given** un esercizio con più opzioni di quante ne copra la fila numerica
**When** il contratto viene definito
**Then** dichiara esplicitamente il comportamento invece di lasciarlo indefinito

**Given** una sessione in corso
**When** viene ispezionata
**Then** esiste **una sola** live region `aria-live="polite"` che annuncia esito e avanzamento

**Given** la sessione
**When** si percorre con il tasto Tab
**Then** l'ordine segue l'ordine di lettura e coincide con l'ordine dei tasti numerici
**And** ogni elemento interattivo mostra un anello di focus visibile

**Given** un test di componente
**When** viene eseguito
**Then** guida una sessione completa fino alla pila a zero usando solo la tastiera

### Story 3.23: Le stesse schermate su telefono e portatile

As a utente che studia in metropolitana la mattina e sul portatile la sera,
I want le stesse funzioni su entrambi i dispositivi,
So that non debba imparare due prodotti.

**Acceptance Criteria:**

**Given** il ruolo tipografico per il giapponese di frase lasciato aperto dalla storia 1.3
**When** viene fissato
**Then** il suo corpo è calibrato sulla lunghezza reale delle frasi misurata nella storia 2.3
**And** una frase alla lunghezza massima osservata sta dentro `measure` senza andare a capo, su entrambe le larghezze estreme

**Given** una frase che va comunque a capo
**When** il comportamento viene definito
**Then** l'interruzione non spezza mai una parola giapponese al suo interno

**Given** la card di esercizio con la furigana attiva
**When** viene renderizzata con okurigana (難しい), prefisso kana (お茶) e ruby di gruppo su nucleo lungo (日本語)
**Then** la furigana non collide con la riga superiore e non viene tagliata
**And** se collide, si alza l'interlinea — non si riduce il corpo della furigana, già al suo minimo di leggibilità

**Given** una larghezza inferiore a 640px
**When** una qualsiasi schermata viene renderizzata
**Then** usa colonna singola con gutter di 20px
**And** le opzioni di risposta stanno entro 120px dal bordo inferiore

**Given** una larghezza fra 640px e 1024px
**When** una schermata viene renderizzata
**Then** il contenuto è in colonna singola centrata, limitata a `measure`

**Given** una larghezza di almeno 1024px
**When** una schermata viene renderizzata
**Then** il contenuto resta centrato a `measure` e **non** si allarga a riempire lo schermo

**Given** una qualsiasi funzione dell'applicazione
**When** viene cercata su telefono o su portatile
**Then** è presente su entrambi: nessuna funzione è esclusiva di una superficie

---

## Epic 4: La sessione sopravvive alla galleria

La risposta data senza rete non si perde, si sincronizza da sola al ritorno del campo, e sopravvive alla chiusura dell'applicazione.

### Story 4.1: La sessione si carica tutta in una volta

As a utente che sta per entrare in metropolitana,
I want che la sessione abbia già tutto quello che le serve quando parte,
So that perdere il campo a metà non la interrompa.

**Acceptance Criteria:**

**Given** l'utente avvia una sessione
**When** la sessione si inizializza
**Then** l'intera pila dovuta viene caricata in memoria in quel momento, con il contenuto di ogni esercizio e la sua spiegazione

**Given** la sessione avviata
**When** l'utente avanza di esercizio in esercizio
**Then** nessun esercizio richiede una richiesta di rete per essere mostrato
**And** nemmeno la spiegazione la richiede, perché è già in memoria

**Given** il precarico
**When** interroga la pila
**Then** usa la stessa chiave TanStack `['due', userId]` del conteggio della dashboard

### Story 4.2: La coda sopravvive alla chiusura dell'app

As a utente che chiude il browser con risposte non ancora inviate,
I want ritrovarle in coda alla riapertura,
So that non perda il lavoro fatto senza rete.

**Acceptance Criteria:**

**Given** il bootstrap dell'applicazione in `src/app/`
**When** il client viene configurato
**Then** la `mutationFn` delle risposte è registrata con `setMutationDefaults(['review'], …)`
**And** **non** è registrata dentro un componente

**Given** risposte date senza rete
**When** vengono prodotte
**Then** si accodano localmente e la coda viene persistita su IndexedDB con `throttleTime` non superiore a 250 ms

**Given** l'applicazione chiusa con la coda non vuota
**When** viene riaperta
**Then** la coda è ancora presente e il drenaggio parte automaticamente
**And** la reidratazione non fallisce con `No mutationFn found`

### Story 4.3: Il ritorno della rete non chiede il permesso

As a utente che esce dalla galleria,
I want che le risposte si sincronizzino da sole e nell'ordine giusto,
So that non debba fare niente e lo stato resti coerente.

**Acceptance Criteria:**

**Given** risposte in coda
**When** la rete torna disponibile
**Then** `resumePausedMutations()` viene invocata automaticamente, e lo è anche all'avvio dell'applicazione

**Given** più risposte in coda
**When** vengono drenate
**Then** ogni mutation porta `scope: { id: 'review-sync' }` e la coda si drena in serie, preservando l'ordine

**Given** una risposta data senza rete e sincronizzata mezz'ora dopo
**When** viene applicata
**Then** produce lo stesso esito e lo stesso `due_at` che avrebbe prodotto al momento della risposta
**And** il drenaggio non ricalcola nulla, perché `outcomeOf()` ha già deciso sul client

**Given** un fallimento di invio
**When** si verifica
**Then** il ritentativo è automatico e non esiste alcun pulsante "riprova" nell'interfaccia

### Story 4.4: Un indicatore che non spaventa

As a utente,
I want sapere che qualcosa è in attesa di sincronizzazione senza esserne interrotto,
So that non scambi il funzionamento previsto per un guasto.

**Acceptance Criteria:**

**Given** risposte in coda
**When** l'indicatore viene renderizzato
**Then** deriva da `useMutationState`, non da uno stato proprio del componente

**Given** la coda vuota
**When** l'interfaccia viene renderizzata
**Then** l'indicatore è **assente**, non mostra "tutto sincronizzato"

**Given** l'indicatore visibile
**When** viene ispezionato
**Then** non usa il colore di allarme, perché una risposta in coda non è un errore
**And** non è un modale né un toast bloccante

**Given** più risposte accodate in rapida successione
**When** l'indicatore cambia stato
**Then** annuncia via `aria-live="polite"` una volta al cambio di stato, non a ogni risposta

### Story 4.5: Riapplicare la coda non falsa niente

As a utente,
I want che un doppio invio non conti le mie risposte due volte,
So that le statistiche restino una misura e non un'approssimazione.

**Acceptance Criteria:**

**Given** una coda recuperata dopo la riapertura
**When** viene drenata due volte per un ritentativo
**Then** `review_log` non contiene righe duplicate

**Given** lo stesso `review_id` applicato due volte
**When** il secondo tentativo viene eseguito
**Then** lo stadio dell'esercizio non avanza una seconda volta

**Given** uno scenario end-to-end che simula la perdita di rete, la chiusura dell'app e la riapertura
**When** viene eseguito
**Then** le risposte date offline risultano applicate esattamente una volta ciascuna

---

## Epic 5: Statistiche che dicono quale regola non ti è entrata

L'utente vede le proprie risposte nel tempo, la distribuzione dei propri esercizi per stadio, e riconosce i punti grammaticali su cui sbaglia di più.

### Story 5.1: Quante risposte, e quando

As a utente che studia da settimane,
I want vedere l'andamento delle mie risposte nel tempo,
So that capisca se sto mantenendo il ritmo.

**Acceptance Criteria:**

**Given** una cronologia di risposte
**When** l'utente apre le statistiche
**Then** vede le risposte nel tempo

**Given** il grafico
**When** i dati vengono raccolti
**Then** derivano **esclusivamente** da `review_log`
**And** `review_count` in `review_state` non viene usato come fonte

### Story 5.2: A che punto sono i miei esercizi

As a utente,
I want vedere quanti dei miei esercizi stanno a ciascuno stadio,
So that capisca quanto del mio studio è consolidato e quanto è ancora fragile.

**Acceptance Criteria:**

**Given** esercizi a stadi diversi
**When** l'utente apre le statistiche
**Then** vede la distribuzione degli esercizi per stadio di scheduling

**Given** l'asse degli stadi
**When** viene costruito
**Then** deriva dalla stessa costante di `AD-17` esportata da `src/domain/schedule.ts`
**And** mostra esattamente sei stadi, `0`–`5`, senza un elenco parallelo nel codice della vista

### Story 5.3: Quale regola non mi entra in testa

As a utente,
I want riconoscere i punti grammaticali su cui sbaglio più spesso,
So that possa tornare sulla lezione giusta invece di ripetere a caso.

**Acceptance Criteria:**

**Given** una cronologia con esiti `again` ripetuti
**When** l'utente apre le statistiche
**Then** vede l'elenco dei **punti grammaticali** con il tasso di errore più alto, non dei singoli esercizi

**Given** l'aggregazione
**When** viene calcolata
**Then** raggruppa per `grammar_point` letto da `review_log`
**And** `lapse_count` in `review_state` non viene usato come fonte, per non produrre due numeri entrambi difendibili e diversi

**Given** un punto grammaticale nell'elenco
**When** viene renderizzato
**Then** nomina anche la lezione che lo insegna, così che l'informazione sia azionabile e non solo diagnostica

**Given** un esercizio riautorato che ha cambiato identità
**When** le statistiche vengono ricalcolate
**Then** la storia del punto grammaticale resta intatta, perché `review_log` lo porta denormalizzato

### Story 5.4: Un grafico vuoto non è una risposta

As a utente appena iscritto,
I want capire perché le statistiche sono vuote,
So that non pensi che l'applicazione sia rotta.

**Acceptance Criteria:**

**Given** dati insufficienti per un grafico
**When** la vista viene renderizzata
**Then** dichiara **cosa manca e quanto** — per esempio "servono almeno 3 giorni di risposte"

**Given** una qualsiasi delle tre viste statistiche
**When** non ha abbastanza dati
**Then** non mostra un riquadro di grafico vuoto né una schermata muta

---

## Epic 6: Lancio pubblico difendibile

Il progetto è pubblicamente utilizzabile e pubblicamente ispezionabile: privacy policy, riconoscimenti corretti alla fonte del metodo, licenze separate, README che spiega le scelte, percorso completo verificato end-to-end.

### Story 6.1: Dire cosa si tiene e come cancellarlo

As a sconosciuto che sta per consegnare la propria email,
I want leggere cosa viene memorizzato prima di registrarmi,
So that possa decidere con cognizione.

**Acceptance Criteria:**

**Given** la pagina di privacy policy
**When** viene letta
**Then** dichiara che vengono memorizzati soltanto email, hash della password, lezioni sbloccate, stato di revisione, log delle risposte e preferenze
**And** dichiara che non vengono raccolti nome, data di nascita né analitica sul singolo individuo

**Given** la pagina
**When** viene letta
**Then** spiega come cancellare l'account e dichiara che la cancellazione distrugge anche il log delle risposte

**Given** la schermata di Accesso
**When** viene renderizzata
**Then** contiene un collegamento alla privacy policy, raggiungibile **prima** della registrazione

**Given** Impostazioni
**When** viene renderizzata
**Then** contiene anch'essa un collegamento alla privacy policy

### Story 6.2: Riconoscere la fonte del metodo

As a chiunque si chieda da dove venga questo modo di spiegare la grammatica,
I want trovare dichiarata l'origine dell'approccio,
So that possa risalire alla fonte e giudicare da solo.

**Acceptance Criteria:**

**Given** la pagina di riconoscimenti
**When** viene letta
**Then** attribuisce a Cure Dolly la divulgazione del modello strutturale, con collegamento al canale

**Given** la stessa pagina
**When** viene letta
**Then** dichiara che il contenuto degli esercizi è **originale del progetto** e non riproduce materiale della fonte
**And** non usa formulazioni che suggeriscano affiliazione, approvazione o continuità con il canale

**Given** la stessa pagina
**When** viene letta
**Then** dichiara che la sostanza grammaticale insegnata è linguistica consolidata, citando almeno una fonte accademica indipendente
**And** il riferimento è verificabile, non generico

**Given** il nome del prodotto, il dominio e ogni elemento di identità visiva
**When** vengono ispezionati
**Then** non contengono il nome della fonte

### Story 6.3: Due licenze, perché sono due cose diverse

As a chiunque ispezioni il repository,
I want vedere dichiarata separatamente la licenza del codice e quella del contenuto,
So that possa riusare l'uno o l'altro sapendo a quali condizioni.

**Acceptance Criteria:**

**Given** la radice del repository
**When** viene ispezionata
**Then** contiene `LICENSE` per il codice e `LICENSE-CONTENT` per il contenuto delle lezioni, come due file distinti

**Given** il README
**When** viene letto
**Then** dichiara esplicitamente che le due licenze sono separate e perché

**Given** il README
**When** viene letto
**Then** risponde alle sette domande della traccia: cos'è il progetto, perché Leitner e non SM-2 o FSRS, perché il livello di dominio non dipende dal framework, perché Supabase e cosa cambierebbe su scala maggiore, perché Vite e non Next, cosa è stato lasciato fuori e perché, e come è stato usato il flusso assistito da AI — cosa delegato, cosa rifiutato, dove è costato più tempo di quanto ne abbia risparmiato

**Given** l'ultima risposta
**When** viene scritta
**Then** descrive la pipeline di autorazione di Epic 2 come caso concreto, inclusi il controllo anti-contaminazione e il suo limite dichiarato

### Story 6.4: Il percorso completo, verificato da una macchina

As a proprietario del progetto,
I want che il percorso principale sia coperto da un test end-to-end,
So that una regressione si scopra in CI e non dall'uso.

**Acceptance Criteria:**

**Given** la suite Playwright
**When** viene eseguita contro il progetto Supabase reale
**Then** un test copre registrazione → sblocco della prima lezione → risoluzione degli esercizi → pila a zero

**Given** un run di test end-to-end
**When** viene avviato
**Then** crea utenti con email univoca per quel run
**And** non usa fixture condivise né utenti di test permanenti

**Given** un run di test end-to-end
**When** termina
**Then** rimuove gli utenti creati tramite la stessa Edge Function di cancellazione account

**Given** la pipeline su una pull request
**When** viene eseguita
**Then** esegue i test end-to-end contro il progetto Supabase reale, sullo schema corrente
**And** le migrazioni vengono applicate solo dopo il merge, seguite da un e2e di collaudo

### Story 6.5: La cancellazione, verificata tabella per tabella

As a utente che se ne va,
I want la prova che non sia rimasto niente,
So that la promessa non poggi solo sulle chiavi esterne.

**Acceptance Criteria:**

**Given** un utente con dati in `review_state`, `review_log`, `lesson_progress` e `user_settings`
**When** cancella il proprio account
**Then** un test end-to-end interroga **ciascuna** delle quattro tabelle e verifica che non resti alcuna riga per quell'utente

**Given** l'account cancellato
**When** il test tenta di riaccedere con le stesse credenziali
**Then** l'accesso fallisce

**Given** la verifica
**When** viene scritta
**Then** controlla le tabelle esplicitamente, senza dedurre il risultato dalla presenza di un vincolo `on delete cascade`

### Story 6.6: Provare l'app con uno screen reader vero

As a utente che non vede lo schermo,
I want che la sessione di esercizio sia percorribile e comprensibile,
So that l'accessibilità dichiarata sia stata misurata e non solo ragionata.

**Acceptance Criteria:**

**Given** la sessione di esercizio
**When** viene percorsa con NVDA o VoiceOver
**Then** la frase giapponese viene pronunciata una sola volta, non due, confermando che `aria-hidden` sul `<rt>` è corretto

**Given** la sessione
**When** viene percorsa con uno screen reader
**Then** consegna, opzioni di risposta, esito e spiegazione vengono annunciati in un ordine comprensibile
**And** l'avanzamento è annunciato dalla live region

**Given** la verifica
**When** viene completata
**Then** l'esito è registrato per iscritto nel repository, inclusi gli eventuali difetti trovati
**And** è l'unica affermazione di accessibilità del progetto che non sia coperta da un test automatico
