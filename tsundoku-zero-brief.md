# Tsundoku Zero — Project Brief

> 積ん読ゼロ — clear the pile.
> A spaced-repetition app for JLPT N5 vocabulary. Open source, publicly deployed.

**Status:** pre-development
**Owner:** Federico Casadei
**Intended workflow:** BMAD-METHOD (this document is the input to the PM agent)

---

## 1. Why this exists

Two goals, in priority order:

1. **A tool I will actually use every day** to study Japanese vocabulary. If I stop using it, the project has failed regardless of code quality.
2. **A demonstrable React/TypeScript codebase** — production-shaped, tested, deployed, and defensible line by line in a technical interview.

The name states the product metric: the number of items waiting to be reviewed is "the pile", and the daily goal is to bring it to zero.

**Non-goal:** becoming a competitor to Anki, WaniKani or Bunpro. This is a focused single-purpose tool.

---

## 2. Scope

### In scope for v1

- Email + password authentication
- N5 vocabulary dataset (~700 items), read-only
- Spaced-repetition scheduling engine
- Daily study session (review the due pile down to zero)
- Streak and basic progress statistics
- Full keyboard operation and screen-reader support
- English and Italian interface
- Account deletion, privacy policy
- Public deployment, open source under MIT

### Explicitly out of scope for v1

Listed so the agents do not "helpfully" add them:

- Audio / text-to-speech
- Kanji stroke-order practice or handwriting input
- Grammar lessons, example sentence banks
- User-created decks, CSV import, deck sharing
- Social features, leaderboards, sharing
- OAuth / social login
- Native mobile apps
- Levels beyond N5
- Offline-first sync conflict resolution

Anything in this list that becomes genuinely necessary goes to v2, with a written justification in the changelog.

---

## 3. Users

Single persona: an adult self-studying Japanese from zero, using the app on a phone during commutes and on a laptop in the evening. Same account, both devices, expects the pile to be consistent between them.

That expectation is the entire reason the app has a backend. It is not incidental.

---

## 4. Functional requirements

**FR1 — Account.** A user can register with email and password, log in, log out, and permanently delete their account. Deletion removes all their review data.

**FR2 — Vocabulary.** The system ships a fixed N5 dataset. Each item has: kanji (nullable), kana, romaji, English meaning, Italian meaning, JLPT level, part-of-speech tag.

**FR3 — Pile.** The dashboard shows how many items are due for review now, the current streak, and a single primary action to start studying.

**FR4 — Study session.** Items are presented one at a time. The prompt is shown; the user reveals the answer; the user self-grades. The session ends when the pile reaches zero.

**FR5 — Scheduling.** Grading an item updates its next review date according to the scheduling algorithm. A wrong answer shortens the interval; a correct answer lengthens it.

**FR6 — New items.** When the due pile is empty, the user may introduce new items from the dataset, capped at a configurable daily limit (default 10).

**FR7 — Statistics.** A stats view shows reviews over time, items by scheduling stage, and the items most frequently answered incorrectly.

**FR8 — Streak.** A day counts toward the streak when the user brings the pile to zero, or completes at least one review if the pile was already empty.

**FR9 — Language.** The interface is available in English and Italian, switchable at runtime, persisted per user.

---

## 5. Non-functional requirements

**NFR1 — Type safety.** TypeScript in strict mode. No `any` in application code.

**NFR2 — Scheduling purity.** The scheduling engine is a set of pure functions with no dependencies on React, the network, the clock, or the database. Current time is always injected as a parameter. This is what makes it testable and is the part of the codebase most likely to be read closely by a reviewer.

**NFR3 — Test coverage.** The scheduling engine is thoroughly unit-tested, including boundary cases. At least the study flow has component tests. One end-to-end test covers register → study → pile reaches zero.

**NFR4 — Accessibility.** The study screen is fully operable by keyboard: space to reveal, number keys to grade. Correct ARIA roles and state. Answer reveal and session progress announced via live regions.

**NFR5 — Data isolation.** Row Level Security is enabled on every user-scoped table. A user can read and write only their own rows. This is verified by an explicit test, not assumed.

**NFR6 — Privacy.** Only email, password hash, and study data are stored. No date of birth, no name, no analytics on individuals. A privacy policy page states what is stored and how to delete it.

**NFR7 — Performance.** The study screen responds to grading without a visible round-trip. Scheduling updates are applied optimistically and persisted in the background.

---

## 6. Technical direction

Proposed, for the Architect agent to confirm or challenge:

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React 19 + TypeScript (strict) | The skill being demonstrated |
| Build | Vite | Fast, minimal config |
| Routing | React Router | Three routes, nothing exotic needed |
| State | Zustand | Small surface, no boilerplate; server state kept separate from UI state |
| Server data | TanStack Query | Cache, optimistic updates, background refetch |
| Backend | Supabase (Postgres, Auth, RLS) | Auth and per-user data without writing a server |
| Styling | Tailwind | Fast iteration, no CSS architecture debate |
| Unit tests | Vitest + Testing Library | |
| E2E | Playwright | Continuity with existing professional work |
| CI | GitHub Actions | Lint, typecheck, test on every PR |
| Hosting | Vercel or Netlify | Static frontend; Supabase hosts data |

