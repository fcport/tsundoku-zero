import { describe, expect, it } from 'vitest';
import { calendarWeeks } from './answersOverTime';
import { KNOWN_STAGE, lessonMastery, TOP_STAGE } from './library';
import { MILESTONE_THRESHOLDS, milestones } from './milestones';
import type { LessonSummary } from './ports/contentRepository';
import type { ReviewOutcome } from './schedule';
import { sessionRecap } from './sessionRecap';
import type { ReviewLogRecord } from './streak';

// La libreria, i traguardi e il riepilogo di sessione (07-10-2026): tutto dal solo
// log, con la lezione di ogni esercizio presa dal contenuto.

const TZ = 'Europe/Rome';

function lesson(id: string, ordinal: number, exerciseCount: number): LessonSummary {
  return { id, ordinal, title: { en: id }, grammarPoints: [`gp-${id}`], exerciseCount };
}

const L1 = lesson('l1', 1, 2);
const L2 = lesson('l2', 2, 1);
const L3 = lesson('l3', 3, 0);
const LESSONS = [L1, L2, L3];
// Due esercizi della lezione 1, uno della 2; `ghost` non esiste più nel contenuto.
const EXERCISE_LESSONS = new Map([
  ['a', 'l1'],
  ['b', 'l1'],
  ['c', 'l2'],
]);

let minute = 0;
/** Una risposta, un minuto dopo la precedente, il giorno `day` di ottobre 2026. */
function answer(exerciseId: string, outcome: ReviewOutcome, day = 1): ReviewLogRecord {
  minute += 1;
  return {
    exerciseId,
    outcome,
    grammarPoint: 'gp',
    reviewedAt: new Date(Date.UTC(2026, 9, day, 8, minute)),
  };
}
/** `n` risposte giuste di fila (good). */
function goods(exerciseId: string, n: number, day = 1): ReviewLogRecord[] {
  return Array.from({ length: n }, () => answer(exerciseId, 'good', day));
}

describe('lessonMastery: una lezione è letta quando sai bene tutti i suoi esercizi', () => {
  it('le soglie: «lo sai bene» dal livello 4, il livello più alto è 5', () => {
    expect(KNOWN_STAGE).toBe(4);
    expect(TOP_STAGE).toBe(5);
  });

  it('conta gli esercizi almeno al livello 4, per lezione', () => {
    const log = [...goods('a', 4), ...goods('b', 3), ...goods('c', 5)];
    const mastery = lessonMastery(log, LESSONS, EXERCISE_LESSONS);
    expect(mastery.get('l1')).toEqual({ known: 1, total: 2, read: false });
    expect(mastery.get('l2')).toEqual({ known: 1, total: 1, read: true });
  });

  it('un errore riporta giù l’esercizio e il libro torna sulla pila', () => {
    const log = [...goods('c', 4), answer('c', 'again')];
    expect(lessonMastery(log, LESSONS, EXERCISE_LESSONS).get('l2')?.read).toBe(false);
  });

  it('una lezione senza esercizi non è mai «letta» qui', () => {
    expect(lessonMastery([], LESSONS, EXERCISE_LESSONS).get('l3')).toEqual({
      known: 0,
      total: 0,
      read: false,
    });
  });

  it('un esercizio che il contenuto non conosce più non conta', () => {
    const log = [...goods('ghost', 5)];
    expect(lessonMastery(log, LESSONS, EXERCISE_LESSONS).get('l1')?.known).toBe(0);
  });
});

