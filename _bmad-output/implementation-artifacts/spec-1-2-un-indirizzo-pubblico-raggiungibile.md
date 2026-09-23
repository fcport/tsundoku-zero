---
title: 'Story 1.2: Un indirizzo pubblico raggiungibile'
type: 'feature'
created: '2026-09-23'
status: 'awaiting-operator'
baseline_revision: '8c42a86425901428e0a9a13a8bc2b1037e15c8b7'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred: []
operator_actions:
  - "Nella dashboard Vercel, collega il progetto tsundoku-zero (projectId prj_nfCAcACW6JfxfJyaHp0MOEe7P8y0, orgId team_DfGhiLR5S9dORFwDobcPbhTw) al repository GitHub tramite la Git Integration, così i deploy partono automaticamente dagli eventi Git."
  - "In Vercel > Settings > Git, imposta il Production Branch su main, così che il merge su main pubblichi in produzione (AC1)."
  - "In Vercel, verifica che le Preview Deployments siano abilitate per le pull request, così ogni PR ottenga un'anteprima dedicata (AC2)."
  - "In Vercel > Settings > Environment Variables, imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY per gli ambienti Production e Preview con i valori del progetto Supabase reale, altrimenti l'app fallisce il boot con ConfigError (AC5)."
  - "Dopo il primo deploy di produzione, apri l'URL pubblico senza credenziali e conferma che l'app carichi (AC1)."
  - "Apri una pull request di prova e conferma che Vercel crei un'anteprima dedicata raggiungibile (AC2)."
  - "Sull'URL di produzione apri un deep link a una rotta interna (es. /una/rotta) e conferma che risponda 200 servendo l'app, non 404 (AC3)."
  - "Sull'URL di produzione richiedi /_bmad-output/planning-artifacts/epics.md e conferma che NON restituisca quel file (viene servito l'index.html della SPA): l'albero interno del repo non è esposto (AC4)."
---

<intent-contract>

## Intent

**Problem:** Il progetto vive solo sulla macchina di chi lo scrive. Serve un URL pubblico raggiungibile senza credenziali (produzione al merge su `main`, anteprima per ogni PR), servendo **soltanto** l'artefatto di build — mai la radice del repository, dove i documenti di pianificazione sono navigabili. In più l'app non deve avviarsi in uno stato parzialmente configurato: una `VITE_*` mancante va intercettata all'avvio.

**Approach:** Un `vercel.json` versionato configura la pipeline di deploy **nativa** di Vercel (il progetto è già collegato via `.vercel/project.json`): `outputDirectory: dist` così che si serva solo l'artefatto di build, e un `rewrites` `/(.*) → /index.html` per i deep link (fallback SPA). Un validatore fail-fast in `src/app/env.ts` legge le `VITE_*` all'avvio e, se ne manca o ne è malformata una, lancia un errore che **nomina** la variabile prima di montare React. La connessione Git repo↔Vercel e le env var lato Vercel sono azioni dell'operatore (console vendor): la storia finalizza a `awaiting-operator`.

## Boundaries & Constraints

**Always:**
- `vercel.json` esplicita `framework: 'vite'`, `outputDirectory: 'dist'`, `installCommand: 'npm ci'` (mai `npm install`, `AD-20`), `buildCommand: 'npm run build'`.
- Deploy **nativo di Vercel** (Git integration), non un job di deploy in GitHub Actions: l'architettura nomina solo `vercel.json`. `ci.yml` resta lint/typecheck/test.
- Il validatore vive in `src/app/` ed è l'**unico** punto di accesso alla config; ritorna un `AppConfig` tipizzato. Insieme richiesto = le due `VITE_*` già dichiarate in `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Il messaggio d'errore contiene il **nome esatto** della variabile responsabile; il boot si interrompe (React non monta).
- `readConfig(source = import.meta.env)` accetta un `source` iniettabile → testabile a unità senza dipendere dall'ambiente Vite.

**Block If:**
- _Nessun blocco._ Le parti fuori dal repository (console Vercel) NON sono un blocco: si finalizza a `awaiting-operator` con `operator_actions`, mai `blocked`.

