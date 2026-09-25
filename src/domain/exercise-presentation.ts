// Livello domain: l'ORDINE delle opzioni di risposta è DOMINIO, non UI (AC2, AD-1
// dominio puro). Se ogni schermata permutasse le opzioni per conto proprio, due
// superfici mostrerebbero ordini diversi e i test perderebbero stabilità: come
// `session.ts` (la coda) e `alignFurigana` (i segmenti), la scelta vive qui e la
// UI RENDE ciò che riceve.
//
// Il numero di opzioni DERIVA dal tipo, mai fisso: `single-select` ⇒
// `1 + |distractors|`; `assemble` ⇒ `|answer|` (le tessere); `select-span` ⇒
// `|segmenti|` di `alignFurigana`. La permutazione di single-select/assemble è
// SEMINATA da `deriveExerciseId` (AD-23): STABILE per esercizio ma non «risposta
// prima» — per `assemble` questo evita di regalare la sequenza corretta. Per
// `select-span` l'ordine NATURALE dei segmenti è già deterministico, quindi non si
// permuta.
//
// Puro come `./session` e `./furigana`: nessun import esterno, nessun global di
// piattaforma, nessun `Math.random()`. Usa l'UNICO hash condiviso (`./hash`, la
// stessa `fnv1a` della dispersione delle scadenze) e l'identità di dominio
// (`./exercise-identity`), così l'ordine non può nascere divergente.
import type { Exercise, ExerciseResponse } from './exercise';
import { deriveExerciseId } from './exercise-identity';
import { alignFurigana } from './furigana';
import { fnv1a } from './hash';

/**
 * Permuta `options` in modo DETERMINISTICO seminando l'hash con l'identità
 * dell'esercizio: chiave di ordinamento `fnv1a(\`${id}:${opt}\`)`, TIE-BREAK
 * lessicografico sull'opzione stessa (stabile: due opzioni con lo stesso hash
 * restano in ordine lessicografico riproducibile). Non muta l'input (copia prima
 * di ordinare). STABILE per esercizio: due chiamate ⇒ stessa sequenza; esercizi
 * diversi ⇒ `id` diverso ⇒ in genere ordine diverso.
 */
function orderByHash(options: readonly string[], exercise: Exercise): readonly string[] {
  const id = deriveExerciseId(exercise);
  return [...options].sort((a, b) => {
    const ha = fnv1a(`${id}:${a}`);
    const hb = fnv1a(`${id}:${b}`);
    if (ha !== hb) return ha - hb;
    // Tie-break lessicografico: due opzioni con hash uguale hanno un ordine
    // riproducibile invece di dipendere dalla stabilità del sort del motore.
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * Le OPZIONI di risposta di un esercizio, nell'ordine da RENDERE (AC2). PURA,
 * sincrona, TOTALE (switch chiuso con guardia `never`) e senza mutazione — stesso
 * `exercise` ⇒ stessa sequenza, sempre.
 *
 * - `single-select`: `[answer, ...distractors]` PERMUTATO per `orderByHash`. Il
 *   conteggio è `1 + |distractors|` (mai fisso).
 * - `assemble`: le tessere (`answer`) PERMUTATE per `orderByHash` — MAI in ordine
 *   di risposta, così la sequenza corretta non è regalata. Conteggio `|answer|`.
 * - `select-span`: i `text` dei segmenti di `alignFurigana(kanji, kana)` in ordine
 *   NATURALE (già deterministico, nessuna permutazione). Conteggio `|segmenti|`.
 */
export function answerOptions(exercise: Exercise): readonly string[] {
  switch (exercise.kind) {
    case 'single-select':
      return orderByHash([exercise.answer, ...exercise.distractors], exercise);
    case 'assemble':
      return orderByHash(exercise.answer, exercise);
    case 'select-span':
      return alignFurigana(exercise.sentence.kanji, exercise.sentence.kana).map(
        (segment) => segment.text,
      );
    default: {
      // Registro chiuso (AD-22): un kind non gestito è errore di COMPILAZIONE.
      const _exhaustive: never = exercise;
      void _exhaustive;
      return [];
    }
  }
}

/**
 * L'immagine SPECULARE di `answerOptions` (3.19): raccolti i tocchi dell'utente
 * come INDICI nelle `answerOptions(exercise)`, li traduce nella `ExerciseResponse`
 * che `check()` sa valutare. PURA, sincrona, TOTALE (switch chiuso con guardia
 * `never`) e senza mutazione — `selected` vuoto o incompleto NON lancia (produce
 * una risposta parziale). La UI raccoglie posizioni, il dominio compone il
 * significato: l'ordine e il numero delle opzioni vivono già qui (`answerOptions`),
 * così la risposta non può nascere divergente dalle opzioni rese.
 *
 * - `single-select`: `{ kind, choice: options[selected[0]] }` — l'opzione toccata.
 * - `assemble`: `{ kind, order: selected.map((i) => options[i]) }` — le tessere
 *   NELL'ORDINE dei tocchi (append-only fino al completamento, nessun undo).
 * - `select-span`: `{ kind, span: { start: selected[0], end: selected[0] + 1 } }` —
 *   l'INDICE di opzione È l'indice di segmento (ordine naturale, mono-segmento).
 */
export function composeResponse(
  exercise: Exercise,
  selected: readonly number[],
): ExerciseResponse {
  const options = answerOptions(exercise);
  switch (exercise.kind) {
    case 'single-select':
      return { kind: 'single-select', choice: options[selected[0]] };
    case 'assemble':
      return { kind: 'assemble', order: selected.map((i) => options[i]) };
    case 'select-span': {
      const start = selected[0];
      return { kind: 'select-span', span: { start, end: start + 1 } };
    }
    default: {
      // Registro chiuso (AD-22): un kind non gestito è errore di COMPILAZIONE.
      const _exhaustive: never = exercise;
      void _exhaustive;
      throw new Error('exercise kind non gestito');
    }
  }
}

/**
 * Decide se i tocchi raccolti COMPLETANO la risposta per il tipo (3.19). PURA,
 * sincrona, TOTALE ed esaustiva su `kind`: la UI la interroga per sapere QUANDO
 * la risposta è pronta da valutare, senza codificare il conteggio per tipo.
 *
 * - `single-select`: completa a `length === 1` (una sola scelta).
 * - `assemble`: completa a `length === |opzioni|` (tutte le tessere piazzate).
 * - `select-span`: completa a `length === 1` (un solo segmento, mono-segmento).
 */
export function selectionComplete(
  exercise: Exercise,
  selected: readonly number[],
): boolean {
  switch (exercise.kind) {
    case 'single-select':
      return selected.length === 1;
    case 'assemble':
      return selected.length === answerOptions(exercise).length;
    case 'select-span':
      return selected.length === 1;
    default: {
      // Registro chiuso (AD-22): un kind non gestito è errore di COMPILAZIONE.
      const _exhaustive: never = exercise;
      void _exhaustive;
      return false;
    }
  }
}
