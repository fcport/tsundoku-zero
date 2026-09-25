// Livello features: il SEAM di iniezione delle porte del dominio per le schermate
// del ciclo di ripasso (dashboard→sessione→card, 3.11-3.23). Archi ammessi:
// features→domain (le porte) e features→react. features NON importa data (AD-1):
// gli adattatori Supabase concreti nascono in app e arrivano come porte iniettate
// da `PortsProvider`.
//
// Perché un CONTESTO invece del prop-drilling: l'auth usava le props perché il suo
// albero è basso (AuthRoot→AppRoutes); il ciclo di ripasso è PROFONDO, e passare
// quattro porte come props sarebbe rumore. `usePorts` LANCIA fuori dal provider —
// un provider mancante è un crash RUMOROSO, non un `undefined` silenzioso.
//
// NON cablato in main.tsx qui: nessun componente di produzione lo consuma finché
// non arriva la dashboard (3.12); il cablaggio alla composition root nasce col
// primo consumatore (dichiarazione-in-anticipo, come `reviewRepository` fu fissata
// prima del suo adattatore).
import { createContext, useContext, type ReactNode } from 'react';
import type { Clock } from '../../domain/ports/clock';
import type { ContentRepository } from '../../domain/ports/contentRepository';
import type { ReviewRepository } from '../../domain/ports/reviewRepository';
import type { ProgressRepository } from '../../domain/ports/progressRepository';

/**
 * Le porte del ciclo di ripasso, raccolte in un solo oggetto INIETTABILE. Tipate
 * sulle interfacce PURE del dominio: il contesto non conosce Supabase né gli
 * adattatori concreti. `app` compone le implementazioni reali; un test inietta
 * porte in memoria.
 */
export interface Ports {
  readonly clock: Clock;
  readonly content: ContentRepository;
  readonly review: ReviewRepository;
  readonly progress: ProgressRepository;
}

// `null` è il sentinella «nessun provider»: distinto da qualunque `Ports` valido,
// così `usePorts` può lanciare invece di consegnare un oggetto rotto. Non
// esportato: i consumatori passano SOLO da `usePorts`, mai dal contesto grezzo.
const PortsContext = createContext<Ports | null>(null);

export interface PortsProviderProps {
  readonly value: Ports;
  readonly children: ReactNode;
}

/**
 * Fornisce le porte al sottoalbero. `app` lo monterà con gli adattatori Supabase
 * quando arriva il primo consumatore (3.12); un test lo monta con porte in
 * memoria.
 */
export function PortsProvider({ value, children }: PortsProviderProps) {
  return <PortsContext.Provider value={value}>{children}</PortsContext.Provider>;
}

/**
 * Legge le porte iniettate. LANCIA se chiamato fuori da un `PortsProvider`: un
 * provider mancante è un errore di programmazione (crash rumoroso al primo
 * render), non un `undefined` che si propaga silenzioso e rompe altrove.
 */
export function usePorts(): Ports {
  const ports = useContext(PortsContext);
  if (ports === null) {
    throw new Error('usePorts deve essere usato dentro un <PortsProvider>');
  }
  return ports;
}
