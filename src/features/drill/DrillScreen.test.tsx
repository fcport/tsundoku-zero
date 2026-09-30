import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import { CONJUGATION_FORMS, VERB_GROUPS, drillPool } from '../../domain/conjugation';
import { DRILL_VERBS } from '../../domain/drill-verbs';
import { DrillScreen, Training } from './DrillScreen';
import {
  DRILL_FORMS_STORAGE_KEY,
  readFormSelection,
  readGroupSelection,
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

describe('drillSelection', () => {
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
