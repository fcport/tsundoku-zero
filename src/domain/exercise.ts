// Livello domain: i value object del contenuto e la forma BASE dell'esercizio
// (AD-1, dominio puro — nessun import esterno). Costruiti sul kit di schema di
// `./schema`, così tipo e validatore derivano dalla STESSA definizione (AC1).
//
// Confine di storia (2.1 vs 2.2): qui `exerciseSchema` è la forma BASE, il
// contratto comune su cui la lezione si regge. `kind` è una stringa non vuota;
// `answer` è una stringa non vuota. La storia 2.2 ridefinisce `exerciseSchema` e
// `Exercise` come union discriminata chiusa a `single-select`/`select-span`/
// `assemble` SOTTO LO STESSO NOME esportato, specializzando `answer`/`distractors`
// per tipo e aggiungendo i validatori `check()` — così `lesson.ts` non cambia.
import {
  array,
  nonEmptyString,
  object,
  optional,
  type Infer,
} from './schema';

/**
 * Una frase giapponese espone `kanji` e `kana` come stringhe SEPARATE e non
 * vuote (AC4). Tenerle distinte permette ad AD-21 di derivare i segmenti della
 * furigana allineando i due campi, invece di rianalizzare un testo misto.
 */
export const japaneseSentence = object({
  kanji: nonEmptyString(),
  kana: nonEmptyString(),
});

/** Tipo della frase giapponese, inferito dallo schema (AC1). */
export type JapaneseSentence = Infer<typeof japaneseSentence>;

/**
 * Una spiegazione bilingue: `en` OBBLIGATORIO e non vuoto, `it` FACOLTATIVO
 * (AC3). È contenuto del file di lezione, non passa da i18n. Il ripiego di
 * visualizzazione quando `it` manca (mostrare l'inglese dichiarando che la
 * traduzione non c'è) è storia 2.5.
 */
export const explanation = object({
  en: nonEmptyString(),
  it: optional(nonEmptyString()),
});

/** Tipo della spiegazione, inferito: `{ en: string; it?: string }` (AC1). */
export type Explanation = Infer<typeof explanation>;

/**
 * Forma BASE dell'esercizio (AC3): il contratto comune su cui la lezione si
 * regge in 2.1.
 * - `kind`: stringa non vuota (2.2 la stringerà ai tre letterali del registro);
 * - `sentence`: il contenuto giapponese necessario a presentarlo;
 * - `answer`: la risposta corretta (2.2 potrà specializzarla per tipo);
 * - `distractors`: opzionali (presenti quando il tipo li prevede);
 * - `explanation`: perché la risposta è quella.
 */
export const exerciseSchema = object({
  kind: nonEmptyString(),
  sentence: japaneseSentence,
  answer: nonEmptyString(),
  distractors: optional(array(nonEmptyString())),
  explanation,
});

/**
 * Tipo dell'esercizio (forma base), inferito dallo schema (AC1). 2.2 lo
 * ridefinisce come union discriminata sotto lo stesso nome.
 */
export type Exercise = Infer<typeof exerciseSchema>;
