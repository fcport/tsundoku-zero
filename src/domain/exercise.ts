// Livello domain: i value object del contenuto e il REGISTRO CHIUSO dei tipi di
// esercizio (AD-1, dominio puro — nessun import esterno, nessun `Math.random()`).
// Costruito sul kit di schema di `./schema`, così tipo e validatore derivano
// dalla STESSA definizione (AC1).
//
// `exerciseSchema` è una UNION DISCRIMINATA su `kind`, chiusa a esattamente tre
// tipi (`single-select`/`select-span`/`assemble`), ciascuno con la forma dei
// propri dati (AC1, AD-22). Vive SOTTO LO STESSO NOME esportato di 2.1, così
// `lesson.ts` continua a fare `array(exerciseSchema)` invariato. Un `kind` fuori
// dai tre è un errore di validazione dello schema, non un caso ignorato a
// runtime (AD-22).
//
// Il `kind` dice COME si risponde; ciò che l'esercizio insegna vive in
// `grammarPoint` (campo comune non vuoto), non nel `kind` (AC7).
import {
  discriminatedUnion,
  integer,
  literal,
  nonEmptyArray,
  nonEmptyString,
  object,
  optional,
  refine,
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
 * Uno span sui INDICI DEI SEGMENTI di `alignFurigana()` (Epic 3): intervallo
 * semiaperto `[start, end)`, interi ≥ 0, `end > start`. NON sono indici di
 * carattere (AC4): `alignFurigana()` non esiste qui (è Epic 3); la validazione
 * che `end` non superi il numero di segmenti reali è controllo di CONTENUTO in
 * 2.6 (richiede la segmentazione). Qui si consegna solo la forma dello span.
 */
export const segmentSpan = refine(
  object({
    start: refine(integer(), (value) => value >= 0, 'start intero ≥ 0 richiesto'),
    end: refine(integer(), (value) => value >= 0, 'end intero ≥ 0 richiesto'),
  }),
  (span) => span.end > span.start,
  'span degenere: end deve essere > start',
);

/** Tipo dello span di segmenti, inferito: `{ start: number; end: number }`. */
export type SegmentSpan = Infer<typeof segmentSpan>;

/**
 * `single-select` — una consegna, *n* opzioni, una risposta. `answer` è l'unica
 * opzione corretta (stringa non vuota); `distractors` è un array NON VUOTO di
 * opzioni sbagliate (una consegna, *n* opzioni, una risposta). `check` è
 * corretto sse `response.choice === answer`.
 */
const singleSelect = object({
  kind: literal('single-select'),
  grammarPoint: nonEmptyString(),
  sentence: japaneseSentence,
  answer: nonEmptyString(),
  distractors: nonEmptyArray(nonEmptyString()),
  explanation,
});

/**
 * `select-span` — si indica UNA PORZIONE della frase, espressa come span sugli
 * indici dei segmenti (`answer`). Nessun `distractors`. `check` è corretto sui
 * CONFINI DEI SEGMENTI (`start`/`end` combaciano), non su offset di carattere
 * (AC4).
 */
const selectSpan = object({
  kind: literal('select-span'),
  grammarPoint: nonEmptyString(),
  sentence: japaneseSentence,
  answer: segmentSpan,
  explanation,
});

/**
 * `assemble` — tessere da ordinare. `answer` è la SEQUENZA ORDINATA corretta di
 * tessere (array non vuoto di stringhe non vuote). Nessun `distractors`. `check`
 * è corretto se `response.order` coincide elemento per elemento e nell'ordine
 * (AC5).
 */
const assemble = object({
  kind: literal('assemble'),
  grammarPoint: nonEmptyString(),
  sentence: japaneseSentence,
  answer: nonEmptyArray(nonEmptyString()),
  explanation,
});

/**
 * Registro CHIUSO dei tipi di esercizio (AD-22): union discriminata su `kind`,
 * chiusa a esattamente i tre letterali. Nome invariato ⇒ `lesson.ts` compila
 * senza modifiche. Un `kind` fuori dai tre è un errore di validazione dello
 * schema, localizzato sul path del discriminante (`…kind`), non un caso ignorato
 * a runtime (AD-22).
 */
export const exerciseSchema = discriminatedUnion('kind', {
  'single-select': singleSelect,
  'select-span': selectSpan,
  assemble,
});

/**
 * Tipo dell'esercizio: la union discriminata, inferita dallo schema (AC1). Una
 * sola definizione ⇒ tipo e validatore non si disallineano. Il narrowing su
 * `exercise.kind` funziona nei consumatori.
 */
export type Exercise = Infer<typeof exerciseSchema>;

/**
 * Esito di `check`: SOLO la correttezza della risposta (`AD-22` la chiama
 * «Outcome»). NON è l'esito SRS (`again`/`hard`/`good`/`easy`): quello è
 * `outcomeOf()` di 3.2 (`AD-24`), che consuma questa correttezza PIÙ
 * `usedExplanation`/`declaredEasy` — informazioni che `check` non riceve. Perciò
 * il nome `CheckOutcome`, disambiguato dall'«esito» di 3.2.
 */
export interface CheckOutcome {
  readonly correct: boolean;
}

/**
 * La risposta a un esercizio, union discriminata su `kind` in parallelo a
 * `Exercise`. Ogni variante porta il proprio payload: `choice` per single-select,
 * `span` per select-span, `order` per assemble. `check` accetta una risposta di
 * QUALSIASI variante e, se il `kind` non combacia con l'esercizio, ritorna
 * `{ correct: false }` (totale, non lancia).
 */
export type ExerciseResponse =
  | { readonly kind: 'single-select'; readonly choice: string }
  | { readonly kind: 'select-span'; readonly span: SegmentSpan }
  | { readonly kind: 'assemble'; readonly order: readonly string[] };

/**
 * Valida una RISPOSTA contro un ESERCIZIO. È PURA e TOTALE: dispatch su
 * `exercise.kind`; se la `response` è di un `kind` diverso dall'esercizio ritorna
 * `{ correct: false }` (non lancia). Restituisce SOLO la correttezza
 * (`CheckOutcome`), mai l'esito SRS (quello è 3.2, `AD-24`).
 *
 * - `single-select`: corretto sse `response.choice === exercise.answer`.
 * - `select-span`: corretto sse lo span combacia sui CONFINI dei segmenti
 *   (`start`/`end`), non su offset di carattere (AC4).
 * - `assemble`: corretto sse `response.order` coincide con `exercise.answer`
 *   elemento per elemento e nell'ordine (AC5).
 */
export function check(exercise: Exercise, response: ExerciseResponse): CheckOutcome {
  // Risposta di kind diverso dall'esercizio: totale, non lancia (AD-22).
  if (exercise.kind !== response.kind) {
    return { correct: false };
  }
  switch (exercise.kind) {
    case 'single-select':
      // Il narrowing sul discriminante restringe anche `response` alla variante.
      return { correct: response.kind === 'single-select' && response.choice === exercise.answer };
    case 'select-span':
      return {
        correct:
          response.kind === 'select-span' &&
          response.span.start === exercise.answer.start &&
          response.span.end === exercise.answer.end,
      };
    case 'assemble':
      return {
        correct:
          response.kind === 'assemble' &&
          response.order.length === exercise.answer.length &&
          exercise.answer.every((tile, i) => tile === response.order[i]),
      };
    default: {
      // Registro chiuso (AD-22): un kind non gestito è errore di COMPILAZIONE.
      const _exhaustive: never = exercise;
      void _exhaustive;
      return { correct: false };
    }
  }
}
