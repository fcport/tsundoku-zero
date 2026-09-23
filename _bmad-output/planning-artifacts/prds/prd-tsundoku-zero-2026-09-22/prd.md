---
title: "Tsundoku Zero — PRD (v2, pivot alla grammatica strutturale)"
status: final
created: 2026-09-22
updated: 2026-09-22
supersedes: "../prd-tsundoku-zero-2026-08-19/prd.md"
---

# Tsundoku Zero — PRD

> 積ん読ゼロ — svuota la pila.

**Prodotto:** generatore di esercizi di grammatica giapponese basato su un modello strutturale della lingua, alimentato lezione per lezione dallo studio dell'owner.
**Owner:** Federico Casadei · **Stato:** pre-sviluppo · **Posta in gioco:** pubblico, senza pretese di scala.

## Rapporto con la v1 del 19 agosto

La v1 di questo PRD descriveva un'app di ripetizione dilazionata per il **vocabolario** N5: dataset JMdict di circa 700 item, card kanji verso significato, autovalutazione a quattro esiti. Quel documento resta in `../prd-tsundoku-zero-2026-08-19/` come storia della decisione, ed è **superato** da questo.

Cosa sopravvive intatto: il motore di scheduling, lo streak, la resilienza di rete, l'autenticazione, l'internazionalizzazione, l'isolamento per riga, la cancellazione account, il confine architetturale, l'intero impianto di lancio pubblico. Cosa cambia: **cosa c'è nella pila**. Non più parole da riconoscere, ma esercizi di grammatica da risolvere.

Il nome regge senza forzature: la pila è di esercizi dovuti, e l'obiettivo quotidiano resta portarla a zero.

---

## 1. Contesto e problema

Il vocabolario giapponese ha già dieci strumenti che lo risolvono bene. La **grammatica** no.

Il problema non è la mancanza di app: è che quasi tutte insegnano la grammatica giapponese attraverso categorie inglesi, e poi devono giustificare centinaia di "eccezioni" che eccezioni non sono. Il caso emblematico è は: i manuali lo presentano come marcatore del soggetto, e da lì nasce una confusione che lo studente si porta dietro per anni.

Esiste un modello alternativo, coerente e insegnabile, divulgato dal canale **Organic Japanese with Cure Dolly**: il giapponese ha una struttura regolare in cui **が marca sempre il soggetto**, anche quando il soggetto non è scritto — il pronome zero, ゼロ代名詞. は non è un marcatore di soggetto: pone il tema e sta *sopra* la frase. Da lì discendono le tre forme in cui una frase si chiude — predicato verbale, copula だ, aggettivo in い — il fatto che gli aggettivi in い contengano già la copula, e la regolarità di passivo, causativo e verbi di dare e ricevere.

Il modello è **strutturale e regolare**, quindi codificabile. È la ragione tecnica per cui questo prodotto è possibile: un sistema con regole si trasforma in esercizi generabili e verificabili, un elenco di eccezioni no.

Tsundoku Zero esiste per due ragioni, in quest'ordine di priorità:

1. **Uno strumento che l'owner userà ogni giorno mentre studia.** Il prodotto è agganciato a un percorso di studio reale e in corso: un corso di **oltre novanta lezioni**, di cui 11 viste al 22 settembre 2026. Il totale esatto non è fissato e il piano non ci si appoggia — vedi `NFR9`. Se l'owner smette di usarlo, il progetto è fallito a prescindere dalla qualità del codice.
2. **Una codebase React/TypeScript dimostrabile** — con forma da produzione, testata, deployata, difendibile riga per riga in un colloquio tecnico.

**Non-obiettivo dichiarato:** non è un corso. Non spiega la grammatica da zero, non sostituisce le lezioni, non produce contenuto didattico originale nel senso di materiale d'insegnamento. È il *drill* che segue una lezione già vista altrove.

### Perché questo è più difendibile della v1

La v1 era una reimplementazione competente di un problema già risolto. Questa affronta un problema che gli strumenti esistenti trattano male, e lo fa con un'idea architetturale che si racconta in una frase: **il contenuto è aperto, la forma è chiusa.**

---

## 2. Rapporto con la fonte del metodo

Concern vincolante, affrontato prima del resto perché può chiudere il progetto.

**Le idee grammaticali non sono proteggibili.** Il modello a pronome zero, la funzione di が e は, le tre forme di chiusura della frase: sono fatti linguistici e metodi didattici. Insegnarli è libero, e attribuirne la divulgazione a Cure Dolly è onestà intellettuale, non un obbligo di licenza.

