---
title: 'Story 3.6 — La furigana si allinea nel dominio'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_revision: '6126f642eb51b6f01d3136866d9a6d66d144a6aa'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Le frasi degli esercizi espongono `kanji` e `kana` separati (2.1,
`japaneseSentence`) proprio perché la furigana sia **derivabile nel dominio**
(AD-21). Manca la funzione che li allinea: senza di essa la UI (3.11) dovrebbe
rianalizzare testo misto, e gli span di `select-span` (2.3, `segmentSpan`)
resterebbero senza il registro di segmenti che indicizzano. Serve la sesta legge
di dominio di Epic 3.

**Approach:** Un modulo puro `src/domain/furigana.ts` che espone
`alignFurigana(kanji, kana): FuriganaSegment[]`. Toglie il prefisso e il suffisso
di kana comuni ai due campi e applica **ruby di gruppo** al nucleo rimanente (una
sola lettura sul nucleo intero, mai spezzata per carattere — è la resa corretta
per okurigana, prefisso kana e jukujikun). `src/ui/` riceverà segmenti già
calcolati: nessuna logica di allineamento fuori da qui.

## Boundaries & Constraints

**Always:**
- `furigana.ts` vive sotto `src/domain/` → purezza `AD-1`: nessun import esterno
  (in particolare **non importa React**, AC5), nessun global vietato
  (`fetch`/storage/…), nessun `Math.random()`. Non ha input temporali.
- `alignFurigana` è pura, sincrona, **totale** e non muta l'input: stessa coppia
  `(kanji, kana)` ⇒ stesso array (`alignFurigana.length === 2`).
- `FuriganaSegment` è `{ readonly text: string; readonly ruby: string | null }`:
  ogni segmento porta sempre entrambe le chiavi; `ruby === null` significa «nessun
  ruby». La concatenazione dei `text` dei segmenti ricostruisce `kanji` (o `kana`
  nel caso senza kanji): nessun carattere si perde né si duplica.
- `alignFurigana` è l'UNICO punto di `src/` che dichiara l'allineamento della
  furigana (`AD-21`/UX-DR23): nessun altro modulo lo ricalcola.
- Kana = Hiragana (U+3040–U+309F), Katakana (U+30A0–U+30FF, `ー` incluso). Il
  prefisso/suffisso comune si stacca **solo** finché i caratteri coincidono in
  `kanji` e `kana` **e** sono kana.

**Block If:**
- Nessuna condizione bloccante attesa: gli AC e il prototipo di planning fissano
  ogni caso osservabile, incluso il limite noto del sokuon (vedi Design Notes).

**Never:**
- Nessuna analisi morfologica, dizionario, rete, DB o casualità: l'allineamento è
  puramente lessicale sui due campi già forniti.
- Nessuna logica di rendering `<ruby>`/`<rt>`/`<rp>` qui: è UI (3.11); il dominio
  produce solo i segmenti.
- Nessun romaji, nessun `lang`/`aria`: attributi di presentazione sono di 3.11.

## I/O & Edge-Case Matrix

`alignFurigana(kanji, kana)` — `kanji: string`, `kana: string`. Notazione
`testo|ruby`, `∅` = `ruby: null`.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| okurigana (suffisso kana) | `("難しい","むずかしい")` | `[難\|むずか, しい\|∅]` | nessun errore |
| verbo con okurigana | `("食べる","たべる")` | `[食\|た, べる\|∅]` | nessun errore |
| prefisso kana | `("お茶","おちゃ")` | `[お\|∅, 茶\|ちゃ]` | nessun errore |
| kanji singolo | `("駅","えき")` | `[駅\|えき]` | nessun errore |
| jukujikun (ruby di gruppo) | `("今日","きょう")`,`("大人","おとな")`,`("一人","ひとり")` | `[今日\|きょう]` ecc. (nucleo intero) | nessun errore |
| nucleo multi-kanji | `("日本語","にほんご")`,`("勉強","べんきょう")` | `[日本語\|にほんご]` ecc. | nessun errore |
| senza kanji (vuoto) | `("","そして")` | `[そして\|∅]` (un solo segmento) | nessun errore |
| kanji uguale a kana | `("ラーメン","ラーメン")` | `[ラーメン\|∅]` (un solo segmento) | nessun errore |
| limite noto: sokuon nel nucleo | `("引っ越し","ひっこし")` | `[引っ越\|ひっこ, し\|∅]` (っ resta nel nucleo) | nessun errore |
| non-mutazione | qualunque `(kanji, kana)` | gli argomenti restano invariati | nessun errore |
| determinismo | stessa coppia due volte | array uguali per valore | nessun errore |

