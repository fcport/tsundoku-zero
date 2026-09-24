---
title: "Story 2.6: La validazione blocca il merge"
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: '71d07b7282e6ad61b1361424da894b0a8d9fbf36'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Il cancello non valida i confini dello span di select-span (answer.end ≤ numero di segmenti reali della frase).
    evidence: |-
      exercise.ts flagga questo come «controllo di CONTENUTO in 2.6 (richiede la segmentazione)», ma la
      segmentazione è alignFurigana() in src/domain/furigana.ts, consegnata in Epic 3 (storia 3.6, AD-21):
      non esiste ancora. Oggi lo schema accetta solo end > start ≥ 0, quindi un answer.end che eccede i
      segmenti reali passa il cancello. Da agganciare a questo stesso cancello quando furigana.ts esisterà.
    location: >-
      src/domain/content-validation.ts / scripts/validate-content.ts
    severity: medium
  - summary: >-
      Il cancello verifica la coerenza kanji/kana solo a livello di carattere (nessun Han in kana), non la piena allineabilità.
    evidence: |-
      AD-25 lega «coerenza kanji/kana» ad AD-21 («richiede che siano allineabili»). La verifica che
      alignFurigana() produca segmenti validi per la coppia (kanji, kana) richiede quella funzione, che è
      Epic 3 (storia 3.6). Il controllo attuale (no Han in kana) è la condizione necessaria implementabile
      ora; l'allineabilità piena resta da agganciare al cancello quando furigana.ts esisterà.
    location: >-
      src/domain/content-validation.ts
    severity: medium
  - summary: >-
      Il cancello non verifica che la answer di single-select non compaia anche fra i distractors.
    evidence: |-
      Un esercizio con answer presente anche nei distractors ha due opzioni corrette: è di fatto irrisolvibile.
      Lo schema non lo esprime e l'intento di 2.6 non lo elenca fra i controlli, ma è un difetto di contenuto
      che un cancello di validazione dovrebbe cogliere. Candidato controllo di integrità intra-esercizio futuro.
    location: >-
      src/domain/content-validation.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** Il contratto dell'esercizio esiste (schema unico, registro chiuso dei tre tipi, identità da contenuto, ripiego bilingue), ma nulla impedisce a una lezione malformata di raggiungere la produzione. FR2.6/AD-25 chiede un CANCELLO in CI: un file di lezione rotto deve bloccare il merge, non emergere come esercizio rotto davanti all'utente. Oggi `parseLesson`/`lessonId`/`deriveExerciseId` esistono ma nessuno li invoca su `content/lessons/`, e i commenti di `lesson.ts` rimandano a «2.6» sia l'unicità sia il path localizzato in CI.

**Approach:** Un validatore di dominio PURO `validateLessons()` che, riusando la fonte unica `parseLesson` (mai una reimplementazione), verifica ogni file e i vincoli cross-file, più uno script CLI `scripts/validate-content.ts` che fa l'unica I/O (glob dei file, lettura, uscita non-zero) ed è cablato come step di `ci.yml` senza `continue-on-error`. Un file malformato ⇒ CI rossa ⇒ merge bloccato.

## Boundaries & Constraints

**Always:**
- **Superficie osservata (outermost):** il CANCELLO di CI. `npm run validate-content` esce non-zero quando un file sotto `content/lessons/` è malformato, esce zero quando tutti conformano (o nessuno esiste ancora), ed è uno step di `.github/workflows/ci.yml` senza `continue-on-error` — così un file rotto blocca il merge (AC3).
- La logica è una funzione di dominio PURA `validateLessons(files: ReadonlyArray<{ path: string; source: string }>): ContentIssue[]` in `src/domain/content-validation.ts`. Pura/totale: `JSON.parse` (builtin puro del linguaggio) in `try/catch`, nessuna I/O, nessun import esterno, nessun global vietato (AD-1). Ritorna `[]` **se e solo se** ogni file conforma.
- Il cancello verifica (AC1): (a) **conformità allo schema** via `parseLesson` — che SUSSUME «`kind` fra i tre del registro» (un `kind` fuori dai tre ⇒ issue sul path `…kind`, AC2/AD-22) e «spiegazione inglese presente» (`explanation.en` non vuoto); (b) **coerenza kanji/kana** oltre lo schema: il campo `kana` di ogni frase non contiene ideogrammi Han (una lettura con kanji non è una lettura); (c) **unicità degli identificatori** cross-file: `lessonId` fra le lezioni e `deriveExerciseId` (AD-23) fra TUTTI gli esercizi.
- La scoperta dei file avviene per **glob** di `content/lessons/**/*.json` — nessun elenco cablato — così aggiungere una lezione conforme non richiede modifiche al codice (AC4). Formato dei file: **JSON** (PRD §2, `content/lessons/NN-*.json`).
- Cartella assente o vuota ⇒ 0 lezioni ⇒ cancello verde (il contenuto arriva in 2.7).
- Ogni `ContentIssue` porta `file` + `path` + `message`, così il campo malformato è indicabile in CI.
- TypeScript strict, **nessun `any`**. `scripts/validate-content.ts` entra in `tsconfig.json` `include` così `npm run typecheck` lo copre.