**L'espressione di quelle idee lo è.** I video, i transcript, le formulazioni specifiche e gli esempi originali sono opera protetta, oggi in capo a un'eredità — il che rende praticamente impossibile ottenere un permesso. La v1 di questo progetto aveva già un precedente utile nella separazione fra `LICENSE` e `LICENSE-DATA` per JMdict.

**Le metafore però sono sue.** La distinzione è sottile e va tenuta ferma: il *fatto* che una frase giapponese si chiuda in tre modi — predicato verbale, copula だ, aggettivo in い — è grammatica. Chiamarli "motori" e disegnare la frase come un treno con un vagone e un gancio è **espressione creativa**, ed è il modo in cui lei insegna. Il progetto usa la terminologia linguistica standard: **verbo**, **copula**, **aggettivo in い**. Non è solo prudenza — in un esercizio è anche più chiaro, perché non richiede di conoscere la metafora per capire la domanda.

**La sostanza insegnata è consenso accademico, non un'invenzione proprietaria.** È l'argomento più solido a disposizione di questo progetto e va scritto, non lasciato implicito. L'analisi di は come marcatore di tema, con が che marca il soggetto anche quando resta non espresso, è linguistica giapponese consolidata: il testo fondativo è di Mikami Akira, 1960, e si intitola letteralmente **象は鼻が長い**. Il pronome zero è il *pro-drop* della linguistica generale. Il contributo di Cure Dolly è **pedagogico e divulgativo** — averlo spiegato bene a studenti occidentali — non la scoperta dei fatti.

Ne discende che gli esercizi poggiano su fatti verificabili su fonti accademiche indipendenti, e che gli esempi canonici della letteratura — 象は鼻が長い per primo — sono liberi da sessantasei anni e non appartengono a nessuno.

Regole operative, non negoziabili:

| Consentito | Vietato |
|---|---|
| Insegnare il modello strutturale, con parole proprie | Riprodurre transcript, spiegazioni o frasi d'esempio originali |
| Riconoscere Cure Dolly come origine dell'approccio, con collegamento al canale | Usare il nome nel prodotto, nel dominio o nel branding |
| Usare i termini della **linguistica** — pronome zero, tema, soggetto, copula, ゼロ代名詞 | Riusare le sue **metafore didattiche** — il treno, il vagone, il motore, il gancio |
| | Incorporare o rimandare ai video come contenuto dell'app |
| Usare i transcript come **input privato** della sessione di autorazione | Versionare transcript, sottotitoli o trascrizioni nel repository |
| Indicizzare il contenuto per punto grammaticale | Riprodurre titoli, numerazione o ordine delle lezioni della fonte |

Le ultime due righe meritano una nota, perché sono quelle su cui si sbaglia in buona fede.

**Il transcript è materia prima, non materiale.** Leggere un'opera protetta per impararne il contenuto non è un atto rilevante per il diritto d'autore: è quello per cui l'opera esiste. Da un transcript si estraggono **fatti** — quale punto grammaticale, qual è la regola, quale confusione risolve — e da quei fatti si riscrive da zero. Parafrasare con i sinonimi la formulazione di qualcun altro resta opera derivata, e il fatto che suoni diverso non cambia nulla.

**La selezione e la disposizione di un corso possono essere protette come raccolta**, anche quando i singoli fatti che contiene sono liberi. Un'app che espone "Lezione 12" con il titolo e l'ordine della fonte ne diventa di fatto un indice. Indicizzare per concetto invece che per episodio evita il problema ed è anche un prodotto migliore: resta utilizzabile da chi quella fonte non l'ha mai vista, invece di essere un accessorio che da solo non funziona.

**Conseguenza sul dataset.** La v1 distribuiva JMdict, che è CC BY-SA 4.0 e impone attribuzione su ogni schermata che mostra voci. Questa versione **non distribuisce un dizionario**: le frasi degli esercizi e le glosse dei loro vocaboli nascono nella pipeline di autorazione (F11) e sono contenuto proprio del progetto. JMdict può essere consultato **in fase di autorazione** come verifica delle glosse — è uso di uno strumento, non ridistribuzione di un dataset, e non fa scattare la clausola EDRDG sui server web.

Ne discende che l'attribuzione non è più un invariante di layout su ogni schermata, ma un riconoscimento in una pagina dedicata e nel README. È un **allentamento consapevole** di `AD-16`, non una dimenticanza.

