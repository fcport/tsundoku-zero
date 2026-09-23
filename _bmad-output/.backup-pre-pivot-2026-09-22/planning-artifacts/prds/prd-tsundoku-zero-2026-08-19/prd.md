---
title: "Tsundoku Zero — PRD"
status: final
created: 2026-08-19
updated: 2026-08-19
---

# Tsundoku Zero — PRD

> 積ん読ゼロ — svuota la pila.

**Prodotto:** applicazione di ripetizione dilazionata per il vocabolario giapponese JLPT N5.
**Owner:** Federico Casadei · **Stato:** pre-sviluppo · **Posta in gioco:** pubblico, senza pretese di scala.

Le decisioni tecniche (stack, modello dati, algoritmo, alternative scartate) vivono in [`addendum.md`](addendum.md) e sono state l'input per `bmad-architecture`. Gli invarianti che ne sono usciti vivono in [`ARCHITECTURE-SPINE.md`](../../architecture/architecture-tsundoku-zero-2026-08-19/ARCHITECTURE-SPINE.md) e sono citabili per ID (`AD-n`). Questo documento definisce il *cosa*.

---

## 1. Contesto e problema

Studiare vocabolario giapponese da zero richiede ripetizione dilazionata. Gli strumenti esistenti — Anki, WaniKani, Bunpro — risolvono il problema, ma con una superficie enorme rispetto al bisogno: configurazione, deck da scegliere, funzionalità che non servono. La frizione iniziale è alta abbastanza da far abbandonare prima che l'abitudine si formi.

Tsundoku Zero esiste per due ragioni, in quest'ordine di priorità:

1. **Uno strumento che l'owner userà ogni giorno.** Se smette di usarlo, il progetto è fallito a prescindere dalla qualità del codice.
2. **Una codebase React/TypeScript dimostrabile** — con forma da produzione, testata, deployata, difendibile riga per riga in un colloquio tecnico.

Il nome dichiara la metrica di prodotto: il numero di item in attesa di revisione è "la pila", e l'obiettivo quotidiano è portarla a zero.

**Non-obiettivo dichiarato:** competere con Anki, WaniKani o Bunpro. Questo è uno strumento monofunzione.

---

## 2. Obiettivi e metriche

### Metriche di successo

| ID | Metrica | Soglia v1 |
|---|---|---|
| M1 | Giorni consecutivi di uso reale da parte dell'owner | ≥ 14 |
| M2 | Quota di **sessioni** avviate che portano la pila a zero | ≥ 80% |
| M3 | Tempo mediano per svuotare la pila giornaliera | ≤ 10 minuti |
| M4 | Uno sconosciuto si registra e inizia a studiare dal deploy pubblico | < 60 secondi |

M1 è il criterio di accettazione reale. Le altre esistono per rendere M1 diagnosticabile: se M1 fallisce, M2 e M3 dicono perché.

### Contro-metriche

Ciò che segnala peggioramento *mentre* i numeri principali salgono. Senza queste, uno streak lungo può nascondere un prodotto che sta fallendo.

| ID | Contro-metrica | Perché sorveglia |
|---|---|---|
| CM1 | Carico giornaliero di revisioni a regime | Il tetto di 10 nuovi item al giorno genera, a regime, un carico di revisioni ricorrenti. Se il tempo per svuotare la pila supera M3, l'app diventa un lavoro e l'abbandono segue. È il fallimento più probabile di questo prodotto. |
| CM2 | Tasso di esito `again` in crescita | Se cresce, o si introducono troppi item o gli intervalli sono troppo lunghi. **Streak alto insieme ad `again` alto significa autovalutazione compiacente**: lo strumento registra apprendimento che non sta avvenendo. |
| CM3 | Quota di sessioni abbandonate a metà | Distingue "non ho aperto l'app" da "l'ho aperta e mi sono arreso". Sono due fallimenti diversi con due rimedi diversi. |

**CM3 non è strumentata nella v1, ed è una scelta.** CM1 e CM2 si derivano dal log delle revisioni, che esiste comunque per alimentare F7. CM3 no: misurare le sessioni abbandonate richiederebbe di registrare l'avvio di una sessione, quindi una tabella che oggi non esiste e una forma di tracciamento che NFR6 rende sgradita. Con un solo utente la contro-metrica è osservabile per autoconoscenza; diventa un problema reale solo quando qualcun altro usa l'app, ed è a quel punto che va riaperta. Registrata come tale nella spine, non lasciata implicita.

