import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../i18n';
import { MagazineFrame } from './MagazineFrame';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('MagazineFrame — l\'interruttore della furigana sul dorso', () => {
  it('furiganaToggle ⇒ una casella «Furigana» nel dorso, scritta in verticale', () => {
    const markup = renderToStaticMarkup(
      <MagazineFrame furiganaToggle>
        <main />
      </MagazineFrame>,
    );
    const aside = /<aside[\s\S]*<\/aside>/.exec(markup)?.[0] ?? '';
    expect(aside).toContain('type="checkbox"');
    expect(aside).toContain('Furigana');
    expect(aside).toMatch(/<label[^>]*writing-mode:vertical-rl/);
  });

  it('senza furiganaToggle (pagine pubbliche) ⇒ nessuna casella', () => {
    const markup = renderToStaticMarkup(
      <MagazineFrame>
        <main />
      </MagazineFrame>,
    );
    expect(markup).not.toContain('type="checkbox"');
  });
});