**Block If:** _Nessun blocco._ Storia interamente in-repo (dominio puro + script Node + wiring CI YAML): nessuna azione umana né vendor. Esito atteso `done`.

**Never:**
- **Non** reimplementare la validazione dello schema nello script né nel validatore: la fonte unica è `parseLesson` di 2.1/2.2 (AC1/AD-25). Lo script fa SOLO I/O (glob + read + print + exit).
- **Non** implementare qui `alignFurigana()` né la segmentazione della furigana: vive in `src/domain/furigana.ts`, consegnata in Epic 3 (storia 3.6, AD-21). Di conseguenza il controllo dei confini dello span di `select-span` (che `answer.end` non superi il numero di segmenti reali — flaggato «controllo di contenuto 2.6, richiede la segmentazione» in `exercise.ts`) e la PIENA allineabilità kanji↔kana restano fuori scope, da agganciare a QUESTO stesso cancello quando `furigana.ts` esisterà (vedi Design Notes).
- **Non** filtrare lo step CI ai soli PR che toccano `content/lessons/`: il cancello gira su OGNI PR (superset), così anche un cambio di schema/validatore che invaliderebbe contenuto esistente fallisce.
- **Non** modificare lo schema/dominio esistente (`schema.ts`, `exercise.ts`, `lesson.ts`, `exercise-identity.ts`): 2.6 li CONSUMA.
- **Non** aggiungere dipendenze npm: glob via `node:fs`, nessun pacchetto di validazione/YAML/glob.

## I/O & Edge-Case Matrix

`validateLessons(files)`:

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| tutti conformi | file JSON validi e distinti | `[]` | n/a |
| cartella vuota | `[]` | `[]` (0 lezioni conforme) | n/a |
| JSON non valido | `source` non parsabile | 1 issue `{ file, path: [], message: 'JSON non valido…' }`; salta gli altri controlli del file | `try/catch` |
| kind fuori registro | esercizio con `kind:'foo'` | issue sul path `exercises.<i>.kind` (AC2, AD-22) | via `parseLesson` |
| spiegazione en assente/vuota | `explanation.en` `''` o mancante | issue sul path `…explanation.en` | via `parseLesson` |
| kana con kanji | `sentence.kana` contiene un Han | issue di coerenza sul path `…sentence.kana` | n/a |
| lessonId duplicato | due lezioni, stesso `grammarPoints[0]`-slug | issue di unicità che NOMINA i due file | n/a |
| exerciseId duplicato | due esercizi, stessa chiave naturale (kind+frase+risposta) | issue di unicità che nomina i due file/indici | n/a |

</intent-contract>

## Code Map

