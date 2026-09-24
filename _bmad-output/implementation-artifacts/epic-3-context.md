# Epic 3 Context: La pila — dalla lezione sbloccata alla sessione a zero

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Questa è l'epica centrale: consegna il prodotto vero e proprio. L'utente sblocca una lezione, ne risolve gli esercizi uno per volta leggendo perché la risposta è quella, e porta la pila a zero. L'epica è volutamente grande (28 requisiti funzionali) perché senza la progressione del curriculum (sbloccare lezioni) un account appena creato non avrebbe nulla da fare: la dashboard, la sessione di esercizi, lo scheduling e lo sblocco delle lezioni sono un unico ciclo che va consegnato insieme per avere valore. L'epica assorbe anche l'intero motore di dominio (scheduling, esito, "dovuto", coda di sessione, streak, furigana) perché un livello tecnico non consegna niente da solo: dominio puro e testato prima, poi dati e RPC, poi schermate.

## Stories

- Story 3.1: Il motore di scheduling, puro e saturo
- Story 3.2: L'esito si calcola, non si dichiara
- Story 3.3: Una sola definizione di "dovuto"
- Story 3.4: La coda di sessione decide il dominio, non la UI
- Story 3.5: Lo streak si calcola, non si memorizza
- Story 3.6: La furigana si allinea nel dominio
- Story 3.7: Il contenuto raggiunge il client e può essere aggiornato
- Story 3.8: Il progresso è per-utente e resta per-utente
- Story 3.9: Una risposta, una chiamata, nessun doppione
- Story 3.10: Gli adattatori dietro le porte
- Story 3.11: Il giapponese si presenta bene
- Story 3.12: La pila, con un numero e un pulsante
- Story 3.13: Sbloccare la lezione successiva
- Story 3.14: Una lezione senza esercizi si sblocca lo stesso
- Story 3.15: La prima volta non somiglia alla fine
- Story 3.16: Quando non c'è più niente da fare, dirlo
- Story 3.17: Cambiare il ritmo
- Story 3.18: Un esercizio per volta, con la sua consegna
- Story 3.19: Rispondere, e sapere perché
- Story 3.20: Vedere quanto manca, e potersene andare
- Story 3.21: Arrivare a zero
- Story 3.22: L'intera sessione senza mouse
- Story 3.23: Le stesse schermate su telefono e portatile

## Requirements & Constraints

