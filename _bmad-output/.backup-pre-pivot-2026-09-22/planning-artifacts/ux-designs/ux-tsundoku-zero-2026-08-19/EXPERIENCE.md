---
name: Tsundoku Zero
status: final
sources:
  - '{planning_artifacts}/prds/prd-tsundoku-zero-2026-08-19/prd.md'
  - '{planning_artifacts}/prds/prd-tsundoku-zero-2026-08-19/addendum.md'
  - '{planning_artifacts}/architecture/architecture-tsundoku-zero-2026-08-19/ARCHITECTURE-SPINE.md'
updated: 2026-08-19
---

# Tsundoku Zero — Experience Spine

> Web responsive multi-superficie (telefono primario, portatile secondario). Accoppiata a `DESIGN.md`, che possiede l'identità visiva. Redatta in **fast path**, poi ratificata per intero: le sette assunzioni della prima stesura sono state tutte decise, e il registro con le motivazioni è in § Open Items. Una di esse è diventata un requisito di prodotto (`FR3.5`) e una una decisione architetturale (`AD-21`).

## Foundation

Applicazione web a superficie singola, responsive. **Non** un'app nativa, **non** una PWA: l'avvio a freddo offline è fuori scope per decisione esplicita del PRD `§8`.

Nessun UI system. Lo stack è Tailwind puro, e la convenzione di stile della spine è vincolante — *nessun CSS-in-JS, nessun file CSS per componente*. Non si eredita da shadcn, MUI o altro: ogni componente nominato qui esiste in `src/ui/` e il suo aspetto è definito in `DESIGN.md.Components`.

`DESIGN.md` è il riferimento di identità visiva. Questa spine possiede il comportamento. In conflitto, **vince la spine specifica del concern**: il colore lo decide `DESIGN.md`, quando una cosa compare lo decide questo documento.

Il confine di `AD-1` ha una conseguenza diretta su questo livello: `src/features/` **non** importa `src/data/`. Ogni schermata riceve i dati attraverso porte iniettate dal composition root. Nessuna schermata parla con Supabase.

## Information Architecture

Sei superfici. Non ce ne sono altre, e l'elenco è chiuso.

| Superficie | Raggiunta da | Scopo | Requisiti |
|---|---|---|---|
| **Accesso** | Rotta non autenticata; redirect da qualsiasi rotta protetta | Registrazione, accesso, errori prevedibili | `FR1.1`, `FR1.2`, `FR1.5`, `FR1.6` |
| **La pila** (dashboard) | Radice dopo l'accesso | Conteggio dovuti, streak, **una** azione primaria | `FR3.1`–`FR3.5` |
| **Sessione di studio** | Azione primaria della dashboard | Un item per volta, rivela, valuta | `FR4.1`–`FR4.3`, `FR4.5`–`FR4.7` |
| **Completamento** | Coda di sessione vuota | Conferma che la pila è a zero | `FR4.4`, `FR7.4` |
| **Statistiche** | Navigazione dalla dashboard | Revisioni nel tempo, distribuzione per stadio, item più sbagliati | `FR7.1`–`FR7.3`, `FR7.5` |
| **Impostazioni** | Navigazione dalla dashboard | Lingua, tetto giornaliero, cancellazione account | `FR1.4`, `FR6.4`, `FR8.2` |
| **Privacy** | Link da Impostazioni e da Accesso | Cosa è memorizzato e come cancellarlo | `FR10.1` |

`F2` (dataset) e `F5` (scheduling) non hanno superficie propria: il primo è contenuto mostrato dalle altre, il secondo è motore invisibile. `F9` (resilienza) non ha superficie ma ha un **indicatore globale** (vedi *Resilienza e sincronizzazione*). `F10.2` non ha superficie ma ha una **presenza obbligatoria** su tre layout, per `AD-16`.

**Chiusura di superficie.** Ogni requisito funzionale ha una superficie che lo eroga. *Impostazioni* e *Privacy* non sono attraversate da nessun percorso narrato, e **resta così**: sono superfici di intenzione deliberata e rara — ci si va perché si vuole andarci, non perché un flusso ci porta. Un percorso inventato per far quadrare un diagramma non renderebbe il prodotto migliore.

