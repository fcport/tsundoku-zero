---
name: 'Tsundoku Zero — Spine Delta'
type: architecture-spine-delta
purpose: input-to-architecture-update
status: draft
created: '2026-09-22'
supersedes_partially: '../architecture-tsundoku-zero-2026-08-19/ARCHITECTURE-SPINE.md'
sources:
  - '_bmad-output/planning-artifacts/prds/prd-tsundoku-zero-2026-09-22/prd.md'
---

# Spine Delta — pivot alla grammatica strutturale

Documento di transizione, non una spine completa. Dice **cosa resta, cosa cambia e cosa manca** rispetto alla spine del 19 agosto, che resta valida per tutto ciò che non è elencato qui.

Non sostituisce una rigenerazione con `bmad-architecture`: la prepara. Le voci marcate `[DA DECIDERE]` sono esattamente ciò che quella sessione deve interrogare, e che questo documento non ha l'autorità per chiudere.

---

## 1. Verdetto sui 21 invarianti esistenti

| AD | Sorte | Nota |
|---|---|---|
| AD-1 — Nucleo di dominio puro | **Intatto** | Il vincolo più importante del progetto non cambia di una virgola |
| AD-2 — Porte dichiarate dal dominio | **Modificato** | `VocabularyRepository` → `ContentRepository`; nuova porta `ProgressRepository` per le lezioni sbloccate |
| AD-3 — Il tempo è un parametro | **Intatto** | |
| AD-4 — Determinismo senza casualità | **Intatto**, e rafforzato | Si estende alla selezione degli esercizi e all'ordine dei distrattori, che non può essere casuale se i test devono essere stabili |
| AD-5 — Una sola definizione di "dovuto" | **Intatto** nella forma | `isDue(state, now)` opera su stato di esercizio invece che di vocabolo. La regola — una chiave sola, nessuna schermata che ricalcola — è identica |
| AD-6 — Zustand ospita, il dominio decide | **Intatto** | |
| AD-7 — Una valutazione, una chiamata, idempotente | **Modificato** | Firma RPC: `vocabulary_id` → `exercise_id`, e si aggiunge `used_explanation` perché FR5.2 ne ha bisogno per derivare l'esito. La struttura transazionale e `ON CONFLICT (review_id) DO NOTHING` restano identiche |
| AD-8 — Coda offline TanStack, quattro vincoli | **Intatto** | |
| AD-9 — Identità del vocabolario dal contenuto | **Sostituito** da AD-23 | La tabella `vocabulary` sparisce; la tecnica `uuidv5` sopravvive applicata agli esercizi |
| AD-10 — RLS su ogni tabella per-utente | **Esteso** | Si aggiunge `lesson_progress` all'elenco. La regola "una nuova tabella per-utente senza policy è un difetto bloccante" copre già il caso |
| AD-11 — Cancellazione via Edge Function | **Intatto** | Resta l'unico codice server del progetto, e il pivot lo conferma: niente LLM a runtime significa niente secondo endpoint |
| AD-12 — Migrazioni versionate | **Intatto** | |
| AD-13 — Test e2e senza dati condivisi | **Intatto** | |
| AD-14 — Nessuna stringa cablata | **Modificato** | Le spiegazioni degli esercizi (FR8.5) sono **contenuto bilingue nel file di lezione**, non chiavi i18n. Il confine va ridichiarato: interfaccia da `t()`, contenuto dal file, giapponese da nessuno dei due |
| AD-15 — L'accessibilità della sessione è un contratto | **Modificato** | Il contratto tastiera cambia: non più "spazio rivela, 1-4 valutano", ma "1-n selezionano un'opzione, invio conferma". Da riscrivere, non da abbandonare |
| AD-16 — Attribuzione su ogni schermata | **Allentato** | Senza JMdict cade l'obbligo EDRDG. Diventa una pagina di riconoscimenti (FR10.2). `LICENSE` e `LICENSE-CONTENT` restano due file separati |
| AD-17 — La scala degli stadi è una sola costante | **Intatto** | |
| AD-18 — Le statistiche derivano solo dal log | **Intatto**, e più potente | `review_log` acquisisce il punto grammaticale (FR5.7), che è ciò che rende possibile FR7.3 |
| AD-19 — Introdurre un item lo materializza subito | **Riscritto** come AD-26 | Stessa logica, unità diversa: si sblocca una lezione, non si introduce un item |
| AD-20 — Vincolo di dimostrabilità | **Intatto** | |
| AD-21 — Furigana segmentata nel dominio | **Intatto**, e più necessario | Gli esercizi usano frasi intere: più kanji, più okurigana, più occasioni di sbagliare il ruby |

