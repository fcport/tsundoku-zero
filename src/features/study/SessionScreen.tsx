// Livello features/study (3.19): l'ORCHESTRAZIONE della sessione. Possiede l'UNICO
// `<main>` di `/studia`, la fase locale (`consegna`↔`spiegazione`), `selected`/
// `usedExplanation`, la mutation di persistenza, lo store e la barra. AD-1: importa
// domain/ui/i18n/@tanstack/react-query/zustand, MAI data — le porte arrivano da
// `usePorts()`; l'`userId` è una prop; `crypto.randomUUID` vive SOLO qui (glue di
// feature, mai nel dominio).
//
// Chiude il ciclo «rispondi → sai perché → resta registrato»:
// - Legge la pila `['due', userId]` (chiave di DOMINIO verbatim, AD-5); avvia lo
//   store (`start(dueIds)`) al primo caricamento (effetto guardato).
// - Corrente da `currentExerciseId(session)`; esercizi da `['exercises', initialIds]`
//   (ancorata agli id INIZIALI dello store: niente refetch a ogni risposta).
// - Gestore risposta: compose→check→outcomeOf→schedule→`review_id`→`dispatch`
//   (barra ottimistica)→`mutate` (conteggio ottimistico via onMutate/isDue).
// - `ProgressMeter` dallo store; azione «prossimo esercizio».
//
// ABBANDONO e RICOSTRUZIONE (3.20): «potersene andare» e «riprendere non costa
// nulla». Un listener Esc a livello window PIÙ un'affordance «esci» in-app → `onExit`
// (prop cablata dal livello app con `useNavigate`, AD-1: nessun react-router nelle
// features). All'USCITA (unmount) un cleanup chiama `reset()` sullo store singleton,
// così la prossima entrata riparte dalla pila FRESCA `['due']` (ricostruzione, non
// ripristino, deferred #1 di 3.19). L'abbandono non perde nulla per COSTRUZIONE: la
// persistenza è per-risposta e idempotente (3.19), `reset` tocca solo la coda in
// memoria. La barra resta SEMPRE visibile nel ramo attivo (AC1).
//
// ARRIVARE A ZERO (3.21): quando la coda si svuota DOPO una sessione avviata
// (`currentId === null && total > 0`), il ramo a coda vuota rende una schermata di
// completamento SOBRIA — una conferma di aver finito PIÙ lo streak AGGIORNATO (stessa
// chiave `['streak', userId]` della dashboard, derivato dalla funzione PURA `streak`
// del dominio) PIÙ l'affordance di ritorno (riusa `onExit`, già cablata dalla 3.20).
// La pila vuota all'INGRESSO (`total === 0`, deep-link) resta lo `<main>` neutro e
// vuoto. Nessuna celebrazione: nessun verde/rosso, `!`, emoji, badge o animazione.
//
// FUORI SCOPE (3.22+): contratto tastiera completo (tasti numerici/tab-order/live
// region) — il completamento NON introduce live region —, responsive (3.23).
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyResultToDue, dueQueryKey } from '../../domain/due';
import { selectionComplete } from '../../domain/exercise-presentation';
import { evaluateAnswer } from '../../domain/review';
import type { ReviewState } from '../../domain/schedule';
import { currentExerciseId, remainingCount } from '../../domain/session';
import { streak } from '../../domain/streak';
import type { ApplyReviewInput } from '../../domain/ports/reviewRepository';
import { resolveLocale, useTranslation } from '../../i18n';
import { usePorts } from '../ports/PortsContext';
import { useSessionStore } from './sessionStore';
import { ExerciseCard } from './ExerciseCard';
import { ProgressMeter } from './ProgressMeter';

export interface SessionScreenProps {
  /**
   * L'id dell'utente corrente, risolto dall'app. `null` finché non è risolto: la
   * schermata mostra lo scheletro, senza ramo speciale (stesso pattern dashboard).
   */
  readonly userId: string | null;
  /**
   * L'ABBANDONO della sessione (3.20): navigazione come CALLBACK dal livello app
   * (AD-1: le features non importano react-router). Invocata da Esc, dall'affordance
   * «esci» in-app (e implicitamente dall'«indietro» del browser). Il cablaggio vive
   * in `AppRoutes` (`() => navigate(ROOT_PATH)`), speculare a `onStartSession` della
   * dashboard. Obbligatoria.
   */
  readonly onExit: () => void;
}

// Altezza CONDIVISA fra scheletro, stato neutro e card: la stessa classe sul <main>
// nei vari rami evita salti di layout (stesso pattern della dashboard). Una sola
// definizione così i rami non divergono.
const CONTAINER_HEIGHT = 'min-h-[24rem]';