- **La dashboard è a quest sequenziali.** Mostra il conteggio dei dovuti, lo streak, e il progresso del curriculum (lezioni sbloccate su totale), ed espone **una sola** azione primaria. Le due quest — *svuota la pila* e *sblocca la lezione successiva* — non compaiono mai insieme, nemmeno una disabilitata: sono governate da un cancello (si sblocca solo a pila vuota).
- **Tre stati tecnicamente distinti da non confondere:** primo avvio (mai sbloccato niente → "comincia", senza conteggi a zero), pila svuotata con lezioni disponibili ("hai finito", l'azione diventa sbloccare), pila a zero con curriculum esaurito (unica schermata **senza** azione primaria). Ogni stato vuoto dichiara *perché* è vuoto.
- **Sessione di esercizi:** un esercizio per volta con la sua consegna; risposta per scelta fra opzioni (mai testo libero); dopo la risposta il sistema dichiara l'esito e mostra la spiegazione. La spiegazione è consultabile **anche prima** di rispondere, l'azione è registrata e non va scoraggiata. L'abbandono conserva le risposte già date; una nuova sessione si ricostruisce (nessun "riprendi dove eri"), senza penalità. Barra di avanzamento sempre visibile che rappresenta il **completato**, non il rimanente.
- **Sblocco lezioni:** sequenziale, non si salta; tetto giornaliero configurabile (predefinito 1) modificabile da Impostazioni. Una lezione senza esercizi si sblocca comunque, non muove la pila, e l'interfaccia lo dichiara.
- **Isolamento dati (verificato da test):** RLS su `review_state`, `review_log`, `lesson_progress`, `user_settings` con `user_id = auth.uid()`; il contenuto (`lesson`, `exercise`) è in sola lettura senza policy di scrittura. Un test di integrazione dimostra esplicitamente, per ciascuna tabella, che l'utente A non legge né scrive le righe di B.
- **Copertura di test:** scheduling con casi limite; ogni tipo di esercizio ha i test del suo validatore; flusso di esercizio con test di componente (porte iniettate in memoria, senza rete); una sessione completa fino a pila zero pilotabile da sola tastiera.
- FR7.4 (streak) nasce qui, non in Epic 5, perché serve alla dashboard e alla schermata di completamento.

## Technical Decisions

- **Motore di dominio puro (`src/domain/`), niente dipendenze da UI, rete, orologio o DB.** Ogni funzione temporale riceve `now: Date` e `timeZone: string` iniettati. Nessun `Date.now()`, `new Date()` senza argomenti, `Intl…resolvedOptions()` né `Math.random()` sotto `src/domain/`. Il confine è imposto in CI (`eslint-plugin-boundaries`).
- **Scala Leitner unica** in `src/domain/schedule.ts`: stadi `0`–`5`, intervalli `0, 1, 3, 7, 16, 35` giorni. Da questa costante derivano il `CHECK` SQL su `review_state.stage` e l'asse delle statistiche. `schedule(state, outcome, now)`: `good` +1 stadio, `easy` +2, `again` → stadio 0 e `lapse_count++`, `hard` mantiene lo stadio a intervallo ridotto (~60%). Gli stadi **saturano** ai due estremi senza ramificazioni speciali. Intervallo `0` = "di nuovo in questa sessione" (torna in fondo alla coda corrente). Le scadenze ricevono una **dispersione deterministica** derivata da `exercise_id` e `stage`.
- **L'esito è calcolato, non dichiarato:** `outcomeOf(response, usedExplanation, declaredEasy): ReviewOutcome` puro. `again` se sbagliata; `hard` se corretta dopo aver consultato la spiegazione; `good` se corretta senza aiuto; `easy` se corretta senza aiuto e dichiarata. Nessun altro punto del sistema decide un esito. Calcolabile interamente sul client, senza rete — così una risposta data offline produce lo stesso esito/scadenza che avrebbe prodotto online.
- **Una sola definizione di "dovuto":** `isDue(state, now)` pura; dashboard, precarico di sessione e cancello di sblocco leggono tutti la **stessa chiave TanStack** `['due', userId]`. Nessuna schermata ricalcola la pila.
- **Coda di sessione:** lo store Zustand delega a `sessionReducer(state, event)` in `src/domain/session.ts` e **non** è persistito; nessuna logica di scheduling/coda nello store. La sessione termina quando ogni esercizio ha ricevuto almeno un `good`.
- **Streak:** `streak(log, now, timeZone)` sempre derivato da `review_log` a ogni lettura, mai memorizzato. Una giornata conta se la pila arriva a zero, o se c'è almeno una risposta con pila già vuota; confine di giornata a mezzanotte nel fuso passato.
- **Furigana nel dominio:** `alignFurigana(kanji, kana): FuriganaSegment[]` pura in `src/domain/furigana.ts`. Copre okurigana (難しい), prefisso kana (お茶) e ruby di gruppo su nucleo non separabile (今日, 大人, 一人, 日本語). `src/ui/` riceve segmenti già calcolati, nessuna logica di allineamento nella UI.
- **Porte dichiarate dal dominio** (`src/domain/ports/`): `ContentRepository`, `ReviewRepository`, `ProgressRepository`, `SettingsRepository`, `Clock`. Solo `src/data/` le implementa ed è l'unica cartella che importa `@supabase/supabase-js`; lancia un `DataError` tipizzato in caso di fallimento. Livelli: `domain → data → ui → features → app`, `features` **non** importa `data`.
- **Persistenza di una risposta = una sola chiamata idempotente:** RPC `apply_review(review_id, exercise_id, outcome, stage, due_at, reviewed_at, used_explanation)`. In una transazione inserisce in `review_log` con `ON CONFLICT (review_id) DO NOTHING` e aggiorna `review_state` **solo se** l'insert ha prodotto una riga. Nessuna logica di scheduling/valutazione in SQL: riceve `outcome`, `stage`, `due_at` già calcolati dal client. Il `review_id` è generato dal client. L'idempotenza nasce qui (non perché Epic 4 la richieda) ma è **verificata** in Epic 4.
- **Sbloccare una lezione materializza gli esercizi:** crea una riga `review_state` per ciascun esercizio (`stage = 0`, `due_at` = istante di sblocco) più una riga `lesson_progress`. "Mai incontrato" = **assenza di riga**. Una lezione senza esercizi produce solo la riga di progresso.
- **Contenuto come righe Postgres popolate da migrazione, non nel bundle** (decisione OQ-8): `lesson` (`id` slug dal punto grammaticale, `ordinal`, `title_en`, `title_it`, `grammar_points`), `exercise` (`id` uuidv5 dal contenuto, `lesson_id`, `kind`, `payload` jsonb, `grammar_point`, `explanation_en`, `explanation_it`). Il seed dai file `content/lessons/` è un upsert su `id` che conserva l'identità degli esercizi invariati.
- **Denormalizzazione deliberata:** `review_log.grammar_point` vive nel log perché una statistica non può dipendere da dati mutabili che una riautorazione riscriverebbe.
- **Registro chiuso di tre tipi di esercizio** (union discriminata nel dominio): `single-select`, `select-span`, `assemble`. `assemble` è un ordinamento, non una selezione singola — il contratto tastiera deve coprirlo. L'ordine delle opzioni/distrattori è deterministico, mai casuale (per stabilità dei test).
- **Stack:** Vite + React 19, TypeScript 5.9.3 strict, nessun `any`. `npm ci`. Un solo progetto Supabase reale: le migrazioni si applicano **solo al merge su `main`**, mai da un ramo di PR — quindi una PR che tocca lo schema vede i propri e2e solo dopo il merge.

## UX & Interaction Patterns

- **Componenti chiave:** `pile-counter` (conteggio nel corpo tipografico più grande, etichetta **sotto**; a zero non mostra "0" ma cambia stato), `exercise-card` (unica superficie `surface-raised`, tre stati a senso unico: consegna → risposta data → spiegazione), `answer-option` ×n (numero variabile per tipo, bersagli ≥56px), `explanation-panel`, `curriculum-progress`, `progress-meter` (4px, stato ottimistico locale), `streak-badge`, `empty-state`, `button-primary` (max uno per schermata, testo verbale e concreto mai "Continua").
- **Aggiornamenti ottimistici:** conteggio e barra si aggiornano prima della conferma del server.
- **Nessuna grammatica della celebrazione:** l'esito non usa verde per il giusto né rosso per lo sbagliato; l'informazione la porta il contenuto della spiegazione. Nessun punto esclamativo, emoji, avverbio di lode, coriandolo, badge o animazione celebrativa. Microcopy: il conteggio precede il verbo ("23 da rivedere"). Un esercizio ripresentato nella stessa sessione non porta alcuna segnalazione distintiva.
- **Rendering giapponese:** `<ruby>`/`<rt>` con `<rp>` di ripiego, segmenti già calcolati; `lang="ja"` su ogni nodo con giapponese (non passa da i18n); `<rt>` è `aria-hidden`; il romaji non compare mai. Se mostrare la furigana è un campo del **tipo di esercizio**, non globale, con predefinito *visibile* (nasconderla testerebbe i kanji invece della grammatica).
- **Accessibilità (contratto di sessione):** una sola live region `aria-live="polite"` per sessione che annuncia esito e avanzamento; ordine di tabulazione = ordine di lettura = ordine dei tasti numerici; anello di focus visibile; nessuna opzione distinta per solo colore (etichetta e posizione portano l'informazione); un tasto numerico seleziona l'opzione corrispondente con associazione numero↔posizione costante fra i tipi, e il comportamento oltre la fila numerica è dichiarato esplicitamente. Il nuovo contratto tastiera è registrato come **aggiornamento di AD-15**.
- **Responsive (tre breakpoint):** `<640px` telefono, colonna singola, gutter 20px, opzioni di risposta entro 120px dal bordo inferiore (`thumb-zone`); `640–1024px` colonna centrata a `measure`; `≥1024px` centrato a `measure`, **non** allargato. Nessuna funzione esclusiva di una superficie. Modalità scura come pari, senza interruttore (segue `prefers-color-scheme`).
- **Ritorno a capo del giapponese (AD-27):** solo ai confini dei segmenti di `alignFurigana()`, mai dentro un segmento; ogni riga ha spazio per il proprio ruby (interlinea 1.9). Il ruolo `sentence-hero` è 32px desktop / 26px mobile, da verificare sul rendering reale con la frase più lunga della lezione campione (storia 2.7).
- **Caricamento:** scheletro alla stessa altezza del contenuto finale, senza spinner né salti di layout.

## Cross-Story Dependencies

- **Dipende da Epic 2:** usa (non costruisce) la union discriminata dei tipi di esercizio e i validatori puri `check()`. La lezione campione della storia 2.7 fornisce gli esercizi reali per i test di componente della sessione.
- **Dipende da Epic 1:** confini architetturali imposti in CI, design token, i18n tipizzata, schema `user_settings` e RLS iniziale, superficie *Impostazioni* (estesa qui con il tetto di sblocco). La storia 3.23 chiude il ruolo tipografico `sentence-hero`/`UX-DR8` lasciato aperto in 1.3.
- **Ordine interno consigliato:** dominio puro e testato (3.1–3.6) → dati/porte/RPC (3.7–3.10) → schermate (3.11–3.23).
- **Epic 4 costruisce sopra questa senza toccare la RPC:** l'idempotenza (`AD-7`/FR9.6) è costruita qui e verificata là; l'esito calcolato sul client (`AD-24`) rende il drenaggio offline gratuito.
- **Epic 5** consuma `review_log` (incluso `grammar_point` denormalizzato qui). **Epic 7** usa la lezione campione per l'e2e completo e verifica la cancellazione account su `lesson_progress`.
