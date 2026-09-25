// Livello features/study (4.1): l'identità della cache del CONTENUTO degli esercizi
// della sessione. UNA sola definizione condivisa dal precarico (`prefetchDueStack`)
// e dalla lettura (`SessionScreen`), così le due non possono divergere sulla FORMA
// della chiave: se il precarico scrivesse una forma e la sessione ne leggesse
// un'altra, il precarico non darebbe un cache-hit e la sessione ripiegherebbe sul
// caricamento reattivo, vanificando la 4.1. Speculare a `dueQueryKey` di `domain/due`
// (l'identità della pila), ma vive nelle features: gli id degli esercizi sono un
// dettaglio di caricamento del contenuto, non un concetto di dominio.
//
// Gli `ids` sono le chiavi di RIGA DB derivate dalla pila `['due']` con lo STESSO
// ordine in entrambi i siti (`dueData.map(s => s.exerciseId)`). La chiave è
// STRUTTURALE: TanStack Query la confronta per valore, non per riferimento.

/** L'identità della cache del contenuto: la tupla `readonly` `['exercises', ids]`. */
export type ExercisesQueryKey = readonly ['exercises', readonly string[]];

/**
 * Costruisce l'identità della cache del contenuto per un insieme di id di RIGA.
 * PURA e DETERMINISTICA: stessi `ids` (per valore e ordine) ⇒ tuple uguali per
 * valore ⇒ stessa entry di cache TanStack.
 */
export function exercisesQueryKey(ids: readonly string[]): ExercisesQueryKey {
  return ['exercises', ids] as const;
}
