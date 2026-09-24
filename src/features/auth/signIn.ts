// Livello features/auth: orchestrazione PURA dell'accesso. Gemello totale di
// `submitSignUp` sulla porta `signIn`: riceve la porta AuthGateway INIETTATA
// (features non importa data, AD-1) e la traduce nella stessa forma d'esito
// (./authOutcome), riusando l'unico traduttore `authFailureMessage`.
//
// AC2 (non rivelare l'esistenza dell'email) è STRUTTURALE: password errata ed
// email inesistente collassano entrambe su `invalid_credentials → wrong-password
// → "Password errata."` (campo password). Nessun messaggio distinto per "email
// non trovata".
import type { AuthGateway, Credentials } from '../../domain/ports/authGateway';
import { authFailureMessage } from './authFailureMessage';
import type { AuthSubmitOutcome } from './authOutcome';

/**
 * Invia le credenziali attraverso la porta `signIn` e traduce l'esito. Su
 * successo l'utente atterra autenticato; su fallimento, l'unico traduttore mappa
 * il `reason` di dominio in un messaggio ancorato al campo colpevole
 * (`wrong-password → campo password`).
 *
 * Il confine è TOTALE: se la porta LANCIA (rete caduta), l'esito è comunque un
 * fallimento tradotto (`unknown` a livello form) invece di una promise
 * rifiutata. Non maschera un SignInResult risolto: cattura solo i throw.
 */
export async function submitSignIn(
  gateway: AuthGateway,
  credentials: Credentials,
): Promise<AuthSubmitOutcome> {
  let result;
  try {
    result = await gateway.signIn(credentials);
  } catch {
    return { ok: false, message: authFailureMessage('unknown') };
  }
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, message: authFailureMessage(result.reason) };
}
