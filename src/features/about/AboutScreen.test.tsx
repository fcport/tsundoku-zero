import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { i18n } from '../../i18n';
import { AboutScreen } from './AboutScreen';

// La pagina «Come funziona?»: resa statica (ambiente node), come i riconoscimenti.

const NOOP = () => {};

function render(): string {
  return renderToStaticMarkup(<AboutScreen onExit={NOOP} />);
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('AboutScreen', () => {
  it('rende il titolo, le quattro sezioni e il ritorno', () => {
    const markup = render();
    expect(markup).toContain(en.about.title);
    for (const key of [
      'whoKicker',
      'who',
      'whyKicker',
      'lessons',
      'idea',
      'howKicker',
      'how',
      'lessonsPage',
      'passionKicker',
      'passion',
      'independent',
      'back',
    ] as const) {
      expect(markup).toContain(en.about[key]);
    }
  });

  it('ha un solo landmark <main> col contenitore responsive condiviso', () => {
    const markup = render();
    expect(markup.match(/<main/g) ?? []).toHaveLength(1);
    expect(markup).toMatch(/<main[^>]*class="[^"]*max-w-measure[^"]*"/);
  });

  it('collega la guida di TheMoeWay con un vero link esterno', () => {
    const markup = render();
    expect(markup).toContain('href="https://learnjapanese.moe/routine/"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer"');
    expect(markup).toContain(en.about.guideLabel);
  });

  it("collega il sito dell'autore, il profilo GitHub e la repo", () => {
    const markup = render();
    expect(markup).toContain('href="https://federicocasadei.dev"');
    expect(markup).toContain('href="https://github.com/fcport"');
    expect(markup).toContain('href="https://github.com/fcport/tsundoku-zero"');
    expect(markup).toContain(en.about.repoLabel);
  });

  it('nomina la fonte e la guida, e dichiara che il sito è indipendente', () => {
    for (const catalog of [en, itCatalog]) {
      expect(catalog.about.who).toContain('Cure Dolly');
      expect(catalog.about.who).toContain('TheMoeWay');
      expect(catalog.about.independent).toContain('TheMoeWay');
    }
  });

  it("dopo changeLanguage('it') rende i valori it", async () => {
    await i18n.changeLanguage('it');
    const markup = render();
    expect(markup).toContain(itCatalog.about.guideLabel);
    expect(markup).not.toContain(en.about.title);
  });

  it('niente `!` né caratteri tipografici (>= U+2000) in entrambe le lingue', async () => {
    for (const lng of ['en', 'it']) {
      await i18n.changeLanguage(lng);
      const markup = render();
      expect(markup).not.toContain('!');
      const offending = [...markup.replace(/<span lang="ja">[\s\S]*?<\/span>/g, '')].filter(
        (ch) => (ch.codePointAt(0) ?? 0) >= 0x2000,
      );
      expect(offending).toEqual([]);
    }
  });
});
