import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { i18n } from '../../i18n';
import type { ReviewLogRecord } from '../../domain/streak';
import type { ReviewOutcome } from '../../domain/schedule';
import { PortsProvider, type Ports } from '../ports/PortsContext';
import { StatsScreen } from './StatsScreen';

// AC1/AC2 + Matrix — la vista delle risposte nel tempo (5.1). Ambiente `node`
// (nessun jsdom): renderToStaticMarkup non esegue effetti né timer. Con la cache
// SEMINATA su `['streak', userId]` la query risolve in modo SINCRONO al primo
// render (stato caricato); una cache vuota resta `pending` (scheletro). Il
// fuso/orologio ENTRANO dal Clock iniettato (fisso), così la serie è deterministica.

const UID = 'user-1';
const NOW = new Date('2026-09-25T12:00:00.000Z');
const TZ = 'UTC';

// Porte in memoria: clock FISSO per una serie deterministica; i repository sono
// inerti (con cache seminata le queryFn non partono).
const inMemoryPorts: Ports = {
  clock: { now: () => NOW, timeZone: () => TZ },
  review: {
    listDue: async () => [],
    listReviewLog: async () => [],
    applyReview: async () => {},
  },
  progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
  content: { listLessons: async () => [], listExercisesByIds: async () => [] },
};

// Una voce di log COMPLETA (`ReviewLogRecord`): `answersOverTime` legge solo
// `reviewedAt`, `stageDistribution` legge `exerciseId`/`outcome`. Default `ex-1`/
// `good` per i test della serie (dove l'esercizio/esito non contano); i test della
// distribuzione passano `exerciseId`/`outcome` espliciti.
function logAt(
  iso: string,
  exerciseId = 'ex-1',
  outcome: ReviewOutcome = 'good',
): ReviewLogRecord {
  return { reviewedAt: new Date(iso), exerciseId, outcome };
}

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Semina la cache del log sulla STESSA chiave `['streak', UID]` della dashboard. */
function seededClient(log: readonly ReviewLogRecord[]): QueryClient {
  const qc = freshClient();
  qc.setQueryData(['streak', UID], log);
  return qc;
}