Quello che serve loro non è un percorso ma un **punto di ingresso trovabile**, e va fissato qui:

- **Impostazioni** — dall'intestazione della dashboard, presente su tutte le rotte autenticate.
- **Privacy** — da Impostazioni **e dalla schermata di Accesso**. Il secondo non è simmetria: è il solo momento in cui la pagina serve davvero. Si consegna un'email a uno sconosciuto *prima* di registrarsi, non dopo, e `NFR6` dichiara una postura sulla privacy che va resa leggibile quando pesa.

### La struttura a quest

È la cosa che l'owner ha esplicitamente chiesto di prendere da Renshuu, ed è l'unica cosa presa da lì.

Tsundoku Zero espone **due quest, mai simultanee**:

1. **Svuota la pila.** Attiva quando esistono item dovuti. Finita, concreta, con un conteggio che scende a zero.
2. **Introduci nuovi item.** Attiva **solo** quando la prima è chiusa, e limitata dal tetto giornaliero di `FR6.2`.

Il cancello di `FR6.1` — non puoi introdurre materiale nuovo finché la pila è piena — **è** il design della quest, non un vincolo tecnico che gli sta accanto. Il PRD lo dice in `§4`: *"Poter aggiungere materiale nuovo con la pila ancora piena è esattamente ciò che l'app deve impedire."*

Qui sta la divergenza dal riferimento. Renshuu presenta molte quest contemporaneamente e lascia scegliere; è denso, ed è la causa del *"molto difficile da capire"*. Tsundoku Zero ne presenta **una sola alla volta, e la sequenza è imposta**. Stessa struttura motivazionale, opacità rimossa per costruzione.

Ne discende una regola vincolante per la dashboard: **non mostrare mai le due quest insieme**, nemmeno una disabilitata accanto all'altra attiva. Un pulsante grigio "Introduci nuovi item (non ancora)" reintrodurrebbe la scelta che il cancello esiste per rimuovere.

## Voice and Tone

Microcopy. La postura del marchio vive in `DESIGN.md.Brand & Style`.

Interfaccia in inglese e italiano (`FR8.1`). Nessuna stringa cablata (`AD-14`): ogni riga qui sotto è una chiave i18n.

| Do (it / en) | Don't |
|---|---|
| "23 da rivedere" / "23 to review" | "Hai 23 elementi in attesa di revisione!" |
| "Studia" / "Study" | "Inizia la tua sessione di apprendimento" |
| "Pila vuota. Introduci fino a 10 nuovi item." / "Pile empty. Add up to 10 new items." | "Ottimo lavoro! 🎉 Non hai altro da rivedere oggi!" |
| "Pila a zero. 7 giorni di fila." / "Pile at zero. 7 days running." | "Complimenti! Streak di 7 giorni! Continua così!" |
| "Password errata." / "Wrong password." | "Le credenziali inserite non risultano corrette." |
| "Servono almeno 3 giorni di revisioni per disegnare questo grafico." / "This chart needs at least 3 days of reviews." | *(grafico vuoto senza spiegazione)* |
| "2 valutazioni in attesa di sincronizzazione." / "2 reviews waiting to sync." | "Errore di rete! Le tue modifiche potrebbero andare perse!" |

**Tre regole.**

Il conteggio arriva prima del verbo — "23 da rivedere", non "hai 23 item". È la quest, e va letta in un colpo d'occhio a 8:10 del mattino.

Nessun punto esclamativo, nessuna emoji, nessun avverbio di lode. La chiusura della pila è la ricompensa; commentarla la sminuisce. Questa regola è la traduzione in microcopy del rifiuto della gamification.

Un fallimento dice **cosa è successo**, non **come ti devi sentire**. `FR1.5` elenca quattro fallimenti prevedibili e la convenzione della spine impone che passino da un unico traduttore in `features/auth` verso chiavi i18n dedicate — nessun messaggio grezzo di Supabase raggiunge l'utente.

