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
// CONTRATTO TASTIERA (3.22): l'intera sessione e pilotabile SENZA MOUSE (aggiornamento
// di AD-15, registrato in `docs/session-keyboard-contract.md`). UN solo listener
// `keydown` a livello window (via ref «ultimo valore»): un tasto numerico `1`-`9`
// seleziona l'opzione alla posizione (`keyboardSelectionIndex`, dominio puro e
// agnostico al tipo), `Enter` in fase spiegazione avanza (target non interattivo),
// `Esc` esce (3.20, ora parte del contratto unificato). UNA sola live region
// `aria-live="polite"` (sr-only) nel ramo di sessione ATTIVA annuncia esito e
// avanzamento; il tab-order = ordine di lettura = ordine dei tasti numerici (ordine
// di `answerOptions`, nessun `tabindex` positivo) e ogni interattivo porta un anello
// di focus visibile (token `focus-ring`).
//
// RESPONSIVE (3.23): il <main> compone il contenitore condiviso di `src/ui/layout.ts`
// (colonna singola centrata, `measure`, gutter 20/32px) e ancora il blocco interattivo
// nella thumb-zone sotto 640px (vedi `MAIN_CLASS`). FUORI SCOPE: l'anello di focus
// app-wide su auth/settings/shell (DW-10) e l'audit con screen reader reale NVDA/
// VoiceOver (7.6).
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyResultToDue, dueQueryKey } from '../../domain/due';
import { answerOptions, selectionComplete } from '../../domain/exercise-presentation';
import { keyboardSelectionIndex } from '../../domain/keyboard';
import { evaluateAnswer } from '../../domain/review';
import type { ReviewState } from '../../domain/schedule';
import { currentExerciseId, remainingCount } from '../../domain/session';
import { streak } from '../../domain/streak';
import { resolveLocale, useTranslation } from '../../i18n';
import { RESPONSIVE_CONTAINER } from '../../ui/layout';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { ACTION_BAR, KICKER } from '../../ui/magazine';
import { ArrowIcon } from '../../ui/icons';
import { usePorts } from '../ports/PortsContext';
import { exercisesQueryKey } from './exercisesQueryKey';
import {
  REVIEW_MUTATION_KEY,
  REVIEW_SYNC_SCOPE,
  type ReviewMutationVars,
} from './reviewMutation';
import { useSessionStore } from './sessionStore';
import { useFuriganaPreference, usePreferenceShown } from '../../ui/furiganaPreference';
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
// definizione così i rami non divergono. Sotto 640px il <main> è alto QUANTO IL
// VIEWPORT (`min-h-screen`) così il blocco interattivo può cadere nella thumb-zone
// (vedi `MAIN_CLASS`); da 640px torna all'altezza minima condivisa (`sm:min-h-[24rem]`),
// centrata come le altre schermate.
const CONTAINER_HEIGHT = 'min-h-screen sm:min-h-[24rem]';

// La classe CONDIVISA del <main> della sessione (3.23): l'altezza condivisa PIÙ il
// contenitore responsive di `src/ui/layout.ts` (colonna singola centrata, `measure`,
// gutter 20/32px) PIÙ l'ANCORAGGIO alla thumb-zone sotto 640px. `flex flex-col`:
// sotto 640px `justify-end` spinge il contenuto (card + opzioni) verso il basso e
// `pb-thumb-zone` (padding inferiore 120px) garantisce che l'ULTIMO bersaglio opzione
// cada entro 120px dal bordo inferiore del viewport (AC7, UX-DR36/UJ-1: una mano, in
// alto la frase, in basso i bersagli). Da 640px `sm:justify-center` ricentra e
// `sm:pb-6` ripristina il padding simmetrico: la centratura è invariata (AC6). Una
// sola definizione, composta in TUTTI i rami <main> così non divergono.
const MAIN_CLASS = `${CONTAINER_HEIGHT} ${RESPONSIVE_CONTAINER} flex flex-col items-center justify-end gap-6 pt-6 pb-thumb-zone sm:justify-center sm:py-6`;

