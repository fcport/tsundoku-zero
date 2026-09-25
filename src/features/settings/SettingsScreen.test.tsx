import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { i18n } from '../../i18n';
import type { SettingsRepository } from '../../domain/ports/settingsRepository';
import { DEFAULT_LESSONS_PER_DAY } from '../../domain/unlockPace';
import { SettingsScreen } from './SettingsScreen';

// Righe della I/O & Edge-Case Matrix per la superficie Impostazioni (storia 1.9,
// estesa in 3.17 col tetto giornaliero di sblocco). L'ambiente è `node` (nessun
// jsdom): `renderToStaticMarkup` NON esegue eventi né effetti. Perciò lo SWITCH a
// runtime si prova come INTEGRAZIONE del singleton i18next; il click→handler è
// glue d'effetto differita alla verifica live.
//
// SettingsScreen ora usa useQuery/useQueryClient (chiave ['lessonsPerDay', userId]
// condivisa con la dashboard): serve un QueryClientProvider. Con la cache seminata
// il valore risolve sincrono; con cache vuota (userId null o non seminato) il tetto
// degrada al DEFAULT del dominio.
//
// vitest isola i file (isolate default) ⇒ il singleton è fresco per file; entro
// il file un beforeEach riporta la lingua a 'en'.

const UID = 'user-1';

// Porta finta inerte: la resa server non invoca i metodi (le queryFn non partono
// con cache seminata).
const inertSettings: SettingsRepository = {
  loadLocale: async () => null,
  saveLocale: async () => {},
  loadLessonsPerDay: async () => null,
  saveLessonsPerDay: async () => {},
};

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Semina la chiave del tetto, così il valore risolve sincrono (nessuna fetch). */
function seededClient(lessonsPerDay: number): QueryClient {
  const qc = freshClient();
  qc.setQueryData(['lessonsPerDay', UID], lessonsPerDay);
  return qc;
}

function render(qc: QueryClient, userId: string | null = UID): string {
  const el: ReactElement = (
    <QueryClientProvider client={qc}>
      <SettingsScreen settings={inertSettings} userId={userId} />
    </QueryClientProvider>
  );
  return renderToStaticMarkup(el);
}

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

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('SettingsScreen — resa in inglese', () => {
  it('rende il titolo e le etichette di lingua e tetto in inglese (da t())', () => {
    const markup = render(seededClient(DEFAULT_LESSONS_PER_DAY));
    expect(markup).toContain(en.settings.title);
    expect(markup).toContain(en.settings.language.label);
    expect(markup).toContain(en.settings.language.en);
    expect(markup).toContain(en.settings.language.it);
    expect(markup).toContain(en.settings.lessonsPerDay.label);
  });

  it('è un <section> (non un <main>): preserva il single-main', () => {
    const markup = render(seededClient(DEFAULT_LESSONS_PER_DAY));
    expect(markup).toContain('<section');
    expect(markup.match(/<main/g) ?? []).toHaveLength(0);
  });

  it('NON ricarica: nessun riferimento a location.reload nel modulo (switch via changeLanguage)', () => {
    const markup = render(seededClient(DEFAULT_LESSONS_PER_DAY));
    expect(markup).not.toContain('location.reload');
  });

  it('AC4 — contiene ESATTAMENTE due gruppi role="group" (lingua e tetto)', () => {
    // La cancellazione account resta la sua <section> separata (1.10) nella shell:
    // qui, dentro la <section> Impostazioni, esattamente due role="group".
    const markup = render(seededClient(DEFAULT_LESSONS_PER_DAY));
    const groups = markup.match(/role="group"/g) ?? [];
    expect(groups.length).toBe(2);
  });
});

describe('SettingsScreen — switch a runtime senza reload (integrazione i18next)', () => {
  it("dopo changeLanguage('it') il markup contiene i valori it, non gli en", async () => {
    await i18n.changeLanguage('it');
    const markup = render(seededClient(DEFAULT_LESSONS_PER_DAY));
    expect(markup).toContain(itCatalog.settings.title);
    expect(markup).toContain(itCatalog.settings.language.label);
    expect(markup).toContain(itCatalog.settings.lessonsPerDay.label);
    expect(markup).not.toContain(en.settings.title);
    expect(markup).not.toContain(en.settings.language.label);
  });
});

describe('SettingsScreen — selettore lingua: la corrente è marcata aria-pressed', () => {
  it("current = 'en' ⇒ bottone en aria-pressed=true, it aria-pressed=false", () => {
    const markup = render(seededClient(DEFAULT_LESSONS_PER_DAY));
    const enButton = buttonContaining(markup, en.settings.language.en);
    const itButton = buttonContaining(markup, en.settings.language.it);
    expect(enButton).toContain('aria-pressed="true"');
    expect(itButton).toContain('aria-pressed="false"');
  });

  it("current = 'it' ⇒ bottone it aria-pressed=true, en aria-pressed=false", async () => {
    await i18n.changeLanguage('it');
    const markup = render(seededClient(DEFAULT_LESSONS_PER_DAY));
    const enButton = buttonContaining(markup, itCatalog.settings.language.en);
    const itButton = buttonContaining(markup, itCatalog.settings.language.it);
    expect(itButton).toContain('aria-pressed="true"');
    expect(enButton).toContain('aria-pressed="false"');
  });
});

describe('SettingsScreen — selettore tetto: il valore corrente è marcato aria-pressed (3.17)', () => {
  it('cache seminata a 3 ⇒ il bottone "3 per day" è aria-pressed=true, "1 per day" false', () => {
    const markup = render(seededClient(3));
    const three = buttonContaining(markup, en.settings.lessonsPerDay.option.replace('{{value}}', '3'));
    const one = buttonContaining(markup, en.settings.lessonsPerDay.option.replace('{{value}}', '1'));
    expect(three).toContain('aria-pressed="true"');
    expect(one).toContain('aria-pressed="false"');
  });

  it('cache VUOTA / userId null ⇒ il tetto degrada al DEFAULT (1), reso e marcato', () => {
    // Senza id la query è disabilitata (data undefined) ⇒ current = DEFAULT.
    const markup = render(freshClient(), null);
    const one = buttonContaining(
      markup,
      en.settings.lessonsPerDay.option.replace('{{value}}', String(DEFAULT_LESSONS_PER_DAY)),
    );
    expect(one).toContain('aria-pressed="true"');
  });
});
