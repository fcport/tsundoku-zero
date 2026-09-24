---
title: "Story 2.3: L'identità di un esercizio resiste alla riautorazione"
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: '34f33b29eac4bfe49760499dab625b57e412f4aa'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Dopo 2.1/2.2 l'esercizio ha forma e validatori, ma **nessuna identità**. Senza un identificatore derivato dal contenuto, correggere un refuso in una spiegazione o riordinare i distrattori — o riautorare la lezione da capo — genererebbe un esercizio "nuovo" e cancellerebbe il progresso dell'utente (`AD-23`, FR2.5). L'identità deve dipendere dalla **sostanza** (tipo, frase, risposta corretta), non dalla forma.

**Approach:** Aggiungere al dominio **puro** (`AD-1`) una derivazione dell'identità: `id = uuidv5(natural_key, EXERCISE_NAMESPACE)`, dove `natural_key` è costruita da **tipo + frase + risposta corretta**, normalizzata NFKC, con spiegazione e distrattori **esclusi** (`AD-23`). Poiché `AD-1` vieta ogni pacchetto npm nel dominio (`uuid` incluso) e vieta i global di piattaforma, `uuidv5` va implementato in **TypeScript puro** — SHA-1 + encoding UTF-8 scritti a mano, deterministici, come già `deriveLessonId` fa NFKC con `String.prototype.normalize` (funzione pura del linguaggio, non global). Un test verifica entrambe le direzioni (sostanza invariata ⇒ id identico; sostanza cambiata ⇒ id diverso) e la conformità a vettori uuidv5 noti.

## Boundaries & Constraints

**Always:**
- `deriveExerciseId(exercise): string` = `uuidv5(exerciseNaturalKey(exercise), EXERCISE_NAMESPACE)`, dove `exerciseNaturalKey` costruisce la chiave da **`kind` + `sentence` (kanji e kana) + risposta corretta**, e la normalizza **NFKC** (`AD-23`).
- La risposta corretta nella chiave è, per tipo: `single-select` ⇒ `answer` (stringa); `select-span` ⇒ `answer` (span `{start,end}`); `assemble` ⇒ `answer` (sequenza ordinata). La serializzazione è **iniettiva e senza ambiguità di delimitatore** (via `JSON.stringify` di un array strutturato), così valori diversi ⇒ chiavi diverse.
- La chiave **esclude** `explanation` e `distractors` (`AD-23`), e — non essendo tra i tre componenti enumerati da `AD-23` — anche `grammarPoint`. Correggere la spiegazione, riordinare i distrattori o cambiare il punto grammaticale **non** cambia l'identità.
- `uuidv5(name, namespace)` conforme a RFC 4122 v5: SHA-1 di `namespace(16 byte) ++ utf8(name)`, primi 16 byte, nibble di **versione = 5**, bit di **variante = 10xx**, formato canonico `8-4-4-4-12` minuscolo.
- `EXERCISE_NAMESPACE` è una costante UUID **stabile e derivata deterministicamente**: `uuidv5('tsundoku-zero/exercise', URL_NAMESPACE)` (namespace URL standard RFC 4122). Documentata, non un valore magico casuale; il suo valore è **pinnato** da un test.
- Tutto nel dominio (`AD-1`): i nuovi file **non importano** react/supabase/rete/orologio né alcun pacchetto npm; **nessun** `Math.random`, `fetch`, `crypto`, `TextEncoder` o altro global di piattaforma; SHA-1/UTF-8 sono puri e deterministici. `String.prototype.normalize('NFKC')` è ammesso (funzione pura del linguaggio, precedente in `lesson.ts`).
- TypeScript strict, **nessun `any`** nel codice applicativo. `deriveExerciseId` è **totale**: la union è chiusa a tre `kind` (2.2), coperta da guardia di esaustività `never`.

**Block If:**
- _Nessun blocco._ Storia interamente in-repo (dominio puro + test): nessuna azione umana né vendor. Esito atteso `done`.

