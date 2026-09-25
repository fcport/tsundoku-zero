// @vitest-environment jsdom
//
// AC6 — una sessione COMPLETA fino a pila zero pilotabile da SOLA TASTIERA. È l'unica
// prova che richiede di GUIDARE la componente resa (non una funzione pura): tasti
// numerici selezionano, `Enter` avanza, la coda si svuota fino alla schermata di
// completamento. `renderToStaticMarkup` (env `node`, il resto della suite) non esegue
// eventi né effetti, quindi questo file marca l'ambiente `jsdom` SOLO per sé (il
// docblock sopra) — l'env globale resta `node`, i ~915 test invariati.
//
// Nessuna testing-library: `createRoot` + `act` (da `react`, disponibile in React 19)
// + `window.dispatchEvent(new KeyboardEvent(...))`. Le porte in memoria restituiscono
// dati COERENTI, così un eventuale refetch da `invalidateQueries` (gli effetti QUI
// partono davvero) è innocuo: la coda di sessione è guidata dallo store (dispatch),
// non da `['due']`.
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../i18n/en';
import { i18n } from '../../i18n';
import { dueQueryKey } from '../../domain/due';
import { createSession } from '../../domain/session';
import { answerOptions } from '../../domain/exercise-presentation';
import type { ReviewState } from '../../domain/schedule';
import type { ExerciseContent } from '../../domain/ports/contentRepository';
import type { Exercise } from '../../domain/exercise';
import { PortsProvider, type Ports } from '../ports/PortsContext';
import { useSessionStore } from './sessionStore';
import { SessionScreen } from './SessionScreen';

// React 19 richiede questo flag per far girare `act` senza avvisi.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const UID = 'user-1';
const NOW = new Date('2026-09-25T12:00:00.000Z');

const firstExercise: Exercise = {
  kind: 'single-select',
  grammarPoint: 'wa-particle',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['を', 'が', 'に'],
  explanation: { en: 'The topic particle.' },
};

const secondExercise: Exercise = {
  kind: 'assemble',
  grammarPoint: 'word-order',
  sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
  answer: ['本', 'を', '読む'],
  explanation: { en: 'Subject object verb.' },
};

const EXERCISES: readonly ExerciseContent[] = [
  { id: 'ex-1', exercise: firstExercise },
  { id: 'ex-2', exercise: secondExercise },
];

/** Stato di ripasso minimo: stage 0, dovuto all'epoca (isDue a NOW ⇒ true). */
function due(id: string): ReviewState {
  return {
    exerciseId: id,
    stage: 0,
    dueAt: new Date(0),
    reviewCount: 0,
    lapseCount: 0,
    lastReviewedAt: null,
  };
}

const DUE_STATES: readonly ReviewState[] = [due('ex-1'), due('ex-2')];

/**
 * Porte in memoria COERENTI: `listDue` rispecchia gli stati seminati (un refetch
 * da invalidazione ritorna gli stessi stati, innocuo), `listExercisesByIds` gli
 * esercizi, `applyReview` è un no-op che risolve.
 */
function inMemoryPorts(): Ports {
  return {
    clock: { now: () => NOW, timeZone: () => 'UTC' },
    review: {
      listDue: async () => DUE_STATES,
      listReviewLog: async () => [],
      applyReview: async () => {},
    },
    progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
    content: {
      listLessons: async () => [],
      listExercisesByIds: async () => EXERCISES,
    },
  };
}

/** La CIFRA (come stringa) che seleziona l'opzione `option` di `exercise`. */
function keyForOption(exercise: Exercise, option: string): string {
  const index = answerOptions(exercise).indexOf(option);
  return String(index + 1);
}

/**
 * Dispaccia un keydown a livello window dentro `act` (React processa gli update).
 * Accetta i modificatori (`ctrlKey`/`metaKey`/`altKey`) per provare che i tasti con
 * un modificatore NON sono dirottati dal contratto (scorciatoie del browser).
 */
function pressKey(
  key: string,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {},
): void {
  act(() => {
    window.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...modifiers,
      }),
    );
  });
}

/** Il nodo dell'unica live region `aria-live="polite"` reso nel sottoalbero, o null. */
function liveRegion(): Element | null {
  return container.querySelector('[aria-live="polite"]');
}

