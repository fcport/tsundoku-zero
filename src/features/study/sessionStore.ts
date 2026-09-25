// Livello features/study (F4): lo STORE Zustand che ospita lo stato di sessione e
// non fa che DELEGARE al dominio (`AD-6`). Vive qui — non in `ui` — perché deve
// importare il dominio (`ui` non può; `features` sì). Nasce «muto»: nessuna logica
// di coda o di scheduling, così nessuna schermata futura (3.18+) sarà tentata di
// metterci decisioni che spettano al riduttore.
//
// NON è persistito per specifica: nessun `persist`, nessuno storage. La sessione è
// effimera — FR4.7 la ricostruisce dagli esercizi ancora dovuti — quindi un'istanza
// fresca parte a coda vuota. Lo store forwarda, il dominio decide.
//
// La sessione si RICOSTRUISCE all'ingresso (3.20, deferred #1 di 3.19): lo store è
// un singleton di modulo che sopravvive allo smontaggio di `SessionScreen`, quindi
// `reset()` lo riporta alla forma iniziale all'USCITA da `/studia`. La prossima
// entrata rientra così nell'effetto `start` guardato (`initialIds.length === 0`) e
// riparte dalla pila FRESCA `['due']` — mai dalla coda precedente («riprendi dove
// eri» non esiste). `reset` DELEGA al dominio (`createSession([])`), come `start`.
import { create } from 'zustand';
import {
  createSession,
  sessionReducer,
  type SessionEvent,
  type SessionState,
} from '../../domain/session';

/**
 * La forma dello store: lo stato di sessione più le due azioni che lo fanno
 * evolvere. Entrambe DELEGANO al dominio — `start` a `createSession`, `dispatch` a
 * `sessionReducer` — senza toccare direttamente lo stato interno.
 */
export interface SessionStore {
  /** Lo stato di sessione corrente, opaco allo store: solo il dominio lo manipola. */
  readonly session: SessionState;
  /**
   * Il numero TOTALE di esercizi con cui la sessione è iniziata (dagli id di
   * `start`, 3.19). Resta FISSO per l'intera sessione: la barra di avanzamento
   * deriva il COMPLETATO come `total − remainingCount(session)`. `0` finché nessuna
   * sessione è iniziata.
   */
  readonly total: number;
  /**
   * Gli id INIZIALI della sessione (3.19), preservati anche mentre la coda si
   * accorcia. Ancorano la query degli esercizi (`['exercises', initialIds]`) così
   * non rifà fetch a ogni risposta: la coda di sessione è sempre un sottoinsieme di
   * questi id.
   */
  readonly initialIds: readonly string[];
  /** Inizia una nuova sessione dalla lista ordinata degli id (via `createSession`). */
  readonly start: (ids: readonly string[]) => void;
  /** Fa evolvere la sessione applicando un evento (via `sessionReducer`). */
  readonly dispatch: (event: SessionEvent) => void;
  /**
   * Azzera lo stato alla forma INIZIALE (coda vuota, `total` 0, `initialIds` `[]`):
   * la ricostruzione all'ingresso della 3.20 (deferred #1 di 3.19). Chiamata
   * all'USCITA da `/studia` (cleanup di `SessionScreen`) così la prossima entrata
   * riparte dalla pila fresca. DELEGA al dominio (`createSession([])`); tocca SOLO la
   * coda in memoria, mai la porta/DB (le risposte sono già persistite per-risposta).
   */
  readonly reset: () => void;
}

/**
 * Lo store, in forma CURRIED `create<SessionStore>()(...)` per l'inferenza TS di
 * Zustand v5. La sessione iniziale è vuota (`createSession([])`): senza persistenza,
 * ogni istanza fresca parte così. `start` la rimpiazza; `dispatch` la sostituisce
 * con il risultato del riduttore — lo store non calcola nulla da sé.
 */
export const useSessionStore = create<SessionStore>()((set) => ({
  session: createSession([]),
  total: 0,
  initialIds: [],
  start: (ids) =>
    set(() => ({
      session: createSession(ids),
      // `total`/`initialIds` catturati UNA volta agli id iniziali: la barra e la
      // query esercizi restano ancorate mentre la coda (`session`) si accorcia.
      total: ids.length,
      initialIds: [...ids],
    })),
  dispatch: (event) => set((s) => ({ session: sessionReducer(s.session, event) })),
  // Ricostruzione all'ingresso (3.20): torna alla forma iniziale — coda vuota, total
  // 0, initialIds []. Nessuna chiamata a porta/DB; solo la coda in memoria.
  reset: () => set(() => ({ session: createSession([]), total: 0, initialIds: [] })),
}));
