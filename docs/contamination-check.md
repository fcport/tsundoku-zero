# The anti-contamination check (FR11.7, story 6.3)

The boundary between **fact** and **wording** is documented (`docs/authoring-pipeline.md`,
story 6.1) and the procedure is written down (`docs/authoring-runbook.md`, story 6.2).
But until story 6.3 the only defence against **contamination from the source** was
**human review** (step 5 of the runbook): it depended on the author paying
attention. This document describes the **mechanical tool** that now exists — the
check that compares what was produced with the starting text and flags non-trivial
verbatim overlaps.

Following the durable precedent of `docs/authoring-pipeline.md` and
`docs/authoring-runbook.md`, it is a document with a test —
`src/authoring-contamination.test.ts` — that mechanically checks both the **core**
(it flags an overlap, it clears clean content) and the mandatory **statements** of
this file (the limit: it is not a CI gate, it is the only link not closed
downstream).

## What it compares (AC1)

For every lesson under `content/lessons/`, the check compares:

- **every Japanese sentence** — `sentence.kanji` and `sentence.kana` of every exercise;
- **every explanation** — `explanation.en` and `explanation.it` of every exercise;
- the lesson **title** (`title.en`, `title.it`) — also prose authored from the
  concept, subject to the same boundary.

It compares them with the text of the **transcript(s)** in the `.authoring/`
working folder and flags every **non-trivial verbatim overlap**: a shared run at or
above the threshold after **NFKC** normalisation.

The **comparison core is pure** (`scripts/lib/contamination.ts`): no I/O, no
`console`, no `process`. The transcript glob, file reading and exit code live in
the **CLI** (`scripts/check-contamination.ts`), exactly as `validateLessons`
(pure domain) is kept apart from its runner `scripts/validate-content.ts`.

## How to run it

```
npm run check-contamination
```

- It reads source files **only** under `.authoring/` (the `*.txt`, `*.vtt`, `*.srt`,
  `*.transcript*` files) and the lessons under `content/lessons/`. The safety net
  from 6.1 is the **folder**, not the extension: `.gitignore` excludes `.authoring/`
  **entirely**, so every file inside it stays out of the repo. A **bare** `*.txt`
  **outside** `.authoring/` is **not** git-ignored — that is why transcripts live in
  the working folder, and that is where the CLI looks for them.
- Exit **0** if no unjustified overlap remains; **non-zero** if at least one
  remains, **or** if there is no transcript to compare with.
- **No transcript ⇒ explicit message + non-zero exit.** Nothing to compare means
  **nothing checked**, not a false green: put the source transcript(s) in
  `.authoring/` (never versioned, 6.1) and run it again.

Non-default paths:
`npm run check-contamination -- <transcriptDir> <lessonsDir>`. The allowlist is
looked up **next to the transcripts**, in `<transcriptDir>/contamination-allowlist.json`:
a custom transcriptDir **also moves** the allowlist lookup (it does not stay
anchored to `.authoring/`).

## "Non-trivial": the thresholds

Japanese has no spaces, so "verbatim" means a run of contiguous **characters**
(after NFKC and stripping spaces/punctuation). Prose (en/it) uses n-grams of
consecutive **words**. The thresholds are **declared, tunable constants** in
`scripts/lib/contamination.ts`:

| Constant | Meaning | Current value |
|---|---|---|
| `MIN_JA_RUN` | minimum contiguous Japanese characters to flag | 8 |
| `MIN_PROSE_WORDS` | minimum consecutive words (prose) to flag | 6 |

Like the thirty minutes of story 6.4, the threshold is an **estimate to be tuned**
against real experience, not a truth: too low and it flags coincidences (a
particle, a common phrase), too high and it lets almost entirely copied sentences
through. The **maximal** run is reported, so sub-runs are not multiplied.

**Watch out when retuning.** Allowlist matching is **exact** on the normalised form
the check prints: changing `MIN_JA_RUN`/`MIN_PROSE_WORDS` can lengthen or shorten
the flagged `span`s and so **invalidate** allowlist entries already written (a
shorter span no longer matches). After retuning, run the check again and **copy the
newly printed span** into every affected entry. The check helps you find out: an
allowlist entry whose `span` no longer matches any overlap is reported as an
**unused entry WARNING** on stderr (it does not fail the run, but it points to a
typo or a stale entry to fix).

