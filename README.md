# Tsundoku Zero

積ん読ゼロ — svuotare la pila.

Un'app di ripetizione dilazionata per lo studio della grammatica giapponese N5,
open source e destinata al deploy pubblico. Il nome dichiara la metrica del
prodotto: gli esercizi in attesa di ripasso sono «la pila», e l'obiettivo
quotidiano è portarla a zero.

Il progetto ha due scopi, in ordine di priorità: uno strumento che l'autore usi
ogni giorno per studiare, e una base di codice React/TypeScript difendibile riga
per riga. Dopo il pivot dal vocabolario alla grammatica strutturale, l'unità di
studio non è più la parola ma l'esercizio grammaticale: una lezione dichiara i
propri punti grammaticali e porta zero o più esercizi di tre tipi di interazione
(`single-select`, `select-span`, `assemble`). Il resto dell'impianto — il motore
di scheduling puro, l'isolamento dei dati per utente, il confine architetturale —
è sopravvissuto intero al pivot.

Lo stack reale, dal `package.json`: React 19 + TypeScript in strict mode, Vite,
React Router, Zustand per lo stato UI, TanStack Query per lo stato server,
Supabase (Postgres, Auth, RLS), i18next per l'interfaccia bilingue, Vitest per i
test. La documentazione di dettaglio vive sotto `docs/`.

## Le due licenze

Il repository porta **due licenze distinte**, in due file separati:

- **`LICENSE`** — il **codice** dell'applicazione, sotto licenza **MIT**.
- **`LICENSE-CONTENT`** — il **contenuto** delle lezioni (i file dati sotto
  `content/lessons/`), sotto **Creative Commons Attribution-ShareAlike 4.0
  International** (`CC-BY-SA-4.0`).

Sono **separate**, e la separazione è deliberata. Codice e contenuto sono due
tipi di opera diversi, governati da famiglie di licenze diverse. La MIT è scritta
per il software — parla esplicitamente di «the Software» — e applicarla alle
lezioni sarebbe un errore di categoria: le lezioni sono opera creativa e
didattica, non codice. La CC BY-SA è scritta per le opere creative: impone
l'attribuzione (BY) e, con lo *share-alike* (SA), mantiene aperti i derivati.

La separazione è la conseguenza diretta del principio che governa l'autorazione
del contenuto: **il contenuto è aperto, la forma è chiusa** (vedi
`docs/authoring-pipeline.md`). Tenere le due licenze in due file distinti lascia
riusare il codice o il contenuto in modo indipendente, ciascuno alle proprie
condizioni, senza confondere quali termini valgono su cosa. Un solo file
mescolerebbe due regimi giuridici diversi.

## Perché Leitner e non SM-2 o FSRS

Il motore di scheduling parte da un sistema di Leitner modificato — stadi con
intervalli crescenti, `again` che riporta allo stadio 0, `good` che avanza di
uno, `easy` di due, `hard` che tiene lo stadio e riaccorcia l'intervallo — con un
jitter deterministico per evitare che gli esercizi scadano tutti insieme.

La scelta è **più semplice di SM-2 e più difendibile**, e adeguata alla scala del
progetto. SM-2 e FSRS ottimizzano la curva di dimenticamento su grandi volumi con
parametri stimati statisticamente; qui il valore non è nell'ottimizzazione ma in
un algoritmo che si legge, si spiega e si testa fino ai casi limite. Il confine
architetturale (sotto) rende la scelta reversibile: se un domani servisse SM-2 o
FSRS, cambierebbe **solo** il modulo di dominio, non il resto del sistema.

## Perché il livello di dominio non dipende dal framework

`src/domain/` contiene il motore di scheduling, la definizione di «dovuto», il
calcolo della serie (streak), il registro chiuso dei tipi di esercizio e il
calcolo dell'esito. Non conosce React, non conosce la rete, non conosce Supabase,
non legge l'orologio: il tempo è **iniettato come parametro**. Tutto il resto
dipende dal dominio; il dominio non dipende da nulla.

Questo è l'invariante più importante del progetto (AD-1), e non è affidato alla
disciplina: è **imposto dal lint**. `eslint-plugin-boundaries` dichiara i livelli
`domain → data → ui → features → app` e vieta ogni arco non ammesso; il dominio
non può importare alcun pacchetto esterno né toccare i global di piattaforma
(`fetch`, `localStorage`). Una violazione è un errore di lint, quindi CI rossa, e
`src/boundaries.test.ts` la verifica. La conseguenza pratica: la logica di
studio è pura e testabile senza mock, e swap dell'algoritmo o della UI restano
locali.

## Perché Supabase, e cosa cambierebbe a scala maggiore

Supabase (Postgres, Auth, Row Level Security) offre autenticazione e dati per
utente senza scrivere un server. L'app è un frontend statico: l'unico codice
server del progetto è una Edge Function per la cancellazione dell'account (AD-11).
L'isolamento dei dati è imposto da RLS su ogni tabella per utente ed è verificato
da un test, non assunto.

