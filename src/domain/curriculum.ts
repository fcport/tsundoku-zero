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
 * sbloccato» = «più recente», senza bisogno di un `unlocked_at` nel read-model.
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