let container: HTMLDivElement;
let root: Root;
let onExit: ReturnType<typeof vi.fn>;

function mount(qc: QueryClient): void {
  onExit = vi.fn();
  act(() => {
    root.render(
      <StrictMode>
        <QueryClientProvider client={qc}>
          <PortsProvider value={inMemoryPorts()}>
            <SessionScreen userId={UID} onExit={onExit} />
          </PortsProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
  });
}

function html(): string {
  return container.innerHTML;
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  // Store SEMINATO: `start` di produzione è un effetto guardato; qui seminiamo lo
  // store direttamente così la corrente parte da ex-1 (2 esercizi in coda).
  useSessionStore.setState({
    session: createSession(['ex-1', 'ex-2']),
    total: 2,
    initialIds: ['ex-1', 'ex-2'],
  });
  // crypto.randomUUID: usato da onSelect (glue di feature). Node/jsdom lo forniscono;
  // garantiamo la presenza per robustezza dell'ambiente.
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    globalThis.crypto = {
      ...globalThis.crypto,
      randomUUID: () => '00000000-0000-4000-8000-000000000000',
    } as Crypto;
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await i18n.changeLanguage('en');
  useSessionStore.setState({ session: createSession([]), total: 0, initialIds: [] });
});

function seededClient(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(dueQueryKey(UID), DUE_STATES);
  qc.setQueryData(['exercises', ['ex-1', 'ex-2']], EXERCISES);
  return qc;
}

