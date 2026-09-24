import { describe, expect, it } from 'vitest';
import type { SettingsRepository } from '../../domain/ports/settingsRepository';
import { changeLocale } from './changeLocale';

// Righe della I/O & Edge-Case Matrix per l'orchestrazione pura del cambio lingua
// (storia 1.9). `changeLocale` è esercitato con dipendenze FINTE: nessun
// singleton i18next reale, nessun client. Confine TOTALE: un reject di
// `saveLocale` non propaga (la lingua è già cambiata a runtime).

/** Porta finta con `saveLocale` osservabile; `loadLocale` inerte. */
function fakeSettings(
  saveLocale: SettingsRepository['saveLocale'],
): SettingsRepository {
  return {
    loadLocale: async () => null,
    saveLocale,
  };
}

describe('changeLocale — selezione: switch a runtime + persistenza', () => {
  it("'it' ⇒ changeLanguage('it') E settings.saveLocale('it') invocati", async () => {
    const changed: string[] = [];
    const saved: string[] = [];
    const settings = fakeSettings(async (locale) => {
      saved.push(locale);
    });

    await changeLocale('it', {
      changeLanguage: (locale) => changed.push(locale),
      settings,
    });

    expect(changed).toEqual(['it']);
    expect(saved).toEqual(['it']);
  });

  it('changeLanguage è invocato PRIMA di saveLocale (switch prima, persistenza poi)', async () => {
    const order: string[] = [];
    const settings = fakeSettings(async () => {
      order.push('save');
    });

    await changeLocale('en', {
      changeLanguage: () => order.push('change'),
      settings,
    });

    expect(order).toEqual(['change', 'save']);
  });

  it('un reject di saveLocale NON propaga (confine totale); changeLanguage è comunque avvenuto', async () => {
    let changed = false;
    const settings = fakeSettings(() =>
      Promise.reject(new Error('network')),
    );

    await expect(
      changeLocale('it', {
        changeLanguage: () => {
          changed = true;
        },
        settings,
      }),
    ).resolves.toBeUndefined();
    expect(changed).toBe(true);
  });

  it('un throw sincrono di saveLocale NON propaga (confine totale)', async () => {
    const settings = fakeSettings(() => {
      throw new Error('boom');
    });

    await expect(
      changeLocale('it', {
        changeLanguage: () => {},
        settings,
      }),
    ).resolves.toBeUndefined();
  });

  it('un throw sincrono di changeLanguage NON propaga (confine totale); saveLocale non è invocato', async () => {
    let saved = false;
    const settings = fakeSettings(async () => {
      saved = true;
    });

    await expect(
      changeLocale('it', {
        changeLanguage: () => {
          throw new Error('i18next boom');
        },
        settings,
      }),
    ).resolves.toBeUndefined();
    // Il throw di changeLanguage interrompe prima della persistenza: coerente,
    // la lingua non è cambiata quindi non c'è nulla da persistere.
    expect(saved).toBe(false);
  });
});
