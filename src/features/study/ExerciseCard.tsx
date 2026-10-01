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
// qui. Nessuna grammatica della celebrazione: niente verde, niente `!`. Dopo la
// risposta l'opzione giusta e la scelta sbagliata sono DICHIARATE in testo
// («Risposta corretta», «La tua risposta») e rinforzate dai token `accent` e
// `danger`: il colore sottolinea, non porta da solo l'informazione. Con il solo
// testo dell'esito, dalle opzioni non si capiva quale fosse quella giusta.
// Ogni opzione `min-h-[56px]` (bersaglio ≥56px).
import { useTranslation } from '../../i18n';
import {
  answerOptions,
  correctOptionIndex,
  sentenceView,
} from '../../domain/exercise-presentation';
import { furiganaVisible, resolveExplanation } from '../../domain/exercise';
import type { Exercise } from '../../domain/exercise';
import type { Locale } from '../../i18n';
import { JapaneseText } from '../../ui/JapaneseText';
import { knownReadings, optionFurigana, sentenceSegments } from '../../domain/option-furigana';
import { WORD_READINGS } from '../../domain/fixed-readings';
import { FOCUS_RING } from '../../ui/magazine';
import { Translation } from '../../ui/Translation';
import { ExplanationPanel } from './ExplanationPanel';
import { ProseWithFurigana } from './ProseWithFurigana';
import { SentenceAudioButton } from './SentenceAudioButton';

