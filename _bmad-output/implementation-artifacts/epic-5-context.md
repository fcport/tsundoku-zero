# Epic 5 Context: Statistiche che dicono quale regola non ti è entrata

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Questa epica costruisce la vista statistiche del prodotto: l'utente vede le proprie risposte nel tempo, la distribuzione dei propri esercizi per stadio di scheduling, e — soprattutto — riconosce **i punti grammaticali** su cui sbaglia di più. È il salto di qualità rispetto al prodotto pre-pivot: non "quali frasi sbagli" (diagnostico e inutile), ma "quale regola non ti è entrata" (azionabile, perché indica su quale lezione tornare). Quando i dati non bastano, la vista dichiara cosa manca invece di mostrare grafici vuoti. Tutte e tre le statistiche sono di sola lettura e derivano da un'unica fonte.

## Stories

- Story 5.1: Quante risposte, e quando
- Story 5.2: A che punto sono i miei esercizi
- Story 5.3: Quale regola non mi entra in testa
- Story 5.4: Un grafico vuoto non è una risposta

## Requirements & Constraints

- Una vista statistiche mostra le risposte nel tempo (FR7.1).
- La stessa vista mostra la distribuzione degli esercizi per stadio di scheduling (FR7.2).
- La stessa vista mostra i punti grammaticali con il tasso di errore più alto, aggregati per punto grammaticale e **non** per singolo esercizio (FR7.3). Questa è la ragione d'essere dell'epica e va difesa in implementazione.
- Con dati insufficienti, ogni grafico dichiara **cosa manca e quanto** (es. "servono almeno 3 giorni di risposte"), senza mai renderizzare un riquadro di grafico vuoto né una schermata muta (FR7.5).
- Nessuna funzione è esclusiva di una superficie; la vista è raggiungibile in navigazione dalla dashboard.
- La cancellazione account rimuove i dati aggregati: le statistiche non sopravvivono alla cancellazione, conseguenza accettata e dichiarata all'utente.

Nota: lo streak (FR7.4) **non** appartiene a questa epica — nasce in Epic 3 (`streak(log, now, timeZone)` in `src/domain/streak.ts`) perché serve prima alla dashboard e al completamento sessione.

## Technical Decisions

- **Fonte unica: `review_log`, esclusivamente (AD-18).** Tutte e tre le statistiche si calcolano da `review_log`, mai da `review_state`. In particolare NON usare `review_count` (per le risposte nel tempo) né `lapse_count` (per il tasso di errore per punto grammaticale) come fonte: produrrebbero un secondo numero, diverso e ugualmente difendibile, dallo stesso concetto. Lo streak è sempre derivato dal log, mai memorizzato.
- **Asse della distribuzione per stadio (AD-17).** L'asse di FR7.2 deriva dalla costante unica esportata da `src/domain/schedule.ts` (stadi `0`–`5`, sei valori). Mostrare esattamente sei stadi leggendo quella costante, senza replicare un elenco parallelo nel codice della vista. La saturazione a 5 vive nella stessa costante: la vista non deve disegnare uno stadio in più o in meno di quanto il dominio produce.
- **`grammar_point` denormalizzato nel log (AD-18, FR5.7).** Ogni riga di `review_log` porta `grammar_point` copiato al momento della risposta. L'aggregazione di FR7.3 raggruppa per questo campo letto dal log. Questo è ciò che rende FR7.3 interrogabile anche dopo che un esercizio è stato riautorato e ha cambiato identità (AD-23): se il punto grammaticale vivesse solo su `exercise`, una riautorazione riscriverebbe la storia. Un esercizio riautorato non intacca la storia già accumulata sul suo punto grammaticale.
- **Colonne rilevanti di `review_log`:** `id, user_id, exercise_id, grammar_point, outcome, used_explanation, reviewed_at`. Il campo `outcome` distingue `again`/`hard`/`good`/`easy`; il tasso di errore si costruisce dagli esiti `again`.
- **RLS (AD-10):** `review_log` ha isolamento per riga (`user_id = auth.uid()`); la vista legge solo i dati dell'utente autenticato.
- **Purezza del dominio (NFR2, AD-3):** qualsiasi funzione di aggregazione che dipende dal tempo (es. il raggruppamento per giorno delle risposte nel tempo) riceve `now: Date` e `timeZone: string` iniettati, coerentemente con l'ancoraggio della giornata al fuso locale del dispositivo. La logica di aggregazione appartiene al dominio; la vista vive in `features/stats`.
- L'esito è oggettivo e calcolato (AD-24), quindi il tasso di errore misura un fatto reale, non un'autovalutazione — rende la statistica affidabile.

## UX & Interaction Patterns

- Il punto grammaticale nell'elenco dei più sbagliati **nomina anche la lezione che lo insegna**, così l'informazione è azionabile (l'utente sa dove tornare) e non solo diagnostica.
- Stato "dati insufficienti" (pattern `empty-state`, UX-DR18): dichiara **perché** è vuoto e cosa serve per riempirlo, con al massimo un'azione; vale per ciascuna delle tre viste indipendentemente.
- Voce e microcopy (coerenti con l'intero prodotto): nessun punto esclamativo, nessuna emoji, nessun avverbio di lode; **nessun verde di successo** nel sistema — non introdurre colori celebrativi nei grafici.
- WCAG 2.2 AA su entrambe le modalità; il non-testo (barre, marcatori dei grafici) rispetta il contrasto ≥ 3:1, il testo ≥ 4.5:1. Nessuna informazione veicolata dal solo colore.
- Layout responsive: la vista statistiche è l'unica schermata che a `≥ 1024px` può passare a **due colonne**; sotto resta a colonna singola centrata a `measure`.

## Cross-Story Dependencies

- **Dipende da Epic 3** per l'esistenza di dati: `review_log` viene alimentato dal percorso di risposta (append-only con `grammar_point`), e la costante di stadio di `AD-17` è definita in `src/domain/schedule.ts`. Senza cronologia di risposte questa epica mostra solo stati di dati insufficienti.
- **Dipende da Epic 2** per il concetto di `grammar_point` e per lo schema di lezione da cui deriva.
- Correttezza a valle di `AD-13`: un teardown e2e che fallisce lascia righe in `review_log` che falsano queste statistiche in modo silenzioso e permanente — vincolo di igiene dati che questa epica rende visibile ma non gestisce.
