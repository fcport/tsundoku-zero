// Livello domain: la QUINTA legge di Epic 3 (`AD-18`) — lo streak SI CALCOLA, non
// si memorizza. Rivolto all'utente è «i giorni consecutivi in cui tieni la pila a
// zero» — ciò che la dashboard (FR3.2) e la schermata di completamento (FR4.4)
// mostrano — con un giorno libero ogni settimana (07-10-2026, `FREE_DAY_EVERY`). Ma OPERATIVAMENTE, sul solo `review_log`, un giorno conta quando ha
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
import { localDayOrdinal, MS_PER_DAY } from './calendarDay';
import type { ReviewOutcome } from './schedule';

/**
 * Una voce del registro append-only dei ripassi: il tipo MINIMO necessario allo
 * streak — solo l'istante in cui è avvenuta la risposta. NON è uno `ReviewState`
 * (quello è lo stato CORRENTE di un esercizio, non il registro per-risposta):
 * strutturalmente compatibile con la futura riga `review_log` (3.7+), senza
 * anticiparne lo schema. `answersOverTime` e `streak` consumano SOLO questo tipo
 * (giorno/streak): resta minimo di proposito.
 */
export interface ReviewLogEntry {
  readonly reviewedAt: Date;
}

/**
 * La proiezione COMPLETA di una riga `review_log`, come la restituisce ora il
 * canale unico `listReviewLog`: un `ReviewLogEntry` (istante) ESTESO con l'identità
 * dell'esercizio (`exerciseId`), l'esito (`outcome`) e il punto grammaticale
 * DENORMALIZZATO al momento della risposta (`grammarPoint`, snapshot scritto da
 * `apply_review`, AD-18/AD-23/FR5.7). Serve alle statistiche di STATO (5.2/5.3):
 * 5.2 deriva lo stadio corrente di un esercizio rigiocando i suoi esiti dal SOLO
 * log (mai da `review_state`); 5.3 aggrega il tasso d'errore per `grammarPoint`
 * (mai per `exerciseId`, così la storia sopravvive alla riautorazione di un
 * esercizio). `extends ReviewLogEntry` ⇒ resta assegnabile a `streak` e
 * `answersOverTime`, che continuano a leggere solo `reviewedAt`; `stageDistribution`
 * legge `exerciseId`/`outcome` e ignora `grammarPoint` (aggiunta ADDITIVA).
 */
export interface ReviewLogRecord extends ReviewLogEntry {
  readonly exerciseId: string;
  readonly outcome: ReviewOutcome;
  readonly grammarPoint: string;
}

/**
 * Il GIORNO LIBERO (07-10-2026): ogni quanti giorni se ne può saltare uno senza
 * perdere la serie. Due giorni perdonati distano almeno questo; due giorni saltati
 * di fila rompono sempre la serie (il secondo non ha un giorno di studio prima).
 */
export const FREE_DAY_EVERY = 7;

/** I giorni locali (ordinali) con almeno una risposta. */
function studyDays(log: readonly ReviewLogEntry[], timeZone: string): Set<number> {
  return new Set(log.map((entry) => localDayOrdinal(entry.reviewedAt, timeZone)));
}

