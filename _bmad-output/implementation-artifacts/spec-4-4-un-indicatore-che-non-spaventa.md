---
title: 'Un indicatore che non spaventa'
type: 'feature'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
baseline_revision: 'b90d6c18d86c42b664016964ca5b4bc806d4e543'
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      L'indicatore conta solo le mutation `['review']` in stato `pending` (in volo
      o `paused`): una valutazione che esaurisce i ritentativi e finisce in `error`
      esce dal conteggio, così l'indicatore sparisce e il fallimento di quella
      risposta non ha alcuna superficie.
    evidence: |-
      `useIsMutating({ mutationKey: ['review'] })` filtra `status: 'pending'`; una
      mutation `error` (dopo `REVIEW_SYNC_MAX_RETRIES`, 4.3) non è più contata. È
      indistinguibile da una coda drenata con successo. Coerente con l'epica, che
      vieta esplicitamente una superficie d'errore/modale «sei offline» e il pulsante
      «riprova»; il RECUPERO di un invio permanentemente fallito resta non garantito.
      Stesso rischio già registrato come deferred nella storia 4.3 (l'indicatore 4.4
      e l'idempotenza 4.5 lo rendono visibile/una-volta, ma nessuno lo recupera).
    location: >-
      src/features/study/SyncIndicator.tsx:28 (filtro `status: pending`)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** La coda di valutazioni ora sopravvive alla chiusura (4.2) e si drena da sola al ritorno della rete (4.3), ma NULLA lo mostra all'utente. Chi risponde senza campo non ha modo di sapere che qualcosa è in attesa di sincronizzazione — e quando lo capirà (o vedrà un errore) rischia di scambiare il funzionamento previsto per un guasto. Serve un segnale che dica «c'è qualcosa in coda» senza interrompere, senza allarmare e senza chiedere azioni.

**Approach:** Un componente `SyncIndicator` (features/study) che DERIVA il suo stato dalla coda reale delle mutation via `useIsMutating({ mutationKey: REVIEW_MUTATION_KEY })` — il conteggio delle valutazioni `pending` (in volo O in pausa offline), MAI uno stato proprio del componente. A coda vuota rende `null` (assente, non «tutto sincronizzato»). A coda non vuota rende una PASTIGLIA discreta, fissa e non bloccante (`pointer-events-none`, nessun overlay), con `role="status"` + `aria-live="polite"` e un testo STABILE e senza conteggio (`t('sync.pending')`), in colore d'accento SOTTOTONO — mai il colore d'allarme. Montato UNA volta nel composition root (`AuthRoot`, livello app) come sovrapposizione indipendente dalla rotta, così è visibile sia in sessione sia in dashboard e sparisce da sé quando la coda si drena.

## Boundaries & Constraints

**Always:**
- Lo stato dell'indicatore deriva ESCLUSIVAMENTE da `useIsMutating({ mutationKey: [...REVIEW_MUTATION_KEY] })` (che filtra `status: 'pending'` — copre sia la mutation in volo sia quella `paused` offline). Nessun `useState`/prop che duplichi «c'è qualcosa in coda»: la fonte di verità è la coda TanStack, così non può divergere.
- `REVIEW_MUTATION_KEY` è importata da `features/study/reviewMutation.ts` (fonte unica dell'identità della coda), mai riscritta come `['review']` letterale.
- A conteggio 0 il componente rende `null` (assente): nessuna pastiglia, nessun testo «sincronizzato». A conteggio > 0 rende la pastiglia.
- Il testo annunciato è UNA stringa stabile e SENZA conteggio (`t('sync.pending')`): il contenuto della live region NON varia col numero di risposte accodate, così `aria-live="polite"` annuncia UNA volta alla comparsa (cambio di stato) e non a ogni risposta che entra in coda.
- Solo classi-token del sistema di design (UX-DR1): fondo `accent-subtle` (+ `accent-subtle-dark`) e testo `accent` (+ `accent-dark`) — un blu sottotono, calmo, MAI `danger`. Contrasto verificato (accento su accent-subtle: 7.76 chiaro / 6.37 scuro).
- La pastiglia è NON bloccante: `pointer-events-none`, posizione `fixed` in un angolo, nessun backdrop/overlay, nessun controllo interattivo. Non è un modale né un toast.
- Testabile in isolamento con `renderToStaticMarkup` + `QueryClientProvider` seminando una mutation `['review']` `paused` (stesso pattern di `reviewMutation.test.ts`): `useIsMutating` legge la cache in modo sincrono (server snapshot), quindi la resa statica riflette la coda.

**Block If:** _Nessuna._ Il meccanismo (`useMutationState`/`useIsMutating` sulla `REVIEW_MUTATION_KEY`, assente a vuoto, `aria-live="polite"`, niente allarme) è fissato dalle Technical Decisions e dalle UX Patterns dell'epica (UX-DR17, UX-DR33) e dagli AC della storia. Nessuna ambiguità richiede input umano.

**Never:**
- NON introdurre alcun pulsante (né «riprova», né «chiudi»/«ignora»), modale, toast bloccante, backdrop o overlay che intercetti gli eventi.
- NON usare il colore d'allarme (`danger`/`danger-subtle`), `role="alert"` né `aria-live="assertive"`: una risposta in coda è il funzionamento previsto, non un errore.
- NON interpolare un conteggio nel testo annunciato (romperebbe «una volta al cambio di stato, non a ogni risposta»).
- NON mostrare uno stato «tutto sincronizzato» quando la coda è vuota (l'indicatore è ASSENTE).
- NON toccare la registrazione dei default della mutation, il persister IndexedDB (4.2), il listener online / retry (4.3), la RPC server né lo store di sessione. Questa storia AGGIUNGE solo la superficie di lettura.
- NON introdurre la verifica e2e di idempotenza con app chiusa/riaperta (storia 4.5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Coda con risposte non sincronizzate | ≥1 mutation `['review']` `status: 'pending'` (in pausa offline o in volo) | pastiglia visibile: `role="status"`, `aria-live="polite"`, testo `t('sync.pending')`, colore d'accento sottotono, `pointer-events-none` | No error expected |
| Coda vuota / tutto drenato | 0 mutation `['review']` `pending` | indicatore ASSENTE (rende `null`, markup vuoto): nessun «tutto sincronizzato» | No error expected |
| Più risposte in rapida successione | 2+ mutation `['review']` `pending` | output IDENTICO a una sola (contenuto invariante al conteggio): la live region non cambia, nessun ri-annuncio per risposta | No error expected |
| Mutation di ALTRA chiave in volo | pending con `mutationKey` ≠ `['review']` | indicatore assente: filtra per `REVIEW_MUTATION_KEY`, non da uno stato proprio | No error expected |

</intent-contract>

## Code Map

- `src/features/study/SyncIndicator.tsx` -- **CREATE** (features/study, presentazionale): il componente. Legge `const pending = useIsMutating({ mutationKey: [...REVIEW_MUTATION_KEY] })`; `if (pending === 0) return null;` (assente); altrimenti rende `<div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 pointer-events-none rounded-full bg-accent-subtle dark:bg-accent-subtle-dark px-3 py-1 text-caption text-accent dark:text-accent-dark">{t('sync.pending')}</div>`. Import: `useIsMutating` da `@tanstack/react-query`, `useTranslation` da `../../i18n`, `REVIEW_MUTATION_KEY` da `./reviewMutation`. Modello: `ProgressMeter.tsx` (presentazionale, `null` a stato vuoto, `aria-*`, solo classi-token).
- `src/features/study/SyncIndicator.test.tsx` -- **CREATE** (env node, `renderToStaticMarkup` + `QueryClientProvider`): semina una mutation `['review']` `paused` offline via `MutationObserver` (riusa il pattern di `reviewMutation.test.ts`: `onlineManager.setOnline(false)`, `mutate`, `await Promise.resolve()`), salva/ripristina `onlineManager` in `beforeEach`/`afterEach`, resetta i18n a `en`. Copre gli AC (vedi sotto).
- `src/features/study/reviewMutation.ts:25` -- READ-ONLY: `REVIEW_MUTATION_KEY = ['review']` è l'identità da importare. Invariato.
- `src/i18n/en.ts` -- **EDIT**: aggiungere il namespace top-level `sync: { pending: 'Sync pending' }` (ASCII, terso, nessun `!`/emoji/conteggio). È la FONTE delle chiavi tipizzate (`i18next.d.ts` tipa su `typeof en`), quindi `t('sync.pending')` compila.
- `src/i18n/it.ts` -- **EDIT**: aggiungere `sync: { pending: 'Sincronizzazione in sospeso' }` — STESSA chiave di `en` (parità ricorsiva verificata da `i18n.test.tsx`). Nessun CJK, nessun `!`/emoji/conteggio.
- `src/app/AuthRoot.tsx:158-183` -- **EDIT** (app): rendere `<SyncIndicator />` come sibling di `<AppRoutes .../>` dentro `<PortsProvider>`. Import da `../features/study/SyncIndicator` (arco app→features consentito). Sovrapposizione globale indipendente dalla rotta; non reso nello stato `checking` (return anticipato), coerente col fatto che lì non c'è coda. `AuthRoot.test.tsx` prova solo `checking`, quindi resta verde senza `QueryClientProvider`.
- `src/features/study/ProgressMeter.tsx` -- READ-ONLY riferimento: il modello del componente presentazionale (`null` a vuoto, `aria-*`, solo token, nessun colore letterale).
- `eslint.config.js:60-117` -- READ-ONLY: `features`→`i18n`/`domain`/`ui` + pacchetti esterni (`@tanstack/react-query` consentito); `app`→`features` consentito. Nessuna violazione di confine.
- `scripts/check-contrast.mjs` -- READ-ONLY: verifica il testo solo contro `surface-base`/`raised`; la coppia accento/accent-subtle non è valutata dallo script ma è stata verificata a mano (≥ 6.3:1 in entrambe le modalità).

## Tasks & Acceptance

**Execution:**
- `src/i18n/en.ts` -- AGGIUNGERE `sync: { pending: 'Sync pending' }` (top-level). -- Fonte delle chiavi tipizzate: abilita `t('sync.pending')`.
- `src/i18n/it.ts` -- AGGIUNGERE `sync: { pending: 'Sincronizzazione in sospeso' }`. -- Parità en/it; testo calmo, senza conteggio.
- `src/features/study/SyncIndicator.tsx` -- CREARE il componente derivato da `useIsMutating` sulla `REVIEW_MUTATION_KEY`: `null` a 0, pastiglia discreta non bloccante altrimenti. -- La superficie di lettura della coda (AC1/AC2/AC3/AC4).
- `src/app/AuthRoot.tsx` -- CABLARE `<SyncIndicator />` come sibling di `<AppRoutes />` nel composition root. -- Rende l'indicatore visibile su ogni rotta, indipendente dalla sessione.
- `src/features/study/SyncIndicator.test.tsx` -- CREARE i test: coda paused ⇒ pastiglia (role/aria-live/testo, niente danger/modal/alert); coda vuota ⇒ assente; 1 vs 2 paused ⇒ output identico; chiave diversa ⇒ assente. -- Verifica la derivazione dalla coda e le proprietà non-invasive.

**Acceptance Criteria:**
- Given una coda con almeno una mutation `['review']` `paused`, when `SyncIndicator` è reso dentro un `QueryClientProvider`, then rende una pastiglia con `role="status"` e `aria-live="polite"` e il testo `t('sync.pending')`, DERIVATA da `useIsMutating` (nessuno stato proprio). (AC1)
- Given una coda senza mutation `['review']` `pending`, when l'indicatore è reso, then il markup è vuoto (assente): nessuna pastiglia, nessun testo «tutto sincronizzato». (AC2)
- Given l'indicatore visibile, when è ispezionato, then NON contiene `danger`, `role="dialog"`/`aria-modal` (non un modale), né `role="alert"`/`aria-live="assertive"` (non un allarme); è `pointer-events-none` (non bloccante). (AC3)
- Given una coda con due o più risposte `paused`, when l'indicatore è reso, then il suo output è IDENTICO a quello con una sola risposta (contenuto invariante al conteggio), cosicché `aria-live` annunci una volta al cambio di stato e non a ogni risposta. (AC4)

## Design Notes

**Perché `useIsMutating` e non `useMutationState` grezzo.** `useIsMutating(filters)` è definito come `useMutationState({ filters: { ...filters, status: 'pending' } }).length`: restituisce esattamente il numero di valutazioni non ancora sincronizzate (in volo o in pausa offline) filtrate per chiave. È l'API più piccola per «c'è qualcosa in coda». La derivazione dalla coda TanStack (UX-DR17) è ciò che impedisce all'indicatore di divergere dallo stato reale.

**Perché il testo è senza conteggio (AC4).** `aria-live="polite"` ri-annuncia quando il CONTENUTO della region cambia. Se il testo fosse «3 in attesa», ogni risposta accodata cambierebbe il numero e la tecnologia assistiva verrebbe sommersa. Con un testo stabile (`t('sync.pending')`), accodare la seconda, terza, … risposta lascia il contenuto INVARIATO: un solo annuncio, alla comparsa. Il test lo prova staticamente confrontando l'output con 1 e con 2 mutation `paused` (identici).

**Forma del componente:**
```tsx
export function SyncIndicator() {
  const { t } = useTranslation();
  const pending = useIsMutating({ mutationKey: [...REVIEW_MUTATION_KEY] });
  if (pending === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 pointer-events-none rounded-full bg-accent-subtle dark:bg-accent-subtle-dark px-3 py-1 text-caption text-accent dark:text-accent-dark"
    >
      {t('sync.pending')}
    </div>
  );
}
```

**Perché nel composition root e non nella `SessionScreen`.** La coda `paused` sopravvive all'uscita dalla sessione (la `reset()` dello store tocca solo la coda in memoria, non le mutation). Montando l'indicatore in `AuthRoot` (sibling di `AppRoutes`) resta visibile anche tornati in dashboard finché la coda non si drena — «l'indicatore sparisce da sé». Coerente con «la logica di coda vive nel composition root, non sparsa nei componenti».

**Nota di test.** `useIsMutating` usa `useSyncExternalStore` con lo snapshot calcolato in modo SINCRONO dalla `MutationCache` (server snapshot = stato corrente): `renderToStaticMarkup` in env `node` riflette quindi la coda seminata, senza browser. Le transizioni/annunci runtime non sono osservabili da SSR e sono coperti per costruzione (testo invariante) e verifica live.

## Verification

**Commands:**
- `npm run lint` -- expected: nessuna violazione dei confini (features→i18n/`@tanstack/react-query`; app→features).
- `npm run typecheck` -- expected: nessun errore TS; `t('sync.pending')` risolto dall'augmentation.
- `npm test` -- expected: suite verde, inclusi i nuovi test di `SyncIndicator.test.tsx` (AC1–AC4), la parità en/it di `i18n.test.tsx` con la nuova chiave, e i test 4.1–4.3 invariati.

**Manual checks (if no CLI):**
- Confermare per ispezione che `SyncIndicator` non renda alcun controllo interattivo, backdrop, `role="dialog"`/`role="alert"` né classe `danger`, e che a `pending === 0` renda `null`.
- Confermare che `AuthRoot` monti `<SyncIndicator />` una sola volta, come sibling di `<AppRoutes />`.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 1: (high 0, medium 1, low 0)
- reject: 13
- addressed_findings:
  - `[low]` `[patch]` Nulla impediva a un futuro sviluppatore di interpolare un conteggio in `sync.pending`, reintroducendo il ri-annuncio per risposta e rompendo l'invariante AC4. Aggiunta una guardia che asserisce che né `en.sync.pending` né `it.sync.pending` contengono `{{` (nessun placeholder).
  - `[low]` `[patch]` AC3 provava solo l'ASSENZA di `danger` (colore d'allarme). Aggiunte asserzioni POSITIVE che la pastiglia porta i token calmi `bg-accent-subtle` e `text-accent`, così una regressione che togliesse il colore sottotono verrebbe colta.
  - `[low]` `[patch]` Tutti i casi positivi usavano `seedPaused` (offline → `paused`); la metà «in volo» per la chiave `['review']` non era asserita direttamente. Aggiunto un test che, ONLINE, avvia una mutation `['review']` con `mutationFn` che non risolve (resta `pending` in volo) e verifica che l'indicatore sia PRESENTE.

Note sui reject principali (rumore, house-style, o fuori scopo per autorità dell'intento):
- **`useIsMutating` vs `useMutationState` letterale**: `useIsMutating(filters)` È `useMutationState({ filters: { ...filters, status: 'pending' } }).length` (costruito su di esso): l'AC «deriva da `useMutationState`, non da uno stato proprio» è onorato nella sostanza. Rumore.
- **Annuncio-una-volta a runtime non eseguito dai test SSR (AC4) / transizioni comparsa-scomparsa non testate**: tutte le live region del progetto sono testate staticamente + verifica live (cfr. la live region di `SessionScreen`, 3.22); lo spec lo documenta esplicitamente. Il test AC4 prova la precondizione (contenuto invariante al conteggio) e la guardia sui `{{` blocca la regressione realistica. House-style.
- **Wiring in `AuthRoot`/contesto QueryClient non testato**: il composition root è verificato live per costruzione (come `subscribeReviewQueueResume` in `main.tsx`); `AuthRoot.test` prova solo lo stato `checking`. House-style.
- **Parità en/it non asserita in questa suite**: la parità ricorsiva è verificata una volta dal test globale `i18n.test.tsx`, che ora include `sync.pending`. Duplicare per-feature sarebbe errato.
- **Overflow della stringa italiana / mancanza `max-width` / thumb-zone / safe-area / overlap con controlli in basso**: responsive è la storia 3.23 (fuori scopo per autorità dell'epica 4); la pastiglia è `pointer-events-none`, quindi non blocca mai l'interazione.
- **Flicker su drenaggio online / `prefers-reduced-motion`**: mostrare l'indicatore durante la sincronizzazione online in corso È il comportamento specificato; sopprimere le comparse brevi (debounce) è una raffinatezza non richiesta e in conflitto con il vincolo «nessuno stato proprio». Cosmetico.
- **Nessun annuncio alla SCOMPARSA**: l'epica vuole esplicitamente che l'indicatore «sparisca da sé» e non mostri «tutto sincronizzato»; annunciare il completamento la violerebbe.
- **`markup === ''` fragile / `qc.clear()` in `afterEach` / contrasto scuro non automatizzato**: `toBe('')` per il ramo `null` è l'idioma della casa (`ProgressMeter.test`); ogni test usa un QueryClient fresco (nessun leak fra test) e ripristina `onlineManager`; lo script di contrasto valuta i fondi `surface-*` per design e la coppia accento/accent-subtle è stata verificata a mano (≥ 6.3:1).

## Auto Run Result

Status: done

**Sintesi della modifica.** La coda di valutazioni ora ha una superficie di LETTURA discreta: un `SyncIndicator` (features/study) che DERIVA il suo stato dalla coda reale via `useIsMutating({ mutationKey: REVIEW_MUTATION_KEY })` — il conteggio delle mutation `pending` (in volo o in pausa offline), mai uno stato proprio. A coda vuota rende `null` (assente, non «tutto sincronizzato»); a coda non vuota rende una pastiglia fissa e NON bloccante (`pointer-events-none`, nessun overlay/controllo) con `role="status"` + `aria-live="polite"` e un testo STABILE e senza conteggio (`t('sync.pending')`), in colore d'accento sottotono (mai `danger`). Montato una sola volta nel composition root (`AuthRoot`, sibling di `<AppRoutes>`), è una sovrapposizione indipendente dalla rotta e sparisce da sé al drenaggio. Nessuna modifica a coda/persister/retry/RPC/store: solo la superficie di lettura.

**File cambiati (rispetto a `b90d6c18`).**
- `src/features/study/SyncIndicator.tsx` (CREATE) — il componente derivato da `useIsMutating` sulla `REVIEW_MUTATION_KEY`: `null` a 0, pastiglia discreta non bloccante altrimenti.
- `src/features/study/SyncIndicator.test.tsx` (CREATE) — 7 test (env node, `renderToStaticMarkup` + `QueryClientProvider`, coda seminata via `MutationObserver`): AC1 (pastiglia status/polite col testo), AC2 (assente a coda vuota), AC3 (non modale/allarme, `pointer-events-none`, colore calmo positivo), AC4 (output invariante al conteggio), Matrix (altra chiave ⇒ assente), Matrix metà-in-volo (review online in volo ⇒ presente), Guardia (nessun `{{` in `sync.pending` en/it).
- `src/i18n/en.ts` (EDIT) — namespace top-level `sync: { pending: 'Sync pending' }` (fonte delle chiavi tipizzate).
- `src/i18n/it.ts` (EDIT) — `sync: { pending: 'Sincronizzazione in sospeso' }` (parità en/it).
- `src/app/AuthRoot.tsx` (EDIT) — `<SyncIndicator />` montato una volta come sibling di `<AppRoutes />` nel composition root.

**Esito review (questo pass).** patch applicati: 3 (tutti low — guardia anti-interpolazione su `sync.pending`, asserzione positiva del colore calmo, test della metà «in volo»). Item differiti: 1 (medium — un invio permanentemente fallito finisce in `error`, esce dal conteggio e non ha superficie; coerente con l'epica che vieta modali/pulsanti d'errore, il recupero resta non garantito, cfr. deferred 4.3). Item rifiutati: 13 (rumore, house-style, o fuori scopo per autorità dell'intento — vedi Review Triage Log).

**Raccomandazione di follow-up review.** `false`. Findings di questo pass triaged `patch`: high 0, medium 0, low 3. Punteggio `3×0 + 1×3 = 3` (< 5) e nessun high ⇒ `followup_review_recommended: false`.

**Verifica eseguita.**
- `npm run lint` ⇒ nessuna violazione dei confini (features→`@tanstack/react-query`/i18n; app→features).
- `npm run typecheck` ⇒ nessun errore TS (`t('sync.pending')` risolto dall'augmentation su `typeof en`).
- `npm test` ⇒ 87 file, 985 test verdi (inclusi i 7 test di `SyncIndicator.test.tsx` e la parità en/it aggiornata).
- Matrix Test Audit: ogni riga della matrice I/O coperta da un test eseguito e passato (coda non vuota → AC1/AC3; coda vuota → AC2; più risposte → AC4; altra chiave → Matrix).

**Rischi residui.** L'item `deferred` (invio permanentemente fallito in `error` che esce dal conteggio senza superficie né recupero — medium, coerente con l'epica). L'annuncio-una-volta a runtime e le transizioni comparsa/scomparsa non sono osservabili da `renderToStaticMarkup`: coperti per costruzione (testo invariante + guardia anti-`{{`) e verifica live, come ogni live region del progetto.
</content>
</invoke>
