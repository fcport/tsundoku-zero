# The authoring runbook (FR11.1–FR11.2)

This document is the **operating procedure** that turns a lesson just studied from
the source into an exercise file that matches the Epic 2 schema. It is written to
be **carried out by reading it**: someone who has never done it — a third party, or
the owner six months from now — follows the eight steps below and produces a valid
lesson without asking for help. Following the durable precedent of
`docs/authoring-pipeline.md` and `docs/i18n-boundary.md`, it is a document with a
test (`src/authoring-runbook.test.ts`) that mechanically checks its mandatory
statements and that the included example really passes the validation gate.

The **source boundary** — what is taken from the transcript and what is not —
belongs to `docs/authoring-pipeline.md`: this runbook takes it as read and refers
to it. This document says **how the work is done**, not where the line runs. The
**mechanical anti-contamination check** arrived with story 6.3
(`npm run check-contamination`, documented in `docs/contamination-check.md`): step
5 wires it into the human review, which is still mandatory.

## In one sentence

From the **facts** taken from the transcript, the exercises are authored **with the
help of an LLM** (only during authoring, never at runtime), `content/lessons/NN-<concept>.json`
is put together, a **mandatory human review** happens before the commit, the
**gate** `npm run validate-content` is passed, and then the sentence audio is
generated with `npm run generate-audio`. Adding a lesson **does not touch the
code**: you only create or edit a JSON file under `content/lessons/` (plus its audio
in `public/audio/`), never `src/` or the schema.

## The eight steps

### 1. Prerequisites and working folder

- Environment ready: `npm ci` and a green `npm test` on the current checkout.
- The session's private notes — transcripts, subtitles, transcriptions — live in
  the **author's working folder** `.authoring/`, excluded from the repository
  (`.gitignore`, protected by `src/source-boundary.test.ts`). Nothing inside
  `.authoring/` ever enters the product or the repository.
- The model of a well-formed lesson already in the repo is `content/lessons/01-la-particella-wo.json`:
  keep it open as a reference for the shape of the three kinds.

### 2. Extract the facts from the transcript

Read the source material and **extract the facts**, never the wording: which
grammar point, what the rule is, what confusion it clears up. The
anti-contamination rules — you take the **fact** and rewrite from scratch, a
paraphrase with synonyms is still a derivative work, the source's teaching
metaphors are not reused — are in `docs/authoring-pipeline.md`. Read them there:
they are the invariant that governs everything that follows.

**Index the lesson by grammar concept**, never by the source episode's number,
title or order. The file name is `NN-<concept>.json`, where `NN` is the position in
the curriculum (`order`) and `<concept>` a slug of the grammar point — not an
episode number. The lesson identifier (`lessonId`, derived from `grammarPoints[0]`
via `deriveLessonId`) depends **only** on the primary grammar point, never on
`order` or `title`: by construction, it is impossible to author the id from a
source number.

### 3. Authoring with the help of an LLM (from the facts)

Exercise authoring is **assisted by an LLM**, and **only during authoring**: the
LLM helps put together sentences and explanations during this session, but it
**never** appears **at runtime** — the app serves static, already validated
content and generates nothing on the fly.

Constraints the LLM (and whoever drives it) must respect:

- **Start from the facts, not from the source.** Exercise sentences are
  **invented** from the grammar fact, not taken from the transcript or touched up.
- **Standard linguistic terminology.** Use the standard names of the phenomena
  (subject, topic, particle, verb, copula, い-adjective): never the source's
  teaching metaphors or images, not even reworded (see
  `docs/authoring-pipeline.md`).
- **Respect the schema.** Every exercise is one of the **three kinds** of the closed
  registry (step 4). A `kind` outside those three does not exist.
- **Understandable to someone who has never seen the source.** The explanation
  (`explanation.en`) explains the fact on its own, without assuming the source's
  lesson.

### 4. Put together the file `content/lessons/NN-<concept>.json`

The file is a JSON object with the shape below. The **single source** of the shape
is `src/domain/lesson.ts` and `src/domain/exercise.ts`; it is repeated here field by
field so you can write the file without opening them.

**Lesson fields** (`src/domain/lesson.ts`):

| Field | Shape | Required | Notes |
|---|---|---|---|
| `order` | integer ≥ 1 | yes | position in the curriculum; **unique** across all lessons (step 6) |
| `title` | `{ "en": string, "it"?: string }` | yes (`en`) | bilingual text; `en` not empty, `it` optional. Prose authored from the concept, never from the source's title/number |
| `video` | string: YouTube id of **11 characters** (`A-Z a-z 0-9 _ -`) | no | the id of the lesson's reference video, **never the URL** (`dwcTI9qvO-U`, not `https://youtu.be/dwcTI9qvO-U`). The app turns it into a plain link that opens YouTube: the video is never embedded. It goes right after `title`; **unique** across all lessons (step 6) |
| `grammarPoints` | **non-empty** array of non-empty strings | yes | the grammar points the lesson teaches; the **first** gives the lesson its identity |
| `exercises` | array (may be **empty**) of exercises | yes | zero or more; a lesson with no exercises is valid (it still declares its `grammarPoints`) |

