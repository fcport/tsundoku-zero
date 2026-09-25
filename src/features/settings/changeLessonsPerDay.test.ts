import { describe, expect, it } from 'vitest';
import type { SettingsRepository } from '../../domain/ports/settingsRepository';
import { changeLessonsPerDay } from './changeLessonsPerDay';

// Righe della I/O & Edge-Case Matrix per l'orchestrazione pura del cambio tetto
// giornaliero di sblocco (storia 3.17). `changeLessonsPerDay` è esercitato con
// dipendenze FINTE: nessun QueryClient reale, nessun client. Confine TOTALE: un
// reject di `saveLessonsPerDay` non propaga (il valore è già cambiato in modo
// ottimistico). Mirror di `./changeLocale.test`.

/** Porta finta con `saveLessonsPerDay` osservabile; gli altri metodi inerti. */
function fakeSettings(
  saveLessonsPerDay: SettingsRepository['saveLessonsPerDay'],
): SettingsRepository {
  return {
    loadLocale: async () => null,
    saveLocale: async () => {},
    loadLessonsPerDay: async () => null,
    saveLessonsPerDay,
  };
}

describe('changeLessonsPerDay — selezione: aggiornamento ottimistico + persistenza', () => {
  it('valore 3 ⇒ apply(3) E settings.saveLessonsPerDay(3) invocati', async () => {
    const applied: number[] = [];
    const saved: number[] = [];
    const settings = fakeSettings(async (value) => {
      saved.push(value);
    });

    await changeLessonsPerDay(3, {
      apply: (value) => applied.push(value),
      settings,
    });

    expect(applied).toEqual([3]);
    expect(saved).toEqual([3]);
  });

  it('apply è invocato PRIMA di saveLessonsPerDay (ottimistico prima, persistenza poi)', async () => {
    const order: string[] = [];
    const settings = fakeSettings(async () => {
      order.push('save');
    });

    await changeLessonsPerDay(2, {
      apply: () => order.push('apply'),
      settings,
    });

    expect(order).toEqual(['apply', 'save']);
  });

  it('un reject di saveLessonsPerDay NON propaga (confine totale); apply è comunque avvenuto', async () => {
    let applied = false;
    const settings = fakeSettings(() => Promise.reject(new Error('network')));

    await expect(
      changeLessonsPerDay(4, {
        apply: () => {
          applied = true;
        },
        settings,
      }),
    ).resolves.toBeUndefined();
    expect(applied).toBe(true);
  });

  it('un throw sincrono di saveLessonsPerDay NON propaga (confine totale)', async () => {
    const settings = fakeSettings(() => {
      throw new Error('boom');
    });

    await expect(
      changeLessonsPerDay(5, { apply: () => {}, settings }),
    ).resolves.toBeUndefined();
  });

  it('un throw sincrono di apply NON propaga (confine totale); saveLessonsPerDay non è invocato', async () => {
    let saved = false;
    const settings = fakeSettings(async () => {
      saved = true;
    });

    await expect(
      changeLessonsPerDay(2, {
        apply: () => {
          throw new Error('setQueryData boom');
        },
        settings,
      }),
    ).resolves.toBeUndefined();
    // Il throw di apply interrompe prima della persistenza.
    expect(saved).toBe(false);
  });
});
