// Livello features/account: orchestrazione PURA della cancellazione account.
// Riceve la porta AccountGateway INIETTATA (features non importa data, AD-1) e
// invoca `deleteAccount` con confine TOTALE. Modello: features/auth/signOut.ts.
//
// Il confine è totale a due livelli: la porta già non rifiuta mai (data), ma qui
// avvolgiamo comunque in try/catch così che, anche se un finto mal costruito
// lanciasse, `submitDeleteAccount` inoltri sempre un `AccountDeletionResult` di
// dominio e mai propaghi un reject. La transizione di vista (torna anonimo su
// `ok`) vive a cura del chiamante (app/AuthRoot), non qui.
import type {
  AccountDeletionResult,
  AccountGateway,
} from '../../domain/ports/accountGateway';

/**
 * Invoca la cancellazione attraverso la porta e ne INOLTRA l'esito. Confine
 * TOTALE: un throw del gateway (finto mal costruito) degrada a
 * `{ ok:false, reason:'unknown' }` — risolve sempre, mai reject.
 */
export async function submitDeleteAccount(
  account: AccountGateway,
): Promise<AccountDeletionResult> {
  try {
    return await account.deleteAccount();
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