// Direzione «rivista» (29-09-2026): la card non è più una superficie sollevata ma una
// sezione fra due filetti. Le opzioni sono caselle squadrate col numero del TASTO
// (1–9, il contratto tastiera di 3.22 reso visibile) in Plex Mono; dopo la risposta
// la giusta si inverte in inchiostro pieno e la scelta sbagliata prende la tinta
// d'allarme, sempre con la dichiarazione in testo accanto.

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
  /**
   * La preferenza rapida «mostra la furigana» (`furiganaPreference`). `false` ⇒
   * nessuna furigana; `true` (predefinito) ⇒ decide il contenuto.
   */
  readonly furigana?: boolean;
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
  furigana = true,
}: ExerciseCardProps) {
  const { t } = useTranslation();
  const options = answerOptions(exercise);
  // La furigana delle opzioni, ricavata dalla frase solo quando è certa (dominio);
  // `null` per un'opzione ⇒ testo semplice.
  const optionRuby = optionFurigana(exercise);
  // Le traduzioni (29-09-2026): della frase, e il significato di ogni tessera o
  // segmento dalle glosse del contenuto. Rese solo con «Traduzioni» acceso.
  const sentenceTranslation = exercise.translation
    ? resolveExplanation(exercise.translation, locale)
    : null;
  // Nella selezione di una parte il significato del segmento («だ = è») è
  // la risposta alla domanda («quale parte vuol dire "è"?»): lì compare solo DOPO aver
  // risposto. Nel riordino no: il compito è l'ordine, non il significato.
  const optionMeanings = new Map(
    exercise.kind === 'single-select' || (exercise.kind === 'select-span' && !answered)
      ? []
      : (exercise.glosses ?? [])
          .filter((g) => g.meaning !== undefined)
          .map((g) => [g.text, resolveExplanation(g.meaning!, locale)] as const),
  );
  // Le letture per le parole giapponesi della domanda e della spiegazione: quelle
  // certe della frase dell'esercizio, più le poche parole a lettura unica della
  // tabella fissa.
  const explanationReadings = new Map([
    ...WORD_READINGS,
    ...knownReadings([exercise.sentence]),
  ]);
  // Cosa mostrare della frase (dominio): prima della risposta mai la soluzione —
  // spazio vuoto per la scelta singola, nessuna frase per il riordino (è la risposta).
  const view = sentenceView(exercise, answered, sentenceSegments);
  // La furigana la decide il contenuto (`furiganaVisible`); la preferenza rapida
  // dell'utente può solo spegnerla.
  const showFurigana = furigana && furiganaVisible(exercise);
  // La DOMANDA dell'esercizio, se il contenuto la porta; altrimenti resta la sola
  // consegna generica per tipo (contenuto precedente all'introduzione di `prompt`).
  const question = exercise.prompt ? resolveExplanation(exercise.prompt, locale).text : null;
  // La spiegazione bilingue RISOLTA nel dominio (FR8.5): `locale` coincide con
  // `BilingualLanguage` ('en'|'it'). Resa dall'`ExplanationPanel` (consulto o esito).
  const explanation = resolveExplanation(exercise.explanation, locale);
  // La spiegazione è visibile se rivelata prima (consulto) o dopo la risposta.
  const showExplanation = revealed || answered;
  // Dopo la risposta: quale opzione era giusta (null per assemble, dove la
  // soluzione è l'ordine, mostrato dalla frase intera).
  const correctIndex = answered ? correctOptionIndex(exercise) : null;

  return (
    // `w-full` sulla CARD (3.23): l'`<article>` è un figlio flex del `<main>`
    // `items-center`, che gli darebbe larghezza AUTO (max-content). `p-4 sm:p-6`:
    // padding ridotto sotto 640px perché la frase più lunga stia in ≤3 righe.
    <article className="w-full flex flex-col items-center gap-6 border-y-[1.5px] border-border-strong py-5 sm:py-6">
      {/* La consegna (come si risponde, per tipo) sopra la domanda vera. */}
      <div className="flex w-full flex-col gap-2">
        <p className="text-label text-ink-secondary">{t(PROMPT_KEY[exercise.kind])}</p>
        {question !== null && (
          <p className="text-[20px] font-medium leading-snug text-ink-primary sm:text-[22px]">
            {/* Le parole giapponesi della domanda (出す, 来る…) prendono la furigana
                come nella spiegazione, salvo dove il contenuto la spegne. */}
            <ProseWithFurigana
              text={question}
              readings={furiganaVisible(exercise) ? explanationReadings : undefined}
            />
          </p>
        )}
      </div>

      {/* La frase (ruolo `sentence-hero`, UX-DR8/3.23). `w-full` + `text-center`
          sono necessari: in un flex `items-center` il paragrafo avrebbe larghezza
          max-content e sfonderebbe su telefono (misurato in Chrome headless). */}
      {view.kind === 'full' && (
        <p className="w-full text-center text-sentence-hero-mobile sm:text-sentence-hero text-ink-primary">
          <JapaneseText segments={view.segments} showFurigana={showFurigana} />
        </p>
      )}
      {view.kind === 'gap' && (
        <p className="w-full text-center text-sentence-hero-mobile sm:text-sentence-hero text-ink-primary">
          <JapaneseText segments={view.before} showFurigana={showFurigana} />
          <span
            data-testid="sentence-gap"
            className="mx-1 inline-block min-w-[2.5em] border-b-2 border-accent align-baseline"
          >
            {' '}
          </span>
          <JapaneseText segments={view.after} showFurigana={showFurigana} />
        </p>
      )}
      {view.kind === 'hidden' && (
        // Riordino: la frase si compone qui, tessera dopo tessera, invece di essere
        // mostrata già fatta sopra le tessere.
        <div className="flex w-full flex-col items-center gap-2">
          <span className="text-caption text-ink-muted">{t('session.assembled.label')}</span>
          <p
            lang="ja"
            className="min-h-[3rem] w-full border-[1.5px] border-dashed border-border-strong bg-surface-raised p-3 text-center text-sentence-hero-mobile sm:text-sentence-hero text-ink-primary"
          >
            {selected.length > 0 ? (
              selected.map((i) => options[i]).join('')
            ) : (
              <span lang={locale} className="font-sans text-body text-ink-muted">{t('session.assembled.empty')}</span>
            )}
          </p>
        </div>
      )}

      {/* La traduzione della frase, sotto il giapponese, con «Traduzioni» acceso. */}
      {sentenceTranslation && (
        <Translation
          text={sentenceTranslation.text}
          lang={sentenceTranslation.language}
          className="-mt-3 block w-full text-center text-body italic text-ink-secondary"
        />
      )}

      {/* L'audio della frase, solo a risposta data: prima direbbe la risposta. */}
      {answered && <SentenceAudioButton kanji={exercise.sentence.kanji} />}

      {/* Un <button> per ciascuna opzione di answerOptions (numero e ordine dal
          dominio, AC2). Consegna: abilitati; una tessera già scelta (assemble) è
          disabled e porta un badge d'ordine. Risposta data: tutti disabled, e
          l'opzione giusta e quella scelta sbagliata sono DICHIARATE in testo, non
          solo col colore. min-h-[56px] su ciascuna. */}
      <ul className="flex w-full flex-col gap-3">
        {options.map((option, i) => {
          const orderPosition = selected.indexOf(i) + 1;
          const isChosen = orderPosition > 0;
          // Una tessera del riordino già scelta resta attiva: toccarla la toglie.
          const isDisabled = answered || (isChosen && exercise.kind !== 'assemble');
          const isCorrectOption = correctIndex === i;
          // La scelta sbagliata la dichiara l'esito (`correct`), non un confronto
          // locale: una sola fonte di verità sulla correttezza, `check()`.
          const isWrongChoice =
            answered && isChosen && correct === false && correctIndex !== null;
          // Giusta ⇒ inchiostro pieno; sbagliata ⇒ tinta d'allarme; tessera già
          // piazzata (prima della risposta) ⇒ incavata; le altre ⇒ carta chiara.
          const tone = isCorrectOption
            ? 'border-ink-primary bg-ink-primary text-surface-base'
            : isWrongChoice
              ? 'border-danger bg-danger-subtle text-ink-primary'
              : !answered && isChosen
                ? 'border-ink-primary bg-surface-sunken text-ink-primary'
                : 'border-border-strong bg-surface-raised text-ink-primary enabled:hover:bg-surface-sunken';
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={isChosen}
                disabled={isDisabled}
                onClick={isDisabled ? undefined : () => onSelect(i)}
                className={`flex min-h-[56px] w-full items-center gap-4 border-[1.5px] px-4 py-3 text-left ${tone} ${FOCUS_RING}`}
              >
                {/* Il numero del tasto (1–9): decorativo, fuori dal nome accessibile. */}
                <span aria-hidden="true" className="font-mono text-label-caps opacity-60">
                  {i + 1}
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-sentence-hero-mobile leading-snug sm:text-[26px]">
                    {exercise.kind === 'assemble' && isChosen && (
                      <span className="font-mono text-label text-ink-secondary">{orderPosition}. </span>
                    )}
                    {showFurigana && optionRuby[i] ? (
                      // La lettura sopra il kanji resta fuori dal nome accessibile.
                      // Chromium non dà nome a un bottone il cui testo è in <ruby>
                      // con <rt aria-hidden> (misurato dall'e2e, 29-09-2026): il
                      // ruby visibile è `aria-hidden` e il testo dell'opzione lo
                      // porta una copia `sr-only`.
                      <>
                        <span lang="ja" className="sr-only">{option}</span>
                        <span lang="ja" aria-hidden="true">
                          {optionRuby[i]!.map((seg, k) =>
                            seg.ruby ? (
                              <ruby key={k}>
                                {seg.text}
                                <rt>{seg.ruby}</rt>
                              </ruby>
                            ) : (
                              seg.text
                            ),
                          )}
                        </span>
                      </>
                    ) : (
                      <span lang="ja">{option}</span>
                    )}
                  </span>
                  {/* Il significato della tessera o del segmento, con «Traduzioni»
                      acceso (mai nella scelta singola: vedi `glosses`). Il colore
                      segue quello dell'opzione, anche quando è invertita. */}
                  {optionMeanings.get(option) && (
                    <Translation
                      text={optionMeanings.get(option)!.text}
                      lang={optionMeanings.get(option)!.language}
                      className="block font-sans text-label italic opacity-80"
                    />
                  )}
                  {isCorrectOption && (
                    <span className="font-mono text-label-caps uppercase text-accent-on-ink">
                      {t('session.option.correct')}
                    </span>
                  )}
                  {isWrongChoice && (
                    <span className="font-mono text-label-caps uppercase text-danger">
                      {t('session.option.yours')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Consulto PRE-risposta (AC3): nello stato consegna, un'azione «mostra la
          spiegazione» che imposta usedExplanation. Una volta rivelata non ricompare. */}
      {!answered && !revealed && (
        <button
          type="button"
          onClick={onReveal}
          className={`text-label text-ink-secondary underline underline-offset-4 ${FOCUS_RING}`}
        >
          {t('session.explanation.reveal')}
        </button>
      )}

      {/* La spiegazione: consulto (correct null ⇒ solo spiegazione) o esito
          (correct non-null ⇒ dichiarazione testuale + spiegazione). */}
      {showExplanation && (
        <ExplanationPanel
          explanation={explanation}
          correct={answered ? correct : null}
          readings={explanationReadings}
        />
      )}
    </article>
  );
}
