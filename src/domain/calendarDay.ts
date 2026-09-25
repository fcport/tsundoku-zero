// Livello domain: il CONFINE DI GIORNATA come primitiva pura CONDIVISA (AD-1).
// Estratta verbatim da `streak.ts` (storia 3.5) col secondo consumatore (il tetto
// di sblocco, 3.17): entrambi hanno bisogno di mappare un istante al suo giorno
// LOCALE come ordinale, e il confine di giornata è mezzanotte nel `timeZone`
// PASSATO. Vive qui una sola volta, così streak e tetto non possono divergere.
//
// Puro come `./due`, `./schedule`, `./streak`: nessun import esterno, nessun
// global di piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Intl…resolvedOptions()` (che leggerebbe il fuso ambientale), nessun
// `Math.random()`. Il `timeZone` ENTRA SEMPRE come parametro esplicito.

/** Millisecondi in un giorno: usato per mappare un giorno di calendario a un ordinale. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Il GIORNO LOCALE di `instant` nel `timeZone`, come ORDINALE intero. Formatta
 * l'istante nel `timeZone` ESPLICITO passato (mai `resolvedOptions()`, che
 * leggerebbe il fuso ambientale) col calendario ISO `en-CA` (`YYYY-MM-DD`), poi
 * mappa il nominale Y-M-D a `Date.UTC(...) / MS_PER_DAY`. Così due giorni di
 * calendario CONSECUTIVI differiscono sempre di esattamente 1, robusto a DST,
 * fine mese e fine anno: l'aritmetica avviene sui numeri di giorno nominali, non
 * sull'istante UTC (che una transizione DST accorcia o allunga).
 */
export function localDayOrdinal(instant: Date, timeZone: string): number {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}
