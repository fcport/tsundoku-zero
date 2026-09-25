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

  /**
   * SBLOCCA una lezione per l'utente corrente: scrittura ATOMICA e IDEMPOTENTE
   * via la RPC `unlock_lesson` (storia 3.13). Materializza in un colpo solo la
   * riga `lesson_progress` e una riga `review_state` per ciascun esercizio della
   * lezione (`stage = 0`, `due_at` = istante di sblocco), tutte lette server-side.
   * Ri-invocarla NON duplica righe (`on conflict do nothing`).
   *
   * `now` è INIETTATO dal Clock (AD-1): il dominio non legge l'orologio, e
   * l'istante diventa `unlocked_at`/`due_at`. Su fallimento RIFIUTA con un
   * `DataError` (mirror del contratto d'errore delle letture: reject, non valore
   * degradato). La SCELTA di quale lezione sbloccare è del dominio
   * (`nextLessonToUnlock`): questa porta materializza solo l'`id` ricevuto.
   */
  unlockLesson(lessonId: string, now: Date): Promise<void>;
}
