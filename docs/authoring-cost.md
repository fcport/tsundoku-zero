# The sustainability of the pipeline (NFR9, M5, DoD — story 6.4)

Epic 6 built the **source boundary** (`docs/authoring-pipeline.md`, story 6.1), the
operating **runbook** (`docs/authoring-runbook.md`, story 6.2) and the **mechanical
anti-contamination check** (`docs/contamination-check.md`, story 6.3). What is
missing is the **epic's acceptance**: examining that procedure against the
requirements that govern it — authoring cost (`NFR9`), authoring time (`M5`) and the
Definition of Done in PRD §11 (**at least five** lessons authored, reviewed and
validated) — and recording where things really stand.

Following the durable precedent of `docs/authoring-runbook.md` and
`docs/contamination-check.md`, it is a document with a test —
`src/authoring-cost.test.ts` — that mechanically checks its mandatory statements: it
**anchors** the analysis to the runbook (one row per step; if the runbook gains or
loses a step, the test is red until the analysis covers it) and **to the real
content** (the existing lessons validate, and the DoD counter cannot silently lie).

## NFR9 analysis (AC1)

`NFR9` asks that the F11 pipeline **hold up for a course of indefinite length
without degrading**: no **manual** step whose cost grows with the number of lessons
**already authored** (call it `N`). The requirement is deliberately independent of
the total number of lessons, which **is not known** and will keep growing: so the
check is against a course of **length not fixed**, not against a set total.

We examine the **real** procedure — the eight steps of `docs/authoring-runbook.md` —
one by one. For each: is it **manual** work for the author or **automatic
computation** by a command? And how does its cost grow as `N` grows?

<!-- Maintenance: every row of the table below must start with `| N —`, where
`N` is the number of a `### N.` step in docs/authoring-runbook.md. The test
src/authoring-cost.test.ts extracts the step numbers from the runbook and requires
EXACT coverage: one row per step, no more, no less. If the runbook gains or loses a
step, update this table to keep the two formats in sync. -->

| Step | Manual? | Cost in N | Why |
|---|---|---|---|
| 1 — Prerequisites and working folder | manual (once) + automatic | O(1) manual; O(N) automatic | Setting up the environment is O(1). `npm ci`/`npm test` reprocess everything but are **automatic**: computation, not manual work. |
| 2 — Extract the facts from the transcript | manual | O(1) per lesson | The author reads **one** source and extracts its facts; the lesson is indexed **by concept**, not by episode (6.1), so they do not have to consult or reorder the N earlier lessons. The choice of `order` is the **next free position**: O(1). |
| 3 — Authoring with the help of an LLM (from the facts) | manual | O(1) per lesson | Writing exercises **from this fact** does not require rereading the N existing lessons. The LLM's help is only during authoring, never at runtime. |
| 4 — Put together the file `content/lessons/NN-<concept>.json` | manual | O(1) per lesson | You write **one** JSON file for the current lesson; the identity (`lessonId`) is derived **only** from the primary grammar point, not from a number to coordinate with the others. |
| 5 — Mandatory human review (before the commit) | manual + automatic | O(1) manual; O(N) automatic | The author reviews **the lesson just written**, not the N earlier ones: O(1). `npm run check-contamination` compares the **content** with the transcript and reprocesses every lesson, but it is **automatic computation** on tiny content. |
| 6 — Validation gate | automatic | O(N) automatic | `npm run validate-content` validates **all** N lessons (the uniqueness rules for `order`/`lessonId`/identity are cross-file, so it must see them all). It is automatic computation: uniqueness is **enforced by the gate**, not by the author. |
| 7 — Make the lesson available to the app | automatic | O(N) automatic | `npm run generate-content-seed` regenerates the seed from all N lessons. Automatic: one command, no manual work that grows. |
| 8 — Generate the sentence audio | automatic + manual | O(N) automatic; O(1) manual | `npm run generate-audio` goes through every sentence but skips those that already have audio: it generates only the new ones. The author listens to **the new sentences** and those whose reading was corrected from the kana, not the N earlier lessons: O(1). |

**NFR9 verdict.** **No manual step** has a cost that grows with the number of
lessons already authored: the author's work to add a lesson stays **O(1)** —
extract the facts from one source, author from those facts, put together one file,
review it — checked against a course of **length not known / not fixed**. The steps
that scale with `N` (`npm test`, `npm run check-contamination`,
`npm run validate-content`, `npm run generate-content-seed`, `npm run generate-audio`) reprocess all
`N` lessons on every run — that is O(N) **automatic computation** on tiny content,
**not** manual work, and it does **not** violate `NFR9`.

