// Livello features/lessons: lo SBLOCCO di una lezione, via porta
// (`progress.unlockLesson`, scrittura atomica/idempotente, MAI `data` diretto, AD-1).
// L'istante entra dal Clock. Al successo il read-model si RI-DERIVA: la pila, gli
// arretrati rinviati, le sbloccate e i conteggi per lezione. Quale lezione sbloccare
// lo decide il dominio (`nextLessonToUnlock`): chi chiama passa solo quell'`id`.
// Lo usano la dashboard (a pila vuota) e la pagina Lezioni (anche a pila piena).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dueQueryKey } from '../../domain/due';
import { usePorts } from '../ports/PortsContext';
import { activeExercisesQueryKey } from './useAddLessonExercises';

/** La mutazione: `mutate(lessonId)`. */
export function useUnlockLesson(userId: string | null) {
  const { progress, clock } = usePorts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => progress.unlockLesson(lessonId, clock.now()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dueQueryKey(userId ?? '') });
      void queryClient.invalidateQueries({ queryKey: ['postponed', userId] });
      void queryClient.invalidateQueries({ queryKey: ['unlocked', userId] });
      void queryClient.invalidateQueries({ queryKey: activeExercisesQueryKey(userId) });
    },
  });
}