**Fields common to every exercise** (`src/domain/exercise.ts`):

| Field | Shape | Notes |
|---|---|---|
| `kind` | one of the three literals | discriminant: `"single-select"` \| `"select-span"` \| `"assemble"` |
| `grammarPoint` | non-empty string | **must be among the `grammarPoints`** declared by the lesson (beyond-schema rule, step 6) |
| `sentence` | `{ "kanji": string, "kana": string }` | both non-empty; `kana` is the **reading** and **must not contain kanji** (beyond-schema rule) |
| `explanation` | `{ "en": string, "it"?: string }` | bilingual text; `en` required and non-empty |
| `showFurigana` | boolean | optional; absent ⇒ furigana **visible** |

The **three kinds** of the closed registry and the shape of their `answer`:

- **`single-select`** — one prompt, *n* options, one answer.
  - `answer`: non-empty **string** (the only correct option).
  - `distractors`: **non-empty** array of non-empty strings (the wrong options).
- **`select-span`** — you mark **a part** of the sentence on the indices of the
  furigana segments.
  - `answer`: `{ "start": integer ≥ 0, "end": integer ≥ 0 }` with **`end` > `start`**
    (half-open interval `[start, end)`). They are **segment** indices, not
    character indices. No `distractors`.
- **`assemble`** — tiles to put in order.
  - `answer`: **non-empty** array of non-empty strings, in the **correct sequence**.
    No `distractors`.

**Beyond-schema rules the gate enforces** (`src/domain/content-validation.ts`), on
top of the shape above:

1. **`kana` without Han**: the `kana` field of every sentence contains no ideographs
   (kanji) — a reading with a kanji in it is not a reading.
2. **Declared `grammarPoint`**: every exercise's `grammarPoint` is among the
   lesson's `grammarPoints`. (Containment goes one way only: a point that is
   declared and not yet practised is not an error.)
3. **Cross-file uniqueness of `order`**: two lessons cannot claim the same position
   in the curriculum.
4. **Cross-file uniqueness of identifiers**: `lessonId` (derived from
   `grammarPoints[0]`) and the identity of every exercise are unique across all
   files.
5. **Cross-file uniqueness of `video`**: two lessons cannot point to the same video
   (it is almost always a bad copy-paste). Lessons without a `video` are not part of
   the check.

The **identity of an exercise** (`src/domain/exercise-identity.ts`) is derived from
**kind + sentence (kanji and kana) + correct answer**, NFKC-normalised; it leaves out
the explanation, the distractors and the `grammarPoint`. In practice: fixing a typo
in the explanation or reordering the distractors does **not** create a duplicate,
while changing the sentence or the correct answer produces a new exercise.

### 5. Mandatory human review (before the commit)

**No exercise reaches the repository without being read by a human.** This human
review is **mandatory** and comes **before the commit**: it is not a step you can
skip. The defence against contamination from the source now has **two layers**:
human review (below) and, since story 6.3, the **mechanical check**
`npm run check-contamination`. The mechanical check stays **out of CI** because the
transcript is not in the repository (it is the only link not closed downstream —
`docs/contamination-check.md`), so it has to be run **here**, locally, as part of
this mandatory review.

First, run the **mechanical check** against your working folder:

```
npm run check-contamination
```

It compares every Japanese sentence and every explanation produced with the
transcript(s) under `.authoring/` and flags **non-trivial verbatim overlaps**. Exit
**0** ⇒ no unjustified overlap. **Non-zero** exit ⇒ either there is an overlap
(rewrite it from the fact, or justify it if it is a public canonical example),
**or** there is no transcript to compare with (nothing to compare ⇒ nothing
checked: it is **not** a green). What it compares, the thresholds and how to respond
to a flag are in `docs/contamination-check.md`.

Then, the review checklist, one exercise at a time:

- [ ] **Read every exercise** from the start: the prompt is clear, the correct
      answer really is correct, the distractors are plausible but wrong.
- [ ] **Anti-contamination boundary** (story 6.3's mechanical check now verifies
      it, but the review stays): no sentence, wording, example or metaphor comes
      from the source. The sentences are invented from the fact; the terminology is
      the standard one (see `docs/authoring-pipeline.md`).
- [ ] **Check the facts**: the grammar rule taught is correct and the explanation
      describes it faithfully.
- [ ] **Title and concept**: `title` and `grammarPoints` describe the concept, not
      the number or title of the source episode.

Only once the mechanical check is green and this review is done can the exercise be
committed.

### 6. Validation gate

Run the Epic 2 gate:

```
npm run validate-content
```

It must come out **green** (exit 0). The same command is **enforced in CI**
(`.github/workflows/ci.yml`): a malformed file gives a non-zero exit and **blocks
the merge**. The gate checks the shape of the schema (the three kinds, the required
fields) plus the beyond-schema rules of step 4 (`kana` without Han, declared
`grammarPoint`, uniqueness of `order` and of identifiers).

A conforming lesson passes the gate **without any manual change to the schema**: the
author **does not touch the code** — does not change `src/`, does not change the
schema, does not change the validator. If the gate reports a problem, you fix the
**lesson JSON**, not the code. Adding a lesson is a content-only operation.