**Come leggere M2 e M3.** M2 significa: su dieci volte che l'utente avvia una sessione, almeno otto arrivano in fondo. M3 usa la *mediana* e non la media di proposito — un singolo giorno da quaranta minuti dopo una settimana di assenza non deve far sembrare l'app più lenta di quanto sia in una giornata normale.

**M2 conta sessioni, non giornate — e la distinzione è vincolante.** Abbandonare una sessione al mattino e completarne un'altra la sera è, per M2, una sessione fallita e una riuscita; per M1 è **una giornata riuscita**, perché FR7.4 guarda se la pila arriva a zero entro la giornata, non a quanti tentativi sono serviti.

Senza questa distinzione le due metriche si contraddicono: una quota di fallimento di una su cinque applicata alle *giornate* renderebbe quattordici giorni consecutivi statisticamente irraggiungibile (circa quattro probabilità su cento). Applicata alle *sessioni*, invece, le due metriche misurano cose diverse e complementari — **M2 l'attrito dentro la sessione, M1 la tenuta dell'abitudine** — ed è questa la lettura adottata.

Ne discende un requisito di prodotto, non solo di misura: **riprendere più tardi nella stessa giornata deve essere possibile e non deve penalizzare l'utente** (FR4.6, FR7.4).

**Perché la soglia di M3 è larga.** A regime, con l'intero dataset a intervalli maturi, il carico atteso è nell'ordine di venti revisioni al giorno; a dieci secondi per item sono tre o quattro minuti. I dieci minuti lasciano quindi ampio margine, ed è voluto: la soglia deve scattare quando il carico è *raddoppiato*, non alla prima oscillazione. Vedi OQ-8 per la stima da fare prima di fissare il tetto giornaliero.

`[ASSUMPTION]` Le soglie di M2 (80%) e M3 (10 minuti) restano stime da tarare sui primi quattordici giorni di uso reale. La *definizione* di M2 — sessioni, non giornate — è invece decisa e non va reinterpretata a valle.

---

## 3. Scope

### In scope per la v1

Autenticazione email e password · dataset N5 in sola lettura (~700 item) · motore di scheduling · sessione di studio giornaliera · streak e statistiche di base · resilienza alla perdita di rete durante la sessione · operatività completa da tastiera e supporto screen reader · interfaccia inglese e italiano · cancellazione account e privacy policy · deploy pubblico · open source.

### Fuori scope, esplicitamente

Elencati perché non vengano aggiunti "per aiutare": audio e sintesi vocale · pratica dei tratti dei kanji o input a mano libera · lezioni di grammatica e banche di frasi d'esempio · deck creati dall'utente, import CSV, condivisione deck · funzioni sociali, classifiche, condivisione · OAuth e login social · app mobile native · livelli oltre N5 · **risoluzione dei conflitti di sincronizzazione fra dispositivi**.

L'ultima voce merita una precisazione, perché la v1 *include* una forma di funzionamento senza rete (§8). Ciò che resta fuori è la riconciliazione di scritture concorrenti prodotte da due dispositivi che hanno operato offline in parallelo. Lo scenario d'uso è a un dispositivo per volta.

Qualsiasi voce di questo elenco che diventi genuinamente necessaria passa alla v2, con giustificazione scritta nel changelog.

---

## 4. Utenti e percorsi

### Persona

Un adulto che studia giapponese da zero per conto proprio. Usa l'app **sul telefono durante gli spostamenti** e **sul portatile la sera**. Stesso account, entrambi i dispositivi, e si aspetta che la pila sia coerente fra i due.

Questa aspettativa è l'intera ragione per cui l'app ha un backend. Non è incidentale.

### UJ-1 — La sessione del pendolare

Federico entra in metropolitana alle 8:10. Apre l'app sul telefono: la dashboard mostra **23 da rivedere**, streak **6 giorni**, e un solo pulsante. Tocca *Studia*.

Compare una parola: 駅. Pensa, tocca per rivelare — *eki, stazione*. Sa che la sapeva: valuta **Facile**. Il conteggio scende a 22.

Al terzo item il treno entra in galleria e il campo sparisce. **La sessione continua.** Federico non se ne accorge: gli item erano già caricati e le sue valutazioni si accumulano localmente. Un indicatore discreto segnala che la sincronizzazione è in attesa.

