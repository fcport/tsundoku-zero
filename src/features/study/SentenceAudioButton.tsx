// Livello features/study: il pulsante che fa ASCOLTARE la frase dell'esercizio.
// L'audio è un file statico generato con VOICEVOX (`npm run generate-audio`), il
// cui percorso lo decide il dominio (`sentenceAudioPath`). Reso SOLO a risposta
// data: prima, sentire la frase direbbe la risposta (la lettura di 今日, la
// particella mancante).
//
// Con «Audio automatico dopo la risposta» acceso (Impostazioni), la frase parte da
// sola appena il pulsante compare, cioè appena la risposta è data.
import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { sentenceAudioPath } from '../../domain/sentence-audio';
import { SpeakerIcon } from '../../ui/icons';
import { FOCUS_RING } from '../../ui/magazine';
import { useAutoplayAudioPreference } from '../../ui/furiganaPreference';

export interface SentenceAudioButtonProps {
  /** La frase in kanji dell'esercizio: ne deriva il file audio. */
  readonly kanji: string;
}

/**
 * Riproduce dall'inizio. Un rifiuto (file non raggiungibile offline, riproduzione
 * bloccata dal browser) non è un errore dello studente: semplicemente non suona.
 */
function playFromStart(audio: HTMLAudioElement): void {
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function SentenceAudioButton({ kanji }: SentenceAudioButtonProps) {
  const { t } = useTranslation();
  const audio = useRef<HTMLAudioElement | null>(null);

  // Frase nuova a schermo: con l'audio automatico acceso parte subito. La preferenza
  // si legge una volta sola (`getState`): cambiarla non fa ripartire la frase.
  // Cambio di frase o uscita dalla sessione: l'audio in corso si ferma.
  useEffect(() => {
    if (useAutoplayAudioPreference.getState().show) {
      audio.current = new Audio(sentenceAudioPath(kanji));
      playFromStart(audio.current);
    }
    return () => {
      audio.current?.pause();
      audio.current = null;
    };
  }, [kanji]);

  function play() {
    audio.current ??= new Audio(sentenceAudioPath(kanji));
    playFromStart(audio.current);
  }

  return (
    <button
      type="button"
      onClick={play}
      className={`-mt-3 inline-flex items-center gap-2 text-label font-semibold text-ink-secondary underline underline-offset-4 hover:text-ink-primary ${FOCUS_RING}`}
    >
      <SpeakerIcon />
      {t('session.listen')}
    </button>
  );
}
