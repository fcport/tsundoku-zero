import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { i18n } from '../../i18n';
import { PrivacyScreen } from './PrivacyScreen';

// AC di contenuto della privacy policy (7.1). Ambiente `node` (nessun jsdom):
// `renderToStaticMarkup` NON esegue eventi ne effetti — basta la resa statica per
// ancorare gli AC di contenuto alla SUPERFICIE letta. Lo switch a runtime del
// singleton i18next (en -> it) e provato come integrazione; vitest isola i file,
// e un beforeEach/afterEach riporta la lingua a 'en'.

const NOOP = () => {};

function render(): string {
  return renderToStaticMarkup(<PrivacyScreen onExit={NOOP} />);
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('PrivacyScreen — dichiarazioni fattuali (en)', () => {
  const markup = render();

  it('rende il titolo e le tre dichiarazioni (stored/notCollected/deletion)', () => {
    expect(markup).toContain(en.legal.privacy.title);
    expect(markup).toContain(en.legal.privacy.stored);
    expect(markup).toContain(en.legal.privacy.notCollected);
    expect(markup).toContain(en.legal.privacy.deletion);
  });

  it('ha un solo landmark <main>', () => {
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });

  it("offre l'affordance di ritorno con l'anello di focus da tastiera", () => {
    expect(markup).toContain(en.legal.privacy.back);
    expect(markup).toContain('focus-visible:outline-focus-ring');
  });

  it('AC1 — `stored` nomina ESATTAMENTE i dati memorizzati', () => {
    // Email, hash della password, lezioni sbloccate, stato di revisione, log delle
    // risposte, preferenze: ciascun elemento dell'AC compare nella copy letta.
    const stored = en.legal.privacy.stored.toLowerCase();
    expect(stored).toContain('only');
    expect(stored).toContain('nothing else');
    expect(stored).toContain('email');
    expect(stored).toContain('password');
    expect(stored).toContain('unlocked');
    expect(stored).toContain('review');
    expect(stored).toContain('answer');
    expect(stored).toContain('preferences');
  });

  it('AC1 — `notCollected` nomina cio che NON si raccoglie', () => {
    // Nome, data di nascita, analitica sul singolo individuo.
    const notCollected = en.legal.privacy.notCollected.toLowerCase();
    expect(notCollected).toContain('does not');
    expect(notCollected).toContain('name');
    expect(notCollected).toContain('date of birth');
    expect(notCollected).toContain('analytics');
  });

  it('AC2 — `deletion` spiega la cancellazione da Impostazioni e nomina il log', () => {
    // Come cancellare (Impostazioni, Cancella account) e che distrugge ANCHE il log
    // delle risposte.
    const deletion = en.legal.privacy.deletion.toLowerCase();
    expect(deletion).toContain('settings');
    expect(deletion).toContain('delete account');
    expect(deletion).toContain('answers');
  });

  it('microcopy senza celebrazione: nessun `!`, ASCII (nessun code point >= U+2000)', () => {
    expect(markup).not.toContain('!');
    const offending = [...markup].filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x2000);
    expect(offending).toEqual([]);
  });
});

describe('PrivacyScreen — switch a runtime (integrazione i18next)', () => {
  it("dopo changeLanguage('it') rende i valori it, non gli en", async () => {
    await i18n.changeLanguage('it');
    const markup = render();
    expect(markup).toContain(itCatalog.legal.privacy.title);
    // `stored` contiene l'apostrofo (`Nient'altro`), codificato come entità HTML
    // nel markup (`&#x27;`): asserisco la porzione PRIMA dell'apostrofo, idioma del
    // repo (AuthForm.test) per i valori con apostrofo. Le altre due dichiarazioni non
    // hanno apostrofi, quindi il confronto sul valore intero resta.
    expect(markup).toContain(
      itCatalog.legal.privacy.stored.split("Nient'altro")[0],
    );
    expect(markup).toContain(itCatalog.legal.privacy.notCollected);
    expect(markup).toContain(itCatalog.legal.privacy.deletion);
    expect(markup).not.toContain(en.legal.privacy.title);
  });

  it('la copy it nomina ciascun elemento richiesto (parita di contenuto)', async () => {
    await i18n.changeLanguage('it');
    const stored = itCatalog.legal.privacy.stored.toLowerCase();
    expect(stored).toContain('soltanto');
    expect(stored).toContain('email');
    expect(stored).toContain('password');
    expect(stored).toContain('sbloccat');
    expect(stored).toContain('revisione');
    expect(stored).toContain('rispost');
    expect(stored).toContain('preferenze');
    const notCollected = itCatalog.legal.privacy.notCollected.toLowerCase();
    expect(notCollected).toContain('non raccoglie');
    expect(notCollected).toContain('nome');
    expect(notCollected).toContain('data di nascita');
    expect(notCollected).toContain('analitica');
    const deletion = itCatalog.legal.privacy.deletion.toLowerCase();
    expect(deletion).toContain('impostazioni');
    expect(deletion).toContain('cancella account');
    expect(deletion).toContain('rispost');
  });
});
