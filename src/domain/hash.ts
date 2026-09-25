// Livello domain: l'UNICA definizione di un hash DETERMINISTICO (AD-1, dominio
// puro — nessun import esterno, nessun global di piattaforma, nessun
// `Math.random()`). Estratto da `./schedule` (mirror dell'estrazione di
// `localDayOrdinal`→`calendarDay.ts` in 3.17): la dispersione delle scadenze
// (`schedule.ts`) e l'ordine deterministico delle opzioni (`exercise-presentation.ts`)
// hanno bisogno dello STESSO hash. Una sola sede evita due definizioni che un
// giorno divergerebbero.

/**
 * FNV-1a a 32 bit PURO su una stringa, come il fallback JS del pacchetto `uuid`.
 * Aritmetica a parola non segnata (`>>> 0`), moltiplicazione per il primo FNV via
 * `Math.imul`. Deterministico e sincrono: stessa stringa ⇒ stesso valore.
 */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
