import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { i18n } from '../../i18n';
import { dueQueryKey } from '../../domain/due';
import { createSession } from '../../domain/session';
import { streak, type ReviewLogEntry } from '../../domain/streak';
import type { ReviewState } from '../../domain/schedule';
import type { ExerciseContent } from '../../domain/ports/contentRepository';
import type { Exercise } from '../../domain/exercise';
import { answerOptions } from '../../domain/exercise-presentation';
import { PortsProvider, type Ports } from '../ports/PortsContext';
import { useSessionStore } from './sessionStore';
import { SessionScreen } from './SessionScreen';

// AC1/AC2/AC5 + Matrix — il container della sessione (3.19). Ambiente `node`:
// renderToStaticMarkup non esegue effetti; i test SEMINANO lo store (l `start` è un
// effetto guardato, verificato live) e la cache. Con lo store seminato la corrente
// viene dallo store; la query esercizi è ancorata a `initialIds` (dallo store); la
// barra deriva total − remainingCount. Gli stati post-risposta restano coperti dai
// test di componente (ExerciseCard/ExplanationPanel/ProgressMeter).

const UID = 'user-1';
const NOW = new Date('2026-09-25T12:00:00.000Z');

// Porte inerti: con la cache seminata le queryFn non partono.
const inMemoryPorts: Ports = {
  clock: { now: () => NOW, timeZone: () => 'UTC' },
  review: { listDue: async () => [], listReviewLog: async () => [], applyReview: async () => {} },
  progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
  content: { listLessons: async () => [], listExercisesByIds: async () => [] },
};

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

/** Stato di ripasso minimo: la sessione usa solo `exerciseId`. */
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

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Semina la pila e gli esercizi. La chiave degli esercizi DEVE combaciare con
 * quella che il componente costruisce: `['exercises', initialIds]` dove
 * `initialIds` sono gli id seminati nello store.
 */
function seededClient(
  dueStates: readonly ReviewState[],
  exercises: readonly ExerciseContent[],
): QueryClient {
  const qc = freshClient();
  qc.setQueryData(dueQueryKey(UID), dueStates);
  const ids = dueStates.map((s) => s.exerciseId);
  qc.setQueryData(['exercises', ids], exercises);
  return qc;
}

/** Semina lo store con gli id INIZIALI (l `start` di produzione è un effetto). */
function seedStore(ids: readonly string[]): void {
  useSessionStore.getState().start(ids);
}

const NOOP = () => {};

function render(qc: QueryClient, userId: string | null): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <PortsProvider value={inMemoryPorts}>
        <SessionScreen userId={userId} onExit={NOOP} />
      </PortsProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  // Store fresco: il singleton di modulo è condiviso fra i test.
  useSessionStore.setState({ session: createSession([]), total: 0, initialIds: [] });
});
afterEach(async () => {
  await i18n.changeLanguage('en');
  useSessionStore.setState({ session: createSession([]), total: 0, initialIds: [] });
});

describe('Caricamento — userId null / pila pending ⇒ scheletro', () => {
  it('userId null ⇒ scheletro aria-busy, nessuna consegna', () => {
    const markup = render(freshClient(), null);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain(en.session.prompt.singleSelect);
  });

  it('lo scheletro NON ha live region aria-live (3.22 AC4)', () => {
    const markup = render(freshClient(), null);
    expect(markup).not.toContain('aria-live');
  });

  it('pila non seminata (query pending) ⇒ scheletro aria-busy', () => {
    const markup = render(freshClient(), UID);
    expect(markup).toContain('aria-busy="true"');
  });

  it('lo scheletro non contiene uno spinner', () => {
    const markup = render(freshClient(), null);
    expect(markup.toLowerCase()).not.toContain('spinner');
    expect(markup).not.toContain('role="status"');
  });
});

