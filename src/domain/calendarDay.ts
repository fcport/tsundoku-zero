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

/**
 * L'ora locale in cui comincia la GIORNATA DI STUDIO: alle 2 di notte la pila si
 * riempie tutta insieme. Un ripasso fatto all'una di notte appartiene ancora al
 * giorno prima, come chi studia tardi si aspetta.
 */
export const STUDY_DAY_START_HOUR = 2;

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * La giornata di studio di `instant` nel `timeZone`, come ORDINALE (vedi
 * `localDayOrdinal`): il giorno locale, ma con il confine alle
 * `STUDY_DAY_START_HOUR` invece che a mezzanotte.
 */
export function studyDayOrdinal(instant: Date, timeZone: string): number {
  return localDayOrdinal(
    new Date(instant.getTime() - STUDY_DAY_START_HOUR * MS_PER_HOUR),
    timeZone,
  );
}

/**
 * Lo scarto fra l'ora LOCALE di `instantMs` nel `timeZone` e l'UTC, in ms (+2h per
 * Roma d'estate). Legge l'ora locale coi `formatToParts` del fuso ESPLICITO.
 */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instantMs);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wall - (instantMs - (instantMs % 1000));
}

/**
 * L'ISTANTE in cui comincia la giornata di studio `dayOrdinal`: le
 * `STUDY_DAY_START_HOUR` locali di quel giorno nel `timeZone`. Due passate di
 * correzione dello scarto bastano anche nei giorni del cambio d'ora; se quell'ora
 * non esiste (le 2 saltate a fine marzo) cade sull'ora dopo.
 */
export function studyDayStart(dayOrdinal: number, timeZone: string): Date {
  const wall = dayOrdinal * MS_PER_DAY + STUDY_DAY_START_HOUR * MS_PER_HOUR;
  let instant = wall - zoneOffsetMs(wall, timeZone);
  instant = wall - zoneOffsetMs(instant, timeZone);
  return new Date(instant);
}