- `src/domain/content-validation.ts` — **NUOVO.** Il validatore puro `validateLessons()` + il tipo `ContentIssue { readonly file; readonly path; readonly message }`. Importa `parseLesson`/`lessonId` da `./lesson` e `deriveExerciseId` da `./exercise-identity` (archi domain→domain ammessi da AD-1). `JSON.parse` in `try/catch` (puro). Coerenza kana via `/\p{Script=Han}/u`. Unicità: due `Map<string, string[]>` (id → file/indici) e si segnala ogni chiave con più di un occupante. Riusa `SchemaIssue { path, message }` di `./schema` mappandolo su `ContentIssue` (aggiunge `file`).
- `src/domain/content-validation.test.ts` — **NUOVO.** Fixture inline (nessun file reale in `content/lessons/`, è 2.7). Un `it` per riga della matrice + una lezione valida (i tre tipi) + elenco vuoto + prova AC4 (una lezione conforme aggiunta all'elenco resta senza issue: nessun codice cambia). Stile `describe/it`, asserzioni `path.join('.')` come in `lesson.test.ts`.
- `scripts/validate-content.ts` — **NUOVO.** CLI del cancello. Glob `content/lessons/**/*.json` (`node:fs` `readdir` recursive; la dir bersaglio è opzionale da `process.argv[2]`, default `content/lessons`), legge ogni file come testo, chiama `validateLessons`, stampa gli issue (`file — path: message`), `process.exit(issues.length > 0 ? 1 : 0)`. Cartella assente ⇒ nessun file ⇒ exit 0. Eseguito da `vite-node`. Modellato su `scripts/check-contrast.mjs` (runner CLI, exit non-zero sui fallimenti).
- `content/lessons/.gitkeep` — **NUOVO.** Versiona la cartella bersaglio (vuota fino a 2.7); documenta dove vanno le lezioni e rende dimostrabile la scoperta per glob (AC4).
- `package.json` — **MODIFICA.** Aggiungere lo script `"validate-content": "vite-node scripts/validate-content.ts"`.
- `.github/workflows/ci.yml` — **MODIFICA.** Aggiungere lo step `Validazione del contenuto (cancello FR2.6)` che esegue `npm run validate-content`, senza `continue-on-error` (un file malformato ⇒ CI rossa ⇒ merge bloccato, AC3). Gira su ogni `pull_request` e su `push` a `main` (trigger già presenti nel workflow).
- `tsconfig.json` — **MODIFICA.** Aggiungere `"scripts"` all'`include` così `npm run typecheck` copre lo script `.ts` (tsc ignora i `.mjs`: `check-contrast.mjs` resta fuori, nessun effetto collaterale).
- **RIFERIMENTO (non modificare):** `src/domain/lesson.ts` (`parseLesson`, `lessonId`; i commenti attribuiscono già a 2.6 l'unicità e il path in CI), `src/domain/exercise-identity.ts` (`deriveExerciseId`, AD-23), `src/domain/exercise.ts` (`exerciseSchema` registro chiuso; commento «span bounds = 2.6 + segmentazione»), `src/domain/schema.ts` (`SchemaIssue { path, message }`, i validatori non lanciano), `scripts/check-contrast.mjs` (pattern del runner CLI), `eslint.config.js` (`scripts/**` ha i global Node; nessun nuovo arco di confine da registrare).

## Tasks & Acceptance

**Execution:**
- `src/domain/content-validation.ts` — implementare `ContentIssue` e `validateLessons()` (puro, totale): per file → `JSON.parse` in `try/catch` (parse fallito ⇒ issue e stop del file) → `parseLesson` (issue di schema mappati con `file`) → coerenza `kana` (nessun Han) su ogni frase; poi unicità cross-file di `lessonId` e `deriveExerciseId`. Nessun import esterno, nessun `any`.
- `src/domain/content-validation.test.ts` — coprire ogni riga della I/O matrix + lezione valida coi tre tipi + elenco vuoto + prova AC4. Fixture inline.
- `scripts/validate-content.ts` — CLI: glob → read → `validateLessons` → stampa → `process.exit`. Dir opzionale da `argv[2]`. Nessuna logica di validazione duplicata.
- `content/lessons/.gitkeep` — creare la cartella bersaglio versionata.
- `package.json` — aggiungere lo script `validate-content`.
- `.github/workflows/ci.yml` — aggiungere lo step del cancello.
- `tsconfig.json` — aggiungere `"scripts"` all'`include`.

**Acceptance Criteria:**
- Given un elenco di file lezione, when `validateLessons` gira, then verifica conformità allo schema (`parseLesson`), `kind` fra i tre del registro, spiegazione inglese presente, coerenza kanji/kana (nessun Han in `kana`), e unicità di `lessonId` e `deriveExerciseId`; ritorna `[]` se e solo se tutti i file conformano (AC1 d'epica).
- Given un file con un esercizio dal `kind` fuori dal registro, when validato, then `validateLessons` ritorna un issue localizzato sul path `exercises.<i>.kind`: è un errore di validazione, non un caso ignorato a runtime (AC2 d'epica, AD-22).
- Given `content/lessons/` con un file malformato, when `npm run validate-content` gira (come nello step CI), then esce con codice non-zero; con soli file conformi (o cartella vuota) esce con zero; e `.github/workflows/ci.yml` esegue lo step senza `continue-on-error`, così un file malformato **blocca il merge** (AC3 d'epica).
- Given una lezione nuova conforme aggiunta a `content/lessons/`, when la validazione gira, then la scopre per glob e la valida senza alcuna modifica al codice — nessun elenco di file cablato (AC4 d'epica).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run validate-content`, when girano, then passano senza regressioni e senza alcun `any`.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 2, low 2)
- defer: 3: (high 0, medium 2, low 1)
- reject: 12: (high 0, medium 0, low 12)
- addressed_findings:
  - `[medium]` `[patch]` `discover()` filtrava `.json` case-sensitive ⇒ un file reale `*.JSON` veniva saltato in silenzio (falso verde). Ora confronto case-insensitive + filtro `dirent.isFile()`.
  - `[low]` `[patch]` `discover()` crashava su una CARTELLA con nome `*.json` (EISDIR) e su `ENOTDIR`. Ora salta i non-file e tratta `ENOENT`/`ENOTDIR` come zero lezioni.
  - `[medium]` `[patch]` Il contratto detection⇄exit-code della CLI (il cuore di AC3) non aveva test automatici. Estratto `collectIssues` puro, guardia dell'entrypoint, e nuovo `src/validate-content-script.test.ts` che SPAWNA la CLI reale (malformato ⇒ exit≠0, conforme ⇒ exit 0) più i test di scoperta robusta.
  - `[low]` `[patch]` Il wiring in `ci.yml` non era ancorato. Ora un test asserisce che lo step `npm run validate-content` esiste e non porta `continue-on-error`.

Quattro layer in parallelo su Opus. **Intent-Alignment** (descrittivo): il diff implementa la lettura forte di AC3 (cancello su OGNI PR, non solo su quelli che toccano `content/lessons/`), AC2 e AC4 esattamente alle superfici nominate, e la clausola coerenza kanji/kana nella sua fetta implementabile oggi (R-C1: nessun Han in `kana`); l'allineabilità piena (R-C2) e i confini dello span di `select-span` (R-C3) dipendono da `alignFurigana()` (Epic 3) e sono correttamente deferiti. **Verification-Gap**: due lacune reali sulla superficie centrale di AC3 (exit-code della CLI e wiring di `ci.yml` non testati) ⇒ patch. **Edge-Case Hunter**: tre percorsi non gestiti in `discover()` (estensione case, `*.json`-cartella/EISDIR, ENOTDIR) ⇒ patch. **Blind Hunter**: 16 rilievi; i reali confluiscono nei patch/defer sopra, i restanti rifiutati.

Findings rifiutati (12, tutti low; dedup applicato). Rappresentativi: **coerenza inversa** (esigere Han in `kanji`) — falso-bloccherebbe le frasi valide tutte-kana (ありがとう), che 3.6 dichiara valide. **collisione `exerciseId` = riuso legittimo** — l'intento IMPONE «unicità degli identificatori» (AD-25/AD-23): due esercizi con stessa chiave naturale sono la stessa identità e vanno segnalati, non dedotti. **`sort()` non deterministico** — premessa errata: il sort di default confronta per unità di codice UTF-16, deterministico cross-platform (non `localeCompare`). **tsconfig `scripts` fa filtrare i global Node in `src`** — verificato falso: `@types/node` presente, i confini AD-1 sono imposti da ESLint (non da `tsc`), lint e typecheck puliti. **HAN non-positivo** (non esige `kana` composto SOLO di kana) — scelta conservativa deliberata: un allowlist positivo respingerebbe katakana/ー/・/cifre legittimi nella lettura. **idioma `Map`, estensione import `.ts`, campo `file` con lista, messaggio dir-vuota, commento CI** — funzionano/cosmetici (typecheck+lint+382 test verdi).

### 2026-09-24 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - none

Pass di follow-up (lo spec era già `done`, `followup_review_recommended: true`). Quattro layer in parallelo su Opus sullo stesso diff (baseline `71d07b7`). **Edge-Case Hunter** e **Verification-Gap**: nessun rilievo — ogni branch dai changed lines ha una guardia esplicita e i due file di test esercitano davvero le superfici (il contratto detection⇄exit-code è provato spawnando la CLI reale via `vite-node`). **Intent-Alignment** (descrittivo): il diff implementa la lettura fedele su ogni asse (delega dello schema a `parseLesson`, controllo di CARATTERE su `kana`, unicità cross-file, glob robusto, exit-code + wiring CI), nessuna divergenza sostanziale, superfici testate al posto giusto. **Blind Hunter**: 14 rilievi «cosa manca», tutti triage­ati `reject` (low): già catturati nel pass precedente (answer∈distractors e span-bounds/allineabilità già in `deferred`; idioma `Map` e campo `file`-lista già rifiutati); fail-closed corretto su errori FS non-`ENOENT/ENOTDIR` (cancello ROSSO, non falso-verde); non-problemi (`dirent.parentPath` sicuro con `engines >=20.19.0` > 20.12 e `.nvmrc` 22; `argv[2]` typo solo in run manuali, non in CI); fuori scope per autorità dell'intento (convenzione `NN-*.json`, duplicate-key JSON, BOM, concorrenza `Promise.all` — robustezze speculative a 0 lezioni). Nessun falso-verde reale. Verifica ri-eseguita in questo pass: typecheck/lint/`validate-content` puliti, 382 test verdi. Nessuna patch applicata ⇒ codice invariato rispetto a `72aca6c`.

## Design Notes

**Perché uno script CLI + un validatore puro (non solo un test).** Il cancello riusa la stessa spina di `check-contrast`: logica pura testata da `npm test`, più uno script dedicato con uno step CI LEGGIBILE («Validazione del contenuto») — un revisore vede quale cancello è rosso, non un fallimento sepolto in `npm test`. `validateLessons` è puro perché `JSON.parse` e i validatori di dominio lo sono; l'unica impurità (glob + read) sta nello script, fuori dal dominio (AD-1).

**Perché `vite-node`.** Lo script deve importare il validatore di dominio (TypeScript, fonte unica): un `.mjs` non può importare `.ts` sotto Node. `vite-node` (già presente come dipendenza di vitest, `node_modules/.bin/vite-node`) esegue TS riusando il transform di vite — nessuna nuova dipendenza, nessun `--experimental-strip-types` fragile. `.nvmrc` è `22`: `vite-node` gira dopo `npm ci`.

**Coerenza kanji/kana: cosa è imponibile ORA.** Lo schema garantisce già `kanji` e `kana` presenti, separati, non vuoti — la precondizione di allineabilità di AD-21/FR2.3. 2.6 aggiunge il guardiano oltre-schema che il campo lettura (`kana`) non contenga ideogrammi Han (`/\p{Script=Han}/u`): una lettura con un kanji dentro non è una lettura, e `alignFurigana()` non potrebbe derivarne la furigana. Questo è un controllo di CARATTERE, non di segmentazione, quindi non dipende da Epic 3 e non produce falsi positivi (katakana, hiragana, ー, ・, punteggiatura, cifre e latino non sono Han). La PIENA allineabilità (che `alignFurigana()` produca segmenti validi) e il controllo dei confini dello span di `select-span` (che `answer.end` ≤ numero di segmenti) richiedono `src/domain/furigana.ts`, che è Epic 3 (storia 3.6, AD-21): restano fuori scope qui e vanno agganciati a questo stesso cancello quando quella funzione esisterà. Il commento di `exercise.ts` («controllo di contenuto 2.6, richiede la segmentazione») anticipa esattamente questa dipendenza in avanti.

**Perché il cancello gira su OGNI PR.** Un cambio di schema/validatore può invalidare contenuto già presente; girare sempre è un superset più forte di «solo i PR che toccano `content/lessons/`», e a 0 lezioni è un no-op veloce.

Golden example (forma del validatore puro):

```ts
export interface ContentIssue {
  readonly file: string;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}
export function validateLessons(
  files: ReadonlyArray<{ path: string; source: string }>,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const lessonIds = new Map<string, string[]>();
  const exerciseIds = new Map<string, string[]>();
  for (const { path: file, source } of files) {
    let data: unknown;
    try { data = JSON.parse(source); }
    catch (e) { issues.push({ file, path: [], message: `JSON non valido: ${(e as Error).message}` }); continue; }
    const parsed = parseLesson(data);
    if (!parsed.ok) { for (const i of parsed.issues) issues.push({ file, path: i.path, message: i.message }); continue; }
    // coerenza kana (nessun Han) + raccolta id per l'unicità cross-file …
  }
  // segnala le chiavi di lessonIds/exerciseIds con più di un file …
  return issues;
}
```

## Verification

**Commands:**
- `npm run typecheck` — `tsc` strict copre anche `scripts/validate-content.ts` (via `include`); nessun `any`.
- `npm run lint` — 0 errori; `content-validation.ts` non introduce import esterni nel dominio (`boundaries/external`) né global vietati.
- `npm test` — il blocco di `content-validation.test.ts` passa (matrice + valido + vuoto + AC4) più le sonde 1.1–2.5 senza regressioni.
- `npm run build` — `tsc --noEmit` + `vite build` producono `dist/` senza errori.
- `npm run validate-content` — con `content/lessons/` vuota esce 0; verificato anche su una fixture di scratch con un file malformato ⇒ exit 1 (`vite-node scripts/validate-content.ts <dir-fixture>`) e su una fixture conforme ⇒ exit 0.

## Auto Run Result

Status: done

**Change implementata.** Cancello di CI FR2.6/AD-25 «la validazione blocca il merge»: un validatore di dominio PURO `validateLessons()` (riusa `parseLesson` come fonte unica dello schema, aggiunge coerenza kanji/kana e unicità cross-file di `lessonId`/`deriveExerciseId`), una CLI `scripts/validate-content.ts` che fa l'unica I/O (glob + read + exit) via `vite-node`, e il wiring in `ci.yml` senza `continue-on-error`. Un file malformato ⇒ exit non-zero ⇒ CI rossa ⇒ merge bloccato. A 0 lezioni (cartella vuota fino a 2.7) il cancello è verde.

**File cambiati:**
- `src/domain/content-validation.ts` — NUOVO: `validateLessons()` puro/totale + tipi `LessonFile`/`ContentIssue`.
- `src/domain/content-validation.test.ts` — NUOVO: unit test inline sulla I/O matrix + AC4.
- `scripts/validate-content.ts` — NUOVO: CLI del cancello (glob robusto, `collectIssues` puro, guardia entrypoint `VITEST`).
- `src/validate-content-script.test.ts` — NUOVO: spawna la CLI reale (exit-code AC3), scoperta robusta, pin del wiring `ci.yml`.
- `content/lessons/.gitkeep` — NUOVO: versiona la cartella bersaglio vuota.
- `.github/workflows/ci.yml` — step `Validazione del contenuto (cancello FR2.6)` senza `continue-on-error`.
- `package.json` — script `validate-content`.
- `tsconfig.json` — `"scripts"` aggiunto a `include`.

**Review findings (questo pass di follow-up):** patch applicate 0; deferite 0; rifiutate 14 (tutte low). Tre layer specializzati (Edge-Case, Verification-Gap, Intent-Alignment) puliti; i 14 rilievi del Blind Hunter risultano già catturati nel pass precedente, fail-closed corretti, non-problemi o fuori scope per autorità dell'intento. Nessun falso-verde reale individuato. (Il pass iniziale aveva applicato 4 patch e registrato 3 defer, tuttora nel frontmatter `deferred`.)

**Follow-up review recommendation:** false. Solo rilievi `patch` contano: 0 patch questo pass ⇒ punteggio `3×0 + 1×0 = 0` (< 5, nessun high) ⇒ `false`.

**Verifica eseguita:** `npm run typecheck` ✓ (0 errori, nessun `any`), `npm run lint` ✓ (0 errori), `npm test` ✓ (382 test, 39 file), `npm run validate-content` ✓ (esce 0 su `content/lessons/` vuota). Nessuna patch ⇒ codice invariato rispetto al commit `72aca6c`.

**Rischi residui:** i tre item in `deferred` (confini dello span di `select-span`, allineabilità piena kanji↔kana, answer∈distractors) restano da agganciare a questo stesso cancello quando `alignFurigana()`/`src/domain/furigana.ts` esisterà (Epic 3, storia 3.6). Nessun rischio nuovo introdotto in questo pass.