Alla fermata dopo il campo torna. L'indicatore si spegne da solo. Federico arriva a zero mentre esce dalla stazione: schermata di completamento, streak a 7.

**Cosa mette alla prova:** la resilienza di rete (§8), l'operatività a una mano su schermo piccolo, e il fatto che il caso d'uso primario dichiarato non richieda connettività continua.

### UJ-2 — La pila è già a zero

Più tardi Federico apre l'app sul portatile. La pila è **già a zero** — l'ha svuotata in metro stamattina, e il portatile lo sa.

Il momento della giornata non conta: quello che conta è lo **stato della pila**. La dashboard non gli propone di rivedere, perché non c'è nulla da rivedere. Gli propone di **introdurre nuovi item**, fino al limite giornaliero di 10. Ne introduce 10 e li studia subito, tutto da tastiera: spazio per rivelare, tasti numerici per valutare, mai il mouse.

Poi apre le statistiche. Vede le revisioni nel tempo, la distribuzione per stadio, e i cinque item che sbaglia più spesso — fra cui 難しい, che continua a ricadere allo stadio iniziale.

**Cosa mette alla prova:** la coerenza fra dispositivi, il percorso dei nuovi item (F6), l'operatività da tastiera (NFR4), e il fatto che le statistiche debbano dire qualcosa di *azionabile*, non solo di decorativo.

**Perché la sequenza è vincolante.** L'ordine — prima svuotare la pila, poi introdurre item nuovi — non è una scelta di interfaccia: è il prodotto. Poter aggiungere materiale nuovo con la pila ancora piena è esattamente ciò che l'app deve impedire. Il cancello di FR6.1 è anche la difesa di CM1: senza, il carico giornaliero si gonfia senza che nulla lo trattenga.

---

## 5. Requisiti funzionali

Raggruppati per capacità. Gli ID sono stabili e globali: epiche e storie ci si agganciano.

### F1 — Account e identità

- **FR1.1** L'utente può registrarsi con email e password.
- **FR1.2** L'utente può accedere e disconnettersi.
- **FR1.3** La sessione persiste fra riavvii del browser fino a disconnessione esplicita.
- **FR1.4** L'utente può cancellare definitivamente il proprio account. La cancellazione rimuove **tutti** i suoi dati di revisione.
- **FR1.5** Il sistema comunica in modo comprensibile i fallimenti prevedibili: password errata, email già registrata, password troppo debole, email in formato non valido.
- **FR1.6** Le rotte che espongono dati dell'utente sono raggiungibili solo da utenti autenticati; un accesso non autenticato viene reindirizzato al login.

### F2 — Dataset del vocabolario

- **FR2.1** Il sistema distribuisce un dataset N5 fisso, in sola lettura per gli utenti.
- **FR2.2** Ogni item espone: kanji (opzionale), kana, romaji, significato inglese, significato italiano, livello JLPT, categoria grammaticale.
- **FR2.3** Il dataset può essere aggiornato o ricaricato **senza toccare la cronologia di apprendimento di nessun utente**.

### F3 — La pila (dashboard)

- **FR3.1** La dashboard mostra quanti item sono dovuti in questo momento.
- **FR3.2** La dashboard mostra lo streak corrente.
- **FR3.3** La dashboard espone **una sola** azione primaria per iniziare a studiare.
- **FR3.4** Quando la pila è vuota, l'azione primaria diventa introdurre nuovi item (F6); se anche il dataset è esaurito, la dashboard lo dichiara esplicitamente.
- **FR3.5** Quando l'utente non ha **mai** studiato alcun item, la dashboard presenta uno stato di primo avvio **distinto** da quello di pila svuotata. Sono lo stesso stato tecnico — pila a zero — e hanno significati opposti: il primo dice *comincia*, il secondo dice *hai finito*. La distinzione è di contenuto, non di struttura: entrambi espongono una sola azione primaria.

  Aggiunto dopo il contratto UX, che ha rilevato la lacuna: **M4 dipende interamente da questo stato**, ed era l'unico stato della dashboard che il PRD non descriveva. Uno sconosciuto che atterra su una schermata vuota indistinguibile da un'app rotta non si registra in meno di sessanta secondi, per quanto veloce sia la registrazione.

