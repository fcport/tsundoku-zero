// Livello domain: la PORTA del PROGRESSO (curriculum sbloccato) come tipo PURO
// (AD-1/AD-2). Nessun import esterno: il dominio non conosce React,
// @supabase/supabase-js, fetch né SQL. Solo src/data/ implementa questa porta
// (l'adattatore concreto è la storia 3.10); src/app/ la istanzia e la inietta
// nelle schermate di features (features NON importa data).
//
// Legge `lesson_progress` (storia 3.8): l'insieme delle lezioni che l'utente
// corrente ha sbloccato. «Mai sbloccata» = assenza di riga (AD-19), quindi
// l'assenza di un id nella lista è essa stessa l'informazione. Isolata per riga
// da RLS (l'utente vede solo il proprio progresso). Opera sull'utente corrente,
// senza parametro `userId`.

/**
 * Porta del progresso del curriculum dichiarata dal dominio (AD-2).
 * L'adattatore concreto vive in src/data/ ed è l'unico a conoscere Supabase e la
 * tabella `lesson_progress`.
 */
export interface ProgressRepository {
  /**
   * Legge gli id delle lezioni SBLOCCATE dall'utente corrente. Un id assente
   * dalla lista significa «mai sbloccata» (assenza di riga, AD-19). Opera
   * sull'utente corrente, senza parametro `userId`.
   */
  listUnlockedLessonIds(): Promise<readonly string[]>;
}