Il progetto usa **un solo progetto Supabase, quello reale**: sviluppo, CI ed e2e
girano tutti contro lo stesso database. Il vantaggio è che i test esercitano la
configurazione vera — le policy RLS come sono realmente applicate, le impostazioni
di Auth, i limiti del piano gratuito. Il costo, e cosa cambierebbe a scala
maggiore: i dati di studio reali vivono nello stesso database dei test, quindi le
migrazioni si applicano solo al merge su `main` e l'isolamento dei run di test
(email univoca per run, teardown via Edge Function) diventa una difesa portante
invece di semplice igiene. Con più utenti servirebbero ambienti separati
(staging e un database di test dedicato), un keep-alive o un piano a pagamento
contro la pausa del piano gratuito, e un percorso di migrazione che non tocchi i
dati di produzione da un ramo.

## Perché Vite e non Next

Il framework resta Vite più React, e Next è stato **valutato e scartato
esplicitamente**. Tre motivi, in ordine di peso:

1. **Non c'è niente da renderizzare sul server.** Ogni schermata sta dietro
   autenticazione e mostra dati personali: nessun guadagno di SEO su contenuto
   privato e nessun guadagno di primo paint, perché la sessione va comunque
   risolta prima di mostrare qualcosa. Le sole pagine pubbliche sono login,
   privacy e riconoscimenti.
2. **Introdurrebbe un secondo confine ortogonale al primo.** L'App Router separa
   server component da client component; AD-1 separa `domain → data → ui →
   features → app`. Due sistemi di confini incrociati, con strumenti di verifica
   diversi, su un progetto il cui valore dimostrativo sta nell'averne **uno** solo,
   netto e imposto dal lint.
3. **Le API route sarebbero una porta aperta su AD-11**, che dichiara la Edge
   Function di cancellazione come unico codice server del progetto.

La decisione si riapre solo con un cambio di prodotto: se i punti grammaticali
diventassero pagine pubbliche indicizzabili, la generazione statica di Next
sarebbe la scelta corretta. È una decisione che passa dal PRD, non una preferenza
di infrastruttura.

## Cosa è stato lasciato fuori, e perché

Il progetto è a scopo singolo e non punta a competere con Anki, WaniKani o
Bunpro. Sono stati esclusi in modo esplicito, per evitare che l'ambito si
gonfiasse: audio e text-to-speech, la pratica dell'ordine dei tratti dei kanji,
i mazzi creati dall'utente e l'import CSV, le funzioni sociali e le classifiche,
il login social/OAuth, le app mobile native, i livelli oltre l'N5.

Il pivot ha lasciato fuori anche il **vocabolario** come unità: sono spariti la
tabella `vocabulary`, la dipendenza da JMdict e con essa il vincolo di
attribuzione EDRDG su ogni schermata (diventato una pagina di riconoscimenti).
Tutto ciò che diventasse davvero necessario va a una v2 con una giustificazione
scritta, non aggiunto di soppiatto.

## Come è stato usato il flusso assistito da AI

L'AI è stata usata **in autorazione, mai a runtime**: l'app serve contenuto
statico già validato e non genera nulla in tempo reale. Il caso concreto è la
**pipeline di autorazione** (Epic 6), che trasforma il materiale della fonte —
transcript, sottotitoli — in file di esercizi conformi allo schema. Il confine
che la governa è quello fra **fatto e formulazione**: dal transcript si estrae il
fatto grammaticale e si riscrive da zero; la forma — le formulazioni, gli esempi,
le metafore didattiche della fonte — non attraversa la linea. Il dettaglio è in
`docs/authoring-pipeline.md` e nel runbook `docs/authoring-runbook.md`.

- **Cosa è stato delegato:** estrarre i fatti dal transcript e bozzare le frasi e
  le spiegazioni degli esercizi a partire da quei fatti, con l'LLM come assistente
  della sessione di autorazione.
- **Cosa è stato rifiutato:** riusare le formulazioni della fonte (parafrasare con
  i sinonimi resta opera derivata) e le sue metafore didattiche, anche solo come
  etichette; e l'LLM a runtime nel prodotto. Il progetto stesso ci era caduto una
  volta, correggendo una metafora con la terminologia linguistica standard, ed è
  documentato in `docs/authoring-pipeline.md`.
- **Dove è costato più tempo di quanto ne abbia risparmiato:** la **rilettura
  umana obbligatoria** prima di ogni commit, più il **controllo
  anti-contaminazione** (`npm run check-contamination`), che confronta ogni frase
  e spiegazione prodotta con il transcript e segnala le sovrapposizioni verbatim
  non banali (vedi `docs/contamination-check.md`).

Il **limite dichiarato** del controllo anti-contaminazione è la ragione per cui
questo flusso costa tempo umano: è l'unico anello della catena di qualità che
**non è un cancello di CI**. Il transcript della fonte è tenuto fuori dal
repository (`.gitignore`, `.authoring/` — Epic 6.1), quindi in CI non c'è nulla
con cui confrontare: aggiungerlo alla CI sarebbe un verde vuoto. Il controllo
vive perciò **in locale**, dentro la rilettura umana obbligatoria del runbook.
Ogni altro cancello — validazione del contenuto (`npm run validate-content`), lint
dei confini, typecheck, test — è imposto in CI e blocca il merge; questo no, per
costruzione. Il dettaglio, le soglie e come rispondere a una segnalazione sono in
`docs/contamination-check.md`.
