# La sostenibilità della pipeline (NFR9, M5, DoD — storia 6.4)

L'epica 6 ha costruito il **confine con la fonte** (`docs/authoring-pipeline.md`,
storia 6.1), il **runbook** operativo (`docs/authoring-runbook.md`, storia 6.2) e
il **controllo meccanico anti-contaminazione** (`docs/contamination-check.md`,
storia 6.3). Manca l'**accettazione dell'epica**: esaminare quella procedura
contro i requisiti che la governano — il costo di autorazione (`NFR9`), il tempo
di autorazione (`M5`) e la Definition of Done del PRD §11 (**almeno cinque**
lezioni autorate, revisionate e validate) — e registrarne lo stato reale.

Sul precedente durevole di `docs/authoring-runbook.md` e `docs/contamination-check.md`,
è un documento con un test — `src/authoring-cost.test.ts` — che ne verifica
meccanicamente le dichiarazioni obbligatorie: **àncora** l'analisi al runbook (una
riga per ciascun passo; se il runbook guadagna o perde un passo, il test è rosso
finché l'analisi non lo copre) e **al contenuto reale** (le lezioni esistenti
validano, e il contatore della DoD non può mentire in silenzio).

## Analisi NFR9 (AC1)

`NFR9` chiede che la pipeline di F11 **regga un corso di durata indefinita senza
degradare**: nessun passaggio **manuale** il cui costo cresca con il numero di
lezioni **già autorate** (chiamiamolo `N`). Il requisito è deliberatamente
indipendente dal totale delle lezioni, che **non è noto** e continuerà a crescere:
la verifica è quindi contro un corso di **lunghezza non fissata**, non contro un
totale prestabilito.

Esaminiamo la procedura **reale** — gli otto passi di `docs/authoring-runbook.md` —
uno per uno. Per ciascuno: è fatica **manuale** dell'autore o **calcolo
automatico** di un comando? E come cresce il suo costo al crescere di `N`?

<!-- Manutenzione: ogni riga della tabella qui sotto deve iniziare con `| N —`, dove
`N` è il numero di un passo `### N.` di docs/authoring-runbook.md. Il test
src/authoring-cost.test.ts estrae i numeri di passo dal runbook e pretende copertura
ESATTA: una riga per passo, né più né meno. Se il runbook guadagna o perde un passo,
aggiorna questa tabella per tenere i due formati in sincrono. -->

| Passo | Manuale? | Costo in N | Perché |
|---|---|---|---|
| 1 — Prerequisiti e cartella di lavoro | manuale (una volta) + automatico | O(1) manuale; O(N) automatico | Preparare l'ambiente è O(1). `npm ci`/`npm test` ri-processano tutto ma sono **automatici**: calcolo, non fatica manuale. |
| 2 — Estrarre i fatti dal transcript | manuale | O(1) per lezione | L'autore legge **una** fonte e ne estrae i fatti; la lezione è indicizzata **per concetto**, non per episodio (6.1), quindi non deve consultare né riordinare le N lezioni precedenti. La scelta di `order` è la **prossima posizione libera**: O(1). |
| 3 — Autorazione assistita da un LLM (dai fatti) | manuale | O(1) per lezione | Comporre esercizi **da questo fatto** non richiede di rileggere le N lezioni esistenti. L'assistenza dell'LLM è solo in autorazione, mai a runtime. |
| 4 — Comporre il file `content/lessons/NN-<concetto>.json` | manuale | O(1) per lezione | Si scrive **un** file JSON per la lezione corrente; l'identità (`lessonId`) deriva **solo** dal punto grammaticale primario, non da un numero da coordinare con le altre. |
| 5 — Revisione umana obbligatoria (prima del commit) | manuale + automatico | O(1) manuale; O(N) automatico | L'autore rilegge **la lezione appena scritta**, non le N precedenti: O(1). `npm run check-contamination` confronta il **contenuto** con il transcript e ri-processa tutte le lezioni, ma è **calcolo automatico** su contenuto minuscolo. |
| 6 — Cancello di validazione | automatico | O(N) automatico | `npm run validate-content` valida **tutte** le N lezioni (le regole di unicità di `order`/`lessonId`/identità sono cross-file, quindi devono vederle tutte). È calcolo automatico: l'unicità la **impone il cancello**, non l'autore. |
| 7 — Rendere la lezione disponibile all'app | automatico | O(N) automatico | `npm run generate-content-seed` rigenera il seed da tutte le N lezioni. Automatico: un comando, nessuna fatica manuale che cresca. |
| 8 — Generare l'audio delle frasi | automatico + manuale | O(N) automatico; O(1) manuale | `npm run generate-audio` scorre tutte le frasi ma salta quelle che hanno già l'audio: genera solo le nuove. L'autore ascolta **le frasi nuove** e quelle con la lettura corretta dai kana, non le N lezioni precedenti: O(1). |

