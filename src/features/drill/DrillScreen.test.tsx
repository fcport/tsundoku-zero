import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import { CONJUGATION_FORMS, VERB_GROUPS, drillPool } from '../../domain/conjugation';
import { DRILL_VERBS } from '../../domain/drill-verbs';
import { RECIPES, RECIPE_IDS, buildPool } from '../../domain/form-builder';
import { DrillScreen, Training } from './DrillScreen';
import { BuilderTraining, RecipeOptions } from './FormBuilder';
import {
  DRILL_FORMS_STORAGE_KEY,
  DRILL_MODE_STORAGE_KEY,
  DRILL_RECIPES_STORAGE_KEY,
  readFormSelection,
  readGroupSelection,
  readModeSelection,
  readRecipeSelection,
  toggleValue,
} from './drillSelection';

// Ambiente `node`: `renderToStaticMarkup` non esegue eventi. Il controllo della
// risposta e la scelta della domanda sono provati nel dominio (conjugation.test);
// qui le due schermate (scelta, domanda) alla prima resa e gli aiuti della scelta.

function storage(values: Record<string, string>): Pick<Storage, 'getItem'> {
  return { getItem: (key) => values[key] ?? null };
}

describe('DrillScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('comincia dalla scelta: gruppi, forme e il pulsante per partire', () => {
    const html = renderToStaticMarkup(<DrillScreen onExit={() => {}} random={() => 0} />);
    expect(html).toContain('Cosa allenare');
    expect(html).toContain('Potenziale (posso fare)');
    expect(html).toContain('Irregolari (suru, kuru)');
    expect(html).toContain('Comincia');
    // Nessuna domanda prima di aver scelto.
    expect(html).not.toContain('La tua risposta');
    // Più i due interruttori del dorso (furigana, traduzioni).
    expect(html.match(/type="checkbox"/g)).toHaveLength(
      CONJUGATION_FORMS.length + VERB_GROUPS.length + 2,
    );
  });

  it('offre le due modalità, a partire da una forma alla volta', () => {
    const html = renderToStaticMarkup(<DrillScreen onExit={() => {}} random={() => 0} />);
    expect(html).toContain('Una forma alla volta');
    expect(html).toContain('Costruttore di forme');
    expect(html.match(/type="radio"/g)).toHaveLength(2);
  });

  it('dice quante combinazioni ha la scelta', () => {
    const html = renderToStaticMarkup(<DrillScreen onExit={() => {}} random={() => 0} />);
    const count = drillPool(DRILL_VERBS, CONJUGATION_FORMS, VERB_GROUPS).length;
    expect(html).toContain(`${count} combinazioni di verbo e forma`);
  });
});

describe('Training', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('mostra il verbo, la forma richiesta e il campo della risposta', () => {
    const pool = drillPool(DRILL_VERBS, ['masu'], ['godan']);
    const html = renderToStaticMarkup(
      <Training pool={pool} random={() => 0} masthead={() => null} />,
    );
    // random 0 ⇒ la prima coppia: 買う, cortese.
    expect(html).toContain('買');
    expect(html).toContain('Cortese');
    expect(html).toContain('〜ます');
    expect(html).toContain('La tua risposta');
    expect(html).toContain('Controlla');
  });
});

describe('il costruttore di forme', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('elenca le combinazioni divise per numero di pezzi, con un esempio', () => {
    const html = renderToStaticMarkup(<RecipeOptions recipes={[...RECIPE_IDS]} onRecipes={() => {}} />);
    expect(html.match(/type="checkbox"/g)).toHaveLength(RECIPES.length);
    expect(html).toContain('Due pezzi');
    expect(html).toContain('Quattro pezzi');
    expect(html).toContain('volevo … (cortese)');
    expect(html).toContain('食べたかったです');
  });

  it('chiede la catena coi suoi pezzi in ordine', () => {
    const pool = buildPool(
      DRILL_VERBS.filter((v) => v.kanji === '勉強する'),
      ['tai-past-polite'],
      ['irregular'],
    );
    const html = renderToStaticMarkup(
      <BuilderTraining pool={pool} random={() => 0} masthead={() => null} />,
    );
    expect(html).toContain('勉強');
    expect(html).toContain('volevo … (cortese)');
    expect(html).toContain('Voglio');
    expect(html).toContain('〜です');
    expect(html.indexOf('Voglio')).toBeLessThan(html.indexOf('Passato'));
    expect(html).toContain('La tua risposta');
    // La risposta non si vede prima di rispondere.
    expect(html).not.toContain('したかった');
  });
});

describe('drillSelection', () => {
  it('la modalità parte da una forma alla volta, e ricorda il costruttore', () => {
    expect(readModeSelection(storage({}))).toBe('forms');
    expect(readModeSelection(storage({ [DRILL_MODE_STORAGE_KEY]: 'builder' }))).toBe('builder');
    expect(readModeSelection(storage({ [DRILL_MODE_STORAGE_KEY]: 'boh' }))).toBe('forms');
  });

  it('le combinazioni salvate tengono solo quelle che esistono', () => {
    expect(readRecipeSelection(storage({}))).toEqual(RECIPE_IDS);
    const saved = storage({ [DRILL_RECIPES_STORAGE_KEY]: '["tai-past-polite","vecchia","tai-past"]' });
    expect(readRecipeSelection(saved)).toEqual(['tai-past', 'tai-past-polite']);
  });

  it('senza nulla di salvato sceglie tutto', () => {
    expect(readFormSelection(storage({}))).toEqual(CONJUGATION_FORMS);
    expect(readGroupSelection(undefined)).toEqual(VERB_GROUPS);
  });

  it('tiene solo i valori conosciuti, in ordine canonico', () => {
    const saved = storage({ [DRILL_FORMS_STORAGE_KEY]: '["te","boh","masu"]' });
    expect(readFormSelection(saved)).toEqual(['masu', 'te']);
  });

  it('un salvataggio rotto o vuoto vale come tutto', () => {
    expect(readFormSelection(storage({ [DRILL_FORMS_STORAGE_KEY]: '{' }))).toEqual(CONJUGATION_FORMS);
    expect(readFormSelection(storage({ [DRILL_FORMS_STORAGE_KEY]: '[]' }))).toEqual(CONJUGATION_FORMS);
  });

  it('toggleValue aggiunge in ordine e non toglie l\'ultimo', () => {
    expect(toggleValue(['te'], 'masu', CONJUGATION_FORMS)).toEqual(['masu', 'te']);
    expect(toggleValue(['masu', 'te'], 'te', CONJUGATION_FORMS)).toEqual(['masu']);
    expect(toggleValue(['te'], 'te', CONJUGATION_FORMS)).toEqual([]);
  });
});
