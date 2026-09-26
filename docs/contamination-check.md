# Il controllo anti-contaminazione (FR11.7, storia 6.3)

Il confine fra **fatto** e **formulazione** è documentato (`docs/authoring-pipeline.md`,
storia 6.1) e la procedura è scritta (`docs/authoring-runbook.md`, storia 6.2). Ma
fino alla storia 6.3 l'unica difesa contro la **contaminazione della fonte** era la
**rilettura umana** (passo 5 del runbook): dipendeva dall'attenzione dell'autore.
Questo documento descrive lo **strumento meccanico** che ora esiste — il controllo
che confronta ciò che è stato prodotto con il testo di partenza e segnala le
sovrapposizioni verbatim non banali.

Sul precedente durevole di `docs/authoring-pipeline.md` e `docs/authoring-runbook.md`,
è un documento con un test — `src/authoring-contamination.test.ts` — che ne verifica
meccanicamente sia il **nucleo** (segnala una sovrapposizione, assolve il contenuto
pulito) sia le **dichiarazioni** obbligatorie di questo file (il limite: non è un
cancello di CI, è l'unico anello non chiuso a valle).

## Cosa confronta (AC1)

Il controllo confronta, per ogni lezione sotto `content/lessons/`:

- **ogni frase giapponese** — `sentence.kanji` e `sentence.kana` di ogni esercizio;
- **ogni spiegazione** — `explanation.en` e `explanation.it` di ogni esercizio;
- il **titolo** della lezione (`title.en`, `title.it`) — pure prosa autorata dal
  concetto, soggetta allo stesso confine.

Li confronta con il testo del/dei **transcript** della cartella di lavoro `.authoring/`
e segnala ogni **sovrapposizione verbatim non banale**: un run condiviso ≥ soglia dopo
normalizzazione **NFKC**.

Il **nucleo di confronto è puro** (`scripts/lib/contamination.ts`): nessun I/O, nessun
`console`, nessun `process`. Il glob dei transcript, la lettura dei file e l'exit code
vivono nel **CLI** (`scripts/check-contamination.ts`), esattamente come `validateLessons`
(dominio puro) è separato dal suo runner `scripts/validate-content.ts`.

## Come si esegue

```
npm run check-contamination
```

- Legge i file-fonte **solo** sotto `.authoring/` (i file `*.txt`, `*.vtt`, `*.srt`,
  `*.transcript*`) e le lezioni sotto `content/lessons/`. La rete di sicurezza di 6.1
  è la **cartella**, non l'estensione: `.gitignore` esclude `.authoring/`
  **interamente**, quindi ogni file al suo interno resta fuori dal repo. Un `*.txt`
  **nudo fuori** da `.authoring/` **non** è git-ignorato — per questo i transcript
  vivono nella cartella di lavoro, ed è lì che il CLI li cerca.
- Uscita **0** se non resta alcuna sovrapposizione non motivata; **non-zero** se ne
  resta almeno una, **oppure** se non c'è alcun transcript da confrontare.
- **Nessun transcript ⇒ messaggio esplicito + exit non-zero.** Niente da confrontare
  significa **nulla verificato**, non un falso verde: metti il/i transcript della
  fonte in `.authoring/` (mai versionato, 6.1) e riesegui.

Percorsi non predefiniti:
`npm run check-contamination -- <transcriptDir> <lessonsDir>`. L'allowlist è cercata
**accanto ai transcript**, in `<transcriptDir>/contamination-allowlist.json`: una
transcriptDir personalizzata **sposta anche** la ricerca dell'allowlist (non resta
ancorata a `.authoring/`).

## «Non banale»: le soglie

Il giapponese non ha spazi, quindi «verbatim» è un run di **caratteri** contigui
(dopo NFKC e strip di spazi/punteggiatura). La prosa (en/it) usa n-gram di **parole**
consecutive. Le soglie sono **costanti dichiarate e tarabili** in
`scripts/lib/contamination.ts`:

| Costante | Significato | Valore attuale |
|---|---|---|
| `MIN_JA_RUN` | caratteri giapponesi contigui minimi per segnalare | 8 |
| `MIN_PROSE_WORDS` | parole consecutive minime (prosa) per segnalare | 6 |

Come i trenta minuti della storia 6.4, la soglia è una **stima da tarare**
sull'esperienza reale, non una verità: troppo bassa segnala coincidenze (una
particella, una locuzione comune), troppo alta lascia passare frasi copiate quasi
intere. Si riporta il run **massimale**, per non moltiplicare i sotto-run.