## Component Patterns

Comportamentale. Le specifiche visive vivono in `DESIGN.md.Components`.

| Componente | Dove | Regole di comportamento |
|---|---|---|
| `pile-counter` | Dashboard | Legge la **stessa chiave TanStack** `['due', userId]` che alimenta il precarico di sessione e il cancello dei nuovi item (`AD-5`). Non ricalcola nulla per conto proprio |
| `button-primary` | Dashboard, Completamento, Accesso | Al massimo uno per schermata (`FR3.3`). L'etichetta cambia con lo stato della pila, la posizione no |
| `study-card` | Sessione | Due stati: **prompt** e **rivelato**. La transizione è a senso unico dentro l'item corrente; non si torna a nascondere |
| `rating-button` ×4 | Sessione | Visibili **solo** dopo la rivelazione. Prima non sono disabilitati: **non ci sono**. Un pulsante disabilitato invita a chiedersi perché |
| `progress-meter` | Sessione | Riflette lo stato ottimistico locale, non la conferma del server (`NFR7`). Un item valutato in galleria fa avanzare la barra subito |
| `attribution-bar` | Dashboard, Sessione, Statistiche | Presente sempre, su tutte e tre. Non condizionale, non richiudibile (`AD-16`) |
| `sync-indicator` | Layout globale | Deriva da `useMutationState`, non da uno stato proprio (`AD-8`). Assente quando la coda è vuota — non "tutto sincronizzato", proprio assente |
| `empty-state` | Ovunque | Dichiara **perché** è vuoto e offre al massimo un'azione (`FR3.4`, `FR7.5`) |
| `streak-badge` | Dashboard, Completamento | Numero e unità. Derivato da `review_log` a ogni lettura (`AD-18`), mai da una colonna |

## Rendering del giapponese

Sezione inventata: è il concern centrale di questo prodotto e nessuna sezione standard lo copre.

**Furigana attiva.** Il kana compare come ruby sopra i kanji, in markup `<ruby>` / `<rt>`. È la sola cosa che l'owner ha chiesto di replicare da Renshuu oltre alla struttura a quest.

| Superficie | Kanji | Furigana | Romaji | Significato |
|---|---|---|---|---|
| Card di studio, stato **prompt** | visibile | **nascosta** | nascosto | nascosto |
| Card di studio, stato **rivelato** | visibile | **visibile** | nascosto | visibile |
| Statistiche (item più sbagliati) | visibile | visibile | nascosto | visibile |

**Perché la furigana è nascosta nel prompt.** Se il kana compare sopra il kanji prima della rivelazione, l'esercizio è già risolto: `FR4.2` chiede all'utente di richiamare la lettura, e mostrargliela annulla l'atto di richiamo che l'intero motore di scheduling esiste per misurare. La furigana è **la risposta**, non il prompt. Compare insieme al significato.

**Il romaji non compare mai nell'interfaccia.** Decisione ratificata, non assunzione.

`FR2.2` lo tiene nel dataset e nessun requisito chiede di mostrarlo. Con la furigana attiva sarebbe una terza rappresentazione della stessa informazione, sulla stessa card.

L'obiezione naturale — *"e chi non legge ancora speditamente il kana?"* — non regge, e vale la pena scriverne il perché, perché è la domanda che tornerà. **La furigana è kana.** Chi non sa leggere il kana non è aiutato dalla furigana più di quanto lo sia dalla parola: il romaji sarebbe l'unica cosa leggibile, e la card smetterebbe di insegnare qualcosa. In più il livello N5 presuppone l'alfabetizzazione in kana — l'esame stesso è scritto in kana e kanji — e il PRD `§3` mette esplicitamente fuori scope l'insegnamento degli alfabeti. Un prodotto che mostra il romaji accanto al kana insegna a leggere il romaji.

**Non c'è nemmeno un'impostazione per riattivarlo**, e l'assenza è deliberata: le impostazioni sono due, e la terza aprirebbe la porta alla configurabilità che questo prodotto rifiuta per costruzione. Se la decisione si rivelasse sbagliata è una riga nel componente della card, non un cambio di architettura.

