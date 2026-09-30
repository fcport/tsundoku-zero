// Livello features/lessons: il RIPASSO LIBERO di una lezione. Tutti i suoi esercizi,
// uno dopo l'altro in ordine casuale, con la STESSA card della sessione (consegna,
// spiegazione, esito), ma fuori dalla pila: nessuna scadenza, nessun salvataggio,
// nessun `review_log`. Il punteggio vive finché si resta qui.
//
// Solo le lezioni sbloccate si ripassano (la sequenza resta una regola di prodotto):
// a un deep-link su una bloccata la schermata lo dichiara, senza esercizi.
//
// La correttezza viene dal dominio (`isAnswerCorrect`), l'ordine dal caso INIETTATO
// (`random`, come l'allenamento). Stesso contratto tastiera della sessione: cifre
// per le opzioni, `Enter` per il prossimo, `Esc` per uscire. Navigazione come
// callback (AD-1).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveBilingual } from '../../domain/bilingual';
import { answerOptions, selectionComplete } from '../../domain/exercise-presentation';
import { keyboardSelectionIndex } from '../../domain/keyboard';
import { RESERVED_ORDER_START } from '../../domain/lesson';
import type { ExerciseContent } from '../../domain/ports/contentRepository';
import { isAnswerCorrect } from '../../domain/review';
import { resolveLocale, useTranslation } from '../../i18n';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { Masthead } from '../../ui/Masthead';
import { ArrowIcon } from '../../ui/icons';
import { ACTION_BAR, FOCUS_RING, KICKER } from '../../ui/magazine';
import { RESPONSIVE_CONTAINER } from '../../ui/layout';
import { useFuriganaPreference, usePreferenceShown } from '../../ui/furiganaPreference';
import { usePorts } from '../ports/PortsContext';
import { ExerciseCard } from '../study/ExerciseCard';
import { ProgressMeter } from '../study/ProgressMeter';

export interface LessonPracticeScreenProps {
  readonly userId: string | null;
  /** L'id della lezione da ripassare (dal path). */
  readonly lessonId: string;
  /** Il ritorno alla pagina Lezioni, cablato dal livello app. */
  readonly onExit: () => void;
  /** Il caso, in [0, 1). Iniettabile per i test; predefinito `Math.random`. */
  readonly random?: () => number;
}

// Lo stesso <main> della sessione: colonna centrata, blocco interattivo nella zona
// del pollice sotto 640px.
const MAIN_CLASS = `min-h-screen sm:min-h-[24rem] ${RESPONSIVE_CONTAINER} flex flex-col items-center justify-end gap-6 pt-6 pb-thumb-zone sm:justify-center sm:py-6`;

// Come nella sessione: `Enter` su un controllo nativo lo attiva già.
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Fisher–Yates su una copia, col caso iniettato. */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function LessonPracticeScreen(props: LessonPracticeScreenProps) {
  const { t } = useTranslation();
  return (
    <MagazineFrame furiganaToggle>
      <Masthead
        start={
          <button
            type="button"
            onClick={props.onExit}
            className={`flex min-h-[44px] items-center gap-2 uppercase hover:underline ${FOCUS_RING}`}
          >
            <ArrowIcon className="rotate-180" />
            {t('lessonPractice.back')}
          </button>
        }
        end={<span>{t('lessonPractice.kicker')}</span>}
      />
      <PracticeContent {...props} />
    </MagazineFrame>
  );
}

