# Operator verifications

Some acceptance criteria cannot be checked by a test: they live outside the
repository (a public domain, an external URL, the real Supabase project) or they
need a human with eyes and ears. The stories that carry them end in
`awaiting-operator` and are closed with `bmad-loop confirm`.

This file is their **evidence**. Without it, the outcome of those checks would live
only in the memory of whoever ran them, and the Definition of Done in PRD §11
could not be inspected by anyone else.

One row per check: what was checked, how, and what was seen. Whoever adds a row
writes the **measured** outcome, not the expected one.

## 7.2 — Acknowledging the source of the method

Checked on 28-09-2026 on the public deploy `tsundoku-zero.vercel.app`.

| Criterion | How | Outcome |
|---|---|---|
| The source's name does not appear in the domain | inspection of the real domain | `tsundoku-zero.vercel.app` — no occurrence of "Cure"/"Dolly" |
| `/acknowledgements` in English | browser on the deploy | attribution present, exercises stated as original, affiliation explicitly denied, academic basis cited (Kuno 1973) |
| `/acknowledgements` in Italian | browser on the deploy, after switching language | same content, translated |
| The link opens the right channel in a new tab | DOM attributes + request to the URL | `href` = `https://www.youtube.com/channel/UCkdmU8hGK4Fg3LghTVtKltQ`, `target="_blank"`, `rel="noreferrer"`; the URL answers HTTP 200 with the title «Organic Japanese with Cure Dolly» |

## 7.5 — Deletion checked table by table

Checked on 28-09-2026 on the real Supabase project, by counting the rows **before and
after** in every table — not inferred from the foreign keys. Test account registered
from the public deploy, first lesson unlocked, one answer recorded via `apply_review`
so that `review_log` is populated too. Deletion invoked on the **same** Edge Function
the app uses (`delete-account`), with the user's JWT.

| Table | Before | After |
|---|---:|---:|
| `auth.users` | 1 | 0 |
| `user_settings` | 1 | 0 |
| `lesson_progress` | 1 | 0 |
| `review_state` | 3 | 0 |
| `review_log` | 1 | 0 |
| `lesson` (content, not per-user) | 1 | **1** |
| `exercise` (content, not per-user) | 3 | **3** |

An extra check, not required by the AC but owed to `AD-11`: the same function
called **without** `Authorization` answers **401**, so it does not delete on an
anonymous request.

## 7.4 — The full path checked by a machine

Checked on 28-09-2026 with pull request #1.

| Criterion | How | Outcome |
|---|---|---|
| "Confirm email" turned off in the Supabase console | Management API (`mailer_autoconfirm`) | already `true`: `signUp` returns a session right away |
| Secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` on GitHub Actions | set on 28-09-2026, read from `.env` | present; no `service_role` among the secrets |
| «E2E (percorso principale)» green on a pull request, against the real Supabase | PR #1 | **2 tests passed** in 17.4s (main path + deletion) |
| After the merge, «Migrate & deploy functions» applies the migrations and THEN runs the acceptance check | run on `main` after the merge | order respected: `db push` → `functions deploy` → `E2E di collaudo`, all green |
| Teardown verified (`AD-13`) | row count on the real project after each run | 0 users left; content intact (1 lesson, 3 exercises) |

A side observation, not required by this story: the PR produced a **dedicated
preview** (`…-git-verifica-e2e-…vercel.app`, separate from production, HTTP 200),
which is AC2 of story 1.2 — until today assumed to work and never tested. The
preview, however, is protected by Vercel authentication: only people with access to
the project can reach it. If previews are meant to be public, that is a setting to
change in Vercel (Deployment Protection), not a defect in the repository.

## Pending

| Story | What is needed | Whose |
|---|---|---|
| 6.3 | the private transcript of the sample lesson in `.authoring/` (never versioned, story 6.1), then `npm run check-contamination` | owner |
| 6.4 | time a real authoring run (M5) and author at least four more lessons with human review (FR11.2) | owner |
| 7.6 | a real screen reader with a Japanese TTS voice (NVDA/VoiceOver) | owner |
