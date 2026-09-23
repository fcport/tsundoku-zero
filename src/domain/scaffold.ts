// Livello domain: logica pura, nessuna dipendenza esterna (AD-1).
// Non importa react né @supabase/supabase-js, non usa fetch/storage/clock.
// Questa funzione banale esiste per dimostrare che i test unitari girano
// e per dare al grafo delle dipendenze un nodo reale al vertice.

/**
 * Nome canonico del prodotto. Funzione pura senza effetti collaterali.
 */
export function projectName(): string {
  return 'Tsundoku Zero';
}
