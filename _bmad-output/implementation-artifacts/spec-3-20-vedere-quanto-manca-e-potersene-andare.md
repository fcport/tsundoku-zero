---
title: 'Story 3.20: Vedere quanto manca, e potersene andare'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '656d014a92b7247de40d1ed3992f0a89a40d4f91'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** La sessione (3.19) chiude il ciclo «rispondi → sai perché → resta registrato», ma non si può ancora ABBANDONARE: non c'è modo esplicito di uscire (nessun Esc, nessuna affordance in-app), e — peggio — lo store di sessione è un singleton di modulo che alla RI-ENTRATA in `/studia` non si resetta (deferred #1 di 3.19): la seconda visita mostra la coda STALE della sessione precedente invece della pila fresca. Manca insomma il «potersene andare» e il «riprendere non costa nulla».

**Approach:** Rendere la sessione ABBANDONABILE e RICOSTRUIBILE, senza toccare la persistenza (che è già per-risposta e idempotente dalla 3.19, quindi l'abbandono non perde nulla per costruzione). (1) La sessione si RICOSTRUISCE a ogni ingresso: aggiungere un'azione `reset` allo store e azzerarlo all'USCITA da `/studia` (cleanup di `SessionScreen`), così la visita successiva riparte dalla pila fresca (`['due']`) e mai dalla coda precedente — nessun «riprendi dove eri». (2) Abbandono: un listener Esc a livello window PIÙ un'affordance in-app «esci», entrambi → `onExit` (nuova callback, cablata dal livello app con `useNavigate` verso `ROOT_PATH` — AD-1: nessun react-router nelle features). (3) La barra di avanzamento resta SEMPRE visibile durante la sessione (già così in 3.19: resa incondizionatamente nel ramo attivo, rappresenta il COMPLETATO) — 3.20 lo verifica. FUORI SCOPE: schermata di completamento/zero (3.21), contratto tastiera completo/tasti numerici/tab-order/live region (3.22), responsive/thumb-zone (3.23).

## Boundaries & Constraints

**Always:**
- **La sessione si RICOSTRUISCE, non si ripristina (AC4, deferred #1 di 3.19).** Aggiungere `reset(): void` allo store `useSessionStore` (`src/features/study/sessionStore.ts`): azzera a `session: createSession([])`, `total: 0`, `initialIds: []` — la forma iniziale. In `SessionScreen` un effetto top-level con cleanup su UNMOUNT chiama `reset()`: uscendo da `/studia` (Esc, «esci», «indietro» del browser, o completamento) lo store torna vuoto, così la prossima entrata rientra nell'effetto guardato `start` esistente (`initialIds.length === 0`) e ricostruisce dalla pila fresca. NON persistere la sessione (nessun `localStorage`/`persist`); NON introdurre un «riprendi dove eri».
- **Abbandono con Esc (AC2).** Effetto top-level in `SessionScreen` (prima di ogni early-return, come tutti gli hook esistenti): `window.addEventListener('keydown', …)`, su `event.key === 'Escape'` invoca `onExit()`; cleanup rimuove il listener. Attivo per l'INTERA vita della schermata (anche scheletro/vuoto). Glue d'effetto: verificata live (come `start`/mutation di 3.19), non eseguita da `renderToStaticMarkup`.
- **Affordance «esci» in-app (AC2, «potersene andare»).** Nel ramo della sessione attiva rendere un `<button type="button" onClick={onExit}>` con `t('session.exit')`: verbale e concreto (mai «Continua»/«Indietro» generico), SECONDARIO (chiaramente non il `button-primary`: token neutri di minor enfasi, nessun verde di successo). È l'affordance in-app del «tornare indietro».
- **Navigazione come callback dal livello app (AD-1).** `SessionScreen` acquisisce la prop `readonly onExit: () => void` (obbligatoria, come `onStartSession` della dashboard). Il cablaggio vive in `AppRoutes` (unico livello con react-router): `const navigate = useNavigate()`, `element={<SessionScreen userId={userId} onExit={() => navigate(ROOT_PATH)} />}`, importando `ROOT_PATH` da `./routes`. Le features NON importano react-router né stringhe di path.
- **Le risposte già date RESTANO acquisite (AC2/AC3), senza codice nuovo.** La persistenza è PER-RISPOSTA e idempotente (RPC `apply_review`, 3.19): ogni risposta è già scritta quando si abbandona; non esiste un «commit di fine sessione» che l'abbandono salterebbe. `reset()` tocca SOLO la coda in memoria, mai la porta/DB. La dashboard legge il conteggio residuo dalla STESSA chiave `['due', userId]` (invalidata dall'`onSettled` di ogni risposta): mostra il residuo come conteggio NORMALE, senza penalità. NON aggiungere alcuna logica di penalità/decadimento all'abbandono.
- **Barra SEMPRE visibile durante la sessione (AC1).** La `ProgressMeter` è già resa incondizionatamente nel ramo attivo di `SessionScreen`, sopra la card, in ENTRAMBE le fasi (`consegna`/`spiegazione`), e rappresenta il COMPLETATO (`total − remainingCount(session)`), non il rimanente. Mantenerla lì; NON gating dietro la fase locale. 3.20 aggiunge la VERIFICA (test), non ne cambia il calcolo.
- **i18n:** estendere il namespace `session` in ENTRAMBI i cataloghi (parità imposta da `i18n.test.tsx`): nuova chiave `exit` accanto a `next`. `en` ASCII; niente `!`/emoji/avverbi di lode/CJK; niente `{{count}}`.
- **Confini AD-1.** `features/study` importa `domain`/`ui`/`i18n`/`@tanstack/react-query`/`zustand`, MAI `data` né `react-router`; `features` non importa `features`. Lo store DELEGA al dominio (`reset` usa `createSession([])`). Nessun global temporale/casuale nel dominio (immutato qui).

**Block If:**
- _Nessun blocco._ Ogni decisione è fissata dall'epica e dai moduli esistenti (store `createSession`, RPC `apply_review` già a DB, pattern navigazione-come-callback della dashboard, `ROOT_PATH` già definito). Nessuna migrazione, nessuna azione umana o esterna al repository.

**Never:**
- NON introdurre la schermata di completamento/zero (3.21); il contratto tastiera COMPLETO — tasti numerici, ordine di tab, `aria-live` — (3.22, l'Esc qui è un solo tasto, non il contratto); i breakpoint responsive/thumb-zone (3.23); lo stato d'errore del read-model (deferred #1 di 3.18) né il fix della card bloccata su `currentState` undefined (deferred #2 di 3.19).
- NON persistere la sessione (nessun `persist`/`localStorage`), NON aggiungere «riprendi dove eri». NON aggiungere penalità/decadimento all'abbandono. NON cambiare la chiave `['due', userId]`. NON reimplementare esito/dovutezza/scheduling. NON usare verde/rosso; nessun `!`/emoji/lode/coriandolo/badge/animazione. NON far diventare `session.exit` un `button-primary` (max uno per schermata).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| ricostruzione all'ingresso | seconda entrata in `/studia` dopo un'uscita | store azzerato all'uscita ⇒ `start` riparte dalla pila FRESCA `['due']`, non dalla coda precedente | — |
| abbandono con Esc | sessione in corso, tasto `Escape` | `onExit()` ⇒ navigazione a `ROOT_PATH` (dashboard) | — |
| abbandono con affordance | click su «esci» | `onExit()` ⇒ dashboard | — |
| risposte acquisite | rispondo a un esercizio, poi abbandono | l'esito è GIÀ persistito (RPC per-risposta); niente perdita | — |
| conteggio residuo | riapro la dashboard dopo l'abbandono | conteggio residuo = pila `['due']` corrente, come conteggio normale, senza penalità | — |
| nuova sessione più tardi | esercizi ancora dovuti, rientro in `/studia` | sessione ricostruita dai dovuti correnti, in ordine di dominio; nessun ripristino della coda abbandonata | — |
| barra sempre visibile | sessione in corso, fase `consegna` o `spiegazione` | `ProgressMeter` presente in entrambe, rappresenta il COMPLETATO | — |
| Esc a store vuoto/scheletro | `/studia` in caricamento, `Escape` | il listener è attivo (hook top-level) ⇒ `onExit()` funziona comunque | — |
| `reset` puro | `reset()` chiamato | `session` vuota, `total` 0, `initialIds` `[]`; nessuna chiamata a porta/DB | — |

</intent-contract>

## Code Map

- `src/features/study/sessionStore.ts:23-65` -- **aggiungere** `reset(): void` all'interfaccia `SessionStore` (docstring: azzera lo stato per la ricostruzione all'ingresso, 3.20) e all'implementazione: `reset: () => set(() => ({ session: createSession([]), total: 0, initialIds: [] }))`. `start`/`dispatch` INVARIATI. Aggiornare il commento d'intestazione (la ricostruzione all'ingresso ora è 3.20, non solo effimera).
- `src/features/study/sessionStore.test.ts` -- **estendere**: dopo `start([...])`+`dispatch`, `reset()` riporta `session`/`total`/`initialIds` alla forma iniziale (coda vuota, 0, `[]`).
- `src/features/study/SessionScreen.tsx` -- **modificare** (orchestrazione): (1) nuova prop `onExit: () => void`; (2) effetto top-level Esc → `onExit` (window keydown, cleanup rimuove); (3) effetto top-level con cleanup su unmount → `reset()`; (4) nel ramo attivo, `<button>` «esci» (`t('session.exit')`) secondario; (5) aggiornare l'intestazione (abbandono/ricostruzione ora IN scope). La `ProgressMeter` resta dov'è (AC1). Hook nuovi PRIMA degli early-return (regola degli hook).
- `src/features/study/SessionScreen.test.tsx` -- **estendere**: passare `onExit` (NOOP) al render; asserire che l'affordance «esci» (`en.session.exit`) è resa nel ramo sessione-attiva e assente nel deep-link a pila vuota; la barra (`role="progressbar"`) resta asserita (AC1). Effetti Esc/reset restano glue live-verificata (SSR non li esegue).
- `src/features/study/ProgressMeter.tsx` -- **riuso INVARIATO** (già COMPLETATO/totale, resa incondizionata nel ramo attivo). Nessuna modifica.
- `src/app/AppRoutes.tsx:43-88` -- **modificare**: `const navigate = useNavigate()`; importare `ROOT_PATH` (già `STUDY_PATH`) da `./routes` e `useNavigate` da `react-router`; passare `onExit={() => navigate(ROOT_PATH)}` a `<SessionScreen>`.
- `src/app/AppRoutes.test.tsx:201-219` -- **estendere**: al `/studia` autenticato asserire che l'affordance «esci» (`en.session.exit`) è resa insieme alla consegna.
- `src/app/routes.ts:11` -- **riuso INVARIATO** `ROOT_PATH = '/'` (bersaglio dell'uscita: il catch-all rende la dashboard). Aggiornabile solo il commento su `STUDY_PATH` («abbandono di 3.20» ora realizzato).
- `src/i18n/en.ts:88-123` / `src/i18n/it.ts:82-117` -- **aggiungere** `session.exit` in parità (`en` ASCII), verbale e concreto (es. en `Leave the session` / it `Esci dalla sessione`).

## Tasks & Acceptance

**Execution:**
- `src/features/study/sessionStore.ts` (+ test) -- azione `reset` che azzera `session`/`total`/`initialIds` (delega a `createSession([])`).
- `src/features/study/SessionScreen.tsx` (+ test) -- prop `onExit`; effetti Esc e reset-su-unmount; affordance «esci»; barra confermata sempre visibile.
- `src/app/AppRoutes.tsx` -- cablare `onExit` con `useNavigate`→`ROOT_PATH`.
- `src/app/AppRoutes.test.tsx` -- asserzione affordance «esci» al `/studia`.
- `src/i18n/en.ts` + `src/i18n/it.ts` -- chiave `session.exit` in parità (`en` ASCII).

**Acceptance Criteria:**
- **AC1 — Barra sempre visibile e del completato.** *Given* una sessione in corso, *when* è renderizzata (fase `consegna` o `spiegazione`), *then* la `ProgressMeter` è visibile e rappresenta il COMPLETATO (`total − remainingCount`), non il rimanente.
- **AC2 — Abbandono senza perdita.** *Given* una sessione in corso, *when* l'utente la abbandona con Esc o con l'affordance «esci» (o l'«indietro» del browser), *then* naviga alla dashboard e tutte le risposte già date RESTANO acquisite (persistite per-risposta, non toccate dall'abbandono).
- **AC3 — Conteggio residuo senza penalità.** *Given* una sessione abbandonata, *when* l'utente riapre la dashboard, *then* vede il conteggio residuo (`['due', userId]`) come conteggio normale, senza alcuna penalità.
- **AC4 — Ricostruzione, non ripristino.** *Given* esercizi ancora dovuti, *when* l'utente avvia una nuova sessione più tardi nella stessa giornata, *then* la sessione riparte dai dovuti CORRENTI, ricostruita dalla pila fresca; NON esiste «riprendi dove eri» (lo store è azzerato all'uscita, ricostruito all'ingresso).
- **AC5 — Confini / regressione.** *Given* il diff, *then* `features` non importa `data`/`react-router`; lo store delega al dominio; parità en/it verde, `en` ASCII, copy senza `!`/emoji/lode; nessun verde/rosso; dashboard/rotte/sessione invariate nei comportamenti esistenti; `npm run lint`/`typecheck`/`test`/`validate-content` verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - none
- reject notevoli (verificati contro il codice reale e l'intento):
  - **Effetti Esc/reset-su-unmount/onExit→navigate senza test automatico** (blind/verification-gap/intent-alignment): il repo esegue i test in `node` con `renderToStaticMarkup` (nessun jsdom, gli effetti non partono). La logica PURA (`reset`) è unit-testata e l'output RESO (pulsante «esci», ARIA della barra) è testato; il glue d'effetto è verificato live, come per tutte le 19 storie precedenti (identico alla 3.19). Il verification-gap reviewer ha concluso «no gaps».
  - **Esc durante composizione IME abbandona la sessione** (edge): irraggiungibile — la sessione non ha alcun input a testo libero (esercizi a sola scelta, FR «mai testo libero»), quindi nessuna composizione IME è attiva su `/studia`.
  - **Esc ripetuto ⇒ `navigate(ROOT_PATH)` multipli** (edge): nessuna conseguenza — la navigazione alla stessa rotta è idempotente in react-router.
  - **Listener Esc globale in conflitto con modali futuri** (edge): nessun modale esiste; il contratto tastiera completo è 3.22; l'intento chiede solo «abbandona con Esc».
  - **`onExit` reso obbligatorio ⇒ altri call-site rotti** (blind): verificato — solo 2 siti (`AppRoutes`, `SessionScreen.test`), entrambi aggiornati, `typecheck` verde.
  - **AC1 «sempre visibile» sovradichiarato / nessun test con completed>0** (blind): il commento dice «nel ramo attivo» (accurato); la polarità «completato, non rimanente» è coperta da `ProgressMeter.test` (0/5, 3/5, 5/5).
  - **AC2/AC3 (risposte acquisite, conteggio residuo) validate «per argomento»** (intent-alignment): reggono per COSTRUZIONE — persistenza per-risposta idempotente (3.19), `reset` non tocca la porta/DB; nessun codice nuovo richiesto, ri-testare la 3.19 è fuori scope.
  - Altri respinti (nit low senza conseguenza utente): DRY del literal di stato iniziale (`reset`/`start`), stile link-like del pulsante «esci» (il testo fornisce il nome accessibile; ruolo `button` corretto; lo stile è materia di design-review), spostamento del pulsante «esci» fra le fasi (placement/tab-order è 3.22/3.23, non vincolato dall'intento), assenza di asserzione «esci» nei rami scheletro/neutro, precisione dei commenti su «indietro» del browser, e ridondanza di una asserzione «reset non tocca la porta» (garantita strutturalmente: lo store non importa porte, `sessionStore-source.test` ne guarda la purezza).

## Design Notes

**Perché reset-su-USCITA e non reset-su-ingresso.** Il requisito osservabile (AC4) è: entrando in `/studia` la sessione si ricostruisce dalla pila fresca. Poiché `SessionScreen` è l'ELEMENTO della rotta `/studia`, uscire (Esc/«esci»/«indietro»/completamento) la SMONTA e rientrare la RImonta (store singleton di modulo che sopravvive allo smontaggio — è questo il bug del deferred #1). Azzerare nel cleanup di unmount lascia lo store VUOTO alla prossima entrata, così l'effetto `start` esistente (guardato `initialIds.length === 0`) ricostruisce dai `['due']` freschi — SENZA il flash di contenuto stale che avrebbe un reset-su-mount (che ripasserebbe dallo store stale al primo paint). Stesso effetto osservabile, UX migliore.

**L'abbandono non perde nulla per COSTRUZIONE.** La 3.19 persiste ogni risposta con una RPC idempotente nel momento in cui è data; non c'è un «commit di fine sessione». Quindi «restano acquisite» (AC2) e «conteggio residuo normale» (AC3) NON richiedono codice: `reset()` azzera solo la coda in memoria; la pila `['due']` (che la dashboard legge) riflette già il persistito. Nessuna penalità perché all'uscita non facciamo NIENTE al DB.

**Navigazione come callback (AD-1).** La dashboard riceve `onStartSession`; specularmente `SessionScreen` riceve `onExit`. react-router resta confinato al livello app (`AppRoutes`), che ora usa `useNavigate` (già usato da `AuthenticatedShell`). Così `SessionScreen` resta testabile con `renderToStaticMarkup` senza contesto router.

**Esempio (SessionScreen, hook top-level prima degli early-return).**
```tsx
useEffect(() => {                                  // AC2: Esc abbandona
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [onExit]);
const resetSession = useSessionStore.getState().reset;
useEffect(() => () => { resetSession(); }, [resetSession]); // AC4: ricostruzione all'ingresso
```

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (prop `onExit`, azione `reset`, chiave i18n `session.exit`).
- `npm run lint` -- expected: exit 0 (`features/study` non importa `data`/`react-router`; boundaries AD-1 verdi).
- `npm test` -- expected: exit 0 (AC1-AC5: `reset` puro; affordance «esci» resa; barra sempre visibile; parità en/it; nessuna regressione a dashboard/rotte/sessione).
- `npm run validate-content` -- expected: exit 0 (nessun impatto sul contenuto).

**Manual checks (live):**
- In `/studia`: Esc e il pulsante «esci» tornano alla dashboard; rispondere ad alcuni esercizi, uscire, rientrare ⇒ la sessione riparte dai dovuti correnti (nessun «riprendi»), il conteggio in dashboard è il residuo senza penalità.

## Auto Run Result

Status: done.

### Sintesi del cambiamento implementato
La storia 3.20 rende la sessione ABBANDONABILE e RICOSTRUIBILE, senza toccare la persistenza (già per-risposta e idempotente dalla 3.19). Tre parti: (1) `SessionScreen` acquisisce la prop `onExit` (cablata dal livello app con `useNavigate`→`ROOT_PATH`, AD-1: nessun react-router nelle features) e la invoca da un listener Esc a livello window e da un'affordance «esci» in-app; (2) lo store `useSessionStore` acquisisce l'azione `reset` (delega a `createSession([])`) e `SessionScreen` la chiama nel cleanup di unmount, così l'uscita da `/studia` azzera lo store e la prossima entrata ricostruisce dalla pila fresca `['due']` — nessun «riprendi dove eri» (chiude il deferred #1 di 3.19); (3) la `ProgressMeter` resta sempre visibile nel ramo attivo (AC1), invariata. «Restano acquisite» e «conteggio residuo senza penalità» reggono per costruzione: `reset` tocca solo la coda in memoria, la dashboard legge la stessa chiave `['due', userId]` invalidata a ogni risposta.

### File cambiati (rispetto al baseline `656d014a92b7247de40d1ed3992f0a89a40d4f91`)
- `src/features/study/sessionStore.ts` (+ test) -- azione `reset` che azzera `session`/`total`/`initialIds` alla forma iniziale (delega al dominio; nessuna chiamata a porta/DB).
- `src/features/study/SessionScreen.tsx` (+ test) -- prop `onExit`; effetto listener Esc→`onExit`; effetto cleanup-su-unmount→`reset`; affordance «esci» secondaria; barra confermata sempre visibile.
- `src/app/AppRoutes.tsx` -- `useNavigate`; `onExit={() => navigate(ROOT_PATH)}` sulla rotta `/studia`.
- `src/app/AppRoutes.test.tsx` -- asserzione affordance «esci» resa al `/studia` autenticato.
- `src/app/routes.ts` -- aggiornato il commento di `STUDY_PATH` (abbandono 3.20 realizzato via `AppRoutes`).
- `src/i18n/en.ts` / `src/i18n/it.ts` -- chiave `session.exit` in parità (`en` ASCII: `Leave the session`; `it`: `Esci dalla sessione`).

### Ripartizione dei rilievi di review (questo pass)
- Patch applicati: 0.
- Item deferiti: 0.
- Item respinti: 14 (tutti low) — vedi `## Review Triage Log`. Verificati contro codice reale e intento: effetti live-verificati per convenzione del repo (nessun jsdom), edge irraggiungibili (nessun testo libero nella sessione; navigazione idempotente; nessun modale), garanzie AC2/AC3 tenute per costruzione (persistenza per-risposta 3.19), e nit di stile/test senza conseguenza utente.

### Raccomandazione di follow-up
`followup_review_recommended: false`. Rilievi `patch` di questo pass: 0 (high 0, medium 0, low 0); punteggio `3×0 + 1×0 = 0` (< 5) e nessun patch high. Nessun ulteriore ciclo necessario.

### Verifica eseguita
Tutte e quattro le verifiche dichiarate sono verdi (eseguite indipendentemente dopo l'implementazione):
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0 (confini AD-1 verdi; `features/study` non importa `data`/`react-router`).
- `npm test` -- exit 0 (911 test, 79 file; +3 rispetto alla 3.19, nessuna regressione).
- `npm run validate-content` -- exit 0.
Matrix Test Audit: ogni riga della I/O matrix è coperta a livello di essenza pura (`reset` unit-testato) o di superficie resa (pulsante «esci», ARIA della barra) da un test eseguito e verde; le righe di glue d'effetto (Esc, reset-su-unmount, `onExit`→`navigate`) sono verificate-live per convenzione del repo, come nella 3.19.

### Rischi residui
- **Effetti verificabili solo live**: listener Esc, cleanup-su-unmount→`reset` e `onExit`→`navigate` sono glue non eseguita da `renderToStaticMarkup` (stack di test node/SSR senza jsdom); la logica pura sottostante (`reset`) e l'output reso sono testati.
- **StrictMode (solo dev)**: il doppio-invocare degli effetti fa mount→reset→remount; converge perché l'effetto `start` guardato si ri-arma dopo il reset. Nessun impatto in produzione.
