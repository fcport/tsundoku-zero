// Livello data (AD-2): il FALLIMENTO TIPIZZATO che gli adattatori di LETTURA del
// ciclo di ripasso (Content/Review/Progress) lanciano su qualunque errore
// Supabase o riga malformata. Alimentano TanStack Query, i cui stati di
// errore/retry esigono una promise RIFIUTATA: un valore degradato (`null`/`[]`)
// si spaccerebbe per «caricato, vuoto» e nasconderebbe un fallimento reale.
//
// È l'OPPOSTO deliberato del confine TOTALE di AuthGateway/AccountGateway/
// SettingsRepository, che INGOIANO gli errori (FR1.5 mappa a `reason` di dominio,
// ripiego i18n): lavori diversi, contratti diversi. `DataError` governa SOLO le
// nuove porte-repository del ciclo, non un retrofit di quegli adattatori.

/**
 * Errore tipizzato di un adattatore di lettura del ciclo. È `instanceof Error`,
 * ha `name === 'DataError'`, porta l'`operation` che è fallita (es. `'listDue'`)
 * e preserva la CAUSA sottostante (l'errore Supabase o la ragione della riga
 * malformata) via l'opzione standard `cause`. Così il consumatore sa QUALE
 * lettura ha fallito e può risalire alla causa originale senza che una stringa
 * grezza del vendor si spacci per un valore di dominio.
 */
export class DataError extends Error {
  /** L'operazione della porta che è fallita (es. `'listLessons'`, `'listDue'`). */
  readonly operation: string;

  constructor(operation: string, cause?: unknown) {
    // `cause` è l'opzione standard di ErrorOptions: preserva l'errore
    // sottostante per la diagnosi, senza esporlo come valore di dominio.
    super(`data operation failed: ${operation}`, { cause });
    this.name = 'DataError';
    this.operation = operation;
  }
}
