# The session keyboard contract (update to AD-15)

This document is the source of the **keyboard contract** for the exercise screen,
recorded as an **update to AD-15** — not as a local convention scattered through
the code. It follows the same durable precedent as `docs/i18n-boundary.md` for
AD-14: a documentation file with a test that checks it exists and what it says.

## It replaces the old contract

The old AD-15 contract said **"space reveals, `1`-`4` rate"**. It no longer
describes anything: it described a **self-assessment** (the user declared the
difficulty with the `1`-`4` keys) that the product no longer has — the outcome is
**computed, not declared** (AD-24). And the scale could not be fixed at `1`-`4`,
because `assemble` (AD-22) is an **ordering**, not a single choice: the contract has
to cover three different interactions (`single-select`, `select-span`, `assemble`).

This document **replaces** that contract in full.

## The contract

### 1. Number key → position (same mapping for every kind)

A number key `1`-`9` selects the option at the **matching position**:
`'1'` → first option, `'2'` → second, ... The number↔position mapping is the
**same** for single-select, select-span and assemble: by construction, because the
rule lives in a single **pure, kind-agnostic** function,
`keyboardSelectionIndex(key, optionCount)` in `src/domain/keyboard.ts`, which
receives the key string and the number of options — never the exercise kind. The
order of the options is the domain's (`answerOptions`), which is also the reading
order and the tab order.

For `assemble` the key **appends** the tile to the sequence (in order, like a
click); a tile already chosen is skipped. For the other kinds the key picks the
single option. The number key calls the **same** answer function as the click: no
second pipeline. It is active only in the **prompt** phase (before answering); keys
with `Ctrl`/`Meta`/`Alt` are ignored so browser shortcuts are not hijacked.

### 2. Overflow behaviour (declared)

The **number row** covers positions `1`-`9` (`NUMERIC_ROW_SIZE = 9`). Behaviour
beyond the row is **explicitly declared**, not undefined:

- A digit **with no matching option** (e.g. `'4'` with 3 options) is a **no-op**.
- Options **beyond the ninth** cannot be reached with a number key: they are reached
  with `Tab` + `Enter`/`Space` (the focus path, always valid for every option).
- `'0'`, any non-digit key and the empty string are no-ops.

### 3. A single live region

There is **exactly one** `aria-live="polite"` live region for the whole session,
rendered only in the **active** session branch (with the card). It announces the
**outcome** of the answer plus the **progress** (`{{completed}} of {{total}}`). It is
`sr-only` (the visible outcome is already carried by the `ExplanationPanel`, the
progress by the bar). It is **not** rendered on the skeleton, completion or empty
state — so it stays one for the whole session.

### 4. Tab-order = reading order = number key order

The order of the interactive nodes in the DOM is the order of `answerOptions`
(domain), which is also the reading order and the number key order. No positive
`tabindex`.

### 5. Visible focus ring

Every interactive element in the session (options, "Show the explanation",
"Next exercise", "Leave the session") shows a **visible focus ring** via
`focus-visible:` with the `focus-ring` token (`accent-dark` in dark mode, see
`src/ui/theme.css`).

### 6. `Enter` advances, `Esc` exits

In the **explanation** phase (after answering), `Enter` with a non-interactive
target (not a `<button>`/`<a>`/input) advances to the next exercise; on a focused
button the native activation applies (no double advance). `Esc` exits the session in
any phase (already part of the contract since story 3.20, now unified in a single
window-level `keydown` listener).

## Out of scope

The **app-wide** focus ring (auth/settings/shell) is DW-10, which belongs to the
accessibility audit (story 7.6). Manual testing with a **real screen reader**
(NVDA/VoiceOver) also belongs to 7.6, not to this story.