`[ASSUMPTION]` La licenza del contenuto delle lezioni resta da scegliere fra MIT (uniforme con il codice) e CC BY-SA (invito al riuso didattico). Non bloccante, da decidere prima del lancio pubblico.

---

## 3. Obiettivi e metriche

| ID | Metrica | Soglia v1 |
|---|---|---|
| M1 | Giorni consecutivi di uso reale da parte dell'owner | ≥ 14 |
| M2 | Quota di **sessioni** avviate che portano la pila a zero | ≥ 80% |
| M3 | Tempo mediano per svuotare la pila giornaliera | ≤ 10 minuti |
| M4 | Uno sconosciuto si registra e risolve il primo esercizio dal deploy pubblico | < 60 secondi |
| M5 | Tempo per autorare una lezione completa, dalla visione all'esercizio giocabile | ≤ 30 minuti |

M1 resta il criterio di accettazione reale. **M5 è nuova ed è la metrica di sostenibilità del progetto:** con ottanta e più lezioni ancora da vedere e il contenuto che arriva al ritmo dello studio dell'owner, una pipeline che costa due ore a lezione non viene usata, e il prodotto muore per fame di contenuto invece che per difetti di codice.

Come nella v1, M2 conta **sessioni** e non giornate, e M3 usa la mediana e non la media. Le ragioni sono identiche e restano valide: M2 misura l'attrito dentro la sessione, M1 la tenuta dell'abitudine. Ne discende lo stesso requisito di prodotto — riprendere più tardi nella stessa giornata deve essere possibile e non deve penalizzare (FR4.7, FR7.4).

### Contro-metriche

| ID | Contro-metrica | Perché sorveglia |
|---|---|---|
| CM1 | Carico giornaliero di revisioni a regime | Sbloccare lezioni genera un carico ricorrente. Se il tempo per svuotare la pila supera M3, l'app diventa un lavoro e l'abbandono segue. |
| CM2 | Tasso di esito `again` per punto grammaticale | Un punto con `again` cronicamente alto significa una di due cose: l'esercizio è mal formulato, oppure la lezione non è stata capita. Entrambe azionabili, e distinguibili guardando se il problema è di un utente o di tutti. |
| CM3 | Quota di sessioni abbandonate a metà | Distingue "non ho aperto l'app" da "l'ho aperta e mi sono arreso". Non strumentata in v1, per le stesse ragioni della v1 del PRD: richiederebbe una tabella di sessioni che il modello dati non ha e che NFR6 rende sgradita. |

**CM2 vale più qui che nella v1, e per una ragione strutturale.** Nella v1 l'esito veniva dall'autovalutazione, e il PRD registrava il rischio: *streak alto insieme ad `again` alto significa autovalutazione compiacente*. Qui **l'esito è oggettivo** — o la risposta è giusta o non lo è (FR5.2). Quel modo di ingannarsi non esiste più, e CM2 diventa una misura affidabile invece che un sospetto.

---

## 4. Scope

### In scope per la v1

Autenticazione email e password · contenuto delle lezioni versionato nel repository · pipeline di autorazione documentata e ripetibile · registro chiuso dei tipi di esercizio · progressione del curriculum per utente · motore di scheduling · sessione di esercizi giornaliera · streak e statistiche per punto grammaticale · resilienza alla perdita di rete durante la sessione · operatività completa da tastiera e supporto screen reader · interfaccia inglese e italiano · cancellazione account e privacy policy · deploy pubblico · open source.

### Fuori scope, esplicitamente

Audio e sintesi vocale · pratica dei tratti dei kanji o input a mano libera · **generazione di esercizi a runtime tramite LLM** · **autorazione dentro l'applicazione** · deck creati dall'utente o import · funzioni sociali e classifiche · OAuth e login social · app mobile native · drill di vocabolario puro · risoluzione dei conflitti di sincronizzazione fra dispositivi.

Le due voci in grassetto meritano una nota, perché sono le più probabili da reintrodurre "per aiutare".

**Niente LLM a runtime.** Un esercizio generato su richiesta sarebbe più vario, ma renderebbe il dominio non deterministico, non testabile in CI e costoso per utente, e imporrebbe codice server oltre alla sola Edge Function di cancellazione. Il valore dimostrativo del progetto sta esattamente nella parte che questo distruggerebbe. L'LLM lavora **in fase di autorazione**, e il suo prodotto è un file versionato che un umano ha riletto.

**Niente autorazione in-app.** L'autorazione avviene fuori dall'applicazione e arriva per commit. Il contenuto è quindi rivedibile in pull request, diffabile e riproducibile.