function render(qc: QueryClient, userId: string | null, ports: Ports = inMemoryPorts): string {
  const el: ReactElement = (
    <QueryClientProvider client={qc}>
      <PortsProvider value={ports}>
        <StatsScreen userId={userId} onExit={() => {}} />
      </PortsProvider>
    </QueryClientProvider>
  );
  return renderToStaticMarkup(el);
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('AC1 — serie con dati: intestazione + conteggi per giorno come testo', () => {
  // Log su 24 e 25 (fuso UTC): serie contigua [24: 1, 25: 1].
  const qc = seededClient([
    logAt('2026-09-24T10:00:00.000Z'),
    logAt('2026-09-25T10:00:00.000Z'),
  ]);
  const markup = render(qc, UID);

  it('rende il titolo di schermata (stats.title)', () => {
    expect(markup).toContain(en.stats.title);
  });

  it("rende l'intestazione delle risposte nel tempo", () => {
    expect(markup).toContain(en.stats.answersOverTime.heading);
  });

  it('mostra il conteggio di ciascun giorno come TESTO', () => {
    // Il dayLabel interpola {{date}} e {{answers}}: il giorno e il suo conteggio,
    // in forma etichetta-valore (nessuna concordanza di numero).
    expect(markup).toContain('2026-09-24 - answers: 1');
    expect(markup).toContain('2026-09-25 - answers: 1');
  });

  it('rende un solo <main> (il landmark)', () => {
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });

  it('offre un\'affordance di ritorno (stats.back)', () => {
    expect(markup).toContain(en.stats.back);
  });

  it('non porta il placeholder del log vuoto', () => {
    expect(markup).not.toContain(en.stats.answersOverTime.empty);
  });

  it("l'affordance di ritorno porta l'anello di focus da tastiera (focus-visible)", () => {
    // Lo STESSO token della sessione (schermata su cui StatsScreen è modellata):
    // gli interattivi devono esporre l'anello per navigazione da tastiera.
    expect(markup).toContain('focus-visible:outline-focus-ring');
  });
});

describe('AC1 — ultima risposta nel passato ⇒ la serie si estende fino a oggi (code a 0 come TESTO)', () => {
  // Unica risposta il 23 (UTC); NOW è il 25: la serie contigua è [23:1, 24:0, 25:0].
  // Verifica alla SUPERFICIE della vista (non solo del dominio) che i giorni a
  // conteggio 0 compaiano come TESTO ("answers: 0") — la contiguità che l'AC1 osserva.
  const qc = seededClient([logAt('2026-09-23T10:00:00.000Z')]);
  const markup = render(qc, UID);

  it('rende il giorno con risposta e i giorni successivi a 0 come testo', () => {
    expect(markup).toContain('2026-09-23 - answers: 1');
    expect(markup).toContain('2026-09-24 - answers: 0');
    expect(markup).toContain('2026-09-25 - answers: 0');
  });

  it('NON rende il placeholder del log vuoto (il log non è vuoto)', () => {
    expect(markup).not.toContain(en.stats.answersOverTime.empty);
  });
});

describe('AC1 — più risposte lo stesso giorno ⇒ un solo giorno col conteggio sommato', () => {
  it('tre risposte il 25 ⇒ «2026-09-25 - answers: 3»', () => {
    const qc = seededClient([
      logAt('2026-09-25T01:00:00.000Z'),
      logAt('2026-09-25T10:00:00.000Z'),
      logAt('2026-09-25T20:00:00.000Z'),
    ]);
    const markup = render(qc, UID);
    expect(markup).toContain('2026-09-25 - answers: 3');
  });
});

describe('AC5 — log vuoto ⇒ placeholder testuale neutro, NON un grafico', () => {
  const qc = seededClient([]);
  const markup = render(qc, UID);

  it('rende comunque il titolo di schermata (stats.title, in entrambi gli stati)', () => {
    expect(markup).toContain(en.stats.title);
  });

  it('rende il placeholder del log vuoto (entrambe le sezioni)', () => {
    expect(markup).toContain(en.stats.answersOverTime.empty);
    // AC5 di 5.2: anche la distribuzione rende un placeholder testuale neutro.
    expect(markup).toContain(en.stats.stageDistribution.empty);
  });

  it("NON rende le intestazioni delle sezioni né una barra (nessun grafico vuoto)", () => {
    expect(markup).not.toContain(en.stats.answersOverTime.heading);
    expect(markup).not.toContain(en.stats.stageDistribution.heading);
    // Nessuna lista di barre: nessun <ol>/<li> reso (né serie né distribuzione).
    expect(markup).not.toContain('<ol');
    expect(markup).not.toContain('<li');
  });

  it('offre comunque l\'affordance di ritorno', () => {
    expect(markup).toContain(en.stats.back);
  });
});

describe('5.2 AC — distribuzione per stadio: intestazione + sei stadi con conteggi come testo', () => {
  // Tre esercizi a stadi finali diversi:
  //  - ex-A: good ⇒ stadio 1
  //  - ex-B: good, good ⇒ stadio 2
  //  - ex-C: good, good ⇒ stadio 2
  // Distribuzione: stadio 0 => 0, 1 => 1, 2 => 2, 3..5 => 0.
  const qc = seededClient([
    logAt('2026-09-20T10:00:00.000Z', 'ex-A', 'good'),
    logAt('2026-09-20T10:00:00.000Z', 'ex-B', 'good'),
    logAt('2026-09-21T10:00:00.000Z', 'ex-B', 'good'),
    logAt('2026-09-20T10:00:00.000Z', 'ex-C', 'good'),
    logAt('2026-09-21T10:00:00.000Z', 'ex-C', 'good'),
  ]);
  const markup = render(qc, UID);

  it("rende l'intestazione della distribuzione per stadio", () => {
    expect(markup).toContain(en.stats.stageDistribution.heading);
  });

  it('mostra ESATTAMENTE i sei stadi 0-5 col conteggio come TESTO', () => {
    expect(markup).toContain('Stage 0 - exercises: 0');
    expect(markup).toContain('Stage 1 - exercises: 1');
    expect(markup).toContain('Stage 2 - exercises: 2');
    expect(markup).toContain('Stage 3 - exercises: 0');
    expect(markup).toContain('Stage 4 - exercises: 0');
    expect(markup).toContain('Stage 5 - exercises: 0');
    // Nessun settimo stadio.
    expect(markup).not.toContain('Stage 6 -');
  });

  it('include uno stadio a conteggio 0 come testo (asse contiguo, zeri inclusi)', () => {
    expect(markup).toContain('Stage 0 - exercises: 0');
  });

  it('NON rende il placeholder della distribuzione (il log non è vuoto)', () => {
    expect(markup).not.toContain(en.stats.stageDistribution.empty);
  });

  it('rende un solo <main> (il landmark) con entrambe le sezioni', () => {
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
    // Entrambe le intestazioni presenti nello stesso <main>.
    expect(markup).toContain(en.stats.answersOverTime.heading);
    expect(markup).toContain(en.stats.stageDistribution.heading);
  });
});

describe('5.2 AC — un esercizio con piu risposte conta UNA volta, allo stadio finale', () => {
  it('good, good, again per ex-1 ⇒ stadio finale 0 (una sola volta)', () => {
    const qc = seededClient([
      logAt('2026-09-20T10:00:00.000Z', 'ex-1', 'good'), // 0 -> 1
      logAt('2026-09-21T10:00:00.000Z', 'ex-1', 'good'), // 1 -> 2
      logAt('2026-09-22T10:00:00.000Z', 'ex-1', 'again'), // 2 -> 0
    ]);
    const markup = render(qc, UID);
    // L'unico esercizio cade nel bucket 0; ogni altro stadio a 0.
    expect(markup).toContain('Stage 0 - exercises: 1');
    expect(markup).toContain('Stage 1 - exercises: 0');
    expect(markup).toContain('Stage 2 - exercises: 0');
  });
});

describe('5.2 AC — la fonte è SOLO review.listReviewLog() (mai listDue/review_state)', () => {
  it('la distribuzione resa deriva dal SOLO log seminato, senza listDue', () => {
    const calls: string[] = [];
    const spyPorts: Ports = {
      clock: { now: () => NOW, timeZone: () => TZ },
      review: {
        listDue: async () => {
          calls.push('listDue');
          throw new Error('listDue non deve essere consultata dalle statistiche');
        },
        listReviewLog: async () => {
          calls.push('listReviewLog');
          return [];
        },
        applyReview: async () => {
          calls.push('applyReview');
        },
      },
      progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
      content: { listLessons: async () => [], listExercisesByIds: async () => [] },
    };
    const qc = seededClient([logAt('2026-09-25T10:00:00.000Z', 'ex-1', 'good')]);
    const markup = render(qc, UID, spyPorts);

    // La distribuzione riflette il SOLO log seminato: un esercizio allo stadio 1.
    expect(markup).toContain('Stage 1 - exercises: 1');
    expect(calls).not.toContain('listDue');
    expect(calls).not.toContain('applyReview');
  });
});

describe('AC — scheletro: userId null o cache pending', () => {
  it('userId null ⇒ scheletro (aria-busy), nessuna intestazione', () => {
    const markup = render(freshClient(), null);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain(en.stats.answersOverTime.heading);
  });

  it('cache vuota (query pending) ⇒ scheletro (aria-busy)', () => {
    const markup = render(freshClient(), UID);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain(en.stats.answersOverTime.heading);
  });

  it('lo scheletro non contiene uno spinner', () => {
    const markup = render(freshClient(), null);
    expect(markup.toLowerCase()).not.toContain('spinner');
    expect(markup).not.toContain('role="status"');
  });

  it('scheletro e contenuto condividono la stessa classe di altezza (nessun salto)', () => {
    const skeleton = render(freshClient(), null);
    const loaded = render(seededClient([logAt('2026-09-25T10:00:00.000Z')]), UID);
    const heightClass = /class="([^"]*min-h-\[[^\]]+\][^"]*)"/;
    const skeletonH = skeleton.match(heightClass)?.[1];
    const loadedH = loaded.match(heightClass)?.[1];
    expect(skeletonH).toBeTruthy();
    expect(skeletonH).toBe(loadedH);
  });
});

