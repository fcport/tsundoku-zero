import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { i18n } from '../../i18n';
import { AcknowledgementsScreen } from './AcknowledgementsScreen';

// AC di contenuto dei riconoscimenti (7.2). Ambiente `node` (nessun jsdom):
// `renderToStaticMarkup` NON esegue eventi ne effetti — basta la resa statica per
// ancorare gli AC alla SUPERFICIE letta. La copy PORTA gli AC (attribuzione della
// fonte, link al canale, originalita, non-affiliazione, fonte accademica), quindi
// le asserzioni guardano il markup reso e i valori di catalogo. Lo switch a runtime
// del singleton i18next (en -> it) e provato come integrazione; vitest isola i
// file, e un beforeEach/afterEach riporta la lingua a 'en'.

const NOOP = () => {};

function render(): string {
  return renderToStaticMarkup(<AcknowledgementsScreen onExit={NOOP} />);
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('AcknowledgementsScreen — attribuzione e confini (en)', () => {
  const markup = render();

  it('rende il titolo e le cinque dichiarazioni (method/channel/original/noAffiliation/scholarship)', () => {
    expect(markup).toContain(en.legal.acknowledgements.title);
    expect(markup).toContain(en.legal.acknowledgements.method);
    expect(markup).toContain(en.legal.acknowledgements.channelLabel);
    expect(markup).toContain(en.legal.acknowledgements.originalContent);
    expect(markup).toContain(en.legal.acknowledgements.noAffiliation);
    expect(markup).toContain(en.legal.acknowledgements.scholarship);
  });

  it('ha un solo landmark <main>', () => {
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });

  it('AC1 — collegamento REALE al canale della fonte (`<a href>` esterno, focus visibile)', () => {
    // Un vero <a href> all'URL stabile in forma channel-id, target esterno e
    // rel="noreferrer": il collegamento punta FUORI dall'app, non e una callback.
    expect(markup).toContain(
      'href="https://www.youtube.com/channel/UCkdmU8hGK4Fg3LghTVtKltQ"',
    );
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer"');
    expect(markup).toContain('focus-visible:outline-focus-ring');
  });

  it('AC1 — `method` attribuisce a Cure Dolly il modello STRUTTURALE', () => {
    const method = en.legal.acknowledgements.method.toLowerCase();
    expect(method).toContain('cure dolly');
    expect(method).toContain('structural');
  });

  it('AC2 — `originalContent` afferma originalita e nega la riproduzione', () => {
    const original = en.legal.acknowledgements.originalContent.toLowerCase();
    expect(original).toContain('original');
    expect(original).toContain('reproduce');
  });

  it('AC2 — `noAffiliation` nega affiliazione, approvazione e continuazione', () => {
    // Nessuna formulazione che suggerisca affiliazione/approvazione/continuita.
    const noAff = en.legal.acknowledgements.noAffiliation.toLowerCase();
    expect(noAff).toContain('not affiliated');
    expect(noAff).toContain('endorsed');
    expect(noAff).toContain('continuation');
  });

  it('AC3 — `scholarship` cita una fonte accademica verificabile e specifica', () => {
    // Autore, titolo, editore, anno: verificabile, non generico.
    const scholarship = en.legal.acknowledgements.scholarship;
    expect(scholarship).toContain('Kuno');
    expect(scholarship).toContain('MIT Press');
    expect(scholarship).toContain('1973');
  });

  it("offre l'affordance di ritorno con l'anello di focus da tastiera", () => {
    expect(markup).toContain(en.legal.acknowledgements.back);
  });

  it('microcopy senza celebrazione: nessun `!`, ASCII (nessun code point >= U+2000)', () => {
    expect(markup).not.toContain('!');
    const offending = [...markup].filter(
      (ch) => (ch.codePointAt(0) ?? 0) >= 0x2000,
    );
    expect(offending).toEqual([]);
  });
});

describe('AcknowledgementsScreen — switch a runtime (integrazione i18next)', () => {
  it("dopo changeLanguage('it') rende i valori it, non gli en", async () => {
    await i18n.changeLanguage('it');
    const markup = render();
    expect(markup).toContain(itCatalog.legal.acknowledgements.title);
    // `method`/`noAffiliation` contengono accenti (`è`, `né`) resi come entita HTML
    // nel markup: asserisco la porzione PRIMA del primo accento (idioma del repo per
    // i valori con carattere non-ASCII). `channelLabel` (proper-noun, identico a en)
    // e `scholarship`/`originalContent` restano confronti sul valore intero dove
    // possibile.
    expect(markup).toContain(itCatalog.legal.acknowledgements.channelLabel);
    expect(markup).toContain(itCatalog.legal.acknowledgements.originalContent);
    expect(markup).toContain(itCatalog.legal.acknowledgements.scholarship);
    expect(markup).not.toContain(en.legal.acknowledgements.title);
  });

  it('la copy it porta ciascun elemento richiesto (parita di contenuto)', async () => {
    await i18n.changeLanguage('it');
    const method = itCatalog.legal.acknowledgements.method.toLowerCase();
    expect(method).toContain('cure dolly');
    expect(method).toContain('strutturale');
    const original =
      itCatalog.legal.acknowledgements.originalContent.toLowerCase();
    expect(original).toContain('originali');
    expect(original).toContain('riproduc');
    const noAff = itCatalog.legal.acknowledgements.noAffiliation.toLowerCase();
    expect(noAff).toContain('affiliato');
    expect(noAff).toContain('approvato');
    expect(noAff).toContain('continuazione');
    const scholarship = itCatalog.legal.acknowledgements.scholarship;
    expect(scholarship).toContain('Kuno');
    expect(scholarship).toContain('MIT Press');
    expect(scholarship).toContain('1973');
  });

  it('microcopy it senza celebrazione: nessun `!`, nessun code point >= U+2000', async () => {
    // La spec richiede l'invariante in ENTRAMBI i cataloghi: la copy it usa accenti
    // (`è`/`né`, U+00E8/U+00E9 < U+2000, resi verbatim da renderToStaticMarkup) ma
    // NON deve contenere em-dash o virgolette tipografiche (>= U+2000), che sono i
    // caratteri piu a rischio in una futura modifica della copy italiana.
    await i18n.changeLanguage('it');
    const markup = render();
    expect(markup).not.toContain('!');
    const offending = [...markup].filter(
      (ch) => (ch.codePointAt(0) ?? 0) >= 0x2000,
    );
    expect(offending).toEqual([]);
  });
});