---

## 5. Utenti e percorsi

### Persona

Un adulto che studia giapponese da autodidatta seguendo un corso di grammatica strutturato, e che vuole **esercitare** quello che ha appena visto invece di limitarsi a guardarlo. Usa l'app sul telefono negli spostamenti e sul portatile la sera, con lo stesso account.

C'è una seconda persona, ed è l'owner nel ruolo di **autore**: chi guarda la lezione e la trasforma in esercizi. È un utente del prodotto quanto l'altro, e la sua esperienza è misurata da M5.

### UJ-1 — La sessione del pendolare

Federico entra in metropolitana alle 8:10. Apre l'app: **18 da rivedere**, streak **6 giorni**, un solo pulsante. Tocca *Esercitati*.

Compare una frase: 日本語がわかります。 La consegna è: *qual è il soggetto?* Le opzioni sono 私 e 日本語. Federico sceglie 日本語 — ha capito il punto della lezione 4. La risposta è giusta, e sotto compare una riga sola di spiegazione: *il giapponese è-comprensibile [a me]; il soggetto è ciò che è comprensibile, non chi comprende.*

Al terzo esercizio il treno entra in galleria. **La sessione continua**: gli esercizi erano già caricati e le risposte si accumulano localmente. Un indicatore discreto segnala la sincronizzazione in attesa, e si spegne da solo alla fermata dopo.

Federico arriva a zero mentre esce dalla stazione.

**Cosa mette alla prova:** la resilienza di rete (F9), la valutazione oggettiva calcolata sul client senza rete (FR5.2), e il fatto che il caso d'uso primario non richieda connettività continua.

### UJ-2 — La sera, la lezione nuova

Federico guarda la lezione 12. Apre il terminale, avvia il flusso di autorazione, racconta cosa insegna la lezione e quali frasi la illustrano. Ne esce `content/lessons/12-*.json`: otto esercizi tipizzati, ciascuno con la sua spiegazione.

Ne rilegge due che non lo convincono e li corregge a mano. Committa. La CI valida schema e tipi; la lezione entra.

Il giorno dopo, sull'app, la dashboard gli propone **la lezione 12 come prossima da sbloccare**. La sblocca, e i suoi esercizi entrano nella pila.

**Cosa mette alla prova:** M5, la pipeline di F11, il fatto che aggiungere contenuto non richieda toccare codice, e che una lezione malformata non arrivi mai in produzione.

### UJ-3 — La pila è già a zero

Più tardi Federico apre l'app sul portatile. La pila è **già a zero** — l'ha svuotata in metro, e il portatile lo sa.

La dashboard non gli propone di rivedere, perché non c'è nulla da rivedere. Gli propone di **sbloccare la lezione successiva** fra quelle già autorate. Poi apre le statistiche e vede, per punto grammaticale, dove sbaglia di più: la particella に nei contesti di destinazione continua a cadere.

**Cosa mette alla prova:** la coerenza fra dispositivi, il cancello di F6, e il fatto che le statistiche dicano qualcosa di *azionabile* — non "quali frasi sbagli" ma **quale regola non ti è entrata**.

**Perché la sequenza è vincolante.** L'ordine — prima svuotare la pila, poi sbloccare materiale nuovo — non è una scelta di interfaccia: è il prodotto. Sbloccare una lezione con la pila ancora piena è esattamente ciò che l'app deve impedire, ed è la difesa di CM1.

---

## 6. Requisiti funzionali

Gli ID sono stabili e globali: epiche e storie ci si agganciano.

### F1 — Account e identità

Invariato rispetto alla v1.

- **FR1.1** L'utente può registrarsi con email e password.
- **FR1.2** L'utente può accedere e disconnettersi.
- **FR1.3** La sessione persiste fra riavvii del browser fino a disconnessione esplicita.
- **FR1.4** L'utente può cancellare definitivamente il proprio account. La cancellazione rimuove **tutti** i suoi dati di studio.
- **FR1.5** Il sistema comunica in modo comprensibile i fallimenti prevedibili: password errata, email già registrata, password troppo debole, email in formato non valido.
- **FR1.6** Le rotte che espongono dati dell'utente sono raggiungibili solo da utenti autenticati; un accesso non autenticato viene reindirizzato al login.

### F2 — Contenuto: lezioni ed esercizi

Sostituisce integralmente F2 della v1 (dataset del vocabolario).

