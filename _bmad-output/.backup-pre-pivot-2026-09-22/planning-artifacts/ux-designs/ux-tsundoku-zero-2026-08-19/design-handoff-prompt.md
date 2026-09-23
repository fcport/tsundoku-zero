# Design Handoff — Tsundoku Zero

Prompt assemblato dalla Discovery per un producer visivo esterno.

**Producer di riferimento:** [Google Stitch](https://stitch.withgoogle.com) — emette `DESIGN.md` + HTML per schermata.
**Alternative equivalenti:** Vercel v0, Figma Make, Galileo, Anima.

## Come si usa

1. Incolla nel producer **tutto ciò che sta sotto la riga `PROMPT`**.
2. Genera. Per Stitch, una schermata per volta seguendo la lista in `## Screens`.
3. Salva gli output in questo workspace: HTML in `mockups/`, eventuali export in `imports/`.
4. Quando gli output esistono, rientra con **`bmad-ux` in modalità Update**: estraggo le decisioni visive negli spine e riconcilio i conflitti.

## Regola di precedenza

`DESIGN.md` e `EXPERIENCE.md` **vincono su qualsiasi output del producer.** Se Stitch propone un verde di successo, una mascotte o quattro pulsanti colorati, ha torto — sono cose rifiutate esplicitamente in Discovery. Il producer decide composizione, proporzioni e dettaglio; non decide identità né comportamento.

## Perché il prompt è in inglese

I producer visivi rendono sensibilmente peggio su prompt non inglesi. Il prompt è input per una macchina, non documentazione: la lingua dei documenti resta l'italiano.

---

# PROMPT

Design a responsive web application called **Tsundoku Zero**. Produce clean, production-quality HTML and CSS for each screen listed below.

## What the product is

A single-purpose spaced-repetition app for Japanese JLPT N5 vocabulary. The user opens it, clears a queue of due words down to zero, and closes it. That is the entire product. It is deliberately NOT a platform: no lessons, no grammar, no audio, no social features, no user-created decks.

The name means "the pile of unread books, at zero." The product metaphor is **emptying a pile**.

## Who uses it, and where

One adult self-studying Japanese, on two devices with the same account:

- **Phone, 8:10 AM, on a moving subway train, one hand.** This is the PRIMARY surface. It must work with a thumb, at arm's length, at full screen brightness, and it must survive the network dropping mid-session without any visible interruption.
- **Laptop, evening, keyboard only.** Secondary. Same layout with more air; the keyboard becomes the primary input.

## Aesthetic direction — follow this exactly

**Paper and ink.** Warm off-white ground, near-black warm ink, one single accent color, generous whitespace. Calm, quiet, adult, typographic. The warmth comes from the paper-toned background and the spacing, never from color or illustration.

The Japanese text is the hero of every screen. Everything that is not Japanese gets smaller, greyer, and out of the way.

**This is explicitly NOT:** cute, playful, gamified, pastel, mascot-driven, or illustrated. No characters. No confetti. No badges. No celebration animation. No success green anywhere in the system. The completion screen — the reward moment — is expressed with whitespace and the accent color only.

## Design tokens — use these literal values

### Colors, light mode

```
surface-base      #FAF7F0   page background (warm off-white, never pure white)
surface-raised    #FFFFFF   the study card only — the single lifted surface
surface-sunken    #F1ECE1   progress track, empty-state grounds
ink-primary       #1C1A17   Japanese text, meanings, numbers
ink-secondary     #6B6459   labels, metadata
ink-muted         #797065   attribution, timestamps
border-hairline   #E3DCCE   decorative dividers ONLY
border-strong     #9B8D7B   boundary of anything tappable
accent            #1F4A7A   deep indigo — means "this advances"
accent-hover      #173A61
accent-subtle     #E8EEF6   informational state grounds
danger            #9B3A2F   madder red — means "this sets you back"
danger-subtle     #F7E9E6
focus-ring        #2F6FB0
```

### Colors, dark mode — a peer, not an afterthought

```
surface-base-dark    #161513      ink-primary-dark    #F2EEE6
surface-raised-dark  #1F1E1B      ink-secondary-dark  #A8A196
surface-sunken-dark  #100F0E      ink-muted-dark      #8D8477
border-hairline-dark #332F2A      border-strong-dark  #70675B
accent-dark          #7FB0DC      accent-hover-dark   #9CC4E6
accent-subtle-dark   #1B2A38      danger-dark         #E08476
danger-subtle-dark   #38211E      focus-ring-dark     #7FB0DC
```

All pairs are verified WCAG 2.2 AA. Do not adjust them for aesthetics.

### Typography

Two families, strict boundary:

- **Noto Sans JP** — all Japanese content
- **Inter** — all interface text (English and Italian)

```
word-hero          Noto Sans JP  64px  w500  line-height 1.75   (44px on mobile)
word-ruby          Noto Sans JP  0.42em w400                    (furigana)
reading            Noto Sans JP  20px  w400
meaning            Inter         22px  w400
count-hero         Inter         72px  w600  tracking -0.03em   (56px on mobile)
display            Inter         28px  w600
body               Inter         16px  w400
label              Inter         14px  w500
label-caps         Inter         12px  w500  tracking 0.08em
caption            Inter         13px  w400
attribution        Inter         11px  w400
```

The 1.75 line-height on `word-hero` is functional: it reserves vertical room for furigana ruby text above the kanji. Do not tighten it.

### Spacing, radii, elevation

4px scale: 4, 8, 12, 16, 24, 32, 48, 64. Gutter 20px mobile / 32px desktop. Content column capped at 34rem and centered — never stretched full-width on desktop.

Radii: 4px tags, 8px buttons and inputs, 12px the study card, 9999px progress bar and streak pill. Keep them modest — no bubbly, comic-style rounding.

**No shadows anywhere.** Separation comes from hairline borders and the tonal step between `surface-base` and `surface-raised`.

Every interactive target is at least 56px tall, no exceptions on mobile.

## Hard rules — these are not suggestions

1. **At most ONE primary action per screen.** Never two call-to-action buttons on the same screen, not even one disabled.
2. **The accent color appears once per screen**, on the thing that advances. Never on headings, decorative borders, or icons.
3. **Rating buttons: four in one row, left to right — `Again` · `Hard` · `Good` · `Easy`.** Three are visually identical and neutral. **Only `Again` carries color** (`danger` text on `danger-subtle` ground, `danger` border). Never four different colors: hue is the weakest channel for ordered data and the worst for colorblind users; order is already carried by position, label, and number.
4. **Furigana is the answer, not the prompt.** In the prompt state, only the kanji is visible — no kana, no romaji, no meaning. Furigana appears as `<ruby>` text above the kanji only after the reveal, together with the meaning.
5. **A dataset attribution line must appear on every screen that displays vocabulary** — dashboard, study, statistics. Text: "Vocabulary data from JMdict/EDRDG (CC BY-SA 4.0) and tanos.co.uk (CC BY)". 11px, `ink-muted`, pinned to the bottom of the layout, above a hairline rule. This is a licence obligation, not a footer nicety. It cannot be collapsed, hidden behind an "About" page, or made dismissible.
6. **On mobile, the four rating buttons live in the bottom 120px of the screen.** The word sits at the top, the hand stays at the bottom, and they never swap.
7. **Every empty state says WHY it is empty** and offers at most one action. Never an empty chart, never a mute screen.
8. **No romaji anywhere in the interface.** The data contains it; the UI does not show it.

## Screens

Produce these. Priority 1 first.

### Priority 1 — the core loop

**1. Dashboard — pile has items.** A very large number (`count-hero`) showing how many words are due, with its label *below* the number, not above. A streak pill. One primary button: "Study". Attribution line at the bottom. Nothing else.

**2. Study — prompt state.** A single white card on the warm ground, centered. One Japanese word in `word-hero` — e.g. 駅 — and nothing else: no reading, no meaning, no furigana. A thin 4px progress bar showing session completion. The four rating buttons are **not present at all** in this state — not greyed out, absent. Full-width tap target on the card to reveal.

**3. Study — revealed state.** Same card. Now the kanji carries furigana ruby above it (えき above 駅), and the meaning appears below in `meaning` type. The four rating buttons appear in the bottom band.

**4. Completion.** The pile reached zero. Confirms the result and the updated streak. Expressed with whitespace and the accent color. No checkmark icon, no green, no celebration graphic. One primary action to leave.

### Priority 2 — the second quest and the empty states

**5. Dashboard — pile empty, new items available.** The count does NOT become "0". The screen changes state: it states the pile is clear and the primary action becomes "Add 10 new words". This is the second of exactly two quests, and it only ever appears once the first is closed.

**6. Dashboard — first-ever visit.** Technically the same empty state as screen 5, but it must read differently: this user has never studied anything. Screen 5 means *you finished*; this one means *start here*. A new user must reach their first card within 60 seconds of arriving.

**7. Dashboard — dataset exhausted.** Nothing due, nothing new left. States this explicitly. **This is the only screen in the app with no primary action.**

**8. Statistics — with data.** Reviews over time, distribution of words by scheduling stage (six stages, 0 to 5), and the words most often failed. The last one must be actionable — a person should recognise their own personal nemesis word in it.

**9. Statistics — insufficient data.** Each chart states what is missing and how much: "This chart needs at least 3 days of reviews." Never a blank chart frame.

### Priority 3 — the edges

**10. Sign in / sign up.** Email and password. No email confirmation step, no onboarding, no level questionnaire. One line stating what the app does. Inline field-level error messages.

**11. Settings.** Exactly two settings — interface language (English / Italian) and new words per day (default 10) — plus account deletion. The delete confirmation must state the consequence plainly: all review history is destroyed and statistics do not survive.

**12. Sync indicator.** Not a screen — a small, quiet pill in the top area, `caption` type in `ink-muted`, reading "2 reviews waiting to sync". It must NOT use the danger color: a queued review is the system working as designed, not an error. It is absent entirely when the queue is empty.

## Microcopy voice

Count first, verb second. No exclamation marks, no emoji, no praise.

```
DO                                     DON'T
"23 to review"                         "You have 23 items waiting!"
"Study"                                "Start your learning session"
"Pile empty. Add up to 10 new words."  "Great job! 🎉 Nothing left today!"
"Pile at zero. 7 days running."        "Congrats! 7 day streak! Keep going!"
"Wrong password."                      "The credentials entered are incorrect."
"2 reviews waiting to sync."           "Network error! Changes may be lost!"
```

A failure states what happened, never how to feel about it.

## Responsive

- **< 640px — phone, primary surface.** Single column, 20px gutter, rating buttons in the bottom band, card full width.
- **640–1024px — tablet.** Single centered column capped at 34rem; rating buttons move directly under the card.
- **≥ 1024px — laptop.** Content centered at 34rem, **not widened**. Statistics may go two-column. Keyboard is the primary path.

## Accessibility

WCAG 2.2 AA. Visible focus ring on every interactive element. Tab order matches reading order — in the study session: card, then the four buttons left to right. The four outcomes are never distinguished by color alone. Any node containing Japanese carries `lang="ja"`. Furigana `<rt>` elements are `aria-hidden` with `<rp>` fallback parentheses, because a screen reader with a Japanese voice already speaks the reading.

Keyboard contract, fixed: **Space** reveals, **1 2 3 4** rate in the order Again / Hard / Good / Easy, **Esc** leaves the session.
