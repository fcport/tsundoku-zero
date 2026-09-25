import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { i18n } from '../../i18n';
import { answerOptions } from '../../domain/exercise-presentation';
import { ExerciseCard } from './ExerciseCard';
import type { Exercise } from '../../domain/exercise';
import type { Locale } from '../../i18n';

// AC1/AC2/AC3 (3.18/3.19) — la card presentazionale controllata. Ambiente `node`:
// renderToStaticMarkup, nessun evento. Stato consegna (`answered` false): consegna
// presente, JapaneseText reso, N opzioni per kind (min-h-[56px], abilitate, nessun
// verde/rosso), azione «mostra la spiegazione». Composizione: `selected` è l'ARRAY
// ordinato degli indici (assemble multi-tocco, badge d'ordine, tessere piazzate
// disabled). Stato spiegazione (`answered` true): opzioni disabled, le scelte
// aria-pressed="true", dichiarazione TESTUALE dell'esito + spiegazione (nessun colore).

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

interface RenderOptions {
  readonly selected?: readonly number[];
  readonly answered?: boolean;
  readonly revealed?: boolean;
  readonly correct?: boolean | null;
  readonly locale?: Locale;
}

function render(exercise: Exercise, options: RenderOptions = {}): string {
  return renderToStaticMarkup(
    <ExerciseCard
      exercise={exercise}
      selected={options.selected ?? []}
      onSelect={NOOP}
      answered={options.answered ?? false}
      onReveal={NOOP}
      revealed={options.revealed ?? false}
      correct={options.correct ?? null}
      locale={options.locale ?? 'en'}
    />,
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
    expect(render(singleSelect)).toContain(en.session.prompt.singleSelect);
    expect(render(selectSpan)).toContain(en.session.prompt.selectSpan);
    expect(render(assemble)).toContain(en.session.prompt.assemble);
  });

  it('rende la frase giapponese via JapaneseText (lang="ja", furigana visibile)', () => {
    const markup = render(singleSelect);
    expect(markup).toContain('lang="ja"');
    expect(markup).toContain('<ruby>');
  });
});

describe('AC2 — numero di opzioni DERIVATO dal tipo, ordine deterministico', () => {
  it('single-select: 1 + |distractors| bottoni opzione', () => {
    const markup = render(singleSelect);
    const buttons = markup.match(/<button/g) ?? [];
    // 1 + |distractors| opzioni + l azione «mostra la spiegazione».
    expect(buttons.length).toBe(1 + singleSelect.distractors.length + 1);
  });

  it('assemble: |answer| bottoni (tessere) + azione spiegazione', () => {
    const markup = render(assemble);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(assemble.answer.length + 1);
  });

  it('select-span: |segmenti| bottoni + azione spiegazione', () => {
    const markup = render(selectSpan);
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(answerOptions(selectSpan).length + 1);
  });

  it('rende le opzioni nell ordine di answerOptions (dominio, non UI)', () => {
    const options = answerOptions(singleSelect);
    const markup = render(singleSelect);
    const positions = options.map((o) => markup.indexOf(`>${o}<`));
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });
});

describe('AC3 — opzioni accessibili: min-h-[56px], nessun colore-solo', () => {
  it('ogni opzione ha min-h-[56px]', () => {
    const markup = render(singleSelect);
    const occurrences = markup.match(/min-h-\[56px\]/g) ?? [];
    // Ogni opzione ha min-h-[56px] (l azione «mostra spiegazione» non è un bersaglio ≥56px).
    expect(occurrences.length).toBe(answerOptions(singleSelect).length);
  });

  it('nessuna distinzione per solo colore (nessun verde/rosso; niente success/danger/green/red)', () => {
    const markup = render(singleSelect);
    expect(markup).not.toContain('danger');
    expect(markup.toLowerCase()).not.toContain('green');
    expect(markup.toLowerCase()).not.toContain('red');
    expect(markup).not.toContain('!');
  });
});