**Never:**
- Nessuna dipendenza esterna per la validazione (niente zod): schema a mano, `strict`, nessun `any`.
- Nessuna riscrittura di `import.meta.env` sparsa nel codice: solo `env.ts` la legge.
- Fuori scope: client Supabase (1.5), i18n/token (1.3–1.4), rotte/router (1.8). Il messaggio di boot-error è copy tecnica developer-facing, non interfaccia da `t()`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| var mancante | `source` senza `VITE_SUPABASE_URL` (o stringa vuota/spazi) | `readConfig` lancia `ConfigError`; il messaggio contiene `VITE_SUPABASE_URL` | boot interrotto, `<App/>` non montato |
| anon key mancante | `source` senza `VITE_SUPABASE_ANON_KEY` | `ConfigError` che nomina `VITE_SUPABASE_ANON_KEY` | boot interrotto |
| URL malformato | `VITE_SUPABASE_URL` = `pippo` (non http/https) | `ConfigError` che nomina la variabile e il motivo | boot interrotto |
| config valida | entrambe presenti, URL http(s) valido | ritorna `AppConfig` tipizzato e congelato | nessun errore |
| deep link | GET `/una/rotta/interna` senza file corrispondente in `dist` | `vercel.json` riscrive verso `/index.html`, 200 | nessun 404 |
| percorso interno del repo | GET `/_bmad-output/planning-artifacts/epics.md` | non presente in `dist`: riscritto a `index.html` | contenuto interno non esposto |

</intent-contract>

## Code Map