</intent-contract>

## Code Map

- `src/domain/furigana.ts` -- **DA CREARE.** Espone `interface FuriganaSegment { readonly text: string; readonly ruby: string | null }` e `alignFurigana(kanji, kana): FuriganaSegment[]`, più l'helper puro `isKana(ch)`. Nessun import esterno né altro modulo di dominio.
- `_bmad-output/planning-artifacts/ux-designs/ux-tsundoku-zero-2026-08-19/.working/furigana-prototype.py` -- **Algoritmo di riferimento verificato** (strip prefisso/suffisso kana + group ruby sul nucleo) e batteria di casi da cui deriva la I/O Matrix. Portarlo in TS, non reinventarlo.
- `src/domain/exercise.ts:27-38,106-123` -- `japaneseSentence` (`kanji`/`kana` separati, motivati per AD-21) e `segmentSpan`/`SegmentSpan`: gli span di `select-span` indicizzano **i segmenti** che questa funzione produce. Conferma la forma «array di segmenti».
- `src/domain/due.ts:1-28` -- Pattern del modulo di dominio puro (intestazione `AD-1`, JSDoc, purezza) da rispecchiare (qui senza `now`).
- `src/domain/due-purity.test.ts:1-65` -- Pattern della sonda di purezza (`stripComments` + regex sui costrutti vietati + anti-vacuità + `fn.length`) da replicare per `furigana-purity.test.ts`; aggiungere il controllo «non importa React».
- `src/domain/due-sole-authority.test.ts:1-129` / `src/domain/streak-sole-authority.test.ts` -- Pattern della sonda di **sola autorità** su tutto `src/` (`collectTsFiles`, esclusione `.test.ts` e del sorgente-autorità, anti-vacuità del rilevatore) da replicare: rilevatore di dichiarazione `\b(?:function|const)\s+alignFurigana\b`.
- `src/domain/streak.test.ts` -- Pattern della I/O Matrix con anti-vacuità, non-mutazione (snapshot) e determinismo da replicare per `furigana.test.ts`.
- `eslint.config.js` -- `boundaries` (`domain`) + `no-restricted-globals`: il nuovo file deve passare `npm run lint`.
- `src/boundaries.test.ts` -- Linta tutto `src/**` a 0 errori: il nuovo file deve passare.
- `vitest.config.ts:7` -- Ambiente `node`: la funzione si prova senza React né DOM.
- `tsconfig.json:19-22` -- `strict`, `noUnusedParameters`, `noUnusedLocals` (nessun `noUncheckedIndexedAccess`).
- Continuità 3.1–3.5: legge di dominio pura prima dei consumatori; famiglia di sonde purezza+sola-autorità; nessuna dipendenza da UI/rete.

## Tasks & Acceptance

**Execution:**
- `src/domain/furigana.ts` -- Creare il modulo puro. `FuriganaSegment` come sopra. `alignFurigana(kanji, kana)`: se `!kanji || kanji === kana`, ritorna `[{ text: kana, ruby: null }]`. Altrimenti calcola `p` = lunghezza del prefisso comune (caratteri uguali in entrambi **e** kana) e `s` = lunghezza del suffisso comune (stessa condizione, dai due estremi, senza sconfinare oltre il prefisso); `prefix = kanji[0..p)`, `core = kanji[p..len-s)`, `suffix = kanji[len-s..)`, `reading = kana[p..len-s)`. Emetti i segmenti nell'ordine `prefix` (se non vuoto, `ruby:null`), `core` (se non vuoto, `ruby: reading || null`), `suffix` (se non vuoto, `ruby:null`). Helper `isKana(ch)` sui range Hiragana/Katakana. Nessun costrutto di rete/non deterministico.
- `src/domain/furigana.test.ts` -- Coprire l'intera I/O Matrix (okurigana, verbo, prefisso kana, kanji singolo, i tre jukujikun, nucleo multi-kanji, senza kanji, kanji==kana, limite sokuon, non-mutazione, determinismo). Anti-vacuità: casi con ruby presente **e** casi senza alcun ruby; asserire che la concatenazione dei `text` ricostruisce l'input.
- `src/domain/furigana-purity.test.ts` -- Sonda meccanica sul sorgente (modellata su `due-purity.test.ts`): assenza di `fetch(`/`Math.random`/import da `react`; anti-vacuità (file trovato, non vuoto, contiene `export function alignFurigana`); `alignFurigana.length === 2`.
- `src/domain/furigana-sole-authority.test.ts` -- Sonda su tutto `src/` (esclusi `.test.ts` e `furigana.ts`): nessun altro modulo **dichiara** `alignFurigana` (rilevatore `\b(?:function|const)\s+alignFurigana\b`, che deve corrispondere a `furigana.ts` per anti-vacuità; le future chiamate sono call, non dichiarazioni). Guardia prospettica di `AD-21`/UX-DR23 «nessuna logica di allineamento fuori dal dominio».