**Verdetto NFR9.** **Nessun passaggio manuale** ha un costo che cresce col numero
di lezioni già autorate: la fatica dell'autore per aggiungere una lezione resta
**O(1)** — estrarre i fatti da una fonte, autorare da quei fatti, comporre un file,
rileggerlo — verificato contro un corso di **lunghezza non nota / non fissata**. I
passi che scalano con `N` (`npm test`, `npm run check-contamination`,
`npm run validate-content`, `npm run generate-content-seed`, `npm run generate-audio`) ri-processano tutte
le `N` lezioni a ogni esecuzione — è **calcolo automatico** O(N) su contenuto
minuscolo, **non** fatica manuale, e **non** viola `NFR9`.

Il punto sottile: senza la scelta «**indicizzare per concetto, non per episodio**»
(6.1), autorare la lezione N-esima costringerebbe l'autore a coordinare `order` e
identità con le N-1 esistenti — un costo manuale O(N). L'indicizzazione per
concetto lo azzera: l'autore prende la **prossima posizione libera** per `order` e
l'unicità di `order`/`lessonId`/identità la **impone automaticamente** il cancello
(`src/domain/content-validation.ts`), non l'autore a mano. È questa scelta a tenere
O(1) il costo manuale anche là dove l'O(N) sarebbe sembrato inevitabile.

## Tempo di autorazione M5 (AC2)

`M5` è la **metrica di sostenibilità** del progetto: il tempo per autorare una
lezione completa, **dalla visione all'esercizio giocabile**, deve essere ≤ **30
minuti**. Come le soglie del controllo anti-contaminazione (8 caratteri / 6 parole,
`docs/contamination-check.md`), i **30 minuti** sono una **stima da tarare**
sull'esperienza reale, non una verità: è la soglia dichiarata dal PRD, da
confermare o correggere una volta misurata.

**Cosa si misura** (metodologia):

- **Inizio della misura:** l'autore comincia a **guardare la fonte** della lezione
  (il transcript / la sessione da studiare).
- **Fine della misura:** l'esercizio è **giocabile** — la lezione è composta,
  ha passato la revisione umana obbligatoria, il cancello `npm run validate-content`
  è verde, il seed è rigenerato (passo 7) e la lezione è **committata**.
- **Unità:** una riga di registrazione **per lezione**. Si annota il tempo reale
  cronometrato di quell'esecuzione, non una stima.

**Nessun tempo è inventato.** Nessuna misura reale è ancora stata eseguita: farla
richiede di guardare la fonte e cronometrare un'esecuzione completa del flusso —
un'azione **umana** fuori dal repository, dovuta all'operatore. La tabella parte
quindi con una riga **da misurare**.

| Lezione | Inizio (guardare la fonte) | Fine (esercizio giocabile/committato) | Tempo reale | Entro i 30 min? |
|---|---|---|---|---|
| `01-il-soggetto-con-ga` (が + le tre forme del predicato) | 28-09-2026 15:00:55 | 28-09-2026 15:09:00 | **8 min 05 s** | sì, con ampio margine |

**Cosa comprende questa misura, e cosa no.** Cronometro avviato all'apertura del
transcript, fermato quando tutti i cancelli erano verdi: fatti estratti, tre esercizi
autorati (uno per `kind`), span di `select-span` verificati sui segmenti reali di
`alignFurigana`, `npm run validate-content` verde, seed rigenerato, suite verde.