**Never:**
- **Non** usare il pacchetto `uuid` né qualsiasi altra libreria (violerebbe `AD-1`); **non** usare `crypto.subtle`/`node:crypto` né `TextEncoder` (global di piattaforma, e `subtle.digest` è async: `deriveExerciseId` deve restare sincrona e pura).
- **Non** includere nella chiave naturale `explanation`, `distractors` o `grammarPoint`; **non** includere `order`/`title` della lezione (l'identità è dell'esercizio, non della sua posizione).
- **Non** validare l'input in `deriveExerciseId`: riceve un `Exercise` già tipato/validato (2.1/2.2). La validazione dell'input non fidato è confine di 2.6/Epic 3.
- **Non** toccare `src/domain/exercise.ts`, `lesson.ts`, `schema.ts` (identità è additiva, sotto nuovi file), né il gate CI su `content/lessons/` (2.6), né creare file di lezione reali (2.7), né derivare identità di *lezione* (già `lessonId` via slug, 2.1 — resta invariato).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| uuidv5 vettore noto (DNS) | name `www.example.com`, ns DNS | `2ed6657d-e927-568b-95e1-2665a8aea6a2` | n/a |
| uuidv5 vettore noto (DNS) | name `python.org`, ns DNS | `886313e1-3b8a-5372-9b90-0c9aee199e5d` | n/a |
| uuidv5 vettore noto (URL) | name `https://www.w3.org/`, ns URL | `c106a26a-21bb-5538-8bf2-57095d1976c1` | n/a |
| forma v5 canonica | coppia qualunque (name, ns) | stringa `8-4-4-4-12`, nibble versione `5`, variante `8/9/a/b` | n/a |
| determinismo | stessa coppia (name, ns) due volte | id identico | n/a |
| id = uuidv5(chiave, NS) | esercizio valido dei tre tipi | `deriveExerciseId` == `uuidv5(exerciseNaturalKey(ex), EXERCISE_NAMESPACE)`; valore pinnato | n/a |
| spiegazione corretta | stesso esercizio, `explanation` diversa (en/it) | id **identico** (AC2) | n/a |
| distrattori riordinati | `single-select`, stessi distrattori, ordine diverso | id **identico** (AC2) | n/a |
| grammarPoint diverso | stesso tipo/frase/risposta, `grammarPoint` diverso | id **identico** (escluso da `AD-23`) | n/a |
| frase modificata | `kanji` **o** `kana` diverso | id **diverso** (AC3) | n/a |
| risposta corretta modificata | `answer` diverso (choice/span/order), per ciascun tipo | id **diverso** (AC3) | n/a |
| tipo diverso | `kind` diverso, stessa frase/risposta | id **diverso** (tipo è parte della chiave) | n/a |
| NFKC equivalenza | frase in forme NFKC-equivalenti (半角↔全角) | id **identico** (chiave normalizzata NFKC) | n/a |
| lezione riautorata | array di esercizi riautorato senza modifiche sostanziali | **tutti** gli id coincidono con i precedenti (AC4) | n/a |

</intent-contract>

## Code Map

