// Livello features/lessons: la lezione di ogni esercizio (07-10-2026), per la
// libreria, i traguardi e il riepilogo dello zero. È contenuto, uguale per tutti:
// una chiave globale, come `['lessons']`, condivisa da tutte le schermate.
import { useQuery } from '@tanstack/react-query';
import { usePorts } from '../ports/PortsContext';

export const EXERCISE_LESSONS_QUERY_KEY = ['exerciseLessons'] as const;

/** `enabled` falso rimanda la lettura (la sessione la vuole solo allo zero). */
export function useExerciseLessons(enabled = true) {
  const { content } = usePorts();
  return useQuery({
    queryKey: EXERCISE_LESSONS_QUERY_KEY,
    enabled,
    queryFn: () => content.listExerciseLessons(),
  });
}
