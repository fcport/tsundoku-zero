# Epic 3 Context: La pila — dalla lezione sbloccata alla sessione a zero

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Questa epica consegna il prodotto vero e proprio: l'utente sblocca una lezione, risolve i suoi esercizi uno per volta leggendo perché la risposta è quella, e porta la pila a zero. È grande di proposito (28 requisiti funzionali) perché senza la progressione del curriculum non consegnerebbe alcun valore a chi parte da zero — cioè a tutti: un account appena creato non ha lezioni sbloccate, quindi pila vuota, quindi niente da fare. L'epica assorbe l'intero motore di dominio (scheduling, calcolo dell'esito, definizione di "dovuto", coda di sessione, streak, allineamento della furigana), la persistenza per-utente con la sua RPC idempotente, e tutte le schermate della dashboard e della sessione. Le storie sono ordinate: prima il dominio puro e testato, poi i dati e la RPC, poi le schermate.

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

- **Una sola pila, un solo numero.** Il conteggio mostrato dalla dashboard, la pila precaricata dalla sessione e il cancello che abilita lo sblocco devono derivare tutti dalla stessa fonte: nessuna schermata ricalcola per conto proprio.
- **L'esito è derivato, non dichiarato dall'utente.** Sbagliato → `again`; corretto dopo aver consultato la spiegazione → `hard`; corretto senza aiuto → `good`; corretto senza aiuto e dichiarato tale → `easy`. La spiegazione è consultabile anche prima di rispondere: è un percorso previsto, viene registrato, e cambia il significato della risposta.
- **Scala di scheduling unica.** Sei stadi (0–5), intervalli `0, 1, 3, 7, 16, 35` giorni. `good` avanza di uno, `easy` di due, `again` torna a 0 incrementando le ricadute, `hard` mantiene lo stadio con intervallo ridotto (~60%). Gli stadi saturano ai due estremi senza ramificazioni speciali. Intervallo 0 significa "di nuovo in questa sessione": l'esercizio torna in fondo alla coda corrente.
- **Ogni risposta va in un log append-only** che porta con sé il punto grammaticale dell'esercizio (denormalizzato), perché le statistiche devono restare interrogabili anche dopo una riautorazione che cambia l'identità dell'esercizio. Lo streak si deriva sempre dal log, mai memorizzato.
- **Progressione sequenziale e a cancello.** Si sblocca solo la lezione successiva in ordine, mai saltando; lo sblocco è possibile solo quando la pila è vuota. Un tetto giornaliero configurabile (predefinito 1) limita quante lezioni si sbloccano al giorno.
- **Sblocco = materializzazione.** Sbloccare crea subito una riga di stato di revisione per ciascun esercizio (stadio 0, scadenza = istante di sblocco) più una riga di progresso della lezione. Una lezione senza esercizi produce la sola riga di progresso: la pila non si muove e l'interfaccia lo dichiara. "Mai incontrato" significa assenza di riga.
- **Abbandono senza penalità.** Le risposte già date restano acquisite; non esiste "riprendi dove eri" — la sessione si ricostruisce dagli esercizi ancora dovuti, non si ripristina.
- **Streak e completamento.** Una giornata conta quando l'utente porta la pila a zero, oppure completa almeno un esercizio se la pila era già vuota; la giornata termina a mezzanotte nel fuso locale del dispositivo. Lo streak nasce in questa epica (non in Epic 5) perché serve alla dashboard e alla schermata di completamento.
- **Prestazioni percepite.** Aggiornamenti ottimistici: conteggio e barra si aggiornano prima della conferma del server. I caricamenti mostrano uno scheletro all'altezza finale, mai uno spinner né salti di layout.
- **Accessibilità.** L'intera sessione è operabile da sola tastiera; una sola live region annuncia esito e avanzamento; anelli di focus visibili; bersagli alti almeno 56px. Il giapponese porta l'attributo di lingua e la furigana `<rt>` è nascosta agli screen reader.
- **Copertura di test.** Scheduling e casi limite testati a fondo; flusso di esercizio con test di componente che iniettano implementazioni in memoria delle porte (nessuna rete); un test di componente guida una sessione completa fino a zero usando solo la tastiera.

