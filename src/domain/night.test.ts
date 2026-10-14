import { describe, expect, it } from 'vitest';
import { alignFurigana } from './furigana';
import {
  FRAME_GAP,
  acceptedAnswers,
  cleanAnswer,
  judge,
  targetForm,
  type Ask,
  type AskOption,
  type Night,
} from './night';
import { NIGHTS } from './nights';

const asks = (night: Night) => night.steps.filter((s): s is Ask => s.kind === 'ask');

function option(id: string): AskOption {
  for (const night of NIGHTS) {
    for (const ask of asks(night)) {
      const found = ask.options.find((o) => o.id === id);
      if (found) return found;
    }
  }
  throw new Error(`scelta assente: ${id}`);
}

describe('le notti', () => {
  it.each(NIGHTS.map((n) => [n.id, n] as const))('%s: ogni domanda è ben fatta', (_, night) => {
    expect(asks(night).length).toBeGreaterThan(0);
    expect(night.steps.filter((s) => s.kind === 'candleOut')).toHaveLength(1);
    for (const ask of asks(night)) {
      expect(new Set(ask.options.map((o) => o.id)).size).toBe(ask.options.length);
      for (const o of ask.options) {
        // Uno e un solo spazio da riempire, nelle due grafie.
        expect(o.frame.kanji.split(FRAME_GAP)).toHaveLength(2);
        expect(o.frame.kana.split(FRAME_GAP)).toHaveLength(2);
        // La forma giusta si costruisce, e la frase intera si allinea per la furigana.
        const { result } = targetForm(o.target);
        expect(() =>
          alignFurigana(o.frame.kanji.replace(FRAME_GAP, result.kanji), o.frame.kana.replace(FRAME_GAP, result.kana)),
        ).not.toThrow();
        // Un errore previsto non è mai anche una risposta giusta.
        const accepted = acceptedAnswers(o);
        for (const m of o.mistakes ?? []) {
          for (const answer of m.answers) expect(accepted, `${o.id}: ${answer}`).not.toContain(cleanAnswer(answer));
        }
      }
    }
  });

  it('le battute in giapponese si allineano per la furigana', () => {
    for (const night of NIGHTS) {
      const lines = [
        ...night.steps,
        ...asks(night).flatMap((a) => a.options.flatMap((o) => [...o.then, ...(o.mistakes ?? []).flatMap((m) => m.then)])),
      ].filter((s) => s.kind === 'line');
      for (const line of lines) {
        // Come la pagina: pezzo per pezzo fra i segni di punteggiatura, stessi pezzi nelle due grafie.
        const kanji = line.ja.kanji.split(/[、。…？！「」]/);
        const kana = line.ja.kana.split(/[、。…？！「」]/);
        expect(kanji.length, line.ja.kanji).toBe(kana.length);
        kanji.forEach((piece, i) => expect(() => alignFurigana(piece, kana[i]!)).not.toThrow());
      }
    }
  });
});

describe('judge, con le risposte date davvero', () => {
  it('«volevo, ma non ho potuto»: cortese, semplice, e gli errori tipici', () => {
    expect(judge('yomitakatta desu', option('couldnt')).kind).toBe('correct');
    expect(judge('読みたかったです。', option('couldnt')).kind).toBe('correct');
    // La forma semplice è giusta, ma ha la sua reazione prima del seguito.
    const plain = judge('よみたかった', option('couldnt'));
    expect(plain.kind).toBe('correct');
    expect(plain.kind === 'correct' && plain.then.length).toBeGreaterThan(option('couldnt').then.length);
    expect(judge('yomitaideshita', option('couldnt')).kind).toBe('mistake');
    expect(judge('よんだかった', option('couldnt')).kind).toBe('mistake');
  });

  it('«eri noioso»: つまらなかったです, e つめたい fa la brina', () => {
    expect(judge('tsumaranakattadesu', option('boring')).kind).toBe('correct');
    expect(judge('tsumetai deshita', option('boring')).kind).toBe('mistake');
    expect(judge('つまらないでした', option('boring')).kind).toBe('mistake');
  });

  it('«non volevo»: 読まなかった risponde a un\'altra domanda', () => {
    expect(judge('よみたくなかったです', option('didnt')).kind).toBe('correct');
    expect(judge('yomanakatta', option('didnt')).kind).toBe('mistake');
  });

  it('parole non giapponesi, sbagliate, vuote', () => {
    expect(judge('divertente', option('boring')).kind).toBe('foreign');
    expect(judge('たべたい', option('boring')).kind).toBe('wrong');
    expect(judge(' 。', option('boring')).kind).toBe('empty');
  });
});