The subtle point: without the choice to "**index by concept, not by episode**"
(6.1), authoring the Nth lesson would force the author to coordinate `order` and
identity with the N-1 existing ones — an O(N) manual cost. Indexing by concept
removes it: the author takes the **next free position** for `order`, and uniqueness
of `order`/`lessonId`/identity is **enforced automatically** by the gate
(`src/domain/content-validation.ts`), not by the author by hand. It is this choice
that keeps the manual cost O(1) even where O(N) would have seemed unavoidable.

## M5 authoring time (AC2)

`M5` is the project's **sustainability metric**: the time to author a complete
lesson, **from watching to a playable exercise**, must be ≤ **30 minutes**. Like the
thresholds of the anti-contamination check (8 characters / 6 words,
`docs/contamination-check.md`), the **30 minutes** are an **estimate to be tuned**
against real experience, not a truth: it is the threshold stated by the PRD, to be
confirmed or corrected once measured.

**What is measured** (methodology):

- **Start of the measurement:** the author starts **watching the source** of the
  lesson (the transcript / the session to study).
- **End of the measurement:** the exercise is **playable** — the lesson is put
  together, has passed the mandatory human review, the `npm run validate-content`
  gate is green, the seed is regenerated (step 7) and the lesson is **committed**.
- **Unit:** one recording row **per lesson**. You write down the real, timed
  duration of that run, not an estimate.

**No time is made up.** No real measurement has been taken yet: taking one means
watching the source and timing a complete run of the procedure — a **human** action
outside the repository, left to the operator. So the table starts with a row **to be
measured**.

| Lesson | Start (watching the source) | End (exercise playable/committed) | Real time | Within 30 min? |
|---|---|---|---|---|
| `01-il-soggetto-con-ga` (が + the three predicate forms) | 28-09-2026 15:00:55 | 28-09-2026 15:09:00 | **8 min 05 s** | yes, with plenty of margin |

**What this measurement includes, and what it does not.** Timer started when the
transcript was opened, stopped when every gate was green: facts extracted, three
exercises authored (one per `kind`), `select-span` spans checked against the real
`alignFurigana` segments, `npm run validate-content` green, seed regenerated, suite
green.

**It does NOT include step 5**, the mandatory human review of `FR11.2`: that cannot
be delegated and must be timed separately by the owner, who adds their own time to
this row. The 8 minutes are therefore the *assisted* cost, not the total cost — and
should be read that way, not passed off as the full time.

**Two costs encountered that the runbook did not foresee**, worth recording because
every future lesson will pay them:

1. `select-span` can select **only segment boundaries**, and `alignFurigana` reduces
   a whole sentence to two segments (kanji core + kana tail). Isolating a word
   *inside* the sentence cannot be expressed: the sentence has to be chosen so that
   segment 0 matches what you want selected. Checking this means computing the
   segments before writing the exercise, not after.
2. Changing the content forces you to regenerate the seed and update the count
   sentinel. Both steps are already in the runbook (6 and 7) and are **enforced by a
   test**, so they cannot be forgotten — but they have to be counted in the time.

**The debt the first lesson paid, and the second will not.** Beyond the 8 minutes of
authoring, the first real lesson brought out three latent defects in the pipeline,
which cost about forty extra minutes. They are not a per-lesson cost: they are
one-off debt, and they must be kept apart from the `M5` measurement instead of
inflating it.

1. **The seed deleted the previous migration.** A test required "exactly one
   committed seed", but migration history is append-only: `supabase db push` fails
   if an already applied file disappears from the repository. It would have meant a
   manual intervention on the production history **at every content change**. Now
   seeds accumulate and the anti-drift check looks at the most recent one.
2. **The e2e acceptance check was tied to a file name.** It looked for a tile from
   the sample lesson; as soon as the curriculum had its first real lesson, it broke.
   Now it picks the lesson the way the domain does: lowest `order`.
3. **The seed updated without removing.** Fixing a sentence changes the exercise's
   identity (`AD-23`), so the wrong version stayed in the database next to the
   corrected one — measured: 4 exercises for a lesson that has 3. Now the seed
   reconciles.