describe('AC6 — sessione completa pilotata da SOLA TASTIERA fino a pila zero', () => {
  it('cifre + Enter drenano la coda ⇒ schermata di completamento', () => {
    const qc = seededClient();
    mount(qc);

    // Parte l'esercizio 1 (single-select). La sua consegna è resa, nessuna risposta.
    expect(html()).toContain(en.session.prompt.singleSelect);
    expect(html()).not.toContain(en.session.next);
    // La live region ESISTE ma è vuota prima di rispondere (AC4): nessun esito ancora.
    expect(liveRegion()).not.toBeNull();
    expect(liveRegion()?.textContent?.trim()).toBe('');

    // Rispondo con la CIFRA dell'opzione corretta di ex-1 (は): risposta valutata,
    // fase spiegazione. Lo store è GIÀ avanzato (dispatch 3.19): la testa è ora ex-2,
    // ma la fase «spiegazione» tiene l'azione «prossimo esercizio» visibile.
    pressKey(keyForOption(firstExercise, 'は'));
    expect(html()).toContain(en.session.next);
    // La live region ora annuncia ESITO + AVANZAMENTO (AC4): esito corretto più
    // `1 of 2 completed` (completed = total − remaining = 2 − 1). Interroga il nodo
    // direttamente: il contenuto è sr-only e non compare nel testo visibile.
    expect(liveRegion()?.textContent).toContain(en.session.outcome.correct);
    expect(liveRegion()?.textContent).toContain('1 of 2 completed');

    // Enter (target non interattivo: il body) avanza: azzera la fase e mostra ex-2
    // in consegna (assemble).
    pressKey('Enter');
    expect(html()).toContain(en.session.prompt.assemble);
    expect(html()).not.toContain(en.session.next);

    // ex-2 (assemble): premo le cifre delle tessere NELL'ORDINE corretto. L'ultima
    // tessera completa la risposta ⇒ ex-2 è valutato good ⇒ la coda si SVUOTA (pila a
    // zero) ⇒ schermata di COMPLETAMENTO direttamente (nessun altro esercizio dopo).
    for (const tile of secondExercise.answer) {
      pressKey(keyForOption(secondExercise, tile));
    }

    expect(html()).toContain(en.session.complete.body);
    // Nessuna card: la consegna di un esercizio non è più resa.
    expect(html()).not.toContain(en.session.prompt.singleSelect);
    expect(html()).not.toContain(en.session.prompt.assemble);
  });

  // PATCH — la live region annuncia anche l'esito NON corretto (AC4). Il nodo usa un
  // ternario `correct : incorrect` (SessionScreen.tsx): il caso corretto è coperto
  // sopra, questo copre il RAMO `incorrect`. Senza, un regresso che fissasse l'esito a
  // «corretto» (perdendo il ramo `false`) resterebbe verde annunciando l'esito
  // sbagliato all'AT — proprio il pubblico per cui la live region esiste.
  it('una risposta ERRATA annuncia l esito incorrect (non correct) nella live region', () => {
    const qc = seededClient();
    mount(qc);

    // Rispondo a ex-1 con la cifra di un DISTRATTORE (を): risposta errata (again ⇒
    // ex-1 è riaccodato, la coda non si svuota), fase spiegazione.
    pressKey(keyForOption(firstExercise, 'を'));
    expect(html()).toContain(en.session.next);

    // La live region annuncia l'esito NON corretto, MAI quello corretto (le due
    // stringhe sono distinte: «correct.» non è sottostringa di «not correct.»), più
    // l'avanzamento interpolato (`{{completed}} of {{total}}`, qui completed=0 perché
    // un again riaccoda: si asserisce `of 2 completed` senza fissare il numero).
    expect(liveRegion()?.textContent).toContain(en.session.outcome.incorrect);
    expect(liveRegion()?.textContent).not.toContain(en.session.outcome.correct);
    expect(liveRegion()?.textContent).toContain('of 2 completed');
  });

  it('Esc esce dalla sessione (onExit) in qualsiasi fase (contratto unificato)', () => {
    const qc = seededClient();
    mount(qc);

    expect(html()).toContain(en.session.prompt.singleSelect);
    pressKey('Escape');
    expect(onExit).toHaveBeenCalled();
  });

  it('una cifra senza opzione (overflow) è un no-op: non avanza la fase (AC3)', () => {
    const qc = seededClient();
    mount(qc);

    // ex-1 ha 4 opzioni: la cifra '5' non ha opzione ⇒ no-op, resta in consegna.
    pressKey('5');
    expect(html()).toContain(en.session.prompt.singleSelect);
    // Nessuna risposta data: «prossimo esercizio» non è ancora reso.
    expect(html()).not.toContain(en.session.next);
  });

  // PATCH 2 — le cifre agiscono SOLO in fase consegna: in fase spiegazione (dopo aver
  // risposto, `answered=true`) una cifra è un no-op, non risponde di nuovo né avanza.
  it('una cifra in fase spiegazione è un no-op: non risponde né avanza (contratto)', () => {
    const qc = seededClient();
    mount(qc);

    // Rispondo a ex-1: entro in fase spiegazione (l'azione «prossimo esercizio» c'è).
    pressKey(keyForOption(firstExercise, 'は'));
    expect(html()).toContain(en.session.next);

    // Premo una cifra in fase spiegazione: il contratto la ignora (guardia `!answered`)
    // — la fase resta spiegazione, nessun avanzamento, nessuna schermata di
    // completamento (l'avanzamento è solo via `Enter`/il bottone).
    pressKey('2');
    expect(html()).toContain(en.session.next);
    expect(html()).not.toContain(en.session.complete.body);
  });

  // PATCH 3 — i tasti con un modificatore NON sono dirottati dal contratto: si lasciano
  // alle scorciatoie del browser (es. `Cmd+1` cambia scheda). In fase consegna, la
  // cifra corretta con `Ctrl`/`Meta`/`Alt` NON seleziona né risponde.
  it('cifra con Ctrl/Meta/Alt NON seleziona: resta in consegna (contratto)', () => {
    const qc = seededClient();
    mount(qc);

    const correctKey = keyForOption(firstExercise, 'は');
    // Con ciascun modificatore la stessa cifra corretta non fa nulla.
    pressKey(correctKey, { ctrlKey: true });
    pressKey(correctKey, { metaKey: true });
    pressKey(correctKey, { altKey: true });

    // Nessuna risposta data: resta in consegna, «prossimo esercizio» assente.
    expect(html()).toContain(en.session.prompt.singleSelect);
    expect(html()).not.toContain(en.session.next);

    // Prova di controllo: la STESSA cifra SENZA modificatore invece risponde.
    pressKey(correctKey);
    expect(html()).toContain(en.session.next);
  });
});
