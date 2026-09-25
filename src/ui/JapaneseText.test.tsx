import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JapaneseText, type RubySegment } from './JapaneseText';

// Righe della I/O Matrix + AC di 3.11 per la PRESENTAZIONE del giapponese:
// ambiente node (vitest.config.ts), nessun jsdom, resa statica con
// renderToStaticMarkup. Il componente RENDE i segmenti verbatim: nessuna logica
// di allineamento (AD-21 vive nel dominio), nessun romaji (UX-DR25), involucro
// sempre `lang="ja"` (AD-14/UX-DR24), `<rt>` sempre `aria-hidden` (UX-DR28).

function render(segments: readonly RubySegment[], showFurigana: boolean): string {
  return renderToStaticMarkup(<JapaneseText segments={segments} showFurigana={showFurigana} />);
}

describe('JapaneseText — segmento con ruby (AC1, AC3)', () => {
  it('rende <ruby> con <rp> di ripiego e <rt aria-hidden="true">', () => {
    const markup = render([{ text: '今日', ruby: 'きょう' }], true);
    expect(markup).toContain(
      '<ruby>今日<rp>(</rp><rt aria-hidden="true">きょう</rt><rp>)</rp></ruby>',
    );
  });

  it('ogni <rt> reso porta aria-hidden="true" (AC3)', () => {
    const markup = render(
      [
        { text: '今日', ruby: 'きょう' },
        { text: '本', ruby: 'ほん' },
      ],
      true,
    );
    // Nessun <rt> senza aria-hidden: ogni apertura di <rt> ha subito l'attributo.
    const bareRt = markup.match(/<rt(?![^>]*aria-hidden="true")/);
    expect(bareRt).toBeNull();
    // Due <rt>, entrambi nascosti.
    expect((markup.match(/<rt aria-hidden="true">/g) ?? []).length).toBe(2);
  });
});

describe('JapaneseText — segmento senza ruby (AC1)', () => {
  it('ruby:null ⇒ testo base senza <ruby>/<rt>', () => {
    const markup = render([{ text: 'は', ruby: null }], true);
    expect(markup).toContain('は');
    expect(markup).not.toContain('<ruby>');
    expect(markup).not.toContain('<rt');
  });

  it("ruby:'' (stringa vuota) ⇒ testo base, nessuna annotazione ruby vuota", () => {
    // Un `ruby` FALSY (`''` come `null`) è «nessun ruby»: mai un <ruby>/<rt> vuoto.
    const markup = render([{ text: '本', ruby: '' }], true);
    expect(markup).toContain('本');
    expect(markup).not.toContain('<ruby>');
    expect(markup).not.toContain('<rt');
  });
});

describe('JapaneseText — furigana nascosta (AC5)', () => {
  it('showFurigana=false ⇒ solo testo base, nessun <ruby>/<rt>; involucro ancora lang="ja"', () => {
    const markup = render(
      [
        { text: '今日', ruby: 'きょう' },
        { text: 'は', ruby: null },
      ],
      false,
    );
    expect(markup).not.toContain('<ruby>');
    expect(markup).not.toContain('<rt');
    // Il testo base è concatenato nell'ordine.
    expect(markup).toContain('今日');
    expect(markup).toContain('は');
    // L'involucro resta lang="ja" anche a furigana nascosta.
    expect(markup).toMatch(/<span lang="ja">/);
  });
});

describe('JapaneseText — involucro lang="ja" (AC2)', () => {
  it('i segmenti sono concatenati nell\'ordine dentro un unico nodo con lang="ja"', () => {
    const markup = render(
      [
        { text: '今日', ruby: 'きょう' },
        { text: 'は', ruby: null },
      ],
      true,
    );
    expect(markup).toMatch(/^<span lang="ja">/);
    // Ordine preservato: il primo segmento precede il secondo.
    expect(markup.indexOf('今日')).toBeLessThan(markup.indexOf('は'));
  });
});

describe('JapaneseText — lettura verbatim, nessun romaji (AC4)', () => {
  it('<rt> contiene esattamente la kana, nessuna forma romaji', () => {
    const markup = render([{ text: '茶', ruby: 'ちゃ' }], true);
    expect(markup).toContain('<rt aria-hidden="true">ちゃ</rt>');
    // Nessuna trascrizione romaji del contenuto reso (l'unico latino nel markup
    // sono i nomi di tag/attributo: span/ruby/rt/rp/lang/ja/aria-hidden/true).
    expect(markup).not.toMatch(/kyou/i);
    expect(markup).not.toMatch(/cha/i);
    // Il CONTENUTO dei nodi ruby/rt/rp non è mai testo latino: isoliamo il testo
    // fra i tag e verifichiamo che sia solo kana/kanji, mai romaji.
    const nodeText = markup.replace(/<[^>]+>/g, '');
    // Base + <rp>(</rp> + lettura + <rp>)</rp>, nell'ordine del DOM.
    expect(nodeText).toBe('茶(ちゃ)');
    expect(nodeText).not.toMatch(/[a-z]/i);
  });

  it('rende un ruby ARBITRARIO verbatim (prova che NON riallinea)', () => {
    // Se il componente riallineasse, non renderebbe una lettura arbitraria che
    // non è la lettura reale del testo. La prova che rende verbatim: passiamo un
    // ruby volutamente slegato e lo ritroviamo TALE E QUALE nell'<rt>.
    const markup = render([{ text: '駅', ruby: 'ぜんぜんちがう' }], true);
    expect(markup).toContain('<ruby>駅<rp>(</rp><rt aria-hidden="true">ぜんぜんちがう</rt><rp>)</rp></ruby>');
  });
});
