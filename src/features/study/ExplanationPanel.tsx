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
import { useTranslation } from '../../i18n';
import type { ResolvedExplanation } from '../../domain/exercise';

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
}

export function ExplanationPanel({ explanation, correct }: ExplanationPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="flex w-full flex-col gap-3">
      {/* Dichiarazione testuale dell'esito SOLO a risposta data (AC1). Token neutri,
          nessun verde/rosso (AC2): l'informazione è nel TESTO. */}
      {correct !== null && (
        <p className="text-body text-ink-primary">
          {correct ? t('session.outcome.correct') : t('session.outcome.incorrect')}
        </p>
      )}

      <p className="text-label text-ink-secondary">{t('session.explanation.heading')}</p>

      {/* Il testo LETTERALE della spiegazione (mai una chiave i18n). `lang` sulla
          lingua EFFETTIVAMENTE resa: se è ripiego, il testo è in inglese ⇒ lang="en". */}
      <p className="text-body text-ink-primary" lang={explanation.language}>
        {explanation.text}
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
