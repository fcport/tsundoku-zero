# The source boundary in the authoring pipeline (FR11.7)

Exercise content starts from reading the source material — transcripts,
subtitles, lesson transcriptions. That material is **protected work**: it serves
as private input to the authoring session, but it enters neither the product nor
the repository. This document sets the **boundary between fact and wording** that
governs the whole pipeline, following the durable precedent of
`docs/i18n-boundary.md`: a documentation file with a test —
`src/source-boundary.test.ts` — that checks it exists and what it says.

It covers only the boundary with the source. The **operating procedure** of the
authoring session is the runbook `docs/authoring-runbook.md` (story 6.2); the
**mechanical anti-contamination check** — which compares the produced content
with the transcript and flags verbatim overlaps — is `npm run check-contamination`,
described in `docs/contamination-check.md` (story 6.3). This document says where
the line runs, not how the work is done.

## The line in one sentence

**The content is open, the wording is closed.** Grammar ideas — the zero
pronoun, what が and は do, the three ways a sentence can end — are linguistic
facts and teaching methods: anyone is free to teach them. Their **specific
expression** — the wording, the original examples, the teaching metaphors — is
protected work. From the transcript the line is crossed in one direction only:
you take the fact and leave the wording behind.

## The three anti-contamination principles

### 1. Take facts from the transcript, never wording

Reading a protected work to learn its content is what the work exists for, not an
act that copyright cares about. From a transcript you extract the **fact** — which
grammar point, what the rule is, what confusion it clears up — and from that fact
you **rewrite from scratch**. You do not start from the source's sentence and
touch it up: you start from the fact and write something new.

### 2. A paraphrase with synonyms is still a derivative work

Rewriting someone else's explanation by swapping words for their synonyms does
**not** cross the line: it is still a derivative work, and sounding different
changes nothing. The right path is not to drift away from the original wording
one synonym at a time, but to **start from the fact** and not from the wording.

### 3. The source's teaching metaphors are not reused

This is the subtlest distinction, and the one people get wrong in good faith. The
*fact* that a Japanese sentence ends in one of three ways is grammar, and free. The
**way the source teaches it** — its images, its metaphors — is its own creative
expression, and it is not reused, not even reworded. Use standard linguistic
terminology, which carries zero risk and is also clearer in an exercise: you do
not need to know the metaphor to understand the question.

## The concrete example: the time we fell into it

The project itself fell into it, and the fix is in its history (PRD §2, commit
`c618164`). To name the three ways a sentence can end, the PRD used the word
**"engines"** (*«motori»* in the original Italian). That is not linguistic
terminology: it is the **source's teaching metaphor** — the sentence as a train,
with a carriage, a coupling, an engine. Reusing it, even just as a label, was
reusing its expression.

The fix was to replace the metaphor with standard terminology:

| Source wording (metaphor, protected) | Standard terminology (fact, free) |
|---|---|
| the verbal predicate "engine" | **verb** |
| the copula "engine" | **copula** (だ) |
| the adjective "engine" | **い-adjective** |

The fact — that a sentence ends in one of three ways: verbal predicate, copula,
い-adjective — stayed intact, because it is grammar. Only the wording the source
dresses it in went away. And in an exercise standard terminology is also clearer:
someone who has never seen the train metaphor still understands the question.

That is why, by construction, **the examples in this document use only standard
linguistic terminology**: a doc that says it does not reuse the source's
metaphors cannot repeat the mistake it documents.

## The author's working folder

Transcripts and private notes from the authoring session live in `.authoring/`,
the **author's working folder**. Its content is private input and **does not
enter the repository**: `.authoring/` is excluded in `.gitignore` along with
transcripts, subtitles and transcriptions (`*.transcript`, `*.transcript.txt`,
`*.vtt`, `*.srt`, `transcripts/`, `.transcripts/`). The exclusion is not left to
discipline: it is **mechanically protected** by the hygiene test
`src/source-boundary.test.ts`, which checks both the `.gitignore` patterns and
that a transcript in the working folder really cannot be tracked. Removing it
turns CI red; it does not silently expose the source.