**Riepilogo:** 12 intatti, 6 modificati, 1 sostituito, 1 riscritto, 1 allentato. Il confine architetturale e il motore sopravvivono interi — è la conferma che il pivot tocca il contenuto e non l'ossatura.

---

## 2. Invarianti nuovi

### AD-22 — Il registro dei tipi di esercizio è chiuso e vive nel dominio

- **Binds:** F2, F4, F11, FR11.3, FR11.6, NFR3
- **Prevents:** novanta lezioni che inventano quaranta formati d'esercizio, un'interfaccia che diventa uno zoo e una suite di test che non copre niente perché non sa cosa coprire. È il modo in cui questo progetto fallisce senza accorgersene
- **Rule:** i tipi di esercizio sono una **union discriminata chiusa** dichiarata in `src/domain/exercise.ts`. Ogni tipo porta tre cose e nessun'altra: la forma dei suoi dati, un validatore puro `check(exercise, response): Outcome`, e i suoi test.

  Il file di una lezione **non può introdurre un tipo**: un `kind` sconosciuto è un errore di validazione dello schema, non un caso da ignorare a runtime. Aggiungere un tipo è una modifica di codice che passa da una pull request; aggiungere una lezione non tocca il codice.

  `[DA DECIDERE]` L'insieme iniziale dei tipi resta aperto per scelta, e va chiuso **dopo aver autorato tre lezioni vere** (PRD OQ-7). La proposta corrente — `identify-subject`, `particle-choice`, `identify-engine`, `transform` — è un punto di partenza, non un impegno.

### AD-23 — Identità dell'esercizio derivata dal contenuto

- **Binds:** F2, FR2.5, FR11.5
- **Prevents:** una riautorazione della lezione 3 che orfana il progresso di tutti su ogni esercizio della lezione 3, in silenzio. È lo stesso difetto che AD-9 preveniva sul vocabolario, ed è arrivato qui insieme al contenuto
- **Rule:** `exercise.id = uuidv5(natural_key, NAMESPACE)` dove `natural_key` è derivata dal **contenuto semantico** dell'esercizio — tipo, frase, risposta corretta — normalizzata NFKC, e **non** include la spiegazione né i distrattori.

  La distinzione è deliberata e va difesa: correggere un refuso in una spiegazione, o riordinare i distrattori, **non deve** cambiare l'identità dell'esercizio, perché non ne cambia la sostanza. Cambiare la frase o la risposta corretta **deve** cambiarla, perché è un esercizio diverso. Un test verifica entrambe le direzioni.

### AD-24 — L'esito è calcolato, non dichiarato

- **Binds:** F5, FR5.2, CM2, NFR2
- **Prevents:** la logica di FR5.2 che si sparpaglia fra il componente che conosce il click e lo store che conosce la spiegazione aperta, producendo due percorsi che derivano esiti diversi dagli stessi fatti
- **Rule:** `outcomeOf(response, usedExplanation, declaredEasy): ReviewOutcome` è una funzione **pura** in `src/domain/`. Nessun altro punto del sistema decide un esito. L'interfaccia raccoglie fatti — cosa ha scelto l'utente, se ha aperto la spiegazione, se ha dichiarato "facile" — e il dominio li traduce.

  Conseguenza che rende F9 più economica: l'esito è calcolabile **interamente sul client e senza rete**, quindi una risposta data in galleria produce lo stesso esito e la stessa scadenza che avrebbe prodotto online. Il drenaggio della coda non ricalcola nulla, esattamente come in AD-7.

### AD-25 — Il contenuto delle lezioni è dato validato, mai codice