**NON comprende il passo 5**, la rilettura umana obbligatoria di `FR11.2`: quella non è
delegabile e va cronometrata a parte dall'owner, che aggiunge il proprio tempo a questa
riga. Gli 8 minuti sono quindi il costo *assistito*, non il costo totale — e vanno letti
così, non spacciati per il tempo pieno.

**Due costi incontrati che non erano previsti dal runbook**, e che vale la pena
registrare perché li pagherà ogni lezione futura:

1. `select-span` può selezionare **solo confini di segmento**, e `alignFurigana` riduce
   una frase intera a due segmenti (nucleo con kanji + coda in kana). Isolare una parola
   *dentro* la frase non è esprimibile: la frase va scelta perché il segmento 0 coincida
   con ciò che si vuole far selezionare. Verificarlo richiede di calcolare i segmenti
   prima di scrivere l'esercizio, non dopo.
2. Cambiare il contenuto obbliga a rigenerare il seed e ad aggiornare la sentinella del
   conteggio. Entrambi i passi sono già nel runbook (6 e 7) e sono **imposti da un test**,
   quindi non si possono dimenticare — ma vanno contati nel tempo.

**Il debito che la prima lezione ha pagato, e che la seconda non pagherà.** Oltre agli
8 minuti di autorazione, la prima lezione vera ha fatto emergere tre difetti latenti
della pipeline, costati circa quaranta minuti in più. Non sono costo per-lezione: sono
debito una volta sola, e vanno tenuti distinti dalla misura di `M5` invece di gonfiarla.

1. **Il seed cancellava la migrazione precedente.** Un test pretendeva «esattamente un
   seed committato», ma la cronologia delle migrazioni è append-only: `supabase db push`
   fallisce se un file già applicato sparisce dal repository. Sarebbe stato un intervento
   manuale sulla cronologia in produzione **a ogni cambio di contenuto**. Ora i seed si
   accumulano e il controllo anti-deriva guarda il più recente.
2. **Il collaudo e2e era legato al nome di un file.** Cercava una tessera della lezione
   campione; appena il curriculum ha avuto la sua prima lezione vera, si è rotto. Ora
   sceglie la lezione come la sceglie il dominio: `order` minimo.
3. **Il seed aggiornava senza rimuovere.** Correggere una frase cambia l'identità
   dell'esercizio (`AD-23`), quindi la versione sbagliata restava nel database a fianco
   di quella corretta — misurato: 4 esercizi per una lezione che ne ha 3. Ora il seed
   riconcilia.

Tutti e tre avrebbero colpito **ogni** lezione successiva, e tutti e tre violavano
`NFR9` allo stesso modo: un costo manuale che cresce col numero di lezioni già autorate.
Sono stati trovati perché la prima lezione vera è stata portata fino in produzione, non
fermandosi ai test verdi in locale.

Quando l'operatore misura le lezioni successive, aggiunge una riga per ciascuna. Solo
con più righe si vede se `M5` regge o va ritarata: il punto di `NFR9` è che la decima
riga non sia più lenta della seconda.

## Definition of Done (AC3)

La Definition of Done del PRD §11 chiede **almeno cinque** lezioni autorate,
revisionate e giocabili; l'**obiettivo è undici**, pari a quelle già viste
dall'owner. Questo è il traguardo dell'epica di contenuto.

<!-- authored-lessons: 17 -->
<!-- dod-status: met -->

**Stato reale.** Il repository contiene al momento **17** file di lezione sotto
`content/lessons/`, tutti **validi** contro il cancello di Epic 2
(`validateLessons` → `[]`):

- **16 lezioni di curriculum**, `order` da 1 a 16, una per ciascuno dei primi sedici transcript
  della cartella di lavoro. Il dettaglio — quanti esercizi ha ogni lezione, per tipo, e
  da quale transcript sono stati estratti i fatti — è in `docs/content-inventory.md`.
