# The three-way boundary of AD-14

No visible interface string is hard-coded. The rule is enforced
**mechanically** by the compiler (`tsc` strict): i18n keys are typed through
declaration merging on i18next's `CustomTypeOptions`, so that `t()` with a key
that does not exist is a **compile error**, not a runtime failure
(see `src/i18n/i18next.d.ts` and `src/i18n/en.ts`).

But not all rendered text goes through the translator. The boundary has **three
sides**, and every piece of text belongs to exactly one of them:

## 1. Interface — from `t()`

Every interface string (labels, messages, titles, button text) goes through the
typed translator `t()`, with keys defined in the catalogues `src/i18n/en.ts`
and `src/i18n/it.ts` (same set of keys, parity checked by a test). The
`src/i18n/` layer — and only that layer — imports `i18next`/`react-i18next`;
`ui`/`features` get `t`/`useTranslation` from the re-export (AD-1 edges). Today
the catalogue is minimal (`app.tagline`); the interface consumers arrive with
authentication (story 1.6+).

## 2. Lesson content — from the lesson file

Teaching content (sentences, exercises, lesson explanations) does **not** go
through `t()`: it is content data, not an interface string, and it lives in its
own lesson file. Translating it with `t()` would mix up two separate axes (the
interface language versus the language/content of the lesson).

In Epic 1 this side **has no consumers yet**: lesson content arrives in Epic 2.
The boundary is nonetheless documented and enforced already here, because AD-14
applies itself from this point on instead of becoming a final clean-up epic.

## 3. Japanese — from neither

Japanese rendered as such (starting with the product's own name, 積ん読ゼロ) is
**data**: it goes through neither `t()` **nor** the lesson file. The node that
holds it carries the `lang="ja"` attribute (for typography and accessibility),
and **no CJK character** appears in the `en`/`it` catalogues (checked by a
test). No romaji is introduced.

Example in the code (`src/ui/App.tsx`):

```tsx
<h1 lang="ja">積ん読ゼロ</h1>   {/* data: Japanese, never from t() */}
<p>{t('app.tagline')}</p>       {/* interface: from t() */}
```