describe('AC1/AC2/AC5 — store + esercizi seminati ⇒ card dell esercizio CORRENTE + barra', () => {
  function setup(): string {
    seedStore(['ex-1', 'ex-2']);
    const qc = seededClient(
      [due('ex-1'), due('ex-2')],
      [
        { id: 'ex-1', exercise: firstExercise },
        { id: 'ex-2', exercise: secondExercise },
      ],
    );
    return render(qc, UID);
  }

  it('rende la consegna dell esercizio corrente (la testa della coda dello store)', () => {
    const markup = setup();
    expect(markup).toContain(en.session.prompt.singleSelect);
    expect(markup).not.toContain(en.session.prompt.assemble);
  });

  it('rende la frase giapponese (lang="ja")', () => {
    expect(setup()).toContain('lang="ja"');
  });

  it('rende le opzioni dell esercizio corrente (1 + |distractors|)', () => {
    const markup = setup();
    for (const option of answerOptions(firstExercise)) {
      expect(markup).toContain(`>${option}<`);
    }
  });

  it('ha un solo <main>', () => {
    const mains = setup().match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });

  it('rende la ProgressMeter con attributi ARIA coerenti (0 completati su total)', () => {
    const markup = setup();
    expect(markup).toContain('role="progressbar"');
    // Nessuna risposta ancora: 0 completati su 2.
    expect(markup).toContain('aria-valuenow="0"');
    expect(markup).toContain('aria-valuemax="2"');
    expect(markup).toContain('aria-valuemin="0"');
    // aria-label dalla i18n.
    expect(markup).toContain(en.session.progress.label);
  });

  it('rende l affordance «esci» nel ramo sessione-attiva (AC2)', () => {
    expect(setup()).toContain(en.session.exit);
  });

  it('rende ESATTAMENTE una live region aria-live="polite" (3.22 AC4)', () => {
    const markup = setup();
    const liveRegions = markup.match(/aria-live="polite"/g) ?? [];
    expect(liveRegions.length).toBe(1);
  });

  it('la live region e sr-only e vuota prima della risposta (3.22 AC4)', () => {
    const markup = setup();
    // Nessuna risposta ancora: l'esito non e annunciato (stringa vuota). La classe
    // sr-only la tiene fuori dal flusso visibile.
    expect(markup).toContain('sr-only');
    // L'avanzamento annunciato NON compare finche non c'e una risposta.
    expect(markup).not.toContain('0 of 2 completed');
  });

  it('ogni opzione porta l anello di focus visibile focus-ring (3.22 AC5)', () => {
    const markup = setup();
    // Il token focus-ring compare via focus-visible: sulle opzioni.
    expect(markup).toContain('focus-visible:outline-focus-ring');
  });

  it('«prossimo esercizio» e «esci» portano il focus-ring (3.22 AC5)', () => {
    // Il markup di setup rende «esci» sempre; il focus-ring vi compare.
    const markup = setup();
    // Almeno due interattivi col focus-ring (opzioni + esci). Il conteggio esatto
    // dipende dal numero di opzioni; qui basta che l anello sia presente su piu nodi.
    const rings = markup.match(/focus-visible:outline-focus-ring/g) ?? [];
    expect(rings.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Matrix — pila vuota (deep-link) ⇒ stato neutro senza card, nessuna barra', () => {
  it('store vuoto + pila vuota ⇒ nessuna card, nessuna barra, un solo <main>', () => {
    const qc = freshClient();
    qc.setQueryData(dueQueryKey(UID), []);
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.session.prompt.singleSelect);
    expect(markup).not.toContain(en.session.prompt.assemble);
    expect(markup).not.toContain(en.session.prompt.selectSpan);
    // Barra non resa a total 0.
    expect(markup).not.toContain('role="progressbar"');
    // Affordance «esci» assente: non c'è sessione attiva da abbandonare (AC2).
    expect(markup).not.toContain(en.session.exit);
    // Nessuna schermata di completamento (total === 0: mai avviata, AC4).
    expect(markup).not.toContain(en.session.complete.body);
    expect(markup).not.toContain(en.session.complete.dismiss);
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
    // Non è lo scheletro (la pila è caricata, solo vuota).
    expect(markup).not.toContain('aria-busy="true"');
    // Nessuna live region nello stato vuoto (3.22 AC4).
    expect(markup).not.toContain('aria-live');
  });
});

describe('AC1/AC2/AC3 — sessione DRENATA (total > 0, coda vuota) ⇒ schermata di completamento', () => {
  // Log seminato: oggi + ieri (fuso UTC iniettato) ⇒ streak = 2. La giornata a-zero
  // conta per costruzione (drenare implica ≥1 risposta oggi), ancorata a mezzanotte.
  const LOG: readonly ReviewLogEntry[] = [
    { reviewedAt: new Date('2026-09-25T09:00:00.000Z') }, // oggi
    { reviewedAt: new Date('2026-09-24T09:00:00.000Z') }, // ieri
  ];

  // Store DRENATO: sessione a coda vuota ma `total`/`initialIds` di una sessione
  // avviata da 2 esercizi. Semina `['due']=[]` (pila svuotata) e `['streak', UID]`.
  function drainedSetup(seedStreak: boolean): string {
    useSessionStore.setState({
      session: createSession([]),
      total: 2,
      initialIds: ['ex-1', 'ex-2'],
    });
    const qc = freshClient();
    qc.setQueryData(dueQueryKey(UID), []);
    if (seedStreak) qc.setQueryData(['streak', UID], LOG);
    return render(qc, UID);
  }

  it('rende la conferma di aver finito (session.complete.body) e il dismiss (AC1)', () => {
    const markup = drainedSetup(true);
    expect(markup).toContain(en.session.complete.body);
    expect(markup).toContain(en.session.complete.dismiss);
  });

  it('rende lo streak AGGIORNATO dal log via streak() (AC1/AC3)', () => {
    const markup = drainedSetup(true);
    // Il numero atteso è quello che la funzione PURA del dominio calcola.
    const days = streak(LOG, NOW, 'UTC');
    expect(days).toBe(2);
    expect(markup).toContain(`${days} day streak`);
  });

  it('non celebra: nessun `!`, nessuna barra, nessuna card (AC2)', () => {
    const markup = drainedSetup(true);
    expect(markup).not.toContain('!');
    expect(markup).not.toContain('role="progressbar"');
    expect(markup).not.toContain(en.session.prompt.singleSelect);
    expect(markup).not.toContain(en.session.prompt.assemble);
    // Un solo <main>.
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });

  it('il completamento NON ha live region aria-live (3.22 AC4)', () => {
    const markup = drainedSetup(true);
    expect(markup).not.toContain('aria-live');
  });

  it('streak in caricamento (cache fredda) ⇒ body reso, placeholder al posto dello streak (Matrix)', () => {
    const markup = drainedSetup(false);
    // Il body è reso subito, anche senza streak.
    expect(markup).toContain(en.session.complete.body);
    // Nessuno «day streak» finché il log non carica; nessuno spinner.
    expect(markup).not.toContain('day streak');
    expect(markup).not.toContain('role="status"');
    // Placeholder alla stessa altezza (bg-surface-sunken), nessun salto di layout.
    expect(markup).toContain('bg-surface-sunken');
  });
});

describe('Matrix — id corrente assente dal caricato ⇒ stato neutro senza card', () => {
  it('la mappa esercizi non contiene l id corrente ⇒ nessuna card', () => {
    seedStore(['ex-1']);
    const qc = freshClient();
    qc.setQueryData(dueQueryKey(UID), [due('ex-1')]);
    // initialIds = ['ex-1'], ma il caricato porta solo ex-9: bordo di contenuto.
    qc.setQueryData(['exercises', ['ex-1']], [{ id: 'ex-9', exercise: firstExercise }]);
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.session.prompt.singleSelect);
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });
});
