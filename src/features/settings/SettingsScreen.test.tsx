import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { i18n } from '../../i18n';
import type { SettingsRepository } from '../../domain/ports/settingsRepository';
import { SettingsScreen } from './SettingsScreen';

// Righe della I/O & Edge-Case Matrix per la superficie Impostazioni (storia 1.9).
// L'ambiente è `node` (nessun jsdom): `renderToStaticMarkup` NON esegue eventi né
// effetti. Perciò lo SWITCH a runtime si prova come INTEGRAZIONE del singleton
// i18next — `await i18n.changeLanguage('it')` poi render — che dimostra che
// commutare la lingua ri-rende i consumatori di t() SENZA reload. Il click→handler
// è glue d'effetto, differito alla verifica live.
//
// vitest isola i file (isolate default) ⇒ il singleton è fresco per file; entro
// il file un beforeEach riporta la lingua a 'en'.

// Porta finta inerte: la resa server non invoca saveLocale/loadLocale.
const inertSettings: SettingsRepository = {
  loadLocale: async () => null,
  saveLocale: async () => {},
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('SettingsScreen — resa in inglese', () => {
  it('rende il titolo e le etichette in inglese (da t())', () => {
    const markup = renderToStaticMarkup(
      <SettingsScreen settings={inertSettings} />,
    );
    expect(markup).toContain(en.settings.title);
    expect(markup).toContain(en.settings.language.label);
    expect(markup).toContain(en.settings.language.en);
    expect(markup).toContain(en.settings.language.it);
  });

  it('è un <section> (non un <main>): preserva il single-main', () => {
    const markup = renderToStaticMarkup(
      <SettingsScreen settings={inertSettings} />,
    );
    expect(markup).toContain('<section');
    expect(markup.match(/<main/g) ?? []).toHaveLength(0);
  });

  it('NON ricarica: nessun riferimento a location.reload nel modulo (switch via changeLanguage)', () => {
    // Guardia strutturale contro un reload accidentale: il markup non contiene
    // nulla che ricarichi; lo switch passa dal singleton (provato sotto).
    const markup = renderToStaticMarkup(
      <SettingsScreen settings={inertSettings} />,
    );
    expect(markup).not.toContain('location.reload');
  });
});

describe('SettingsScreen — switch a runtime senza reload (integrazione i18next)', () => {
  it("dopo changeLanguage('it') il markup contiene i valori it, non gli en", async () => {
    await i18n.changeLanguage('it');
    const markup = renderToStaticMarkup(
      <SettingsScreen settings={inertSettings} />,
    );
    // Prova che commutare la lingua del singleton ri-rende i consumatori di t():
    // titolo ed etichette sono i valori `it`, non gli `en`.
    expect(markup).toContain(itCatalog.settings.title);
    expect(markup).toContain(itCatalog.settings.language.label);
    expect(markup).not.toContain(en.settings.title);
    expect(markup).not.toContain(en.settings.language.label);
  });
});

describe('SettingsScreen — selettore: la lingua corrente è marcata aria-pressed', () => {
  it("current = 'en' ⇒ bottone en aria-pressed=true, it aria-pressed=false", () => {
    const markup = renderToStaticMarkup(
      <SettingsScreen settings={inertSettings} />,
    );
    // Estrae ciascun tag <button ...> e verifica l'aria-pressed accanto alla sua
    // etichetta, senza dipendere dall'ordine assoluto degli attributi.
    const enButton = buttonContaining(markup, en.settings.language.en);
    const itButton = buttonContaining(markup, en.settings.language.it);
    expect(enButton).toContain('aria-pressed="true"');
    expect(itButton).toContain('aria-pressed="false"');
  });

  it("current = 'it' ⇒ bottone it aria-pressed=true, en aria-pressed=false", async () => {
    await i18n.changeLanguage('it');
    const markup = renderToStaticMarkup(
      <SettingsScreen settings={inertSettings} />,
    );
    const enButton = buttonContaining(markup, itCatalog.settings.language.en);
    const itButton = buttonContaining(markup, itCatalog.settings.language.it);
    expect(itButton).toContain('aria-pressed="true"');
    expect(enButton).toContain('aria-pressed="false"');
  });
});

/**
 * Ritorna il frammento `<button ...>LABEL</button>` che contiene `label`. Cerca
 * l'ultimo `<button` che precede l'occorrenza dell'etichetta, così l'assert
 * sull'aria-pressed riguarda il bottone giusto anche con più bottoni.
 */
function buttonContaining(markup: string, label: string): string {
  const labelIndex = markup.indexOf(label);
  const openIndex = markup.lastIndexOf('<button', labelIndex);
  const closeIndex = markup.indexOf('</button>', labelIndex);
  return markup.slice(openIndex, closeIndex + '</button>'.length);
}