// Le variabili della mutation `applyReview`: l'input pre-calcolato PIÙ il `result`
// (usato dall'onMutate ottimistico per rimpiazzare lo stato in cache). Il `result`
// non attraversa la porta — è glue locale della cache.
interface ApplyVars {
  readonly input: ApplyReviewInput;
  readonly result: ReviewState;
}

export function SessionScreen({ userId, onExit }: SessionScreenProps) {
  const { content, review, clock } = usePorts();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  // Lo store di sessione (delega al dominio). Ci ISCRIVIAMO via l'hook (per il
  // re-render reattivo nel browser quando `dispatch` avanza la coda) ma LEGGIAMO i
  // valori da `getState()`: sotto `renderToStaticMarkup` (SSR/test) l'hook restituisce
  // lo snapshot INIZIALE dello store (zustand usa lo stato iniziale come server
  // snapshot), mentre `getState()` riflette lo store SEMINATO dai test — così le
  // letture pure (`currentExerciseId`/`remainingCount`) rendono in SSR come vuole la
  // spec. Le azioni (`start`/`dispatch`) sono stabili.
  useSessionStore((s) => s.session);
  const { session, total, initialIds } = useSessionStore.getState();
  const startSession = useSessionStore.getState().start;
  const dispatch = useSessionStore.getState().dispatch;

  // L'esercizio CORRENTE dallo store (mai indicizzando la coda): id di RIGA DB, `null`
  // a coda vuota. Derivato QUI (in alto, subito dopo le letture dello store) così è
  // disponibile per la `useQuery` streak (regola degli hook: nessun early-return prima).
  const currentId = currentExerciseId(session);
  // Il COMPLETAMENTO (3.21): coda vuota DOPO una sessione avviata. `total` disambigua
  // la sessione DRENATA (`total > 0`: avviata da `start(dueIds)` con pila non vuota,
  // poi svuotata ⇒ schermata di zero) dalla pila vuota all'INGRESSO (`total === 0`:
  // deep-link, mai avviata ⇒ neutro). `total` è impostato SOLO da `start`.
  const sessionComplete = currentId === null && total > 0;

  // ABBANDONO con Esc (AC2): listener a livello window, attivo per l'INTERA vita
  // della schermata (anche scheletro/vuoto — hook top-level PRIMA di ogni
  // early-return, regola degli hook). Su `Escape` → `onExit()`; il cleanup rimuove
  // il listener. Glue d'effetto: verificata live, non eseguita da renderToStaticMarkup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  // RICOSTRUZIONE all'ingresso (AC4): lo store è un singleton di modulo che
  // sopravvive allo smontaggio. Un effetto con cleanup su UNMOUNT azzera lo store
  // all'USCITA da `/studia` (Esc, «esci», «indietro», completamento), così la
  // prossima entrata rientra nell'effetto `start` guardato e riparte dalla pila
  // fresca — nessun «riprendi dove eri». `reset` è un'azione stabile dello store.
  const resetSession = useSessionStore.getState().reset;
  useEffect(() => () => resetSession(), [resetSession]);

  // Fase locale e stato di risposta (senso unico), posseduti dal container. La card
  // è controllata. `selected` è l'ARRAY ordinato degli indici toccati (assemble
  // append-in-ordine); `answered` distingue consegna da spiegazione; `answeredCorrect`
  // porta la correttezza calcolata alla card; `usedExplanation` registra il consulto.
  const [selected, setSelected] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const [answeredCorrect, setAnsweredCorrect] = useState<boolean | null>(null);
  const [usedExplanation, setUsedExplanation] = useState(false);

  // La pila dei dovuti: chiave di DOMINIO verbatim (AD-5), `enabled: !!userId`.
  const dueQ = useQuery({
    queryKey: dueQueryKey(userId ?? ''),
    enabled: !!userId,
    queryFn: () => review.listDue(clock.now()),
  });

  // Avvia lo store una sola volta quando la pila è caricata (effetto guardato).
  // Ancora `total`/`initialIds` agli id INIZIALI: la coda si accorcerà, questi no.
  // Glue di produzione (verificata live): sotto renderToStaticMarkup gli effetti
  // non partono — i test seminano lo store direttamente.
  const dueIds = dueQ.data?.map((state) => state.exerciseId) ?? [];
  // Effetto GUARDATO (`initialIds.length === 0`): avvia lo store una sola volta, alla
  // prima pila non vuota caricata. `dueQ.data` è la dipendenza edge; `initialIds`
  // guarda contro il ri-avvio e `startSession` è stabile (azione dello store zustand).
  useEffect(() => {
    if (dueQ.data !== undefined && initialIds.length === 0 && dueIds.length > 0) {
      startSession(dueIds);
    }
  }, [dueQ.data, initialIds.length, dueIds, startSession]);

  // Gli esercizi completi per gli id INIZIALI della sessione (dallo store): ancorata
  // così la pila che si accorcia in modo ottimistico non provoca refetch/scheletri a
  // ogni risposta. La coda di sessione è sempre un sottoinsieme di questi id.
  const exercisesQ = useQuery({
    queryKey: ['exercises', initialIds],
    enabled: initialIds.length > 0,
    queryFn: () => content.listExercisesByIds(initialIds),
  });

  // Lo streak per la schermata di completamento (3.21): la STESSA chiave
  // `['streak', userId]` e la STESSA porta `listReviewLog()` della dashboard (AD-18/
  // AD-5 — streak UNICO e DERIVATO, mai memorizzato). Hook TOP-LEVEL (prima di ogni
  // early-return, regola degli hook), `enabled` SOLO al completamento così non fa
  // fetch durante la sessione attiva; al drenaggio la chiave è già stale (la mutation
  // di risposta la invalida in `onSettled`), quindi la lettura fresca include la
  // risposta di OGGI ⇒ streak «aggiornato» (AC1). I giorni si derivano dalla funzione
  // PURA `streak(log, now, timeZone)`, mai reimplementata; `now`/`timeZone` dal Clock.
  const streakLogQ = useQuery({
    queryKey: ['streak', userId],
    enabled: !!userId && sessionComplete,
    queryFn: () => review.listReviewLog(),
  });

  // La mutation di persistenza (AC4/AC5): UNA chiamata idempotente + aggiornamento
  // OTTIMISTICO del conteggio `['due', userId]` (la STESSA chiave della dashboard).
  const applyMutation = useMutation({
    mutationFn: ({ input }: ApplyVars) => review.applyReview(input),
    onMutate: async ({ input, result }: ApplyVars) => {
      const key = dueQueryKey(userId ?? '');
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<readonly ReviewState[]>(key);
      // Aggiornamento OTTIMISTICO delegato al dominio (AD-5): `applyResultToDue`
      // rimpiazza lo stato dell'esercizio con `result` e rifiltra con `isDue` —
      // `again`/`hard`@stage0 restano dovuti (conteggio invariato), `good`/`easy`/
      // `hard`@stage>0 escono (conteggio cala).
      queryClient.setQueryData<readonly ReviewState[]>(key, (old) =>
        applyResultToDue(old ?? [], result, input.reviewedAt),
      );
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_d, _e, _v, ctx) => {
      if (ctx) void queryClient.invalidateQueries({ queryKey: ctx.key });
      void queryClient.invalidateQueries({ queryKey: ['streak', userId] });
    },
  });

  // Mappa id di RIGA → esercizio (l'ordine del port non è garantito): la card legge
  // l'esercizio CORRENTE per id, mai per posizione.
  const current =
    currentId !== null
      ? exercisesQ.data?.find((c) => c.id === currentId)
      : undefined;

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

  // Coda vuota (`currentId === null`, cioè `isComplete(session)`). Due esiti (3.21):
  // - `total > 0` (sessione DRENATA a zero) ⇒ schermata di COMPLETAMENTO SOBRIA: la
  //   conferma di aver finito (`body`), lo streak AGGIORNATO dalla chiave `['streak']`
  //   (o un placeholder alla stessa altezza finché il log carica) e l'affordance di
  //   ritorno (`dismiss` → `onExit`, SECONDARIA — nessun fill, nessun verde). Nessuna
  //   card, nessuna barra, nessuna celebrazione. Esc resta attivo (listener top-level).
  // - `total === 0` (pila vuota all'INGRESSO, deep-link) ⇒ `<main>` neutro e vuoto,
  //   invariato: nessun `body` di completamento.
  if (currentId === null) {
    if (sessionComplete) {
      return (
        <main className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`}>
          {/* La conferma sobria di aver finito (AC1/AC2): nessun `!`, nessun verde. */}
          <p className="text-body text-ink-primary">{t('session.complete.body')}</p>
          {/* Lo streak AGGIORNATO (AC1/AC3): il numero dalla funzione PURA `streak`
              sul log fresco, ancorato a mezzanotte del fuso INIETTATO. Finché il log
              carica (cache fredda), un placeholder alla stessa altezza, nessuno
              spinner (evita salto di layout). */}
          {streakLogQ.data !== undefined ? (
            <p className="text-label text-ink-secondary">
              {t('session.complete.streakLabel', {
                days: streak(streakLogQ.data, clock.now(), clock.timeZone()),
              })}
            </p>
          ) : (
            <div className="h-[16px] w-36 rounded-md bg-surface-sunken" />
          )}
          {/* L'affordance di ritorno alla dashboard (AC2): riusa `onExit` (già cablata
              a `ROOT_PATH` dalla 3.20). SECONDARIA — chiaramente non il button-primary
              (nessun fill, ink muto, nessun verde). Mai "Continua". */}
          <button
            type="button"
            onClick={onExit}
            className="min-h-[56px] rounded-md border border-border-strong bg-surface-base text-ink-primary px-6 text-body"
          >
            {t('session.complete.dismiss')}
          </button>
        </main>
      );
    }
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

  // Id corrente assente dal caricato (bordo di contenuto): stato neutro senza card.
  if (current === undefined) {
    return (
      <main className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`} />
    );
  }

  const exercise = current.exercise;
  const locale = resolveLocale(i18n.language);

  // Gestore di risposta (glue d'effetto, verificata live): raccoglie il tocco,
  // attende il completamento (assemble: tutte le tessere), poi calcola l'esito SUL
  // CLIENT con le funzioni PURE, genera il `review_id`, avanza la coda (barra
  // ottimistica) e persiste (conteggio ottimistico). Un `again` che riaccoda
  // l'esercizio è, alla ripresentazione, un NUOVO tentativo (nuovo `review_id`).
  const onSelect = (index: number) => {
    // Guardia di re-entrancy (cintura+bretelle): i bottoni sono già `disabled` dopo
    // la risposta, ma un tocco spurio dopo il commit non deve ri-eseguire la pipeline.
    if (answered) return;

    const next = [...selected, index];
    setSelected(next);
    if (!selectionComplete(exercise, next)) return; // assemble: attende tutte le tessere

    const now = clock.now();

    // `currentState` dallo snapshot di ['due'] PRIMA dell'update ottimistico: lo
    // stato di ripasso dell'esercizio corrente (chiave = id di RIGA).
    const dueSnapshot = queryClient.getQueryData<readonly ReviewState[]>(
      dueQueryKey(userId),
    );
    const currentState = dueSnapshot?.find((s) => s.exerciseId === currentId);
    if (currentState === undefined) return; // difensivo: senza stato non si schedula

    // La pipeline di valutazione vive nel dominio (`evaluateAnswer`): compose→check→
    // outcomeOf→schedule, PURA e testata. Qui resta solo il montaggio sottile.
    const { correct, outcome, result } = evaluateAnswer(
      exercise,
      next,
      usedExplanation,
      currentState,
      now,
    );
    const reviewId = crypto.randomUUID(); // glue di feature: `src/domain` vieta `crypto`

    dispatch({ type: 'reviewed', result, now }); // avanza la coda (barra ottimistica)
    applyMutation.mutate({
      input: {
        reviewId,
        exerciseId: currentId,
        outcome,
        stage: result.stage,
        dueAt: result.dueAt,
        reviewedAt: now,
        usedExplanation,
      },
      result,
    });

    setAnswered(true);
    setAnsweredCorrect(correct);
  };

  // Avanzamento al prossimo esercizio: azzera fase/selezione/consulto e mostra il
  // nuovo `currentExerciseId` (lo store è GIÀ avanzato dal dispatch).
  const onNext = () => {
    setSelected([]);
    setAnswered(false);
    setAnsweredCorrect(null);
    setUsedExplanation(false);
  };

  const completed = total - remainingCount(session);

  return (
    <main className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`}>
      <ProgressMeter completed={completed} total={total} />
      <ExerciseCard
        exercise={exercise}
        selected={selected}
        onSelect={onSelect}
        answered={answered}
        onReveal={() => setUsedExplanation(true)}
        revealed={usedExplanation}
        correct={answeredCorrect}
        locale={locale}
      />
      {/* L'azione «prossimo esercizio» (mai "Continua"), visibile in spiegazione. */}
      {answered && (
        <button
          type="button"
          onClick={onNext}
          className="min-h-[56px] rounded-md border border-border-strong bg-surface-base text-ink-primary px-6 text-body"
        >
          {t('session.next')}
        </button>
      )}
      {/* L'affordance «esci» in-app (AC2, «potersene andare»): verbale e concreta,
          SECONDARIA — chiaramente non il button-primary (nessun fill, ink muto,
          nessun verde di successo). È il «tornare indietro» in-app; l'esito già dato
          resta acquisito (persistenza per-risposta, 3.19). → `onExit`. */}
      <button
        type="button"
        onClick={onExit}
        className="text-caption text-ink-muted underline"
      >
        {t('session.exit')}
      </button>
    </main>
  );
}