- **FR2.1** Il sistema distribuisce un insieme di **lezioni** versionate nel repository, in sola lettura per gli utenti. Una lezione ha un numero d'ordine, un titolo, i punti grammaticali che insegna e zero o più esercizi.
- **FR2.1a** Titolo e identificatore di una lezione derivano dal **punto grammaticale che insegna**, mai dal numero o dal titolo di un episodio di una fonte esterna. L'ordine interno può seguire quello in cui l'owner studia; ciò che l'app espone è indicizzato su concetti — che sono fatti — ed è comprensibile a chi la fonte non l'ha mai vista (§2).
- **FR2.2** Ogni esercizio espone: il tipo, il contenuto giapponese necessario a presentarlo, la risposta corretta, i distrattori quando previsti dal tipo, e una **spiegazione** che dice *perché* la risposta è quella.
- **FR2.3** Ogni frase giapponese di un esercizio espone kanji e kana separati, così che la furigana sia derivabile nel dominio.
- **FR2.4** Una lezione **può non avere esercizi** e resta comunque parte del curriculum. Non tutte le lezioni di un corso di grammatica sono esercitabili: alcune riorientano il modo di pensare e non hanno una risposta giusta. Registrarle comunque tiene onesta la progressione.
- **FR2.5** Il contenuto può essere corretto o riautorato **senza toccare il progresso di nessun utente** sugli esercizi che non sono cambiati.
- **FR2.6** Un esercizio o una lezione malformati non raggiungono la produzione: la validazione è parte dell'integrazione continua.

### F3 — La pila (dashboard)

- **FR3.1** La dashboard mostra quanti esercizi sono dovuti in questo momento.
- **FR3.2** La dashboard mostra lo streak corrente.
- **FR3.3** La dashboard espone **una sola** azione primaria.
- **FR3.4** Quando la pila è vuota, l'azione primaria diventa sbloccare la lezione successiva (F6); se non ci sono altre lezioni disponibili, la dashboard lo dichiara esplicitamente.
- **FR3.5** Quando l'utente non ha **mai** sbloccato alcuna lezione, la dashboard presenta uno stato di primo avvio **distinto** da quello di pila svuotata. Sono lo stesso stato tecnico e hanno significati opposti: il primo dice *comincia*, il secondo *hai finito*.
- **FR3.6** La dashboard indica a che punto del curriculum si trova l'utente: quante lezioni ha sbloccato su quante ne esistono.

### F4 — Sessione di esercizi

- **FR4.1** Gli esercizi sono presentati uno alla volta.
- **FR4.2** Viene mostrata la consegna; l'utente **risponde** con un'azione esplicita. La risposta è una scelta fra opzioni presentate, non testo libero.
- **FR4.3** Dopo la risposta il sistema dichiara se è corretta e mostra la spiegazione di FR2.2.
- **FR4.4** La sessione termina quando la pila raggiunge zero, con una schermata di completamento che conferma il risultato.
- **FR4.5** Durante la sessione è sempre visibile quanto manca alla fine.
- **FR4.6** L'utente può abbandonare la sessione in qualsiasi momento; le risposte già date **restano acquisite**.
- **FR4.7** L'utente può avviare una nuova sessione sugli esercizi ancora dovuti in qualsiasi momento successivo, senza penalità e senza ricominciare da capo.
- **FR4.8** L'utente può consultare la spiegazione **prima** di rispondere. Non è vietato ed è registrato, perché cambia il significato della risposta (FR5.2).

### F5 — Scheduling

Il motore è invariato rispetto alla v1. Cambia soltanto **da dove viene l'esito**.

- **FR5.1** Rispondere a un esercizio aggiorna la sua data di prossima revisione secondo l'algoritmo di scheduling.
- **FR5.2** **L'esito è derivato, non dichiarato.** È una funzione pura della risposta: `again` se sbagliata; `hard` se corretta ma dopo aver consultato la spiegazione (FR4.8); `good` se corretta senza aiuto; `easy` se corretta senza aiuto e l'utente lo dichiara esplicitamente con un'azione opzionale.

  La v1 chiedeva all'utente di autovalutarsi, che è inevitabile su una flashcard di vocabolario e viziato su un esercizio con una risposta verificabile. Qui non serve, e toglierlo elimina l'autovalutazione compiacente che il PRD v1 registrava come rischio di CM2.
