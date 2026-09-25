// Livello domain: la QUINTA legge di Epic 3 (`AD-18`) — lo streak SI CALCOLA, non
// si memorizza. Rivolto all'utente è «i giorni consecutivi in cui tieni la pila a
// zero» — ciò che la dashboard (FR3.2) e la schermata di completamento (FR4.4)
// mostrano. Ma OPERATIVAMENTE, sul solo `review_log`, un giorno conta quando ha
// almeno una risposta, INDIFFERENTE dal fatto che la pila sia arrivata a zero: il
// log per-risposta non può osservare se la pila si è svuotata (vedi la docstring
// di `streak` per la regola precisa e il perché). Una colonna che memorizzi lo
// streak potrebbe DIVERGERE dalla sua fonte: è una statistica derivata da dati
// mutabili nel tempo. Qui lo streak è una funzione PURA su `review_log`,
// ricalcolata a ogni lettura, mai memorizzata: `streak.ts` è l'UNICO punto di `src/`
// che lo produce, così i consumatori futuri (dashboard 3.12+, completamento 3.21)
// non nascano divergenti.
//
// Puro come `./due` e `./schedule`: nessun import esterno, nessun global di
// piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Intl…resolvedOptions()`, nessun `Math.random()`. Sia l'istante `now` sia il
// `timeZone` ENTRANO come parametri (`streak.length === 3`); il dominio non legge
// orologio né fuso ambientale. Il confine di giornata è mezzanotte nel `timeZone`
// PASSATO — condiviso col tetto di sblocco (3.17) via `./calendarDay`.
import { localDayOrdinal } from './calendarDay';

/**
 * Una voce del registro append-only dei ripassi: il tipo MINIMO necessario allo
 * streak — solo l'istante in cui è avvenuta la risposta. NON è uno `ReviewState`
 * (quello è lo stato CORRENTE di un esercizio, non il registro per-risposta):
 * strutturalmente compatibile con la futura riga `review_log` (3.7+), senza
 * anticiparne lo schema.
 */
export interface ReviewLogEntry {
  readonly reviewedAt: Date;
}

/**
 * Lo streak: i GIORNI DI CALENDARIO CONSECUTIVI (nel `timeZone` passato) con
 * almeno una risposta nel `log`, contati a ritroso da un'ancora. PURA, sincrona,
 * TOTALE e senza mutazione — stessa terna `(log, now, timeZone)` ⇒ stesso numero,
 * sempre — e non legge orologio né fuso ambientale: `now` e `timeZone` sono SEMPRE
 * parametri espliciti (`streak.length === 3`, AD-1). Deriva SOLO dal `log`: nessuna
 * altra fonte, nessuno stato memorizzato (AD-18, titolo della storia).
 *
 * Un giorno conta se ha ≥1 risposta — indifferente al fatto che la risposta abbia
 * portato la pila a zero o sia avvenuta a pila già vuota: il log registra la
 * risposta in entrambi i casi (l'unico input onesto ricostruibile dal solo log).
 * Più risposte nello stesso giorno contano una volta sola (insieme di giorni).
 *
 * Ancora e GRAZIA fino a mezzanotte: se oggi ha attività l'ancora è oggi;
 * altrimenti, se ieri ha attività, l'ancora scende a ieri (lo streak resta vivo
 * fino a mezzanotte di oggi, non si punisce prima che la giornata finisca);
 * altrimenti (ultima attività ≥2 giorni fa, o log vuoto) lo streak è `0`. Dal-
 * l'ancora si contano i giorni presenti consecutivi a ritroso: un giorno saltato
 * tronca la parte precedente.
 */
export function streak(log: readonly ReviewLogEntry[], now: Date, timeZone: string): number {
  const days = new Set(log.map((entry) => localDayOrdinal(entry.reviewedAt, timeZone)));
  const today = localDayOrdinal(now, timeZone);
  const anchor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (anchor === null) return 0;
  let count = 0;
  while (days.has(anchor - count)) count += 1;
  return count;
}