describe('AC2 — la fonte è SOLO review.listReviewLog() (mai listDue/review_count)', () => {
  // Porta SPIA: `listDue` e `applyReview` LANCIANO se toccati, così una lettura
  // sbagliata della pila (o una scrittura) fa fallire il render con l'errore.
  // `listReviewLog` è tracciata. Ambiente node: renderToStaticMarkup NON esegue le
  // queryFn (le query restano pending), quindi la prova con cache VUOTA è che il
  // render NON tocca `listDue`; la prova con cache SEMINATA è che la serie resa
  // deriva dal SOLO log seminato su `['streak', UID]`.
  function spyPorts(calls: string[]): Ports {
    return {
      clock: { now: () => NOW, timeZone: () => TZ },
      review: {
        listDue: async () => {
          calls.push('listDue');
          throw new Error('listDue non deve essere consultata dalle statistiche');
        },
        listReviewLog: async () => {
          calls.push('listReviewLog');
          return [];
        },
        applyReview: async () => {
          calls.push('applyReview');
        },
      },
      progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
      content: { listLessons: async () => [], listExercisesByIds: async () => [] },
    };
  }

  it('la serie resa deriva dal SOLO log seminato su [streak, userId], senza listDue', () => {
    // Seminiamo SOLO `['streak', UID]`; se la vista leggesse un'altra fonte (pila,
    // review_count) la sua serie non rifletterebbe questo log. `listDue` LANCIA se
    // toccata: un render riuscito dimostra che non è consultata.
    const calls: string[] = [];
    const qc = seededClient([
      logAt('2026-09-24T10:00:00.000Z'),
      logAt('2026-09-25T10:00:00.000Z'),
    ]);
    const markup = render(qc, UID, spyPorts(calls));

    // La serie viene dal log seminato: i due giorni con conteggio 1.
    expect(markup).toContain('2026-09-24 - answers: 1');
    expect(markup).toContain('2026-09-25 - answers: 1');
    // Né listDue né applyReview sono toccate (leggere/scrivere la pila).
    expect(calls).not.toContain('listDue');
    expect(calls).not.toContain('applyReview');
  });
});

