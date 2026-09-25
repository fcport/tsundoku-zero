// Livello app (AD-1): la fonte UNICA dei path dell'applicazione. Costanti pure,
// nessun import: nessuna stringa di path sparsa nel routing/guard. La rotta
// pubblica di Accesso e la radice protetta sono le sole due ancore note in
// Epic 1; le rotte vere (dashboard/sessione/statistiche/impostazioni) arrivano
// in Epic 3/5 e sostituiranno il catch-all, non queste costanti.

/** Rotta pubblica di Accesso (bersaglio del redirect per i non autenticati). */
export const LOGIN_PATH = '/login';

/** Radice protetta (bersaglio del redirect per gli autenticati sulla rotta pubblica). */
export const ROOT_PATH = '/';

/**
 * La rotta della SESSIONE di esercizi (3.18): la prima rotta VERA che sostituisce
 * parte del catch-all. Una rotta reale (non uno stato locale) rende il ciclo
 * osservabile dall'URL e prepara l'abbandono con «indietro» di 3.20. La navigazione
 * la cabla il livello app (`AuthenticatedShell` via `useNavigate`); le features non
 * portano stringhe di path.
 */
export const STUDY_PATH = '/studia';