/** Il giorno nominale `YYYY-MM-DD` di un ordinale (inverso di `localDayOrdinal`). */
function isoDay(ordinal: number): string {
  return new Date(ordinal * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * La serie che arriva al giorno `end`, contata a ritroso. Un giorno con risposte
 * conta 1. Un giorno senza risposte è PERDONATO (giorno libero) se il giorno prima
 * ha risposte e il giorno perdonato più vicino dista almeno `FREE_DAY_EVERY`;
 * altrimenti la serie finisce lì. Il giorno `end` stesso, se è OGGI e non ha ancora
 * risposte, è aperto: non conta e non rompe niente (`endIsOpen`).
 */
function chainEndingAt(
  days: ReadonlySet<number>,
  end: number,
  endIsOpen: boolean,
): { readonly length: number; readonly freeDays: readonly number[] } {
  let length = 0;
  const freeDays: number[] = [];
  for (let day = end; ; day -= 1) {
    if (days.has(day)) {
      length += 1;
      continue;
    }
    if (day === end && endIsOpen) continue;
    const closestFree = freeDays[freeDays.length - 1];
    if (days.has(day - 1) && (closestFree === undefined || closestFree - day >= FREE_DAY_EVERY)) {
      freeDays.push(day);
      continue;
    }
    return { length, freeDays };
  }
}

/**
 * Lo streak: i GIORNI DI STUDIO della serie in corso (nel `timeZone` passato),
 * contati a ritroso da oggi. PURA, sincrona, TOTALE e senza mutazione — stessa
 * terna `(log, now, timeZone)` ⇒ stesso numero, sempre — e non legge orologio né
 * fuso ambientale: `now` e `timeZone` sono SEMPRE parametri espliciti
 * (`streak.length === 3`, AD-1). Deriva SOLO dal `log`: nessuna altra fonte,
 * nessuno stato memorizzato (AD-18, titolo della storia).
 *
 * Un giorno conta se ha ≥1 risposta — indifferente al fatto che la risposta abbia
 * portato la pila a zero o sia avvenuta a pila già vuota: il log registra la
 * risposta in entrambi i casi (l'unico input onesto ricostruibile dal solo log).
 * Più risposte nello stesso giorno contano una volta sola (insieme di giorni).
 *
 * GRAZIA fino a mezzanotte: oggi senza risposte non rompe la serie, la giornata non
 * è finita. GIORNO LIBERO (07-10-2026): un giorno saltato ogni `FREE_DAY_EVERY` è
 * perdonato — non conta, ma la serie prosegue oltre (vedi `chainEndingAt`). Due
 * giorni saltati di fila, o due salti più vicini di `FREE_DAY_EVERY`, la troncano.
 */
export function streak(log: readonly ReviewLogEntry[], now: Date, timeZone: string): number {
  const today = localDayOrdinal(now, timeZone);
  return chainEndingAt(studyDays(log, timeZone), today, true).length;
}

/** Lo stato della serie per chi studia: i giorni, e se il giorno libero c'è. */
export interface StreakStatus {
  /** I giorni di studio della serie in corso: lo stesso numero di `streak`. */
  readonly days: number;
  /** Oggi ha già almeno una risposta. */
  readonly studiedToday: boolean;
  /** L'ultimo giorno perdonato della serie in corso (`YYYY-MM-DD`), o `null`. */
  readonly lastFreeDay: string | null;
  /**
   * `null` se il prossimo giorno che salti (oggi, o domani se oggi hai già
   * studiato) sarebbe perdonato; altrimenti il giorno (`YYYY-MM-DD`) da cui il
   * giorno libero torna disponibile.
   */
  readonly freeDayBackOn: string | null;
}

/**
 * Lo stato della serie in corso: la stessa regola di `streak`, più il giorno libero
 * (l'ultimo usato, e quando torna). Pura, `now` e `timeZone` come parametri.
 */
export function streakStatus(
  log: readonly ReviewLogEntry[],
  now: Date,
  timeZone: string,
): StreakStatus {
  const days = studyDays(log, timeZone);
  const today = localDayOrdinal(now, timeZone);
  const chain = chainEndingAt(days, today, true);
  const studiedToday = days.has(today);
  const lastFree = chain.freeDays[0];
  const nextSkippable = studiedToday ? today + 1 : today;
  const backOn =
    lastFree === undefined || nextSkippable - lastFree >= FREE_DAY_EVERY
      ? null
      : lastFree + FREE_DAY_EVERY;
  return {
    days: chain.length,
    studiedToday,
    lastFreeDay: lastFree === undefined ? null : isoDay(lastFree),
    freeDayBackOn: backOn === null ? null : isoDay(backOn),
  };
}

/** Un giorno della settimana della serie, per la fila di quadretti. */
export interface StreakDay {
  /** Il giorno nominale `YYYY-MM-DD`. */
  readonly date: string;
  /**
   * `studied`: almeno una risposta; `free`: saltato ma perdonato (giorno libero);
   * `missed`: saltato e fuori dalla serie; `open`: oggi, ancora senza risposte.
   */
  readonly state: 'studied' | 'free' | 'missed' | 'open';
}

/**
 * Gli ultimi `length` giorni fino a oggi incluso, dal più vecchio: per ciascuno se
 * hai studiato, se era un giorno libero della serie in corso, o se l'hai saltato.
 */
export function streakWeek(
  log: readonly ReviewLogEntry[],
  now: Date,
  timeZone: string,
  length = FREE_DAY_EVERY,
): readonly StreakDay[] {
  const days = studyDays(log, timeZone);
  const today = localDayOrdinal(now, timeZone);
  const free = new Set(chainEndingAt(days, today, true).freeDays);
  const week: StreakDay[] = [];
  for (let day = today - length + 1; day <= today; day += 1) {
    const state = days.has(day)
      ? 'studied'
      : day === today
        ? 'open'
        : free.has(day)
          ? 'free'
          : 'missed';
    week.push({ date: isoDay(day), state });
  }
  return week;
}

/** La serie com'era alla fine di un giorno di studio, per i traguardi. */
export interface StreakPoint {
  /** Il giorno nominale `YYYY-MM-DD`. */
  readonly date: string;
  /** La prima risposta di quel giorno: l'istante in cui la serie ha raggiunto `days`. */
  readonly reachedAt: Date;
  /** I giorni di studio della serie arrivata a quel giorno. */
  readonly days: number;
}

/**
 * La STORIA della serie: per ogni giorno con risposte, in ordine, quanti giorni di
 * studio contava la serie arrivata lì (stessa regola di `streak`). I traguardi ne
 * leggono il massimo e il giorno in cui una soglia è stata superata. Pura.
 */
export function streakHistory(
  log: readonly ReviewLogEntry[],
  timeZone: string,
): readonly StreakPoint[] {
  const firstAt = new Map<number, Date>();
  for (const entry of log) {
    const day = localDayOrdinal(entry.reviewedAt, timeZone);
    const seen = firstAt.get(day);
    if (seen === undefined || entry.reviewedAt < seen) firstAt.set(day, entry.reviewedAt);
  }
  const days = new Set(firstAt.keys());
  return [...firstAt.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, reachedAt]) => ({
      date: isoDay(day),
      reachedAt,
      days: chainEndingAt(days, day, false).length,
    }));
}

/**
 * Tutti i giorni perdonati della storia (`YYYY-MM-DD`), per il calendario delle
 * statistiche. La storia si divide in serie che non si toccano, dalla più recente:
 * prima quella in corso (la stessa di `streak`, con oggi aperto), poi quella che
 * finisce all'ultimo giorno di studio prima della sua interruzione, e così via.
 */
export function freeDaysInHistory(
  log: readonly ReviewLogEntry[],
  now: Date,
  timeZone: string,
): ReadonlySet<string> {
  const days = studyDays(log, timeZone);
  const today = localDayOrdinal(now, timeZone);
  const newestFirst = [...days].filter((day) => day <= today).sort((a, b) => b - a);
  const free = new Set<string>();
  let chain = chainEndingAt(days, today, true);
  let index = 0;
  for (;;) {
    for (const freeDay of chain.freeDays) free.add(isoDay(freeDay));
    // La serie contiene esattamente i suoi `length` giorni di studio più recenti.
    index += chain.length;
    const end = newestFirst[index];
    if (end === undefined) return free;
    chain = chainEndingAt(days, end, false);
  }
}