**Due obblighi che non sono negoziabili.** Ogni nodo che contiene giapponese porta `lang="ja"`, imposto da `AD-14` e `AD-15`: senza, uno screen reader italiano pronuncia 駅 come testo italiano. E il giapponese **non passa da i18n** — è dato, non interfaccia.

### L'allineamento — chiuso da `AD-21`

Il modello dati espone `kanji` e `kana` come stringhe **intere e separate**, senza allineamento per carattere. Il ruby di gruppo funziona su 駅 → えき, ma **non** su 難しい → むずかしい: coprirebbe anche la okurigana しい, che è già kana.

Questa spine ha aperto il buco; `AD-21` lo ha chiuso. `alignFurigana(kanji, kana)` è una funzione **pura in `src/domain/furigana.ts`** che toglie prefisso e suffisso di kana comuni alle due stringhe e applica ruby di gruppo al nucleo rimasto, restituendo segmenti `{ text, ruby }`.

Per questo livello ne discende una sola conseguenza, ed è vincolante: **`src/ui/` riceve i segmenti già calcolati** e li rende in `<ruby>`/`<rt>`/`<rp>`. Nessuna logica di allineamento nel componente — se ci fosse, non sarebbe testabile senza montarlo.

I casi che il componente deve saper rendere sono tre, non uno: okurigana (難しい → `難`+ruby, `しい` nudo), prefisso kana (お茶 → `お` nudo, `茶`+ruby), e nucleo intero con ruby di gruppo per i jukujikun (今日, 大人, 一人), dove la separazione per carattere è impossibile e il gruppo è la resa corretta.

## State Patterns

| Stato | Superficie | Trattamento |
|---|---|---|
| Caricamento a freddo | Dashboard | Scheletro del `pile-counter` alla sua altezza finale. **Nessuno spinner**: lo spazio non deve saltare quando il numero arriva |
| **Primo avvio — mai studiato nulla** | Dashboard | `FR3.5`. Nessun conteggio, nessuno streak: non c'è niente da contare. Una riga che dice cosa fa l'app e una sola azione primaria, "Introduci 10 item". **Non riusare il testo della pila svuotata**: qui significa *comincia*, là significa *hai finito*. Da questo stato dipende `M4` |
| Pila piena | Dashboard | `pile-counter` con il conteggio, `streak-badge`, azione primaria "Studia" |
| **Pila a zero, dataset disponibile** | Dashboard | Il conteggio **non** diventa "0". Lo stato cambia: "Pila vuota." e l'azione primaria diventa introdurre nuovi item (`FR3.4`). Quest 1 chiusa, quest 2 aperta |
| **Pila a zero, dataset esaurito** | Dashboard | Dichiarato esplicitamente: nessun item nuovo esiste più. Nessuna azione primaria. È l'unica schermata dell'app senza azione (`FR3.4`) |
| Tetto giornaliero raggiunto | Dashboard | Dichiara il tetto e quando si riapre. Rimanda a Impostazioni per cambiarlo (`FR6.4`) |
| Sessione in corso | Studio | `progress-meter` sempre visibile (`FR4.5`) |
| Item ripresentato nella stessa sessione | Studio | Un item con intervallo zero (`FR5.4`) torna in coda **senza segnalazione**. Marcarlo "già sbagliato" aggiunge vergogna a un meccanismo che esiste per essere neutro |
| Coda vuota | Completamento | Conferma il risultato e lo streak aggiornato (`FR4.4`, `FR7.4`) |
| Sessione abbandonata | Dashboard al rientro | Le valutazioni date restano acquisite (`FR4.6`). La dashboard mostra il conteggio residuo come conteggio normale. **Nessun "riprendi dove eri"**: la sessione è effimera per `AD-6` e si ricostruisce dagli item ancora dovuti (`FR4.7`) |
| Rete assente durante la sessione | Studio | La sessione **continua**. Compare `sync-indicator`. Nessun blocco, nessun modale (`FR9.1`–`FR9.4`) |
| Riapertura con coda non svuotata | Globale | `sync-indicator` presente dall'avvio, drenaggio automatico (`FR9.5`) |
| Dati insufficienti | Statistiche | Ogni grafico dichiara **cosa manca e quanto** — "servono almeno 3 giorni". Mai un grafico vuoto (`FR7.5`) |
| Errore prevedibile di autenticazione | Accesso | Messaggio tradotto accanto al campo responsabile, non in cima alla pagina (`FR1.5`) |
| Errore dati | Qualunque | Errore dallo stato TanStack Query. Nessun `catch` silenzioso |
| Cancellazione account | Impostazioni | Conferma esplicita che dichiara la conseguenza: **le statistiche non sopravvivono** (`FR1.4`, PRD `§7`) |

