# Epic 6 Context: La pipeline di autorazione

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Questa epica costruisce il flusso con cui l'owner, nel ruolo di **autore**, trasforma una lezione appena studiata in esercizi validati e committati in meno di trenta minuti, **senza toccare il codice** — e con un costo per lezione che **non cresce** con il numero di lezioni già fatte. È la condizione di sopravvivenza del prodotto: il corso supera le novanta lezioni, il totale non è noto, e una pipeline che costa due ore a lezione non viene usata, così il prodotto muore per fame di contenuto invece che per difetti di codice. L'epica arriva **dopo** che l'applicazione funziona, di proposito: il contratto che la pipeline deve produrre è quello di Epic 2, e come scrivere un flusso che lo soddisfi si capisce meglio avendo visto l'applicazione consumarlo. Il cuore giuridico dell'epica è la separazione fra **fatto** (libero) e **formulazione** (protetta): il transcript della fonte resta input privato e non entra mai nel repository, e un controllo anti-contaminazione — l'unico anello della catena di qualità che non si chiude in CI — impedisce che le formulazioni altrui filtrino nel contenuto prodotto.

## Stories

- Story 6.1: Il transcript non entra nel repository
- Story 6.2: Il flusso di autorazione, documentato e ripetibile
- Story 6.3: Il confronto che impedisce la contaminazione
- Story 6.4: Il flusso regge un corso senza fine

## Requirements & Constraints

- **Flusso documentato e ripetibile.** Esiste una procedura che, da una lezione vista, produce un file di lezione conforme allo schema di Epic 2. Deve essere sufficiente a produrre una lezione valida per chi la legge senza averla mai eseguita e senza chiedere aiuto: il contenuto non deve dipendere dalla memoria di chi l'ha scritta.
- **LLM in autorazione, revisione umana obbligatoria.** Il flusso è assistito da un LLM in fase di autorazione, ma prevede una rilettura umana obbligatoria prima del commit: nessun esercizio raggiunge il repository senza essere stato riletto. L'LLM lavora solo in autorazione, mai a runtime; il suo prodotto è un file versionato che un umano ha approvato.
- **Aggiungere una lezione non tocca il codice.** Una lezione prodotta dal flusso, una volta committata, passa la validazione di Epic 2 senza interventi manuali sullo schema.
- **Il transcript è input privato.** Transcript, sottotitoli e trascrizioni della fonte non entrano mai nel repository. L'esclusione è dichiarata esplicitamente in `.gitignore` con un commento che ne dà la ragione, non affidata alla disciplina di chi committa; un transcript nella cartella di lavoro dell'autore non deve comparire fra i file tracciabili.
- **Controllo anti-contaminazione prima del commit.** Ogni frase giapponese e ogni spiegazione prodotte vengono confrontate automaticamente con il testo di partenza; ogni sovrapposizione non banale è segnalata e riscritta prima del commit, oppure la segnalazione è motivata per iscritto se si tratta di un esempio canonico pubblico. Il controllo è parte della revisione obbligatoria, non un passaggio facoltativo. Va applicato **retroattivamente** anche alle lezioni autorate prima che esistesse, inclusa la lezione campione, con l'esito registrato.
- **Costo di autorazione costante (criterio di accettazione dell'epica).** Nessun passaggio manuale può avere un costo che cresce con il numero di lezioni già autorate; il requisito è verificato contro un corso di lunghezza **non nota**, non contro un totale fissato. Il tempo dalla visione all'esercizio giocabile è al massimo trenta minuti, e il tempo misurato va registrato perché la soglia è una stima da tarare.
- **Definition of Done: cinque lezioni.** Al termine il repository contiene almeno cinque lezioni autorate e validate (obiettivo undici, pari a quelle già viste dall'owner), e la pipeline è documentata al punto che un terzo la può eseguire leggendo il README.

## Technical Decisions

- **Confine fatto/formulazione, non negoziabile.** Dal transcript si estraggono **fatti** — quale punto grammaticale, qual è la regola, quale confusione risolve — e da quei fatti si riscrive da zero. Parafrasare con i sinonimi una formulazione altrui resta opera derivata, e il fatto che suoni diverso non cambia nulla. La documentazione della pipeline deve dichiarare esplicitamente questi tre punti: si estraggono fatti mai formulazioni; la parafrasi con sinonimi è ancora derivata; le **metafore didattiche** della fonte non si riusano, con l'esempio concreto del caso in cui il progetto stesso ci era caduto (il "treno/vagone/motore/gancio"; si usa invece la terminologia linguistica standard — verbo, copula, aggettivo in い).
- **Indicizzare per concetto, non per episodio.** Titolo e identificatore di una lezione derivano dal punto grammaticale insegnato, mai da numerazione, titolo o ordine delle lezioni della fonte — riprodurre selezione e disposizione di un corso può violare la protezione sulla raccolta anche quando i singoli fatti sono liberi.
- **Il controllo anti-contaminazione non può essere un cancello di CI.** Poiché il transcript resta fuori dal repository, la CI non ha il testo con cui confrontare: il controllo vive necessariamente sulla macchina di chi autora, in fase di autorazione. È dichiarato come l'unico requisito la cui verifica non è automatizzabile a valle, invece di essere fatto sembrare più solido di quanto sia.
- **Il contratto da produrre è quello di Epic 2.** La pipeline emette file dati versionati in `content/lessons/`, conformi allo schema unico; usa solo i tre tipi del registro chiuso (`single-select`, `select-span`, `assemble`); ogni esercizio dichiara il proprio `grammar_point`; l'identità è derivata dal contenuto (`uuidv5` su tipo, frase e risposta corretta). La validazione di merge di Epic 2 resta il cancello meccanico; questa epica non lo ricostruisce, lo alimenta con contenuto conforme.
- **JMdict come strumento, non dataset.** In autorazione si può consultare JMdict per verificare le glosse dei vocaboli — è uso di uno strumento, non ridistribuzione: non fa scattare la clausola EDRDG e non impone attribuzione su ogni schermata.
- **Forma della pipeline da decidere.** Se la pipeline sia una skill del repository, uno script o un documento di procedura è una scelta architetturale aperta; il vincolo che la governa è che regga un corso di lunghezza indefinita senza passaggi il cui costo cresca.

## Cross-Story Dependencies

- **Dipende da Epic 2.** Lo schema di lezione, il registro chiuso dei tipi, l'identità dal contenuto e il cancello di validazione in CI sono definiti in Epic 2; questa epica produce contenuto che vi si conforma, non li ridefinisce.
- **Arriva dopo che l'applicazione consuma il contratto** (Epic 3 e seguenti): vedere l'applicazione consumare gli esercizi rende ovvio il contratto che il produttore deve soddisfare.
- **Il controllo di 6.3 si applica retroattivamente alla lezione campione di 2.7** e a ogni lezione autorata prima che il controllo esistesse, con esito registrato.
- **Alimenta la Definition of Done di Epic 7:** le cinque lezioni autorate e la documentazione eseguibile da un terzo sono verificate al lancio pubblico, e il README risponde alla domanda su come è stato usato il flusso assistito da AI — cosa delegato, cosa rifiutato, dove è costato più tempo di quanto ne abbia risparmiato.
