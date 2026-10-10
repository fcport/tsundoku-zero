# Inventario del contenuto

Quanti esercizi ha ogni lezione, divisi per tipo, e da quale transcript della
cartella di lavoro `.authoring/transcripts/` sono stati estratti i fatti. È il
registro da aggiornare ogni volta che si aggiunge o si modifica una lezione
(passo 4 di `docs/authoring-runbook.md`).

La tabella è tenuta onesta da `src/content-inventory.test.ts`: ogni file sotto
`content/lessons/` deve avere **una** riga, con i conteggi uguali a quelli reali, e
la riga dei totali deve tornare. Aggiungere una lezione, o un esercizio, senza
aggiornare questa tabella rende il test rosso, e il messaggio dice quale riga
scrivere.

La colonna **Transcript** è l'unica che il test non può verificare: i transcript
non entrano nel repository (`docs/authoring-pipeline.md`), quindi in CI non c'è
nulla con cui confrontarla. Il nome del transcript è un'annotazione di
provenienza per l'autore, **non** l'identità della lezione: quella deriva solo dal
punto grammaticale (`grammarPoints[0]`).

## Lezioni

<!-- Manutenzione: una riga per file, nella forma
| order | `file.json` | transcript | single-select | select-span | assemble | totale |
Il test estrae le righe che iniziano con `| <numero> | \`...json\`` e le confronta
con il contenuto reale. -->

| Order | File | Transcript | single-select | select-span | assemble | Totale |
|---:|---|---|---:|---:|---:|---:|
| 1 | `01-il-soggetto-con-ga.json` | `lezione-01` | 6 | 5 | 6 | 17 |
| 2 | `02-il-pronome-zero.json` | `lezione-02` | 6 | 5 | 5 | 16 |
| 3 | `03-il-tema-con-wa.json` | `lezione-03` | 6 | 5 | 5 | 16 |
| 4 | `04-i-tempi-del-verbo.json` | `lezione-04` | 8 | 8 | 8 | 24 |
| 5 | `05-gruppi-verbali-e-forma-te.json` | `lezione-05` | 5 | 4 | 4 | 13 |
| 6 | `06-modificare-i-nomi.json` | `lezione-06` | 6 | 6 | 6 | 18 |
| 7 | `07-la-negazione.json` | `lezione-07` | 12 | 5 | 7 | 24 |
| 8 | `08-radicali-e-ausiliari.json` | `lezione-08` | 11 | 5 | 8 | 24 |
| 9 | `09-la-particella-ni.json` | `lezione-09` | 11 | 9 | 10 | 30 |
| 10 | `10-la-particella-de-e-to.json` | `lezione-10` | 6 | 6 | 6 | 18 |
| 11 | `11-ga-con-sentimenti-e-desideri.json` | `lezione-11` | 6 | 6 | 6 | 18 |
| 12 | `12-la-forma-potenziale.json` | `lezione-12` | 7 | 6 | 6 | 19 |
| 13 | `13-forma-te-kureru-ageru.json` | `lezione-13` | 6 | 6 | 6 | 18 |
| 14 | `14-citare-con-to-e-verbi-composti.json` | `lezione-14` | 7 | 7 | 5 | 19 |
| 15 | `15-il-passivo.json` | `lezione-15` | 8 | 5 | 5 | 18 |
| 16 | `16-avverbi-e-la-particella-mo.json` | `lezione-16` | 9 | 6 | 5 | 20 |
| 900 | `01-la-particella-wo.json` | — (fixture dei test) | 1 | 1 | 1 | 3 |

<!-- inventory-total: 315 -->

**Totale: 315 esercizi** in 17 file — 121 `single-select`, 95 `select-span`,
99 `assemble`. La lezione `order: 900` è la fixture della storia 2.7, fuori dal
curriculum (fascia riservata 900+, `docs/authoring-runbook.md`).

## Transcript ancora da lavorare

`lezione-NN` è il video in posizione NN della playlist «Japanese From Scratch»
(`PLg9uYxuZf8x_A-vcqqyOFZu06WlhnypWj`); l'elenco posizione → id → titolo è in
`.authoring/playlist.txt`. La playlist ha 93 video: i transcript da `lezione-17`
a `lezione-93` sono pieni (sottotitoli inglesi scritti a mano, scaricati il
09-10-2026) e aspettano di essere autorati; da `lezione-94` a `lezione-99` sono
**vuoti** (0 byte) perché nella playlist non c'è un video corrispondente. Quando
una lezione viene autorata, la si aggiunge alla tabella sopra.
