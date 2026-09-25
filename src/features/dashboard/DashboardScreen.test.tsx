import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { i18n } from '../../i18n';
import { dueQueryKey } from '../../domain/due';
import type { ReviewState } from '../../domain/schedule';
import type { ReviewLogEntry } from '../../domain/streak';
import { PortsProvider, type Ports } from '../ports/PortsContext';
import { DashboardScreen } from './DashboardScreen';

// Righe della I/O & Edge-Case Matrix + gli AC della dashboard (storia 3.12).
// Ambiente `node` (nessun jsdom): renderToStaticMarkup non esegue effetti né
// timer. Con la cache SEMINATA (setQueryData) le query risolvono in modo
// SINCRONO al primo render (stato caricato); una cache vuota resta `pending`
// (scheletro). Entrambi gli stati sono resi staticamente.
//
// Il fuso/orologio ENTRANO dal Clock iniettato (fisso), così lo streak è
// deterministico. Le queryFn non sono invocate quando la cache è già seminata.

const UID = 'user-1';
const NOW = new Date('2026-09-25T12:00:00.000Z');
const TZ = 'UTC';

// Porte in memoria: clock FISSO per uno streak deterministico; i repository sono
// inerti (con cache seminata le queryFn non partono; con cache vuota le lasciamo
// pending non risolvendo — renderToStaticMarkup cattura lo stato iniziale).
const inMemoryPorts: Ports = {
  clock: { now: () => NOW, timeZone: () => TZ },
  review: {
    listDue: async () => [],
    listReviewLog: async () => [],
  },
  progress: { listUnlockedLessonIds: async () => [], unlockLesson: async () => {} },
  content: { listLessons: async () => [] },
};

/** Uno stato di ripasso minimo (i valori non contano: la dashboard usa solo `.length`). */
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

/** Una voce di log per un giorno (mezzogiorno UTC). */
function logAt(iso: string): ReviewLogEntry {
  return { reviewedAt: new Date(iso) };
}

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Semina la cache per lo stato CARICATO: N dovuti, un log, u sbloccate su t
 * lezioni. Le quattro chiavi risolvono in modo sincrono al primo render.
 *
 * Ogni lezione seminata ha `exerciseCount: 1` di DEFAULT, così i test del cancello
 * (3.12/3.13) NON innescano la dichiarazione «senza esercizi» (3.14): il default
 * garantisce che «ultima sbloccata» abbia esercizi salvo override esplicito.
 * `lessonExerciseCounts` sovrascrive per-indice il conteggio (per la lezione
 * concettuale con `count 0`).
 */
function seededClient(opts: {
  dueCount: number;
  log: readonly ReviewLogEntry[];
  unlocked: number;
  total: number;
  lessonExerciseCounts?: readonly number[];
}): QueryClient {
  const qc = freshClient();
  qc.setQueryData(
    dueQueryKey(UID),
    Array.from({ length: opts.dueCount }, (_, i) => due(`ex-${i}`)),
  );
  qc.setQueryData(['streak', UID], opts.log);
  qc.setQueryData(
    ['unlocked', UID],
    Array.from({ length: opts.unlocked }, (_, i) => `lesson-${i}`),
  );
  qc.setQueryData(
    ['lessons'],
    Array.from({ length: opts.total }, (_, i) => ({
      id: `lesson-${i}`,
      ordinal: i,
      title: { en: `L${i}` },
      grammarPoints: [],
      exerciseCount: opts.lessonExerciseCounts?.[i] ?? 1,
    })),
  );
  return qc;
}

