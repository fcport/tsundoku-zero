# Content inventory

How many exercises each lesson has, by kind, and which transcript in the
`.authoring/transcripts/` working folder the facts were taken from. It is the
record to update every time a lesson is added or changed (step 4 of
`docs/authoring-runbook.md`).

The table is kept honest by `src/content-inventory.test.ts`: every file under
`content/lessons/` must have **one** row, with counts equal to the real ones, and
the totals row must add up. Adding a lesson, or an exercise, without updating this
table turns the test red, and the message says which row to write.

The **Transcript** column is the only one the test cannot check: transcripts do
not enter the repository (`docs/authoring-pipeline.md`), so in CI there is nothing
to compare it with. The transcript name is a provenance note for the author,
**not** the lesson's identity: that comes only from the grammar point
(`grammarPoints[0]`).

## Lessons

<!-- Maintenance: one row per file, in the form
| order | `file.json` | transcript | single-select | select-span | assemble | total |
The test extracts the rows that start with `| <number> | \`...json\`` and compares
them with the real content. -->

| Order | File | Transcript | single-select | select-span | assemble | Total |
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
| 17 | `17-coppie-di-verbi.json` | `lezione-17` | 12 | 4 | 4 | 20 |
| 18 | `18-temiru-ya-kara-sugiru.json` | `lezione-18` | 10 | 4 | 5 | 19 |
| 19 | `19-parlare-in-modo-cortese.json` | `lezione-19` | 12 | 4 | 5 | 21 |
| 900 | `01-la-particella-wo.json` | — (test fixture) | 1 | 1 | 1 | 3 |

<!-- inventory-total: 375 -->

**Total: 375 exercises** in 20 files — 155 `single-select`, 107 `select-span`,
113 `assemble`. The `order: 900` lesson is the fixture from story 2.7, outside the
curriculum (reserved range 900+, `docs/authoring-runbook.md`).

## Transcripts still to work through

`lezione-NN` is the video at position NN of the "Japanese From Scratch" playlist
(`PLg9uYxuZf8x_A-vcqqyOFZu06WlhnypWj`); the position → id → title list is in
`.authoring/playlist.txt`. The playlist has 93 videos: the transcripts from
`lezione-20` to `lezione-93` are full (hand-written English subtitles, downloaded
on 09-10-2026) and waiting to be authored; those from `lezione-94` to `lezione-99`
are **empty** (0 bytes) because the playlist has no matching video. When a lesson
is authored, it is added to the table above.
