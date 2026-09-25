import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Clock } from '../../domain/ports/clock';
import type {
  ContentRepository,
  LessonSummary,
} from '../../domain/ports/contentRepository';
import type { ReviewRepository } from '../../domain/ports/reviewRepository';
import type { ProgressRepository } from '../../domain/ports/progressRepository';
import type { ReviewState } from '../../domain/schedule';
import { PortsProvider, usePorts, type Ports } from './PortsContext';

// AC3 — Test di componente con porte IN MEMORIA, SENZA rete. L'ambiente è `node`
// (nessun jsdom): `renderToStaticMarkup` non esegue eventi né effetti. Il Probe
// rende `clock.now()` nel markup; separatamente si prova che le porte-repository
// iniettate sono le ISTANZE in memoria e che le loro letture RISOLVONO ai dati
// delle finte senza toccare la rete (spia su `globalThis.fetch`, mai chiamata).
// `usePorts` fuori dal provider LANCIA.

// Istante FISSO: il markup deve mostrarlo, prova che il Probe legge il clock
// iniettato e non l'orologio di piattaforma.
const FIXED_NOW = new Date('2026-09-25T08:30:00.000Z');
const FIXED_TZ = 'Europe/Rome';
const fixedClock: Clock = { now: () => FIXED_NOW, timeZone: () => FIXED_TZ };

const sampleLessons: readonly LessonSummary[] = [
  { id: 'te-form', ordinal: 1, title: { en: 'The te-form' }, grammarPoints: ['te-form'] },
];
const sampleDue: readonly ReviewState[] = [
  {
    exerciseId: 'ex-1',
    stage: 0,
    dueAt: FIXED_NOW,
    reviewCount: 0,
    lapseCount: 0,
    lastReviewedAt: null,
  },
];
const sampleUnlocked: readonly string[] = ['te-form'];

// Porte IN MEMORIA: risolvono da valori locali, nessun client Supabase, nessuna
// rete. Sono ciò che un test di schermata del ciclo (3.11+) inietterà.
const inMemoryContent: ContentRepository = {
  listLessons: async () => sampleLessons,
};
const sampleLog = [{ reviewedAt: FIXED_NOW }] as const;
const inMemoryReview: ReviewRepository = {
  listDue: async () => sampleDue,
  listReviewLog: async () => sampleLog,
};
const inMemoryProgress: ProgressRepository = {
  listUnlockedLessonIds: async () => sampleUnlocked,
  unlockLesson: async () => {},
};

const inMemoryPorts: Ports = {
  clock: fixedClock,
  content: inMemoryContent,
  review: inMemoryReview,
  progress: inMemoryProgress,
};

/** Probe: legge le porte iniettate e rende l'istante del clock nel markup. */
function Probe() {
  const ports = usePorts();
  return <span data-testid="now">{ports.clock.now().toISOString()}</span>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PortsProvider / usePorts — iniezione di porte in memoria', () => {
  it('il Probe rende clock.now() iniettato (istante fisso) nel markup', () => {
    const markup = renderToStaticMarkup(
      <PortsProvider value={inMemoryPorts}>
        <Probe />
      </PortsProvider>,
    );
    expect(markup).toContain(FIXED_NOW.toISOString());
  });

  it('le porte iniettate sono ESATTAMENTE le istanze in memoria', () => {
    let captured: Ports | null = null;
    function Capture() {
      captured = usePorts();
      return null;
    }
    renderToStaticMarkup(
      <PortsProvider value={inMemoryPorts}>
        <Capture />
      </PortsProvider>,
    );
    expect(captured).toBe(inMemoryPorts);
    expect(captured!.content).toBe(inMemoryContent);
    expect(captured!.review).toBe(inMemoryReview);
    expect(captured!.progress).toBe(inMemoryProgress);
    expect(captured!.clock).toBe(fixedClock);
  });

  it('le letture delle porte iniettate risolvono ai dati delle finte SENZA rete', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    let captured: Ports | null = null;
    function Capture() {
      captured = usePorts();
      return null;
    }
    renderToStaticMarkup(
      <PortsProvider value={inMemoryPorts}>
        <Capture />
      </PortsProvider>,
    );

    await expect(captured!.content.listLessons()).resolves.toBe(sampleLessons);
    await expect(captured!.review.listDue(FIXED_NOW)).resolves.toBe(sampleDue);
    await expect(captured!.progress.listUnlockedLessonIds()).resolves.toBe(
      sampleUnlocked,
    );

    // Nessuna delle letture ha toccato la rete: fetch mai chiamato.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('usePorts — fuori dal provider LANCIA (crash rumoroso, non undefined)', () => {
  it('rendere il Probe senza PortsProvider lancia', () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow();
  });
});
