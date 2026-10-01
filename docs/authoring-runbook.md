# Il runbook di autorazione (FR11.1–FR11.2)

Questo documento è il **flusso operativo** che trasforma una lezione appena
studiata dalla fonte in un file di esercizi conforme allo schema di Epic 2. È
scritto per essere **eseguito leggendolo**: chi non l'ha mai fatto — un terzo, o
l'owner fra sei mesi — segue gli otto passi qui sotto e produce una lezione valida
senza chiedere aiuto. Sul precedente durevole di `docs/authoring-pipeline.md` e
`docs/i18n-boundary.md`, è un documento con un test (`src/authoring-runbook.test.ts`)
che ne verifica meccanicamente le dichiarazioni obbligatorie e che l'esempio
incluso passi davvero il cancello di validazione.

Il **confine con la fonte** — cosa si estrae dal transcript e cosa no — è di
`docs/authoring-pipeline.md`: questo runbook lo dà per letto e lo rinvia lì.
Qui si stabilisce **come si lavora**, non dove passa la linea. Lo **strumento
meccanico di confronto anti-contaminazione** è arrivato con la storia 6.3
(`npm run check-contamination`, documentato in `docs/contamination-check.md`): il
passo 5 lo cabla nella revisione umana, che resta comunque obbligatoria.

## In una frase

Dai **fatti** estratti dal transcript, si autorano gli esercizi **assistiti da un
LLM** (solo in autorazione, mai a runtime), si compone `content/lessons/NN-<concetto>.json`,
si fa una **revisione umana obbligatoria** prima del commit, e si passa il
**cancello** `npm run validate-content`, poi si genera l'audio delle frasi con
`npm run generate-audio`. Aggiungere una lezione **non tocca il
codice**: si crea o si edita solo un JSON sotto `content/lessons/` (più il suo audio in
`public/audio/`), mai `src/` né
lo schema.

## Gli otto passi

### 1. Prerequisiti e cartella di lavoro

- Ambiente pronto: `npm ci` e `npm test` verde sul checkout corrente.
- Gli appunti privati della sessione — transcript, sottotitoli, trascrizioni —
  vivono nella **cartella di lavoro dell'autore** `.authoring/`, esclusa dal
  repository (`.gitignore`, protetto da `src/source-boundary.test.ts`). Nulla di
  ciò che c'è dentro `.authoring/` entra mai nel prodotto o nel repository.
- Il modello già in repo di una lezione ben formata è `content/lessons/01-la-particella-wo.json`:
  tienilo aperto come riferimento alla forma dei tre tipi.

### 2. Estrarre i fatti dal transcript

Leggi il materiale della fonte e **estrai i fatti**, mai le formulazioni: quale
punto grammaticale, qual è la regola, quale confusione risolve. Le regole
anti-contaminazione — si estrae il **fatto** e si riscrive da zero, la parafrasi
coi sinonimi resta opera derivata, le metafore didattiche della fonte non si
riusano — sono in `docs/authoring-pipeline.md`. Leggile lì: sono l'invariante
che governa tutto ciò che segue.

**Indicizza la lezione per concetto grammaticale**, mai per numero, titolo o
ordine dell'episodio della fonte. Il nome del file è `NN-<concetto>.json`, dove
`NN` è la posizione nel curriculum (`order`) e `<concetto>` uno slug del punto
grammaticale — non un numero di puntata. L'identificatore della lezione
(`lessonId`, che deriva da `grammarPoints[0]` via `deriveLessonId`) dipende
**solo** dal punto grammaticale primario, mai da `order` o `title`: è impossibile,
per costruzione, autorare l'id da un numero della fonte.

### 3. Autorazione assistita da un LLM (dai fatti)

L'autorazione degli esercizi è **assistita da un LLM**, e **solo in autorazione**:
l'LLM aiuta a comporre le frasi e le spiegazioni durante questa sessione, ma non
compare **mai a runtime** — l'app serve contenuto statico già validato, non
genera nulla in tempo reale.

Vincoli che l'LLM (e chi lo pilota) deve rispettare:

- **Parte dai fatti, non dalla fonte.** Le frasi degli esercizi sono **inventate**
  a partire dal fatto grammaticale, non prese o ritoccate dal transcript.