- `src/domain/uuid.ts` — **NUOVO**: `uuidv5(name: string, namespace: string): string` puro (RFC 4122 v5) più le costanti `DNS_NAMESPACE`/`URL_NAMESPACE` (namespace standard RFC 4122). Contiene, come helper interni puri: `sha1(bytes: number[]): number[]` (20 byte, operazioni a 32 bit con `| 0`/`>>>`, padding e lunghezza big-endian; hi-word via `Math.floor` per input > 2^29 byte), `utf8Bytes(s: string): number[]` (iterazione per **code point** con `for…of`, gestisce le coppie surrogate), `parseUuid(hex)→16 byte` e `formatUuid(16 byte)→stringa`. Imposta versione (`b[6]=(b[6]&0x0f)|0x50`) e variante (`b[8]=(b[8]&0x3f)|0x80`). Nessun import, nessun global.
- `src/domain/exercise-identity.ts` — **NUOVO**: `EXERCISE_NAMESPACE = uuidv5('tsundoku-zero/exercise', URL_NAMESPACE)`; `exerciseNaturalKey(exercise: Exercise): string` (serializza `[kind, sentence.kanji, sentence.kana, answerRepr]` via `JSON.stringify`, poi `.normalize('NFKC')`; `answerRepr` per tipo con `switch` + guardia `never`); `deriveExerciseId(exercise: Exercise): string = uuidv5(exerciseNaturalKey(exercise), EXERCISE_NAMESPACE)`. Importa `Exercise` da `./exercise` e `uuidv5`/`URL_NAMESPACE` da `./uuid` (domain→domain, ammesso).
- `src/domain/exercise.ts` — **RIFERIMENTO (non modificare)**: fornisce `Exercise` (union discriminata su `kind`) e la forma di `answer` per tipo (`single-select`: `answer: string`, righe 79-86; `select-span`: `answer: SegmentSpan`, 94-100; `assemble`: `answer: string[]`, 108-114). La chiusura a tre `kind` (123-134) è ciò che rende la guardia `never` valida a compile-time.
- `src/domain/lesson.ts` — **RIFERIMENTO (non modificare)**: precedente di purezza per NFKC — `deriveLessonId` usa `.normalize('NFKC')` come funzione pura del linguaggio (righe 76-90). L'identità di *lezione* resta lo slug del punto grammaticale; questa storia non la tocca.
- `src/domain/uuid.test.ts` — **NUOVO**: vettori noti (le tre righe della matrice), forma canonica v5 (versione/variante), determinismo. Prova che l'implementazione SHA-1/uuidv5 è **corretta**, non solo auto-coerente.
- `src/domain/exercise-identity.test.ts` — **NUOVO**: copre tutte le righe della matrice da «id = uuidv5(chiave, NS)» in giù, per i tre tipi; include il pin di `EXERCISE_NAMESPACE` e di un id d'esercizio concreto, e la riautorazione di un'intera lezione (AC4).
- `src/domain/exercise-purity.test.ts` — **MODIFICA (solo lista anti-vacuità)**: aggiungere `src/domain/uuid.ts` e `src/domain/exercise-identity.ts` all'elenco dei file attesi (righe 56-61), così la sonda «nessun `Math.random`» dimostra di aver visto i nuovi sorgenti. La scansione ricorsiva già li copre.
- `eslint.config.js` / `src/boundaries.test.ts` — **RIFERIMENTO**: vincoli che i nuovi file devono soddisfare — `boundaries/external` (nessun pacchetto nel dominio), `no-restricted-globals` (no fetch/storage), e la sonda «scaffold pulito ⇒ 0 errori» che linta l'albero reale.

## Tasks & Acceptance

**Execution:**
- `src/domain/uuid.ts` — implementare `uuidv5` puro (SHA-1 + UTF-8 scritti a mano) e i namespace standard; versione/variante corrette; forma canonica minuscola.
- `src/domain/exercise-identity.ts` — implementare `EXERCISE_NAMESPACE`, `exerciseNaturalKey` (NFKC; esclude spiegazione/distrattori/grammarPoint; `switch` sui tre `kind` con guardia `never`) e `deriveExerciseId`.
- `src/domain/uuid.test.ts` — vettori noti, forma v5, determinismo (tutte le righe della matrice fino a «forma v5» e «determinismo»).
- `src/domain/exercise-identity.test.ts` — id = uuidv5(chiave, NS) con valori pinnati; invarianza su spiegazione/distrattori/grammarPoint; differenza su frase/risposta/tipo per ciascun tipo; equivalenza NFKC; riautorazione di lezione (AC4).
- `src/domain/exercise-purity.test.ts` — aggiungere i due nuovi file alla guardia anti-vacuità.

