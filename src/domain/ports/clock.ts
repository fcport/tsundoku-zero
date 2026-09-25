// Livello domain: la PORTA dell'OROLOGIO come tipo PURO (AD-1). Nessun import
// esterno: il dominio non conosce React, @supabase/supabase-js, fetch né la
// piattaforma. Solo src/data/ implementa questa porta (l'adattatore concreto è
// `systemClock`, storia 3.10); src/app/ la istanzia e la inietta nelle schermate
// di features (features NON importa data).
//
// Il dominio non legge MAI l'orologio: ogni funzione temporale (`schedule`,
// `isDue`, `streak`) riceve `now: Date` iniettato (AD-1 vieta `new Date()` sotto
// src/domain/). Questa porta è il SEAM che procura quel `now` senza che il
// dominio conosca la piattaforma: `src/data/` ritorna `new Date()`, un test
// inietta un istante fisso.

/**
 * Porta dell'orologio dichiarata dal dominio (AD-1). L'adattatore concreto
 * (`systemClock`) vive in src/data/ ed è l'unico a leggere l'orologio di
 * piattaforma (`new Date()`). Il seam per ottenere «now» senza che il dominio
 * lo legga.
 */
export interface Clock {
  /** L'istante corrente. In produzione `new Date()`; nei test un valore fisso. */
  now(): Date;
}
