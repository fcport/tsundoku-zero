// Livello features/lessons: «Esercitati di più». Porta nella pila i prossimi
// esercizi in riserva di una lezione sbloccata, via porta (`progress.addLessonExercises`,
// MAI `data` diretto, AD-1). L'istante entra dal Clock. Al successo il read-model si
// RI-DERIVA: la pila (`dueQueryKey`) e i conteggi per lezione (`['activeExercises']`).
// Lo usano la pagina Lezioni e la dashboard a pila vuota.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dueQueryKey } from '../../domain/due';
import { usePorts } from '../ports/PortsContext';

/** La chiave dei conteggi per lezione degli esercizi già in pila. */
export function activeExercisesQueryKey(userId: string | null) {
  return ['activeExercises', userId] as const;
}

/** Per lezione, quanti esercizi sono già in pila (`undefined` finché carica). */
export function useActiveExerciseCounts(userId: string | null) {
  const { progress } = usePorts();
  return useQuery({
    queryKey: activeExercisesQueryKey(userId),
    enabled: !!userId,
    queryFn: () => progress.listActiveExerciseCounts(),
  });
}

/** La mutazione: `mutate(lessonId)`; `data` è quanti esercizi sono entrati. */
export function useAddLessonExercises(userId: string | null) {
  const { progress, clock } = usePorts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => progress.addLessonExercises(lessonId, clock.now()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dueQueryKey(userId ?? '') });
      void queryClient.invalidateQueries({ queryKey: activeExercisesQueryKey(userId) });
    },
  });
}