- **FR5.3** Semantica degli esiti sugli stadi: `again` riporta allo stadio iniziale e incrementa il contatore di ricadute; `good` avanza di uno stadio; `easy` avanza di due; `hard` mantiene lo stadio e riprogramma a intervallo ridotto.
- **FR5.4** Gli stadi **saturano** ai due estremi: non si scende sotto lo stadio iniziale né si sale sopra quello massimo.
- **FR5.5** Un intervallo pari a zero significa **"di nuovo in questa sessione"**: l'esercizio torna in fondo alla coda corrente. La sessione termina quando la coda è vuota, il che richiede di aver risposto correttamente e senza aiuto a ogni esercizio.
- **FR5.6** Le date di scadenza ricevono una dispersione deterministica, così che la pila non arrivi a grappoli.
- **FR5.7** Ogni risposta viene registrata in un log **append-only** che alimenta le statistiche, e porta con sé il punto grammaticale dell'esercizio.

### F6 — Progressione del curriculum

Sostituisce F6 della v1 (nuovi item con tetto giornaliero).

- **FR6.1** Quando la pila dovuta è vuota, l'utente può **sbloccare** la lezione successiva non ancora sbloccata.
- **FR6.2** Sbloccare una lezione materializza subito i suoi esercizi come dovuti.
- **FR6.3** Le lezioni si sbloccano **in ordine**: la progressione è sequenziale, perché il curriculum lo è. Non si salta.
- **FR6.4** Una lezione senza esercizi (FR2.4) si sblocca comunque, non aggiunge nulla alla pila, e l'interfaccia dice perché.
- **FR6.5** Un tetto giornaliero configurabile limita quante lezioni si possono sbloccare in una giornata, con valore predefinito 1.
- **FR6.6** L'utente può modificare il tetto da un'impostazione.

### F7 — Statistiche e streak

- **FR7.1** Una vista statistiche mostra le risposte nel tempo.
- **FR7.2** La stessa vista mostra la distribuzione degli esercizi per stadio di scheduling.
- **FR7.3** La stessa vista mostra **i punti grammaticali con il tasso di errore più alto**, non i singoli esercizi. È la differenza fra "sbagli questa frase" e "non hai capito に di destinazione", e solo la seconda è azionabile.
- **FR7.4** Una giornata conta ai fini dello streak quando l'utente porta la pila a zero, oppure completa almeno un esercizio se la pila era già vuota. **La giornata termina a mezzanotte nel fuso orario locale del dispositivo.**
- **FR7.5** Con dati insufficienti la vista dichiara cosa manca, invece di mostrare grafici vuoti.

### F8 — Lingua

- **FR8.1** L'interfaccia è disponibile in inglese e italiano.
- **FR8.2** La lingua è commutabile a runtime, senza ricaricare la pagina.
- **FR8.3** La scelta è persistita per utente e vale su tutti i suoi dispositivi.
- **FR8.4** Nessuna stringa visibile all'utente è cablata nel codice.
- **FR8.5** Le **spiegazioni** degli esercizi (FR2.2) sono contenuto, non interfaccia: esistono in inglese e italiano nel file della lezione e seguono la lingua scelta. Una lezione priva della traduzione italiana è valida e ricade sull'inglese, dichiarandolo.

### F9 — Resilienza di rete

- **FR9.1** All'avvio della sessione, l'intera pila dovuta viene caricata in memoria.
- **FR9.2** Le risposte date senza rete vengono accodate localmente.
- **FR9.3** Al ritorno della rete la coda viene sincronizzata automaticamente, senza intervento dell'utente.
- **FR9.4** Uno stato di sincronizzazione in sospeso è visibile ma non invasivo.
- **FR9.5** Se l'applicazione viene chiusa con risposte non sincronizzate, la coda viene recuperata alla riapertura.
- **FR9.6** La sincronizzazione è idempotente: riapplicare la stessa coda non produce risposte duplicate.

### F10 — Trasparenza e licenza

- **FR10.1** Una pagina di privacy policy dichiara quali dati sono memorizzati e come cancellarli.
- **FR10.2** Una pagina di riconoscimenti attribuisce a Cure Dolly l'origine del modello grammaticale, con collegamento al canale, e dichiara che il contenuto degli esercizi è originale del progetto.
- **FR10.3** La licenza del codice e quella del contenuto delle lezioni sono dichiarate separatamente, in file distinti.

### F11 — Pipeline di autorazione

Capacità nuova, e il pezzo più caratterizzante del progetto.

