# Epic 4 Context: La sessione sopravvive alla galleria

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Questa epica rende la sessione di studio resiliente alla rete: una risposta data senza campo non si perde, si sincronizza da sola quando la connessione torna e sopravvive alla chiusura dell'applicazione. Conta perché lo scenario reale del prodotto è studiare in metropolitana, dove il campo cade a metà sessione; la promessa è che "non succeda niente" — nessun blocco, nessun modale, nessuna azione richiesta all'utente. Epic 3 (la sessione di studio) non dipende da questa epica: qui ci si costruisce sopra una coda durevole senza toccare la RPC di valutazione. L'esito di ogni risposta è già calcolato sul client nell'istante della valutazione, quindi la sincronizzazione differita non ricalcola mai nulla e produce lo stesso risultato e la stessa scadenza che avrebbe prodotto online.

## Stories

- Story 4.1: La sessione si carica tutta in una volta
- Story 4.2: La coda sopravvive alla chiusura dell'app
- Story 4.3: Il ritorno della rete non chiede il permesso
- Story 4.4: Un indicatore che non spaventa
- Story 4.5: Riapplicare la coda non falsa niente

## Requirements & Constraints

- All'avvio della sessione l'intera pila dovuta va caricata in memoria in quel momento — contenuto di ogni esercizio e relativa spiegazione — così che avanzare da un esercizio all'altro non richieda mai una richiesta di rete, neppure per la spiegazione. Il precarico deve interrogare la pila con la stessa chiave usata dal conteggio della dashboard, per non avere due sorgenti di verità sul "dovuto".
- Le risposte prodotte senza rete si accodano localmente e la coda va persistita in modo durevole; alla riapertura dell'applicazione la coda deve essere ancora presente e il drenaggio deve ripartire da solo.
- Al ritorno della rete la coda si sincronizza automaticamente, senza alcun intervento e senza pulsante "riprova": il ritentativo dopo un fallimento è automatico. Le risposte vanno drenate in serie, preservando l'ordine.
- Una risposta data offline e sincronizzata più tardi deve produrre esattamente lo stesso esito e la stessa scadenza che avrebbe prodotto al momento della risposta; il drenaggio non ricalcola nulla.
- Lo stato "sincronizzazione in sospeso" deve essere visibile ma non invasivo. La sincronizzazione deve essere idempotente: riapplicare la stessa coda non deve produrre righe duplicate nel log né far avanzare due volte lo stadio di un esercizio. Un test end-to-end deve simulare perdita di rete, chiusura e riapertura dell'app, e verificare che ogni risposta offline risulti applicata esattamente una volta.

## Technical Decisions

- **Coda offline su TanStack Query, quattro vincoli non negoziabili.** (1) La `mutationFn` delle valutazioni è registrata al bootstrap dell'applicazione con `setMutationDefaults(['review'], …)` e **mai** dentro un componente: alla reidratazione il componente può non esistere e la ripresa fallirebbe con `No mutationFn found` — questo è il punto di fallimento più insidioso dell'epica. (2) Ogni mutation porta `scope: { id: 'review-sync' }`, così la coda si drena in serie e l'ordine è garantito. (3) Il persister scrive su IndexedDB con `throttleTime` non superiore a 250 ms — la finestra di perdita si stringe ma non si azzera, ed è un limite noto e accettato. (4) `resumePausedMutations()` viene invocata sia all'avvio dell'applicazione sia al ritorno online.
- **L'esito è calcolato sul client, non al momento dell'invio.** Il dominio calcola il nuovo stato (esito e `due_at`) nell'istante in cui l'utente valuta, tramite una funzione pura. La mutation trasporta il risultato già calcolato insieme al timestamp della risposta; il drenaggio non ricalcola mai. È questo che rende la sincronizzazione differita corretta per costruzione.
- **Idempotenza nella scrittura.** La persistenza è una sola RPC transazionale che inserisce nel log con `ON CONFLICT (review_id) DO NOTHING` e aggiorna lo stato di ripasso **solo se l'insert ha prodotto una riga**. `review_id` è un UUID generato dal client al momento della valutazione ed è la chiave di idempotenza: un doppio drenaggio non duplica righe né avanza lo stadio due volte. Questo comportamento esiste già a monte (Epic 3 lo persiste così); l'epica lo verifica, non lo introduce.
- **Aggiornamento ottimistico** su cache TanStack e store di sessione prima dell'invio: la barra avanza e il conteggio scende identici all'online, anche senza rete.
- **Stati vuoti/silenti** vanno gestiti dichiarando il perché; la logica di sessione e coda vive nel dominio e nel composition root (`src/app/`), non sparsa nei componenti.
- **Fuori scope esplicito:** avvio a freddo senza rete e PWA. L'applicazione ha bisogno della rete per partire; è un errore onesto atteso, non un difetto.

## UX & Interaction Patterns

- **`sync-indicator`.** Deriva da `useMutationState`, mai da uno stato proprio del componente, così non può divergere dallo stato reale della coda. È **assente** quando la coda è vuota: non mostra mai "tutto sincronizzato". Non usa il colore d'allarme, perché una risposta in coda è il funzionamento previsto e non un errore. Non è un modale né un toast bloccante; è una pastiglia discreta.
- **Annuncio accessibile.** L'indicatore annuncia via `aria-live="polite"` una sola volta al cambio di stato, non a ogni risposta accodata, per non sommergere le tecnologie assistive quando molte risposte entrano in coda in rapida successione.
- **Il principio è che la resilienza non si annuncia.** Alla perdita del campo la card non cambia; compare solo l'indicatore. Al ritorno della rete la coda si drena e l'indicatore sparisce da solo. La qualità del momento critico si misura da quanto poco accade: un modale "Sei offline" sarebbe un fallimento di prodotto. Nessun "riprendi dove eri" e nessun pulsante "riprova", che suggerirebbe che possa servire.

## Cross-Story Dependencies

- 4.1 (precarico) deve usare la stessa chiave di query del conteggio dovuto della dashboard, definita in Epic 3.
- 4.2 fonda la coda durevole; 4.3 vi si appoggia per il drenaggio automatico e in ordine; 4.4 legge lo stato della coda per l'indicatore; 4.5 verifica end-to-end l'idempotenza dell'intera catena. L'ordine di implementazione è vincolante.
- L'idempotenza verificata in 4.5 dipende dalla RPC e dalla chiave `review_id` prodotte in Epic 3, non da nuovo codice server introdotto qui.
- L'esito coerente tra offline e online (4.3) dipende dalla funzione pura di calcolo esito del dominio, definita in Epic 3.