- **Binds:** F2, F11, FR2.6, FR11.1, FR11.4, NFR9
- **Prevents:** una lezione che per essere aggiunta richiede di toccare un `switch`, o peggio che arriva in produzione malformata e rompe la sessione di chi l'ha sbloccata
- **Rule:** una lezione è un file dati versionato in `content/lessons/`, conforme a uno schema unico. La validazione gira **in CI e blocca il merge**, e verifica almeno: conformità allo schema, `kind` presente nel registro di AD-22, presenza della spiegazione in inglese, unicità degli identificatori derivati da AD-23, e coerenza fra `kanji` e `kana` di ogni frase (AD-21 richiede che siano allineabili).

  Lo schema è **una sola definizione**: il tipo TypeScript e il validatore a runtime derivano dalla stessa fonte, non da due elenchi che si scoprono disallineati alla prima lezione storta.

  **Un controllo resta fuori dalla CI, e per costruzione.** Il confronto anti-contaminazione fra il contenuto generato e il transcript di partenza (FR11.8) non può essere un cancello di integrazione continua, perché FR11.7 tiene il transcript fuori dal repository e la CI non ha nulla con cui confrontare. Vive in fase di autorazione, sulla macchina di chi autora. È l'unico anello della catena di qualità che non si chiude a valle, e va trattato come tale: documentato nella procedura, non dato per scontato.

  `[DA DECIDERE]` Come il contenuto raggiunge il client — righe di migrazione in Postgres, oppure JSON nel bundle — è la questione aperta OQ-8 del PRD. Impatta FR9.1 (precarico), il costo di pubblicare una correzione, e se `ContentRepository` abbia un adattatore Supabase o uno statico.

### AD-26 — Sbloccare una lezione materializza i suoi esercizi

- **Binds:** F3, F6, AD-5, FR6.2, FR6.4
- **Prevents:** una unità che rappresenta gli esercizi disponibili come righe e un'altra che li deriva dalle lezioni sbloccate — due conteggi diversi della stessa pila. È AD-19 trasposto sull'unità nuova
- **Rule:** sbloccare una lezione crea immediatamente una riga `review_state` per **ciascuno** dei suoi esercizi, con `stage = 0` e `due_at` = istante di sblocco, più una riga in `lesson_progress`. "Mai incontrato" significa **assenza di riga**.

  Ne discende, come in AD-19, che un esercizio sbloccato e non svolto resta dovuto il giorno dopo. Una lezione senza esercizi (FR2.4) produce la sola riga di `lesson_progress`: la progressione avanza, la pila non si muove, e la dashboard lo dichiara invece di sembrare rotta.

---

## 3. Stack e ambienti — delta

Due decisioni prese il 22 settembre, dopo il pivot, insieme all'owner.

**Il framework resta Vite più React, non diventa Next.** Valutata e scartata esplicitamente, perché la ragione della scelta va nel README (è una delle sette domande della traccia) e perché senza motivazione scritta è la prima cosa che un lettore successivo rimette in discussione.

Tre motivi, in ordine di peso:

1. **Non c'è niente da renderizzare sul server.** Ogni schermata sta dietro autenticazione e mostra dati personali. Nessun guadagno di SEO su contenuto privato, e nessun guadagno di primo paint, perché la sessione va comunque risolta prima di mostrare qualsiasi cosa. Le sole pagine pubbliche sono login, privacy e riconoscimenti.
2. **Introdurrebbe un secondo confine ortogonale al primo.** L'App Router separa server component da client component; `AD-1` separa `domain → data → ui → features → app`. Due sistemi di confini incrociati, con strumenti di verifica diversi, su un progetto il cui valore dimostrativo sta esattamente nell'averne **uno** solo, netto e imposto dal lint.
3. **Le API route sarebbero una porta aperta su `AD-11`**, che dichiara la Edge Function `delete-account` unico codice server del progetto — invariante appena riconfermato dal divieto di LLM a runtime (PRD §4).

  **Condizione che riapre la decisione:** se il prodotto decidesse di esporre i punti grammaticali come **pagine pubbliche indicizzabili** — acquisizione da ricerca invece che da link — allora la generazione statica di Next diventa la scelta corretta. È un cambio di prodotto che passa dal PRD, non una preferenza di infrastruttura.

**Un solo progetto Supabase cloud, non due.** Decisione dell'owner del 23 settembre, che modifica `AD-12` e `AD-13`.

Lo staging cloud esiste per provare una migrazione prima che tocchi i dati veri. Quella prova resta, ma su un'istanza **locale** effimera (`supabase start`, Docker) creata da zero a ogni run di CI: le migrazioni girano lì, i test e2e girano contro di essa, e la produzione le riceve solo dopo il merge.

Su due punti è **migliore** dello staging condiviso, ed è giusto dirlo invece di presentarla come un ripiego. `AD-13` chiedeva email univoche per run per impedire che run paralleli collidessero su un database condiviso: con un'istanza per run il problema sparisce alla radice, e la regola resta valida contro la produzione. E un'istanza creata da zero non può accumulare stato residuo, che è il modo in cui uno staging di lunga vita smette silenziosamente di somigliare alla produzione.