function PracticeContent({ userId, lessonId, onExit, random = Math.random }: LessonPracticeScreenProps) {
  const { progress, content } = usePorts();
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const showFurigana = usePreferenceShown(useFuriganaPreference);

  const lessonsQ = useQuery({
    queryKey: ['lessons'],
    queryFn: () => content.listLessons(),
  });
  const unlockedQ = useQuery({
    queryKey: ['unlocked', userId],
    enabled: !!userId,
    queryFn: () => progress.listUnlockedLessons(),
  });
  const lesson = lessonsQ.data?.find(
    (l) => l.id === lessonId && l.ordinal < RESERVED_ORDER_START,
  );
  const isUnlocked = unlockedQ.data?.some((u) => u.lessonId === lessonId) ?? false;
  const exercisesQ = useQuery({
    queryKey: ['lessonExercises', lessonId],
    enabled: isUnlocked && (lesson?.exerciseCount ?? 0) > 0,
    queryFn: () => content.listExercisesByLesson(lessonId),
  });

  // Un giro = un ordine casuale di tutti gli esercizi. «Ripassala di nuovo» ne
  // estrae un altro.
  const [round, setRound] = useState(0);
  const order = useMemo<readonly ExerciseContent[]>(
    () => (exercisesQ.data ? shuffled(exercisesQ.data, random) : []),
    // `round` rimescola; `random` è stabile per la vita della schermata.
    [exercisesQ.data, round],
  );

  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [right, setRight] = useState(0);

  const current = order[position];
  const exercise = current?.exercise ?? null;
  const total = order.length;
  const done = total > 0 && position >= total;

  const onSelect = (index: number) => {
    if (answered || exercise === null) return;
    if (exercise.kind === 'assemble' && selected.includes(index)) {
      setSelected(selected.filter((i) => i !== index));
      return;
    }
    const next = [...selected, index];
    setSelected(next);
    if (!selectionComplete(exercise, next)) return;
    const ok = isAnswerCorrect(exercise, next);
    setAnswered(true);
    setCorrect(ok);
    if (ok) setRight((r) => r + 1);
  };

  const onNext = () => {
    setSelected([]);
    setAnswered(false);
    setCorrect(null);
    setRevealed(false);
    setPosition((p) => p + 1);
  };

  const again = () => {
    setRound((r) => r + 1);
    setPosition(0);
    setRight(0);
    setSelected([]);
    setAnswered(false);
    setCorrect(null);
    setRevealed(false);
  };

  // Il contratto tastiera, col pattern «ultimo valore» della sessione: un solo
  // listener per la vita della schermata, che delega al handler fresco.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (exercise !== null && !answered) {
        const index = keyboardSelectionIndex(e.key, answerOptions(exercise).length);
        if (index !== null) {
          e.preventDefault();
          onSelect(index);
        }
        return;
      }
      if (answered && e.key === 'Enter' && !isInteractiveTarget(e.target)) onNext();
    };
  });

  const declaration = (text: string) => (
    <main className={MAIN_CLASS}>
      <p className="w-full border-t-[1.5px] border-border-strong pt-4 text-[22px] font-medium leading-snug text-ink-primary">
        {text}
      </p>
      <button type="button" onClick={onExit} className={ACTION_BAR}>
        <span>{t('lessonPractice.back')}</span>
        <ArrowIcon className="text-accent-on-ink" />
      </button>
    </main>
  );

  if (!userId || lessonsQ.data === undefined || unlockedQ.data === undefined) {
    return (
      <main aria-busy="true" className={MAIN_CLASS}>
        <div className="h-[20px] w-48 bg-surface-sunken" />
        <div className="h-[40px] w-64 bg-surface-sunken" />
        <div className="h-14 w-full bg-surface-sunken" />
        <div className="h-14 w-full bg-surface-sunken" />
      </main>
    );
  }
  if (lesson === undefined) return declaration(t('lessonPractice.notFound'));
  if (!isUnlocked) return declaration(t('lessonPractice.locked'));
  if (lesson.exerciseCount === 0) return declaration(t('lessonPractice.empty'));

  const title = resolveBilingual(lesson.title, locale);
  const heading = (
    <div className="w-full">
      <p className={KICKER}>
        {t('lessons.lessonNumber', { order: lesson.ordinal })}
      </p>
      <p lang={title.language} className="mt-1 text-[17px] font-bold leading-snug text-ink-primary">
        {title.text}
      </p>
    </div>
  );

  if (exercisesQ.data === undefined) {
    return (
      <main aria-busy="true" className={MAIN_CLASS}>
        {heading}
        <div className="h-14 w-full bg-surface-sunken" />
        <div className="h-14 w-full bg-surface-sunken" />
      </main>
    );
  }
  if (total === 0) return declaration(t('lessonPractice.empty'));

  if (done) {
    return (
      <main className={MAIN_CLASS}>
        {heading}
        <p className="w-full border-t-[1.5px] border-border-strong pt-4 text-[22px] font-medium leading-snug text-ink-primary">
          {t('lessonPractice.completeBody', { right, total })}
        </p>
        <button type="button" onClick={again} className={ACTION_BAR}>
          <span>{t('lessonPractice.again')}</span>
          <ArrowIcon className="text-accent-on-ink" />
        </button>
        <button
          type="button"
          onClick={onExit}
          className={`min-h-[44px] text-label text-ink-secondary underline underline-offset-4 ${FOCUS_RING}`}
        >
          {t('lessonPractice.back')}
        </button>
      </main>
    );
  }

  if (exercise === null) return null;
  const completed = answered ? position + 1 : position;

  return (
    <main className={MAIN_CLASS}>
      <div className="mb-auto w-full sm:mb-0">
        {heading}
        <div className="mb-3 mt-4 flex items-end justify-between">
          <p aria-hidden="true" className="leading-none">
            <span className={`block ${KICKER}`}>{t('session.questionKicker')}</span>
            <span className="text-[64px] font-black leading-[0.85] font-stretch-extra-condensed text-ink-primary">
              {String(position + 1).padStart(2, '0')}
            </span>
          </p>
          <p aria-hidden="true" className="text-right font-mono text-label-caps text-ink-secondary">
            {completed}/{total}
            <span className="block">{t('lessonPractice.score', { right, total: completed })}</span>
          </p>
        </div>
        <ProgressMeter completed={completed} total={total} />
        <p className="mt-2 text-label text-ink-secondary">{t('lessonPractice.notice')}</p>
      </div>
      <ExerciseCard
        key={`${round}-${position}`}
        exercise={exercise}
        selected={selected}
        onSelect={onSelect}
        answered={answered}
        onReveal={() => setRevealed(true)}
        revealed={revealed}
        correct={correct}
        locale={locale}
        furigana={showFurigana}
      />
      {answered && (
        <button type="button" onClick={onNext} className={ACTION_BAR}>
          <span>{t('session.next')}</span>
          <ArrowIcon className="text-accent-on-ink" />
        </button>
      )}
      <p aria-live="polite" className="sr-only">
        {answered
          ? `${t(correct ? 'session.outcome.correct' : 'session.outcome.incorrect')} ${t('lessonPractice.score', { right, total: completed })}`
          : ''}
      </p>
    </main>
  );
}