// ANELLO DI FOCUS visibile (3.22, AC5): una sola definizione condivisa dagli
// interattivi della SESSIONE (qui: «prossimo esercizio», «esci»; la card riusa lo
// stesso token). `focus-visible:` mostra l'anello solo per navigazione da tastiera,
// non al click. Il token è `focus-ring`. Nessun colore letterale (UX-DR1).
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

// Riconosce un target INTERATTIVO nativo (`<button>`/`<a>`/input/textarea/select o
// qualunque nodo `contenteditable`): sul quale `Enter` attiva GIÀ il controllo nativo
// (3.22). Il contratto avanza con `Enter` SOLO quando il target NON è interattivo
// (`window`/`body`), così sul bottone focalizzato non c'è doppio avanzamento.
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

// La CORNICE della rivista (29-09-2026): il dorso col marchio attorno a OGNI stato
// della sessione (scheletro, card, completamento, vuoto), così la pagina non cambia
// forma fra un esercizio e l'altro. Il <main> resta quello del contenuto.
export function SessionScreen(props: SessionScreenProps) {
  return (
    <MagazineFrame furiganaToggle>
      <SessionContent {...props} />
    </MagazineFrame>
  );
}

function SessionContent({ userId, onExit }: SessionScreenProps) {
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
  // La preferenza rapida «mostra la furigana» (hook top-level, prima di ogni
  // early-return): l'interruttore vive sul dorso della cornice, qui la si legge.
  const showFurigana = usePreferenceShown(useFuriganaPreference);
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

  // CONTRATTO TASTIERA UNIFICATO (3.22, aggiornamento di AD-15): UN solo listener
  // `keydown` a livello window per l'INTERA vita della schermata (numerici + `Enter`
  // + `Esc`, coerente con «l'accessibilità è UN contratto»). Il handler dipende da
  // stato che vive DOPO gli early-return (`activeExercise`, `answered`, `selected`):
  // per non catturare closure stantie senza aggiungere/rimuovere il listener a ogni
  // render, si usa il pattern «ultimo valore» — un `sessionKeyRef` aggiornato a ogni
  // render (effetto senza dep-array, più sotto) e un listener AGGIUNTO UNA VOLTA che
  // delega a `sessionKeyRef.current(e)`. Hook top-level PRIMA di ogni early-return
  // (regola degli hook). Glue d'effetto: verificata live e dal test jsdom (AC6), non
  // eseguita da renderToStaticMarkup.
  const sessionKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => sessionKeyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
  // L'esercizio a cui si è APPENA risposto. La coda avanza subito alla risposta
  // (`dispatch({ type: 'reviewed' })`, barra ottimistica), quindi `currentId` punta
  // già al SUCCESSIVO: senza questo ancoraggio la card mostrava l'esercizio seguente
  // nello stato «risposto», con la selezione e l'esito del precedente — e dopo
  // l'ultimo esercizio saltava dritta alla schermata finale, senza riscontro.
  const [answeredId, setAnsweredId] = useState<string | null>(null);

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
    queryKey: exercisesQueryKey(initialIds),
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

  // La mutation di persistenza (AC4). La `mutationFn` NON è più qui: vive ai DEFAULT
  // del QueryClient (`registerReviewMutationDefaults`, glue di bootstrap) risolta per
  // `mutationKey: ['review']`, così la coda DUREVOLE (4.2) la ritrova alla ripresa
  // dopo un reload — quando questo componente potrebbe non essere montato. La mutation
  // parte con la STESSA key/scope della registrazione; `onMutate`/`onError`/`onSettled`
  // restano effetti d'ISTANZA (aggiornamento ottimistico del conteggio `['due',
  // userId]`, rollback, invalidazione) — NON ripresi al reload, e va bene: al reload la
  // pila `['due']` è rifetchata fresca e la RPC è idempotente.
  const applyMutation = useMutation({
    mutationKey: REVIEW_MUTATION_KEY,
    scope: REVIEW_SYNC_SCOPE,
    onMutate: async ({ input, result }: ReviewMutationVars) => {
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
  // L'esercizio MOSTRATO: durante il riscontro quello a cui si è risposto, altrimenti
  // il corrente della coda.
  const shownId = answered && answeredId !== null ? answeredId : currentId;
  const current =
    shownId !== null
      ? exercisesQ.data?.find((c) => c.id === shownId)
      : undefined;

  // L'esercizio ATTIVO e le sue OPZIONI, sollevati a TOP-LEVEL (3.22): il contratto
  // tastiera deve vederli PRIMA degli early-return per aggiornare `sessionKeyRef`
  // (regola degli hook). `null`/vuoto quando non c'è una card (scheletro/vuoto/
  // completamento): il handler tastiera li guarda. L'ordine di `answerOptions` e
  // l'ordine di lettura = ordine dei tasti numerici (dominio, AC2/AC5).
  const activeExercise = current?.exercise ?? null;
  const activeOptions = activeExercise ? answerOptions(activeExercise) : [];
  const locale = resolveLocale(i18n.language);
  const completed = total - remainingCount(session);

  // Gestore di risposta (glue d'effetto, verificata live): raccoglie il tocco/tasto,
  // attende il completamento (assemble: tutte le tessere), poi calcola l'esito SUL
  // CLIENT con le funzioni PURE, genera il `review_id`, avanza la coda (barra
  // ottimistica) e persiste (conteggio ottimistico). Un `again` che riaccoda
  // l'esercizio è, alla ripresentazione, un NUOVO tentativo (nuovo `review_id`).
  // SOLLEVATO a top-level (3.22): la STESSA pipeline del click serve il tasto numerico
  // (nessuna seconda strada). Guarda `activeExercise`/`currentId` nulli (nessuna card).
  const onSelect = (index: number) => {
    // Guardia di re-entrancy (cintura+bretelle): i bottoni sono già `disabled` dopo
    // la risposta, ma un tocco/tasto spurio dopo il commit non deve ri-eseguire la
    // pipeline. Senza card attiva (scheletro/vuoto) non c'e nulla da selezionare.
    if (answered || activeExercise === null || currentId === null) return;

    const next = [...selected, index];
    setSelected(next);
    if (!selectionComplete(activeExercise, next)) return; // assemble: attende le tessere

    const now = clock.now();

    // `currentState` dallo snapshot di ['due'] PRIMA dell'update ottimistico: lo
    // stato di ripasso dell'esercizio corrente (chiave = id di RIGA).
    const dueSnapshot = queryClient.getQueryData<readonly ReviewState[]>(
      dueQueryKey(userId ?? ''),
    );
    const currentState = dueSnapshot?.find((s) => s.exerciseId === currentId);
    if (currentState === undefined) return; // difensivo: senza stato non si schedula

    // La pipeline di valutazione vive nel dominio (`evaluateAnswer`): compose→check→
    // outcomeOf→schedule, PURA e testata. Qui resta solo il montaggio sottile.
    const { correct, outcome, result } = evaluateAnswer(
      activeExercise,
      next,
      usedExplanation,
      currentState,
      now,
    );
    const reviewId = crypto.randomUUID(); // glue di feature: `src/domain` vieta `crypto`

    setAnsweredId(currentId); // la card resta su questo esercizio fino a «Prossimo»
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
  // nuovo `currentExerciseId` (lo store è GIÀ avanzato dal dispatch). SOLLEVATO a
  // top-level (3.22): serve sia il bottone che il tasto `Enter` del contratto.
  const onNext = () => {
    setAnsweredId(null);
    setSelected([]);
    setAnswered(false);
    setAnsweredCorrect(null);
    setUsedExplanation(false);
  };

  // Il handler del contratto tastiera (3.22, aggiornamento di AD-15): un solo punto
  // per numerici + `Enter` + `Esc`. Ignora i tasti con `Ctrl`/`Meta`/`Alt` per non
  // dirottare le scorciatoie del browser (es. `Cmd+1`). `Esc` esce sempre (3.20).
  // In fase `consegna` (`activeExercise` e `!answered`): la cifra `1`-`9` seleziona
  // l'opzione alla posizione via `keyboardSelectionIndex` (dominio puro, agnostico al
  // tipo) — saltata se la tessera assemble è già scelta (`selected.includes`) — poi
  // `preventDefault`. In fase `spiegazione` (`answered`): `Enter` con target NON
  // interattivo (`window`/`body`, non un `<button>`/`<a>`/input) avanza — sul bottone
  // focalizzato agisce l'attivazione nativa (nessun doppio avanzamento).
  const handleSessionKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onExit();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (activeExercise !== null && !answered) {
      const index = keyboardSelectionIndex(e.key, activeOptions.length);
      if (index !== null && !selected.includes(index)) {
        e.preventDefault();
        onSelect(index);
      }
      return;
    }

    if (answered && e.key === 'Enter' && !isInteractiveTarget(e.target)) {
      onNext();
    }
  };

  // Aggiorna il ref «ultimo valore» a OGNI render (nessun dep-array): il listener
  // aggiunto una volta chiama sempre il handler FRESCO, con lo stato corrente, senza
  // riattaccare l'evento. Effetto top-level PRIMA di ogni early-return.
  useEffect(() => {
    sessionKeyRef.current = handleSessionKey;
  });

  // Scheletro finché l'id non è risolto o la pila è ancora pending (stesso pattern
  // della dashboard): stessa altezza, nessuno spinner, `aria-busy` per l'AT.
  if (!userId || dueQ.data === undefined) {
    return (
      <main aria-busy="true" className={MAIN_CLASS}>
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
  if (shownId === null) {
    if (sessionComplete) {
      return (
        <main className={MAIN_CLASS}>
          {/* Lo ZERO del nome, a tutta pagina: la pila è a zero. Decorativo
              (`aria-hidden`): la conferma la porta il testo subito sotto. */}
          <p
            aria-hidden="true"
            className="self-start text-[200px] font-black leading-[0.8] font-stretch-extra-condensed text-ink-primary sm:text-[260px]"
          >
            0
          </p>
          {/* La conferma sobria di aver finito (AC1/AC2): nessun `!`, nessun verde. */}
          <p className="w-full border-t-[1.5px] border-border-strong pt-4 text-[22px] font-medium leading-snug text-ink-primary">
            {t('session.complete.body')}
          </p>
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
          <button type="button" onClick={onExit} className={ACTION_BAR}>
            <span>{t('session.complete.dismiss')}</span>
            <ArrowIcon className="text-accent-on-ink" />
          </button>
        </main>
      );
    }
    return <main className={MAIN_CLASS} />;
  }

  // La pila non è vuota ma gli esercizi non sono ancora caricati: scheletro (la
  // query è enabled, sta risolvendo).
  if (exercisesQ.data === undefined) {
    return (
      <main aria-busy="true" className={MAIN_CLASS}>
        <div className="h-[20px] w-48 rounded-md bg-surface-sunken" />
        <div className="h-[40px] w-64 rounded-md bg-surface-sunken" />
        <div className="h-14 w-full rounded-md bg-surface-sunken" />
        <div className="h-14 w-full rounded-md bg-surface-sunken" />
      </main>
    );
  }

  // Id corrente assente dal caricato (bordo di contenuto): stato neutro senza card.
  if (current === undefined) {
    return <main className={MAIN_CLASS} />;
  }

  // `exercise` non-null qui (narrowing dopo la guardia `current === undefined`):
  // combacia con `activeExercise`, ma il narrowing TS su `current` lo tipa non-null
  // per la card. `onSelect`/`onNext`/`locale`/`completed` sono già sollevati sopra.
  const exercise = current.exercise;

  return (
    <main className={MAIN_CLASS}>
      {/* `mb-auto` ancora la barra in ALTO anche sotto 640px, dove il <main> spinge il
          contenuto in basso (zona del pollice): senza, la barra galleggiava a metà
          schermo e saltava su e giù a ogni esercizio, secondo l'altezza della card. */}
      <div className="mb-auto w-full sm:mb-0">
        {/* L'intestazione della domanda, da rivista: l'occhiello e il numero
            dell'esercizio in corso, enorme e condensato, poi la barra. Il numero è
            decorativo (`aria-hidden`): l'avanzamento per l'AT lo portano la barra
            (`role="progressbar"`) e la live region. */}
        <div className="mb-3 flex items-end justify-between">
          <p aria-hidden="true" className="leading-none">
            <span className={`block ${KICKER}`}>{t('session.questionKicker')}</span>
            <span className="text-[64px] font-black leading-[0.85] font-stretch-extra-condensed text-ink-primary">
              {String(Math.max(1, Math.min(answered ? completed : completed + 1, total))).padStart(2, '0')}
            </span>
          </p>
          <p aria-hidden="true" className="font-mono text-label-caps text-ink-secondary">
            {completed}/{total}
          </p>
        </div>
        <ProgressMeter completed={completed} total={total} />
      </div>
      <ExerciseCard
        exercise={exercise}
        selected={selected}
        onSelect={onSelect}
        answered={answered}
        onReveal={() => setUsedExplanation(true)}
        revealed={usedExplanation}
        correct={answeredCorrect}
        locale={locale}
        furigana={showFurigana}
      />
      {/* L'azione «prossimo esercizio» (mai "Continua"), visibile in spiegazione.
          Anello di focus visibile (3.22, AC5). */}
      {answered && (
        <button type="button" onClick={onNext} className={ACTION_BAR}>
          <span>{t('session.next')}</span>
          <ArrowIcon className="text-accent-on-ink" />
        </button>
      )}
      {/* L'affordance «esci» in-app (AC2, «potersene andare»): verbale e concreta,
          SECONDARIA — chiaramente non il button-primary (nessun fill, ink muto,
          nessun verde di successo). È il «tornare indietro» in-app; l'esito già dato
          resta acquisito (persistenza per-risposta, 3.19). → `onExit`. Anello di
          focus visibile (3.22, AC5). */}
      <button
        type="button"
        onClick={onExit}
        className={`min-h-[44px] text-label text-ink-secondary underline underline-offset-4 ${FOCUS_RING}`}
      >
        {t('session.exit')}
      </button>
      {/* UNA sola live region per l'INTERA sessione (3.22, AC4): un unico nodo
          `aria-live="polite"`, reso SOLO nel ramo di sessione ATTIVA (con la card) —
          MAI su scheletro/completamento/vuoto, così resta esattamente una. Annuncia
          l'ESITO (`session.outcome.*`) più l'AVANZAMENTO (`session.progress.announce`,
          `{{completed}}`/`{{total}}`) quando la risposta è data; stringa vuota
          altrimenti. `sr-only`: l'esito visibile lo porta già l'ExplanationPanel, e
          l'avanzamento la ProgressMeter — questa serve alla sola assistive technology.
          Nessun colore d'esito (nessun verde/rosso). */}
      <p aria-live="polite" className="sr-only">
        {answered
          ? `${t(answeredCorrect ? 'session.outcome.correct' : 'session.outcome.incorrect')} ${t('session.progress.announce', { completed, total })}`
          : ''}
      </p>
    </main>
  );
}