## Interaction Primitives

**Da tastiera, ed è un contratto ratificato.** `AD-15` lo fissa e questa spine non lo reinterpreta:

- **Spazio** — rivela la risposta
- **`1` `2` `3` `4`** — valutano nell'ordine `again`, `hard`, `good`, `easy`
- **Esc** — abbandona la sessione, valutazioni già date acquisite (`FR4.6`)

La sessione completa è percorribile **senza mouse**, ed è verificata da un test di componente che la guida da sola tastiera (`AD-15`, `NFR3`).

**Da tocco.** Tap sulla card rivela — bersaglio l'intera card, non un pulsante piccolo: UJ-1 è a una mano su un treno in movimento. I quattro pulsanti di valutazione stanno nella fascia bassa (`DESIGN.md`, `{spacing.thumb-zone}`).

**Vietati ovunque:** modali sopra modali; affordance che esistono solo in hover (rendono l'app inutilizzabile da tocco); conferme di annullamento su una valutazione (`FR5.4` la rende recuperabile da sola: un `again` ripresenta l'item nella stessa sessione); qualsiasi animazione celebrativa al completamento; scorciatoie diverse fra sessione di studio e introduzione nuovi item — è lo stesso gesto sullo stesso tipo di contenuto.

## Accessibility Floor

Comportamentale. Il contrasto visivo vive in `DESIGN.md`.

**WCAG 2.2 AA su tutta la superficie.** Ratificato. `NFR4` chiede tastiera, ARIA, live region e marcatura della lingua senza nominare un livello di conformità; AA è il livello che li contiene tutti ed è l'unico **verificabile meccanicamente** — lo script del contrasto è già scritto.

AAA è stato considerato e scartato: imporrebbe `7:1` sul testo, che il fondo carta di `DESIGN.md` non regge senza diventare bianco e nero puri. Il costo non comprerebbe accessibilità reale su un'interfaccia a sei schermate già interamente operabile da tastiera.

- **Una sola live region `aria-live="polite"` per sessione** annuncia rivelazione e avanzamento (`AD-15`). Una sola, non una per componente: due live region si sovrappongono e producono annunci illeggibili.
- Ogni nodo con giapponese porta `lang="ja"` (`AD-14`, `AD-15`).
- **Il ruby della furigana è `aria-hidden`, con `<rp>` come parentesi di ripiego.** Ratificato.

  Uno screen reader con voce giapponese legge già 駅 come *eki*: annunciare anche il `<rt>` produce "eki eki". Il dubbio era il caso opposto — uno screen reader **senza** voce giapponese — e si risolve osservando che lì non funziona nemmeno il testo base: 駅 verrebbe saltato o pronunciato come spazzatura, e la furigana えき subirebbe la stessa sorte, essendo anch'essa giapponese. `aria-hidden` è quindi corretto nel caso in cui conta e neutro nel caso in cui non conta.

  Chi usa uno screen reader riceve comunque l'identità della parola dalla riga del significato, che è in inglese o italiano e viene letta normalmente.

  **Verifica reale richiesta, non dedotta:** una storia di Epic 5 percorre la sessione con NVDA o VoiceOver e registra l'esito. È l'unico modo onesto di chiudere questo punto, e resta l'unica affermazione di accessibilità di questo documento che non sia verificabile da un test automatico.