**Acceptance Criteria:**
- Given `alignFurigana("難しい","むずかしい")`, when la si invoca, then restituisce `難` con ruby `むずか` seguito da `しい` senza ruby (okurigana staccato).
- Given `alignFurigana("お茶","おちゃ")`, when la si invoca, then restituisce `お` senza ruby seguito da `茶` con ruby `ちゃ` (prefisso kana staccato).
- Given una lettura non separabile per carattere — `("今日","きょう")`, `("大人","おとな")`, `("一人","ひとり")` — when la si invoca, then restituisce il nucleo intero con **ruby di gruppo**, unico segmento con ruby.
- Given un segmento senza kanji (`kanji === ""`) o con `kanji === kana`, when la si invoca, then restituisce un **solo** segmento `{ text: kana, ruby: null }`.
- Given il modulo, when viene ispezionato, then è puro, **non importa React**, `alignFurigana.length === 2`, e i casi sopra sono coperti da test unitari verdi.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 0, low 2)
- defer: 0
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[low]` `[patch]` Il blocco «totalità e ricostruzione» di `furigana.test.ts` verificava solo che la concatenazione dei `text` ricostruisse `kanji`, non che il lato **ruby** coprisse senza perdite `kana`: un bug nei limiti di `kana.slice(...)` (reading) sarebbe passato. Aggiunto un `it` sull'invariante `alignFurigana(kanji, kana).map((s) => s.ruby ?? s.text).join('') === kana`.
  - `[low]` `[patch]` Il commento «LIMITE NOTO» di `furigana.ts` nominava solo il sokuon. Con contenuto a livello di frase (fixture di `content-validation`: 本を読む/ほんをよむ) **qualsiasi** kana interno non di bordo — sokuon **e** particelle fra i kanji — resta nel nucleo con ruby di gruppo: è il limite lessicale accettato da AD-21 (nessuna analisi morfologica). Commento generalizzato (esempio を aggiunto); logica e firma invariate.

_Note di triage:_ quattro layer in parallelo (blind-hunter, edge-case-hunter,
verification-gap, intent-alignment). **Verification-gap**: nessun gap — ogni AC è
fissato da asserzioni `toEqual`/arità che eseguono la funzione reale nel percorso
normale di `npm run test`; purezza/no-React sono imposte strutturalmente da
`boundaries/external` e `no-restricted-globals` (verdi in `npm run lint`).
**Intent-alignment**: il diff implementa l'intento sulla stessa superficie che
l'intento indica (il valore di ritorno della funzione), generalizzato oltre gli
esempi letterali; le uniche divergenze sono correttamente in-scope (la sonda di
sola autorità è prospettica sul lato *dichiarazione* perché non esiste ancora un
consumatore UI). Nessun intent_gap, nessun bad_spec. **Rifiutati** (13, tutti
low): coppie surrogate/non-BMP, kana a mezza larghezza, `・` (U+30FB) al bordo,
cifre/punteggiatura in frase, e il caso `kana` vuoto (input non valido per
`japaneseSentence`) — validazione dell'input non fidato per contratto `AD-1` a
carico del data layer (3.7–3.10), stesso rifiuto già stabilito in 3.1/3.3/3.4/3.5,
oppure limite lessicale accettato da AD-21 (nessuna analisi morfologica); sonda di
sola autorità cieca a forme di dichiarazione alternative (`let`/`export {}`/metodi)
e sonda di purezza che non enumera ogni global (limiti noti delle sonde lessicali,
ridondanti con l'imposizione eslint, coerenti con la famiglia due/streak);
duplicazione di `stripComments` (convenzione deliberata: sonde indipendenti);
`alignFurigana.length === 2` come arità debole (convenzione della famiglia, come
`streak.length===3`); doc-drift presunto su «no platform globals» (il commento
attribuisce già la copertura storage a eslint). Nessun defer.

## Design Notes

**Il cuore è l'allineamento lessicale; il punto è che vive nel dominio.** Come le
leggi 3.1–3.5, la funzione è poche righe: il valore è che l'allineamento ha **un
solo** posto che lo produce (AD-21), così la UI (3.11) e gli span di `select-span`
(2.3) consumano segmenti coerenti invece di rianalizzare testo misto.

Algoritmo (portato dal prototipo di planning, già verificato sui casi della Matrix):

```ts
export interface FuriganaSegment { readonly text: string; readonly ruby: string | null }

