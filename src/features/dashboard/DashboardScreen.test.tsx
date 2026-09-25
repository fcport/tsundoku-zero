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
 */
function seededClient(opts: {
  dueCount: number;
  log: readonly ReviewLogEntry[];
  unlocked: number;
  total: number;
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
    const loaded = render(
      seededClient({ dueCount: 1, log: [], unlocked: 0, total: 1 }),
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
    const qc = seededClient({ dueCount: 42, log: [], unlocked: 0, total: 0 });
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
    const qc = seededClient({ dueCount: 0, log: [], unlocked: 3, total: 3 });
    const markup = render(qc, UID);

    expect(markup).not.toContain(en.dashboard.primaryAction);
    expect(markup).not.toContain(en.dashboard.unlockAction);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(0);
  });
});