- Ordine di tabulazione uguale all'ordine di lettura. Nella sessione: card, poi i quattro pulsanti da sinistra a destra, nello stesso ordine dei tasti `1`–`4`.
- I quattro esiti non si distinguono **mai** per solo colore: etichetta, posizione e numero portano l'informazione (`DESIGN.md.Components`, `rating-button`).
- Anello di focus visibile su ogni elemento interattivo, `{colors.focus-ring}` (`4.88:1` sul fondo, ampiamente sopra il 3:1 richiesto per il non-testo).
- Il confine dei quattro `rating-button` usa `{colors.border-strong}`, **non** `{colors.border-hairline}`. Il secondo sta a `1.27:1` ed è ammesso solo per separazione decorativa: come unico contorno di un bersaglio sparirebbe a piena luminosità, che è esattamente la condizione di UJ-1.
- **Il contrasto è verificato per calcolo, su entrambi i fondi** (`{colors.surface-base}` e `{colors.surface-raised}`) e in entrambe le modalità. La prima stesura di questa spine dichiarava AA con `{colors.ink-muted}` a `2.87:1` sull'attribuzione — cioè falliva la conformità proprio sull'unico testo che una licenza obbliga a mostrare. Una dichiarazione di livello senza il calcolo che la sostiene non vale niente.
- Bersagli da 56px, sopra il minimo AA di 24px con margine ampio — il vincolo reale qui è il treno in movimento, non la norma.
- `sync-indicator` è `aria-live="polite"` e annuncia **una volta** al cambio di stato, non a ogni item accodato.

## Key Flows

I nomi di UJ-1 e UJ-2 sono ripresi alla lettera dal PRD `§4`. UJ-3 non esiste nel PRD.

### UJ-1 — La sessione del pendolare

Protagonista: **Federico**, in metropolitana alle 8:10, telefono, una mano.

1. Apre l'app. La dashboard mostra **23 da rivedere**, streak **6 giorni**, un solo pulsante.
2. Tocca *Studia*. La sessione precarica l'intera pila dovuta (`FR9.1`).
3. Compare 駅. Nessuna furigana, nessun significato.
4. Tocca la card. Compaiono えき in ruby sopra 駅, e *stazione*.
5. Valuta **Facile**. Il conteggio scende a 22, la barra avanza subito (`NFR7`).
6. **Climax —** al terzo item il treno entra in galleria e il campo sparisce. **Non succede niente.** La sessione continua, le valutazioni si accodano, compare `sync-indicator`. Federico non se ne accorge.
7. Alla fermata dopo la rete torna, la coda si drena, l'indicatore sparisce da solo.
8. Arriva a zero uscendo dalla stazione: schermata di completamento, streak a 7.

Il momento decisivo è il passo 6, e la sua qualità si misura da **quanto poco accade**. Un modale "Sei offline" qui sarebbe un fallimento di prodotto, non una cortesia.

### UJ-2 — La pila è già a zero

Protagonista: **Federico**, la sera, portatile, tastiera.

1. Apre l'app. La pila è **già a zero** — svuotata in metro, e il portatile lo sa.
2. La dashboard **non** propone di rivedere. Quest 1 è chiusa; propone di introdurre nuovi item (`FR3.4`).
3. Ne introduce 10, il tetto giornaliero (`FR6.2`). Ogni item è materializzato subito a stadio 0 (`AD-19`).
4. **Climax —** li studia immediatamente, interamente da tastiera: spazio rivela, `1`–`4` valutano, il mouse non viene mai toccato.
5. Apre le statistiche. Revisioni nel tempo, distribuzione per stadio, i cinque item più sbagliati — fra cui 難しい, che continua a ricadere a stadio 0.

Il passo 5 è il collaudo di `FR7.3`: la vista deve dire qualcosa di **azionabile**. Riconoscere 難しい come proprio nemico personale è azionabile; un grafico a torta non lo è.

### UJ-3 — Il primo minuto di uno sconosciuto