describe('milestones: i traguardi si ricostruiscono dal log e non si perdono', () => {
  it('le famiglie hanno soglie crescenti', () => {
    for (const thresholds of Object.values(MILESTONE_THRESHOLDS)) {
      expect([...thresholds].sort((x, y) => x - y)).toEqual(thresholds);
    }
  });

  it('la prima lezione letta: istante della risposta che l’ha completata', () => {
    const log = [...goods('a', 4), ...goods('b', 4)];
    const lessonsRead = milestones(log, LESSONS, EXERCISE_LESSONS, TZ)[0]!;
    expect(lessonsRead.family).toBe('lessonsRead');
    expect(lessonsRead.best).toBe(1);
    expect(lessonsRead.milestones[0]!.achievedAt).toEqual(log[log.length - 1]!.reviewedAt);
    expect(lessonsRead.milestones[1]!.achievedAt).toBeNull();
  });

  it('una lezione letta che poi torna giù resta nel traguardo', () => {
    const log = [...goods('c', 4), answer('c', 'again')];
    const lessonsRead = milestones(log, LESSONS, EXERCISE_LESSONS, TZ)[0]!;
    expect(lessonsRead.best).toBe(1);
    expect(lessonsRead.milestones[0]!.achievedAt).not.toBeNull();
  });

  it('esercizi al livello più alto: contati una volta sola ciascuno', () => {
    const log = [...goods('a', 5), answer('a', 'again'), ...goods('a', 5), ...goods('c', 6)];
    const topLevel = milestones(log, LESSONS, EXERCISE_LESSONS, TZ)[1]!;
    expect(topLevel.family).toBe('topLevel');
    expect(topLevel.best).toBe(2);
  });

  it('la serie: il massimo raggiunto e il giorno in cui ha superato la soglia', () => {
    const log = [1, 2, 3, 4, 5, 6, 7, 8].map((day) => answer('a', 'again', day));
    const streakTrack = milestones(log, LESSONS, EXERCISE_LESSONS, TZ)[2]!;
    expect(streakTrack.family).toBe('streak');
    expect(streakTrack.best).toBe(8);
    expect(streakTrack.milestones[0]!.achievedAt).toEqual(log[6]!.reviewedAt);
  });

  it('log vuoto: niente raggiunto', () => {
    for (const t of milestones([], LESSONS, EXERCISE_LESSONS, TZ)) {
      expect(t.best).toBe(0);
      expect(t.milestones.every((m) => m.achievedAt === null)).toBe(true);
    }
  });
});

describe('sessionRecap: cosa è cambiato in una sessione', () => {
  it('livelli saliti, esercizi in cima, lezioni lette e traguardi della sessione', () => {
    const before = [...goods('a', 3), ...goods('c', 4)];
    const since = new Date(Date.UTC(2026, 9, 2, 0, 0));
    const session = [answer('a', 'good', 2), answer('b', 'again', 2), answer('c', 'good', 2)];
    const recap = sessionRecap([...before, ...session], since, LESSONS, EXERCISE_LESSONS, TZ);
    expect(recap.answers).toBe(3);
    expect(recap.levelUps).toBe(2); // a 3→4, c 4→5; b resta a 0
    expect(recap.reachedTop).toBe(1); // c
    expect(recap.lessonsRead).toEqual([]); // l2 era già letta prima
    expect(recap.newMilestones.map((m) => [m.family, m.threshold])).toEqual([['topLevel', 1]]);
  });

  it('una lezione che diventa letta nella sessione', () => {
    const before = [...goods('a', 4), ...goods('b', 3)];
    const since = new Date(Date.UTC(2026, 9, 2, 0, 0));
    const recap = sessionRecap([...before, answer('b', 'good', 2)], since, LESSONS, EXERCISE_LESSONS, TZ);
    expect(recap.lessonsRead.map((l) => l.id)).toEqual(['l1']);
    expect(recap.newMilestones.map((m) => [m.family, m.threshold])).toContainEqual(['lessonsRead', 1]);
  });
});

describe('calendarWeeks: le ultime settimane, dal lunedì, l’ultima è quella di oggi', () => {
  // Mercoledì 7 ottobre 2026, a Roma.
  const now = new Date('2026-10-07T10:00:00.000Z');

  it('colonne da sette giorni, dal lunedì; i giorni dopo oggi sono futuri', () => {
    const weeks = calendarWeeks([], now, TZ, 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]!.map((d) => d.date)[0]).toBe('2026-09-28');
    expect(weeks[1]!.map((d) => d.date)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(weeks[1]!.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
  });

  it('ogni giorno porta le sue risposte, nel fuso passato', () => {
    const log = [
      { reviewedAt: new Date('2026-10-06T21:30:00.000Z') }, // 23:30 a Roma, il 6
      { reviewedAt: new Date('2026-10-06T22:30:00.000Z') }, // 00:30 a Roma, il 7
      { reviewedAt: new Date('2026-10-07T08:00:00.000Z') },
    ];
    const week = calendarWeeks(log, now, TZ, 1)[0]!;
    expect(week[1]).toEqual({ date: '2026-10-06', count: 1, future: false });
    expect(week[2]).toEqual({ date: '2026-10-07', count: 2, future: false });
  });
});