### F4 — Sessione di studio

- **FR4.1** Gli item sono presentati uno alla volta.
- **FR4.2** Viene mostrato il prompt; l'utente rivela la risposta con un'azione esplicita.
- **FR4.3** L'utente si autovaluta su quattro esiti: `again`, `hard`, `good`, `easy`.
- **FR4.4** La sessione termina quando la pila raggiunge zero, con una schermata di completamento che conferma il risultato.
- **FR4.5** Durante la sessione è sempre visibile quanto manca alla fine.
- **FR4.6** L'utente può abbandonare la sessione in qualsiasi momento; le valutazioni già date **restano acquisite**.
- **FR4.7** L'utente può avviare una nuova sessione sugli item ancora dovuti in qualsiasi momento successivo, senza penalità e senza ricominciare da capo. Riprendere più tardi nella stessa giornata è un percorso previsto, non un ripiego (vedi §2, definizione di M2).

### F5 — Scheduling

- **FR5.1** Valutare un item aggiorna la sua data di prossima revisione secondo l'algoritmo di scheduling.
- **FR5.2** Semantica degli esiti: `again` riporta l'item allo stadio iniziale e incrementa il contatore di ricadute; `good` avanza di uno stadio; `easy` avanza di due; `hard` mantiene lo stadio e riprogramma a intervallo ridotto.
- **FR5.3** Gli stadi **saturano** ai due estremi: non si scende sotto lo stadio iniziale né si sale sopra quello massimo. `easy` applicato al penultimo stadio porta al massimo, non oltre.
- **FR5.4** Un intervallo pari a zero significa **"di nuovo in questa sessione"**: l'item torna in fondo alla coda corrente. La sessione termina quando la coda è vuota, il che richiede di aver risposto almeno `good` a ogni item.
- **FR5.5** Le date di scadenza ricevono una dispersione deterministica, così che la pila non arrivi a grappoli.
- **FR5.6** Ogni revisione viene registrata in un log **append-only** che alimenta le statistiche.

### F6 — Nuovi item

- **FR6.1** Quando la pila dovuta è vuota, l'utente può introdurre item mai visti.
- **FR6.2** L'introduzione è limitata da un tetto giornaliero configurabile, con valore predefinito 10.
- **FR6.3** La selezione degli item da introdurre è deterministica e ripetibile.
- **FR6.4** L'utente può modificare il tetto giornaliero da un'impostazione.

### F7 — Statistiche e streak

- **FR7.1** Una vista statistiche mostra le revisioni nel tempo.
- **FR7.2** La stessa vista mostra la distribuzione degli item per stadio di scheduling.
- **FR7.3** La stessa vista mostra gli item sbagliati più di frequente.
- **FR7.4** Una giornata conta ai fini dello streak quando l'utente porta la pila a zero, oppure completa almeno una revisione se la pila era già vuota. **La giornata termina a mezzanotte nel fuso orario locale del dispositivo.**
- **FR7.5** Con dati insufficienti la vista dichiara cosa manca, invece di mostrare grafici vuoti.

### F8 — Lingua

- **FR8.1** L'interfaccia è disponibile in inglese e italiano.
- **FR8.2** La lingua è commutabile a runtime, senza ricaricare la pagina.
- **FR8.3** La scelta è persistita per utente e vale su tutti i suoi dispositivi.
- **FR8.4** Nessuna stringa visibile all'utente è cablata nel codice.

### F9 — Resilienza di rete

Deriva dalla decisione di §8. Rende eseguibile il caso d'uso pendolare di UJ-1.

- **FR9.1** All'avvio della sessione, l'intera pila dovuta viene caricata in memoria.
- **FR9.2** Le valutazioni date senza rete vengono accodate localmente.
- **FR9.3** Al ritorno della rete la coda viene sincronizzata automaticamente, senza intervento dell'utente.
- **FR9.4** Uno stato di sincronizzazione in sospeso è visibile ma non invasivo.
- **FR9.5** Se l'applicazione viene chiusa con valutazioni non sincronizzate, la coda viene recuperata alla riapertura.
- **FR9.6** La sincronizzazione è idempotente: riapplicare la stessa coda non produce revisioni duplicate.

### F10 — Trasparenza e licenza