- **Terminologia linguistica standard.** Usa i nomi standard dei fenomeni
  (soggetto, tema, particella, verbo, copula, aggettivo in い): mai le metafore
  o le immagini didattiche della fonte, nemmeno riformulate (vedi
  `docs/authoring-pipeline.md`).
- **Rispetta lo schema.** Ogni esercizio è uno dei **tre tipi** del registro
  chiuso (passo 4). Un `kind` fuori dai tre non esiste.
- **Comprensibile a chi la fonte non l'ha mai vista.** La spiegazione (`explanation.en`)
  spiega il fatto da sola, senza presupporre la lezione della fonte.

### 4. Comporre il file `content/lessons/NN-<concetto>.json`

Il file è un oggetto JSON con la forma seguente. La **fonte unica** della forma è
`src/domain/lesson.ts` e `src/domain/exercise.ts`; qui la si riporta campo per
campo perché tu possa scrivere il file senza aprirli.

**Campi della lezione** (`src/domain/lesson.ts`):

| Campo | Forma | Obbligatorio | Note |
|---|---|---|---|
| `order` | intero ≥ 1 | sì | posizione nel curriculum; **unico** fra tutte le lezioni (passo 6) |
| `title` | `{ "en": string, "it"?: string }` | sì (`en`) | testo bilingue; `en` non vuoto, `it` facoltativo. Prosa autorata dal concetto, mai dal titolo/numero della fonte |
| `video` | stringa: id YouTube di **11 caratteri** (`A-Z a-z 0-9 _ -`) | no | l'id del video di riferimento della lezione, **mai l'URL** (`dwcTI9qvO-U`, non `https://youtu.be/dwcTI9qvO-U`). L'app ne fa un semplice link che apre YouTube: il video non è mai incorporato. Va subito dopo `title`; **unico** fra tutte le lezioni (passo 6) |
| `grammarPoints` | array **non vuoto** di stringhe non vuote | sì | i punti grammaticali che la lezione insegna; il **primo** dà l'identità della lezione |
| `exercises` | array (può essere **vuoto**) di esercizi | sì | zero o più; una lezione senza esercizi è valida (dichiara comunque i `grammarPoints`) |

**Campi comuni a ogni esercizio** (`src/domain/exercise.ts`):

| Campo | Forma | Note |
|---|---|---|
| `kind` | uno dei tre letterali | discriminante: `"single-select"` \| `"select-span"` \| `"assemble"` |
| `grammarPoint` | stringa non vuota | **deve essere fra i `grammarPoints`** dichiarati dalla lezione (regola oltre-schema, passo 6) |
| `sentence` | `{ "kanji": string, "kana": string }` | entrambi non vuoti; `kana` è la **lettura** e **non deve contenere kanji** (regola oltre-schema) |
| `explanation` | `{ "en": string, "it"?: string }` | testo bilingue; `en` obbligatorio non vuoto |
| `showFurigana` | booleano | facoltativo; assente ⇒ furigana **visibile** |

I **tre tipi** del registro chiuso e la forma del loro `answer`:

- **`single-select`** — una consegna, *n* opzioni, una risposta.
  - `answer`: **stringa** non vuota (l'unica opzione corretta).
  - `distractors`: array **non vuoto** di stringhe non vuote (le opzioni sbagliate).
- **`select-span`** — si indica **una porzione** della frase sugli indici dei
  segmenti di furigana.
  - `answer`: `{ "start": intero ≥ 0, "end": intero ≥ 0 }` con **`end` > `start`**
    (intervallo semiaperto `[start, end)`). Sono indici di **segmento**, non di
    carattere. Nessun `distractors`.
- **`assemble`** — tessere da ordinare.
  - `answer`: array **non vuoto** di stringhe non vuote, nella **sequenza corretta**.
    Nessun `distractors`.

**Regole oltre-schema che il cancello impone** (`src/domain/content-validation.ts`),
oltre alla forma sopra:

1. **`kana` senza Han**: il campo `kana` di ogni frase non contiene ideogrammi
   (kanji) — una lettura con un kanji dentro non è una lettura.
2. **`grammarPoint` dichiarato**: il `grammarPoint` di ogni esercizio è fra i
   `grammarPoints` della lezione. (Il contenimento è in una sola direzione: un
   punto dichiarato e non ancora esercitato non è un errore.)
3. **Unicità cross-file di `order`**: due lezioni non possono rivendicare la
   stessa posizione nel curriculum.
4. **Unicità cross-file degli identificatori**: `lessonId` (derivato da
   `grammarPoints[0]`) e l'identità di ogni esercizio sono unici fra tutti i
   file.
5. **Unicità cross-file del `video`**: due lezioni non possono rimandare allo
   stesso video (quasi sempre è un copia-incolla sbagliato). Le lezioni senza
   `video` non concorrono al controllo.

L'**identità di un esercizio** (`src/domain/exercise-identity.ts`) deriva da
**tipo + frase (kanji e kana) + risposta corretta**, normalizzati NFKC; esclude
la spiegazione, i distrattori e il `grammarPoint`. Conseguenza pratica: correggere
un refuso nella spiegazione o riordinare i distrattori **non** crea un doppione,
mentre cambiare la frase o la risposta corretta produce un esercizio nuovo.

### 5. Revisione umana obbligatoria (prima del commit)

**Nessun esercizio raggiunge il repository senza essere stato riletto da un
umano.** Questa revisione umana è **obbligatoria** e viene **prima del commit**:
non è un passo saltabile. La difesa contro la contaminazione della fonte ha ora
**due strati**: la rilettura umana (sotto) e, a partire dalla storia 6.3, il
**controllo meccanico** `npm run check-contamination`. Il controllo meccanico
resta **fuori dalla CI** perché il transcript non è nel repository (è l'unico
anello che non si chiude a valle — `docs/contamination-check.md`), quindi va
eseguito **qui**, in locale, come parte di questa revisione obbligatoria.

Prima, esegui il **controllo meccanico** contro la tua cartella di lavoro:

```
npm run check-contamination
```

Confronta ogni frase giapponese e ogni spiegazione prodotte con il/i transcript
sotto `.authoring/` e segnala le **sovrapposizioni verbatim non banali**. Uscita
**0** ⇒ nessuna sovrapposizione non motivata. Uscita **non-zero** ⇒ o c'è una
sovrapposizione (riscrivila dal fatto, o motivala se è un esempio canonico
pubblico), **oppure** non c'è alcun transcript da confrontare (niente da
confrontare ⇒ nulla verificato: **non** è un verde). Cosa confronta, le soglie e
come rispondere a una segnalazione sono in `docs/contamination-check.md`.

Poi, la checklist della rilettura, un esercizio alla volta:

- [ ] **Leggi ogni esercizio** dall'inizio: la consegna è chiara, la risposta
      corretta è davvero corretta, i distrattori sono plausibili ma sbagliati.
- [ ] **Confine anti-contaminazione** (il controllo meccanico della storia 6.3 lo
      verifica ora, ma la rilettura resta): nessuna frase, formulazione, esempio o
      metafora viene dalla fonte. Le frasi sono inventate dal fatto; la
      terminologia è quella standard (vedi `docs/authoring-pipeline.md`).
- [ ] **Verifica i fatti**: la regola grammaticale insegnata è corretta e la
      spiegazione la descrive fedelmente.
- [ ] **Titolo e concetto**: `title` e `grammarPoints` descrivono il concetto,
      non il numero o il titolo dell'episodio della fonte.

Solo dopo che il controllo meccanico è verde e questa rilettura è fatta
l'esercizio può essere committato.

### 6. Cancello di validazione

Esegui il cancello di Epic 2:

```
npm run validate-content
```

Deve uscire **verde** (exit 0). Lo stesso comando è **imposto in CI**
(`.github/workflows/ci.yml`): un file malformato dà exit non-zero e **blocca il
merge**. Il cancello verifica la forma dello schema (i tre tipi, i campi
obbligatori) più le regole oltre-schema del passo 4 (`kana` senza Han,
`grammarPoint` dichiarato, unicità di `order` e degli identificatori).