**Attenzione al ritaraggio.** Il match dell'allowlist è **esatto** sulla forma
normalizzata che il controllo stampa: cambiare `MIN_JA_RUN`/`MIN_PROSE_WORDS` può
allungare o accorciare gli `span` segnalati e quindi **invalidare** le voci di
allowlist già scritte (uno span più corto non combacia più). Dopo un ritaraggio,
riesegui il controllo e **ricopia lo span appena stampato** in ogni voce
interessata. Il controllo aiuta a scoprirlo: una voce di allowlist il cui `span` non
combacia più con alcuna sovrapposizione è segnalata come **AVVISO di voce
inutilizzata** su stderr (non fa fallire, ma indica un refuso o una voce stale da
correggere).

## Rispondere a una segnalazione (AC2)

Una sovrapposizione segnalata si **riscrive prima del commit**: si torna al **fatto**
(`docs/authoring-pipeline.md`) e si riformula ex novo la frase o la spiegazione.

L'unica alternativa è **motivarla per iscritto**, e solo se è un **esempio canonico
pubblico** (una frase d'esempio standard, non l'espressione della fonte). La
motivazione è **meccanica**: una voce di allowlist con `reason` **non vuota**
riclassifica la sovrapposizione come «motivata» e non fa fallire il controllo. Una
`reason` **vuota non la sopprime**: la segnalazione resta un fallimento. Non si può
zittire una segnalazione svuotando il campo — si può solo motivarla.

L'allowlist è il file `contamination-allowlist.json` accanto ai transcript
(`.authoring/contamination-allowlist.json` con la cartella di default; nella
transcriptDir passata altrimenti), **non versionato**. È un array JSON di
`{ "span": "…", "reason": "…" }`, dove `span` è la forma normalizzata **esatta** che
il controllo ha stampato per la sovrapposizione. Una voce con `reason` non vuota il
cui `span` non combacia con alcuna sovrapposizione è segnalata come **AVVISO di voce
inutilizzata** (refuso o voce stale): non fa fallire, ma va corretta.

## Collocazione e limite (AC4)

**Questo controllo non può essere un cancello di CI.** Confronta il contenuto prodotto
con il **transcript** della fonte, che la storia 6.1 tiene **fuori dal repository**
(`.gitignore`, `.authoring/`): in CI il transcript è **assente**, quindi non c'è nulla
da confrontare. Aggiungerlo alla CI (`.github/workflows/ci.yml`) sarebbe un verde
vuoto, perciò per costruzione resta **fuori**.

È l'**unico anello** della catena di qualità che **non si chiude a valle**. Ogni altro
controllo — il cancello di validazione del contenuto (`npm run validate-content`,
FR2.6), il lint dei confini (AD-1), il typecheck, i test — è imposto in CI e blocca il
merge. Questo no: si esegue in **locale**, durante la **revisione umana obbligatoria**
del runbook (passo 5), contro la cartella di lavoro privata dell'autore. La sua
esistenza non lo rende automatico: resta un passo che l'operatore **deve** eseguire, e
il runbook lo cabla come tale.

## Audit retroattivo (AC3)

Il controllo si applica **retroattivamente** a ogni lezione autorata **prima** che il
controllo esistesse — in primis alla lezione campione della storia 2.7,
`content/lessons/01-la-particella-wo.json`. L'esito di ciascun audit è registrato qui.

L'esecuzione richiede il **transcript di partenza** di quella lezione, che è input
**privato** (assente dal repository per 6.1, e assente da questo working tree: nessuna
`.authoring/`). Lo **strumento** è costruito, provato e documentato da questa storia;
l'**esecuzione** contro il transcript privato e la **registrazione dell'esito reale**
sono dovute all'**operatore** (la storia si finalizza a `awaiting-operator`).

| Lezione | Autorata prima del controllo | Transcript disponibile | Esito | Azione |
|---|---|---|---|---|
| `content/lessons/01-la-particella-wo.json` | sì (storia 2.7) | no (privato, non nel working tree) | **da verificare** | operatore: eseguire `npm run check-contamination` contro il transcript privato della lezione campione; riscrivere le eventuali sovrapposizioni o motivarle nell'allowlist; registrare qui l'esito reale (data + verdetto) |

Quando l'operatore esegue il controllo, sostituisce la riga «da verificare» con
l'esito effettivo: **pulito** (nessuna sovrapposizione non motivata) oppure l'elenco
delle sovrapposizioni riscritte/motivate, con la data.

`content/lessons/01-la-particella-wo.json` è al momento l'**unica** lezione sotto
`content/lessons/`, quindi questa tabella è **completa** per lo stato attuale del
repository. Ogni nuova lezione autorata **prima** di un eventuale ritaraggio delle
soglie va aggiunta qui con il proprio esito.