- **FR10.1** Una pagina di privacy policy dichiara quali dati sono memorizzati e come cancellarli.
- **FR10.2** L'applicazione attribuisce la fonte del dataset del vocabolario **su ogni schermata che ne mostra le voci** — dashboard, sessione di studio, statistiche — come la licenza della fonte richiede espressamente per un servizio web (§9). Una pagina "About" non è sufficiente.

---

## 6. Requisiti non funzionali

- **NFR1 — Sicurezza dei tipi.** TypeScript in modalità strict. Nessun `any` nel codice applicativo.
- **NFR2 — Purezza dello scheduling.** Il motore di scheduling è un insieme di funzioni pure senza dipendenze da UI, rete, orologio di sistema o database. **L'istante corrente e il fuso orario sono sempre iniettati come parametri.** È ciò che lo rende testabile ed è la parte di codebase che un revisore leggerà più attentamente.
- **NFR3 — Copertura di test.** Il motore di scheduling è testato a fondo, casi limite inclusi (§10). Almeno il flusso di studio ha test di componente. Un test end-to-end copre registrazione → studio → pila a zero.
- **NFR4 — Accessibilità.** La schermata di studio è interamente operabile da tastiera: spazio per rivelare, tasti numerici per valutare. Ruoli e stati ARIA corretti. La rivelazione della risposta e l'avanzamento della sessione sono annunciati tramite live region. Il contenuto giapponese è marcato con l'attributo di lingua corretto, perché uno screen reader non lo pronunci come testo inglese o italiano.
- **NFR5 — Isolamento dei dati.** Ogni tabella con dati per-utente applica isolamento a livello di riga. Un utente può leggere e scrivere solo le proprie righe. **Verificato da un test esplicito, non assunto.**
- **NFR6 — Privacy.** Vengono memorizzati solo email, hash della password e dati di studio. Nessuna data di nascita, nessun nome, nessuna analitica sul singolo individuo.
- **NFR7 — Prestazioni percepite.** La schermata di studio risponde alla valutazione senza attesa visibile. Gli aggiornamenti sono applicati in modo ottimistico e persistiti in background.
- **NFR8 — Licenza e attribuzione.** La licenza del codice e quella dei dati sono dichiarate separatamente e rispettate entrambe (§9).

---

## 7. Privacy, isolamento e cancellazione

Tre concern distinti che il brief trattava insieme.

**Cosa viene memorizzato.** Email, hash della password, stato di revisione per item, log delle revisioni, preferenze (lingua, tetto giornaliero). Nient'altro.

**Isolamento.** L'isolamento per riga è la difesa primaria, non un complemento (NFR5). Poiché il repository è pubblico, lo schema e le policy sono leggibili da chiunque: devono reggere all'ispezione, non all'oscurità.

**Cancellazione.** FR1.4 richiede la rimozione completa. Ha una conseguenza che va accettata consapevolmente: **cancellare l'account distrugge anche il log delle revisioni**, quindi le statistiche aggregate non sopravvivono alla cancellazione. È il comportamento corretto per la privacy dichiarata in NFR6, e va verificato end-to-end, non dedotto dalle chiavi esterne.

---

## 8. Resilienza di rete

**Decisione:** sessione resiliente.

Il brief conteneva una contraddizione: la persona usa l'app durante gli spostamenti, ma il funzionamento senza rete era fuori scope. Il caso d'uso primario dichiarato era quello in cui l'app non funziona.

La risoluzione è delimitata di proposito:

| Capacità | v1 | Fuori scope |
|---|---|---|
| Sessione già avviata sopravvive alla perdita di rete | ✅ | |
| Valutazioni accodate e sincronizzate al ritorno | ✅ | |
| Avvio a freddo senza rete | | ❌ |
| Dataset completo disponibile offline | | ❌ |
| Riconciliazione di scritture concorrenti da due dispositivi | | ❌ |

Ciò che rende la cosa economica è che NFR7 richiede **già** aggiornamenti ottimistici con persistenza in background. La resilienza di sessione è quel meccanismo con una coda durevole al posto di una effimera. Non serve risoluzione dei conflitti perché lo scenario è a un dispositivo per volta e le scritture sono append-only.

---

## 9. Provenienza e licenza del dataset

Concern che il brief non nominava, e che è vincolante.