**Architectural boundary that matters most:** `src/domain/` contains the scheduling engine and knows nothing about React, Supabase, or the network. Everything else depends on it; it depends on nothing. If this boundary holds, the codebase reads as designed rather than assembled.

---

## 7. Data model (initial sketch)

```
vocabulary            -- shipped dataset, read-only to users
  id                  uuid pk
  kanji               text null
  kana                text not null
  romaji              text not null
  meaning_en          text not null
  meaning_it          text not null
  jlpt_level          text not null
  part_of_speech      text not null

review_state          -- per user, per item
  user_id             uuid fk -> auth.users, on delete cascade
  vocabulary_id       uuid fk -> vocabulary
  stage               int not null      -- scheduling stage / box
  due_at              timestamptz not null
  review_count        int not null
  lapse_count         int not null
  last_reviewed_at    timestamptz null
  primary key (user_id, vocabulary_id)

review_log            -- append-only, powers statistics
  id                  uuid pk
  user_id             uuid fk -> auth.users, on delete cascade
  vocabulary_id       uuid fk -> vocabulary
  outcome             text not null     -- again | hard | good | easy
  reviewed_at         timestamptz not null

user_settings
  user_id             uuid pk fk -> auth.users, on delete cascade
  locale              text not null default 'en'
  new_items_per_day   int not null default 10
```

The separation of the immutable dictionary from mutable per-user progress is deliberate: the dataset can be updated or reseeded without touching anyone's learning history.

---

## 8. Scheduling algorithm

Start with a modified Leitner system — simpler than SM-2, easier to defend, and adequate for a few hundred items.

- Stages 0–5, with intervals of roughly 0, 1, 3, 7, 16 and 35 days.
- `again` sends the item back to stage 0 and increments the lapse count.
- `good` advances one stage.
- `easy` advances two stages.
- `hard` holds the stage and reschedules at roughly 60% of the current interval.
- A small deterministic jitter spreads due dates so the pile does not arrive in clumps.

Signature to hold to:

```ts
function schedule(
  state: ReviewState,
  outcome: ReviewOutcome,
  now: Date
): ReviewState
```

Pure, deterministic, fully unit-tested. If the algorithm is later swapped for SM-2 or FSRS, only this module changes — that is the point of the boundary.

---

## 9. Epics

**Epic 1 — Foundation.** Repository, Vite + React + TS strict, Tailwind, ESLint and Prettier, Vitest, GitHub Actions running lint/typecheck/test, MIT licence, deployment pipeline producing a live URL. Done when an empty app is publicly reachable and CI is green.

**Epic 2 — Domain engine.** `src/domain/`: types, `schedule()`, due-item selection, streak calculation. No UI. Done when the test suite covers the intervals, lapses, boundary conditions and injected-clock behaviour.

**Epic 3 — Data layer.** Supabase project, schema migrations, RLS policies on every user-scoped table, N5 dataset seeded, typed client, a test proving one user cannot read another's rows.

**Epic 4 — Authentication.** Register, log in, log out, delete account, protected routes, session persistence, error states for the obvious failures (wrong password, email already registered, weak password).

**Epic 5 — Study flow.** Dashboard with pile count and primary action; study screen with reveal and grading; session completion state; optimistic updates; full keyboard operation and ARIA.

**Epic 6 — New items.** Introducing unseen vocabulary when the pile is clear, respecting the daily cap; setting to change the cap.

**Epic 7 — Statistics and streak.** Reviews over time, distribution by stage, most-lapsed items, streak display and calculation.

**Epic 8 — Internationalisation.** English and Italian, runtime switching, persisted per user, no hardcoded strings remaining.

**Epic 9 — Launch.** Privacy policy page, account deletion verified end to end, README, screenshots, empty and error states, one Playwright test covering the full journey.

Ship after Epic 9. Everything else is v2.

---

## 10. Definition of done for v1

- Publicly reachable URL; a stranger can register and study within a minute
- Repository public, MIT, README explaining design decisions
- CI green on main
- Scheduling engine tested to the boundaries
- Study screen usable without a mouse
- Account deletion removes all data, verified
- I have personally used it for fourteen consecutive days

The last one is the real acceptance criterion.

---

## 11. README outline

The README is not a feature list. It should answer:

- What this is, in two sentences
- Why Leitner and not SM-2 or FSRS
- Why the domain layer has no framework dependencies
- Why Supabase, and what would change at a larger scale
- What was deliberately left out, and why
- How the AI-assisted workflow was used: what was delegated, what was rejected, where it cost more time than it saved

The last point is worth writing honestly. It is a more interesting document than the code.
