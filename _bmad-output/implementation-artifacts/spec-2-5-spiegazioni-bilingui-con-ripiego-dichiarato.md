---
title: "Story 2.5: Spiegazioni bilingui con ripiego dichiarato"
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: '20521b0197d2e3390f451ad885d0ec336c075430'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Lo schema `explanation` di 2.1/2.2 già impone `en` obbligatorio non vuoto e `it` facoltativo (AC1 e AC3-schema retti). Ma FR8.5 chiede di più: quando l'italiano manca, si deve mostrare l'inglese **dichiarando** che la traduzione non c'è ancora, invece di far sembrare l'inglese la versione italiana. Oggi nessun codice esprime questa DECISIONE di ripiego: il commento di `exercise.ts` la rimanda a «storia 2.5», ma la funzione non esiste. Senza di essa Epic 3 dovrebbe reinventare il contratto — proprio ciò che «Epic 2 · uso Epic 3» vieta.

**Approach:** Consegnare alla superficie di dominio la funzione pura `resolveExplanation(explanation, language)` che, come `check()`, incarna una decisione del contratto: ritorna il testo da mostrare, la lingua effettivamente resa, e `isFallback` — il segnale che l'interfaccia consuma per dichiarare «non ancora tradotta». La resa del banner e del pannello è Epic 3; qui si consegna il contratto e i suoi test.

## Boundaries & Constraints

**Always:**
- La superficie osservata è la funzione di dominio `resolveExplanation(explanation: Explanation, language: ExplanationLanguage): ResolvedExplanation` — l'outermost surface entro Epic 2 (come `check()` è la superficie del «giudizio», reso poi da Epic 3).
- **AC2 (ripiego dichiarato):** `resolveExplanation(e, 'it')` con `e.it` **assente** ⇒ `{ text: e.en, language: 'en', isFallback: true }`. Con `e.it` **presente** ⇒ `{ text: e.it, language: 'it', isFallback: false }`.
- **`'en'` richiesto non è mai un ripiego:** `resolveExplanation(e, 'en')` ⇒ `{ text: e.en, language: 'en', isFallback: false }`, anche quando `e.it` esiste. `language` nomina la lingua **effettivamente** mostrata.
- **AC3 (contenuto, non i18n):** `text` è il contenuto **letterale** della spiegazione (mai una chiave `t()`); la funzione vive in `src/domain/` senza alcun import da `src/i18n`.
- `ExplanationLanguage` è un tipo **domain-local** (`'en' | 'it'`), NON importato da `src/i18n` (AD-1 vieta domain→i18n). Mirror dell'asse linguistico proprio della spiegazione, distinto da `supportedLocales` dell'app.
- Funzione **pura e totale** (AD-1): nessun import oltre i tipi già usati da `exercise.ts`; nessun React/Supabase/rete/orologio/`Math.random`. Risultato con campi `readonly`, sullo stile di `CheckOutcome`.
- TypeScript strict, **nessun `any`**.

**Block If:**
- _Nessun blocco._ Storia interamente in-repo (dominio puro + test): nessuna azione umana né vendor. Esito atteso `done`.

**Never:**
- **Non** cambiare il comportamento dello schema `explanation`: `en` resta `nonEmptyString()` obbligatorio, `it` resta `optional(nonEmptyString())` — 2.1/2.2 ne sono proprietarie.
- **Non** importare `Locale`/`supportedLocales`/nulla da `src/i18n` nel dominio (AD-1); **non** far passare il contenuto della spiegazione da `t()` (AC3).
- **Non** aggiungere la chiave i18n né la resa dell'etichetta «non ancora tradotta»/`explanation-panel`: sono Epic 3 (FR4.3/FR4.8, UX `explanation-panel`). Aggiungerle ora sarebbe una superficie senza consumatore.
- **Non** generalizzare a locale arbitrari o a lingue oltre `en`/`it` (YAGNI: lo schema ne ha esattamente due).
- **Non** toccare `exercise-identity.ts`/`uuid.ts`/`lesson.ts`/`schema.ts`: la spiegazione è **esclusa** dall'identità (AD-23) e questo resolver di sola lettura non lo cambia.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| inglese richiesto | `resolveExplanation(e, 'en')` | `{ text: e.en, language: 'en', isFallback: false }` | n/a (totale) |
| italiano presente | `e.it` definito, `resolveExplanation(e, 'it')` | `{ text: e.it, language: 'it', isFallback: false }` | n/a |
| italiano assente ⇒ ripiego dichiarato | `e.it` assente, `resolveExplanation(e, 'it')` | `{ text: e.en, language: 'en', isFallback: true }` (AC2) | n/a |
| inglese richiesto con it presente | `e.it` definito, `resolveExplanation(e, 'en')` | `{ text: e.en, language: 'en', isFallback: false }` — l'en richiesto non è ripiego | n/a |

