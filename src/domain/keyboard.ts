// Livello domain: il CONTRATTO TASTIERA della sessione, nella sua parte PURA e
// AGNOSTICA AL TIPO (AD-1 dominio puro, aggiornamento di AD-15). La mappa
// tasto→posizione è una decisione di dominio, esattamente come `answerOptions`
// (`exercise-presentation.ts`) decide ordine e numero delle opzioni: se ogni
// schermata la reinventasse, due superfici mostrerebbero associazioni diverse e i
// test perderebbero stabilità. Qui vive UNA sola funzione, senza ramo per tipo, così
// l'invariante di AC2 («stessa associazione numero↔posizione per single-select,
// select-span e assemble») è vero per COSTRUZIONE.
//
// Puro come `./session` e `./exercise-presentation`: nessun import, nessun global di
// piattaforma, nessun DOM. Riceve la STRINGA `e.key` (mai un `KeyboardEvent`): il
// dominio non conosce il DOM, il montaggio in `SessionScreen` estrae `e.key` e passa
// la stringa. Nessun tempo, nessuna casualità.
//
// Il contratto completo (live region unica, tab-order, focus visibile, Enter/Esc) è
// registrato in `docs/session-keyboard-contract.md` e montato in `SessionScreen`;
// questo modulo copre la SOLA regola pura (numero→posizione con overflow dichiarato).

/**
 * La FILA NUMERICA copre le posizioni da `'1'` a `'9'` (nove tasti). Le opzioni oltre
 * la nona NON sono raggiungibili da tasto numerico (comportamento DICHIARATO, AC3):
 * si raggiungono col percorso di focus (`Tab` + `Enter`/`Space`), sempre valido per
 * ogni opzione. Lo `'0'` NON è un selettore (sarebbe la posizione 10, fuori fila).
 */
export const NUMERIC_ROW_SIZE = 9;

/**
 * Traduce un tasto premuto nell'INDICE (0-based) dell'opzione da selezionare, o
 * `null` se il tasto non seleziona alcuna opzione. PURA, sincrona, TOTALE e senza
 * effetti — stessa coppia `(key, optionCount)` ⇒ stesso risultato, sempre.
 *
 * AGNOSTICA AL TIPO (AC2): riceve solo la stringa del tasto e il NUMERO di opzioni,
 * mai il tipo di esercizio; quindi `'1'`→0, `'2'`→1, … valgono IDENTICI per
 * single-select, select-span e assemble, per costruzione (nessun ramo per `kind`).
 *
 * OVERFLOW DICHIARATO (AC3): la fila copre `'1'`–`'9'` (`NUMERIC_ROW_SIZE`), cioè gli
 * indici `0`–`8`, ma SOLO se l'indice esiste davvero (`< optionCount`). Quindi:
 * - `'2'` con `optionCount=4` ⇒ `1` (posizione 2);
 * - `'4'` con `optionCount=3` ⇒ `null` (cifra senza opzione: no-op);
 * - `'9'` con `optionCount=12` ⇒ `8` (gli indici ≥9 non sono mai da tasto);
 * - `'0'`, ogni tasto non-cifra (`'a'`, `'Enter'`, …) e la stringa vuota ⇒ `null`.
 *
 * Il chiamante applica ulteriori guardie di FASE/CONTESTO (attivo solo in `consegna`,
 * tessera assemble già scelta saltata, modificatori `Ctrl`/`Meta`/`Alt` ignorati):
 * quelle dipendono da stato/DOM e vivono nel montaggio, non qui.
 */
export function keyboardSelectionIndex(key: string, optionCount: number): number | null {
  // Solo una singola cifra `'1'`–`'9'`: `'0'`, i tasti multi-carattere (`'Enter'`),
  // la stringa vuota e ogni non-cifra cadono fuori. `'1'` ⇒ indice 0, `'9'` ⇒ 8.
  if (key.length !== 1 || key < '1' || key > '9') return null;
  const index = key.charCodeAt(0) - '1'.charCodeAt(0);
  // Doppia soglia: dentro la fila numerica (per costruzione index ∈ [0,8], cioè
  // `< NUMERIC_ROW_SIZE`) E con un'opzione reale a quella posizione (`< optionCount`).
  if (index >= NUMERIC_ROW_SIZE || index >= optionCount) return null;
  return index;
}