- **FR11.1** Esiste un flusso documentato e ripetibile che, a partire da una lezione vista, produce un file di lezione conforme allo schema.
- **FR11.2** Il flusso è assistito da un LLM in fase di autorazione e prevede una **revisione umana obbligatoria** prima del commit. Nessun esercizio raggiunge il repository senza essere stato riletto.
- **FR11.3** Aggiungere una lezione **non richiede modifiche al codice**. Aggiungere un *tipo* di esercizio le richiede, insieme al suo validatore e ai suoi test.
- **FR11.4** Il file di una lezione è validato contro uno schema: un file malformato fallisce la CI (FR2.6).
- **FR11.5** L'identificatore di un esercizio è **derivato dal suo contenuto**, così che riautorare una lezione non orfani il progresso sugli esercizi rimasti identici (FR2.5).
- **FR11.6** Il registro dei tipi di esercizio è **chiuso**: il file di una lezione non può introdurre un tipo che il dominio non dichiara, e il tentativo è un errore di validazione.
- **FR11.7** I transcript, i sottotitoli e qualsiasi trascrizione della fonte sono **input privato** della sessione di autorazione e non entrano mai nel repository. L'esclusione dal versionamento è dichiarata esplicitamente in `.gitignore`, non affidata alla disciplina di chi committa.
- **FR11.8** Prima del commit, ogni frase giapponese e ogni spiegazione prodotte vengono confrontate automaticamente con il testo di partenza; qualsiasi sovrapposizione non banale è segnalata e riscritta. Il controllo è parte della revisione obbligatoria di FR11.2, non un passaggio facoltativo.

  **Perché non può essere un cancello di CI.** FR11.7 tiene il transcript fuori dal repository, quindi l'integrazione continua non ha il testo con cui confrontare: il controllo vive necessariamente in fase di autorazione, sulla macchina di chi autora. È il solo requisito di questo PRD la cui verifica non sia automatizzabile a valle, ed è dichiarato come tale invece che fatto sembrare più solido di quanto sia.

---

## 7. Requisiti non funzionali

- **NFR1 — Sicurezza dei tipi.** TypeScript in modalità strict. Nessun `any` nel codice applicativo.
- **NFR2 — Purezza del dominio.** Il motore di scheduling **e la valutazione delle risposte** sono funzioni pure senza dipendenze da UI, rete, orologio di sistema o database. L'istante corrente e il fuso orario sono sempre iniettati come parametri.
- **NFR3 — Copertura di test.** Il motore di scheduling è testato a fondo, casi limite inclusi. Ogni tipo di esercizio ha i test del suo validatore. Almeno il flusso di esercizio ha test di componente. Un test end-to-end copre registrazione → sblocco lezione → esercizi → pila a zero.
- **NFR4 — Accessibilità.** La schermata di esercizio è interamente operabile da tastiera. Ruoli e stati ARIA corretti. La risposta e l'avanzamento sono annunciati tramite live region. Il contenuto giapponese è marcato con l'attributo di lingua corretto.
- **NFR5 — Isolamento dei dati.** Ogni tabella con dati per-utente applica isolamento a livello di riga. Un utente può leggere e scrivere solo le proprie righe. **Verificato da un test esplicito, non assunto.**
- **NFR6 — Privacy.** Vengono memorizzati solo email, hash della password e dati di studio. Nessuna analitica sul singolo individuo.
- **NFR7 — Prestazioni percepite.** La schermata di esercizio risponde senza attesa visibile. Aggiornamenti ottimistici, persistenza in background.
- **NFR8 — Licenza e attribuzione.** Codice e contenuto hanno licenze dichiarate separatamente e rispettate entrambe.
- **NFR9 — Costo di autorazione.** La pipeline di F11 regge un corso di **durata indefinita** senza degradare: nessun passaggio manuale il cui costo cresca con il numero di lezioni già autorate. Il requisito è deliberatamente indipendente dal totale delle lezioni, che non è noto e continuerà a crescere. È un NFR perché è la condizione di sopravvivenza del prodotto (M5).

---

## 8. Privacy, isolamento e cancellazione

Invariato nella sostanza rispetto alla v1.

**Cosa viene memorizzato.** Email, hash della password, lezioni sbloccate, stato di revisione per esercizio, log delle risposte, preferenze (lingua, tetto di sblocco). Nient'altro.

**Isolamento.** L'isolamento per riga è la difesa primaria, non un complemento (NFR5). Il repository è pubblico, quindi schema e policy sono leggibili da chiunque: devono reggere all'ispezione, non all'oscurità.

**Cancellazione.** FR1.4 richiede la rimozione completa, con la conseguenza accettata che le statistiche aggregate non sopravvivono alla cancellazione. Va verificato end-to-end, non dedotto dalle chiavi esterne.