describe('AC / consegna — stato senza risposta (answered false): opzioni ABILITATE', () => {
  it('nessuna opzione è disabled nello stato consegna (nessuna scelta)', () => {
    const markup = render(singleSelect);
    expect(markup).not.toContain('disabled');
  });

  it('nessun bottone è aria-pressed="true" (nessuna scelta ancora)', () => {
    const markup = render(singleSelect);
    expect(markup).not.toContain('aria-pressed="true"');
  });
});

describe('AC3 — azione «mostra la spiegazione» (consulto pre-risposta)', () => {
  it('nello stato consegna l azione è presente', () => {
    const markup = render(singleSelect);
    expect(markup).toContain(en.session.explanation.reveal);
  });

  it('una volta rivelata (revealed) l azione non ricompare, ma la spiegazione sì (senza esito)', () => {
    const markup = render(singleSelect, { revealed: true });
    expect(markup).not.toContain(en.session.explanation.reveal);
    // Consulto: la spiegazione è resa, MA nessuna dichiarazione di esito.
    expect(markup).toContain(singleSelect.explanation.en);
    expect(markup).not.toContain(en.session.outcome.correct);
    expect(markup).not.toContain(en.session.outcome.incorrect);
  });
});

describe('AC2 — composizione assemble (multi-tocco via props selected)', () => {
  it('le tessere PIAZZATE sono disabled, le altre abilitate', () => {
    // Due tessere piazzate (indici 0 e 2), la terza (indice 1) ancora libera.
    const markup = render(assemble, { selected: [0, 2] });
    // Due opzioni disabled (le piazzate); l azione spiegazione non è disabled.
    const disabled = markup.match(/disabled/g) ?? [];
    expect(disabled.length).toBe(2);
  });

  it('le tessere piazzate portano un BADGE d ordine (posizione dei tocchi)', () => {
    // Ordine dei tocchi: indice 2 per primo, indice 0 per secondo.
    const markup = render(assemble, { selected: [2, 0] });
    // Badge 1. e 2. presenti (l ordine è quello dei tocchi, non degli indici).
    expect(markup).toContain('1. ');
    expect(markup).toContain('2. ');
  });

  it('le tessere piazzate hanno aria-pressed="true"', () => {
    const markup = render(assemble, { selected: [0, 1] });
    const pressedTrue = markup.match(/aria-pressed="true"/g) ?? [];
    expect(pressedTrue.length).toBe(2);
  });
});

describe('AC4 — risposta data (senso unico)', () => {
  const markup = render(singleSelect, { selected: [1], answered: true, correct: true });

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

  it('l azione «mostra la spiegazione» non è più presente (risposta data)', () => {
    expect(markup).not.toContain(en.session.explanation.reveal);
  });
});

describe('AC1/AC2 — stato spiegazione: dichiarazione TESTUALE dell esito, nessun colore', () => {
  it('risposta corretta ⇒ dichiara «corretto» in testo + spiegazione', () => {
    const markup = render(singleSelect, { selected: [0], answered: true, correct: true });
    expect(markup).toContain(en.session.outcome.correct);
    expect(markup).not.toContain(en.session.outcome.incorrect);
    expect(markup).toContain(singleSelect.explanation.en);
  });

  it('risposta errata ⇒ dichiara «non corretto» in testo + spiegazione', () => {
    const markup = render(singleSelect, { selected: [0], answered: true, correct: false });
    expect(markup).toContain(en.session.outcome.incorrect);
    expect(markup).not.toContain(en.session.outcome.correct);
    expect(markup).toContain(singleSelect.explanation.en);
  });

  it('nessuna grammatica della celebrazione nello stato spiegazione (no verde/rosso, no !)', () => {
    const markup = render(singleSelect, { selected: [0], answered: true, correct: true });
    expect(markup).not.toContain('danger');
    expect(markup.toLowerCase()).not.toContain('green');
    expect(markup.toLowerCase()).not.toContain('red');
    expect(markup).not.toContain('!');
  });
});
