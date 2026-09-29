// Livello features/study (3.19): il PANNELLO della spiegazione, PRESENTAZIONALE e
// CONTROLLATO (AD-1: features→domain/ui/i18n, MAI data). Rende la spiegazione
// bilingue GIÀ RISOLTA nel dominio (`resolveExplanation`/`resolveBilingual`,
// FR8.5) e, quando l'esito è noto, la DICHIARAZIONE testuale della correttezza.
//
// Due usi con la stessa superficie:
// - Consulto PRE-risposta (`correct === null`, AC3): SOLO la spiegazione, nessuna
//   dichiarazione di esito, nessuno stile di penalità.
// - Post-risposta (`correct !== null`, AC1): la dichiarazione in TESTO
//   (`session.outcome.correct`|`incorrect`) PIÙ la spiegazione.
//
// NESSUNA grammatica della celebrazione (AC2): nessun verde per il corretto né
// rosso per lo sbagliato, stessi token neutri — l'informazione la porta il
// CONTENUTO della spiegazione. Il `text` reso è sempre LETTERALE (mai una chiave
// i18n); se è un ripiego dichiarato (`isFallback`) l'avviso «non ancora tradotta»
// lo dichiara e il nodo porta `lang` sulla lingua EFFETTIVAMENTE resa.
import { resolveLocale, useTranslation } from '../../i18n';
import { Translation } from '../../ui/Translation';
import type { ResolvedExplanation } from '../../domain/exercise';
import { Furigana } from '../../ui/Furigana';
import { annotateKnownKanji } from '../../domain/option-furigana';

export interface ExplanationPanelProps {
  /**
   * La spiegazione GIÀ risolta dal dominio (`resolveExplanation`): `text`
   * letterale, `language` effettiva e `isFallback` (ripiego dichiarato).
   */
  readonly explanation: ResolvedExplanation;
  /**
   * La correttezza della risposta, o `null` se la risposta non è ancora data
   * (consulto pre-risposta, AC3). `null` ⇒ solo spiegazione; `true`/`false` ⇒
   * dichiarazione testuale (`session.outcome.correct`|`incorrect`) + spiegazione.
   * Nessun colore d'esito in nessun caso (AC2).
   */
  readonly correct: boolean | null;
  /**
   * Le letture CERTE dei kanji (`corsa → lettura`), ricavate dalla frase
   * dell'esercizio: le parole giapponesi della spiegazione che vi compaiono
   * prendono la furigana. Assente ⇒ testo semplice.
   */
  readonly readings?: ReadonlyMap<string, string>;
}

export function ExplanationPanel({ explanation, correct, readings }: ExplanationPanelProps) {
  const { t, i18n } = useTranslation();

  return (
    <section className="flex w-full flex-col gap-3">
      {/* Dichiarazione testuale dell'esito SOLO a risposta data (AC1), accanto a un
          TIMBRO da impaginato: 正 per giusta, 誤 per sbagliata. Il timbro ha lo
          STESSO colore nei due esiti (nessun verde/rosso, AC2): la differenza la
          portano il testo e il carattere, mai la tinta. È decorativo (`aria-hidden`):
          l'AT legge la dichiarazione. */}
      {correct !== null && (
        <div className="flex items-center gap-4 border-b-[1.5px] border-border-strong pb-4">
          <span className="flex shrink-0 flex-col items-center gap-1">
            <span
              aria-hidden="true"
              lang="ja"
              className="grid size-14 -rotate-6 place-items-center border-[3px] border-accent text-[30px] font-extrabold leading-none text-accent"
            >
              <Furigana
                segments={[correct ? { text: '正', ruby: 'せい' } : { text: '誤', ruby: 'ご' }]}
              />
            </span>
            {/* La traduzione del timbro, con «Traduzioni» acceso. Decorativa come il
                timbro: l'esito per l'AT è la dichiarazione accanto. */}
            <span aria-hidden="true">
              <Translation
                text={t(correct ? 'session.stampMeaning.correct' : 'session.stampMeaning.incorrect')}
                lang={resolveLocale(i18n.language)}
                className="block font-mono text-label-caps uppercase text-accent"
              />
            </span>
          </span>
          <p className="text-[24px] font-extrabold uppercase leading-tight font-stretch-condensed text-ink-primary">
            {correct ? t('session.outcome.correct') : t('session.outcome.incorrect')}
          </p>
        </div>
      )}

      <p className="font-mono text-label-caps uppercase text-ink-secondary">
        {t('session.explanation.heading')}
      </p>

      {/* Il testo LETTERALE della spiegazione (mai una chiave i18n). `lang` sulla
          lingua EFFETTIVAMENTE resa: se è ripiego, il testo è in inglese ⇒ lang="en".
          Il capolettera grande è quello di un articolo di rivista. */}
      <p
        className="text-body text-ink-primary first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-[46px] first-letter:font-black first-letter:leading-[0.8] first-letter:text-accent"
        lang={explanation.language}
      >
        {readings
          ? // Le parole in kanji con una lettura nota prendono la furigana (in un
            // nodo lang="ja"); il resto del testo resta com'è.
            annotateKnownKanji(explanation.text, readings).map((seg, i) =>
              seg.ruby ? (
                <span key={i} lang="ja">
                  <Furigana segments={[seg]} />
                </span>
              ) : (
                seg.text
              ),
            )
          : explanation.text}
      </p>

      {/* Ripiego DICHIARATO (FR8.5): «non ancora tradotta», invece di far passare
          l'inglese per italiano. Nessuno stile di penalità/avvertimento. */}
      {explanation.isFallback && (
        <p className="text-label text-ink-secondary">
          {t('session.explanation.fallbackNotice')}
        </p>
      )}
    </section>
  );
}