---

## 9. Resilienza di rete

**Decisione invariata rispetto alla v1: sessione resiliente.**

| Capacità | v1 | Fuori scope |
|---|---|---|
| Sessione già avviata sopravvive alla perdita di rete | ✅ | |
| Risposte accodate e sincronizzate al ritorno | ✅ | |
| Avvio a freddo senza rete | | ❌ |
| Contenuto completo disponibile offline | | ❌ |
| Riconciliazione di scritture concorrenti da due dispositivi | | ❌ |

Un elemento è **più facile** che nella v1: l'esito è calcolato sul client da una funzione pura (FR5.2), quindi una risposta data in galleria produce lo stesso esito e la stessa scadenza che avrebbe prodotto online. Non serve nulla dal server per valutare.

---

## 10. Casi limite e questioni aperte

### Risolte

- **OQ-1 — Autovalutazione su un esercizio verificabile.** ✅ Risolta da FR5.2: l'esito è derivato dalla correttezza e dall'uso della spiegazione, non dichiarato.
- **OQ-2 — Lezioni non esercitabili.** ✅ Risolta da FR2.4 e FR6.4: la lezione esiste nel curriculum, si sblocca, non produce esercizi, e l'interfaccia lo dichiara.
- **OQ-3 — Riautorazione che orfana il progresso.** ✅ Risolta da FR11.5, con la stessa tecnica che la v1 usava su `vocabulary`: identificatore derivato dal contenuto.
- **OQ-4 — Proliferazione dei tipi di esercizio.** ✅ Risolta da FR11.3 e FR11.6: registro chiuso, e aggiungere un tipo è una modifica di codice con i suoi test.
- **OQ-5 — Licenza della fonte del metodo.** ✅ Risolta in §2: le idee sono libere, l'espressione no, e il progetto non ridistribuisce nulla di Cure Dolly.
- **OQ-6 — Dipendenza da JMdict.** ✅ Rimossa: il contenuto è originale, JMdict resta uno strumento di verifica in autorazione.

### Non bloccanti, da registrare

- **OQ-7 — Quali tipi di esercizio esistono davvero.** ✅ **Chiusa il 23 settembre**, dopo aver esaminato il contenuto reale delle lezioni 1 e 11. Il registro proposto a tavolino — *identificare il soggetto*, *scelta della particella*, *riconoscere il motore*, *trasformazione* — confondeva due piani: quelle sono **materie**, non **interazioni**. Meccanicamente sono la stessa cosa, e cosa insegnano lo dice già `grammar_point`. Il registro chiuso è di **tre forme di interazione**: `single-select`, `select-span`, `assemble`. Vedi `AD-22`.
- **OQ-8 — Come viaggia il contenuto.** Se le lezioni arrivino al client come dati di migrazione in Postgres o come JSON incluso nel bundle è una scelta architetturale, non di prodotto. Impatta FR9.1 e il costo di un aggiornamento di contenuto.
- **OQ-9 — Carico a regime.** Il tetto di sblocco predefinito di una lezione al giorno va verificato contro CM1 una volta noto il numero medio di esercizi per lezione.
- **OQ-10 — Cambio di fuso orario.** Come nella v1: FR7.4 àncora la giornata al fuso locale del dispositivo, si accetta il comportamento ingenuo, resta un limite noto.
- **OQ-11 — Licenza del contenuto.** Vedi `[ASSUMPTION]` in §2.

---

## 11. Definition of done della v1

- URL pubblicamente raggiungibile; uno sconosciuto si registra e risolve il primo esercizio entro un minuto (M4)
- Almeno **cinque lezioni** autorate, revisionate e giocabili; obiettivo undici, pari a quelle già viste dall'owner
- La pipeline di autorazione è documentata, e un terzo la può eseguire leggendo il README
- Repository pubblico, licenze di codice e contenuto dichiarate separatamente
- Riconoscimento a Cure Dolly presente e corretto
- Integrazione continua verde sul ramo principale, con validazione dello schema delle lezioni
- Motore di scheduling e validatori degli esercizi testati fino ai casi limite
- Schermata di esercizio usabile senza mouse
- Cancellazione account che rimuove tutti i dati, verificata end-to-end
- Sessione che sopravvive alla perdita di rete, verificata
- **L'owner l'ha usata personalmente per quattordici giorni consecutivi** (M1)

L'ultimo è il criterio di accettazione reale.
