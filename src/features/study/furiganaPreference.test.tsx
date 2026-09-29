// La preferenza rapida «mostra la furigana» (29-09-2026): la lettura dallo storage,
// la scrittura dallo store, e l'effetto sulla card (può solo SPEGNERE la furigana).
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import type { Exercise } from '../../domain/exercise';
import { ExerciseCard } from './ExerciseCard';
import {
  FURIGANA_STORAGE_KEY,
  readFuriganaPreference,
  useFuriganaPreference,
  useTranslationPreference,
} from '../../ui/furiganaPreference';

const withFurigana: Exercise = {
  kind: 'single-select',
  grammarPoint: 'wa-particle',
  sentence: { kanji: '私は学生です', kana: 'わたしはがくせいです' },
  answer: 'は',
  distractors: ['を', 'が', 'に'],
  explanation: { en: 'The topic particle.' },
};

function card(exercise: Exercise, furigana?: boolean): string {
  return renderToStaticMarkup(
    <ExerciseCard
      exercise={exercise}
      selected={[]}
      onSelect={() => {}}
      answered={false}
      onReveal={() => {}}
      revealed={false}
      correct={null}
      locale="en"
      furigana={furigana}
    />,
  );
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('readFuriganaPreference — predefinito visibile', () => {
  it('senza storage ⇒ visibile', () => {
    expect(readFuriganaPreference(undefined)).toBe(true);
  });

  it('nessun valore salvato ⇒ visibile', () => {
    expect(readFuriganaPreference(memoryStorage())).toBe(true);
  });

  it('"false" salvato ⇒ nascosta; qualunque altro valore ⇒ visibile', () => {
    expect(readFuriganaPreference(memoryStorage({ [FURIGANA_STORAGE_KEY]: 'false' }))).toBe(false);
    expect(readFuriganaPreference(memoryStorage({ [FURIGANA_STORAGE_KEY]: 'true' }))).toBe(true);
  });

  it('uno storage che lancia (privacy) ⇒ visibile, nessun errore', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readFuriganaPreference(throwing)).toBe(true);
  });
});

describe('useFuriganaPreference — lo store ricorda la scelta', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  });
  afterEach(() => {
    useFuriganaPreference.setState({ show: true });
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('setShow(false) aggiorna lo stato e lo scrive nello storage', () => {
    useFuriganaPreference.getState().setShow(false);
    expect(useFuriganaPreference.getState().show).toBe(false);
    expect(storage.data.get(FURIGANA_STORAGE_KEY)).toBe('false');
  });
});

describe('ExerciseCard — la preferenza può solo spegnere la furigana', () => {
  it('predefinito (preferenza assente) ⇒ furigana come da contenuto', () => {
    expect(card(withFurigana)).toContain('<ruby>');
  });

  it('preferenza accesa ⇒ furigana come da contenuto', () => {
    expect(card(withFurigana, true)).toContain('<ruby>');
  });

  it('preferenza spenta ⇒ nessuna furigana, la frase resta', () => {
    const markup = card(withFurigana, false);
    expect(markup).not.toContain('<ruby>');
    expect(markup).not.toContain('<rt');
    expect(markup).toContain('学生');
  });

  it('preferenza accesa ma contenuto senza furigana ⇒ resta senza', () => {
    const markup = card({ ...withFurigana, showFurigana: false }, true);
    expect(markup).not.toContain('<ruby>');
  });
});

describe('ExerciseCard — la furigana anche sulle opzioni, con la stessa casella', () => {
  const tiles: Exercise = {
    kind: 'assemble',
    grammarPoint: 'ga-subject',
    sentence: { kanji: '弟がパンを焼く', kana: 'おとうとがパンをやく' },
    answer: ['弟が', 'パンを', '焼く'],
    explanation: { en: 'Subject with ga.' },
  };

  it('casella accesa ⇒ le tessere con kanji portano la lettura, fuori dal nome accessibile', () => {
    const markup = card(tiles, true);
    expect(markup).toContain('<ruby>弟<rt aria-hidden="true"');
    expect(markup).toContain('おとうと</rt></ruby>');
    expect(markup).toMatch(/<ruby>焼<rt[^>]*>や<\/rt><\/ruby>く/);
    expect(markup).not.toContain('<rp>');
  });

  it('casella spenta ⇒ nessuna lettura sulle tessere', () => {
    const markup = card(tiles, false);
    expect(markup).not.toContain('<ruby>');
    expect(markup).toContain('>弟が<');
  });
});

describe('ExerciseCard — «Traduzioni»: il giapponese resta, la traduzione si aggiunge', () => {
  const tiles: Exercise = {
    kind: 'assemble',
    grammarPoint: 'ga-subject',
    sentence: { kanji: '弟がパンを焼く', kana: 'おとうとがパンをやく' },
    translation: { en: 'My younger brother bakes bread.', it: 'Mio fratello minore cuoce il pane.' },
    glosses: [{ text: '弟が', reading: 'おとうとが', meaning: { en: 'younger brother (subject)', it: 'fratello minore (soggetto)' } }],
    answer: ['弟が', 'パンを', '焼く'],
    explanation: { en: 'x' },
  };
  const span: Exercise = {
    kind: 'select-span',
    grammarPoint: 'copula',
    sentence: { kanji: '妹が学生だ', kana: 'いもうとががくせいだ' },
    translation: { en: 'My sister is a student.', it: 'Mia sorella è una studentessa.' },
    glosses: [{ text: 'だ', meaning: { en: 'is', it: 'vuol dire «è»' } }],
    answer: { start: 1, end: 2 },
    explanation: { en: 'x' },
  };
  function cardWith(exercise: Exercise, answered = false): string {
    return renderToStaticMarkup(
      <ExerciseCard
        exercise={exercise}
        selected={answered ? [1] : []}
        onSelect={() => {}}
        answered={answered}
        onReveal={() => {}}
        revealed={false}
        correct={answered ? true : null}
        locale="it"
      />,
    );
  }

  afterEach(() => {
    useTranslationPreference.setState({ show: false });
  });

  it('spenta (predefinito) ⇒ nessuna traduzione', () => {
    const markup = cardWith(tiles);
    expect(markup).not.toContain('Mio fratello minore cuoce il pane.');
    expect(markup).not.toContain('fratello minore (soggetto)');
  });

  it('accesa ⇒ la traduzione della frase e i significati delle tessere, nella lingua data', () => {
    useTranslationPreference.setState({ show: true });
    const markup = cardWith(tiles);
    expect(markup).toContain('lang="it"');
    expect(markup).toContain('Mio fratello minore cuoce il pane.');
    expect(markup).toContain('fratello minore (soggetto)');
    expect(markup).toContain('>弟');
  });

  it('selezione di una parte: il significato dei segmenti solo DOPO la risposta', () => {
    useTranslationPreference.setState({ show: true });
    expect(cardWith(span, false)).not.toContain('vuol dire «è»');
    expect(cardWith(span, false)).toContain('Mia sorella è una studentessa.');
    expect(cardWith(span, true)).toContain('vuol dire «è»');
  });
});
