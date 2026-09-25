// Livello domain: il RITMO di sblocco (FR6.5/FR6.6) come funzioni PURE. Il tetto
// giornaliero limita quante lezioni si possono sbloccare in un giorno LOCALE;
// predefinito 1, modificabile da Impostazioni. Qui vivono il default, il registro
// chiuso delle opzioni e le due funzioni che il cancello della dashboard consulta.
//
// Puro come `./due`, `./schedule`, `./streak`: nessun import esterno, nessun
// global di piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Intl…resolvedOptions()`, nessun `Math.random()`. `now` e `timeZone` sono SEMPRE
// parametri espliciti (come `streak`); il dominio non legge orologio né fuso
// ambientale. Il confine di giornata è mezzanotte nel `timeZone` PASSATO,
// condiviso con `streak` via `./calendarDay` (una sola definizione del giorno).
import { localDayOrdinal } from './calendarDay';

/**
 * Il tetto giornaliero PREDEFINITO (FR6.5): una lezione al giorno. È il valore
 * usato quando `user_settings.lessons_per_day` è assente/non disponibile (la
 * porta `loadLessonsPerDay` degrada a `null` al confine totale).
 */
export const DEFAULT_LESSONS_PER_DAY = 1;

/**
 * Il registro CHIUSO delle scelte di tetto offerte da Impostazioni (FR6.6). Tutti
 * i valori sono >= 1: è QUI che l'invariante «almeno una al giorno» è imposta al
 * confine (nessun check SQL, coerente con la minimalità della tabella). L'ordine è
 * quello di presentazione dei bottoni.
 */
export const LESSONS_PER_DAY_OPTIONS = [1, 2, 3, 4, 5] as const;

/**
 * Quante lezioni sono state sbloccate OGGI (nel giorno locale di `now`, nel
 * `timeZone` passato): conta gli istanti di sblocco il cui giorno di calendario
 * coincide con quello di `now`. PURA, sincrona, TOTALE e senza mutazione — stessa
 * terna `(unlockedAt, now, timeZone)` ⇒ stesso numero, sempre — e non legge
 * orologio né fuso ambientale (`now`/`timeZone` sono parametri, AD-1). Il confine
 * di giornata è mezzanotte nel `timeZone` PASSATO (via `localDayOrdinal`), coerente
 * con lo streak: uno sblocco di ieri nel fuso locale NON conta.
 */
export function unlocksToday(
  unlockedAt: readonly Date[],
  now: Date,
  timeZone: string,
): number {
  const today = localDayOrdinal(now, timeZone);
  return unlockedAt.filter((instant) => localDayOrdinal(instant, timeZone) === today)
    .length;
}

/**
 * Il tetto giornaliero è RAGGIUNTO: gli sblocchi di oggi sono >= al tetto. PURA,
 * sincrona, TOTALE e senza mutazione — non legge orologio né fuso ambientale
 * (`now`/`timeZone` sono parametri, AD-1). A tetto raggiunto il cancello della
 * dashboard sostituisce l'azione di sblocco con la dichiarazione del limite;
 * si riazzera a mezzanotte nel `timeZone` (stesso confine di `unlocksToday`).
 */
export function dailyUnlockLimitReached(
  unlockedAt: readonly Date[],
  lessonsPerDay: number,
  now: Date,
  timeZone: string,
): boolean {
  return unlocksToday(unlockedAt, now, timeZone) >= lessonsPerDay;
}
