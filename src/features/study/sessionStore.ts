// Livello features/study (F4): lo STORE Zustand che ospita lo stato di sessione e
// non fa che DELEGARE al dominio (`AD-6`). Vive qui — non in `ui` — perché deve
// importare il dominio (`ui` non può; `features` sì). Nasce «muto»: nessuna logica
// di coda o di scheduling, così nessuna schermata futura (3.18+) sarà tentata di
// metterci decisioni che spettano al riduttore.
//
// NON è persistito per specifica: nessun `persist`, nessuno storage. La sessione è
// effimera — FR4.7 la ricostruisce dagli esercizi ancora dovuti — quindi un'istanza
// fresca parte a coda vuota. Lo store forwarda, il dominio decide.
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
  /** Inizia una nuova sessione dalla lista ordinata degli id (via `createSession`). */
  readonly start: (ids: readonly string[]) => void;
  /** Fa evolvere la sessione applicando un evento (via `sessionReducer`). */
  readonly dispatch: (event: SessionEvent) => void;
}

/**
 * Lo store, in forma CURRIED `create<SessionStore>()(...)` per l'inferenza TS di
 * Zustand v5. La sessione iniziale è vuota (`createSession([])`): senza persistenza,
 * ogni istanza fresca parte così. `start` la rimpiazza; `dispatch` la sostituisce
 * con il risultato del riduttore — lo store non calcola nulla da sé.
 */
export const useSessionStore = create<SessionStore>()((set) => ({
  session: createSession([]),
  start: (ids) => set(() => ({ session: createSession(ids) })),
  dispatch: (event) => set((s) => ({ session: sessionReducer(s.session, event) })),
}));
