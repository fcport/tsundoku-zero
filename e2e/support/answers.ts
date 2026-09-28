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
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Forma MINIMA del contenuto che ci interessa: le sole chiavi lette dallo helper
// (non l'intero schema di dominio, che vive in `src/` e non va importato qui).
interface SingleSelectExercise {
  readonly kind: 'single-select';
  readonly answer: string;
}
interface AssembleExercise {
  readonly kind: 'assemble';
  readonly answer: readonly string[];
}
interface SelectSpanExercise {
  readonly kind: 'select-span';
  readonly answer: { readonly start: number; readonly end: number };
}
type LessonExercise =
  | SingleSelectExercise
  | AssembleExercise
  | SelectSpanExercise;
interface Lesson {
  readonly exercises: readonly LessonExercise[];
}

/** Il gesto da eseguire su una card, derivato dal `kind` dell'esercizio. */
export type ExerciseSolution =
  | { readonly kind: 'single-select'; readonly choiceText: string }
  | { readonly kind: 'assemble'; readonly tokensInOrder: readonly string[] }
  | { readonly kind: 'select-span'; readonly optionIndex: number };

// Il percorso del contenuto canonico della prima lezione (relativo alla radice
// del repo = cwd del run Playwright). Una sola fonte, come il dominio.
const LESSON_PATH = resolve(
  process.cwd(),
  'content',
  'lessons',
  '01-la-particella-wo.json',
);

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
    switch (exercise.kind) {
      case 'single-select':
        return { kind: 'single-select', choiceText: exercise.answer };
      case 'assemble':
        return { kind: 'assemble', tokensInOrder: [...exercise.answer] };
      case 'select-span':
        // L'indice di OPZIONE è l'indice di segmento (ordine naturale): il
        // dominio (`composeResponse`) mappa 1:1 opzione→segmento, quindi cliccare
        // il bottone all'indice `answer.start` seleziona il segmento giusto.
        return { kind: 'select-span', optionIndex: exercise.answer.start };
      default: {
        const exhaustive: never = exercise;
        throw new Error(
          `Esercizio con kind non gestito nel contenuto: ${JSON.stringify(exhaustive)}`,
        );
      }
    }
  });
}
