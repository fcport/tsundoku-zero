# The session screen reader audit (story 7.6)

This document is the **audit record** for accessibility of the exercise screen with
a **real screen reader**. It follows the same durable precedent as
`docs/session-keyboard-contract.md` (AD-15) and `docs/i18n-boundary.md` (AD-14):
a contract/record file with a test that checks it exists and what it says.

## Purpose and scope

The session's **accessibility contract** — furigana in
`<rt aria-hidden="true">` so that a Japanese voice reads the sentence ONCE and not
twice; `lang="ja"` on Japanese; **a single** `aria-live="polite"` live region that
announces outcome and progress; reading order
**prompt → sentence → options → outcome → explanation** — is **built** and **covered
by** component/jsdom **tests**. But those tests run against static markup: they
assert the DOM/ARIA **attributes**, not what a real screen reader with a Japanese
voice actually **says**.

The only accessibility claim that **no automated test can make** — that a real
screen reader walks through the session in an understandable way and reads the
sentence **only once** — is the subject of this audit. The agent writes and checks
everything **offline** (inventory, expected behaviour, procedure); the **operator**
runs the real screen reader and records the outcome in the "Measured outcome"
section. Until they do, "accessible" remains **reasoned, not measured**.

**Scope:** the **exercise session path**. Out of scope are the deferred app-wide
a11y items (see "Known adjacent items"): they are mentioned as surrounding context
the operator can check opportunistically, not as Acceptance Criteria of 7.6.

## Inventory of the EXISTING automated coverage

These tests run today and assert the DOM/ARIA **attributes**. `node` environment
(`vitest.config.ts`), static rendering with `renderToStaticMarkup` — no screen
reader runtime:

- **`src/ui/JapaneseText.test.tsx`** — every rendered `<rt>` carries
  `aria-hidden="true"` (the `bareRt` match fails if an `<rt>` is bare); the wrapper
  stays `lang="ja"` even with furigana hidden; the content of the `<rt>` is the kana
  **verbatim**, never romaji.
- **`src/features/study/SessionScreen.test.tsx`** — renders **exactly one** live
  region `aria-live="polite"` in the active session branch; it is `sr-only` and
  **empty** before the answer; **no** `aria-live` on skeleton, completion or empty
  state (so it stays one for the whole session).
- **`src/features/study/SessionScreen.keyboard.test.tsx`** — the live region
  announces **outcome + progress** after the answer; a **wrong** answer announces
  `session.outcome.incorrect` and **never** `session.outcome.correct` (covers the
  `incorrect` branch).
- **`src/features/study/session-keyboard-contract.test.ts`** — checks the
  **keyboard contract** document (`docs/session-keyboard-contract.md`): reading
  order = tab-order = number key order, focus ring, `Enter` advances / `Esc` exits,
  a SINGLE `aria-live="polite"`.
- **`src/features/study/ExerciseCard.test.tsx`** — the **presence** of the card's
  nodes (the prompt; the sentence as `JapaneseText`, with `lang="ja"` + `<ruby>`;
  the **number** of options per kind), the order **among the options only**
  (`answerOptions`, ordered `indexOf`) and the reveal/outcome/explanation states. It
  does **NOT** check the **top-level** reading order prompt → sentence → options →
  outcome → explanation: it makes no position comparison between those nodes.
- **`src/features/study/ProgressMeter.test.tsx`** — `role="progressbar"` with
  `aria-label` / `aria-valuenow` / `aria-valuemin` / `aria-valuemax`.

**The top-level reading order between the card's nodes (prompt → sentence → options →
outcome → explanation) is NOT asserted by any automated test** — no test compares
the positions of those nodes with each other. That is exactly part of what the
manual audit measures (AC2): a real reader walks the nodes in DOM order, and only
the operator can hear whether the resulting order makes sense.

**The runtime experience with a real screen reader is the ONLY accessibility claim
not covered by any automated test.** None of the tests above runs a TTS voice or a
screen reader: they assert the DOM artefact, not the pronunciation. That is exactly
what the operator measures in "Measured outcome" (AC3). The companion test
`src/features/study/session-screen-reader-audit.test.ts` checks this **document**
(the artefact), not the runtime behaviour.

## Expected behaviour (reasoned from the code)

Reasoned from the real code, with anchors. These are **expectations** the operator
confirms or refutes; they are not measurements.

### AC1 — the Japanese sentence is read ONCE

