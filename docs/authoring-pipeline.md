# Il confine con la fonte nella pipeline di autorazione (FR11.7)

Il contenuto degli esercizi nasce leggendo il materiale della fonte — transcript,
sottotitoli, trascrizioni delle lezioni. Quel materiale è **opera protetta**: serve
da input privato alla sessione di autorazione, ma non entra nel prodotto né nel
repository. Questo documento fissa il **confine fra fatto e formulazione** che
governa l'intera pipeline, sul precedente durevole di `docs/i18n-boundary.md`: un
file di documentazione con un test — `src/source-boundary.test.ts` — che ne verifica
esistenza e contenuti.

Copre solo il confine con la fonte. La **procedura operativa** della sessione di
autorazione è il runbook `docs/authoring-runbook.md` (storia 6.2); lo **strumento
meccanico di confronto anti-contaminazione** — che confronta il contenuto prodotto
con il transcript e segnala le sovrapposizioni verbatim — è `npm run check-contamination`,
descritto in `docs/contamination-check.md` (storia 6.3). Qui si stabilisce dove
passa la linea, non come si lavora.

## La linea in una frase

**Il contenuto è aperto, la forma è chiusa.** Le idee grammaticali — il pronome
zero, la funzione di が e は, le tre forme di chiusura della frase — sono fatti
linguistici e metodi didattici: insegnarli è libero. La loro **espressione
specifica** — le formulazioni, gli esempi originali, le metafore didattiche — è
opera protetta. Dal transcript si attraversa la linea in una sola direzione: si
prende il fatto, si lascia la forma.

## I tre principi anti-contaminazione

### 1. Dal transcript si estraggono fatti, mai formulazioni

Leggere un'opera protetta per impararne il contenuto è l'atto per cui l'opera
esiste, non un atto rilevante per il diritto d'autore. Da un transcript si estrae il
**fatto** — quale punto grammaticale, qual è la regola, quale confusione risolve — e
da quel fatto si **riscrive da zero**. Non si parte dalla frase della fonte per
ritoccarla: si parte dal fatto e si formula ex novo.

### 2. Parafrasare con i sinonimi resta opera derivata

Riscrivere la spiegazione di qualcun altro cambiando le parole con i loro sinonimi
**non** attraversa la linea: resta opera derivata, e il fatto che suoni diverso non
cambia nulla. La strada corretta non è allontanarsi dalla formulazione originale un
sinonimo alla volta, ma **partire dal fatto** e non dalla formulazione.

### 3. Le metafore didattiche della fonte non si riusano

La distinzione più sottile, e quella su cui si sbaglia in buona fede. Il *fatto* che
una frase giapponese si chiuda in tre modi è grammatica, libera. Il **modo in cui la
fonte lo insegna** — le sue immagini, le sue metafore — è espressione creativa sua, e
non si riusa, nemmeno riformulato. Si usa la terminologia linguistica standard, che
è a rischio zero e in un esercizio è anche più chiara: non richiede di conoscere la
metafora per capire la domanda.

## L'esempio concreto: il caso in cui ci eravamo caduti

Il progetto stesso ci era caduto, e la correzione è nella sua storia (PRD §2, commit
`c618164`). Il PRD, per nominare le tre forme di chiusura della frase, usava la
parola **«motori»**. Non è terminologia linguistica: è la **metafora didattica della
fonte** — la frase come un treno, con un vagone, un gancio, un motore. Riusarla, anche
solo come etichetta, era riusare la sua espressione.

La correzione è stata sostituire la metafora con la terminologia standard:

| Formulazione della fonte (metafora, protetta) | Terminologia standard (fatto, libera) |
|---|---|
| il «motore» del predicato verbale | **verbo** |
| il «motore» della copula | **copula** (だ) |
| il «motore» dell'aggettivo | **aggettivo in い** |

Il fatto — che una frase si chiuda in tre modi: predicato verbale, copula, aggettivo
in い — è rimasto intatto, perché è grammatica. È caduta solo la forma con cui la
fonte lo veste. E in un esercizio la terminologia standard è anche più chiara: chi
non ha mai visto la metafora del treno capisce lo stesso la domanda.

Per questo, per costruzione, **gli esempi di questo documento usano solo
terminologia linguistica standard**: un doc che dichiara di non riusare le metafore
della fonte non può ricommettere l'errore che documenta.

## La cartella di lavoro dell'autore

I transcript e gli appunti privati della sessione di autorazione vivono in
`.authoring/`, la **cartella di lavoro dell'autore**. Il suo contenuto è input
privato e **non entra nel repository**: `.authoring/` è escluso in `.gitignore`
insieme a transcript, sottotitoli e trascrizioni (`*.transcript`, `*.transcript.txt`,
`*.vtt`, `*.srt`, `transcripts/`, `.transcripts/`). L'esclusione non è affidata alla
disciplina: è **protetta meccanicamente** dal test di igiene `src/source-boundary.test.ts`,
che verifica sia i pattern di `.gitignore` sia che un transcript nella cartella di
lavoro risulti effettivamente non tracciabile. Toglierla è CI rossa, non un'esposizione
silenziosa della fonte.