- `content/lessons/01-la-particella-wo.json` — `order: 900`, la lezione campione della
  storia 2.7. Vive nella **fascia riservata 900+** perché nasce come fixture dei test e
  la sua posizione nel curriculum è provvisoria: quando arriverà la lezione vera su を
  va **sostituita**, non affiancata (avrebbero lo stesso `lessonId`). La lezione 2 del
  curriculum esercita を come punto secondario, ma il suo punto primario è il pronome
  zero: i due file non collidono.

**Verdetto DoD:** il traguardo delle cinque lezioni è **raggiunto**, e anche l'obiettivo
di undici. Le lezioni dalla 2 alla 13 sono però state autorate con l'assistenza di un LLM
e sono state pubblicate **senza la rilettura umana obbligatoria** del passo 5 del runbook
(`FR11.2`): il 28-09-2026 l'owner ha rinunciato esplicitamente a farla, per la lunghezza.
Al suo posto c'è stata una **rilettura indipendente eseguita da un secondo LLM**, che ha
trovato cinque errori reali (un distrattore corretto, quattro spiegazioni imprecise) e tre
casi dubbi, tutti corretti prima del commit. È una difesa più debole di quella prevista:
chi incontra un esercizio sbagliato in queste lezioni sa da dove viene. Il conteggio misura
i file validi, non la rilettura. Il verdetto è tenuto
onesto da una seconda sentinella machine-readable — `<!-- dod-status: … -->` — che il
test **accoppia al conteggio reale**: finché le lezioni sono meno di cinque vale
`below-target`; quando si raggiungono le cinque va portata a `met`. Così il verdetto
non può restare stantio — un doc che dichiarasse `below-target` con cinque o più
lezioni (o `met` con meno) renderebbe il test **rosso** — senza vincolare la prosa
umana, libera di spiegare entrambi gli stati. La sentinella è distinta dalla prosa
proprio perché la spiegazione qui nomina entrambi gli stati.

Il conteggio qui sopra è tenuto **onesto** da una forcing function: la sentinella
machine-readable `<!-- authored-lessons: N -->` è confrontata dal test con il numero
reale di file `*.json` sotto `content/lessons/`. Aggiungere una lezione senza
aggiornare questo numero (o viceversa) rende il test **rosso**: il tracker della DoD
non può mentire in silenzio.

Il test **non** asserisce `N ≥ 5` (sarebbe rosso ora, e un agente non può renderlo
verde autorando lezioni): il traguardo ≥ 5 resta **prosa dichiarata** e azione
dovuta all'operatore. Ciò che il test prova meccanicamente è che le lezioni
**esistenti validano** (guardia anti-vacuità) e che il contatore è **allineato** al
contenuto reale.

## Collocazione e limite

Questa storia è l'**accettazione documentale** dell'epica 6, non un altro strumento.
Costruisce e prova tutto ciò che un agente può produrre:

- l'**analisi NFR9** (AC1) — l'esame passo per passo del runbook e il verdetto;
- la **metodologia e la tabella di misura** di `M5` (AC2);
- il **tracciamento della DoD** (AC3) — il traguardo, la sentinella e lo stato reale;
- il **test-ancora** `src/authoring-cost.test.ts`, che tiene onesto tutto quanto sopra.

Due parti dipendono da **esecuzione umana fuori dal repository** e sono quindi
**dovute all'operatore** (la storia si finalizza a `awaiting-operator`, non a
`blocked`), sul modello dell'audit retroattivo di `docs/contamination-check.md`:

- **Misurare il tempo reale** `M5` (AC2): guardare la fonte e cronometrare
  un'esecuzione completa del flusso — un agente non può guardare la fonte.
- **Autorare, rileggere e committare ≥ 4 lezioni ulteriori** (AC3): committare
  contenuto di corso richiede la **rilettura umana obbligatoria** (FR11.2, passo 5
  del runbook), che per progetto **non è delegabile a un agente** — coerente con lo
  `Never` della storia 6.2. L'unica prova sul contenuto che un agente costruisce è
  che le lezioni **esistenti** validano.

Questo documento chiude l'analisi che il runbook (`docs/authoring-runbook.md`)
rende eseguibile: quello dice **come** si autora una lezione, questo dice **perché**
il costo di farlo N volte non degrada e **dove** siamo rispetto al traguardo.