All three would have hit **every** later lesson, and all three violated `NFR9` in
the same way: a manual cost that grows with the number of lessons already authored.
They were found because the first real lesson was taken all the way to production,
instead of stopping at green tests locally.

When the operator measures later lessons, they add a row for each. Only with more
rows can you see whether `M5` holds or needs retuning: the point of `NFR9` is that
the tenth row is no slower than the second.

## Definition of Done (AC3)

The Definition of Done in PRD §11 asks for **at least five** lessons authored,
reviewed and playable; the **goal is eleven**, matching those the owner has already
watched. This is the content epic's target.

<!-- authored-lessons: 20 -->
<!-- dod-status: met -->

**Where things stand.** The repository currently holds **20** lesson files under
`content/lessons/`, all **valid** against the Epic 2 gate
(`validateLessons` → `[]`):

- **19 curriculum lessons**, `order` 1 to 19, one for each of the first nineteen
  transcripts in the working folder. The details — how many exercises each lesson
  has, by kind, and which transcript the facts were taken from — are in
  `docs/content-inventory.md`.
- `content/lessons/01-la-particella-wo.json` — `order: 900`, the sample lesson from
  story 2.7. It lives in the **reserved range 900+** because it started as a test
  fixture and its position in the curriculum is provisional: when the real lesson on
  を arrives it must be **replaced**, not kept alongside (they would have the same
  `lessonId`). Curriculum lesson 2 practises を as a secondary point, but its primary
  point is the zero pronoun: the two files do not collide.

**DoD verdict:** the five-lesson target is **met**, and so is the goal of eleven.
Lessons 2 to 13, however, were authored with the help of an LLM and published
**without the mandatory human review** of step 5 of the runbook (`FR11.2`): on
28-09-2026 the owner explicitly chose not to do it, because of its length. In its
place there was an **independent review run by a second LLM**, which found five real
errors (one distractor that was actually correct, four imprecise explanations) and
three doubtful cases, all fixed before the commit. It is a weaker defence than the
one planned: whoever runs into a wrong exercise in these lessons knows where it
comes from. The count measures valid files, not the review. The verdict is kept
honest by a second machine-readable sentinel — `<!-- dod-status: … -->` — that the
test **ties to the real count**: while there are fewer than five lessons it reads
`below-target`; once five are reached it must be changed to `met`. So the verdict
cannot go stale — a doc that said `below-target` with five or more lessons (or `met`
with fewer) would turn the test **red** — without constraining the human prose, which
is free to explain both states. The sentinel is kept separate from the prose
precisely because the explanation here names both states.

The count above is kept **honest** by a forcing function: the machine-readable
sentinel `<!-- authored-lessons: N -->` is compared by the test with the real number
of `*.json` files under `content/lessons/`. Adding a lesson without updating this
number (or vice versa) turns the test **red**: the DoD tracker cannot silently lie.

The test does **not** assert `N ≥ 5` (it would be red now, and an agent cannot make
it green by authoring lessons): the ≥ 5 target remains **stated prose** and an
action left to the operator. What the test proves mechanically is that the
**existing** lessons **validate** (guard against vacuity) and that the counter is
**aligned** with the real content.

## Placement and limit

This story is the **documentary acceptance** of epic 6, not another tool. It builds
and proves everything an agent can produce:

- the **NFR9 analysis** (AC1) — the step-by-step examination of the runbook and the
  verdict;
- the **methodology and the measurement table** for `M5` (AC2);
- the **DoD tracking** (AC3) — the target, the sentinel and where things stand;
- the **anchor test** `src/authoring-cost.test.ts`, which keeps all of the above
  honest.

Two parts depend on **human action outside the repository** and are therefore
**left to the operator** (the story ends in `awaiting-operator`, not `blocked`),
on the model of the retroactive audit in `docs/contamination-check.md`:

- **Measuring the real `M5` time** (AC2): watching the source and timing a complete
  run of the procedure — an agent cannot watch the source.
- **Authoring, reviewing and committing ≥ 4 more lessons** (AC3): committing course
  content requires the **mandatory human review** (FR11.2, step 5 of the runbook),
  which by design **cannot be delegated to an agent** — consistent with story 6.2's
  `Never`. The only evidence about content that an agent builds is that the
  **existing** lessons validate.

This document completes the analysis that the runbook (`docs/authoring-runbook.md`)
makes actionable: that one says **how** a lesson is authored, this one says **why**
the cost of doing it N times does not degrade and **where** we stand against the
target.
