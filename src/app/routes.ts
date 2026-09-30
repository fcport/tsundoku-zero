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
 * osservabile dall'URL e realizza l'abbandono con «indietro» del browser (3.20). La
 * navigazione la cabla il livello app (`AuthenticatedShell` via `useNavigate` per
 * l'avvio; `AppRoutes` per l'uscita `onExit`→`ROOT_PATH`); le features non portano
 * stringhe di path.
 */
export const STUDY_PATH = '/studia';

/**
 * La rotta delle STATISTICHE (5.1): la prima vista di Epic 5 (FR7.1), una rotta
 * protetta VERA che affianca `/studia` prima del catch-all. Mostra le risposte per
 * giorno derivate dal solo `review_log`. La navigazione la cabla il livello app
 * (`AuthenticatedShell` via `useNavigate` per l'ingresso dalla dashboard;
 * `AppRoutes` per l'uscita `onExit`→`ROOT_PATH`, speculare alla sessione); le
 * features non portano stringhe di path.
 */
export const STATS_PATH = '/statistiche';

/**
 * La rotta della PRIVACY POLICY (7.1): l'UNICA rotta pubblica raggiungibile in
 * ENTRAMBI gli stati (anonimo — prima della registrazione — e autenticato). Vive
 * fuori da entrambe le guardie in `AppRoutes`, dichiarata come figlio DIRETTO di
 * `<Routes>` così il match statico `/privacy` batte il catch-all `*`. La
 * navigazione la cabla il livello app (`AppRoutes` per il collegamento sul login e
 * per l'uscita `onExit`; `AuthenticatedShell` per il collegamento nelle
 * Impostazioni); le features non portano stringhe di path.
 */
export const PRIVACY_PATH = '/privacy';

/**
 * La rotta dei RICONOSCIMENTI (7.2): la SECONDA rotta pubblica raggiungibile in
 * ENTRAMBI gli stati (anonimo e autenticato), gemella di `/privacy`. Vive fuori da
 * entrambe le guardie in `AppRoutes`, dichiarata come figlio DIRETTO di `<Routes>`
 * così il match statico `/riconoscimenti` batte il catch-all `*`. Il percorso NON
 * porta il nome della fonte (è `/riconoscimenti`, non `/cure-dolly`): il nome della
 * fonte resta confinato al CONTENUTO della pagina, mai nell'identità/URL. La
 * navigazione la cabla il livello app (`AppRoutes` per il collegamento sul login e
 * per l'uscita `onExit`; `AuthenticatedShell` per il collegamento nelle
 * Impostazioni); le features non portano stringhe di path.
 */
export const ACKNOWLEDGEMENTS_PATH = '/riconoscimenti';

/**
 * La rotta delle IMPOSTAZIONI: lingua, tetto giornaliero di sblocco, collegamenti
 * legali e cancellazione dell'account. Prima vivevano in coda alla dashboard, dove
 * sommergevano l'unica cosa che conta lì (la pila da svuotare); ora la dashboard
 * porta solo un collegamento. Protetta, cablata dal livello app come le altre.
 */
export const SETTINGS_PATH = '/impostazioni';

/**
 * La rotta dell'ALLENAMENTO LIBERO sulle forme del verbo: fuori dalla pila, senza
 * progresso salvato. Protetta come le altre, raggiunta dalla dashboard.
 */
export const DRILL_PATH = '/allenamento';

/**
 * La rotta delle LEZIONI: tutto il curriculum con lo stato di ciascuna lezione, il
 * video e l'ingresso al ripasso libero. Protetta, raggiunta dalla dashboard.
 */
export const LESSONS_PATH = '/lezioni';

/**
 * Il ripasso libero di UNA lezione, fuori dalla pila: `/lezioni/:lessonId`. L'id è
 * uno slug che può contenere kana e kanji, quindi va codificato nel path.
 */
export const LESSON_PRACTICE_PATH = `${LESSONS_PATH}/:lessonId`;

/** Il path concreto del ripasso libero di una lezione. */
export function lessonPracticePath(lessonId: string): string {
  return `${LESSONS_PATH}/${encodeURIComponent(lessonId)}`;
}
