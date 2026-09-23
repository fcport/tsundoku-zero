---
title: 'Story 1.1: Scaffold con i confini imposti in CI'
type: 'chore'
created: '2026-09-23'
status: 'done'
baseline_revision: 'b37dcdc9bd0bf33574ddeee3b6bebac2f7a58687'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Irrigidire la purezza del dominio oltre i quattro casi dell'AC (AD-3/AD-4): vietare
      in src/domain i global di orologio/casualità (Date.now, new Date senza argomenti,
      Math.random) e gli import di builtin node: che boundaries/external potrebbe non
      intercettare.
    evidence: |-
      L'AC2 della storia elenca solo React, @supabase/supabase-js, fetch e storage, e la
      config li impone come ERROR. Ma AD-3 (tempo come parametro) e AD-4 (nessun
      Math.random nel dominio) diventano vincoli meccanici necessari quando arriva la
      logica di scheduling/streak del dominio (Epic 3). Oggi il dominio non ha codice
      tempo/casualità, quindi la conseguenza è nulla: va imposto prima che quel codice esista.
    location: >-
      eslint.config.js (override src/domain/**)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Il repository è vuoto lato applicazione: nessuno scheletro, nessun confine. Il vincolo portante del progetto — `AD-1`, `domain → data → ui → features → app` più `i18n`, dominio puro — va reso **meccanico in CI prima che esista codice da vincolare**, altrimenti ogni contributo successivo (umano o agente) può violarlo e ripulirlo diventa un'epica a sé.

**Approach:** Inizializzare a mano (nessuno starter template) Vite + React 19 + TypeScript `strict`, creare l'albero a sei livelli, e cablare `eslint-plugin-boundaries` + `typescript-eslint` così che una violazione di confine sia un **errore** (CI rossa, non un avviso). Aggiungere una GitHub Action su pull request che esegue lint, typecheck e test unitari e genera `docs/dependency-graph.svg` con `dependency-cruiser`. Le regole di confine sono **dimostrate** da test unitari che lintano frammenti in violazione via API programmatica di ESLint, senza committare file rotti.

## Boundaries & Constraints

**Always:**
- Init **manuale**, mai `create-vite`/starter: uno starter viola `AD-1` dalla prima riga.
- Esattamente sei livelli: `src/domain/`, `src/data/`, `src/ui/`, `src/features/`, `src/app/`, `src/i18n/`, ciascuno con almeno un modulo reale.
- Archi ammessi (grafo `AD-1`, ogni freccia assente è vietata): `data→domain`; `ui→i18n`; `features→domain|ui|i18n` (**mai** `data`); `app→tutti`; `domain` e `i18n` non dipendono da altri livelli.
- `src/domain/` non importa **nessun** pacchetto esterno (in particolare `react`, `@supabase/supabase-js`) né usa i global `fetch`/storage — imposto come regola ERROR.
- Lint/typecheck/test che falliscono ⇒ exit non-zero ⇒ job CI rosso.
- `npm` con `package-lock.json` versionato; la CI usa `npm ci`, **mai** `npm install`.
- TypeScript `strict`, pinnato a `5.9.x` (**non** 7.x: senza API stabile non esiste `typescript-eslint`, quindi non esiste la regola meccanica di `AD-1`). Puntare alle versioni della tabella Stack dove risolvono.

**Block If:**
- Nessuna decisione richiede un umano: i prerequisiti (repo git, Node/npm, registro raggiungibile) sono già presenti. Solo un guasto d'ambiente irreparabile (registro npm irraggiungibile) è un blocco.

**Never:**
- Niente Next/SSR (`AD-20`); niente Tailwind/token (Story 1.3), cataloghi i18next (1.4), schema/RLS/auth/`supabase-js` (1.5–1.10). **Solo scaffold.**
- Nessun file sorgente in violazione committato sotto `src/` (terrebbe la CI rossa): le violazioni si esercitano solo nei test-sonda.
- Nessuna regola ESLint *type-aware* che richieda `project` nel tsconfig: renderebbe fragili i test-sonda su file virtuali. I tipi li verifica `tsc`.
- Non installare lo stack runtime completo (React Router, TanStack Query, Zustand, i18next, supabase-js): fuori scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| domain→react | file virtuale `src/domain/*.ts` con `import 'react'` | ESLint riporta errore `boundaries/external` | lint exit ≠ 0 → CI rossa |
| domain→supabase | domain con `import '@supabase/supabase-js'` | errore `boundaries/external` | CI rossa |
| domain→fetch/storage | domain che referenzia `fetch`/`localStorage` | errore `no-restricted-globals` | CI rossa |
| features→data | `src/features/*.ts` con `import '../data/…'` | errore `boundaries/element-types` | CI rossa |
| scaffold pulito | l'albero `src/` reale | ESLint 0 errori | — |

</intent-contract>

## Code Map

Greenfield: tutti i file sono da **creare**. Presenti già: `.gitignore` (esclude `node_modules/`, `dist/`, `coverage/`, `.env*`), `.env.example` (nomi `VITE_*`, nessun valore).

- `package.json` -- deps + script `dev|build|lint|typecheck|test|graph`; devDeps: vite, @vitejs/plugin-react, typescript ~5.9, eslint, typescript-eslint, eslint-plugin-boundaries, eslint-import-resolver-typescript, globals, @eslint/js, vitest, dependency-cruiser; deps: react, react-dom.
- `package-lock.json` -- lockfile versionato per `npm ci`.
- `tsconfig.json` (+ `tsconfig.node.json`) -- `strict`, `noUnusedLocals`, `jsx: react-jsx`, `moduleResolution: bundler`.
- `vite.config.ts` -- Vite + plugin React. `vitest.config.ts` (o `test` in vite.config) -- glob `**/*.test.ts`, env node.
- `eslint.config.js` -- flat config; `boundaries/elements` mappa `src/<livello>` ai tipi; `boundaries/element-types` (matrice archi, `default: disallow`); `boundaries/external` (dominio `disallow` tutto); override `src/domain/**` con `no-restricted-globals` (fetch, localStorage, sessionStorage, indexedDB); resolver typescript.
- `.dependency-cruiser.cjs` -- config per generare il grafo (tsConfig, estensioni ts/tsx); nessuna regola bloccante.
- `index.html`, `src/app/main.tsx` -- entry React (monta `<App/>`). `src/ui/App.tsx` -- placeholder presentazionale minimo (nome progetto, nessuna copy da tradurre).
- `src/domain/scaffold.ts` + `src/domain/scaffold.test.ts` -- funzione pura banale + unit test (prova che i test girano).
- `src/data/index.ts`, `src/features/index.ts`, `src/i18n/index.ts` -- moduli placeholder reali (nodi del grafo; `data/index.ts` è il bersaglio della sonda features→data).
- `src/boundaries.test.ts` -- test-sonda: istanzia `ESLint`, `lintText` sui frammenti in violazione, asserisce i `ruleId` attesi (righe della I/O Matrix).
- `.github/workflows/ci.yml` -- su `pull_request` (+ push `main`): `npm ci` → `lint` → `typecheck` → `test` → install graphviz + `graph` → upload artefatto `docs/dependency-graph.svg`.
- `docs/.gitkeep` -- garantisce la cartella per il grafo. `.nvmrc` -- Node pinnato per la CI.

## Tasks & Acceptance

**Execution:**
- `package.json` + `package-lock.json` -- inizializzare a mano, installare la toolchain con `npm install` (genera il lock), committare il lock -- base per `npm ci` deterministico.
- `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/app/main.tsx`, `src/ui/App.tsx` -- app Vite+React minima che builda e passa `tsc` strict.
- `src/domain/scaffold.ts` + `.test.ts`, `src/data/index.ts`, `src/features/index.ts`, `src/i18n/index.ts` -- popolare i sei livelli con moduli reali; un unit test verde.
- `eslint.config.js` -- configurare i tipi-elemento e le regole di confine finché **tutte** le sonde falliscono sulle violazioni e l'albero reale linta a 0 errori.
- `src/boundaries.test.ts` -- codificare le cinque righe della I/O Matrix come asserzioni sui `ruleId`.
- `.dependency-cruiser.cjs`, `docs/.gitkeep` -- generazione del grafo, non enforcement.
- `.github/workflows/ci.yml`, `.nvmrc` -- pipeline PR con gli step nell'ordine sopra; ogni fallimento fa fallire il job.

**Acceptance Criteria:**
- Given un checkout pulito, when gira `npm ci` sul `package-lock.json` versionato, then le dipendenze si installano senza errori e senza mutare il lock.
- Given l'albero sorgente, when lo si ispeziona, then esistono `src/domain|data|ui|features|app|i18n`, ciascuno con un modulo reale.
- Given `npm run lint` sull'albero reale, when gira, then esce con 0 errori; e `npm run typecheck` passa in `strict`.
- Given `npm test`, when gira, then il test di dominio passa e le cinque sonde di confine confermano che le violazioni producono gli errori attesi.
- Given una pull request, when la GitHub Action gira, then lint, typecheck e test unitari vengono eseguiti tutti come check e `dependency-cruiser` produce `docs/dependency-graph.svg` (caricato come artefatto); un fallimento di lint/typecheck/test fa fallire il job, non emette un avviso.

## Spec Change Log

_Nessuna modifica allo spec: nessun loopback `bad_spec` in questa run._

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 1, low 3)
- defer: 1: (high 0, medium 0, low 1)
- reject: 22: (high 0, medium 3, low 19)
- addressed_findings:
  - `[medium]` `[patch]` Sonde di violazione (`src/boundaries.test.ts`): ora asseriscono la severità ERROR (2), non solo il `ruleId` — un downgrade di una regola di confine a `warn` fa fallire la sonda, chiudendo il buco "avviso invece di CI rossa" dell'AC2; aggiunto guard anti-vacuità alla sonda "scaffold pulito".
  - `[low]` `[patch]` Script `graph` (`package.json`): pipe `depcruise | dot` sostituita con `--output-to` + `&&`, così un fallimento di `depcruise` non è più mascherato dall'exit di `dot` (npm usa `sh`/dash, senza pipefail).
  - `[low]` `[patch]` Rimosso `tsconfig.node.json` morto (non referenziato; `tsconfig.json` copre già i file di config).
  - `[low]` `[patch]` Glob vitest allargato a `src/**/*.test.{ts,tsx}` per non saltare in silenzio futuri test `.tsx`.

### 2026-09-23 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 1, low 0)
- defer: 0
- reject: 29: (high 0, medium 0, low 29)
- addressed_findings:
  - `[medium]` `[patch]` Flakiness a freddo delle sonde di confine (`src/boundaries.test.ts`, `vitest.config.ts`): il reviewer verification-gap ha dimostrato dal vivo che la PRIMA `lintText` paga a freddo il caricamento della flat config e il bootstrap del resolver TypeScript (~6s osservati), superando il timeout per-test di default di vitest (5s) su un runner freddo. Conseguenza: la CI andrebbe rossa per un timeout d'infrastruttura invece che per una violazione di confine reale — minando la garanzia portante della storia (rosso = violazione vera). Fix: riscaldamento di ESLint nel `beforeAll` (ammortizza il costo a freddo fuori dai corpi cronometrati) e `hookTimeout`/`testTimeout` alzati a 30s in `vitest.config.ts` come rete di sicurezza. Le altre segnalazioni sono state rifiutate perché fuori scope rispetto all'intent (irrigidimento della purezza del dominio oltre i quattro global dell'AC — già a ledger deferred di proprietà dell'orchestrator), fattualmente errate (es. `docs/` esiste via `docs/.gitkeep`; la sonda "scaffold pulito" verifica proprio l'exit pulito sull'albero reale; `import/resolver` è usato da `eslint-plugin-boundaries`, non morto) o rumore cosmetico.

## Design Notes

**Perché test-sonda invece di file rotti committati.** Committare un file dominio→react per "dimostrare" la regola terrebbe la CI rossa per sempre. La sonda lintà un frammento *virtuale* con l'API di ESLint, così la regola è provata a ogni `npm test` senza sporcare l'albero:

```ts
const eslint = new ESLint({ cwd: repoRoot });
const [res] = await eslint.lintText("import 'react';\n",
  { filePath: 'src/domain/__probe__.ts', warnIgnored: false });
expect(res.messages.some(m => m.ruleId === 'boundaries/external')).toBe(true);
```

La sonda `features→data` importa un modulo `data` **reale** (`../data/index`) perché il resolver deve classificarlo. Niente regole type-aware: `lintText` su path virtuali fallirebbe se ESLint pretendesse il file nel programma TS; i tipi sono dominio di `tsc`. La forma delle regole (`boundaries/elements` + `element-types` con `default: 'disallow'` + `external` che vieta tutto al dominio) è intento: l'implementer aggiusta la sintassi contro la versione installata **finché le sonde diventano verdi**.

## Verification

**Commands:**
- `npm ci` -- expected: install pulito dal lock, nessuna modifica a `package-lock.json`.
- `npm run lint` -- expected: 0 errori sull'albero `src/`.
- `npm run typecheck` -- expected: `tsc` senza errori in `strict`.
- `npm test` -- expected: unit test di dominio + 5 sonde di confine tutti verdi.
- `npm run build` -- expected: `vite build` produce `dist/`.
- `npm run graph` -- expected: scrive `docs/dependency-graph.svg` (richiede graphviz `dot`; in locale, se `dot` manca, verificare che l'output DOT di `depcruise` sia prodotto — la CI installa graphviz).

**Manual checks (if no CLI):**
- Ispezionare `.github/workflows/ci.yml`: trigger `pull_request`, step nell'ordine `npm ci → lint → typecheck → test → graph → upload`, nessuno step marcato `continue-on-error`.

## Auto Run Result

Status: done (follow-up review pass)

**Sommario.** Passata di review di follow-up su una storia già implementata e committata (`168713e`): scaffold manuale Vite 8 + React 19 + TypeScript 5.9.3 `strict`, albero a sei livelli (`domain/data/ui/features/app/i18n`) con i confini di `AD-1` imposti come ERROR da `eslint-plugin-boundaries@5.4.0` e cinque sonde che lintano frammenti virtuali via API di ESLint. Questa passata ha triato le segnalazioni dei quattro layer di review e applicato un solo patch: eliminata la flakiness a freddo delle sonde di confine, che poteva far cadere la CI per timeout d'infrastruttura invece che per una violazione reale.

**File modificati in questa passata (uno per riga):**
- `src/boundaries.test.ts` — `beforeAll` reso `async` con un `lintText` di riscaldamento: il costo a freddo di flat config + resolver TypeScript è ammortizzato fuori dai corpi cronometrati dei test.
- `vitest.config.ts` — `hookTimeout`/`testTimeout` alzati a 30s (rete di sicurezza per il riscaldamento a freddo sul runner CI).
- `_bmad-output/implementation-artifacts/spec-1-1-scaffold-con-i-confini-imposti-in-ci.md` — nuova voce di triage, questo Auto Run Result, `followup_review_recommended: false`, `status: done`.

**Findings di review:** 1 patch applicato (1 medium, 0 low), 0 deferiti (l'irrigidimento della purezza del dominio oltre i quattro global dell'AC è già a ledger deferred, di proprietà dell'orchestrator: non riaperto), 29 rifiutati (fuori scope rispetto all'intent — irrigidimento dominio, formattazione/Prettier, LICENSE/README, deploy/env di 1.2, i18n di 1.4 — oppure fattualmente errati o rumore cosmetico).

**Follow-up review recommendation: false.** Solo patch di questa passata: high 0, medium 1, low 0. Punteggio `3×medium + 1×low = 3×1 + 1×0 = 3 < 5` e nessun high ⇒ `false`.

**Verifica eseguita (tutta verde):** `npm run lint` (0 errori sull'albero reale), `npm run typecheck` (`tsc` strict senza errori), `npm test` (6 test: 1 unit di dominio + 5 sonde a severità ERROR; suite di confine in 823ms con il riscaldamento a monte), `npm run build` (`vite build` produce `dist/`). `npm run graph`: `depcruise` emette DOT valido sui sei livelli (archi osservati: `app→ui`, `data→domain`, `features→domain`); il rendering `dot` è delegato alla CI (graphviz assente in locale, come previsto dallo spec).

**Rischi residui:** l'effettiva esecuzione rossa della GitHub Action su una violazione reale è verificabile solo alla prima PR (non eseguibile in sessione non presidiata); la config + le sonde a severità ERROR la rendono meccanicamente prevedibile. La purezza del dominio è imposta oggi sui soli quattro casi dell'AC (react/supabase/fetch/storage): l'estensione a orologio/casualità e ai builtin `node:` resta a ledger deferred per l'Epic 3, quando arriverà il codice di dominio che li renderebbe rilevanti.

