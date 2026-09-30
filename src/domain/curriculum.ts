// Livello domain: l'AUTORITÀ SEQUENZIALE del curriculum (AC3) — la scelta di
// COSA sbloccare, come funzione PURA. «Sequenziale, non si salta» è una regola di
// PRODOTTO, non un confine di sicurezza (sbloccare fuori ordine toccherebbe solo
// i propri dati di studio, già isolati da RLS): la sua sede è quindi il dominio,
// non l'SQL. La RPC `unlock_lesson` resta un materializzatore MUTO; qui si decide
// quale singola lezione le si passa.
//
// Puro come `./due` e `./schedule`: nessun import esterno, nessun global di
// piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Intl…resolvedOptions()`, nessun `Math.random()`. Il tempo non entra affatto —
// la sequenza dipende solo da `ordinal` e dall'insieme delle sbloccate.

import type { LessonSummary } from './ports/contentRepository';

/**
 * L'autorità sequenziale dello sblocco (AC3): data la lista delle lezioni e gli
 * id già sbloccati, ritorna la SUCCESSIVA lezione da sbloccare — quella con
 * `ordinal` più basso NON ancora sbloccata — oppure `null` a curriculum esaurito
 * (o lista vuota).
 *
 * PURA, sincrona, TOTALE e senza mutazione: copia+ordina per `ordinal` (l'input
 * può arrivare disordinato) e ritorna la prima il cui `id` non è in `unlockedIds`.
 * «Non si salta» è garantito strutturalmente — restituisce SEMPRE la successiva
 * immediata, mai una saltata; la UI passa alla RPC solo questo `id`.
 */
export function nextLessonToUnlock(
  lessons: readonly LessonSummary[],
  unlockedIds: readonly string[],
): LessonSummary | null {
  const unlocked = new Set(unlockedIds);
  const ordered = [...lessons].sort((a, b) => a.ordinal - b.ordinal);
  for (const lesson of ordered) {
    if (!unlocked.has(lesson.id)) {
      return lesson;
    }
  }
  return null;
}

/**
 * L'ULTIMA lezione sbloccata: data la lista delle lezioni e gli id già sbloccati,
 * ritorna la sbloccata con `ordinal` più ALTO — oppure `null` se nulla di sbloccato
 * combacia (o lista/insieme vuoto). Le sbloccate sono un PREFISSO contiguo (l'unico
 * percorso di scrittura, `nextLessonToUnlock`, è sequenziale) ⇒ «ordinal massimo
 * sbloccato» = «più recente». Dalla 3.17 il read-model (`UnlockedLesson[]`) PORTA
 * `unlocked_at` (serve al tetto giornaliero di sblocco), ma questa funzione resta
 * basata su `ordinal` e NON lo usa: con le sbloccate a prefisso contiguo l'istante
 * non aggiunge nulla a «più recente».
 *
 * PURA, sincrona, TOTALE e senza mutazione: copia+ordina per `ordinal` DISCENDENTE
 * (l'input può arrivare disordinato) e ritorna la prima il cui `id` è in
 * `unlockedIds`. Gli id sbloccati assenti dalle lezioni sono ignorati (nessun match).
 * Nessun clock, nessuna rete, nessun costrutto temporale (AD-1).
 */
export function lastUnlockedLesson(
  lessons: readonly LessonSummary[],
  unlockedIds: readonly string[],
): LessonSummary | null {
  const unlocked = new Set(unlockedIds);
  const ordered = [...lessons].sort((a, b) => b.ordinal - a.ordinal);
  for (const lesson of ordered) {
    if (unlocked.has(lesson.id)) {
      return lesson;
    }
  }
  return null;
}

/**
 * Il JOIN puro punto -> lezione (5.3): mappa OGNI `grammarPoint` di OGNI lezione
 * alla lezione che lo insegna. Serve alla vista statistiche per NOMINARE, accanto a
 * ciascun tasso d'errore (`grammarPointErrorRates`), la lezione azionabile su cui
 * tornare. Vive fuori dall'aggregazione perche il nome della lezione dipende dal
 * catalogo vivo (`content.listLessons()`), mentre il tasso deriva dal SOLO log
 * (AD-18): tenerli separati evita di accoppiare la statistica al contenuto.
 *
 * PURA, sincrona, TOTALE e senza mutazione, senza tempo: copia+ordina per `ordinal`
 * CRESCENTE (l'input puo arrivare disordinato) e inserisce ogni punto. L'unicita di
 * un `grammarPoint` fra lezioni NON e imposta (solo `lessonId = grammarPoints[0]`):
 * alla COLLISIONE (stesso punto in piu lezioni) vince il PRIMO occupante, cioe la
 * lezione con `ordinal` piu basso (deterministico). Un `grammarPoint` del log
 * assente da questa mappa e un punto ORFANO (drift contenuti): la vista rende un
 * fallback neutro senza perdere la voce.
 */
export function lessonsByGrammarPoint(
  lessons: readonly LessonSummary[],
): ReadonlyMap<string, LessonSummary> {
  const byPoint = new Map<string, LessonSummary>();
  const ordered = [...lessons].sort((a, b) => a.ordinal - b.ordinal);
  for (const lesson of ordered) {
    for (const grammarPoint of lesson.grammarPoints) {
      // Primo occupante vince: la lezione con ordinal piu basso (ordine crescente).
      if (!byPoint.has(grammarPoint)) {
        byPoint.set(grammarPoint, lesson);
      }
    }
  }
  return byPoint;
}

/**
 * Dove sta una lezione per chi studia (la pagina Lezioni):
 * - `current`: l'ultima sbloccata, quella in corso;
 * - `unlocked`: sbloccata prima, si può ripassare;
 * - `next`: la successiva, si sblocca dalla dashboard svuotando la pila;
 * - `locked`: più avanti.
 */
export type LessonStatus = 'current' | 'unlocked' | 'next' | 'locked';

/** Una voce dello scaffale: la lezione e il suo stato. */
export interface ShelfEntry {
  readonly lesson: LessonSummary;
  readonly status: LessonStatus;
}

/**
 * Lo SCAFFALE delle lezioni: tutte, in ordine di `ordinal`, ciascuna col suo stato.
 * Deriva dalle stesse autorità di sblocco (`nextLessonToUnlock`/`lastUnlockedLesson`),
 * così la pagina Lezioni e la dashboard non possono dire cose diverse.
 *
 * PURA, sincrona, TOTALE e senza mutazione, senza tempo.
 */
export function lessonShelf(
  lessons: readonly LessonSummary[],
  unlockedIds: readonly string[],
): ShelfEntry[] {
  const unlocked = new Set(unlockedIds);
  const current = lastUnlockedLesson(lessons, unlockedIds);
  const next = nextLessonToUnlock(lessons, unlockedIds);
  return [...lessons]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((lesson) => ({
      lesson,
      status:
        lesson.id === current?.id
          ? 'current'
          : unlocked.has(lesson.id)
            ? 'unlocked'
            : lesson.id === next?.id
              ? 'next'
              : 'locked',
    }));
}