### 7. Make the lesson available to the app

Regenerate the content seed:

```
npm run generate-content-seed
```

This produces the Supabase migration (`supabase/migrations/<timestamp>_seed_content.sql`)
from everything in `content/lessons/`, so the new lesson reaches the client. The
command validates again before writing: if the content does not conform, it fails
and generates nothing.

> **Do not delete earlier seeds.** Migration history is append-only:
> `supabase db push` compares the local files with the remote project's
> `schema_migrations` table and **fails** if a migration that was already applied
> disappears from the repository — «Remote migration versions not found in local
> migrations directory» — and recovering means repairing the production history by
> hand. Seeds accumulate: each is an idempotent upsert, so applying them in sequence
> converges on the state of the latest. The anti-drift check compares the content
> with the **most recent** seed, not with "the only one".

### 8. Generate the sentence audio

Every exercise sentence has its own audio, which the student hears after answering.
A new lesson, or a changed sentence, must therefore always come with its audio,
generated like this:

1. You need **VOICEVOX** installed (free, https://voicevox.hiroshiba.jp/) and
   `ffmpeg` on the PATH (`winget install ffmpeg`). You do not need to open it: if
   the engine does not answer on `http://127.0.0.1:50021`, the script starts it by
   itself (with no window) and closes it again at the end. If VOICEVOX is not in the
   default folder (`%LOCALAPPDATA%\Programs\VOICEVOX`), point to the engine in
   `.env.local`: `VOICEVOX_ENGINE_PATH=D:/programs/voicevox/vv-engine/run.exe`.
2. Run:

   ```
   npm run generate-audio
   ```

   It generates an MP3 for every sentence in `public/audio/` with the voice **No.7,
   style アナウンス** (id 30) at **speed 0.8** (a little slower than normal, for
   learners), always the same for the whole course. It skips sentences that already
   have audio and deletes the audio of sentences that no longer exist. The file name
   is the hash of the kanji sentence (`src/domain/sentence-audio.ts`): changing a
   sentence changes the file.
3. Read the final report. For every sentence the script compares the reading
   VOICEVOX would use with the hand-written `kana`: if they differ (降りません read
   as おりません, 日本 read as にっぽん), it redoes the audio starting from the kana
   and lists it among the **corrected readings**. If the reading still differs even
   from the kana, the sentence is listed as **STILL WRONG**, its audio is not
   generated and the command exits with an error: fix the `kana` if it was wrong,
   otherwise reword the sentence.
4. Listen at least to the new sentences and the corrected ones, then commit
   `public/audio/` together with the lesson.

The test `src/sentence-audio-files.test.ts` (in CI) fails if a sentence has no audio
or if the audio of a removed sentence is left behind: forgetting this step blocks
the merge.

The audio is **not** covered by the content's CC BY-SA: it follows the terms of the
No.7 voice (non-commercial use, credited as «VOICEVOX:No.7»), as stated in
`LICENSE-CONTENT`. Do not change voice without updating the credit and the licence.

## Worked example

What follows is a **valid** lesson, produced by following this procedure: free
grammar facts (the difference between the topic marked by は and the subject marked
by が), **invented** sentences, **standard linguistic terminology**, the three kinds
of the closed registry. It is wrapped in stable sentinels: the test
`src/authoring-runbook.test.ts` extracts it and passes it to `validateLessons`
**together with the real content** of `content/lessons/`, proving that it passes the
Epic 2 gate as it would actually be added (cross-file uniqueness included). It is a
**template**, not course content (it does not live under `content/lessons/` and does
not count towards story 6.4's Definition of Done).

`order: 901` is only illustrative. **Positions from 900 up are reserved** for what
is not part of the curriculum: documentation examples and lessons that serve as test
fixtures. The course has more than ninety lessons, so a two-digit sentinel value
would sooner or later collide with a real lesson — and the step 6 gate would reject
it at the worst moment, that is while you are authoring.

Today that range holds `content/lessons/01-la-particella-wo.json` (`order: 900`): it
started as the fixture for story 2.7 and its position in the curriculum is
provisional. When the real lesson on を arrives, that file must be **replaced**, not
kept alongside: the two would have the same `lessonId` (derived from
`grammarPoints[0]`) and the gate would flag it.

In your lesson use the **next free position** in the curriculum, because `order` is
**unique** across all lessons (step 6).

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

A note on the example: every exercise carries a `grammarPoint` that is **among the
lesson's `grammarPoints`** (`"主語を示す「が」"` for the first and third,
`"主題を示す「は」"` for the second) — the beyond-schema rule holds because every
exercise's `grammarPoint` matches one of the two declared. When reviewing, check that
this is really so: a `grammarPoint` the lesson does not declare is a gate issue.

## Acceptance: sustainability of the pipeline

This runbook says **how** a lesson is authored. Why the cost of repeating the
procedure does not degrade as the course grows (`NFR9`), how much time it should
take (`M5`) and where we stand against the content goal of the Definition of Done
(at least five lessons) are epic 6's acceptance analysis, in
`docs/authoring-cost.md` (story 6.4).