Non è nel PRD come percorso narrato. Lo deriva da **M4**, metrica di successo dichiarata: *uno sconosciuto si registra e inizia a studiare in meno di 60 secondi*. Senza un percorso, M4 non aveva un progetto che la erogasse — e lo stato su cui poggia il passo 4 ora è un requisito, `FR3.5`.

1. Arriva sull'URL pubblico. La superficie di Accesso dichiara in una riga cosa fa l'app.
2. Email e password. Nessuna conferma via email, nessun onboarding, nessun questionario di livello.
3. Atterra sulla dashboard. La pila è vuota — non ha mai studiato nulla.
4. **Climax —** lo stato di pila vuota **non** è un vicolo cieco: è la quest 2. Un'azione, "Introduci 10 item", e sta studiando.
5. Prima card entro il minuto.

Il rischio di M4 è tutto al passo 3. Se lo stato vuoto del primo accesso somiglia a un errore o a un'app rotta, la metrica fallisce indipendentemente da quanto è veloce la registrazione. **Lo stato vuoto del primo accesso e lo stato "pila svuotata con successo" sono lo stesso stato tecnico e devono essere due schermate diverse**, perché il primo significa "comincia" e il secondo significa "hai finito".

Era la lacuna di prodotto più concreta trovata da questa spine: il PRD non distingueva i due casi. **Ora li distingue — `FR3.5`**, aggiunto proprio per questo.

## Resilienza e sincronizzazione

Sezione inventata: `F9` non ha superficie propria ma ha un comportamento visibile trasversale.

Il principio è che la resilienza **non si annuncia**. `FR9.4` chiede uno stato "visibile ma non invasivo", e la lettura corretta è la più conservativa possibile.

| Evento | Cosa vede l'utente |
|---|---|
| La rete cade a sessione avviata | Niente cambia nella card. Compare `sync-indicator` con il conteggio in coda |
| Valuta senza rete | La barra avanza, il conteggio scende. Identico all'online (`NFR7`) |
| La rete torna | La coda si drena in serie (`AD-8`). L'indicatore sparisce da solo |
| Chiude l'app con la coda piena | Alla riapertura l'indicatore è già presente, il drenaggio parte da solo (`FR9.5`) |
| La stessa coda viene riapplicata | Nessun effetto visibile: `apply_review` è idempotente su `review_id` (`AD-7`, `FR9.6`) |
| Avvio a freddo senza rete | **Fuori scope** (PRD `§8`). Errore onesto: l'app ha bisogno della rete per partire |

**Nessun modale, nessun toast bloccante, nessun pulsante "riprova".** Il ritentativo è automatico per `AD-8`, e un pulsante manuale suggerirebbe che possa servire.

## Responsive & Platform

| Breakpoint | Comportamento |
|---|---|
| `< 640px` — telefono, **superficie primaria** | Colonna singola, gutter 20px. Valutazione in fascia bassa. Card a piena larghezza |
| `640–1024px` — tablet | Colonna singola centrata, larghezza massima `{spacing.measure}`. La valutazione risale sotto la card |
| `≥ 1024px` — portatile | Contenuto centrato a `{spacing.measure}`, **non allargato**. Statistiche possono passare a due colonne. La tastiera diventa il percorso primario |

Il telefono è la superficie primaria perché UJ-1 lo è. Il portatile non è una versione ridotta né ampliata: è lo stesso layout con più aria e la tastiera in primo piano.

**Nessuna funzionalità è esclusiva di una superficie.** La persona del PRD usa lo stesso account su entrambi e si aspetta che la pila sia coerente — è l'intera ragione per cui l'app ha un backend.

## Inspiration & Anti-patterns

**Preso da Renshuu — la struttura a quest.** Obiettivi finiti, concreti, completabili, visibili all'apertura senza doverli cercare. In Tsundoku Zero diventano due quest sequenziate dal cancello di `FR6.1`. È l'unica cosa strutturale presa dal riferimento, ed è stata scelta esplicitamente dall'owner.

**Preso da Renshuu — la furigana in ruby.** Il kana sopra il kanji, non accanto.

