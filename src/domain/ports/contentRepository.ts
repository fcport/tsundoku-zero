// Livello domain: la PORTA del CONTENUTO in sola lettura come tipi PURI (AD-1/
// AD-2). Nessun import esterno: il dominio non conosce React,
// @supabase/supabase-js, fetch né SQL. Solo src/data/ implementa questa porta
// (l'adattatore concreto è la storia 3.10); src/app/ la istanzia e la inietta
// nelle schermate di features (features NON importa data).
//
// Il curriculum è CONTENUTO (tabelle `lesson`/`exercise` di 3.7): sola lettura a
// runtime. La porta espone un `LessonSummary` SNELLO — l'identità, l'ordine, il
// titolo bilingue e i punti grammaticali — non la forma di dominio grezza della
// lezione: le schermate del ciclo (dashboard/progresso curriculum) hanno bisogno
// di elencare le lezioni, non del loro payload di esercizi.

import type { BilingualText } from '../bilingual';

/**
 * Vista SNELLA di una lezione per il ciclo di ripasso: l'identità (`id`, lo slug
 * derivato dal punto grammaticale primario), l'ordine di studio (`ordinal`), il
 * titolo BILINGUE (`../bilingual`, stessa forma e stesso ripiego dichiarato della
 * spiegazione, FR8.5) e i punti grammaticali insegnati. NON porta gli esercizi:
 * la sessione li legge per proprio conto (storie future).
 */
export interface LessonSummary {
  readonly id: string;
  readonly ordinal: number;
  readonly title: BilingualText;
  readonly grammarPoints: readonly string[];
}

/**
 * Porta del contenuto in sola lettura dichiarata dal dominio (AD-2).
 * L'adattatore concreto vive in src/data/ ed è l'unico a conoscere Supabase e la
 * tabella `lesson`.
 */
export interface ContentRepository {
  /**
   * Legge il curriculum ORDINATO per `ordinal`. Il titolo di ogni lezione è
   * bilingue (`it` OMESSO quando la colonna è `null`). Sola lettura: nessuna
   * scrittura, nessun filtro per-utente (il contenuto è lo stesso per tutti).
   */
  listLessons(): Promise<readonly LessonSummary[]>;
}
