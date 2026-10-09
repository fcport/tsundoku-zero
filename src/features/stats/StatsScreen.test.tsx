import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { i18n } from '../../i18n';
import { MIN_ANSWER_DAYS } from '../../domain/answersOverTime';
import type { ReviewLogRecord } from '../../domain/streak';
import type { ReviewOutcome } from '../../domain/schedule';
import type { LessonSummary } from '../../domain/ports/contentRepository';
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
  progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {}, addLessonExercises: async () => 0, listActiveExerciseCounts: async () => new Map() },
  content: { listLessons: async () => [], listExercisesByIds: async () => [], listExercisesByLesson: async () => [], listExerciseLessons: async () => new Map() },
};

// Una voce di log COMPLETA (`ReviewLogRecord`): `answersOverTime` legge solo
// `reviewedAt`, `stageDistribution` legge `exerciseId`/`outcome`,
// `grammarPointErrorRates` legge `grammarPoint`/`outcome`. Default `ex-1`/`good`/
// `gp-1` per i test della serie (dove l'esercizio/esito/punto non contano); i test
// della distribuzione e dei tassi d'errore passano i campi espliciti.
function logAt(
  iso: string,
  exerciseId = 'ex-1',
  outcome: ReviewOutcome = 'good',
  grammarPoint = 'gp-1',
): ReviewLogRecord {
  return { reviewedAt: new Date(iso), exerciseId, outcome, grammarPoint };
}

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Semina la cache del log sulla STESSA chiave `['streak', UID]` della dashboard, e
 * il catalogo delle lezioni sulla STESSA chiave `['lessons']` (default `[]`) cosi il
 * gate scheletro non scatta per la query dei contenuti.
 */