</intent-contract>

## Code Map

- `src/domain/exercise.ts` — **MODIFICA.** `explanation` (righe 46-49) + tipo `Explanation` (52) sono il value object (en obbligatorio non vuoto, it opzionale non vuoto): 2.5 ci costruisce SOPRA, non li cambia. Aggiungere subito dopo: tipo `ExplanationLanguage = 'en' | 'it'`, interfaccia `ResolvedExplanation { readonly text; readonly language; readonly isFallback }`, e la funzione pura `resolveExplanation()`. Aggiornare il commento 41-44 perché punti a `resolveExplanation` invece che a «è storia 2.5». Modellare il risultato su `CheckOutcome` (143-145, `readonly`) e lo stile puro/totale su `check()` (171-201).
- `src/domain/exercise.test.ts` — **MODIFICA.** Il blocco `explanation (AC3)` (righe 41-73) ancora già AC1 (en obbligatorio/it opzionale/rifiuti) — **riferimento, non duplicare**. Aggiungere `describe('FR8.5 — spiegazioni bilingui con ripiego dichiarato (2.5)')` con i quattro casi della matrice + un test-ancora per AC3 (`text` è esattamente la stringa di contenuto, non una chiave).
- `src/domain/schema.ts` — **RIFERIMENTO (non modificare).** `optional()` (102) + `object()` (269, righe 281-283): una chiave opzionale assente **resta assente**, perciò `explanation.it` è `string | undefined` e `explanation.it !== undefined` è la guardia corretta.
- `src/i18n/locales.ts` — **RIFERIMENTO (non importare).** `Locale = 'en' | 'it'` vive qui; AD-1 vieta domain→i18n, quindi il dominio definisce il proprio `ExplanationLanguage`. Il mapping app-Locale→ExplanationLanguage è confine di Epic 3.
- `src/boundaries.test.ts` — **RIFERIMENTO.** Rende `domain→external` (i18n incluso) un ERRORE ESLint: è l'ancora **strutturale** di AC3 (il dominio non può usare `t()`).
- `src/domain/exercise-identity.ts` — **RIFERIMENTO (non modificare).** `explanation` è esclusa dall'identità (AD-23); un resolver di sola lettura non la tocca (già coperto da `exercise-identity.test.ts`).

## Tasks & Acceptance

**Execution:**
- `src/domain/exercise.ts` — aggiungere `ExplanationLanguage`, `ResolvedExplanation` e `resolveExplanation()` (pura, totale, esaustiva su `'en' | 'it'`); aggiornare il commento del value object per attribuire il ripiego a questa funzione. Nessun cambio di schema, firma o comportamento esistente.
- `src/domain/exercise.test.ts` — aggiungere il blocco `FR8.5` con i quattro casi della matrice e il test-ancora AC3 (contenuto letterale, non chiave). Fixture inline (nessun file in `content/lessons/`, è 2.7).

