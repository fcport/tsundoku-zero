// Livello domain: l'IDENTITÀ di un esercizio, derivata dal CONTENUTO e non dalla
// forma (AD-1 dominio puro, AD-23). L'id è `uuidv5(natural_key, EXERCISE_NAMESPACE)`
// dove la chiave naturale è costruita da TIPO + FRASE (kanji e kana) + RISPOSTA
// CORRETTA, normalizzata NFKC. Spiegazione, distrattori e `grammarPoint` sono
// ESCLUSI: correggere un refuso, riordinare i distrattori o cambiare il punto
// grammaticale NON cambia l'identità; cambiare frase, risposta o tipo la cambia.
//
// domain→domain: importa `Exercise` da `./exercise` e `uuidv5`/`URL_NAMESPACE`
// da `./uuid` (arco ammesso dalla matrice AD-1). `String.prototype.normalize` è
// una funzione PURA del linguaggio (precedente in `lesson.ts`), non un global.
import type { Exercise } from './exercise';
import { uuidv5, URL_NAMESPACE } from './uuid';

/**
 * Namespace dell'esercizio: UUID STABILE derivato DETERMINISTICAMENTE dal
 * namespace URL standard RFC 4122 e da un nome documentato (`tsundoku-zero/exercise`).
 * Non è un valore magico casuale: chiunque può ricalcolarlo. Il suo valore è
 * PINNATO da un test (`./exercise-identity.test.ts`), così una regressione
 * dell'implementazione uuidv5 — o un cambio di questo nome — romperebbe il pin
 * prima di poter riscrivere silenziosamente l'identità di ogni esercizio.
 */
export const EXERCISE_NAMESPACE = uuidv5('tsundoku-zero/exercise', URL_NAMESPACE);

/**
 * Rappresentazione INIETTIVA della risposta corretta, per tipo (AD-23):
 * - `single-select` ⇒ la stringa `answer` (l'opzione corretta);
 * - `select-span` ⇒ `[start, end]` dello span sui segmenti;
 * - `assemble` ⇒ la sequenza ORDINATA di tessere.
 * Il valore prodotto entra in un array che `JSON.stringify` serializza: strutture
 * diverse ⇒ JSON diverso ⇒ chiave diversa. Nessuna ambiguità di delimitatore.
 *
 * TOTALE: lo `switch` copre i tre `kind` della union chiusa (2.2), con guardia di
 * esaustività `never` — un quarto tipo sarebbe un errore di COMPILAZIONE.
 */
function answerRepr(exercise: Exercise): unknown {
  switch (exercise.kind) {
    case 'single-select':
      return exercise.answer;
    case 'select-span':
      return [exercise.answer.start, exercise.answer.end];
    case 'assemble':
      return exercise.answer;
    default: {
      // Registro chiuso (AD-22): un kind non gestito è errore di COMPILAZIONE.
      const _exhaustive: never = exercise;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * Costruisce la CHIAVE NATURALE di un esercizio dalla sua SOSTANZA (AD-23):
 * `[kind, sentence.kanji, sentence.kana, answerRepr]` serializzato via
 * `JSON.stringify` (che cita ed escapa le stringhe, così nessun contenuto può
 * fingere un delimitatore: una virgola nella frase non collide con la separazione
 * dei campi), poi normalizzato NFKC. Forme NFKC-equivalenti (半角↔全角) ⇒ stessa
 * chiave.
 *
 * ESCLUDE `explanation`, `distractors` e `grammarPoint`: nessuno dei tre è tra i
 * componenti enumerati da AD-23, quindi nessuno entra nell'identità.
 */
export function exerciseNaturalKey(exercise: Exercise): string {
  return JSON.stringify([
    exercise.kind,
    exercise.sentence.kanji,
    exercise.sentence.kana,
    answerRepr(exercise),
  ]).normalize('NFKC');
}

/**
 * Deriva l'IDENTIFICATORE di un esercizio: `uuidv5` della sua chiave naturale nel
 * namespace dell'esercizio (AC1, AD-23). PURO, TOTALE (guardia `never` in
 * `answerRepr`) e SINCRONO. Riceve un `Exercise` GIÀ tipato/validato (2.1/2.2):
 * non rivalida l'input — la validazione dell'input non fidato è confine di
 * 2.6/Epic 3.
 */
export function deriveExerciseId(exercise: Exercise): string {
  return uuidv5(exerciseNaturalKey(exercise), EXERCISE_NAMESPACE);
}
