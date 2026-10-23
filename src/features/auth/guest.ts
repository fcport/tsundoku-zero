// Livello features/auth: orchestrazione PURA della prova senza account (23-10-2026).
// Gemella di `submitSignIn`: riceve la porta INIETTATA (features non importa data,
// AD-1) e traduce l'esito nella stessa forma (./authOutcome), con l'unico
// traduttore `authFailureMessage`.
//
// Due passi: entrare come ospite (`submitGuest`) e, più tardi, salvare i progressi
// dell'ospite in un account con email e password (`submitSaveGuest`). Il confine è
// TOTALE: se la porta lancia, l'esito è `unknown` a livello form, mai un rifiuto.
import type { AuthGateway, AuthResult, Credentials } from '../../domain/ports/authGateway';
import { authFailureMessage } from './authFailureMessage';
import type { AuthSubmitOutcome } from './authOutcome';

async function outcomeOf(call: () => Promise<AuthResult>): Promise<AuthSubmitOutcome> {
  let result;
  try {
    result = await call();
  } catch {
    return { ok: false, message: authFailureMessage('unknown') };
  }
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, message: authFailureMessage(result.reason) };
}

/** Entra come ospite: l'app si apre subito, senza email né password. */
export function submitGuest(gateway: AuthGateway): Promise<AuthSubmitOutcome> {
  return outcomeOf(() => gateway.continueAsGuest());
}

/**
 * Salva l'ospite corrente in un account: stesso id, stessi progressi. Gli errori
 * sono quelli della registrazione (email già usata, password debole, ...).
 */
export function submitSaveGuest(
  gateway: AuthGateway,
  credentials: Credentials,
): Promise<AuthSubmitOutcome> {
  return outcomeOf(() => gateway.saveGuestAccount(credentials));
}
