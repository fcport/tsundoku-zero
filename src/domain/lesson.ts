// Livello domain: lo schema della lezione e la derivazione del suo identificatore
// (AD-1, dominio puro — nessun import esterno). `String.prototype.normalize('NFKC')`
// è ammesso perché è una funzione PURA del linguaggio, non un accesso a global di
// piattaforma. Costruito sul kit di `./schema` e sui value object di `./exercise`,
// così tipo e validatore derivano dalla STESSA definizione (AC1).
import {
  array,
  integer,
  nonEmptyArray,
  nonEmptyString,
  object,
  refine,
  type Infer,
  type ParseResult,
} from './schema';
import { exerciseSchema } from './exercise';
import { bilingualText } from './bilingual';

/**
 * Schema della lezione (AC2). Una lezione porta:
 * - `order`: intero ≥ 1 (numero d'ordine nel curriculum);
 * - `title`: bilingue (`en` obbligatorio, `it` facoltativo), stessa forma e
 *   stesso ripiego dichiarato della spiegazione (`./bilingual`);
 * - `grammarPoints`: almeno uno, ciascuno non vuoto (i punti che insegna);
 * - `exercises`: ZERO o più — l'array vuoto è valido (AC2). Una lezione senza
 *   esercizi resta parte del curriculum e dichiara comunque i punti grammaticali.
 *
 * FR2.4 possiede questa coppia di scelte: `exercises` è `array(exerciseSchema)`
 * — chiave OBBLIGATORIA con array possibilmente VUOTO (mai `optional`, che
 * produrrebbe `exercises?: Exercise[] | undefined` e costringerebbe i consumatori
 * di Epic 3 al `?? []`; mai `nonEmptyArray`, che vieterebbe la lezione
 * concettuale) — mentre `grammarPoints` resta `nonEmptyArray(nonEmptyString())`,
 * OBBLIGATORIO proprio nel caso senza esercizi: un esercizio porta un
 * `grammarPoint` singolo, ma una lezione senza esercizi non ne ha da cui derivare
 * i punti insegnati, quindi la loro unica sede è `lesson.grammarPoints` — ciò che
 * alimenta le statistiche di Epic 5. Nessun cambio di comportamento in 2.4: la
 * capacità c'è dal 2.1; 2.4 la ancora con la prova (vedi lesson.test.ts, FR2.4).
 */
export const lessonSchema = object({
  order: refine(integer(), (value) => value >= 1, 'ordine intero ≥ 1 richiesto'),
  // AC5 — clausola del TITOLO. Il `title` è prosa AUTORATA, ed è BILINGUE con la
  // stessa forma e lo stesso ripiego dichiarato della spiegazione (`./bilingual`,
  // FR8.5): `en` obbligatorio, `it` facoltativo. La ragione è FR2.1a — ciò che
  // l'app espone dev'essere «comprensibile a chi la fonte non l'ha mai vista», e
  // un titolo nella sola lingua studiata non lo è per chi la sta imparando.
  // La sua proprietà — «deriva dal punto grammaticale, mai dalla numerazione o dal
  // titolo di una fonte esterna» — NON è imponibile dalla forma dello schema (un
  // titolo in prosa non è derivabile meccanicamente da un tag grammaticale): è
  // garantita dalla REVISIONE UMANA OBBLIGATORIA prima del commit (FR11.2, Epic 6).
  // La superficie d'identità MECCANICA è invece l'IDENTIFICATORE
  // (`deriveLessonId`/`lessonId`), che deriva dal punto grammaticale primario e
  // ignora dimostrabilmente il titolo (vedi il test «id IDENTICO per stesso
  // grammarPoints[0] con order/title diversi»). Così la scelta di AC5 è
  // documentata, non silenziosa.
  title: bilingualText,
  grammarPoints: nonEmptyArray(nonEmptyString()),
  exercises: array(exerciseSchema),
});

/** Tipo della lezione, inferito dallo schema — una sola definizione (AC1). */
export type Lesson = Infer<typeof lessonSchema>;

/**
 * Valida un input sconosciuto contro lo schema di lezione a partire dalla STESSA
 * definizione da cui deriva `Lesson` (AC1). Non lancia: restituisce `ok: true`
 * col valore tipizzato, oppure `ok: false` con la lista degli issue localizzati
 * dal `path` (AC2). Il `path` permetterà a 2.6 di riferire il campo in CI.
 */
export function parseLesson(input: unknown): ParseResult<Lesson> {
  return lessonSchema.parse(input);
}

/**
 * Deriva l'identificatore CANONICO di una lezione dal suo punto grammaticale
 * (slug): NFKC → minuscolo → i caratteri non alfanumerici diventano `-` → i
 * trattini ripetuti collassano → i trattini ai bordi si tolgono (AC5, FR2.1a).
 *
 * Dipende SOLO dal punto grammaticale: mai da `order`, `title` o da numerazione/
 * ordine di una fonte esterna. È la garanzia MECCANICA di FR2.1a — è impossibile
 * autorare l'id da un numero di episodio della fonte, perché l'id non lo
 * riproduce. `\p{L}` e `\p{N}` (con il flag `u`) trattano come alfanumerici anche
 * i caratteri giapponesi, così un punto grammaticale in kana/kanji produce uno
 * slug stabile e non collassa tutto a stringa vuota.
 *
 * È TOTALE: non restituisce MAI "". `nonEmptyString()` ammette un punto
 * grammaticale di sola PUNTEGGIATURA (es. "---", "・・・"), il cui slug sarebbe
 * vuoto — e un id vuoto è una collisione d'identità silenziosa (romperebbe
 * l'unicità di 2.6). In quel caso si ripiega su una codifica esadecimale
 * DETERMINISTICA dei code point dell'input normalizzato NFKC (prefisso `u-` per
 * non collidere mai con uno slug reale): input DIVERSI ⇒ id DIVERSI, mai un token
 * costante che li collasserebbe. Resta puro e deterministico.
 */
export function deriveLessonId(grammarPoint: string): string {
  const normalized = grammarPoint.normalize('NFKC');
  const slug = normalized
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug.length > 0) {
    return slug;
  }
  // Ripiego totale: codifica esadecimale dei code point (iniettiva sull'input
  // normalizzato), così due punti di sola punteggiatura DIVERSI restano DIVERSI.
  const encoded = Array.from(normalized, (ch) => ch.codePointAt(0)!.toString(16)).join('-');
  return `u-${encoded}`;
}

/**
 * Identificatore di una lezione: deriva dal PRIMO dei suoi `grammarPoints`, il
 * punto grammaticale primario che le dà identità (AC5). Non dipende da `order`
 * né `title`. L'unicità fra lezioni è una verifica di CONTENUTO (2.6), non di
 * forma.
 */
export function lessonId(lesson: Lesson): string {
  return deriveLessonId(lesson.grammarPoints[0]);
}