**Acceptance Criteria:**
- Given un esercizio, when il suo identificatore viene calcolato, then è `uuidv5` di una chiave naturale costruita da **tipo, frase e risposta corretta**, normalizzata **NFKC** (AC1, `AD-23`).
- Given lo stesso esercizio con la **spiegazione corretta** o i **distrattori riordinati** (o il `grammarPoint` cambiato), when l'id viene ricalcolato, then è **identico**, e un test lo verifica (AC2, `AD-23`).
- Given lo stesso esercizio con la **frase** o la **risposta corretta** modificate, when l'id viene ricalcolato, then è **diverso**, e un test lo verifica — per ciascuno dei tre tipi (AC3).
- Given una **lezione riautorata da capo** senza modifiche sostanziali, when i suoi id sono confrontati coi precedenti, then **coincidono tutti** (AC4).
- Given `uuidv5`, when confrontato con **vettori RFC 4122 noti**, then coincide (nibble di versione `5`, bit di variante `10xx`, forma canonica) — l'implementazione pura è provata corretta, non solo auto-coerente.
- Given i nuovi file di dominio, when ispezionati/lintati, then non importano pacchetti né usano global di piattaforma (`fetch`/`crypto`/`TextEncoder`) né `Math.random`; `deriveExerciseId` è puro, totale (guardia `never`) e sincrono (AC su `AD-1`).
- Given `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, when girano, then passano senza regressioni e senza alcun `any`; `exercise.ts`/`lesson.ts`/`schema.ts` restano **invariati**.

## Spec Change Log

_Nessun loopback `bad_spec` in questa run: `<intent-contract>` invariato._

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 0, low 2)
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[low]` `[patch]` **ramo UTF-8 a 4 byte (coppia surrogate/astrale) senza copertura**: `utf8Bytes` gestisce i code point ≥ U+10000, ma nessun test lo esercitava (i campioni coprivano solo 1–3 byte). Aggiunto in `uuid.test.ts` un vettore pinnato `uuidv5('𠮷' U+20BB7, URL_NAMESPACE)` = `cb538b39-a61d-5315-9081-2f53bb9a8e23`, ricalcolato contro il `crypto` di Node ⇒ il ramo a 4 byte è ora ancorato a ground truth esterno.
  - `[low]` `[patch]` **superficie API troppo larga in `uuid.ts`**: `utf8Bytes`/`sha1`/`parseUuid`/`formatUuid` erano `export` ma consumati solo dentro il modulo, ed esportarli invitava il rilievo «utility pubblica accetta input non validato». Resi module-private (come `rotl`); esportati solo `uuidv5`/`DNS_NAMESPACE`/`URL_NAMESPACE`. Nessun test importava gli helper ⇒ nulla si è rotto.

