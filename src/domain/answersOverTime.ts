// Livello domain (5.1): la SERIE delle risposte per giorno di calendario. Come lo
// streak (`./streak`), SI CALCOLA dal solo `review_log` (AD-18), mai da
// `review_count`/`review_state`: quelli sarebbero un secondo numero divergente. È
// la fonte UNICA e derivata del conteggio giornaliero — la vista delle statistiche
// (FR7.1) e le storie 5.2-5.4 non ne nascano divergenti.
//
// Pura come `./streak`, `./due`, `./schedule`: nessun import esterno, nessun global
// di piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Intl…resolvedOptions()`. Sia `now: Date` sia `timeZone: string` ENTRANO come
// parametri espliciti (firma a 3 argomenti come `streak`); il dominio non legge
// orologio né fuso ambientale. Il confine di giornata è mezzanotte nel `timeZone`
// PASSATO, riusando `localDayOrdinal` di `./calendarDay` — la stessa primitiva
// condivisa da streak e tetto di sblocco, così non possono divergere.
import { localDayOrdinal, MS_PER_DAY } from './calendarDay';
import type { ReviewLogEntry } from './streak';

/**
 * Il conteggio delle risposte per UN giorno di calendario. `date` è il giorno
 * nominale in formato ISO `YYYY-MM-DD` (non un istante: identifica il giorno, non
 * un momento); `count` è il numero di risposte in quel giorno locale (>= 0: i
 * giorni interni senza risposte compaiono con `0`).
 */
export interface DailyAnswerCount {
  readonly date: string;
  readonly count: number;
}

/**
 * Le risposte per giorno di calendario (nel `timeZone` passato), come SERIE
 * CONTIGUA dal primo giorno con risposte fino a OGGI. PURA, sincrona, TOTALE e
 * senza mutazione — stessa terna `(log, now, timeZone)` ⇒ stessa serie, sempre — e
 * non legge orologio né fuso ambientale: `now` e `timeZone` sono SEMPRE parametri
 * espliciti (`answersOverTime.length === 3`, AD-1). Deriva SOLO dal `log` (AD-18):
 * nessuna altra fonte, nessuno stato memorizzato.
 *
 * Bucketizza ogni voce sul suo `localDayOrdinal` e conta quante ne cadono in ogni
 * giorno; più risposte nello stesso giorno locale contano ognuna (`count` = numero
 * di voci di quel giorno). La serie va da `min(ordinali)` a `max(oggi, max(ordinali))`
 * INCLUSIVI: i giorni interni senza risposte compaiono con `count` 0, e se l'ultima
 * risposta è nel passato la serie si ESTENDE fino a oggi (gli ultimi giorni a `0`,
 * onesta sul ritmo interrotto). Il confine sinistro è il primo giorno con risposte,
 * mai prima (nessuno zero iniziale insensato).
 *
 * `date` è l'inverso PURO di `localDayOrdinal`: quest'ultimo mappa il giorno
 * nominale Y-M-D a `Date.UTC(y,m,d)/MS_PER_DAY`, quindi
 * `new Date(ordinal*MS_PER_DAY).toISOString().slice(0,10)` restituisce esattamente
 * quel `YYYY-MM-DD`. `new Date(numero)` con argomento è deterministico e ammesso nel
 * dominio (a differenza di `new Date()` senza argomenti).
 *
 * Log vuoto ⇒ `[]` (nessuna serie): la vista rende un placeholder testuale neutro,
 * non un grafico vuoto (la ricca dichiarazione «cosa manca» è la storia 5.4).
 */
export function answersOverTime(
  log: readonly ReviewLogEntry[],
  now: Date,
  timeZone: string,
): readonly DailyAnswerCount[] {
  if (log.length === 0) return [];

  // Conteggio per ordinale di giorno locale (una voce per giorno con risposte).
  const counts = new Map<number, number>();
  for (const entry of log) {
    const ordinal = localDayOrdinal(entry.reviewedAt, timeZone);
    counts.set(ordinal, (counts.get(ordinal) ?? 0) + 1);
  }

  // Confine sinistro: il primo giorno con risposte. Confine destro: oggi, o
  // l'ultimo giorno con risposte se nel futuro (difensivo: log robusto a orologi
  // sfasati). La serie è CONTIGUA fra i due, giorni interni senza risposte a 0.
  const ordinals = [...counts.keys()];
  const first = Math.min(...ordinals);
  const today = localDayOrdinal(now, timeZone);
  const last = Math.max(today, ...ordinals);

  const series: DailyAnswerCount[] = [];
  for (let ordinal = first; ordinal <= last; ordinal += 1) {
    series.push({
      date: new Date(ordinal * MS_PER_DAY).toISOString().slice(0, 10),
      count: counts.get(ordinal) ?? 0,
    });
  }
  return series;
}