describe('AC — parità en/it e microcopy senza celebrazione', () => {
  it('en: nessun `!`, ASCII (nessun code point >= U+2000)', () => {
    const markup = render(
      seededClient([logAt('2026-09-25T10:00:00.000Z')]),
      UID,
    );
    expect(markup).not.toContain('!');
    const offending = [...markup].filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x2000);
    expect(offending).toEqual([]);
  });

  it('it: rende le stesse chiavi in italiano (serie e distribuzione)', async () => {
    await i18n.changeLanguage('it');
    const markup = render(
      seededClient([logAt('2026-09-25T10:00:00.000Z', 'ex-1', 'good')]),
      UID,
    );
    expect(markup).toContain(itCatalog.stats.title);
    expect(markup).toContain(itCatalog.stats.answersOverTime.heading);
    expect(markup).toContain('2026-09-25 - risposte: 1');
    // La distribuzione per stadio in italiano: intestazione ed etichette di stadio.
    expect(markup).toContain(itCatalog.stats.stageDistribution.heading);
    expect(markup).toContain('Stadio 1 - esercizi: 1');
    expect(markup).toContain('Stadio 0 - esercizi: 0');
    expect(markup).toContain(itCatalog.stats.back);
    expect(markup).not.toContain('!');
  });

  it('it: log vuoto ⇒ placeholder italiano (entrambe le sezioni), nessun grafico', async () => {
    await i18n.changeLanguage('it');
    const markup = render(seededClient([]), UID);
    expect(markup).toContain(itCatalog.stats.answersOverTime.empty);
    expect(markup).toContain(itCatalog.stats.stageDistribution.empty);
    expect(markup).not.toContain(itCatalog.stats.answersOverTime.heading);
    expect(markup).not.toContain(itCatalog.stats.stageDistribution.heading);
  });
});