Findings rifiutati (rappresentativi): «`parseUuid`/`uuidv5` non validano l'input (NaN/lunghezza)» — l'unico chiamante passa le due costanti namespace canoniche, e il patch 2 (un-export) rimuove il contratto pubblico che sollevava il rilievo; «il commento sovradichiara che `crypto`/`TextEncoder` sono imposti in CI» — il commento li inquadra come *filosofia* del dominio (solo i pacchetti npm sono «retti da boundaries/external»), quindi è già accurato; «sonda `Math.random` aggirabile / non copre `Date.now`» — limite pre-esistente della sonda di 2.2, già adjudicato lì (l'AC nomina solo `Math.random`); «`ch.codePointAt(0)!` (non-null assertion)» — provabilmente sicura e già usata in `lesson.ts`; «`answerRepr` ritorna `unknown` invece di una union precisa» — accettabile, la guardia `never` impone l'esaustività; «serve un test di collisione span-vs-assemble» — `kind` è il primo elemento della chiave ⇒ collisione impossibile, coperta dal test di cambio-tipo e dai pin; «i pin sono auto-referenziali» — refutato: i vettori RFC noti + il ricalcolo indipendente con Node crypto li ancorano a ground truth; «test con digest artefatto per version/variant» — i tre vettori RFC esercitano digest reali; «fixture degenere/vuota per `deriveExerciseId`» — lo schema vieta stringhe vuote, input non fidato è fuori scopo (2.6/Epic 3); «SHA-1 oltre 2^29 byte» — irraggiungibile, nessun consumatore; «surrogate spaiato in `utf8Bytes`» — fuori scopo (input già validato e ben formato), determinismo comunque preservato; «self-check NFKC quasi-vacuo» — proprietà vera (idempotenza), il comportamento NFKC è provato dal test 半角↔全角; «`select-span` AC3 cambia start ed end insieme» — coperto dal pin della tupla esatta. Nessun `defer`: nessun problema pre-esistente reale è emerso.

## Design Notes

**Perché SHA-1 puro e non `crypto`/`uuid`.** `AD-1` vieta al dominio ogni import di pacchetto (retto in CI da `boundaries/external`) e la sua filosofia esclude i global di piattaforma (il commento di `lesson.ts` distingue `String.normalize`, *funzione del linguaggio*, da un accesso a global). `crypto.subtle.digest` è per giunta **async** — renderebbe `deriveExerciseId` una `Promise`, contaminando ogni consumatore. Quindi SHA-1 (deterministico, senza stato, senza I/O) e l'encoding UTF-8 si scrivono a mano: ~60 righe, pure, verificate contro vettori noti. È esattamente ciò che il pacchetto `uuid` fa internamente nel suo fallback JS.

**Chiave naturale iniettiva.** `natural_key = JSON.stringify([kind, kanji, kana, answerRepr]).normalize('NFKC')`. `JSON.stringify` cita ed escapa le stringhe, così nessun contenuto può fingere un delimitatore (una virgola nella frase non collide con la separazione dei campi): valori diversi ⇒ chiavi diverse. `answerRepr` è la stringa per `single-select`, `[start,end]` per `select-span`, l'array di tessere per `assemble` — la forma della *risposta corretta* di ciascun tipo (2.2). Esempio:

```ts
// stesso tipo/frase/risposta, spiegazione o distrattori diversi ⇒ chiave IDENTICA ⇒ id IDENTICO
// frase o risposta diverse ⇒ chiave DIVERSA ⇒ id DIVERSO
export const EXERCISE_NAMESPACE = uuidv5('tsundoku-zero/exercise', URL_NAMESPACE);
export const deriveExerciseId = (ex: Exercise): string =>
  uuidv5(exerciseNaturalKey(ex), EXERCISE_NAMESPACE);
```

**`grammarPoint` fuori dalla chiave.** `AD-23` enumera **tre** componenti (tipo, frase, risposta corretta) ed esclude esplicitamente spiegazione e distrattori. `grammarPoint` non è tra i tre: non entra nell'identità. Cambiare quale punto grammaticale un esercizio esercita, a parità di frase e risposta, **non** ne cambia l'identità — coerente con l'enumerazione di `AD-23` e con la statistica per `grammar_point` che vive nel `review_log` denormalizzato (`AD-18`), non nell'id.

## Verification

**Commands:**
- `npm run typecheck` — expected: `tsc` strict, nessun `any`; `deriveExerciseId` sincrona; la guardia `never` compila (union chiusa a tre `kind`).
- `npm run lint` — expected: 0 errori; i nuovi file di dominio non violano `boundaries/external` né `no-restricted-globals`; la sonda «scaffold pulito» resta verde.
- `npm test` — expected: `uuid.test.ts` (vettori noti + forma + determinismo), `exercise-identity.test.ts` (tutte le righe della matrice, AC2/AC3/AC4, NFKC), `exercise-purity.test.ts` (nessun `Math.random`, vede i nuovi file), più le sonde 1.1–2.2 senza regressioni.
- `npm run build` — expected: `tsc --noEmit` + `vite build` producono `dist/` senza errori.

## Auto Run Result

Status: done

**Sommario.** L'esercizio ha ora un'**identità derivata dal contenuto** che resiste alla riautorazione (`AD-23`, FR2.5). `deriveExerciseId(exercise)` è `uuidv5(exerciseNaturalKey(exercise), EXERCISE_NAMESPACE)`, dove la chiave naturale è costruita da **tipo + frase (kanji e kana) + risposta corretta**, normalizzata **NFKC**, con **spiegazione, distrattori e `grammarPoint` esclusi**. Correggere un refuso in una spiegazione, riordinare (o cambiare) i distrattori o rivedere il punto grammaticale **non** cambia l'id (AC2); cambiare frase, risposta corretta o tipo lo cambia (AC3); una lezione riautorata da capo senza modifiche sostanziali ritrova **tutti** gli id precedenti (AC4). Poiché `AD-1` vieta al dominio ogni pacchetto npm (`uuid` incluso) e i global di piattaforma, `uuidv5` è implementato in **TypeScript puro** (SHA-1 + encoding UTF-8 scritti a mano, sincroni, deterministici), verificato contro **vettori RFC 4122 noti** e ricalcolato in modo indipendente col `crypto` di Node. Confini di storia rispettati: nessuna validazione dell'input non fidato (2.6/Epic 3), nessun gate CI su `content/lessons/` (2.6), nessun file di lezione reale (2.7); `exercise.ts`/`lesson.ts`/`schema.ts` invariati.

**File creati/modificati (uno per riga):**
- `src/domain/uuid.ts` — **nuovo**: `uuidv5(name, namespace)` puro (RFC 4122 v5) più le costanti `DNS_NAMESPACE`/`URL_NAMESPACE`; helper interni (module-private) `utf8Bytes`/`sha1`/`rotl`/`parseUuid`/`formatUuid`. Nibble di versione `5` e bit di variante `10xx`, forma canonica minuscola. Nessun import, nessun global di piattaforma.
- `src/domain/exercise-identity.ts` — **nuovo**: `EXERCISE_NAMESPACE = uuidv5('tsundoku-zero/exercise', URL_NAMESPACE)` = `19500004-85db-54f1-8bf3-7eb20002077b`; `exerciseNaturalKey` (serializza `[kind, sentence.kanji, sentence.kana, answerRepr]` via `JSON.stringify`, poi NFKC; `answerRepr` con `switch` sui tre `kind` e guardia `never`); `deriveExerciseId`.
- `src/domain/uuid.test.ts` — **nuovo**: vettori RFC noti (DNS www.example.com, DNS python.org, URL w3.org) + vettore astrale a 4 byte (U+20BB7), forma canonica v5, determinismo.
- `src/domain/exercise-identity.test.ts` — **nuovo**: pin di `EXERCISE_NAMESPACE` e degli id per i tre tipi, NFKC, invarianza (spiegazione/distrattori/grammarPoint), differenza (kanji/kana/risposta/tipo per ciascun tipo), equivalenza 半角↔全角, riautorazione dell'intera lezione (AC4).
- `src/domain/exercise-purity.test.ts` — **modifica**: aggiunti i due nuovi sorgenti alla guardia anti-vacuità della sonda «nessun `Math.random`».

**Findings di review:** 2 patch applicati (entrambi low: vettore astrale a 4 byte, un-export degli helper), 0 intent_gap, 0 bad_spec, 0 deferiti, 14 rifiutati (vedi Review Triage Log).

**Follow-up review recommendation: false.** Patch di questa passata: high 0, medium 0, low 2. Punteggio `3×0 + 1×2 = 2 < 5` e nessun high ⇒ `false`.

**Verifica eseguita (tutta verde, rieseguita dopo i patch):** `npm run typecheck` (`tsc` strict, nessun `any`; `deriveExerciseId` sincrona; guardia `never` compila), `npm run lint` (0 errori; i nuovi file non violano `boundaries/external` né `no-restricted-globals`; la sonda «scaffold pulito» resta verde), `npm test` (**347 test su 37 file**, +1 per il vettore astrale), `npm run build` (`dist/` prodotto). Matrix Test Audit: tutte le righe della I/O Matrix coperte da test eseguiti e passati; la correttezza di `uuidv5` è ancorata ai vettori RFC 4122 e ricalcolata contro Node crypto.

**Rischi residui.** Nessuno di rilievo per lo scopo di 2.3. `deriveExerciseId` non è ancora cablato in un consumatore (lo consuma Epic 3) e l'unicità degli id sui file di lezione reali è controllo di CI di **2.6**: la promessa utente («la riautorazione non cancella i progressi») è dimostrata alla superficie della funzione pura, con consumo e unicità deferiti come da confini della storia. L'avviso di build «chunks > 500 kB» è preesistente e non correlato.