function render(qc: QueryClient, userId: string | null): string {
  const el: ReactElement = (
    <QueryClientProvider client={qc}>
      <PortsProvider value={inMemoryPorts}>
        <DashboardScreen userId={userId} />
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

describe('AC1/AC2 — dashboard popolata: conteggio grande, etichetta sotto, streak, curriculum, azione unica', () => {
  // 23 dovuti; log su oggi e ieri (streak = 2 nel fuso UTC); 3 sbloccate su 10.
  const qc = seededClient({
    dueCount: 23,
    log: [logAt('2026-09-24T10:00:00.000Z'), logAt('2026-09-25T10:00:00.000Z')],
    unlocked: 3,
    total: 10,
  });
  const markup = render(qc, UID);

  it('rende il conteggio N nel ruolo text-count-hero (AC1)', () => {
    // Il numero vive nell'elemento con la classe del ruolo più grande.
    expect(markup).toMatch(/class="[^"]*text-count-hero[^"]*"[^>]*>23</);
  });

  it("l'etichetta è resa SOTTO il numero (AC1)", () => {
    const countIndex = markup.indexOf('>23<');
    const labelIndex = markup.indexOf(en.dashboard.dueLabel);
    expect(countIndex).toBeGreaterThanOrEqual(0);
    expect(labelIndex).toBeGreaterThan(countIndex);
  });

  it('mostra lo streak da streak() su review_log (AC2)', () => {
    // Oggi + ieri con attività ⇒ streak = 2 (fuso UTC iniettato).
    expect(markup).toContain('2 day streak');
  });

  it('mostra "u di t lezioni" (sbloccate su totale, AC2)', () => {
    expect(markup).toContain('3 of 10 lessons');
  });

  it('contiene ESATTAMENTE una azione primaria (button-primary, AC2)', () => {
    expect(markup).toContain(en.dashboard.primaryAction);
    // Un solo <button> nel markup della dashboard (nessun doppione, nessuna
    // variante disabilitata).
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it('rende un solo <main> (la dashboard è il landmark)', () => {
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });
});

describe('AC3 — scheletro senza salti', () => {
  it('userId null ⇒ scheletro (aria-busy), stessa classe di altezza del contenuto', () => {
    const markup = render(freshClient(), null);
    expect(markup).toContain('aria-busy="true"');
    // Nessun conteggio né azione: è lo scheletro.
    expect(markup).not.toContain(en.dashboard.primaryAction);
  });

  it('cache vuota (query pending) ⇒ scheletro (aria-busy)', () => {
    const markup = render(freshClient(), UID);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain(en.dashboard.primaryAction);
  });

  it('scheletro e contenuto condividono la stessa classe di altezza (nessun salto)', () => {
    const skeleton = render(freshClient(), null);
    // `unlocked: 1` (non 0): lo stato caricato NORMALE (il primo avvio, `unlocked
    // === 0`, è ora un ramo distinto — 3.15).
    const loaded = render(
      seededClient({ dueCount: 1, log: [], unlocked: 1, total: 1 }),
      UID,
    );
    // La stessa classe min-h-[...] compare sul <main> in entrambi i rami.
    const heightClass = /class="([^"]*min-h-\[[^\]]+\][^"]*)"/;
    const skeletonH = skeleton.match(heightClass)?.[1];
    const loadedH = loaded.match(heightClass)?.[1];
    expect(skeletonH).toBeTruthy();
    expect(skeletonH).toBe(loadedH);
  });

  it('lo scheletro non contiene uno spinner', () => {
    const markup = render(freshClient(), null);
    expect(markup.toLowerCase()).not.toContain('spinner');
    expect(markup).not.toContain('role="status"');
  });
});

describe('AC4 — microcopy: conteggio prima del verbo, nessun !/emoji/"hai N"', () => {
  const qc = seededClient({
    dueCount: 23,
    log: [logAt('2026-09-25T10:00:00.000Z')],
    unlocked: 1,
    total: 5,
  });
  const markup = render(qc, UID);

  it("il conteggio PRECEDE l'etichetta (\"23\" prima di \"to review\")", () => {
    const countIndex = markup.indexOf('>23<');
    const verbIndex = markup.indexOf(en.dashboard.dueLabel);
    expect(countIndex).toBeGreaterThanOrEqual(0);
    expect(verbIndex).toBeGreaterThan(countIndex);
  });

  it('nessun punto esclamativo nel markup della dashboard', () => {
    expect(markup).not.toContain('!');
  });

  it('nessun "you have N" / "hai N" (il conteggio non è preceduto dal possesso)', () => {
    expect(markup.toLowerCase()).not.toContain('you have');
    expect(markup.toLowerCase()).not.toContain('hai ');
  });

  it('nessun carattere CJK/emoji nel markup', () => {
    // In `en` la copy è ASCII: nessun code point >= U+2000 (che coprirebbe
    // punteggiatura CJK, kana, kanji, forme fullwidth ed emoji). Scandendo i code
    // point evitiamo di scrivere CJK letterale nel sorgente (no-irregular-whitespace).
    const offending = [...markup].filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x2000);
    expect(offending).toEqual([]);
  });
});

describe('AC4 — microcopy in italiano (parità: conteggio prima del verbo)', () => {
  it("in `it` l'etichetta è 'da rivedere' e segue il numero", async () => {
    await i18n.changeLanguage('it');
    const qc = seededClient({
      dueCount: 7,
      log: [logAt('2026-09-25T10:00:00.000Z')],
      unlocked: 2,
      total: 4,
    });
    const markup = render(qc, UID);
    const countIndex = markup.indexOf('>7<');
    const verbIndex = markup.indexOf(itCatalog.dashboard.dueLabel);
    expect(verbIndex).toBeGreaterThan(countIndex);
    expect(markup).toContain('2 di 4 lezioni');
    expect(markup).not.toContain('!');
  });
});

describe('AC5 — chiave unica della pila: dueQueryKey(userId) verbatim', () => {
  it('la dashboard legge la cache seminata su dueQueryKey(userId) (nessuna chiave divergente)', () => {
    // Seminiamo SOLO su dueQueryKey; se la dashboard usasse una chiave diversa la
    // sua query resterebbe pending e mostrerebbe lo scheletro invece del conteggio.
    // `unlocked: 1` (non 0): stato caricato NORMALE, non il primo avvio (3.15) che
    // NON rende il `text-count-hero`.
    const qc = seededClient({ dueCount: 42, log: [], unlocked: 1, total: 1 });
    const markup = render(qc, UID);
    expect(markup).toMatch(/text-count-hero[^>]*>42</);
  });
});

describe('AC4 — il cancello: al più una quest, mai entrambe (3.13)', () => {
  it('pila NON vuota ⇒ SOLO svuota-pila, NESSUN unlock; un solo <button>', () => {
    // count > 0 (e ci sono lezioni da sbloccare): il cancello rende solo la
    // svuota-pila. L'azione di sblocco NON è presente, nemmeno disabilitata.
    const qc = seededClient({ dueCount: 5, log: [], unlocked: 1, total: 10 });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.primaryAction);
    expect(markup).not.toContain(en.dashboard.unlockAction);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it('pila vuota + lezione successiva ⇒ SOLO unlock, NESSUN svuota-pila; un solo <button>', () => {
    // count === 0 con una successiva (1 sbloccata su 10): il cancello rende solo
    // l'azione di sblocco. La svuota-pila NON è presente.
    const qc = seededClient({ dueCount: 0, log: [], unlocked: 1, total: 10 });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.unlockAction);
    expect(markup).not.toContain(en.dashboard.primaryAction);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it('pila vuota + curriculum esaurito ⇒ NESSUNA azione (schermata esaurita = 3.16)', () => {
    // count === 0 e next === null (tutte sbloccate): non si rende alcun pulsante.
    // Non crasha, non inventa una schermata: il ramo grezzo mostra ancora i conteggi.
    // Ultima sbloccata con esercizi (default): nessuna dichiarazione «senza esercizi».
    const qc = seededClient({ dueCount: 0, log: [], unlocked: 3, total: 3 });
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.dashboard.primaryAction);
    expect(markup).not.toContain(en.dashboard.unlockAction);
    expect(markup).not.toContain(en.dashboard.noExercisesNotice);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(0);
  });
});

describe('AC2 — dichiarazione della lezione concettuale (3.14)', () => {
  it('pila a zero + ultima sbloccata concettuale ⇒ rende la dichiarazione E l\'azione di sblocco', () => {
    // count === 0; 1 sbloccata su 10 (lastUnlocked = lesson-0, exerciseCount 0);
    // next = lesson-1 (ha esercizi). La dichiarazione compare E l'azione di sblocco
    // resta resa (è AGGIUNTIVA al cancello, non lo sostituisce).
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 1,
      total: 10,
      lessonExerciseCounts: [0],
    });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.noExercisesNotice);
    expect(markup).toContain(en.dashboard.unlockAction);
  });

  it('pila drenata normale (ultima sbloccata CON esercizi) ⇒ NESSUNA dichiarazione', () => {
    // count === 0 ma lastUnlocked.exerciseCount > 0 (default 1): la pila è drenata,
    // non concettuale ⇒ nessuna dichiarazione.
    const qc = seededClient({ dueCount: 0, log: [], unlocked: 2, total: 10 });
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.dashboard.noExercisesNotice);
  });

  it('nulla sbloccato (lastUnlocked === null) ⇒ NESSUNA dichiarazione (primo-avvio = 3.15)', () => {
    // count === 0, unlocked 0 ⇒ lastUnlocked === null: la dichiarazione NON compare
    // (il primo-avvio è 3.15, non questa storia).
    const qc = seededClient({ dueCount: 0, log: [], unlocked: 0, total: 10 });
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.dashboard.noExercisesNotice);
  });

  it('pila NON vuota ⇒ NESSUNA dichiarazione (solo il cancello 3.13)', () => {
    // count > 0: anche con l'ultima sbloccata concettuale, la dichiarazione NON
    // compare (la condizione richiede count === 0).
    const qc = seededClient({
      dueCount: 5,
      log: [],
      unlocked: 1,
      total: 10,
      lessonExerciseCounts: [0],
    });
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.dashboard.noExercisesNotice);
  });

  it('la microcopy della dichiarazione è priva di `!` (nessuna grammatica della celebrazione)', () => {
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 1,
      total: 10,
      lessonExerciseCounts: [0],
    });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.noExercisesNotice);
    expect(markup).not.toContain('!');
  });
});

