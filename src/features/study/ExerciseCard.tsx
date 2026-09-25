// Livello features/study: la CARD dell'esercizio, PRESENTAZIONALE e CONTROLLATA
// (3.18, AD-1: features→domain/ui/i18n, MAI data). Rende ciò che riceve — la
// consegna (chiave i18n per `kind`), la frase giapponese via `<JapaneseText>`, e un
// `<button>` per ciascuna opzione di `answerOptions` — senza possedere stato:
// `selected`/`onSelect` sono props (lo stato vive in `SessionScreen`, senso unico).
//
// DUE stati a senso unico in questa storia (il terzo, `spiegazione`, è 3.19):
// - `consegna` (`selected === null`): opzioni ABILITATE, `onSelect` cablato.
// - `risposta data` (`selected !== null`, AC4): TUTTE le opzioni `disabled` (senso
//   unico, non si può cambiare), la scelta `aria-pressed="true"`, le altre `"false"`.
//
// L'ordine e il numero delle opzioni sono DOMINIO (`answerOptions`, AC2), mai decisi
// qui. Nessuna grammatica della celebrazione (AC3): nessun verde/rosso, l'etichetta
// e la posizione portano l'informazione; ogni opzione `min-h-[56px]` (bersaglio ≥56px).
// La card è l'UNICA superficie `surface-raised`. Il ruolo tipografico della frase è
// un interim ESISTENTE (`text-display`): il ruolo `sentence-hero` è 3.23 ([[DW-19]]).
import { useTranslation } from '../../i18n';
import { answerOptions } from '../../domain/exercise-presentation';
import { alignFurigana } from '../../domain/furigana';
import { furiganaVisible } from '../../domain/exercise';
import { JapaneseText } from '../../ui/JapaneseText';
import type { Exercise } from '../../domain/exercise';

export interface ExerciseCardProps {
  /** L'esercizio da presentare (già validato/caricato, `Exercise` di dominio). */
  readonly exercise: Exercise;
  /**
   * L'INDICE dell'opzione scelta, o `null` se nessuna. `null` ⇒ stato `consegna`
   * (opzioni abilitate); non-null ⇒ stato `risposta data` (tutte `disabled`, senso
   * unico). L'identità è la POSIZIONE, non il testo: con opzioni di testo duplicato
   * (tessere/segmenti/particelle ripetute, realistici in assemble/select-span) la
   * posizione porta l'informazione (AC3) e un solo bottone risulta premuto.
   */
  readonly selected: number | null;
  /** Invocato con l'INDICE dell'opzione scelta. Cablato SOLO nello stato `consegna`. */
  readonly onSelect: (index: number) => void;
}

// La consegna per `kind`: chiave i18n del namespace `session.prompt`. Un `Record`
// esaustivo su `Exercise['kind']` — un kind nuovo sarebbe errore di COMPILAZIONE.
const PROMPT_KEY: Record<
  Exercise['kind'],
  'session.prompt.singleSelect' | 'session.prompt.selectSpan' | 'session.prompt.assemble'
> = {
  'single-select': 'session.prompt.singleSelect',
  'select-span': 'session.prompt.selectSpan',
  assemble: 'session.prompt.assemble',
};

export function ExerciseCard({ exercise, selected, onSelect }: ExerciseCardProps) {
  const { t } = useTranslation();
  const options = answerOptions(exercise);
  const answered = selected !== null;
  // I segmenti della frase (contenuto), allineati nel dominio (AD-21); la
  // visibilità della furigana è risolta dal dominio (predefinito VISIBILE).
  const segments = alignFurigana(exercise.sentence.kanji, exercise.sentence.kana);

  return (
    <article className="flex flex-col items-center gap-6 rounded-md bg-surface-raised p-6">
      {/* La consegna: chiave i18n per il kind (AC1). */}
      <p className="text-label text-ink-secondary">{t(PROMPT_KEY[exercise.kind])}</p>

      {/* La frase giapponese resa dal primitivo esistente (AC1): segmenti allineati
          + visibilità risolta nel dominio. Ruolo tipografico interim (text-display). */}
      <p className="text-display text-ink-primary">
        <JapaneseText segments={segments} showFurigana={furiganaVisible(exercise)} />
      </p>

      {/* Un <button> per ciascuna opzione di answerOptions (numero e ordine dal
          dominio, AC2). Stato consegna: abilitati, onSelect cablato. Stato risposta
          data: tutti disabled (senso unico, AC4), la scelta aria-pressed="true".
          Nessuna distinzione per solo colore (AC3): stessi token per ogni opzione;
          etichetta e posizione portano l'informazione. min-h-[56px] su ciascuna. */}
      <ul className="flex w-full flex-col gap-3">
        {options.map((option, i) => (
          <li key={i}>
            <button
              type="button"
              aria-pressed={selected === i}
              disabled={answered}
              onClick={answered ? undefined : () => onSelect(i)}
              className="min-h-[56px] w-full rounded-md border border-border-strong bg-surface-base text-ink-primary p-3 text-body"
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}
