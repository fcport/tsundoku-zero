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
import type { UnlockedLesson } from '../../domain/ports/progressRepository';
import type { SettingsRepository } from '../../domain/ports/settingsRepository';
import { DEFAULT_LESSONS_PER_DAY } from '../../domain/unlockPace';
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
  progress: { listUnlockedLessons: async () => [], unlockLesson: async () => {} },
  content: { listLessons: async () => [] },
};

// Porta impostazioni finta inerte (nuova prop 3.17): con la cache seminata la
// queryFn del tetto non parte; la lasciamo comunque totale.
const inertSettings: SettingsRepository = {
  loadLocale: async () => null,
  saveLocale: async () => {},
  loadLessonsPerDay: async () => null,
  saveLessonsPerDay: async () => {},
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

// Istante NEL PASSATO (giorno locale precedente a NOW nel fuso UTC): uno sblocco
// così datato NON conta in `unlocksToday`, così i test del cancello che non
// riguardano il tetto (3.12-3.16) restano invariati (`unlocksToday = 0 < cap`).
const PAST = new Date('2026-09-20T12:00:00.000Z');
// Istante DI OGGI (stesso giorno locale di NOW): uno sblocco così datato conta in
// `unlocksToday`, usato dai test del tetto (3.17).
const TODAY = new Date('2026-09-25T09:00:00.000Z');

/**
 * Semina la cache per lo stato CARICATO: N dovuti, un log, u sbloccate su t
 * lezioni, il tetto giornaliero. Le cinque chiavi risolvono in modo sincrono al
 * primo render.
 *
 * Ogni lezione seminata ha `exerciseCount: 1` di DEFAULT, così i test del cancello
 * (3.12/3.13) NON innescano la dichiarazione «senza esercizi» (3.14): il default
 * garantisce che «ultima sbloccata» abbia esercizi salvo override esplicito.
 * `lessonExerciseCounts` sovrascrive per-indice il conteggio (per la lezione
 * concettuale con `count 0`).
 *
 * Il read-model unico (3.17) porta `unlockedAt`: le prime `unlockedTodayCount`
 * sbloccate hanno un istante DI OGGI (contano nel tetto), le altre un istante NEL
 * PASSATO (non contano). Di DEFAULT `unlockedTodayCount = 0` (tutte nel passato,
 * `unlocksToday = 0`), così i test non-tetto non sono mai capped. `lessonsPerDay`
 * di DEFAULT è `DEFAULT_LESSONS_PER_DAY` (1).
 */
function seededClient(opts: {
  dueCount: number;
  log: readonly ReviewLogEntry[];
  unlocked: number;
  total: number;
  lessonExerciseCounts?: readonly number[];
  lessonsPerDay?: number;
  unlockedTodayCount?: number;
}): QueryClient {
  const qc = freshClient();
  qc.setQueryData(
    dueQueryKey(UID),
    Array.from({ length: opts.dueCount }, (_, i) => due(`ex-${i}`)),
  );
  qc.setQueryData(['streak', UID], opts.log);
  const unlockedToday = opts.unlockedTodayCount ?? 0;
  qc.setQueryData(
    ['unlocked', UID],
    Array.from(
      { length: opts.unlocked },
      (_, i): UnlockedLesson => ({
        lessonId: `lesson-${i}`,
        // Le prime `unlockedToday` sbloccate contano come «oggi»; le altre no.
        unlockedAt: i < unlockedToday ? TODAY : PAST,
      }),
    ),
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
  qc.setQueryData(
    ['lessonsPerDay', UID],
    opts.lessonsPerDay ?? DEFAULT_LESSONS_PER_DAY,
  );
  return qc;
}

function render(qc: QueryClient, userId: string | null): string {
  const el: ReactElement = (
    <QueryClientProvider client={qc}>
      <PortsProvider value={inMemoryPorts}>
        <DashboardScreen userId={userId} settings={inertSettings} />
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
    // Il pile-counter CAMBIA STATO (3.16): dichiara curriculumCompleteBody, non «0».
    // Ultima sbloccata con esercizi (default): nessuna dichiarazione «senza esercizi».
    const qc = seededClient({ dueCount: 0, log: [], unlocked: 3, total: 3 });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.curriculumCompleteBody);
    expect(markup).not.toContain('text-count-hero');
    expect(markup).not.toContain(`>${en.dashboard.dueLabel}<`);
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

  it('pila drenata normale (ultima sbloccata CON esercizi) ⇒ clearedBody, non noExercisesNotice', () => {
    // count === 0 ma lastUnlocked.exerciseCount > 0 (default 1) e next != null: la
    // pila è drenata, non concettuale ⇒ clearedBody (3.16), MAI noExercisesNotice.
    const qc = seededClient({ dueCount: 0, log: [], unlocked: 2, total: 10 });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.clearedBody);
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

describe('Storia 3.16 — il pile-counter a zero CAMBIA STATO (AC1/AC2/AC3)', () => {
  it('AC1 — pila svuotata, lezioni disponibili ⇒ clearedBody, unlockAction, NESSUNO «0»', () => {
    // count === 0, unlocked > 0, next != null, ultima con esercizi (default): il
    // conteggio NON diventa «0» (nessun text-count-hero/dueLabel), dichiara
    // clearedBody, e l'unica azione è unlockAction. Streak e curriculum restano resi.
    const qc = seededClient({
      dueCount: 0,
      log: [logAt('2026-09-25T10:00:00.000Z')],
      unlocked: 2,
      total: 10,
    });
    const markup = render(qc, UID);

    // Il contatore ha cambiato stato: niente «0», niente etichetta del conteggio
    // resa come proprio elemento (`>to review<`; la sottostringa "to review"
    // compare dentro clearedBody, quindi si asserisce l'elemento, non la sottostringa).
    expect(markup).not.toContain('text-count-hero');
    expect(markup).not.toContain(`>${en.dashboard.dueLabel}<`);
    // Dichiara il perché la pila è vuota.
    expect(markup).toContain(en.dashboard.clearedBody);
    expect(markup).not.toContain(en.dashboard.noExercisesNotice);
    expect(markup).not.toContain(en.dashboard.curriculumCompleteBody);
    // L'unica azione è lo sblocco.
    expect(markup).toContain(en.dashboard.unlockAction);
    expect(markup).not.toContain(en.dashboard.primaryAction);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
    // Streak e curriculum portano informazione reale a chi è di ritorno: restano.
    expect(markup).toContain('1 day streak');
    expect(markup).toContain('2 of 10 lessons');
  });

  it('AC2 — curriculum esaurito ⇒ curriculumCompleteBody, ZERO pulsanti, NESSUNO «0»', () => {
    // count === 0, next === null (tutte sbloccate): unica schermata senza azione.
    const qc = seededClient({ dueCount: 0, log: [], unlocked: 5, total: 5 });
    const markup = render(qc, UID);

    expect(markup).not.toContain('text-count-hero');
    expect(markup).not.toContain(`>${en.dashboard.dueLabel}<`);
    expect(markup).toContain(en.dashboard.curriculumCompleteBody);
    // Nessun altro corpo (ultima con esercizi ⇒ né clearedBody né notice).
    expect(markup).not.toContain(en.dashboard.clearedBody);
    expect(markup).not.toContain(en.dashboard.noExercisesNotice);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(0);
  });

  it('AC3 — pila svuotata, ultima concettuale, altre disponibili ⇒ noExercisesNotice, non clearedBody', () => {
    // count === 0, lastUnlocked.exerciseCount 0 (lesson-0), next = lesson-1 (con
    // esercizi): la pila non si è mai riempita ⇒ noExercisesNotice, MAI clearedBody.
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 1,
      total: 10,
      lessonExerciseCounts: [0],
    });
    const markup = render(qc, UID);

    expect(markup).not.toContain('text-count-hero');
    expect(markup).toContain(en.dashboard.noExercisesNotice);
    expect(markup).not.toContain(en.dashboard.clearedBody);
    expect(markup).not.toContain(en.dashboard.curriculumCompleteBody);
    expect(markup).toContain(en.dashboard.unlockAction);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it('AC3 — esaurito E ultima concettuale ⇒ ENTRAMBE le dichiarazioni, ZERO pulsanti', () => {
    // count === 0, next === null (tutte sbloccate), l'ultima (lesson-2) concettuale:
    // curriculumCompleteBody E noExercisesNotice convivono (nessuna mente), nessun pulsante.
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 3,
      total: 3,
      lessonExerciseCounts: [1, 1, 0],
    });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.curriculumCompleteBody);
    expect(markup).toContain(en.dashboard.noExercisesNotice);
    expect(markup).not.toContain(en.dashboard.clearedBody);
    expect(markup).not.toContain('text-count-hero');
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(0);
  });

  it('AC4 — pila piena (count > 0) ⇒ il conteggio resta invariato (nessuna dichiarazione 3.16)', () => {
    // Il ramo count > 0 non cambia: text-count-hero=N, dueLabel, primaryAction, e
    // nessuna delle dichiarazioni a pila vuota.
    const qc = seededClient({ dueCount: 4, log: [], unlocked: 2, total: 10 });
    const markup = render(qc, UID);

    expect(markup).toMatch(/text-count-hero[^>]*>4</);
    expect(markup).toContain(en.dashboard.dueLabel);
    expect(markup).toContain(en.dashboard.primaryAction);
    expect(markup).not.toContain(en.dashboard.clearedBody);
    expect(markup).not.toContain(en.dashboard.curriculumCompleteBody);
  });

  it('AC4 — copy 3.16 priva di `!` e ASCII (en), parità en/it', () => {
    // clearedBody (via pila drenata normale).
    const cleared = render(
      seededClient({ dueCount: 0, log: [], unlocked: 2, total: 10 }),
      UID,
    );
    expect(cleared).toContain(en.dashboard.clearedBody);
    expect(cleared).not.toContain('!');
    expect(
      [...cleared].filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x2000),
    ).toEqual([]);

    // curriculumCompleteBody (via curriculum esaurito).
    const complete = render(
      seededClient({ dueCount: 0, log: [], unlocked: 5, total: 5 }),
      UID,
    );
    expect(complete).toContain(en.dashboard.curriculumCompleteBody);
    expect(complete).not.toContain('!');
    expect(
      [...complete].filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x2000),
    ).toEqual([]);
  });

  it('AC4 — parità en/it: le stesse chiavi rese in italiano', async () => {
    await i18n.changeLanguage('it');
    const cleared = render(
      seededClient({ dueCount: 0, log: [], unlocked: 2, total: 10 }),
      UID,
    );
    expect(cleared).toContain(itCatalog.dashboard.clearedBody);
    expect(cleared).not.toContain('!');

    const complete = render(
      seededClient({ dueCount: 0, log: [], unlocked: 5, total: 5 }),
      UID,
    );
    expect(complete).toContain(itCatalog.dashboard.curriculumCompleteBody);
    expect(complete).not.toContain('!');
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

describe('Storia 3.17 — il tetto giornaliero di sblocco (AC3)', () => {
  it('tetto NON raggiunto (cap 1, 0 sblocchi oggi) ⇒ unlockAction, un solo <button>', () => {
    // count 0, next != null, unlocksToday 0 < cap 1: il cancello rende ancora
    // l'azione di sblocco (comportamento invariato di 3.13/3.16).
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 1,
      total: 10,
      lessonsPerDay: 1,
      unlockedTodayCount: 0,
    });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.unlockAction);
    expect(markup).not.toContain(en.dashboard.dailyLimitReachedBody.replace('{{limit}}', '1'));
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it('tetto RAGGIUNTO (cap 1, 1 sblocco oggi) ⇒ dailyLimitReachedBody, NESSUN pulsante', () => {
    // count 0, next != null, unlocksToday 1 >= cap 1: il cancello sostituisce
    // l'azione con la dichiarazione del limite. `{{limit}}` = 1.
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 1,
      total: 10,
      lessonsPerDay: 1,
      unlockedTodayCount: 1,
    });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.dailyLimitReachedBody.replace('{{limit}}', '1'));
    expect(markup).not.toContain(en.dashboard.unlockAction);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(0);
  });

  it('tetto > 1, parziale (cap 3, 2 sblocchi oggi) ⇒ unlockAction (2 < 3)', () => {
    // Con 2 sblocchi già seminati «oggi» servono almeno 2 sbloccate: unlocked 2 su
    // 10, entrambe oggi, next = lesson-2 (con esercizi di default).
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 2,
      total: 10,
      lessonsPerDay: 3,
      unlockedTodayCount: 2,
    });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.unlockAction);
    expect(markup).not.toContain(
      en.dashboard.dailyLimitReachedBody.replace('{{limit}}', '3'),
    );
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it('tetto raggiunto ⇒ la dichiarazione porta il valore del tetto (cap 2 ⇒ {{limit}}=2)', () => {
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 2,
      total: 10,
      lessonsPerDay: 2,
      unlockedTodayCount: 2,
    });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.dailyLimitReachedBody.replace('{{limit}}', '2'));
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(0);
  });

  it('pila piena (count > 0) ⇒ primaryAction, tetto NON consultato anche se raggiunto', () => {
    // count > 0: il ramo svuota-pila resta invariato indipendentemente dal tetto.
    const qc = seededClient({
      dueCount: 4,
      log: [],
      unlocked: 1,
      total: 10,
      lessonsPerDay: 1,
      unlockedTodayCount: 1,
    });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.primaryAction);
    expect(markup).not.toContain(en.dashboard.dailyLimitReachedBody.replace('{{limit}}', '1'));
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it('curriculum esaurito (next === null) ⇒ nessuna dichiarazione del tetto (3.16 invariato)', () => {
    // count 0, next null (tutte sbloccate), anche con uno sblocco oggi: il cancello
    // rende NESSUN pulsante e NESSUN dailyLimitReachedBody (il tetto agisce solo con
    // next != null); resta la dichiarazione 3.16 curriculumCompleteBody.
    const qc = seededClient({
      dueCount: 0,
      log: [],
      unlocked: 3,
      total: 3,
      lessonsPerDay: 1,
      unlockedTodayCount: 1,
    });
    const markup = render(qc, UID);

    expect(markup).toContain(en.dashboard.curriculumCompleteBody);
    expect(markup).not.toContain(en.dashboard.dailyLimitReachedBody.replace('{{limit}}', '1'));
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(0);
  });

  it('AC5 — la copy del tetto è priva di `!`, ASCII (en) e in parità it', async () => {
    const capped = render(
      seededClient({
        dueCount: 0,
        log: [],
        unlocked: 1,
        total: 10,
        lessonsPerDay: 1,
        unlockedTodayCount: 1,
      }),
      UID,
    );
    expect(capped).toContain(en.dashboard.dailyLimitReachedBody.replace('{{limit}}', '1'));
    expect(capped).not.toContain('!');
    expect([...capped].filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x2000)).toEqual([]);
    // Nessuna apertura possessiva.
    expect(capped.toLowerCase()).not.toContain('you have');
    expect(capped.toLowerCase()).not.toContain('hai ');

    await i18n.changeLanguage('it');
    const cappedIt = render(
      seededClient({
        dueCount: 0,
        log: [],
        unlocked: 1,
        total: 10,
        lessonsPerDay: 1,
        unlockedTodayCount: 1,
      }),
      UID,
    );
    expect(cappedIt).toContain(
      itCatalog.dashboard.dailyLimitReachedBody.replace('{{limit}}', '1'),
    );
    expect(cappedIt).not.toContain('!');
  });

  it('lo scheletro attende anche il tetto (lessonsPerDay non seminato ⇒ aria-busy)', () => {
    // Seminiamo tutte le chiavi TRANNE lessonsPerDay: la dashboard resta sullo
    // scheletro (il tetto è nel cancello scheletro), non rende l'azione.
    const qc = freshClient();
    qc.setQueryData(dueQueryKey(UID), []);
    qc.setQueryData(['streak', UID], []);
    qc.setQueryData(['unlocked', UID], [
      { lessonId: 'lesson-0', unlockedAt: PAST },
    ]);
    qc.setQueryData(['lessons'], [
      { id: 'lesson-0', ordinal: 0, title: { en: 'L0' }, grammarPoints: [], exerciseCount: 1 },
    ]);
    // lessonsPerDay MANCANTE.
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <PortsProvider value={inMemoryPorts}>
          <DashboardScreen userId={UID} settings={inertSettings} />
        </PortsProvider>
      </QueryClientProvider>,
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain(en.dashboard.unlockAction);
  });
});