describe('AC3 — la lezione concettuale conta come sbloccata («u di t lezioni»)', () => {
  it('una concettuale sbloccata è conteggiata fra le sbloccate', () => {
    // 3 sbloccate su 10, l'ultima (lesson-2) concettuale: il conteggio del
    // curriculum resta «3 of 10» — la concettuale è inclusa (ha la sua riga di
    // progresso, quindi `listUnlockedLessonIds` la vede).
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 3,
      total: 10,
      lessonExerciseCounts: [1, 1, 0],
    });
    const markup = render(qc, UID);

    expect(markup).toContain('3 of 10 lessons');
    // Ed è proprio la concettuale ad aver innescato la dichiarazione.
    expect(markup).toContain(en.dashboard.noExercisesNotice);
  });
});

describe('AC1/AC2/AC3/AC4 — stato di primo avvio (unlocked === 0)', () => {
  // Primo avvio: nulla sbloccato, curriculum disponibile. `next` = la prima lezione
  // (ordinal minimo); l'azione la materializza.
  const qc = seededClient({ dueCount: 0, log: [], unlocked: 0, total: 10 });
  const markup = render(qc, UID);

  it('rende la descrizione di cosa fa l\'app (firstRunBody, AC1)', () => {
    expect(markup).toContain(en.dashboard.firstRunBody);
  });

  it('offre UNA sola azione primaria per cominciare (startAction, un solo <button>, AC1)', () => {
    expect(markup).toContain(en.dashboard.startAction);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it('rende un solo <main> (il landmark, con la classe di altezza condivisa)', () => {
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
    expect(markup).toMatch(/<main[^>]*class="[^"]*min-h-\[[^\]]+\]/);
  });

  it('NON porta la copy della pila svuotata: nessun unlockAction (AC2)', () => {
    // Il primo avvio ha copy propria («comincia»); NON porta unlockAction («procedi»).
    expect(markup).not.toContain(en.dashboard.unlockAction);
    expect(markup).not.toContain(en.dashboard.primaryAction);
  });

  it('NON mostra un conteggio a zero: nessun text-count-hero, nessun dueLabel (AC3)', () => {
    expect(markup).not.toContain('text-count-hero');
    expect(markup).not.toContain(en.dashboard.dueLabel);
  });

  it('NON mostra uno streak a zero: nessun «day streak» (AC3)', () => {
    // 0 day streak degenererebbe in un altro zero: non è reso affatto.
    expect(markup).not.toContain('day streak');
    expect(markup).not.toContain('0 day streak');
  });

  it('NON mostra il progresso del curriculum a zero: nessun «of ... lessons» (AC3)', () => {
    // «0 of N lessons» sarebbe un altro zero: il ramo non rende il curriculum.
    expect(markup).not.toContain('of 10 lessons');
    expect(markup).not.toContain('0 of');
  });

  it('la microcopy del primo avvio è priva di `!` (nessuna grammatica della celebrazione, AC5)', () => {
    expect(markup).not.toContain('!');
  });

  it('nessun carattere >= U+2000 nel markup (en ASCII, AC5)', () => {
    const offending = [...markup].filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x2000);
    expect(offending).toEqual([]);
  });
});

