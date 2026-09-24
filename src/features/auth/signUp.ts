// Livello features/auth: orchestrazione PURA del signup. Riceve la porta
// AuthGateway INIETTATA (features non importa data, AD-1) e la traduce in un
// esito pronto per la presentazione: o `{ ok:true }`, o `{ ok:false }` con il
// messaggio già ancorato al campo responsabile.
//
// È testabile con un finto gateway iniettato, senza rete né Supabase: la logica
// di commutazione della vista e l'ancoraggio del messaggio si verificano
// meccanicamente. La forma d'esito e il dispatch sono CONDIVISI con l'accesso
// (./authOutcome).
import type { AuthGateway, Credentials } from '../../domain/ports/authGateway';
import { authFailureMessage } from './authFailureMessage';
import type { AuthSubmitOutcome } from './authOutcome';

/**
 * Invia le credenziali attraverso la porta e traduce l'esito. Su successo
 * l'utente atterra autenticato (la schermata invocherà `onAuthenticated`); su
 * fallimento, l'unico traduttore mappa il `reason` di dominio in un messaggio
 * ancorato al campo colpevole.
 *
 * Il confine è TOTALE: se la porta LANCIA (rete caduta, errore imprevisto che
 * auth-js rilancia), l'esito è comunque un fallimento tradotto (`unknown` a
 * livello form) invece di una promise rifiutata — mai uno stato bloccato senza
 * messaggio. Non maschera un SignUpResult risolto: cattura solo i throw.
 */
export async function submitSignUp(
  gateway: AuthGateway,
  credentials: Credentials,
): Promise<AuthSubmitOutcome> {
  let result;
  try {
    result = await gateway.signUp(credentials);
  } catch {
    return { ok: false, message: authFailureMessage('unknown') };
  }
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, message: authFailureMessage(result.reason) };
}
