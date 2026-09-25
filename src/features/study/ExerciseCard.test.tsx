import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { i18n } from '../../i18n';
import { answerOptions } from '../../domain/exercise-presentation';
import { ExerciseCard } from './ExerciseCard';
import type { Exercise } from '../../domain/exercise';

// AC1/AC2/AC3/AC4 — la card presentazionale controllata. Ambiente `node`:
// renderToStaticMarkup, nessun evento. Stato consegna (selected null): consegna
// presente, JapaneseText reso, N opzioni per kind (min-h-[56px], abilitate, nessun
// verde/rosso). Stato risposta-data (selected impostato): opzioni disabled, la
// scelta aria-pressed="true".

const singleSelect: Exercise = {
  kind: 'single-select',
  grammarPoint: 'wa-particle',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['を', 'が', 'に'],
  explanation: { en: 'The topic particle.' },
};

const assemble: Exercise = {
  kind: 'assemble',
  grammarPoint: 'word-order',
  sentence: { kanji: '本を読む', kana: 'ほんをよむ' },
  answer: ['本', 'を', '読む'],
  explanation: { en: 'Subject object verb.' },
};

const selectSpan: Exercise = {
  kind: 'select-span',
  grammarPoint: 'i-adjective',
  sentence: { kanji: '難しい', kana: 'むずかしい' },
  answer: { start: 0, end: 1 },
  explanation: { en: 'An i-adjective.' },
};

const NOOP = () => {};

function render(exercise: Exercise, selected: number | null): string {
  return renderToStaticMarkup(
    <ExerciseCard exercise={exercise} selected={selected} onSelect={NOOP} />,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('AC1 — consegna + giapponese', () => {
  it('rende la consegna per il kind (da session.prompt.*)', () => {
    expect(render(singleSelect, null)).toContain(en.session.prompt.singleSelect);
    expect(render(selectSpan, null)).toContain(en.session.prompt.selectSpan);
    expect(render(assemble, null)).toContain(en.session.prompt.assemble);
  });

  it('rende la frase giapponese via JapaneseText (lang="ja", furigana visibile)', () => {
    const markup = render(singleSelect, null);
    // JapaneseText avvolge in <span lang="ja"> e rende ruby (furigana predefinita
    // VISIBILE): il kanji della frase compare dentro un nodo lang="ja".
    expect(markup).toContain('lang="ja"');
    expect(markup).toContain('<ruby>');
  });
});

describe('AC2 — numero di opzioni DERIVATO dal tipo, ordine deterministico', () => {
  it('single-select: 1 + |distractors| bottoni opzione', () => {
    const markup = render(singleSelect, null);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(1 + singleSelect.distractors.length);
  });

  it('assemble: |answer| bottoni (tessere)', () => {
    const markup = render(assemble, null);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(assemble.answer.length);
  });

  it('select-span: |segmenti| bottoni', () => {
    const markup = render(selectSpan, null);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(answerOptions(selectSpan).length);
  });

  it('rende le opzioni nell ordine di answerOptions (dominio, non UI)', () => {
    const options = answerOptions(singleSelect);
    const markup = render(singleSelect, null);
    // Le posizioni nel markup rispettano l ordine del dominio.
    const positions = options.map((o) => markup.indexOf(`>${o}<`));
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });
});

describe('AC3 — opzioni accessibili: min-h-[56px], nessun colore-solo', () => {
  it('ogni opzione ha min-h-[56px]', () => {
    const markup = render(singleSelect, null);
    const occurrences = markup.match(/min-h-\[56px\]/g) ?? [];
    expect(occurrences.length).toBe(answerOptions(singleSelect).length);
  });

  it('nessuna distinzione per solo colore (nessun verde/rosso; niente success/danger/green/red)', () => {
    const markup = render(singleSelect, null);
    expect(markup).not.toContain('danger');
    expect(markup.toLowerCase()).not.toContain('green');
    expect(markup.toLowerCase()).not.toContain('red');
    // Nessuna grammatica della celebrazione.
    expect(markup).not.toContain('!');
  });
});

describe('AC / consegna — stato senza risposta (selected null): opzioni ABILITATE', () => {
  it('nessun bottone è disabled nello stato consegna', () => {
    const markup = render(singleSelect, null);
    expect(markup).not.toContain('disabled');
  });

  it('nessun bottone è aria-pressed="true" (nessuna scelta ancora)', () => {
    const markup = render(singleSelect, null);
    expect(markup).not.toContain('aria-pressed="true"');
  });
});

describe('AC4 — risposta data (senso unico)', () => {
  const chosenIndex = 1;
  const markup = render(singleSelect, chosenIndex);

  it('TUTTE le opzioni sono disabled (non si può cambiare)', () => {
    const disabled = markup.match(/disabled/g) ?? [];
    expect(disabled.length).toBe(answerOptions(singleSelect).length);
  });

  it('la scelta ha aria-pressed="true", ESATTAMENTE una', () => {
    const pressedTrue = markup.match(/aria-pressed="true"/g) ?? [];
    expect(pressedTrue.length).toBe(1);
  });

  it('le altre opzioni hanno aria-pressed="false"', () => {
    const pressedFalse = markup.match(/aria-pressed="false"/g) ?? [];
    expect(pressedFalse.length).toBe(answerOptions(singleSelect).length - 1);
  });
});