function seededClient(
  log: readonly ReviewLogRecord[],
  lessons: readonly LessonSummary[] = [],
): QueryClient {
  const qc = freshClient();
  qc.setQueryData(['streak', UID], log);
  qc.setQueryData(['lessons'], lessons);
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

describe('3.23 — il <main> compone il contenitore responsive condiviso (parità di schermata)', () => {
  // La classe di `src/ui/layout.ts` (`RESPONSIVE_CONTAINER`): colonna centrata a
  // `measure`, gutter 20/32px. Un test qui evita che la schermata perda il
  // contenitore senza che alcun test fallisca. Vale sia sullo scheletro sia sul
  // contenuto (stesso `CONTAINER` in entrambi i rami, nessun ramo per dispositivo).
  it('contenuto: il <main> porta max-w-measure, px-gutter-mobile, sm:px-gutter-desktop', () => {
    const markup = render(seededClient([]), UID);
    expect(markup).toMatch(/<main[^>]*class="[^"]*max-w-measure[^"]*"/);
    expect(markup).toMatch(/<main[^>]*class="[^"]*px-gutter-mobile[^"]*"/);
    expect(markup).toMatch(/<main[^>]*class="[^"]*sm:px-gutter-desktop[^"]*"/);
  });

  it('scheletro: lo stesso <main> porta le stesse classi responsive (userId null)', () => {
    const markup = render(freshClient(), null);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toMatch(/<main[^>]*class="[^"]*max-w-measure[^"]*"/);
    expect(markup).toMatch(/<main[^>]*class="[^"]*px-gutter-mobile[^"]*"/);
    expect(markup).toMatch(/<main[^>]*class="[^"]*sm:px-gutter-desktop[^"]*"/);
  });
});

describe('AC1 — serie con dati: intestazione + conteggi per giorno come testo', () => {
  // Log su 23, 24 e 25 (fuso UTC): serie contigua [23: 1, 24: 1, 25: 1]. TRE giorni
  // distinti con risposte (>= MIN_ANSWER_DAYS): il grafico temporale e meaningful (5.4).
  const qc = seededClient([
    logAt('2026-09-23T10:00:00.000Z'),
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
    // Il dayLabel interpola {{date}} (per esteso) e {{answers}}: il giorno e il suo conteggio,
    // in forma etichetta-valore (nessuna concordanza di numero).
    expect(markup).toContain('Wednesday 23 September - answers: 1');
    expect(markup).toContain('Thursday 24 September - answers: 1');
    expect(markup).toContain('Friday 25 September - answers: 1');
  });

  it('rende un solo <main> (il landmark)', () => {
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });

  it('offre un\'affordance di ritorno (stats.back)', () => {
    expect(markup).toContain(en.stats.back);
  });

  it('non porta la dichiarazione di dati insufficienti (serie sufficiente)', () => {
    // A tre giorni distinti il grafico e meaningful: nessuna dichiarazione «servono
    // almeno N giorni» (5.4). Confronto sulla resa interpolata della chiave.
    expect(markup).not.toContain(
      i18n.t('stats.answersOverTime.insufficient', {
        needed: MIN_ANSWER_DAYS,
        soFar: 3,
      }),
    );
  });

  it("l'affordance di ritorno porta l'anello di focus da tastiera (focus-visible)", () => {
    // Lo STESSO token della sessione (schermata su cui StatsScreen è modellata):
    // gli interattivi devono esporre l'anello per navigazione da tastiera.
    expect(markup).toContain('focus-visible:outline-focus-ring');
  });
});

describe('AC1 — ultima risposta nel passato ⇒ la serie si estende fino a oggi (code a 0 come TESTO)', () => {
  // Risposte su 21, 22, 23 (UTC): TRE giorni distinti (>= MIN_ANSWER_DAYS, serie
  // meaningful, 5.4); NOW è il 25, quindi la serie contigua e [21:1, 22:1, 23:1, 24:0,
  // 25:0]. Verifica alla SUPERFICIE della vista (non solo del dominio) che i giorni di
  // CODA a conteggio 0 compaiano come TESTO ("answers: 0") — la contiguità che l'AC1
  // osserva, resa solo perche il grafico e sufficiente.
  const qc = seededClient([
    logAt('2026-09-21T10:00:00.000Z'),
    logAt('2026-09-22T10:00:00.000Z'),
    logAt('2026-09-23T10:00:00.000Z'),
  ]);
  const markup = render(qc, UID);

  it('rende i giorni con risposta e i giorni di coda a 0 come testo', () => {
    expect(markup).toContain('Wednesday 23 September - answers: 1');
    expect(markup).toContain('Thursday 24 September - answers: 0');
    expect(markup).toContain('Friday 25 September - answers: 0');
  });

  it('NON rende la dichiarazione di dati insufficienti (tre giorni distinti)', () => {
    // I giorni di coda a 0 NON contano verso la soglia (daysWithAnswers esclude gli
    // zeri): qui i tre giorni pieni bastano, quindi nessuna dichiarazione (5.4).
    expect(markup).not.toContain(
      i18n.t('stats.answersOverTime.insufficient', {
        needed: MIN_ANSWER_DAYS,
        soFar: 3,
      }),
    );
  });
});

describe('AC1 — più risposte lo stesso giorno ⇒ un solo giorno col conteggio sommato', () => {
  it('tre risposte il 25 (+ due altri giorni per la soglia) ⇒ «Friday 25 September - answers: 3»', () => {
    // Tre risposte il 25 sommano nello stesso giorno; il 23 e il 24 portano un'altra
    // risposta ciascuno perche il grafico raggiunga MIN_ANSWER_DAYS giorni distinti e
    // sia reso (5.4). Il giorno pieno che l'AC osserva resta il 25 con conteggio 3.
    const qc = seededClient([
      logAt('2026-09-23T10:00:00.000Z'),
      logAt('2026-09-24T10:00:00.000Z'),
      logAt('2026-09-25T01:00:00.000Z'),
      logAt('2026-09-25T10:00:00.000Z'),
      logAt('2026-09-25T20:00:00.000Z'),
    ]);
    const markup = render(qc, UID);
    expect(markup).toContain('Friday 25 September - answers: 3');
  });
});

// I test 5.4 (FR7.5): il grafico temporale e MEANINGFUL solo con risposte su almeno
// MIN_ANSWER_DAYS giorni distinti. Sotto soglia rende SOLO una dichiarazione
// quantificata («servono almeno N giorni; finora M»), mai un grafico sparso; le tre
// viste decidono la sufficienza INDIPENDENTEMENTE (UX-DR18).
describe('5.4 AC1 — temporale sotto soglia ⇒ dichiarazione quantificata, nessun grafico', () => {
  // Risposte su 24 e 25 (DUE giorni distinti < MIN_ANSWER_DAYS): insufficiente.
  const qc = seededClient([
    logAt('2026-09-24T10:00:00.000Z'),
    logAt('2026-09-25T10:00:00.000Z'),
  ]);
  const markup = render(qc, UID);

  it('rende la dichiarazione quantificata (soglia + giorni finora)', () => {
    // Nomina COSA manca e QUANTO: la soglia MIN_ANSWER_DAYS e i giorni finora (2).
    expect(markup).toContain(
      i18n.t('stats.answersOverTime.insufficient', {
        needed: MIN_ANSWER_DAYS,
        soFar: 2,
      }),
    );
  });

  it('NON rende l\'intestazione del temporale ne le barre della serie', () => {
    expect(markup).not.toContain(en.stats.answersOverTime.heading);
    // La dichiarazione non e una lista di barre: nessun conteggio per-giorno reso.
    expect(markup).not.toContain('Thursday 24 September - answers:');
    expect(markup).not.toContain('Friday 25 September - answers:');
  });

  it('interpola soFar corretto (2) e la soglia dal dominio (nessun 3 letterale nel codice)', () => {
    // La copy nomina esattamente due giorni finora e la soglia MIN_ANSWER_DAYS.
    expect(markup).toContain('Days so far: 2.');
    expect(markup).toContain(`at least ${MIN_ANSWER_DAYS} different days`);
  });
});

describe('5.4 AC1/AC2 — confine della soglia: 2 giorni insufficiente, 3 giorni sufficiente', () => {
  it('due giorni distinti ⇒ insufficiente (dichiarazione, nessuna intestazione)', () => {
    const markup = render(
      seededClient([
        logAt('2026-09-24T10:00:00.000Z'),
        logAt('2026-09-25T10:00:00.000Z'),
      ]),
      UID,
    );
    expect(markup).toContain(
      i18n.t('stats.answersOverTime.insufficient', {
        needed: MIN_ANSWER_DAYS,
        soFar: 2,
      }),
    );
    expect(markup).not.toContain(en.stats.answersOverTime.heading);
  });

  it('tre giorni distinti (la soglia esatta) ⇒ sufficiente (intestazione + barre)', () => {
    const markup = render(
      seededClient([
        logAt('2026-09-23T10:00:00.000Z'),
        logAt('2026-09-24T10:00:00.000Z'),
        logAt('2026-09-25T10:00:00.000Z'),
      ]),
      UID,
    );
    expect(markup).toContain(en.stats.answersOverTime.heading);
    expect(markup).toContain('Wednesday 23 September - answers: 1');
    expect(markup).toContain('Friday 25 September - answers: 1');
    // A soglia esatta nessuna dichiarazione di insufficienza.
    expect(markup).not.toContain(
      i18n.t('stats.answersOverTime.insufficient', {
        needed: MIN_ANSWER_DAYS,
        soFar: 3,
      }),
    );
  });
});

describe('5.4 AC — indipendenza delle viste: 5 esercizi in UN giorno', () => {
  // Cinque esercizi tutti risposti il 25 (UN solo giorno di calendario): il grafico
  // temporale e insufficiente (daysWithAnswers = 1 < MIN_ANSWER_DAYS) MENTRE la
  // distribuzione e i tassi rendono i loro dati reali (assi categoriali, meaningful
  // con qualunque dato). UX-DR18: le tre viste decidono INDIPENDENTEMENTE.
  const qc = seededClient([
    logAt('2026-09-25T01:00:00.000Z', 'ex-1', 'again', 'gp-1'),
    logAt('2026-09-25T02:00:00.000Z', 'ex-2', 'good', 'gp-1'),
    logAt('2026-09-25T03:00:00.000Z', 'ex-3', 'good', 'gp-1'),
    logAt('2026-09-25T04:00:00.000Z', 'ex-4', 'good', 'gp-1'),
    logAt('2026-09-25T05:00:00.000Z', 'ex-5', 'good', 'gp-1'),
  ]);
  const markup = render(qc, UID);

  it('temporale insufficiente: dichiarazione «finora 1», nessuna intestazione temporale', () => {
    expect(markup).toContain(
      i18n.t('stats.answersOverTime.insufficient', {
        needed: MIN_ANSWER_DAYS,
        soFar: 1,
      }),
    );
    expect(markup).not.toContain(en.stats.answersOverTime.heading);
  });

  it('distribuzione resa coi dati reali (non e insufficiente)', () => {
    // Cinque esercizi: quattro allo stadio 1 (un `good`), uno allo stadio 0 (`again`).
    expect(markup).toContain(en.stats.stageDistribution.heading);
    expect(markup).toContain('Level 0 - exercises: 1');
    expect(markup).toContain('Level 1 - exercises: 4');
    expect(markup).not.toContain(en.stats.stageDistribution.empty);
  });

  it('tassi d errore resi coi dati reali (non e insufficiente)', () => {
    // gp-1: un errore (`again`) su cinque risposte.
    expect(markup).toContain(en.stats.grammarPointErrorRates.heading);
    expect(markup).toContain('errors: 1 of 5');
    expect(markup).not.toContain(en.stats.grammarPointErrorRates.empty);
  });
});

describe('AC5 — log vuoto ⇒ dichiarazione quantificata «cosa manca e quanto», NON un grafico', () => {
  const qc = seededClient([]);
  const markup = render(qc, UID);

  it('rende comunque il titolo di schermata (stats.title, in entrambi gli stati)', () => {
    expect(markup).toContain(en.stats.title);
  });

  it('rende una dichiarazione quantificata in tutte e tre le sezioni (5.4)', () => {
    // Temporale: la soglia (MIN_ANSWER_DAYS) e i giorni finora (0) interpolati.
    expect(markup).toContain(
      i18n.t('stats.answersOverTime.insufficient', {
        needed: MIN_ANSWER_DAYS,
        soFar: 0,
      }),
    );
    // AC5 di 5.2: la distribuzione dichiara il minimo onesto («almeno un esercizio»).
    expect(markup).toContain(en.stats.stageDistribution.empty);
    // AC5 di 5.3: i tassi d'errore dichiarano il minimo onesto («almeno una risposta»).
    expect(markup).toContain(en.stats.grammarPointErrorRates.empty);
  });

  it("NON rende le intestazioni delle sezioni né una barra (nessun grafico vuoto)", () => {
    expect(markup).not.toContain(en.stats.answersOverTime.heading);
    expect(markup).not.toContain(en.stats.stageDistribution.heading);
    expect(markup).not.toContain(en.stats.grammarPointErrorRates.heading);
    // Nessuna lista di barre: nessun <ol>/<li> reso (serie, distribuzione o tassi).
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
  // Le risposte sono sparse su 19, 20 e 21 (TRE giorni distinti >= MIN_ANSWER_DAYS)
  // cosi ANCHE il grafico temporale e reso: entrambe le sezioni compaiono nello stesso
  // <main> (5.4). Lo stadio finale di ogni esercizio non dipende dal giorno di
  // calendario, solo dalla sequenza di esiti.
  const qc = seededClient([
    logAt('2026-09-19T10:00:00.000Z', 'ex-A', 'good'),
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
    expect(markup).toContain('Level 0 - exercises: 0');
    expect(markup).toContain('Level 1 - exercises: 1');
    expect(markup).toContain('Level 2 - exercises: 2');
    expect(markup).toContain('Level 3 - exercises: 0');
    expect(markup).toContain('Level 4 - exercises: 0');
    expect(markup).toContain('Level 5 - exercises: 0');
    // Nessun settimo stadio.
    expect(markup).not.toContain('Level 6 -');
  });

  it('include uno stadio a conteggio 0 come testo (asse contiguo, zeri inclusi)', () => {
    expect(markup).toContain('Level 0 - exercises: 0');
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
    expect(markup).toContain('Level 0 - exercises: 1');
    expect(markup).toContain('Level 1 - exercises: 0');
    expect(markup).toContain('Level 2 - exercises: 0');
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
      progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {}, addLessonExercises: async () => 0, listActiveExerciseCounts: async () => new Map() },
      content: { listLessons: async () => [], listExercisesByIds: async () => [], listExercisesByLesson: async () => [], listExerciseLessons: async () => new Map() },
    };
    const qc = seededClient([logAt('2026-09-25T10:00:00.000Z', 'ex-1', 'good')]);
    const markup = render(qc, UID, spyPorts);

    // La distribuzione riflette il SOLO log seminato: un esercizio allo stadio 1.
    expect(markup).toContain('Level 1 - exercises: 1');
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

  it('log seminato ma lezioni pending ⇒ scheletro (il gate attende anche [lessons])', () => {
    // Stato RAGGIUNGIBILE: `['streak', UID]` seminato mentre `['lessons']` e ancora
    // pending (non seminato). Il gate scheletro attende ENTRAMBE (`lessonsQ.data ===
    // undefined`): senza questa clausola `lessonsByGrammarPoint(undefined)` andrebbe
    // in crash. Nessuna intestazione delle tre sezioni compare.
    const qc = freshClient();
    qc.setQueryData(['streak', UID], [logAt('2026-09-25T10:00:00.000Z')]);
    const markup = render(qc, UID);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain(en.stats.answersOverTime.heading);
    expect(markup).not.toContain(en.stats.stageDistribution.heading);
    expect(markup).not.toContain(en.stats.grammarPointErrorRates.heading);
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
      progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {}, addLessonExercises: async () => 0, listActiveExerciseCounts: async () => new Map() },
      content: { listLessons: async () => [], listExercisesByIds: async () => [], listExercisesByLesson: async () => [], listExerciseLessons: async () => new Map() },
    };
  }

  it('la serie resa deriva dal SOLO log seminato su [streak, userId], senza listDue', () => {
    // Seminiamo SOLO `['streak', UID]`; se la vista leggesse un'altra fonte (pila,
    // review_count) la sua serie non rifletterebbe questo log. `listDue` LANCIA se
    // toccata: un render riuscito dimostra che non è consultata. Tre giorni distinti
    // (>= MIN_ANSWER_DAYS) cosi il grafico temporale e reso e la serie e osservabile.
    const calls: string[] = [];
    const qc = seededClient([
      logAt('2026-09-23T10:00:00.000Z'),
      logAt('2026-09-24T10:00:00.000Z'),
      logAt('2026-09-25T10:00:00.000Z'),
    ]);
    const markup = render(qc, UID, spyPorts(calls));

    // La serie viene dal log seminato: i tre giorni con conteggio 1.
    expect(markup).toContain('Wednesday 23 September - answers: 1');
    expect(markup).toContain('Thursday 24 September - answers: 1');
    expect(markup).toContain('Friday 25 September - answers: 1');
    // Né listDue né applyReview sono toccate (leggere/scrivere la pila).
    expect(calls).not.toContain('listDue');
    expect(calls).not.toContain('applyReview');
  });
});

// I test 5.3: i tassi d'errore per punto grammaticale (FR7.3). Il punto grammaticale
// del log e reso in `lang="ja"`; ogni voce NOMINA la lezione che lo insegna (titolo
// risolto), o un fallback neutro per un punto orfano. La fonte e il SOLO log +
// catalogo; parita en/it.
describe('5.3 AC — tassi d errore per punto grammaticale: punto in lang="ja" + nome lezione', () => {
  // Un punto (`gp-shite`) su due esercizi diversi ma stesso punto, con un `again` e
  // un `good` ⇒ una sola voce (per punto, non per esercizio). Una lezione lo insegna.
  const lessons: readonly LessonSummary[] = [
    {
      id: 'gp-shite',
      ordinal: 1,
      title: { en: 'The shite-form' },
      grammarPoints: ['gp-shite'],
      exerciseCount: 2,
    },
  ];
  const qc = seededClient(
    [
      logAt('2026-09-20T10:00:00.000Z', 'ex-A', 'again', 'gp-shite'),
      logAt('2026-09-21T10:00:00.000Z', 'ex-B', 'good', 'gp-shite'),
    ],
    lessons,
  );
  const markup = render(qc, UID);

  it("rende l'intestazione dei tassi d'errore per punto", () => {
    expect(markup).toContain(en.stats.grammarPointErrorRates.heading);
  });

  it('rende il punto grammaticale in un nodo lang="ja"', () => {
    expect(markup).toMatch(/lang="ja"[^>]*>gp-shite/);
  });

  it('rende il tasso come TESTO (errori su totale)', () => {
    // Un `again` su due risposte ⇒ errori 1 su 2.
    expect(markup).toContain('errors: 1 of 2');
  });

  it('NOMINA la lezione che insegna il punto (titolo risolto)', () => {
    expect(markup).toContain('The shite-form');
  });

  it('NON rende il placeholder dei tassi (il log non e vuoto)', () => {
    expect(markup).not.toContain(en.stats.grammarPointErrorRates.empty);
  });

  it('aggrega per punto: un solo <li> con gp-shite (due esercizi, una voce)', () => {
    const occurrences = markup.match(/>gp-shite/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});

describe('5.3 AC — punto ORFANO (assente da ogni lezione) ⇒ fallback neutro, nessun crash', () => {
  it('un punto del log assente dal catalogo rende il fallback unknownLesson', () => {
    // Catalogo con una lezione che NON insegna il punto del log.
    const lessons: readonly LessonSummary[] = [
      {
        id: 'gp-other',
        ordinal: 1,
        title: { en: 'Another lesson' },
        grammarPoints: ['gp-other'],
        exerciseCount: 1,
      },
    ];
    const qc = seededClient(
      [logAt('2026-09-20T10:00:00.000Z', 'ex-1', 'again', 'gp-orphan')],
      lessons,
    );
    const markup = render(qc, UID);
    // La voce compare comunque col punto e il tasso, e il fallback neutro.
    expect(markup).toMatch(/lang="ja"[^>]*>gp-orphan/);
    expect(markup).toContain('errors: 1 of 1');
    expect(markup).toContain(en.stats.grammarPointErrorRates.unknownLesson);
    // Il titolo dell'altra lezione NON compare (non insegna questo punto).
    expect(markup).not.toContain('Another lesson');
  });
});

describe('5.3 AC — log vuoto ⇒ placeholder testuale neutro, NON un grafico', () => {
  it('nessun <ol> della terza sezione a log vuoto', () => {
    const markup = render(seededClient([]), UID);
    expect(markup).toContain(en.stats.grammarPointErrorRates.empty);
    expect(markup).not.toContain(en.stats.grammarPointErrorRates.heading);
  });
});

describe('5.3 AC — la fonte e SOLO review.listReviewLog() + content.listLessons()', () => {
  it("i tassi resi derivano dal SOLO log + catalogo seminati, senza listDue", () => {
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
      progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {}, addLessonExercises: async () => 0, listActiveExerciseCounts: async () => new Map() },
      content: {
        listLessons: async () => {
          calls.push('listLessons');
          return [];
        },
        listExercisesByIds: async () => [],
        listExercisesByLesson: async () => [], listExerciseLessons: async () => new Map(),
      },
    };
    const lessons: readonly LessonSummary[] = [
      {
        id: 'gp-1',
        ordinal: 1,
        title: { en: 'Lesson one' },
        grammarPoints: ['gp-1'],
        exerciseCount: 1,
      },
    ];
    const qc = seededClient(
      [logAt('2026-09-25T10:00:00.000Z', 'ex-1', 'again', 'gp-1')],
      lessons,
    );
    const markup = render(qc, UID, spyPorts);

    // Il tasso riflette il SOLO log seminato: un errore su un totale.
    expect(markup).toContain('errors: 1 of 1');
    expect(markup).toContain('Lesson one');
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
    // Esclusi i nodi `lang="ja"`: sono contenuto giapponese (il marchio sul dorso
    // della cornice «rivista»), non copy dell'interfaccia.
    const copy = markup.replace(/<span lang="ja">[\s\S]*?<\/span>/g, '');
    const offending = [...copy].filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x2000);
    expect(offending).toEqual([]);
  });

  it('it: rende le stesse chiavi in italiano (serie, distribuzione e tassi)', async () => {
    await i18n.changeLanguage('it');
    const lessons: readonly LessonSummary[] = [
      {
        id: 'gp-1',
        ordinal: 1,
        title: { en: 'The te-form', it: 'La forma in te' },
        grammarPoints: ['gp-1'],
        exerciseCount: 1,
      },
    ];
    // Lo STESSO esercizio ex-1 risposto `again` su 23, 24 e 25 (TRE giorni distinti,
    // >= MIN_ANSWER_DAYS): il grafico temporale e reso (5.4). ex-1 resta allo stadio 0
    // (una serie di `again`), quindi un solo esercizio allo stadio 0; gp-1 accumula
    // tre errori su tre risposte.
    const markup = render(
      seededClient(
        [
          logAt('2026-09-23T10:00:00.000Z', 'ex-1', 'again', 'gp-1'),
          logAt('2026-09-24T10:00:00.000Z', 'ex-1', 'again', 'gp-1'),
          logAt('2026-09-25T10:00:00.000Z', 'ex-1', 'again', 'gp-1'),
        ],
        lessons,
      ),
      UID,
    );
    expect(markup).toContain(itCatalog.stats.title);
    expect(markup).toContain(itCatalog.stats.answersOverTime.heading);
    expect(markup).toContain('venerdì 25 settembre - risposte: 1');
    // La distribuzione per stadio in italiano: intestazione ed etichette di stadio.
    expect(markup).toContain(itCatalog.stats.stageDistribution.heading);
    expect(markup).toContain('Livello 0 - esercizi: 1');
    // I tassi d'errore per punto in italiano: intestazione, tasso, titolo risolto (it).
    expect(markup).toContain(itCatalog.stats.grammarPointErrorRates.heading);
    expect(markup).toContain('errori: 3 su 3');
    expect(markup).toContain('La forma in te');
    expect(markup).toContain(itCatalog.stats.back);
    expect(markup).not.toContain('!');
  });

  it('it: log vuoto ⇒ dichiarazione quantificata italiana (tutte e tre le sezioni), nessun grafico', async () => {
    await i18n.changeLanguage('it');
    const markup = render(seededClient([]), UID);
    // Temporale: la soglia (MIN_ANSWER_DAYS) e i giorni finora (0) interpolati in it.
    expect(markup).toContain(
      i18n.t('stats.answersOverTime.insufficient', {
        needed: MIN_ANSWER_DAYS,
        soFar: 0,
      }),
    );
    expect(markup).toContain(itCatalog.stats.stageDistribution.empty);
    expect(markup).toContain(itCatalog.stats.grammarPointErrorRates.empty);
    expect(markup).not.toContain(itCatalog.stats.answersOverTime.heading);
    expect(markup).not.toContain(itCatalog.stats.stageDistribution.heading);
    expect(markup).not.toContain(itCatalog.stats.grammarPointErrorRates.heading);
  });
});

// La serie, il calendario e i traguardi (07-10-2026). NOW = 25 settembre 2026, UTC.
describe('la serie, il calendario e i traguardi', () => {
  // 22, 23 e (24 saltato, giorno libero) 25: serie di 3 giorni di studio.
  const LOG = [
    logAt('2026-09-22T10:00:00.000Z'),
    logAt('2026-09-23T10:00:00.000Z'),
    logAt('2026-09-25T10:00:00.000Z'),
  ];

  it('la serie: giorni, record, la regola del giorno libero e quando torna', () => {
    const markup = render(seededClient(LOG), UID);
    expect(markup).toContain(en.stats.streak.heading);
    expect(markup).toContain('3 day streak');
    expect(markup).toContain('Longest streak: 3');
    expect(markup).toContain(en.stats.streak.rule);
    expect(markup).toContain(
      'You skipped Thursday 24 September without losing your streak. You can skip the next day from Thursday 1 October.',
    );
  });

  it('giorno saltato senza perdere la serie ⇒ accanto, il tanuki si stiracchia', () => {
    expect(render(seededClient(LOG), UID)).toContain('data-mascot="stretch"');
    // Senza giorni saltati, niente tanuki.
    const noSkip = [logAt('2026-09-23T10:00:00.000Z'), logAt('2026-09-24T10:00:00.000Z'), logAt('2026-09-25T10:00:00.000Z')];
    expect(render(seededClient(noSkip), UID)).not.toContain('data-mascot');
  });

  it('il calendario: la frase per l’AT, poi i numeri degli ultimi giorni', () => {
    const markup = render(seededClient(LOG), UID);
    expect(markup).toContain(
      'In the last 26 weeks you answered on 3 different days, 3 answers in all.',
    );
    expect(markup).toContain('The last 14 days');
    expect(markup).toContain('Thursday 24 September - answers: 0');
  });

  it('i traguardi compaiono con la lezione di ogni esercizio, con le soglie e il massimo', () => {
    const qc = seededClient(LOG);
    expect(render(qc, UID)).not.toContain(en.stats.milestones.heading);
    qc.setQueryData(['exerciseLessons'], new Map());
    const markup = render(qc, UID);
    expect(markup).toContain(en.stats.milestones.heading);
    expect(markup).toContain(en.stats.milestones.family.streak);
    expect(markup).toContain('Days in a row: 7');
    expect(markup).toContain('So far: 3');
  });

  it('log vuoto: né serie né traguardi', () => {
    const qc = seededClient([]);
    qc.setQueryData(['exerciseLessons'], new Map());
    const markup = render(qc, UID);
    expect(markup).not.toContain(en.stats.streak.heading);
    expect(markup).not.toContain(en.stats.milestones.heading);
  });
});