- In `src/ui/JapaneseText.tsx:57-74` the wrapper is `<span lang="ja">` (`:59`) —
  Japanese is data, it does not go through i18n (AD-14/UX-DR24) — rendered
  **always**, even with furigana hidden.
- Every ruby annotation is `<rt aria-hidden="true">` (`:65`) with fallback `<rp>`
  parentheses (`:64,66`). The reasoning is in the contract comment (`:12-16`,
  UX-DR28): a screen reader with a Japanese voice already reads the base text; an
  `<rt>` that is **not** hidden would make it read **twice** (base + kana reading).
- **Expectation:** with a Japanese voice, the sentence is spoken **once** — the base
  text — and the furigana (`<rt>`) is **not** voiced.

### AC2 — understandable order prompt → options → outcome → explanation

The **full** reading order of the nodes is prompt → **sentence (AC1)** → options →
outcome → explanation. AC2 looks at the order of the elements it **names** — prompt,
options, outcome, explanation; the Japanese **sentence** belongs to AC1 (read once)
and sits between the prompt and the options. The two formulations describe the same
DOM sequence, seen from different ACs.

- The semantic order of the card's nodes is, in `src/features/study/ExerciseCard.tsx:109-174`:
  prompt (`<p>` with the kind's i18n key, `:112`) → **Japanese sentence**
  (`JapaneseText`, `:116-118`) → `<ul>` of `<button aria-pressed>`, one per option,
  in domain order (`:126-154`) → "Show the explanation" (`:159-167`) →
  `ExplanationPanel` (`:171-173`).
- `src/features/study/ExplanationPanel.tsx:38-63` renders, once answered, the
  **textual** outcome (`session.outcome.correct` | `incorrect`, `:42-46`) and the
  explanation text with `lang` set to the language **actually** rendered (`:52`) —
  so a voice reads Italian/English in the right language, not treated as Japanese.
- Reading order = tab-order = number key order is fixed by the keyboard contract
  (`docs/session-keyboard-contract.md`, sections 1 and 4).
- **Expectation:** navigating with the reader, the nodes are announced in this order,
  with no jumps or reversals; every option is a button with an `aria-pressed` state.

### AC3 — progress is announced by the single live region

- In `src/features/study/SessionScreen.tsx:454-503`, the **active session** branch
  renders `<main>` → `ProgressMeter` → `ExerciseCard` → "Next exercise" → "Leave the
  session" and **a single** `<p aria-live="polite" className="sr-only">` (`:498-502`).
- On answering, the live region announces **outcome + progress**: e.g. «That answer
  is correct. 1 of 5 completed» — `session.outcome.*` plus
  `session.progress.announce` («{{completed}} of {{total}} completed», in
  `src/i18n/en.ts:164-196`). Before the answer it is **empty** (empty string).
- The `ProgressMeter` (`src/features/study/ProgressMeter.tsx`) carries, in parallel,
  `role="progressbar"` with `aria-valuenow`/`min`/`max` for the numeric state.
- It is `sr-only`: the visible outcome is already given by the `ExplanationPanel`,
  the progress by the bar; the live region is for assistive technology only. It is
  **not** rendered on skeleton/completion/empty — so it stays exactly one for the
  whole session.
- **Expectation:** after answering, the reader announces on its own the outcome and
  «X of N completed» from a single live region `aria-live="polite"`, only once and
  without duplicates (a duplicated announcement would point to more than one live
  region).

## Reproducible manual procedure

The operator runs this procedure with a real screen reader and a Japanese TTS
voice, then fills in "Measured outcome" and "Defects".

### 1. Enable a screen reader with a Japanese voice

The behaviour of `aria-live` and `lang` switching **depends on the browser**: use a
recommended screen reader ↔ browser pairing, so the audit is reproducible.

- **Windows — NVDA:** install NVDA; install/enable a Japanese TTS voice (e.g.
  Windows OneCore Japanese, or a Vocalizer/eSpeak voice with `ja` support). In
  NVDA → Preferences → Settings → Speech, check that Japanese is voiced (NVDA uses
  the document language; the `lang="ja"` wrapper drives it).
  **Recommended pairing: NVDA + Firefox or NVDA + Chrome.**
- **macOS — VoiceOver:** System Preferences → Accessibility → VoiceOver; add a
  Japanese voice (Kyoko/Otoya) in VoiceOver Utility → Speech. VoiceOver switches
  language on nodes with `lang="ja"`. **Recommended pairing: VoiceOver + Safari.**

### 2. Start the app and reach a session

- `npm run dev` against a **real Supabase** project (no fake/local backend —
  AD-12/AD-13: a single real project).
- Sign in with an account that has **at least the first lesson unlocked**, so you
  can reach a session with exercises. Start the session until you see a card
  (prompt + Japanese sentence + options).

### 3. Walk through the session

With the screen reader on:

1. **Prompt → sentence → options.** Navigate from the top (prompt, then the Japanese
   sentence, then the options). Listen to how the **Japanese sentence** is read:
   note whether the base text is read **once** or whether the kana reading (`<rt>`)
   is voiced too, so that it is heard **twice**.
2. **Answer** (click or number key `1`-`9`, see the keyboard contract).
3. **Outcome → explanation → progress.** Check that the reader announces the outcome
   («That answer is correct/not correct.») and the progress («X of N completed»)
   from the live region, and that the explanation is read in the **right language**
   (`lang` on the node). Note whether outcome + progress is announced **ONCE (not
   repeated/doubled)**: a duplicated announcement reveals at runtime the "more than
   one live region / duplicated announcement" failure that the automated test cannot
   catch (mirroring AC1's "sentence read once vs twice" check).
4. Observe the overall **order**: prompt → options → outcome → explanation, with no
   jumps.

## Measured outcome

> **TO BE RUN by the operator.** This section has no results until a real screen
> reader has walked through the session. DO NOT fabricate results: the agent cannot
> run a screen reader or hear a Japanese TTS voice.

**How to record.** For each AC, replace the `_to be run_` placeholder in the
"Measured outcome" column with **OUTCOME: PASS** or **OUTCOME: FAIL** plus a short
note on what was heard (e.g. «PASS — sentence read only once, kana not voiced»),
and fill in the last column with the **date / browser / screen reader / voice**
used. Do not leave cells half done: either `_to be run_` (not measured yet) or a
PASS/FAIL outcome with a note.

| AC | Expectation | Measured outcome | Date / browser / SR / voice |
| --- | --- | --- | --- |
| **AC1** | The Japanese sentence is spoken **once** (not twice); `<rt>` is not voiced. | _to be run_ | _to be run_ |
| **AC2** | Understandable order: prompt → options → outcome → explanation, with no jumps. | _to be run_ | _to be run_ |
| **AC3** | Progress («X of N completed») is announced by the single live region `aria-live="polite"`. | _to be run_ | _to be run_ |

## Defects

> **TO BE FILLED IN by the operator during the real run.** Record here every
> mismatch between the expected behaviour and what the screen reader actually did
> (e.g. sentence read twice, order reversed, progress not announced). If no defect
> shows up, say so explicitly. No defect is pre-recorded: the list stays empty until
> the operator measures.

- _(no defect recorded — to be filled in at the run)_

## Definition of complete, and when to run it again

- **Complete when:** all three AC rows ("Measured outcome") have a recorded outcome
  (PASS/FAIL with a note) **and** the defects are listed, or "no defects" is stated
  explicitly. While an AC row is still `_to be run_`, the audit is incomplete.
- **Run it again after any change to:** `src/ui/JapaneseText.tsx` (ruby /
  `aria-hidden` — AC1's surface), `src/features/study/ExerciseCard.tsx` or
  `src/features/study/ExplanationPanel.tsx` (reading order — AC2's surface), or the
  live region in `src/features/study/SessionScreen.tsx` (outcome/progress
  announcement — AC3's surface). This is the convention of the repo's durable
  contract documents (`docs/session-keyboard-contract.md`, `docs/i18n-boundary.md`):
  the record goes **stale** when its code surface changes, and must be measured
  again.

## Known adjacent items (outside the scope of 7.6)

These **app-wide** a11y items had been parked "for the 7.6 audit", but they are
**not** in the Acceptance Criteria of 7.6 (the session path). They are **code
changes** belonging to other stories, not what 7.6 asks for; fixing them is out of
scope. While the screen reader is on, the operator **may** check them
opportunistically and note them, but fixing them belongs to the stories that own
them:

- **DW-10** (`_bmad-output/implementation-artifacts/deferred-work.md:79-85`) —
  visible focus ring (`focus-visible`) missing on **app-wide** interactive elements
  (auth/settings/shell). In the session, by contrast, the focus ring is present
  (keyboard contract, section 5).
- **DW-14** (`_bmad-output/implementation-artifacts/deferred-work.md:113-118`) —
  a11y wiring of the **destructive confirmation** (account deletion): the trigger
  lacks `aria-expanded`, focus handling on the phase transition and the live
  announcement of the state change are missing.