## Technical Decisions

- **Confine architetturale a cinque livelli** (`domain → data → ui → features → app`, con `features` che non importa `data`), imposto meccanicamente dal lint. Il nucleo di dominio è puro: `src/domain/` non importa React, Supabase, `fetch`, storage né orologio.
- **Il tempo è sempre un parametro.** Ogni funzione di dominio che dipende dal tempo riceve `now: Date` e, dove serve, `timeZone: string`. Nessun `Date.now()`, `new Date()` senza argomenti, o lettura del fuso dall'ambiente sotto `src/domain/`.
- **Determinismo senza casualità.** Nessun `Math.random()` nel dominio: ordine dei distrattori/tessere e dispersione delle scadenze sono deterministici (la dispersione deriva da id esercizio e stadio), così i test restano stabili.
- **Funzioni di dominio da costruire** (tutte pure, in `src/domain/`): il motore di scheduling con la costante unica della scala; `outcomeOf(response, usedExplanation, declaredEasy)`; `isDue(state, now)`; `sessionReducer(state, event)` per la coda; `streak(log, now, timeZone)`; `alignFurigana(kanji, kana)`. Nessun altro punto del sistema decide un esito, la pila come "dovuta", o la coda di sessione.
- **Furigana segmentata nel dominio.** `alignFurigana` toglie prefisso/suffisso di kana comuni e applica ruby di gruppo al nucleo. Tre classi da coprire: okurigana (難しい), prefisso kana (お茶), jukujikun / ruby di gruppo su nucleo non separabile per carattere (今日, 大人, 一人, 日本語). La `src/ui/` riceve i segmenti già calcolati e non contiene logica di allineamento. Gli stessi segmenti servono anche al ritorno a capo (vedi sotto).
- **Registro dei tipi di esercizio chiuso a tre** (deciso su contenuto reale): `single-select`, `select-span`, `assemble`. È definito in Epic 2 e qui viene consumato, non costruito. `select-span` verifica la correttezza sui confini dei segmenti di `alignFurigana()`, non su indici di carattere; `assemble` è un'interazione di **ordinamento** (non di selezione) e la correttezza dipende dall'ordine. Ciò che un esercizio insegna vive in `grammar_point`, non nel tipo.
- **Zustand ospita, il dominio decide.** Lo store di sessione delega ogni calcolo a `sessionReducer()` e non è persistito.
- **Porte dichiarate dal dominio** in `src/domain/ports/`: `ContentRepository`, `ReviewRepository`, `ProgressRepository`, `SettingsRepository`, `Clock`. Solo `src/data/` le implementa ed è l'unica cartella che importa il client Supabase; i fallimenti si propagano come errore tipizzato.
- **Il contenuto viaggia come righe di Postgres popolate da migrazione** (decisione di OQ-8), non incluso nel bundle: 90 lezioni nel bundle peserebbero su ogni visitatore e una correzione richiederebbe un redeploy. Le tabelle di contenuto (`lesson`, `exercise`) hanno RLS in sola lettura e nessuna policy di scrittura; il seed dai file di `content/lessons/` è un upsert su `id` che conserva l'identità degli esercizi invariati.
- **Modello dati per-utente:** `review_state` (chiave utente + esercizio; stadio, scadenza, contatori, ultimo istante di revisione), `review_log` (append-only; include `grammar_point`, esito, uso della spiegazione, istante), `lesson_progress` (chiave utente + lezione; istante di sblocco). RLS su tutte con policy `user_id = auth.uid()`, verificata da test di isolamento esplicito per ciascuna tabella. Il `CHECK` sullo stadio e la union dell'esito derivano dalle stesse costanti del dominio, non da elenchi paralleli.
- **Una risposta è una sola chiamata, transazionale e idempotente.** RPC `apply_review(review_id, exercise_id, outcome, stage, due_at, reviewed_at, used_explanation)`: inserisce in `review_log` con `ON CONFLICT (review_id) DO NOTHING` e aggiorna `review_state` solo se l'insert ha prodotto una riga. La SQL non contiene logica di scheduling né di valutazione: riceve esito, stadio e scadenza già calcolati dal client. Il `review_id` è generato dal client all'istante della risposta. Questo percorso nasce idempotente perché è semplicemente come si persiste una risposta, e Epic 4 vi costruisce sopra la coda durevole senza toccare la RPC.
- **Impostazioni:** la superficie contiene esattamente lingua e tetto giornaliero di sblocco, più la cancellazione account (nessun interruttore di tema). Il tetto è la colonna `lessons_per_day` (predefinito 1), aggiornata con upsert diretto.

