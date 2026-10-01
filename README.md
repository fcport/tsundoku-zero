# Tsundoku Zero

積ん読ゼロ — clear the pile.

**[tsundokuzero.federicocasadei.dev](https://tsundokuzero.federicocasadei.dev)**

Japanese grammar exercises that go with the video lessons of
[Cure Dolly](https://www.youtube.com/channel/UCkdmU8hGK4Fg3LghTVtKltQ), one
lesson at a time. I am studying Japanese with
[30 Day Japanese](https://learnjapanese.moe/routine/) by TheMoeWay, which
recommends those lessons for grammar. They are excellent, but there are very few
exercises to go with them, and whatever you do not practise you forget. So as I
work through the lessons I add them here and write their exercises, so that
anyone can use them.

The name is the product's metric: the exercises waiting for review are "the
pile", and the daily goal is to bring it to zero. The project is independent: it
is not affiliated with Cure Dolly or TheMoeWay, and the exercises are original.

## How it works

- **Lessons.** Each lesson matches a video and declares its grammar points.
  Exercises come in three kinds: pick the right answer (`single-select`), mark a
  part of the sentence (`select-span`), build a sentence from tiles
  (`assemble`). Every answer comes with its explanation.
- **The pile.** When you unlock a lesson, its exercises go onto the pile. The
  next lesson unlocks only when the pile is empty, with a daily cap you can
  change in the settings.
- **Spaced repetition.** Each exercise has a level, and the level decides how
  many days until it comes back:

  | Level        | 0         | 1     | 2      | 3      | 4       | 5       |
  | ------------ | --------- | ----- | ------ | ------ | ------- | ------- |
  | Comes back   | right away | 1 day | 3 days | 7 days | 16 days | 35 days |

  A correct answer moves up one level. Correct but with the explanation open
  stays at its level, with a shorter interval. A wrong answer goes back to zero
  and is asked again in the same session. After a correct answer given without
  the explanation there is also **Easy**, which moves up two levels: it is for
  the things you know without thinking.
- **At 2 a.m.** Due dates fall at the start of the study day, 2 a.m. local time:
  the whole pile fills up at once and does not grow during the day.
- **Outside the pile.** From the Lessons page you can watch the video again and
  freely practise any lesson you have unlocked; there is also a drill on verb
  forms. Neither touches the pile.
- Furigana and translations are switched on and off from the page spine; the
  interface is in English and Italian.

## The stack

React 19 and TypeScript in strict mode, Vite, React Router, Zustand for UI
state, TanStack Query for server state (with a queue of answers that survives
closing the app and losing the network), Supabase (Postgres, Auth, Row Level
Security), i18next, Tailwind. Tests with Vitest and Playwright. Deployed on
Vercel.

```
src/domain/       the study logic, pure: scheduling, "due", outcome, furigana, streak
src/data/         the Supabase adapters, behind the domain's ports
src/ui/           interface primitives and the design system
src/features/     the screens
src/app/          the wiring: routes, guards, ports
content/lessons/  the lessons and their exercises, one JSON file per lesson
supabase/         migrations and the account deletion Edge Function
docs/             detailed documentation (in Italian)
```

## Running it locally

You need Node 20.19 or newer and a Supabase project.

```sh
npm ci
cp .env.example .env   # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

| Command                         | What it does                                                    |
| ------------------------------- | --------------------------------------------------------------- |
| `npm test`                      | unit and integration tests (Vitest)                             |
| `npm run lint`                  | ESLint, including the boundaries between layers                 |
| `npm run typecheck`             | TypeScript, no emit                                             |
| `npm run validate-content`      | validates the lessons under `content/lessons/` against the schema |
| `npm run generate-content-seed` | generates the content seed migration                            |
| `npm run check-contamination`   | compares the exercises with the source transcript (local only)  |
| `npm run test:e2e`              | the full path in a real browser, against Supabase               |

Migrations are never applied by hand: CI applies them on merge to `main`
(`.github/workflows/migrate.yml`), and on a pull request they are only
validated.

## The two licences

The repository carries **two distinct licences**, in two separate files:

- **`LICENSE`** — the application **code**, under the **MIT** licence.
- **`LICENSE-CONTENT`** — the lesson **content** (the files under
  `content/lessons/`), under **Creative Commons Attribution-ShareAlike 4.0
  International** (`CC-BY-SA-4.0`).

They are kept separate on purpose. MIT is written for software, and applying it
to the lessons would be a category error: the lessons are teaching material, not
code. CC BY-SA is written for creative works: it requires attribution and, with
*share-alike*, keeps derivatives open. Two separate files let you reuse the code
or the content independently, each on its own terms. It follows from the
principle behind how exercises are written: **the content is open, the wording
is closed** (see `docs/authoring-pipeline.md`).

One exception to both: the sentence audio under `public/audio/` is generated
with [VOICEVOX](https://voicevox.hiroshiba.jp/) using the voice **No.7**, and it
follows that voice's terms, not MIT or CC BY-SA: non-commercial use, credited as
«VOICEVOX:No.7». It is regenerated with `npm run generate-audio` (VOICEVOX open,
`ffmpeg` on the PATH), which also checks every reading against the hand-written
kana of the sentence.

## Why Leitner and not SM-2 or FSRS

Scheduling is a modified Leitner system: six levels with growing intervals,
`again` back to zero, `good` up one, `easy` up two, `hard` keeping the level and
shortening the interval. Due dates fall at 2 a.m. in the student's time zone,
with a deterministic spread of a few days on long intervals, so reviews do not
all pile up on the same day.

It is **simpler than SM-2 and easier to defend**, and right for the scale of the
project. SM-2 and FSRS optimise the forgetting curve over large volumes with
statistically estimated parameters; here the value lies in an algorithm you can
read, explain and test down to the edge cases, daylight saving changes
included. The architectural boundary keeps the choice reversible: moving to
SM-2 or FSRS would change **only** the domain module.

## Why the domain does not depend on the framework

`src/domain/` holds scheduling, the definition of "due", the study streak, the
registry of exercise kinds and the outcome calculation. It knows nothing about
React, the network or Supabase, and it never reads the clock: time and time zone
**come in as parameters**. Everything else depends on the domain; the domain
depends on nothing.

The rule is not left to discipline: it is **enforced by the linter**.
`eslint-plugin-boundaries` declares the layers `domain → data → ui → features →
app` and forbids every edge that is not allowed; the domain cannot import
external packages or touch `fetch` or `localStorage`. A violation turns CI red,
and `src/boundaries.test.ts` checks it. As a result the study logic is tested
without mocks, and swapping the algorithm or the interface stays a local change.

## Why Supabase, and what would change at a larger scale

Supabase provides authentication and per-user data without writing a server.
The app is a static frontend: the only server code is the Edge Function that
deletes an account. Data isolation is enforced by Row Level Security on every
per-user table, and a test checks it.

There is **a single Supabase project, the real one**: development, CI and e2e all
run against the same database. The upside is that tests exercise the real
configuration. The cost is that real study data sits next to test data:
migrations are applied only on merge to `main`, and every test run uses a user
with a unique email that it deletes at the end. With more users it would need a
staging environment and a separate test database, a plan that does not pause,
and a migration path that never touches production data from a branch.

## Why Vite and not Next

Next was **considered and rejected**, for three reasons:

1. **There is nothing to render on the server.** Almost everything sits behind
   sign-in and shows personal data; the only public pages are sign-in, "How does
   this work?", privacy and acknowledgements.
2. **It would add a second system of boundaries.** Server and client components
   would cut across the domain layers, with different tools to check them, in a
   project whose point is to have **one** boundary, enforced by the linter.
3. **API routes would open a second door to the server**, where today there is
   only the account deletion Edge Function.

The decision reopens only if the product changes: if grammar points became
public pages meant to be indexed, Next's static generation would be the right
choice.

## What was left out, and why

The project has a single purpose and does not try to compete with Anki,
WaniKani or Bunpro. Deliberately left out: audio and text-to-speech, kanji
stroke order, user-made decks and CSV import, social features and leaderboards,
sign-in with external accounts, native apps, and **vocabulary** as the unit of
study (the project started there and turned to grammar). If something became
truly necessary, it comes in with a written justification, not quietly.

## How AI was used

AI is used **to write the content, never at runtime**: the app serves static,
already validated exercises and generates nothing on the fly. The **authoring
pipeline** starts from a lesson transcript and ends with an exercise file that
matches the schema. The line it follows is the one between **fact and
wording**: the grammar fact is taken from the transcript and rewritten from
scratch; the source's sentences, examples and metaphors do not cross over.
Details are in `docs/authoring-pipeline.md` and `docs/authoring-runbook.md`.

- **Delegated:** extracting the facts from the transcript and drafting sentences
  and explanations from those facts.
- **Refused:** reusing the source's wording (a paraphrase with synonyms is still
  a derivative work) and its teaching metaphors, even as labels; and any language
  model inside the product.
- **Where it costs more time than it saves:** the **mandatory human review**
  before every commit and the **anti-contamination check**
  (`npm run check-contamination`), which flags literal overlaps between the
  exercises and the transcript (see `docs/contamination-check.md`).

The stated limit of the anti-contamination check is that
**it is not a CI gate**: the transcript stays out of the repository
(`.gitignore`, `.authoring/`), so in CI there would be nothing to compare with,
and a check there would be an empty green. It runs locally, as part of the human
review. Every other check (content validation, boundaries, types, tests) blocks
the merge in CI; this one does not, by design.

## Author

Federico Casadei — [federicocasadei.dev](https://federicocasadei.dev) ·
[GitHub](https://github.com/fcport)
