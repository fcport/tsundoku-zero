// Support e2e (storia 7.4): le risposte corrette DERIVATE dal contenuto canonico
// `content/lessons/01-la-particella-wo.json`, MAI cablate a mano (una soluzione
// scritta a mano potrebbe divergere dal contenuto quando questo cambia). La
// derivazione è coerente con `answerOptions`/`composeResponse` del dominio, ma
// NON importa `src/` (AD-1): lo helper legge il JSON e traduce ogni `answer` nel
// gesto UI corrispondente.
//
// - single-select → il TESTO da cliccare è `answer` (il bottone con quel testo).
// - assemble       → i TOKEN di `answer` NELL'ORDINE (cliccati per testo: una
//   tessera scelta diventa `disabled` con badge, quindi si cliccano le rimanenti).
// - select-span    → l'INDICE di opzione è `answer.start` (0): il bottone-segmento
//   a quell'indice, coerente con `composeResponse` (indice di opzione = indice di
//   segmento, ordine naturale). NON si ricalcola `alignFurigana`.
//
// Gira in Node (globals `process`, moduli `node:*`): legge il file dal disco con
// un percorso RELATIVO alla radice del repo (cwd del run Playwright).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Forma MINIMA del contenuto che ci interessa: le sole chiavi lette dallo helper
// (non l'intero schema di dominio, che vive in `src/` e non va importato qui).
// La domanda propria dell'esercizio (bilingue): identifica la card a schermo
// quando la lezione ha più esercizi dello stesso `kind`.
interface ExercisePrompt {
  readonly en?: string;
  readonly it?: string;
}
interface SingleSelectExercise {
  readonly kind: 'single-select';
  readonly prompt?: ExercisePrompt;
  readonly answer: string;
}
interface AssembleExercise {
  readonly kind: 'assemble';
  readonly prompt?: ExercisePrompt;
  readonly answer: readonly string[];
}
interface SelectSpanExercise {
  readonly kind: 'select-span';
  readonly prompt?: ExercisePrompt;
  readonly answer: { readonly start: number; readonly end: number };
}
type LessonExercise =
  | SingleSelectExercise
  | AssembleExercise
  | SelectSpanExercise;
interface Lesson {
  readonly exercises: readonly LessonExercise[];
}

/**
 * Il gesto da eseguire su una card, derivato dal `kind` dell'esercizio, più le
 * sue domande (una per lingua) per riconoscere QUALE esercizio è a schermo: dal
 * 29-09-2026 una lezione ha più esercizi per tipo, e il solo `kind` non basta.
 */
export type ExerciseSolution = { readonly prompts: readonly string[] } & (
  | { readonly kind: 'single-select'; readonly choiceText: string }
  | { readonly kind: 'assemble'; readonly tokensInOrder: readonly string[] }
  | { readonly kind: 'select-span'; readonly optionIndex: number }
);

const LESSONS_DIR = resolve(process.cwd(), 'content', 'lessons');

/**
 * Il percorso della lezione che l'app sblocca PER PRIMA: quella con `order`
 * minimo fra tutte in `content/lessons/`, che è il criterio del dominio
 * (`curriculum.ts` ordina per `ordinal` e prende la prima non sbloccata).
 *
 * NON è cablato a un nome di file. Lo era — `01-la-particella-wo.json` — e il
 * 28-09-2026 l'e2e si è rotto appena il curriculum ha acquisito la sua prima
 * lezione vera: il test cercava una tessera (`私は`) della lezione campione
 * mentre l'app serviva un'altra lezione. Un test che va aggiornato a ogni
 * cambio di contenuto è un costo che cresce con le lezioni, cioè ciò che
 * `NFR9` vieta.
 */
function firstLessonPath(): string {
  if (!existsSync(LESSONS_DIR)) {
    throw new Error(
      `Cartella del contenuto assente: ${LESSONS_DIR}. L'e2e va lanciato dalla radice del repo.`,
    );
  }
  const files = readdirSync(LESSONS_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(`Nessuna lezione in ${LESSONS_DIR}: l'e2e non ha contenuto da percorrere.`);
  }
  let best: { path: string; order: number } | undefined;
  for (const file of files) {
    const path = resolve(LESSONS_DIR, file);
    let order: unknown;
    try {
      order = (JSON.parse(readFileSync(path, 'utf-8')) as { order?: unknown }).order;
    } catch (cause) {
      throw new Error(`Lezione malformata (JSON non valido): ${path}.`, { cause });
    }
    if (typeof order !== 'number') {
      throw new Error(`Lezione senza "order" numerico: ${path}.`);
    }
    if (best === undefined || order < best.order) {
      best = { path, order };
    }
  }
  return best!.path;
}

const LESSON_PATH = firstLessonPath();

/**
 * Legge la prima lezione e DERIVA la soluzione di ciascun esercizio nell'ordine
 * del contenuto. PURA rispetto al file (nessuna rete, nessuna casualità): stesso
 * file ⇒ stesse soluzioni. Un `kind` non gestito lancia (registro chiuso: se il
 * contenuto introducesse un tipo nuovo, l'e2e va aggiornato di proposito).
 *
 * Ogni fallimento è NOMINATO (idioma di `migrate.yml`/`src/app/env.ts`/
 * `teardown.ts`), mai un `ENOENT`/`SyntaxError` opaco: se il file manca (o
 * `playwright test` è lanciato da una cwd diversa dalla radice), se il JSON è
 * malformato, o se `exercises` non è un array, il messaggio dice COSA e DOVE.
 */
export function loadFirstLessonSolutions(): readonly ExerciseSolution[] {
  // Esistenza esplicita PRIMA della lettura: un file assente è quasi sempre una
  // cwd sbagliata, non un contenuto rotto — il messaggio lo dice.
  if (!existsSync(LESSON_PATH)) {
    throw new Error(
      `Contenuto della prima lezione assente al percorso atteso: ${LESSON_PATH}. L'e2e va lanciato dalla radice del repo.`,
    );
  }

  const raw = readFileSync(LESSON_PATH, 'utf-8');
  let lesson: Lesson;
  try {
    lesson = JSON.parse(raw) as Lesson;
  } catch (cause) {
    throw new Error(
      `Contenuto della prima lezione malformato (JSON non valido) al percorso: ${LESSON_PATH}.`,
      { cause },
    );
  }

  if (!Array.isArray(lesson.exercises)) {
    throw new Error(
      `Contenuto della prima lezione senza array "exercises" al percorso: ${LESSON_PATH}.`,
    );
  }

  return lesson.exercises.map((exercise): ExerciseSolution => {
    const prompts = [exercise.prompt?.en, exercise.prompt?.it].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    );
    switch (exercise.kind) {
      case 'single-select':
        return { kind: 'single-select', prompts, choiceText: exercise.answer };
      case 'assemble':
        return { kind: 'assemble', prompts, tokensInOrder: [...exercise.answer] };
      case 'select-span':
        // L'indice di OPZIONE è l'indice di segmento (ordine naturale): il
        // dominio (`composeResponse`) mappa 1:1 opzione→segmento, quindi cliccare
        // il bottone all'indice `answer.start` seleziona il segmento giusto.
        return { kind: 'select-span', prompts, optionIndex: exercise.answer.start };
      default: {
        const exhaustive: never = exercise;
        throw new Error(
          `Esercizio con kind non gestito nel contenuto: ${JSON.stringify(exhaustive)}`,
        );
      }
    }
  });
}