const isKana = (ch: string): boolean => {
  const o = ch.codePointAt(0) ?? 0;
  return (o >= 0x3040 && o <= 0x309f) || (o >= 0x30a0 && o <= 0x30ff);
};

export function alignFurigana(kanji: string, kana: string): FuriganaSegment[] {
  if (!kanji || kanji === kana) return [{ text: kana, ruby: null }];
  let p = 0;
  while (p < kanji.length && p < kana.length && kanji[p] === kana[p] && isKana(kanji[p]!)) p++;
  let s = 0;
  while (
    s < kanji.length - p && s < kana.length - p &&
    kanji[kanji.length - 1 - s] === kana[kana.length - 1 - s] && isKana(kanji[kanji.length - 1 - s]!)
  ) s++;
  const prefix = kanji.slice(0, p);
  const core = kanji.slice(p, kanji.length - s);
  const suffix = s ? kanji.slice(kanji.length - s) : '';
  const reading = kana.slice(p, kana.length - s);
  const out: FuriganaSegment[] = [];
  if (prefix) out.push({ text: prefix, ruby: null });
  if (core) out.push({ text: core, ruby: reading || null });
  if (suffix) out.push({ text: suffix, ruby: null });
  return out;
}
```

**Perché ruby di gruppo e non per-carattere.** Per jukujikun (今日=きょう) e per
nuclei multi-kanji (日本語=にほんご) non esiste una mappa carattere→kana corretta:
una sola lettura sul nucleo intero è la resa giusta. Il prototipo lo ottiene
staccando solo i kana comuni ai bordi e trattando tutto il resto come un blocco.

**`ruby: string | null` e non `ruby?: string`.** Ogni segmento porta sempre la
chiave: il consumatore (3.11) fa `seg.ruby ? <ruby>… : seg.text` in modo uniforme,
senza distinguere «assente» da «vuoto». Totalità coerente con lo stile del dominio.

**Limite noto accettato (sokuon interno).** `引っ越し`→`ひっこし` dà
`[引っ越|ひっこ, し|∅]`: lo っ interno finisce nel nucleo perché non è un kana di
bordo comune. È lo stesso limite dichiarato in AD-21 e nel prototipo; è nella
Matrix come comportamento **atteso**, non come difetto.

**Perché la funzione ora e la UI no.** Come 3.3/3.4/3.5, si fissa la legge di
dominio prima dei consumatori (rendering 3.11) perché nascano dai segmenti di
questa funzione, non da logica di allineamento sparsa nella UI (UX-DR23).

## Verification

**Commands:**
- `npm run test -- src/domain/furigana` -- expected: `furigana.test.ts`, `furigana-purity.test.ts`, `furigana-sole-authority.test.ts` tutti verdi.
- `npm run test` -- expected: suite completa verde, 0 regressioni (la sonda di sola autorità non trova altri offender).
- `npm run typecheck` -- expected: nessun errore (`strict`, `noUnusedParameters`).
- `npm run lint` -- expected: nessuna violazione (`boundaries` `domain`; `no-restricted-globals`).

## Auto Run Result

Status: done
Follow-up review recommended: false (patch: high 0, medium 0, low 2 → score 3×0 + 1×2 = 2 < 5, nessun high)

**Change implementato:** creata la **sesta legge di dominio di Epic 3** (`AD-21`) —
**la furigana si allinea nel dominio, non nella UI**. `alignFurigana(kanji, kana):
FuriganaSegment[]` in `src/domain/furigana.ts` è l'UNICO punto di `src/` che
dichiara l'allineamento: puro, sincrono, totale, non-mutante, senza import esterni
(in particolare **non importa React**, AC5), senza global vietati e senza input
temporali (`alignFurigana.length === 2`). L'algoritmo è **lessicale** (portato dal
prototipo di planning già verificato): stacca il prefisso e il suffisso di kana
comuni ai due campi e applica **ruby di gruppo** al nucleo rimanente — una sola
lettura sul nucleo intero, mai spezzata per carattere, che è la resa corretta per
okurigana (難しい), prefisso kana (お茶) e jukujikun/nuclei multi-kanji (今日, 大人,
一人, 日本語). Se `kanji` è vuoto o coincide con `kana`, un solo segmento senza ruby
(AC4). `FuriganaSegment` è `{ readonly text: string; readonly ruby: string | null }`:
ogni segmento porta sempre entrambe le chiavi (`ruby === null` = «nessun ruby»), la
concatenazione dei `text` ricostruisce l'input e quella delle letture ricostruisce
`kana`. Il rendering `<ruby>`/`<rt>`, il romaji e gli attributi `lang`/`aria`
restano fuori ambito (UI, storia 3.11); gli span di `select-span` (2.3) indicizzano
i segmenti prodotti qui.

**File cambiati:**
- `src/domain/furigana.ts` -- nuovo: `interface FuriganaSegment`, helper puro `isKana` (range Hiragana/Katakana) e `alignFurigana(kanji, kana)` con strip prefisso/suffisso + ruby di gruppo sul nucleo. Nessun import esterno/global/costrutto non deterministico. Limite lessicale accettato (AD-21) documentato: qualsiasi kana interno non di bordo (sokuon **e** particelle) resta nel nucleo.
- `src/domain/furigana.test.ts` -- nuovo: 18 test, intera I/O Matrix (okurigana, verbo, prefisso kana, kanji singolo, tre jukujikun, nucleo multi-kanji, senza kanji, kanji==kana, limite sokuon), più totalità/ricostruzione (concat dei `text` ⇒ input **e**, dopo la patch, concat delle letture ⇒ `kana`), nessun segmento vuoto, anti-vacuità (verde con e senza ruby), non-mutazione, determinismo, copertura di `isKana`.
- `src/domain/furigana-purity.test.ts` -- nuovo: 5 test, sonda meccanica sul sorgente (assenza di `fetch`/`Math.random`/import da `react`), anti-vacuità, `alignFurigana.length === 2`.
- `src/domain/furigana-sole-authority.test.ts` -- nuovo: 3 test, sonda su tutto `src/` (nessun altro modulo dichiara `alignFurigana`; rilevatore `\b(?:function|const)\s+alignFurigana\b`) con anti-vacuità; guardia prospettica di AD-21/UX-DR23.

**Review findings:** 2 patch (low), 0 deferred, 13 rejected, 0 intent_gap, 0 bad_spec.
Quattro layer in parallelo (blind-hunter, edge-case-hunter, verification-gap,
intent-alignment); dettaglio nel Review Triage Log. Le due patch — test di
ricostruzione esteso al lato ruby (copre `kana`), commento del limite noto
generalizzato a ogni kana interno — applicate ri-ingaggiando il subagent di
implementazione con contesto intatto.

**Verifica eseguita (dopo le patch):**
- `npx vitest run src/domain/furigana` → 26/26 verdi (3 file, `furigana.test.ts` a 18 test).
- `npm run test` (suite completa) → 546/546 verdi, 58 file, 0 regressioni.
- `npm run typecheck` → nessun errore (`strict`, `noUnusedParameters`).
- `npm run lint` → nessuna violazione (`boundaries` `domain`; `no-restricted-globals`).
- Matrix Test Audit: tutte le righe della I/O Matrix coperte da test eseguiti e verdi in `furigana.test.ts`.

**Rischi residui:** nessuno per l'ambito di questa storia. La validazione degli
input (kanji/kana ben formati, esclusione di coppie surrogate/kana a mezza
larghezza) resta per contratto `AD-1` responsabilità del data layer (3.7–3.10),
coerentemente con `schedule()`/`isDue()`/`streak()`. Il limite lessicale (kana
interno non di bordo nel nucleo con ruby di gruppo) è accettato da AD-21: una resa
morfologica per-carattere è esplicitamente fuori ambito. I consumatori (rendering
3.11, span `select-span` 2.3) leggeranno i segmenti da questa funzione, senza logica
di allineamento sparsa nella UI.
