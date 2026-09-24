// Livello features/auth: orchestrazione PURA della disconnessione. Riceve la
// porta AuthGateway INIETTATA (features non importa data, AD-1) e invoca
// `signOut` con confine TOTALE.
//
// Il confine è totale a due livelli: la porta già non rifiuta mai (data), ma qui
// avvolgiamo comunque in try/catch così che, anche se un finto mal costruito
// lanciasse, `submitSignOut` risolva sempre `void` e mai propaghi un reject. Lo
// stato torna `anonymous` a cura del chiamante (AuthRoot).
import type { AuthGateway } from '../../domain/ports/authGateway';

/**
 * Invoca la disconnessione attraverso la porta. Confine TOTALE: risolve sempre
 * `void`, mai reject.
 */
export async function submitSignOut(gateway: AuthGateway): Promise<void> {
  try {
    await gateway.signOut();
  } catch {
    // Confine totale: nessuna propagazione. Il chiamante porta lo stato ad
    // `anonymous` a prescindere.
  }
}