describe('AC2 — primo avvio ≠ pila svuotata (testi distinti)', () => {
  it('il primo avvio porta startAction/firstRunBody; la svuotata porta unlockAction', () => {
    // Primo avvio: unlocked 0.
    const firstRun = render(
      seededClient({ dueCount: 0, log: [], unlocked: 0, total: 10 }),
      UID,
    );
    // Pila svuotata: unlocked >= 1, count 0, next != null.
    const drained = render(
      seededClient({ dueCount: 0, log: [], unlocked: 1, total: 10 }),
      UID,
    );

    // Il primo avvio: la sua copy propria, MAI quella della svuotata.
    expect(firstRun).toContain(en.dashboard.startAction);
    expect(firstRun).toContain(en.dashboard.firstRunBody);
    expect(firstRun).not.toContain(en.dashboard.unlockAction);

    // La svuotata: unlockAction, MAI la copy di primo avvio.
    expect(drained).toContain(en.dashboard.unlockAction);
    expect(drained).not.toContain(en.dashboard.startAction);
    expect(drained).not.toContain(en.dashboard.firstRunBody);
  });
});

describe('AC4 — azione = materializza la prima lezione; curriculum vuoto ⇒ nessun pulsante', () => {
  it('curriculum disponibile ⇒ il pulsante cabla startAction (unlockMutation.mutate(next.id))', () => {
    // next = lesson-0 (ordinal minimo): il pulsante di primo avvio la materializza.
    const markup = render(
      seededClient({ dueCount: 0, log: [], unlocked: 0, total: 3 }),
      UID,
    );
    expect(markup).toContain(en.dashboard.startAction);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it('curriculum vuoto (total 0 ⇒ next === null) ⇒ solo la descrizione, NESSUN pulsante', () => {
    // unlocked 0 e total 0 (mai in produzione): firstRunBody senza azione.
    const markup = render(
      seededClient({ dueCount: 0, log: [], unlocked: 0, total: 0 }),
      UID,
    );
    expect(markup).toContain(en.dashboard.firstRunBody);
    expect(markup).not.toContain(en.dashboard.startAction);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(0);
  });
});
