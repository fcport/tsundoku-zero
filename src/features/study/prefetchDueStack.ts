// Livello features/study (4.1): il PRECARICO atomico della sessione. Glue di
// feature PURA e testabile (modello di `submitSignOut`/`changeLessonsPerDay`):
// nessun hook interno, riceve il `QueryClient` e le porte come parametri, così
// l'app la cabla e un test la esercita senza React.
//
// Oggi la sessione carica in DUE passi reattivi dopo il mount di `SessionScreen`:
// query `['due', userId]` → effetto `start(dueIds)` → query `['exercises', ids]`.
// Se il campo cade nella finestra fra i due passi la sessione resta a scheletro.
// Qui il precarico carica in UN colpo l'intera pila dovuta PIÙ il contenuto (e le
// spiegazioni, già dentro `ExerciseContent.exercise`) PRIMA di navigare a
// `/studia`: la sessione poi legge solo cache calda, avanzare non tocca la rete.
//
// SOLA AUTORITÀ della pila (AD-5): la pila si interroga con `dueQueryKey(userId)`
// importata verbatim dal dominio — MAI un letterale `['due'` (sonda
// `due-sole-authority.test.ts`). Riusando la STESSA chiave e `ensureQueryData`
// (che ritorna il valore in cache senza refetch se presente), il numero mostrato
// dalla dashboard e la pila caricata dalla sessione non possono divergere.
//
// AD-1: features NON importa react-router né `src/data`. Il precarico non naviga —
// la navigazione resta nel livello app (`AuthenticatedShell`). Riceve solo porte
// pure e il QueryClient.
import type { QueryClient } from '@tanstack/react-query';
import { dueQueryKey } from '../../domain/due';
import type { Clock } from '../../domain/ports/clock';
import type { ContentRepository } from '../../domain/ports/contentRepository';
import type { ReviewRepository } from '../../domain/ports/reviewRepository';
import { exercisesQueryKey } from './exercisesQueryKey';

/**
 * Il sottoinsieme di porte che il precarico consuma: la pila dei dovuti
 * (`review.listDue`), il contenuto (`content.listExercisesByIds`) e l'orologio
 * (`clock.now`) per l'istante di dovutezza. Tipato sulle interfacce PURE del
 * dominio: non conosce Supabase né gli adattatori concreti.
 */
export interface PrefetchPorts {
  readonly review: Pick<ReviewRepository, 'listDue'>;
  readonly content: Pick<ContentRepository, 'listExercisesByIds'>;
  readonly clock: Pick<Clock, 'now'>;
}

/**
 * Precarica l'intera pila dovuta con contenuto e spiegazioni PRIMA della
 * navigazione alla sessione (4.1).
 *
 * - `userId` null ⇒ no-op immediato (nessuna chiamata di porta).
 * - RIUSA la pila `['due', userId]` via `ensureQueryData` (cache-hit senza
 *   refetch se già popolata dal conteggio della dashboard; altrimenti chiama
 *   `listDue(clock.now())`).
 * - Deriva gli id dalla pila e precarica il contenuto sotto `['exercises', ids]`
 *   con la STESSA forma di chiave che `SessionScreen` costruisce
 *   (`['exercises', initialIds]`, `initialIds = dueData.map(s => s.exerciseId)`),
 *   così la sessione ottiene un cache-hit.
 * - `ids` vuoto ⇒ `listExercisesByIds([])` ritorna `[]` SENZA query (contratto
 *   della porta).
 *
 * Contenuto e spiegazione in UN solo batch: la spiegazione è già dentro
 * `ExerciseContent.exercise`, nessuna seconda richiesta. Il chiamante (il livello
 * app) gestisce il degrado grazioso — su reject naviga comunque, la sessione
 * ripiega sul caricamento reattivo esistente.
 */
export async function prefetchDueStack(
  queryClient: QueryClient,
  ports: PrefetchPorts,
  userId: string | null,
): Promise<void> {
  if (userId === null) return;
  const states = await queryClient.ensureQueryData({
    queryKey: dueQueryKey(userId),
    queryFn: () => ports.review.listDue(ports.clock.now()),
  });
  const ids = states.map((s) => s.exerciseId);
  await queryClient.ensureQueryData({
    queryKey: exercisesQueryKey(ids),
    queryFn: () => ports.content.listExercisesByIds(ids),
  });
}