**Acceptance Criteria:**
- Given un esercizio descritto, when se ne definisce la spiegazione, then `en` è obbligatorio e non vuoto e `it` è facoltativo (AC1 d'epica — già retto dallo schema di 2.1/2.2 e dal blocco `explanation` di `exercise.test.ts`; 2.5 non lo modifica).
- Given un esercizio con la sola spiegazione inglese, when un utente con lingua italiana lo incontra — reso da `resolveExplanation(e, 'it')`, then ritorna `{ text: e.en, language: 'en', isFallback: true }`: si mostra l'inglese e si **dichiara** il ripiego (AC2 d'epica). La resa del banner «non ancora tradotta» è Epic 3.
- Given un esercizio con `it` presente, when `resolveExplanation(e, 'it')`, then ritorna l'italiano con `isFallback: false`; e when `resolveExplanation(e, 'en')`, then ritorna l'inglese con `isFallback: false` anche se `it` esiste (l'inglese richiesto non è mai un ripiego).
- Given le spiegazioni, when risolte, then `text` è il contenuto letterale del file di lezione (non una chiave i18n) e `resolveExplanation` vive in `src/domain/` senza import da `src/i18n` (AC3 d'epica, retto da `boundaries.test.ts`).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano senza regressioni e senza alcun `any`.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - none

Quattro layer in parallelo su Opus. **Verification-Gap**: nessun gap — i quattro comandi passano (357/357 test), ogni ramo di `resolveExplanation` è osservato da un `toEqual` su oggetto completo, nessun consumatore mancante (Epic 3 rende la UI by design). **Intent-Alignment**: descrittivo, conferma che il diff implementa la lettura corretta (resolver di dominio + segnale `isFallback`); la clausola AC2 «l'interfaccia dichiara» vive alla superficie UI di Epic 3 per il perimetro dichiarato dall'intento stesso — divergenza di *wording-vs-scope*, non un'omissione rispetto al confine Epic 2. Nessun `intent_gap`/`bad_spec`.

Findings rifiutati (13, tutti low; dedup: la stringa-`it`-vuota dell'Edge-Case Hunter coincide col Blind #4). Rappresentativi: **stringa `it` vuota trattata come presente** — `explanation` è `optional(nonEmptyString())`, quindi un `Explanation` validato non porta mai `it: ''`; il dominio si fida dell'input validato al confine (come `check` con `answer` non vuoto) e `!== undefined` è il test preciso di «chiave presente» che rispecchia `object()`. **param `explanation` ombreggia lo schema omonimo** — lint pulito, verbatim dal golden example, coerente con la convenzione «param nominato come il tipo», schema non usato nel corpo. **mojibake/diacritici** — artefatto del diff incollato nei prompt; i file reali hanno già/Perché/più/è/c'è corretti e zero forme ASCII-stripped (verificato). **«àncora» vs «ancora»** — accento di disambiguazione facoltativo in ortografia standard, senso chiaro dal contesto. **test per lingua fuori union / `as any`** — stato impedito dal type-system (`'en' | 'it'`), YAGNI per contratto. **test di purezza/`readonly`/no-mutation** — la funzione legge soli campi e costruisce literal nuovi; `readonly` è garantito da typecheck. **contenuto letterale del ramo `it` non ri-asserito** — già ancorato dal `toEqual` col literal italiano nel test «italiano presente». **nessun consumatore/e2e con `Exercise` parsato** — composizione garantita dai tipi, consumatore assente by design (Epic 3). **tabella parametrizzata / JSDoc duplicato / `keyof Explanation` / import-order / blank line** — stilistici: i test per-riga aiutano il matrix audit, il commento dello schema è un puntatore breve, la union esplicita forza la riconsiderazione della logica se si aggiungesse una lingua (accoppiarla a `keyof` la maschererebbe), lint pulito. Nessun `defer`: nessun problema pre-esistente reale è emerso.

## Design Notes

**Perché una funzione di dominio e non solo UI.** FR8.5 è mappata «Epic 2 · uso Epic 3»: il ripiego **dichiarato** è parte del CONTRATTO, esattamente come `check()` (deciso nel dominio, reso da Epic 3). Il dominio decide QUALE testo e SE è ripiego; esporre `isFallback` è il segnale che l'interfaccia consuma per dichiarare «non ancora tradotta», invece di far passare l'inglese per italiano. Non è un accessorio di comodo (l'anti-pattern respinto in 2.4): nessun altro codice esprime questa decisione.

**Perché `ExplanationLanguage` domain-local, non `Locale`.** AD-1 vieta l'arco domain→i18n. L'asse linguistico di una spiegazione è intrinsecamente `{en, it}` (per schema): concettualmente distinto da `supportedLocales` dell'app, che oggi coincide ma potrebbe divergere (un locale `fr` non aggiungerebbe una lingua alla spiegazione). Il mapping app-Locale→ExplanationLanguage è lavoro di confine di Epic 3.

Golden example (la funzione):

```ts
export type ExplanationLanguage = 'en' | 'it';
export interface ResolvedExplanation {
  readonly text: string;
  readonly language: ExplanationLanguage;
  readonly isFallback: boolean;
}
export function resolveExplanation(
  explanation: Explanation,
  language: ExplanationLanguage,
): ResolvedExplanation {
  if (language === 'it') {
    if (explanation.it !== undefined) {
      return { text: explanation.it, language: 'it', isFallback: false };
    }
    // it richiesto ma non ancora tradotto: ripiego DICHIARATO su en (AC2).
    return { text: explanation.en, language: 'en', isFallback: true };
  }
  return { text: explanation.en, language: 'en', isFallback: false };
}
```

## Verification

**Commands:**
- `npm run typecheck` — expected: `tsc` strict, nessun `any`; `ResolvedExplanation`/`resolveExplanation` compilano, esaustivi su `'en' | 'it'`.
- `npm run lint` — expected: 0 errori; `exercise.ts` non introduce import da `src/i18n` (retto da `boundaries/external`).
- `npm test` — expected: il blocco `FR8.5` di `exercise.test.ts` passa (quattro casi della matrice + ancora AC3), più le sonde 1.1–2.4 senza regressioni; `exercise-purity.test.ts` resta verde (nessun `Math.random`).
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori.

## Auto Run Result

Status: done

**Sintesi del cambiamento.** Story 2.5 consegnata come *contratto di dominio* del ripiego dichiarato. Lo schema `explanation` (en obbligatorio non vuoto, it opzionale) esisteva già da 2.1/2.2 (AC1 e AC3-schema retti); 2.5 aggiunge la DECISIONE che finora mancava: la funzione pura e totale `resolveExplanation(explanation, language)` che, come `check`, incarna una regola del contratto — ritorna il `text` letterale da mostrare, la `language` effettivamente resa e `isFallback`, il segnale che l'interfaccia (Epic 3) consuma per dichiarare «non ancora tradotta» invece di far passare l'inglese per italiano. `'en'` richiesto non è mai un ripiego; `'it'` presente ritorna l'italiano (isFallback false); `'it'` assente ritorna l'inglese con `isFallback: true` (AC2). Nessuna resa di UI né chiave i18n: sono Epic 3, come da perimetro FR8.5 «Epic 2 · uso Epic 3».

**File cambiati (dalla baseline `20521b0`):**
- `src/domain/exercise.ts` — +~50: tipo domain-local `ExplanationLanguage = 'en' | 'it'` (NON `Locale` di i18n, AD-1), interfaccia `ResolvedExplanation { readonly text; language; isFallback }`, funzione `resolveExplanation()`; commento del value object aggiornato per attribuire il ripiego alla nuova funzione. Nessun cambio di schema/firma/comportamento esistente.
- `src/domain/exercise.test.ts` — +~50: blocco `describe('FR8.5 …')` con i quattro casi della I/O matrix (`toEqual` su oggetto completo) + un test-àncora AC3 (`text` è il contenuto letterale, non una chiave). Fixture inline (nessun file in `content/lessons/`).

**Review findings.** patch applicati: 0; deferred: 0; rejected: 13 (tutti low). Quattro layer su Opus: Verification-Gap nessun gap; Intent-Alignment conferma la lettura corretta (resolver + segnale) con la clausola UI di AC2 correttamente lasciata a Epic 3; Edge-Case Hunter 1 finding (stringa `it` vuota) rifiutato perché impedito dallo schema; Blind Hunter 13→ tutti reject/low (stati impediti dal type-system/schema, purezza/`readonly` già retti da typecheck, contenuto già ancorato, consumatore assente by design, stilistici). Nessun `intent_gap`/`bad_spec`, nessun loopback (`review_loop_iteration` invariato a 0).

**Follow-up review recommendation:** `false`. Patch di questa passata per severità: high 0, medium 0, low 0. Score = 3×0 + 1×0 = 0 (< 5) e nessun high ⇒ `false`.

**Verifica eseguita.** `npm run typecheck` → pulito, nessun `any`; `npm run lint` → 0 errori, nessun import `src/i18n` nel dominio; `npm test` → 357/357 pass (i 5 test FR8.5 girati e passati; `boundaries.test.ts` e `exercise-purity.test.ts` verdi); `npm run build` → `dist/` senza errori. Matrix Test Audit: tutte e quattro le righe coperte da un test che è girato e passato, nessuna in disaccordo con l'implementazione.

**Rischi residui.** Nessuno rilevante alla superficie di 2.5. La resa UI (banner «non ancora tradotta», `explanation-panel`) e il mapping app-Locale→ExplanationLanguage restano a Epic 3, come da contratto. Il tipo `Explanation` permette a compile-time `it: ''`, ma lo schema `optional(nonEmptyString())` lo rifiuta al confine, quindi un valore validato non raggiunge mai `resolveExplanation` in quello stato (coerente con la convenzione «validare al confine, fidarsi nel dominio»).