Il dataset N5 deriva da **JMdict / Tanos**. Verificato alla fonte il 19 agosto 2026: JMdict è distribuito dall'Electronic Dictionary Research and Development Group sotto **CC BY-SA 4.0** — impone attribuzione e propaga la condizione *share-alike* alle opere derivate; le liste JLPT di tanos.co.uk (Jonathan Waller) sono sotto **CC BY**.

EDRDG è esplicito su *dove* va l'attribuzione, e la sua richiesta è più stringente di quanto questo PRD assumesse in origine: quando un server web mostra a schermo voci tratte dai file, il riconoscimento deve comparire **su ogni schermata che le visualizza**. Da qui la formulazione attuale di FR10.2.

Il repository è dichiarato MIT. **Applicare MIT indiscriminatamente a codice e dati sarebbe scorretto.** La v1 tiene le due licenze separate:

- **Codice** — MIT.
- **Dati del vocabolario** — CC BY-SA 4.0 ereditata dalla fonte, con attribuzione su ogni schermata che mostra voci (FR10.2) e file di licenza separato nel repository (`LICENSE-DATA`, distinto da `LICENSE`).

Questo è anche materiale da colloquio: distinguere la licenza del codice da quella dei dati dimostra qualcosa di più raro della competenza su React.

L'attribuzione è vincolata architetturalmente da `AD-16`, che la tratta come invariante di layout e non come rifinitura di lancio.

---

## 10. Casi limite e questioni aperte

Il brief non li conteneva. Sono il cuore di ciò che NFR3 chiede di testare.

### Risolte

- **OQ-1 — `hard` allo stadio iniziale.** ✅ Risolta da FR5.4: intervallo zero significa "di nuovo in questa sessione". Nessun caso speciale nell'algoritmo — l'item torna in fondo alla coda corrente, esattamente come dopo un `again`. La sessione termina comunque, perché ogni item ne esce con un `good`.
- **OQ-2 — `easy` in prossimità dello stadio massimo.** ✅ Risolta da FR5.3: gli stadi saturano ai due estremi.
- **OQ-6 — `again` su item già allo stadio iniziale.** ✅ Stessa regola di OQ-1. Una sola regola copre entrambi i casi.
- **OQ-3 — Licenza effettiva della fonte.** ✅ Accertata il 19 agosto 2026: JMdict/EDRDG è CC BY-SA 4.0, tanos.co.uk è CC BY. Non restano bloccanti prima di Epic 3. La conseguenza operativa — attribuzione su ogni schermata — è entrata in FR10.2 e in §9.
- **OQ-5 — Stabilità degli identificatori nel riseed.** ✅ Risolta per costruzione da `AD-9`: l'identificatore di una voce è derivato in modo deterministico dal suo contenuto, quindi un ricaricamento del dataset ricalcola gli stessi identificatori e non può orfanare i progressi.

### Non bloccanti, da registrare

- **OQ-4 — Cambio di fuso orario.** FR7.4 àncora la giornata al fuso locale del dispositivo. Viaggiando verso ovest la giornata si allunga, verso est si accorcia e uno streak può interrompersi senza colpa dell'utente. **Deciso:** per la v1 si accetta il comportamento ingenuo. Resta un limite noto, non un difetto da correggere.
- **OQ-7 — Item introdotti ma mai studiati.** Se l'utente introduce 10 nuovi item e chiude l'app, contano nella pila del giorno dopo? `AD-19` dà una risposta implicita — **sì, restano dovuti** — perché introdurre un item lo materializza subito allo stadio iniziale. Resta una scelta di prodotto: cambiarla è una modifica a un punto solo del dominio.
- **OQ-8 — Carico a regime.** CM1 va stimato prima di fissare il valore predefinito del tetto giornaliero: 10 al giorno con gli intervalli previsti produce un carico ricorrente che va quantificato, non sperato.

---

## 11. Definition of done della v1

- URL pubblicamente raggiungibile; uno sconosciuto si registra e studia entro un minuto (M4)
- Repository pubblico, licenze di codice e dati dichiarate separatamente e rispettate
- Integrazione continua verde sul ramo principale
- Motore di scheduling testato fino ai casi limite di §10
- Schermata di studio usabile senza mouse
- Cancellazione account che rimuove tutti i dati, verificata end-to-end
- Sessione che sopravvive alla perdita di rete, verificata
- **L'owner l'ha usata personalmente per quattordici giorni consecutivi** (M1)

L'ultimo è il criterio di accettazione reale.
