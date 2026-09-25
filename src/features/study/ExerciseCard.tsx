// Livello features/study: la CARD dell'esercizio, PRESENTAZIONALE e CONTROLLATA
// (3.18/3.19, AD-1: features→domain/ui/i18n, MAI data). Rende ciò che riceve — la
// consegna (chiave i18n per `kind`), la frase giapponese via `<JapaneseText>`, e un
// `<button>` per ciascuna opzione di `answerOptions` — senza possedere stato:
// `selected`/`onSelect`/`answered`/fase sono props (lo stato vive in
// `SessionScreen`, senso unico).
//
// TRE stati a senso unico (3.19 aggiunge il terzo):
// - `consegna` (`!answered`): opzioni ABILITATE, `onSelect` cablato; un'azione
//   «mostra la spiegazione» (`onReveal`) rivela l'`ExplanationPanel` (solo
//   spiegazione, AC3); una volta rivelata (`revealed`) l'azione non ricompare.
// - `risposta data`/`spiegazione` (`answered`): TUTTE le opzioni `disabled` (senso
//   unico, AC4), le scelte `aria-pressed="true"`, le altre `"false"`; rende
//   l'`ExplanationPanel` con la dichiarazione testuale dell'esito (`correct`).
//
// COMPOSIZIONE per tipo (3.19): `selected` è l'ARRAY ordinato degli indici toccati
// (posizione, non testo). single-select/select-span: un tocco. assemble: append in
// ordine — una tessera già piazzata è `disabled` e porta un BADGE di posizione.
//
// L'ordine e il numero delle opzioni sono DOMINIO (`answerOptions`, AC2), mai decisi
// qui. Nessuna grammatica della celebrazione (AC2): nessun verde/rosso, l'etichetta
// e la posizione portano l'informazione; ogni opzione `min-h-[56px]` (bersaglio ≥56px).
// La card è l'UNICA superficie `surface-raised`.
import { useTranslation } from '../../i18n';
import { answerOptions } from '../../domain/exercise-presentation';
import { alignFurigana } from '../../domain/furigana';
import { furiganaVisible, resolveExplanation } from '../../domain/exercise';
import type { Exercise } from '../../domain/exercise';
import type { Locale } from '../../i18n';
import { JapaneseText } from '../../ui/JapaneseText';
import { ExplanationPanel } from './ExplanationPanel';

// ANELLO DI FOCUS visibile (3.22, AC5): la stessa definizione della sessione
// (`SessionScreen`), applicata qui alle opzioni e a «mostra la spiegazione». Il token
// è `focus-ring` (in scuro `accent-dark`, cfr. `theme.css`); `focus-visible:` mostra
// l'anello solo per navigazione da tastiera. Nessun colore letterale (UX-DR1).
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring dark:focus-visible:outline-accent-dark';