- `vercel.json` — **NUOVO** (radice, versionato). Config della pipeline di deploy nativa: `framework`, `installCommand`, `buildCommand`, `outputDirectory: dist`, `rewrites` `/(.*) → /index.html`. Copre gli AC deep-link e output-dir. `.vercel/**` è già in `.gitignore` e negli `ignores` di ESLint.
- `src/app/env.ts` — **NUOVO**. `readConfig(source?)` + classe `ConfigError`; descrittori delle var richieste con validatore opzionale (URL http/https per l'URL Supabase). Livello `app` (`AD-1`): può usare i global di piattaforma (`URL`).
- `src/app/env.test.ts` — **NUOVO**. Unit test delle righe della I/O Matrix del validatore (mancante / malformato / valido), passando `source` espliciti. Il glob vitest è già `src/**/*.test.{ts,tsx}`.
- `src/deploy-config.test.ts` — **NUOVO**. Copre le righe deep-link / percorso-interno della I/O Matrix asserendo la forma di `vercel.json` (rewrite `/(.*) → /index.html`, `outputDirectory: dist`); legge il file via `node:fs`. Test di config a livello repo, come `src/boundaries.test.ts`. Il routing live resta verifica operatore.
- `src/app/main.tsx` — **MODIFICA**. Chiama `readConfig()` prima di `createRoot`; su `ConfigError` scrive il messaggio nel DOM e **non** monta `<App/>`. Coerente col `throw` esistente su root mancante (riga 8–10).
- `.env.example` — **RIFERIMENTO**. Già dichiara le due `VITE_*` richieste e descrive esattamente questo validatore; nessuna modifica necessaria.
- `.vercel/project.json` — **RIFERIMENTO** (gitignored). Prova che il progetto Vercel è collegato via CLI; la connessione Git e le env var di Vercel restano azioni dell'operatore.

## Tasks & Acceptance

**Execution:**
- `vercel.json` — creare con framework/install/build/output/rewrites come sopra — configura il deploy nativo (AC deep-link + AC output-dir).
- `src/app/env.ts` — implementare `readConfig` + `ConfigError`; raccogliere **tutti** i problemi e nominarli, non fermarsi al primo — schema a mano, nessuna dip esterna.
- `src/app/env.test.ts` — codificare le righe del validatore della I/O Matrix come asserzioni (incluso che il messaggio contenga il nome della variabile).
- `src/deploy-config.test.ts` — asserire la forma di `vercel.json` (rewrite SPA + `outputDirectory: dist`) per le righe deep-link / percorso-interno.
- `src/app/main.tsx` — invocare `readConfig()` prima del mount; su `ConfigError` mostrare il messaggio (DOM) e non montare `<App/>`.

**Acceptance Criteria:**
- Given `npm run build`, when gira, then `tsc --noEmit` e `vite build` passano e producono `dist/index.html`.
- Given `npm test`, when gira, then i test del validatore passano insieme alle sonde di confine di 1.1 (nessuna regressione).
- Given `vercel.json` versionato, when Vercel costruisce, then `outputDirectory` è `dist` e un GET a `/_bmad-output/planning-artifacts/epics.md` non restituisce quel file (verifica sull'URL reale → operatore).
- Given la Git integration di Vercel connessa e le `VITE_*` impostate su Vercel (azione operatore), when si fa merge su `main` then la produzione è pubblicata a un URL senza credenziali; when si apre una PR then Vercel crea un'anteprima dedicata (operatore).

## Spec Change Log

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 0
- reject: 20: (high 0, medium 2, low 18)
- addressed_findings:
  - `[medium]` `[patch]` La decisione di boot in `src/app/main.tsx` (discriminare `ConfigError` e NON montare React su config invalida — comportamento chiave dell'AC5) viveva inline e non era coperta da test: `env.test.ts` provava solo `readConfig` in isolamento. Estratta la decisione in `decideBoot()` (in `env.ts`, testabile in node senza DOM); `main.tsx` ridotto a glue sul DOM; aggiunti test `decideBoot` (config valida ⇒ `ok`; variabile mancante ⇒ `config-error` che nomina la variabile; errore inatteso rilanciato, non mascherato). Nessuna dipendenza DOM aggiunta (il progetto vieta dip extra).
  - `[low]` `[patch]` `src/deploy-config.test.ts` fissava solo `outputDirectory`/`rewrites`: aggiunte asserzioni `framework: 'vite'`, `installCommand: 'npm ci'`, `buildCommand: 'npm run build'` — le impostazioni che, se sbagliate, fanno fallire la produzione (o installano con `npm install`, vietato da `AD-20`).

Findings rifiutati (rappresentativi): un layer ha segnalato "nessun test reale in env.test.ts" e "manca il caso https" — falsi, artefatti del codice abbreviato nel prompt del reviewer (il file reale ha 11 test verdi e l'happy-path usa un URL `https`); casi difensivi su input non prodotti da alcun chiamante (`http:foo`, `source` null/undefined — i chiamanti sono `main.tsx` con default `import.meta.env` e i test con oggetti espliciti); controlli di formato sull'anon key (JWT: over-engineering e fragile); `ConfigError.variables` "inutilizzato" (API pubblica tipizzata e testata); stile della schermata di boot-error (developer-facing, coerente col `throw` esistente); verifica dei contenuti reali di `dist` e del routing live (`AC3`/`AC4` sull'URL) e deploy-on-merge/PR-preview (`AC1`/`AC2`) — correttamente di proprietà dell'operatore, enumerati in `operator_actions`; semantica di `AC4` "non raggiungibile" vs riscrittura a `index.html` (già motivata nelle Design Notes: il file non è servito, quindi non esposto).

## Design Notes

**Deploy nativo, non GitHub Actions.** L'epic context e l'architettura nominano *solo* `vercel.json`; il collegamento del progetto Vercel è un prerequisito di provisioning umano (OAuth interattivo). Quindi la "pipeline di deploy" è quella nativa di Vercel guidata dagli eventi Git, non un job `vercel deploy` in `ci.yml`. Ciò che l'agente possiede è `vercel.json`; connettere il repo, impostare il branch di produzione e le env var di Vercel appartiene alla console vendor → `operator_actions`.

**Rewrite SPA sicuro.** Su Vercel i `rewrites` si applicano **solo** ai path che non corrispondono a un file statico: `/(.*) → /index.html` non intercetta gli asset di `dist/assets/*`, ma dà il fallback ai deep link. Poiché `dist` non contiene `_bmad-output`, quel percorso viene riscritto a `index.html` (non 404 che rivela il file, non il file stesso): l'albero interno del repo non è servito.

**Validatore a mano, non zod.** Due var richieste e un controllo URL non giustificano una dipendenza runtime; uno schema a mano resta `strict`, senza `any`, e centralizza l'accesso alla config così che i consumatori futuri (client Supabase, 1.5) non leggano mai `import.meta.env` direttamente.

Esempio della forma (l'implementer adatta):
```ts
export class ConfigError extends Error { /* messaggio elenca ogni var problematica */ }
export function readConfig(source: Record<string, unknown> = import.meta.env): AppConfig { /* … */ }
```

## Verification

**Commands:**
- `npm run lint` — expected: 0 errori sull'albero `src/`.
- `npm run typecheck` — expected: `tsc` strict senza errori (nessun `any`).
- `npm test` — expected: unit test del validatore + le sonde di confine di 1.1 tutti verdi.
- `npm run build` — expected: produce `dist/` con `index.html`.

**Manual checks (if no CLI):**
- Ispezionare `vercel.json`: `outputDirectory: 'dist'`, `rewrites` `/(.*) → /index.html`, `installCommand: 'npm ci'`.
- Ispezionare `src/app/main.tsx`: `decideBoot()` invocato **prima** di `createRoot`; su esito `config-error` nessun mount.

## Auto Run Result

Status: awaiting-operator

**Sommario.** La storia rende raggiungibile il progetto a un URL pubblico e impedisce l'avvio in stato parzialmente configurato. Parte in-repo (agente): `vercel.json` che configura la pipeline di deploy **nativa** di Vercel — `outputDirectory: dist` (serve solo l'artefatto di build, mai la radice del repo) e `rewrites` `/(.*) → /index.html` (fallback SPA per i deep link) — più un validatore fail-fast in `src/app/env.ts` che legge le due `VITE_*` all'avvio e, se ne manca o ne è malformata una, lancia una `ConfigError` che **nomina** la variabile prima che React monti. Parte fuori dal repo (operatore): la connessione Git repo↔Vercel, il branch di produzione, le env var di Vercel e la verifica del comportamento live — enumerate in `operator_actions`. Per questo lo stato finale è `awaiting-operator`, non `done`: l'agente ha completato tutto ciò che gli compete.

**File modificati/creati (uno per riga):**
- `vercel.json` — **nuovo**: `framework: vite`, `installCommand: npm ci`, `buildCommand: npm run build`, `outputDirectory: dist`, `rewrites` `/(.*) → /index.html`.
- `src/app/env.ts` — **nuovo**: `readConfig(source = import.meta.env)` (validatore a mano, senza dip esterne, `strict`, nessun `any`), classe `ConfigError` (elenca ogni variabile responsabile), e `decideBoot()` + tipo `BootDecision` (decisione di boot testabile senza DOM).
- `src/app/main.tsx` — **modifica**: invoca `decideBoot()` prima di `createRoot`; su `config-error` scrive il messaggio nel DOM e non monta `<App/>`.
- `src/app/env.test.ts` — **nuovo**: 11 unit test (righe della I/O Matrix del validatore + `decideBoot`).
- `src/deploy-config.test.ts` — **nuovo**: 3 test sulla forma di `vercel.json` (framework/install/build, output-dir, rewrite SPA) per le righe deep-link / percorso-interno.
- `_bmad-output/implementation-artifacts/spec-1-2-un-indirizzo-pubblico-raggiungibile.md` — questo spec: triage, Auto Run Result, `operator_actions`, `status: awaiting-operator`.

**Findings di review:** 2 patch applicati (1 medium: decisione di boot ora testata via `decideBoot`; 1 low: asserzioni deploy-breaking su `vercel.json`), 0 deferiti, 0 intent_gap, 0 bad_spec, ~20 rifiutati (falsi positivi da codice abbreviato nel prompt del reviewer, casi difensivi senza chiamante reale, over-engineering, o correttamente di proprietà dell'operatore).

**Follow-up review recommendation: false.** Patch di questa passata: high 0, medium 1, low 1. Punteggio `3×medium + 1×low = 3×1 + 1×1 = 4 < 5` e nessun high ⇒ `false`.

**Verifica eseguita (tutta verde):** `npm run lint` (0 errori), `npm run typecheck` (`tsc` strict, nessun `any`), `npm test` (20 test su 4 file: 11 `env` + 3 `deploy-config` + 5 sonde di confine di 1.1 senza regressioni + 1 scaffold), `npm run build` (`dist/` con solo `index.html` + `assets/`; scansione conferma nessun `_bmad-output`/`epics` nell'output).

**Rischi residui / azioni operatore.** Il routing live (`AC3`/`AC4`), la pubblicazione in produzione al merge (`AC1`) e l'anteprima per PR (`AC2`) dipendono dalla console Vercel e non sono verificabili in una sessione non presidiata: sono enumerati in `operator_actions`. In particolare, senza le `VITE_*` impostate su Vercel il deploy costruisce ma l'app mostra la schermata di `ConfigError` (fail-fast che si comporta come previsto). La riscrittura SPA fa sì che `/_bmad-output/...` restituisca `index.html` (200) invece del file: l'albero interno non è esposto, ma un operatore che preferisca un 404 esplicito può aggiungere una regola dedicata in futuro.
