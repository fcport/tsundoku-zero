# Epic 2 Context: Il contratto dell'esercizio

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Questa epica definisce cos'è un esercizio come **dato validato e verificabile**, non come codice. Consegna il modello di dominio dell'esercizio: uno schema unico da cui derivano tipo TypeScript e validatore a runtime, un registro chiuso di tipi con i loro validatori puri, un'identità derivata dal contenuto che resiste alla riautorazione, e un cancello di validazione in CI che impedisce a una lezione malformata di raggiungere la produzione. È un contratto piccolo ma portante: l'applicazione non può esistere senza. Epic 3 lo *consuma* (presenta e risolve gli esercizi) e Epic 6 lo *produce* su scala (la pipeline di autorazione), ma qui l'esercizio semplicemente *esiste ed è verificabile*. Costruire prima il consumatore rende ovvio il contratto che il produttore dovrà soddisfare.

## Stories

- Story 2.1: Lo schema di una lezione
- Story 2.2: I tre tipi e i loro validatori
- Story 2.3: L'identità di un esercizio resiste alla riautorazione
- Story 2.4: Una lezione può non avere esercizi
- Story 2.5: Spiegazioni bilingui con ripiego dichiarato
- Story 2.6: La validazione blocca il merge
- Story 2.7: La lezione campione, che è anche una fixture

## Requirements & Constraints

- Il contenuto è distribuito come **lezioni versionate nel repository**, in sola lettura per gli utenti. Una lezione porta numero d'ordine, titolo, i punti grammaticali che insegna e zero o più esercizi.
- **Identità dal punto grammaticale.** Titolo e identificatore di una lezione derivano dal punto grammaticale insegnato, mai da numerazione, titolo o ordine di una fonte esterna.
- **Forma dell'esercizio.** Ogni esercizio espone: tipo, contenuto giapponese necessario a presentarlo, risposta corretta, distrattori quando il tipo li prevede, e una spiegazione che dice perché la risposta è quella.
- **Kanji e kana separati.** Ogni frase giapponese espone `kanji` e `kana` come stringhe distinte, così che la furigana sia derivabile nel dominio e i due campi siano allineabili.
- **Lezione senza esercizi ammessa.** Una lezione può avere zero esercizi e resta parte del curriculum; dichiara comunque i punti grammaticali che insegna, perché altre lezioni li riprendono e alimentano le statistiche.
- **Riautorazione non distruttiva.** Correggere o riautorare il contenuto non deve toccare il progresso dell'utente sugli esercizi che non sono cambiati sostanzialmente.
- **Registro chiuso.** Una lezione non può introdurre un tipo di esercizio che il dominio non dichiara. Aggiungere una *lezione* non richiede modifiche al codice; aggiungere un *tipo* le richiede, insieme al validatore e ai test.
- **Cancello di CI.** Un esercizio o una lezione malformati non raggiungono la produzione: la validazione blocca il merge.
- **Spiegazioni come contenuto.** Le spiegazioni vivono bilingui nel file di lezione, non passano da i18n. L'inglese è obbligatorio; l'italiano è facoltativo. In sua assenza si mostra l'inglese, dichiarando esplicitamente che la traduzione non c'è ancora, invece di far sembrare l'inglese la versione italiana.

## Technical Decisions

- **Schema unico come fonte di verità.** Tipo TypeScript e validatore a runtime derivano dalla **stessa** definizione, mai da due elenchi paralleli che si scoprono disallineati alla prima lezione storta.
- **Contenuto come dato, non codice.** Le lezioni sono file dati versionati in `content/lessons/`, conformi allo schema unico.
- **Registro dei tipi chiuso a tre**, come union discriminata che vive in `src/domain/exercise.ts`:
  - `single-select` — una consegna, *n* opzioni, una risposta (forma della chiusura, scelta della particella, quale frase è corretta, trasformazione).
  - `select-span` — si indica **una porzione della frase**; la correttezza si verifica sui **confini dei segmenti** prodotti dalla segmentazione della furigana, non su indici di carattere.
  - `assemble` — tessere da ordinare; la correttezza dipende dall'ordine. Non è una selezione singola: implica un'interazione di ordinamento.
  Un `kind` sconosciuto è un errore di validazione dello schema, non un caso ignorato a runtime.
- **Il tipo dice *come si risponde*, non *cosa si insegna*.** Cosa un esercizio esercita vive in `grammar_point`, mai nel tipo. Il tipo non deve duplicare la materia.
- **Ogni tipo porta tre cose e nessun'altra:** la forma dei suoi dati, un validatore puro `check(exercise, response): Outcome`, e i suoi test unitari (inclusi i casi limite).
- **Purezza del dominio.** `src/domain/exercise.ts` non importa React, Supabase, rete o orologio. L'ordine di distrattori e tessere è deterministico: nessun `Math.random()` sotto `src/domain/`.
- **Identità derivata dal contenuto.** `id = uuidv5(natural_key, NAMESPACE)`, dove la chiave naturale è costruita da tipo, frase e risposta corretta, normalizzata NFKC. Sono **esclusi** spiegazione e distrattori: correggere un refuso o riordinare i distrattori non cambia l'identità; cambiare la frase o la risposta corretta la cambia. Entrambe le direzioni vanno verificate da test, e una lezione riautorata senza modifiche sostanziali deve produrre identificatori identici ai precedenti.
- **Cosa valida la CI** (almeno): conformità allo schema, `kind` presente fra i tre del registro, presenza della spiegazione inglese, unicità degli identificatori, coerenza fra `kanji` e `kana` di ogni frase. Una PR che modifica `content/lessons/` fa girare questa validazione e un file malformato blocca il merge.
- **Sicurezza dei tipi.** TypeScript strict, nessun `any` nel codice applicativo.

## UX & Interaction Patterns

- **Ruolo tipografico per il giapponese di frase (`sentence-hero`).** Gli esercizi usano frasi intere, non parole singole, quindi serve un ruolo tipografico diverso da `word-hero`. Il ruolo è fissato altrove ma i suoi valori vanno **confermati sul rendering reale** con la frase più lunga della lezione campione (Story 2.7), e corretti prima che Epic 3 ci costruisca sopra.
- **Casi difficili obbligatori nella lezione campione:** una frase lunga, una con jukujikun, una con okurigana — perché mettono alla prova la segmentazione della furigana e il layout della frase.

## Cross-Story Dependencies

- **Story 2.7 è una fixture prima che contenuto.** La lezione campione copre tutti e tre i tipi e serve ai test di componente della sessione (Epic 3) e all'end-to-end (Epic 7) come contenuto reale, non sintetico. Deve passare lo schema di 2.1 e i controlli di 2.6.
- **Il validatore `select-span` dipende dalla segmentazione della furigana** (`alignFurigana()`): la correttezza si misura sui confini dei segmenti. Quella funzione appartiene al motore di dominio consegnato in Epic 3, quindi il validatore di 2.2 va coordinato con quella segmentazione.
- **Epic 3 consuma questo contratto** (union discriminata, `check()`), non lo ricostruisce: qui l'esercizio esiste ed è verificabile, là viene presentato e risolto.
- **Epic 6 produce lezioni conformi a questo schema** su scala; il contratto definito qui è ciò che la pipeline dovrà soddisfare.
- **Epic 5 dipende dal fatto che `grammar_point` sia dichiarato** su ogni esercizio (e anche sulle lezioni senza esercizi), perché le statistiche aggregano per punto grammaticale.
- **Story 2.1 abilita tutte le altre**: schema, tipi, identità e validazione derivano dalla forma dichiarata lì.