export interface ExerciseCardProps {
  /** L'esercizio da presentare (già validato/caricato, `Exercise` di dominio). */
  readonly exercise: Exercise;
  /**
   * Gli INDICI delle opzioni scelte, NELL'ORDINE dei tocchi. Vuoto ⇒ nessuna
   * scelta. L'identità è la POSIZIONE, non il testo: con opzioni di testo duplicato
   * (tessere/segmenti/particelle ripetute) la posizione porta l'informazione (AC2)
   * e solo i bottoni scelti risultano premuti. Per single-select/select-span ha al
   * più un elemento; per assemble cresce a ogni tocco (append-only).
   */
  readonly selected: readonly number[];
  /** Invocato con l'INDICE dell'opzione scelta. Cablato SOLO nello stato `consegna`. */
  readonly onSelect: (index: number) => void;
  /**
   * `true` ⇒ la risposta è stata data (stato `risposta data`/`spiegazione`): tutte
   * le opzioni `disabled` (senso unico, AC4), l'`ExplanationPanel` reso con la
   * dichiarazione dell'esito. `false` ⇒ stato `consegna`.
   */
  readonly answered: boolean;
  /** Invocato dall'azione «mostra la spiegazione» (consulto pre-risposta, AC3). */
  readonly onReveal: () => void;
  /**
   * `true` ⇒ la spiegazione è stata consultata prima di rispondere: l'azione di
   * rivelazione non ricompare e l'`ExplanationPanel` (solo spiegazione, `correct`
   * null) è reso già nello stato `consegna`.
   */
  readonly revealed: boolean;
  /**
   * La correttezza della risposta, o `null` se non ancora data. Passato
   * all'`ExplanationPanel`: `null` ⇒ solo spiegazione (consulto), non-null ⇒
   * dichiarazione testuale + spiegazione. Nessun colore d'esito (AC2).
   */
  readonly correct: boolean | null;
  /** La lingua per risolvere la spiegazione bilingue (`resolveExplanation`, FR8.5). */
  readonly locale: Locale;
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

export function ExerciseCard({
  exercise,
  selected,
  onSelect,
  answered,
  onReveal,
  revealed,
  correct,
  locale,
}: ExerciseCardProps) {
  const { t } = useTranslation();
  const options = answerOptions(exercise);
  // I segmenti della frase (contenuto), allineati nel dominio (AD-21); la
  // visibilità della furigana è risolta dal dominio (predefinito VISIBILE).
  const segments = alignFurigana(exercise.sentence.kanji, exercise.sentence.kana);
  // La spiegazione bilingue RISOLTA nel dominio (FR8.5): `locale` coincide con
  // `BilingualLanguage` ('en'|'it'). Resa dall'`ExplanationPanel` (consulto o esito).
  const explanation = resolveExplanation(exercise.explanation, locale);
  // La spiegazione è visibile se rivelata prima (consulto) o dopo la risposta.
  const showExplanation = revealed || answered;

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
          dominio, AC2). Consegna: abilitati, onSelect cablato — MA una tessera già
          scelta (assemble) è disabled e porta un badge d'ordine (append-only, nessun
          undo). Risposta data: tutti disabled (senso unico, AC4), le scelte
          aria-pressed="true". Nessuna distinzione per solo colore (AC2): stessi token;
          etichetta e posizione portano l'informazione. min-h-[56px] su ciascuna. */}
      <ul className="flex w-full flex-col gap-3">
        {options.map((option, i) => {
          // La posizione di questo indice fra le scelte (1-based) o 0 se non scelto:
          // per assemble è il badge d'ordine; per gli altri tipi distingue la scelta.
          const orderPosition = selected.indexOf(i) + 1;
          const isChosen = orderPosition > 0;
          // Consegna: una scelta già piazzata (assemble) è disabled; le altre
          // abilitate. Risposta data: tutte disabled.
          const isDisabled = answered || isChosen;
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={isChosen}
                disabled={isDisabled}
                onClick={isDisabled ? undefined : () => onSelect(i)}
                className={`min-h-[56px] w-full rounded-md border border-border-strong bg-surface-base text-ink-primary p-3 text-body ${FOCUS_RING}`}
              >
                {/* Badge di posizione SOLO per assemble e SOLO su una tessera piazzata:
                    l'ordine dei tocchi è l'informazione (append in ordine). */}
                {exercise.kind === 'assemble' && isChosen && (
                  <span className="text-label text-ink-secondary">{orderPosition}. </span>
                )}
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Consulto PRE-risposta (AC3): nello stato consegna, un'azione «mostra la
          spiegazione» che imposta usedExplanation. Nessuno stile di penalità; una
          volta rivelata non ricompare (revealed). */}
      {!answered && !revealed && (
        <button
          type="button"
          onClick={onReveal}
          className={`text-label text-ink-secondary underline ${FOCUS_RING}`}
        >
          {t('session.explanation.reveal')}
        </button>
      )}

      {/* La spiegazione: consulto (correct null ⇒ solo spiegazione) o esito
          (correct non-null ⇒ dichiarazione testuale + spiegazione). Nessun colore. */}
      {showExplanation && (
        <ExplanationPanel explanation={explanation} correct={answered ? correct : null} />
      )}
    </article>
  );
}