## Responding to a flag (AC2)

A flagged overlap is **rewritten before the commit**: go back to the **fact**
(`docs/authoring-pipeline.md`) and write the sentence or explanation anew.

The only alternative is to **justify it in writing**, and only if it is a **public
canonical example** (a standard example sentence, not the source's expression).
The justification is **mechanical**: an allowlist entry with a **non-empty**
`reason` reclassifies the overlap as "justified" and does not fail the check. An
**empty** `reason` **does not suppress it**: the flag remains a failure. You cannot
silence a flag by emptying the field — you can only justify it.

The allowlist is the file `contamination-allowlist.json` next to the transcripts
(`.authoring/contamination-allowlist.json` with the default folder; in the
transcriptDir passed otherwise), **not versioned**. It is a JSON array of
`{ "span": "…", "reason": "…" }`, where `span` is the **exact** normalised form the
check printed for the overlap. An entry with a non-empty `reason` whose `span`
matches no overlap is reported as an **unused entry WARNING** (typo or stale
entry): it does not fail the run, but it should be fixed.

## Placement and limit (AC4)

**This check cannot be a CI gate.** It compares the produced content with the
source **transcript**, which story 6.1 keeps **out of the repository**
(`.gitignore`, `.authoring/`): in CI the transcript is **absent**, so there is
nothing to compare with. Adding it to CI (`.github/workflows/ci.yml`) would be an
empty green, so by construction it stays **out**.

It is the **only link** in the quality chain that **is not closed downstream**.
Every other check — the content validation gate (`npm run validate-content`,
FR2.6), the boundaries lint (AD-1), the typecheck, the tests — is enforced in CI
and blocks the merge. This one is not: it runs **locally**, during the runbook's
**mandatory human review** (step 5), against the author's private working folder.
Its existence does not make it automatic: it remains a step the operator **must**
run, and the runbook wires it in as such.

## Retroactive audit (AC3)

The check applies **retroactively** to every lesson authored **before** the check
existed — first of all to the sample lesson from story 2.7,
`content/lessons/01-la-particella-wo.json`. The outcome of each audit is recorded
here.

Running it requires that lesson's **source transcript**, which is **private**
input (absent from the repository because of 6.1, and absent from this working
tree: no `.authoring/`). The **tool** is built, tested and documented by this
story; **running** it against the private transcript and **recording the real
outcome** are left to the **operator** (the story ends in `awaiting-operator`).

| Lesson | Authored before the check | Transcript available | Outcome | Action |
|---|---|---|---|---|
| `content/lessons/01-il-soggetto-con-ga.json` | no, authored from the transcript | yes | **28-09-2026: no overlap** | none; but see the blind spot below |
| `content/lessons/01-la-particella-wo.json` | yes (story 2.7) | yes | **28-09-2026: no overlap** | none |

The comparison on 28-09-2026 was run against **99 transcripts** — the whole course,
not only the lesson the content was authored from. That is a stronger check than
story 6.3 asked for: it also covers the sample lesson, which started out as an
invented fixture and whose transcript had never been compared.

### Blind spot found while running the check (28-09-2026)

The check compares **text with text**. The transcript of lesson 1 writes the
Japanese examples in **Latin letters** ("pen ga akai"), while the content writes
them in Japanese (`ペンが赤い`). An overlap between the two produces no textual
match at all: **the check went green on an example that really had been taken
from the source.**

The overlap was found by reading by hand and removed (`ペンが赤い` →
`水が冷たい`, which does not appear in the source). The green verdict above holds
after that fix.

Practical consequence: **a green `check-contamination` does not replace the human
review of `FR11.2`** for sources that romanise Japanese. The reviewer has to compare
the examples for *substance*, not trust the automatic comparison. A romaji↔kana
normalisation would let the check see it; that is deferred work, not solved.

When the operator runs the check, they replace the "to be verified" row with the
actual outcome: **clean** (no unjustified overlap) or the list of overlaps
rewritten/justified, with the date.

`content/lessons/01-la-particella-wo.json` is currently the **only** lesson under
`content/lessons/`, so this table is **complete** for the current state of the
repository. Every new lesson authored **before** any retuning of the thresholds
must be added here with its own outcome.