Su un punto è **peggiore**, e va dichiarato nel README invece che scoperto: i test e2e non esercitano la configurazione cloud reale — impostazioni di Auth, limiti di frequenza, policy applicate dalla console. Una differenza fra locale e produzione si scopre in produzione. È il prezzo di non amministrare un secondo progetto, ed è un prezzo scelto.

**L'hosting passa da Netlify a Vercel.** Decisione a basso costo e reversibile: cambia la tabella dello Stack, il diagramma della catena di deploy e i criteri della storia dell'URL pubblico. Nessun `AD` ne è toccato.

Motivo dirimente: mantiene senza costo l'opzione della condizione qui sopra. Conseguenze operative: serve un `vercel.json` con rewrite verso `index.html` perché il routing lato client regga i deep link (equivalente di `_redirects`); le variabili d'ambiente passano dai secrets Netlify a quelli Vercel — la convenzione "nessun `.env` versionato, `.env.example` documenta i nomi e mai i valori" resta identica. Il piano Hobby vieta l'uso commerciale, il che è compatibile con un progetto da portfolio ed è un limite dichiarato, non scoperto dopo.

La pausa a 7 giorni del piano gratuito resta un fatto di **Supabase**, indipendente dall'hosting, e la decisione di non contrastarla con un keep-alive è invariata.

---

## 4. Modello dati — delta

```
lesson                 -- contenuto, sola lettura  [posizione da decidere, OQ-8]
  id                   text pk          -- slug dal punto grammaticale (FR2.1a),
                                        -- mai dal numero di episodio della fonte
  ordinal              int not null unique   -- ordine di studio, interno
  title_en / title_it  text             -- descrive la grammatica, non l'episodio
  grammar_points       text[] not null

exercise               -- contenuto, sola lettura  [posizione da decidere, OQ-8]
  id                   uuid pk          -- uuidv5 dal contenuto (AD-23)
  lesson_id            text fk -> lesson
  kind                 text not null    -- vincolato al registro di AD-22
  payload              jsonb not null   -- forma dipendente da kind
  grammar_point        text not null    -- alimenta FR7.3
  explanation_en       text not null
  explanation_it       text null        -- ricade su en (FR8.5)

lesson_progress        -- NUOVA, per utente
  user_id              uuid fk -> auth.users, on delete cascade
  lesson_id            text fk -> lesson
  unlocked_at          timestamptz not null
  primary key (user_id, lesson_id)

review_state           -- chiave cambiata: exercise_id al posto di vocabulary_id
  user_id, exercise_id, stage, due_at, review_count, lapse_count, last_reviewed_at

review_log             -- append-only, + grammar_point (FR5.7)
  id, user_id, exercise_id, grammar_point, outcome, used_explanation, reviewed_at

user_settings
  user_id, locale, lessons_per_day int not null default 1   -- era new_items_per_day
```

**Sparisce:** `vocabulary`, e con essa la dipendenza da JMdict e il vincolo di attribuzione per schermata.

**Da notare su `review_log`:** `grammar_point` è denormalizzato dentro il log di proposito. Le statistiche di FR7.3 devono restare interrogabili anche dopo che un esercizio è stato riautorato e ha cambiato identità (AD-23): se il punto grammaticale vivesse solo su `exercise`, una riautorazione riscriverebbe la storia. AD-18 vuole che il log sia la fonte, e una fonte non può dipendere da dati mutabili.

---

## 5. Cosa questo documento non decide

Consegnato a `bmad-architecture` come agenda, non risolto qui:

1. **OQ-8 — dove vive il contenuto.** Postgres o bundle. Tocca `ContentRepository`, FR9.1, e il costo di pubblicare una correzione di contenuto.
2. **Il registro definitivo dei tipi di esercizio** (AD-22). Da chiudere dopo tre lezioni autorate davvero, non prima.
3. **La forma dello schema di lezione.** Discende da 2 e non la precede.
4. **Il contratto tastiera della schermata di esercizio** (AD-15 riscritto). Dipende da quanti e quali tipi esistono.
5. **Se la pipeline di autorazione sia una skill del repository, uno script, o un documento di procedura.** NFR9 chiede che regga 90 lezioni; quale forma lo garantisca è una scelta architetturale aperta.

I punti 2, 3 e 4 hanno una dipendenza comune, ed è la ragione per cui questo documento si ferma qui: **vanno decisi dopo aver visto contenuto vero**, non da un ragionamento a tavolino. Autorare le prime tre lezioni è il prossimo passo del progetto, non una conseguenza del piano.