Una lezione conforme passa il cancello **senza alcun intervento manuale sullo
schema**: l'autore **non tocca il codice** — non modifica `src/`, non modifica lo
schema, non modifica il validatore. Se il cancello segnala un problema, si
corregge il **JSON della lezione**, non il codice. Aggiungere una lezione è
un'operazione di solo contenuto.

### 7. Rendere la lezione disponibile all'app

Rigenera il seed del contenuto:

```
npm run generate-content-seed
```

Questo produce la migrazione Supabase (`supabase/migrations/<timestamp>_seed_content.sql`)
da tutto ciò che c'è in `content/lessons/`, così la nuova lezione raggiunge il
client. Il comando rivalida prima di scrivere: se il contenuto non è conforme,
fallisce e non genera nulla.

> **Non cancellare i seed precedenti.** La cronologia delle migrazioni è append-only:
> `supabase db push` confronta i file locali con la tabella `schema_migrations` del
> progetto remoto e **fallisce** se una migrazione già applicata sparisce dal
> repository — «Remote migration versions not found in local migrations directory» —
> e recuperare richiede di riparare a mano la cronologia in produzione. I seed si
> accumulano: ciascuno è un upsert idempotente, quindi applicarli in sequenza converge
> sullo stato dell'ultimo. Il controllo anti-deriva confronta il contenuto con il seed
> **più recente**, non con «l'unico».

### 8. Generare l'audio delle frasi

Ogni frase degli esercizi ha il suo audio, che lo studente ascolta dopo aver
risposto. Una lezione nuova, o una frase cambiata, va quindi sempre accompagnata
dal suo audio, generato così:

1. Apri **VOICEVOX** (gratuito, https://voicevox.hiroshiba.jp/): il motore
   ascolta su `http://127.0.0.1:50021`. Serve anche `ffmpeg` nel PATH
   (`winget install ffmpeg`).
2. Esegui:

   ```
   npm run generate-audio
   ```

   Genera un MP3 per ogni frase in `public/audio/` con la voce **No.7, stile
   アナウンス** (id 30), sempre la stessa per tutto il corso. Salta le frasi che
   hanno già l'audio e cancella quello delle frasi che non esistono più. Il nome
   del file è l'hash della frase in kanji (`src/domain/sentence-audio.ts`):
   cambiare una frase cambia il file.
3. Leggi il resoconto finale. Per ogni frase lo script confronta la lettura che
   VOICEVOX userebbe con il `kana` scritto a mano: se non coincidono (降りません
   letto おりません, 日本 letto にっぽん), rifà l'audio partendo dai kana e lo
   elenca fra le **letture corrette**. Se nemmeno dai kana la lettura coincide, la
   frase è elencata come **ANCORA SBAGLIATA**, il suo audio non viene generato e il
   comando esce con errore: si corregge il `kana` se era sbagliato, altrimenti si
   riformula la frase.
4. Ascolta almeno le frasi nuove e quelle corrette, poi committa `public/audio/`
   insieme alla lezione.

Il test `src/sentence-audio-files.test.ts` (in CI) fallisce se una frase non ha
il suo audio o se resta l'audio di una frase tolta: dimenticare questo passo
blocca il merge.

L'audio **non** è coperto dalla CC BY-SA del contenuto: segue le condizioni della
voce No.7 (uso non commerciale, credito «VOICEVOX:No.7»), come dichiarato in
`LICENSE-CONTENT`. Non cambiare voce senza aggiornare il credito e la licenza.

## Esempio completo

Quello che segue è una lezione **valida**, prodotta seguendo questo flusso: fatti
grammaticali liberi (la distinzione fra il tema marcato da は e il soggetto
marcato da が), frasi **inventate**, **terminologia linguistica standard**, i tre
tipi del registro chiuso. È racchiusa fra sentinelle stabili: il test
`src/authoring-runbook.test.ts` la estrae e la passa a `validateLessons`
**insieme al contenuto reale** di `content/lessons/`, provando che passa il
cancello di Epic 2 come sarebbe effettivamente aggiunta (unicità cross-file
inclusa). Serve da **template**, non è contenuto di corso (non vive sotto
`content/lessons/` e non conta verso la Definition of Done della storia 6.4).

`order: 901` è solo illustrativo. **Le posizioni da 900 in su sono riservate** a ciò
che non fa parte del curriculum: esempi di documentazione e lezioni che servono da
fixture ai test. Il corso supera le novanta lezioni, quindi un valore-sentinella a due
cifre prima o poi collide con una lezione vera — e il cancello del passo 6 lo
rifiuterebbe al momento peggiore, cioè quando stai autorando.

Oggi in quella fascia c'è `content/lessons/01-la-particella-wo.json` (`order: 900`):
nasce come fixture della storia 2.7 e la sua posizione nel curriculum è provvisoria.
Quando arriverà la lezione vera su を, quel file va **sostituito**, non affiancato:
i due avrebbero lo stesso `lessonId` (derivato da `grammarPoints[0]`) e il cancello
lo segnalerebbe.

Nella tua lezione usa la **prossima posizione libera** del curriculum, perché `order`
è **unico** fra tutte le lezioni (passo 6).

<!-- BEGIN worked-example -->
```json
{
  "order": 901,
  "title": {
    "en": "Topic は versus subject が",
    "it": "Il tema は contro il soggetto が"
  },
  "grammarPoints": ["主題を示す「は」", "主語を示す「が」"],
  "exercises": [
    {
      "kind": "single-select",
      "grammarPoint": "主語を示す「が」",
      "sentence": {
        "kanji": "誰が来ましたか",
        "kana": "だれがきましたか"
      },
      "answer": "が",
      "distractors": ["は", "を", "に"],
      "explanation": {
        "en": "In a question asking which person performs the action, the subject is new information, so it is marked by the subject particle が rather than the topic particle は.",
        "it": "In una domanda su quale persona compie l'azione, il soggetto è informazione nuova, quindi è marcato dalla particella soggetto が e non dalla particella tema は."
      }
    },
    {
      "kind": "select-span",
      "grammarPoint": "主題を示す「は」",
      "sentence": {
        "kanji": "象は鼻が長い",
        "kana": "ぞうははながながい"
      },
      "answer": { "start": 0, "end": 1 },
      "explanation": {
        "en": "The topic marked by は sets the frame of the sentence: 象は (as for the elephant). The comment then predicates about it with its own subject 鼻が. Select the topic phrase at segment index 0.",
        "it": "Il tema marcato da は fissa la cornice della frase: 象は (quanto all'elefante). Il commento predica poi con il proprio soggetto 鼻が. Seleziona la frase-tema all'indice di segmento 0."
      }
    },
    {
      "kind": "assemble",
      "grammarPoint": "主語を示す「が」",
      "sentence": {
        "kanji": "空が青いです",
        "kana": "そらがあおいです"
      },
      "answer": ["空", "が", "青い", "です"],
      "explanation": {
        "en": "が marks 空 (the sky) as the subject of the い-adjective predicate 青い. Order the tiles so the subject phrase precedes the adjective and its polite copula です.",
        "it": "が marca 空 (il cielo) come soggetto del predicato aggettivo in い 青い. Ordina le tessere così che la frase-soggetto preceda l'aggettivo e la sua copula cortese です."
      }
    }
  ]
}
```
<!-- END worked-example -->

Nota sull'esempio: ogni esercizio porta un `grammarPoint` che è **fra i
`grammarPoints`** della lezione (`"主語を示す「が」"` per il primo e il terzo,
`"主題を示す「は」"` per il secondo) — la regola oltre-schema è rispettata perché
ogni `grammarPoint` d'esercizio coincide con uno dei due dichiarati. Rileggendo,
verifica che sia davvero così: un `grammarPoint` che la lezione non dichiara è un
issue del cancello.

## Accettazione: sostenibilità della pipeline

Questo runbook dice **come** si autora una lezione. Perché il costo di ripetere il
flusso non degradi al crescere del corso (`NFR9`), quanto deve costare in tempo
(`M5`) e dove siamo rispetto al traguardo di contenuto della Definition of Done
(almeno cinque lezioni) sono l'analisi di accettazione dell'epica 6, in
`docs/authoring-cost.md` (storia 6.4).