**Rifiutato — Kao-chan, i pastelli, la gamification.** Mascotte, battaglie contro mostri, gacha, achievement, minigiochi. L'owner ha scelto la struttura e **rifiutato l'identità**, e il rifiuto vale fino in fondo: niente coriandoli al completamento, niente badge, niente verde di successo.

**Rifiutato — la configurabilità totale.** Renshuu dichiara in vetrina *"everything on renshuu can be adjusted or disabled"*, ed è quasi certamente la causa del *"molto difficile da capire"* che l'owner riporta come suo unico attrito. Tsundoku Zero espone **due sole impostazioni** — lingua e tetto giornaliero — e non ha nessuna personalizzazione visiva. Non per povertà: per difesa.

**Rifiutato — mostrare le due quest insieme.** Anche in forma disabilitata. Il cancello esiste per rimuovere una scelta, e un pulsante grigio la rimette.

**Rifiutato — furigana adattiva.** Renshuu toglie la furigana sui kanji che consideri noti. È elegante e il modello dati la permetterebbe: `review_state.stage` esiste già. **Non entra in v1.** Renderebbe la card dipendente dallo stadio, cioè dallo stato di scheduling, in un punto in cui `FR4.2` vuole solo prompt e rivelazione. Vale la pena riaprirla in v2, con un requisito scritto.

## Open Items

**Tutti chiusi al 2026-08-19.** Le sette voci aperte dalla stesura in fast path sono state decise; nessuna assunzione non ratificata resta in questo documento. Il registro sta qui perché la motivazione di una decisione vale più della decisione.

| # | Voce | Esito |
|---|---|---|
| 1 | Allineamento della furigana | ✅ Risolto da **`AD-21`**. Funzione pura in `src/domain/furigana.ts`, `src/ui/` riceve segmenti già calcolati. Prototipo verificato su 19 casi N5 |
| 2 | Romaji mostrato o no | ✅ **Mai mostrato**, e senza impostazione per riattivarlo. La furigana *è* kana: chi non legge il kana non è aiutato da nessuna delle due. Vedi *Rendering del giapponese* |
| 3 | Primo accesso ≠ pila svuotata | ✅ Promosso a requisito di prodotto: **`FR3.5`** nel PRD. `M4` dipendeva da uno stato che il PRD non descriveva |
| 4 | Modalità scura | ✅ **In v1, come pari**, e **senza interruttore**: segue `prefers-color-scheme`. Vedi sotto |
| 5 | Livello di accessibilità | ✅ **WCAG 2.2 AA** ratificato. AAA scartato con motivazione. Vedi *Accessibility Floor* |
| 6 | `aria-hidden` sul ruby | ✅ Ratificato, con **verifica manuale obbligatoria** su NVDA o VoiceOver in Epic 5 |
| 7 | Impostazioni e Privacy senza percorso | ✅ **Accettato come proprietà**, non lacuna. Fissati i punti di ingresso. Vedi *Information Architecture* |

### Sulla modalità scura

Entra in v1. Tre ragioni, in ordine di peso.

`DESIGN.md` definisce già l'insieme scuro completo — tredici token, tutti verificati AA. Non entrarci significherebbe cancellare metà del sistema colore per non scrivere una media query.

Il costo reale è molto minore di quanto sembri, **a una condizione**: che i componenti usino soltanto token, mai valori letterali. `UX-DR1` lo impone già. A quella condizione la modalità scura è uno scambio di variabili, non una riscrittura per componente. Se un componente scrive un colore letterale, il costo esplode — ed è la ragione per cui la regola vale la pena imporla meccanicamente.

E `AD-20`: togliere una capacità dimostrabile per snellire è precisamente la mossa che questo progetto vieta.

**Nessun interruttore in Impostazioni.** Le impostazioni restano due — lingua e tetto giornaliero. Il tema segue la preferenza di sistema e basta: chi vuole il tema scuro lo ha già impostato altrove, e un terzo controllo comprerebbe pochissimo pagando in superficie configurabile, che è il difetto che questo prodotto esiste per non avere.
