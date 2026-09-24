// Livello domain: il CANCELLO di validazione del contenuto (FR2.6, AD-25). PURO
// e TOTALE (AD-1, dominio puro — nessun import esterno, nessun global vietato).
// `validateLessons()` riceve i file di lezione GIÀ letti come testo (l'I/O — glob
// + read + exit — vive nello script `scripts/validate-content.ts`, fuori dal
// dominio) e ritorna la lista degli issue: `[]` SE E SOLO SE ogni file conforma.
//
// La validazione dello schema NON è reimplementata qui: la fonte UNICA è
// `parseLesson` di 2.1/2.2 (che sussume «kind fra i tre del registro» via la
// union discriminata e «spiegazione inglese presente» via `explanation.en` non
// vuoto). 2.6 aggiunge SOLO i controlli che stanno OLTRE lo schema:
//   (b) coerenza kanji/kana: il campo `kana` di ogni frase non contiene un
//       ideogramma Han (una lettura con un kanji dentro non è una lettura);
//   (c) unicità cross-file di `lessonId` e `deriveExerciseId` (AD-23).
//
// `JSON.parse` è un builtin PURO del linguaggio (come `String.prototype.normalize`
// in `lesson.ts`): usato in `try/catch`, non è né I/O né un global vietato.
import { parseLesson, lessonId, type Lesson } from './lesson';
import { deriveExerciseId } from './exercise-identity';

/**
 * Un file di lezione da validare: il suo `path` (per localizzare l'issue in CI) e
 * il suo `source` (il testo grezzo del file, ancora da parsare). `validateLessons`
 * riceve un elenco di questi — mai i file dal disco: la scoperta e la lettura sono
 * dello script CLI (AD-1, l'unica impurità sta fuori dal dominio).
 */
export interface LessonFile {
  readonly path: string;
  readonly source: string;
}

/**
 * Un errore di validazione del contenuto, localizzato: `file` (quale file di
 * lezione), `path` (la sequenza di chiavi/indici che porta al campo malformato,
 * come in `SchemaIssue` di `./schema`) e `message` (la descrizione). È
 * `SchemaIssue` mappato con l'aggiunta di `file`, così un revisore in CI vede
 * subito FILE e CAMPO rotto. Gli issue cross-file (unicità) NOMINANO i file
 * coinvolti nel `message`.
 */
export interface ContentIssue {
  readonly file: string;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Rileva un ideogramma Han (kanji) in una stringa. Il campo lettura `kana` non
 * deve contenerne: una lettura con un kanji dentro non è una lettura, e
 * `alignFurigana()` (Epic 3, AD-21) non potrebbe derivarne la furigana. È un
 * controllo di CARATTERE, non di segmentazione (che è Epic 3): non produce falsi
 * positivi su katakana, hiragana, ー, ・, punteggiatura, cifre o latino, nessuno
 * dei quali è Han.
 */
const HAN = /\p{Script=Han}/u;

/**
 * Il CANCELLO di validazione del contenuto (AC1). PURO e TOTALE. Per ogni file:
 *   1. `JSON.parse` in `try/catch` — se fallisce, un issue `path: []` e si SALTANO
 *      gli altri controlli di quel file (non c'è dato da validare);
 *   2. `parseLesson` (fonte unica dello schema) — gli issue di schema sono mappati
 *      con `file`; se fallisce si salta il resto del file;
 *   3. coerenza `kana` (nessun Han) su ogni frase degli esercizi;
 *   4. raccolta di `lessonId` e `deriveExerciseId` per l'unicità cross-file.
 * Infine si segnala ogni id posseduto da più di un file (unicità).
 *
 * Ritorna `[]` SE E SOLO SE ogni file conforma. Cartella vuota ⇒ `files` vuoto ⇒
 * `[]` (0 lezioni conforme, il contenuto arriva in 2.7).
 */
export function validateLessons(files: ReadonlyArray<LessonFile>): ContentIssue[] {
  const issues: ContentIssue[] = [];
  // id → elenco dei file (per le lezioni) / delle localizzazioni (per gli
  // esercizi) che lo producono. Un id con più di un occupante è un duplicato.
  const lessonIds = new Map<string, string[]>();
  const exerciseIds = new Map<string, string[]>();

  for (const { path: file, source } of files) {
    let data: unknown;
    try {
      data = JSON.parse(source) as unknown;
    } catch (error) {
      issues.push({
        file,
        path: [],
        message: `JSON non valido: ${(error as Error).message}`,
      });
      continue; // Nessun dato da validare: si saltano gli altri controlli.
    }

    const parsed = parseLesson(data);
    if (!parsed.ok) {
      for (const issue of parsed.issues) {
        issues.push({ file, path: issue.path, message: issue.message });
      }
      continue; // Schema non conforme: gli altri controlli non sono affidabili.
    }

    const lesson: Lesson = parsed.value;

    // (b) Coerenza kanji/kana: nessun Han nel campo lettura di ogni frase.
    lesson.exercises.forEach((exercise, i) => {
      if (HAN.test(exercise.sentence.kana)) {
        issues.push({
          file,
          path: ['exercises', i, 'sentence', 'kana'],
          message:
            'coerenza kanji/kana: il campo kana (lettura) non deve contenere ideogrammi Han (kanji)',
        });
      }
    });

    // (c) Raccolta degli id per l'unicità cross-file.
    const lid = lessonId(lesson);
    (lessonIds.get(lid) ?? lessonIds.set(lid, []).get(lid)!).push(file);

    lesson.exercises.forEach((exercise, i) => {
      const eid = deriveExerciseId(exercise);
      // La localizzazione include file e indice: `deriveExerciseId` è definita solo
      // sugli esercizi conformi, e qui la lezione ha già passato `parseLesson`.
      const location = `${file} (exercises.${i})`;
      (exerciseIds.get(eid) ?? exerciseIds.set(eid, []).get(eid)!).push(location);
    });
  }

  // Unicità: ogni id posseduto da più di una localizzazione è un duplicato. Un
  // solo issue per id in collisione, che NOMINA tutte le localizzazioni coinvolte.
  for (const [id, locations] of lessonIds) {
    if (locations.length > 1) {
      issues.push({
        file: locations.join(', '),
        path: [],
        message: `lessonId duplicato "${id}" fra le lezioni: ${locations.join(', ')}`,
      });
    }
  }
  for (const [id, locations] of exerciseIds) {
    if (locations.length > 1) {
      issues.push({
        file: locations.join(', '),
        path: [],
        message: `exerciseId duplicato "${id}" fra gli esercizi: ${locations.join(', ')}`,
      });
    }
  }

  return issues;
}
