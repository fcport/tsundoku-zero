// Livello app (AD-1): la fonte UNICA dei path dell'applicazione. Costanti pure,
// nessun import: nessuna stringa di path sparsa nel routing/guard. La rotta
// pubblica di Accesso e la radice protetta sono le sole due ancore note in
// Epic 1; le rotte vere (dashboard/sessione/statistiche/impostazioni) arrivano
// in Epic 3/5 e sostituiranno il catch-all, non queste costanti.

/** Rotta pubblica di Accesso (bersaglio del redirect per i non autenticati). */
export const LOGIN_PATH = '/login';

/** Radice protetta (bersaglio del redirect per gli autenticati sulla rotta pubblica). */
export const ROOT_PATH = '/';
