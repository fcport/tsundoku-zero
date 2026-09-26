// Livello domain (5.3): il TASSO D'ERRORE per PUNTO GRAMMATICALE (FR7.3). Come lo
// streak (`./streak`), le risposte nel tempo (`./answersOverTime`) e la distribuzione
// per stadio (`./stageDistribution`), SI CALCOLA dal solo `review_log` (AD-18), mai
// da `review_state`/`lapse_count`/`review_count`/lo `stage` memorizzato: quelli
// sarebbero un secondo numero difendibile e divergente.
//
// Perche per `grammarPoint` del LOG e non per `exerciseId`: FR7.3 chiede «quale
// REGOLA non ti e entrata», non «quale frase sbagli». Il log porta `grammarPoint`
// DENORMALIZZATO (snapshot al momento della risposta, scritto da `apply_review`,
// AD-23/FR5.7): raggruppare su questo campo rende la statistica interrogabile anche
// dopo che un esercizio e stato riautorato e ha cambiato identita, o e stato rimosso.
// Se il punto vivesse solo sull'esercizio corrente, una riautorazione riscriverebbe
// la storia. La risoluzione punto -> lezione e un ARRICCHIMENTO che dipende dal
// catalogo: vive fuori di qui (`lessonsByGrammarPoint` di `./curriculum`), cosi
// questa funzione resta pura sul SOLO log.
//
// Pura come `./stageDistribution`: nessun import esterno, nessun global di
// piattaforma, nessun `Date.now()`/`new Date()` senza argomenti, nessun
// `Math.random()`. E SENZA tempo: il tasso non dipende dall'orologio, quindi la
// firma e a UN solo argomento (`grammarPointErrorRates.length === 1`).
import type { ReviewLogRecord } from './streak';

/**
 * Il tasso d'errore di un punto grammaticale: `total` risposte registrate per quel
 * punto, di cui `errors` fallite (esito `again`); `errorRate` = `errors/total` in
 * `[0,1]` (`total >= 1` per costruzione — un punto compare solo se praticato). Un
 * punto con `errors === 0` compare comunque (`errorRate === 0`): la statistica
 * mostra TUTTI i punti praticati, non solo quelli sbagliati.
 */
export interface GrammarPointErrorRate {
  readonly grammarPoint: string;
  readonly total: number;
  readonly errors: number;
  readonly errorRate: number;
}

/**
 * I tassi d'errore per punto grammaticale, derivati dal SOLO `review_log` (AD-18).
 * PURA, sincrona, TOTALE e senza mutazione — stesso `log` ⇒ stessi tassi, sempre —
 * e SENZA tempo (`grammarPointErrorRates.length === 1`): il tasso non dipende
 * dall'orologio.
 *
 * Raggruppa le voci per `grammarPoint` DEL LOG (denormalizzato, NON per
 * `exerciseId`): due esercizi con identita diverse ma STESSO `grammarPoint` contano
 * in UNA sola voce, cosi la storia sopravvive alla riautorazione. Per ogni punto
 * conta `total` (tutte le risposte) ed `errors` (le sole con esito `again`, coerente
 * con la semantica di `REVIEW_OUTCOMES` di `./schedule`); `errorRate = errors/total`.
 *
 * Ordina per `errorRate` DECRESCENTE (i peggiori in cima, cio che l'AC osserva);
 * a pari tasso il tie-break e `total` DECRESCENTE, poi `grammarPoint` ASCENDENTE
 * (deterministico). NON filtra via i punti a tasso 0: si mostrano TUTTI i punti
 * praticati (coerente con 5.1/5.2, che includono gli zeri).
 *
 * Log vuoto ⇒ `[]` (nessuna voce): la vista rende un placeholder testuale neutro,
 * non un riquadro di grafico vuoto (la ricca dichiarazione «cosa manca» e la 5.4).
 */
export function grammarPointErrorRates(
  log: readonly ReviewLogRecord[],
): readonly GrammarPointErrorRate[] {
  if (log.length === 0) return [];

  // Aggrega per grammarPoint (denormalizzato dal log, mai per exerciseId): total di
  // tutte le risposte, errors delle sole `again`.
  const byPoint = new Map<string, { total: number; errors: number }>();
  for (const record of log) {
    const bucket = byPoint.get(record.grammarPoint);
    if (bucket) {
      bucket.total += 1;
      if (record.outcome === 'again') bucket.errors += 1;
    } else {
      byPoint.set(record.grammarPoint, {
        total: 1,
        errors: record.outcome === 'again' ? 1 : 0,
      });
    }
  }

  const rates: GrammarPointErrorRate[] = [];
  for (const [grammarPoint, { total, errors }] of byPoint) {
    rates.push({ grammarPoint, total, errors, errorRate: errors / total });
  }

  // Ordine: errorRate desc, poi total desc, poi grammarPoint asc (deterministico).
  rates.sort((a, b) => {
    if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
    if (b.total !== a.total) return b.total - a.total;
    return a.grammarPoint < b.grammarPoint ? -1 : a.grammarPoint > b.grammarPoint ? 1 : 0;
  });

  return rates;
}