## UX & Interaction Patterns

- **Design token già esistenti (da Epic 1):** 27 token colore su fondo carta (nessun bianco puro), inchiostro non nero, un solo accento (indaco, significa "questo fa avanzare"), una sola tinta di allarme (robbia, significa "questo ti riporta indietro"). **Nessun verde, nessuna ombra.** Modalità scura come pari, senza interruttore, segue `prefers-color-scheme`. Nessun componente scrive un valore colore letterale. Due token di bordo non intercambiabili: `border-hairline` solo decorativo, `border-strong` per il confine di ogni componente interattivo (le opzioni di risposta). Scala di spaziatura a 4px con token nominati (`gutter-mobile` 20px, `gutter-desktop` 32px, `measure` 34rem, `thumb-zone` 120px).
- **Tipografia del giapponese di frase — deciso e da verificare qui.** Ruolo `sentence-hero` fissato a 32px (desktop) / 26px (mobile) con interlinea **1.9** (non l'1.75 di `word-hero`, che valeva per una parola sola). L'interlinea alta serve perché con il testo su più righe la furigana serve sopra ogni riga, non solo la prima. `word-hero` (64px) sopravvive solo per esercizi a parola/sintagma breve; le due scale convivono, scelte dal tipo di esercizio. La verifica sul rendering reale (story 3.23) usa la frase più lunga della lezione campione (una frase di 28 caratteri deve stare in ≤2 righe a 1024px e ≤3 righe sotto 640px); se sfonda si corregge il corpo prima di costruirci la sessione.
- **Ritorno a capo solo ai confini dei segmenti** prodotti da `alignFurigana()`, mai dentro un segmento: spezzare una parola giapponese in un punto arbitrario è un difetto didattico su un'app di grammatica. Nessuna dipendenza di sillabazione: i segmenti del ruby sono anche i soli punti di interruzione ammessi.
- **Rendering giapponese:** `<ruby>`/`<rt>` con `<rp>` di ripiego; `lang="ja"` su ogni nodo con giapponese (il giapponese non passa da i18n, è dato); `<rt>` in `aria-hidden`. **Il romaji non compare mai** e non esiste un'impostazione per riattivarlo. La visibilità della furigana è un campo dichiarato dal tipo di esercizio, con predefinito **visibile**: in un esercizio di grammatica la lettura è supporto, non soluzione, e nasconderla testerebbe i kanji invece della grammatica.
- **Struttura a due quest mai simultanee** sequenziate dal cancello: *svuota la pila*, poi *sblocca la lezione successiva*. Non mostrarle mai insieme, nemmeno una disabilitata — niente pulsante grigio "non ancora". Al massimo una sola azione primaria per schermata; a pila vuota l'azione di sblocco compare, a pila non vuota è assente.
- **Componenti chiave:** `pile-counter` (numero nel corpo più grande dell'app, etichetta sotto; a zero non mostra "0", la dashboard cambia stato); `answer-option` ×n (numero variabile secondo il tipo, non fisso; bersagli 56px dentro `thumb-zone` su mobile; nessuna opzione si distingue per solo colore — etichetta e posizione portano l'informazione); `exercise-card` (unica superficie sollevata, tre stati: consegna → risposta data → spiegazione, transizione a senso unico); `explanation-panel` (unica prosa lunga dell'app); `curriculum-progress`; `progress-meter` (4px, rappresenta il **completato**, riflette lo stato ottimistico locale); `streak-badge`.
- **Comunicazione dell'esito senza verde per il giusto né rosso per lo sbagliato:** l'informazione è portata dal contenuto della spiegazione, non dalla tinta — la spiegazione È la risposta. Un errore non è colpa. Un esercizio ripresentato nella stessa sessione non porta alcuna segnalazione che lo distingua.
- **Due stati di dashboard tecnicamente uguali ma che devono essere due schermate diverse:** primo avvio (mai sbloccato nulla → *comincia*, senza conteggio o streak a zero) e pila svuotata (*hai finito*). La schermata a curriculum esaurito è l'unica dell'app senza azione primaria. Ogni stato vuoto dichiara **perché** è vuoto e offre al massimo un'azione.
- **Contratto tastiera (già risolto, story 3.22, aggiorna il vecchio contratto di sessione):** tasto numerico 1–9 → posizione dell'opzione, con mappa pura agnostica al tipo e comportamento di overflow dichiarato; `Enter` avanza, `Esc` esce; una sola live region `aria-live="polite"`; ordine di tabulazione = ordine di lettura = ordine dei tasti numerici; da registrare come contratto documentato con test. `assemble` richiede in più un gesto di ordinamento, non solo la selezione posizionale.
- **Voce e microcopy:** il conteggio precede il verbo ("23 da rivedere", non "hai 23 esercizi"); nessun punto esclamativo, emoji, avverbio di lode, animazione celebrativa, badge o coriandoli. La schermata di completamento è sobria.
- **Responsive:** tre breakpoint — sotto 640px telefono (colonna singola, gutter 20px, opzioni di risposta entro 120px dal bordo inferiore), 640–1024px tablet (colonna centrata a `measure`), da 1024px portatile (centrato a `measure`, **non allargato**). Nessuna funzione è esclusiva di una superficie.

## Cross-Story Dependencies

- **Le storie di dominio precedono quelle di UI e dati.** Motore di scheduling, `outcomeOf`, `isDue`, `sessionReducer`, `streak`, `alignFurigana` (3.1–3.6) sono pure e vanno prima; le migrazioni, la RPC e le porte (3.7–3.10) danno la persistenza; poi le schermate (3.11–3.23) le consumano.
- **Dipende da Epic 2:** questa epica consuma il registro chiuso dei tre tipi di esercizio, i validatori `check()` e lo schema di lezione. La lezione campione di Epic 2 (story 2.7) è la fixture per i test di componente della sessione e per l'e2e di Epic 7.
- **Dipende da Epic 1:** lo scaffold con i confini in CI, i design token, l'autenticazione, l'i18n con chiavi tipizzate e la superficie Impostazioni (che questa epica estende con il tetto di sblocco). La verifica del ruolo tipografico di frase, lasciata aperta in Epic 1, si chiude qui (story 3.23).
- **Abilita Epic 4 senza dipenderne:** la RPC idempotente e l'esito calcolato interamente sul client fanno sì che Epic 4 costruisca la coda durevole senza modificare il percorso di scrittura né ricalcolare nulla al drenaggio.
- **La furigana ha due usi accoppiati:** i segmenti di `alignFurigana()` servono sia al ruby sia al ritorno a capo; toglierli romperebbe entrambi i comportamenti.
- **Verso Epic 5 ed Epic 7:** `streak()` e il `review_log` con `grammar_point` denormalizzato, nati qui, alimentano le statistiche di Epic 5; la verifica manuale su screen reader e l'e2e end-to-end vivono in Epic 7 ma esercitano le schermate e la fixture di questa epica.
