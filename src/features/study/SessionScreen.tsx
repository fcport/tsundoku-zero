// Livello features/study: la PRIMA schermata di sessione (3.18). Possiede l'UNICO
// `<main>` di `/studia`, lo `useState` di `selected` (senso unico), e presenta UN
// esercizio per volta via `<ExerciseCard>`. AD-1: importa domain/ui/i18n/@tanstack/
// react-query, MAI data — le porte arrivano da `usePorts()`; l'`userId` è una prop
// (l'app lo risolve).
//
// Legge la STESSA chiave della pila della dashboard (`dueQueryKey`, AD-5): niente id
// passati per router-state, nessuna pila ricalcolata. Da `['due', userId]` deriva la
// coda ORDINATA degli id (chiavi di RIGA DB), poi carica gli esercizi completi via
// `content.listExercisesByIds` sotto la chiave `['exercises', dueIds]`. L'esercizio
// CORRENTE è letto dal dominio puro `currentExerciseId(createSession(dueIds))` (MAI
// indicizzando la coda): niente store Zustand in questa storia (l'avanzamento è 3.19).
//
// FUORI SCOPE (3.19+): esito/spiegazione/persistenza/avanzamento, barra/abbandono,
// completamento, contratto tastiera, responsive.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dueQueryKey } from '../../domain/due';
import { createSession, currentExerciseId } from '../../domain/session';
import { usePorts } from '../ports/PortsContext';
import { ExerciseCard } from './ExerciseCard';

export interface SessionScreenProps {
  /**
   * L'id dell'utente corrente, risolto dall'app. `null` finché non è risolto: la
   * schermata mostra lo scheletro, senza ramo speciale (stesso pattern dashboard).
   */
  readonly userId: string | null;
}

// Altezza CONDIVISA fra scheletro, stato neutro e card: la stessa classe sul <main>
// nei vari rami evita salti di layout (stesso pattern della dashboard). Una sola
// definizione così i rami non divergono.
const CONTAINER_HEIGHT = 'min-h-[24rem]';

export function SessionScreen({ userId }: SessionScreenProps) {
  const { content, review, clock } = usePorts();
  // Lo stato `selected` (senso unico): l'INDICE dell'opzione scelta, `null` =
  // consegna, non-null = risposta data. L'identità è la POSIZIONE (non il testo),
  // così opzioni di testo duplicato non premono più bottoni insieme. Vive QUI (il
  // container), la card è controllata. L'esito/avanzamento è 3.19.
  const [selected, setSelected] = useState<number | null>(null);

  // La pila dei dovuti: chiave di DOMINIO verbatim (AD-5), `enabled: !!userId`.
  const dueQ = useQuery({
    queryKey: dueQueryKey(userId ?? ''),
    enabled: !!userId,
    queryFn: () => review.listDue(clock.now()),
  });

  // Gli id ORDINATI della coda (chiavi di riga). Derivati dallo stato dovuti letto,
  // `[]` finché la pila non è caricata.
  const dueIds = dueQ.data?.map((state) => state.exerciseId) ?? [];

  // Gli esercizi completi per gli id della pila. `enabled` SOLO quando la pila è
  // caricata (dueQ.data definito) E non vuota: `listExercisesByIds([])` sarebbe una
  // query degenere (il port corto-circuita, ma non la accendiamo affatto). La chiave
  // include gli id così due pile diverse hanno cache distinte.
  const exercisesQ = useQuery({
    queryKey: ['exercises', dueIds],
    enabled: dueQ.data !== undefined && dueIds.length > 0,
    queryFn: () => content.listExercisesByIds(dueIds),
  });

  // Scheletro finché l'id non è risolto o la pila è ancora pending (stesso pattern
  // della dashboard): stessa altezza, nessuno spinner, `aria-busy` per l'AT.
  if (!userId || dueQ.data === undefined) {
    return (
      <main
        aria-busy="true"
        className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`}
      >
        <div className="h-[20px] w-48 rounded-md bg-surface-sunken" />
        <div className="h-[40px] w-64 rounded-md bg-surface-sunken" />
        <div className="h-14 w-full rounded-md bg-surface-sunken" />
        <div className="h-14 w-full rounded-md bg-surface-sunken" />
      </main>
    );
  }

  // Pila vuota (deep-link): stato neutro senza card. Il completamento (schermata di
  // zero) è 3.21: qui si dichiara solo l'assenza di esercizio corrente.
  const currentId = currentExerciseId(createSession(dueIds));
  if (currentId === null) {
    return (
      <main className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`} />
    );
  }

  // La pila non è vuota ma gli esercizi non sono ancora caricati: scheletro (la
  // query è enabled, sta risolvendo).
  if (exercisesQ.data === undefined) {
    return (
      <main
        aria-busy="true"
        className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`}
      >
        <div className="h-[20px] w-48 rounded-md bg-surface-sunken" />
        <div className="h-[40px] w-64 rounded-md bg-surface-sunken" />
        <div className="h-14 w-full rounded-md bg-surface-sunken" />
        <div className="h-14 w-full rounded-md bg-surface-sunken" />
      </main>
    );
  }

  // Mappa id di RIGA → esercizio (l'ordine del port non è garantito): la card legge
  // l'esercizio CORRENTE per id, mai per posizione.
  const current = exercisesQ.data.find((c) => c.id === currentId);
  // Id corrente assente dal caricato (bordo di contenuto): stato neutro senza card.
  if (current === undefined) {
    return (
      <main className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`} />
    );
  }

  return (
    <main className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`}>
      <ExerciseCard
        exercise={current.exercise}
        selected={selected}
        onSelect={setSelected}
      />
    </main>
  );
}
