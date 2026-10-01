# Tsundoku Zero

積ん読ゼロ — svuotare la pila.

**[tsundokuzero.federicocasadei.dev](https://tsundokuzero.federicocasadei.dev)**

Esercizi di grammatica giapponese per accompagnare, lezione per lezione, le
lezioni video di [Cure Dolly](https://www.youtube.com/channel/UCkdmU8hGK4Fg3LghTVtKltQ).
Sto studiando giapponese con [30 Day Japanese](https://learnjapanese.moe/routine/)
di TheMoeWay, che per la grammatica consiglia proprio quelle lezioni: sono
ottime, ma di esercizi per accompagnarle ce ne sono pochissimi, e quello che
non si esercita si dimentica. Così, man mano che vado avanti, aggiungo qui le
lezioni e ne scrivo gli esercizi, perché chiunque possa usarli.

Il nome è la metrica del prodotto: gli esercizi da ripassare sono «la pila», e
l'obiettivo di ogni giorno è portarla a zero. Il progetto è indipendente: non è
affiliato a Cure Dolly né a TheMoeWay, e gli esercizi sono originali.

## Come funziona

- **Lezioni.** Ogni lezione corrisponde a un video e dichiara i suoi punti
  grammaticali. Gli esercizi sono di tre tipi: scegliere la risposta giusta
  (`single-select`), indicare una parte della frase (`select-span`), comporre una
  frase con delle tessere (`assemble`). Ogni risposta ha la sua spiegazione.
- **La pila.** Quando sblocchi una lezione, i suoi esercizi entrano nella pila.
  La lezione successiva si sblocca solo a pila vuota, con un tetto giornaliero
  regolabile nelle impostazioni.
- **Ripetizione dilazionata.** Ogni esercizio ha un livello, e il livello decide
  fra quanti giorni torna:

  | Livello    | 0      | 1        | 2        | 3        | 4         | 5         |
  | ---------- | ------ | -------- | -------- | -------- | --------- | --------- |
  | Torna dopo | subito | 1 giorno | 3 giorni | 7 giorni | 16 giorni | 35 giorni |

  Una risposta giusta sale di un livello. Giusta ma con la spiegazione aperta
  resta al suo livello, con un intervallo più corto. Una risposta sbagliata
  torna a zero e si rifà subito. Dopo una risposta giusta data senza spiegazione
  c'è anche **Facile**, che sale di due livelli: è per le cose che vengono senza
  pensarci.
- **Alle 2 di notte.** Le scadenze cadono all'inizio della giornata di studio,
  le 2 locali: la pila si riempie tutta insieme e non cresce durante il giorno.
- **Fuori dalla pila.** Dalla pagina Lezioni si rivede il video e si ripassa
  liberamente una lezione già sbloccata; c'è anche un allenamento sulle forme del
  verbo. Nessuno dei due tocca la pila.
- Furigana e traduzioni si accendono e spengono dal dorso della pagina;
  l'interfaccia è in italiano e in inglese.

## Lo stack

React 19 e TypeScript in strict mode, Vite, React Router, Zustand per lo stato
dell'interfaccia, TanStack Query per lo stato server (con una coda di risposte
che sopravvive alla chiusura dell'app e alla rete assente), Supabase (Postgres,
Auth, Row Level Security), i18next, Tailwind. Test con Vitest e Playwright.
Deploy su Vercel.

```
src/domain/     la logica di studio, pura: scheduling, «dovuto», esito, furigana, streak
src/data/       gli adattatori verso Supabase, dietro le porte del dominio
src/ui/         i primitivi di interfaccia e il sistema di design
src/features/   le schermate
src/app/        il montaggio: rotte, guardie, porte
content/lessons/  le lezioni e i loro esercizi, un file JSON per lezione
supabase/       migrazioni e la Edge Function di cancellazione dell'account
docs/           la documentazione di dettaglio
```

## Sviluppo in locale

Serve Node 20.19 o più recente e un progetto Supabase.

```sh
npm ci
cp .env.example .env   # poi riempi VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

| Comando                       | Cosa fa                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `npm test`                    | i test unitari e di integrazione (Vitest)                               |
| `npm run lint`                | ESLint, compresi i confini fra i livelli                                |
| `npm run typecheck`           | TypeScript senza emettere                                               |
| `npm run validate-content`    | valida le lezioni sotto `content/lessons/` contro lo schema             |
| `npm run generate-content-seed` | genera la migrazione di seed del contenuto                            |
| `npm run check-contamination` | confronta gli esercizi con il transcript della fonte (solo in locale)   |
| `npm run test:e2e`            | il percorso completo in un browser vero, contro Supabase                |

Le migrazioni non si applicano a mano: le applica la CI al merge su `main`
(`.github/workflows/migrate.yml`), e su una pull request vengono solo validate.

## Le due licenze

Il repository porta **due licenze distinte**, in due file separati:

- **`LICENSE`** — il **codice** dell'applicazione, sotto licenza **MIT**.
- **`LICENSE-CONTENT`** — il **contenuto** delle lezioni (i file sotto
  `content/lessons/`), sotto **Creative Commons Attribution-ShareAlike 4.0
  International** (`CC-BY-SA-4.0`).

Sono separate di proposito. La MIT è scritta per il software, e applicarla alle
lezioni sarebbe un errore di categoria: le lezioni sono opera didattica, non
codice. La CC BY-SA è scritta per le opere creative: chiede l'attribuzione e,
con lo *share-alike*, mantiene aperti i derivati. Due file distinti permettono di
riusare il codice o il contenuto in modo indipendente, ciascuno alle sue
condizioni. È la conseguenza del principio che governa la scrittura degli
esercizi: **il contenuto è aperto, la forma è chiusa** (vedi
`docs/authoring-pipeline.md`).

## Perché Leitner e non SM-2 o FSRS

Lo scheduling è un sistema di Leitner modificato: sei livelli con intervalli
crescenti, `again` che riporta a zero, `good` che sale di uno, `easy` di due,
`hard` che tiene il livello e accorcia l'intervallo. Le scadenze cadono alle 2
di notte nel fuso dello studente, con una dispersione deterministica di qualche
giorno sugli intervalli lunghi, così i ripassi non si ammucchiano tutti nello
stesso giorno.

È **più semplice di SM-2 e più difendibile**, e adeguato alla scala del progetto.
SM-2 e FSRS ottimizzano la curva dell'oblio su grandi volumi con parametri
stimati statisticamente; qui il valore sta in un algoritmo che si legge, si
spiega e si testa fino ai casi limite, cambio dell'ora compreso. Il confine
architetturale rende la scelta reversibile: passare a SM-2 o FSRS cambierebbe
**solo** il modulo di dominio.

## Perché il dominio non dipende dal framework

`src/domain/` contiene lo scheduling, la definizione di «dovuto», la serie di
giorni di studio, il registro dei tipi di esercizio e il calcolo dell'esito. Non
conosce React, la rete o Supabase, e non legge l'orologio: il tempo e il fuso
orario **entrano come parametri**. Tutto il resto dipende dal dominio; il
dominio non dipende da nulla.

L'invariante non è affidata alla disciplina: è **imposta dal lint**.
`eslint-plugin-boundaries` dichiara i livelli `domain → data → ui → features →
app` e vieta ogni arco non ammesso; il dominio non può importare pacchetti
esterni né toccare `fetch` o `localStorage`. Una violazione è CI rossa, e
`src/boundaries.test.ts` la verifica. Così la logica di studio si testa senza
mock, e cambiare algoritmo o interfaccia resta una modifica locale.

## Perché Supabase, e cosa cambierebbe a scala maggiore

Supabase dà autenticazione e dati per utente senza scrivere un server. L'app è
un frontend statico: l'unico codice server è la Edge Function che cancella
l'account. L'isolamento dei dati è imposto dalla Row Level Security su ogni
tabella per utente, e un test lo verifica.

C'è **un solo progetto Supabase, quello reale**: sviluppo, CI ed e2e girano
contro lo stesso database. Il vantaggio è che i test esercitano la
configurazione vera. Il costo è che i dati di studio reali stanno accanto a
quelli dei test: le migrazioni si applicano solo al merge su `main`, e ogni run
di test usa un utente con email univoca che cancella alla fine. Con più utenti
servirebbero un ambiente di staging e un database di test separato, un piano
che non vada in pausa, e un percorso di migrazione che non tocchi i dati di
produzione da un ramo.

## Perché Vite e non Next

Next è stato **valutato e scartato**, per tre motivi:

1. **Non c'è niente da renderizzare sul server.** Quasi tutto sta dietro
   l'accesso e mostra dati personali; le uniche pagine pubbliche sono l'accesso,
   «Come funziona?», la privacy e i riconoscimenti.
2. **Aggiungerebbe un secondo sistema di confini.** Server e client component si
   incrocerebbero con i livelli del dominio, con strumenti di verifica diversi,
   in un progetto che vale proprio per averne **uno** solo, imposto dal lint.
3. **Le API route aprirebbero una seconda porta sul server**, dove oggi c'è solo
   la Edge Function di cancellazione.

La decisione si riapre solo se cambia il prodotto: se i punti grammaticali
diventassero pagine pubbliche da indicizzare, la generazione statica di Next
sarebbe la scelta giusta.

## Cosa è stato lasciato fuori, e perché

Il progetto ha uno scopo solo e non vuole competere con Anki, WaniKani o Bunpro.
Sono esclusi di proposito: audio e sintesi vocale, l'ordine dei tratti dei
kanji, i mazzi creati dall'utente e l'import CSV, le funzioni social e le
classifiche, l'accesso con account esterni, le app native, e il **vocabolario**
come unità di studio (il progetto è partito da lì e ha cambiato strada verso la
grammatica). Se qualcosa diventasse davvero necessario, entra con una
giustificazione scritta, non di soppiatto.

## Come è stata usata l'AI

L'AI è usata **per scrivere il contenuto, mai a runtime**: l'app serve esercizi
statici già validati e non genera nulla al momento. La **pipeline di
scrittura** parte dal transcript di una lezione e arriva a un file di esercizi
conforme allo schema. Il confine che la governa è quello fra **fatto e
formulazione**: dal transcript si prende il fatto grammaticale e lo si riscrive
da zero; le frasi, gli esempi e le metafore della fonte non passano. Il dettaglio
è in `docs/authoring-pipeline.md` e `docs/authoring-runbook.md`.

- **Delegato:** estrarre i fatti dal transcript e bozzare frasi e spiegazioni a
  partire da quei fatti.
- **Rifiutato:** riusare le formulazioni della fonte (una parafrasi coi sinonimi
  resta opera derivata) e le sue metafore didattiche, anche solo come etichette;
  e qualsiasi modello linguistico dentro il prodotto.
- **Dove costa più tempo di quanto ne risparmi:** la **rilettura umana
  obbligatoria** prima di ogni commit e il **controllo anti-contaminazione**
  (`npm run check-contamination`), che segnala le sovrapposizioni letterali fra
  gli esercizi e il transcript (vedi `docs/contamination-check.md`).

Il limite dichiarato del controllo anti-contaminazione è che
**non è un cancello di CI**: il transcript resta fuori dal repository (`.gitignore`, `.authoring/`),
quindi in CI non ci sarebbe niente con cui confrontare, e un controllo lì
sarebbe un verde vuoto. Vive in locale, dentro la rilettura umana. Tutti gli
altri controlli (validazione del contenuto, confini, tipi, test) bloccano il
merge in CI; questo no, per costruzione.

## Autore

Federico Casadei — [federicocasadei.dev](https://federicocasadei.dev) ·
[GitHub](https://github.com/fcport)
