// Livello features/study: il pulsante che fa ASCOLTARE la frase dell'esercizio.
// L'audio è un file statico generato con VOICEVOX (`npm run generate-audio`), il
// cui percorso lo decide il dominio (`sentenceAudioPath`). Reso SOLO a risposta
// data: prima, sentire la frase direbbe la risposta (la lettura di 今日, la
// particella mancante).
import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { sentenceAudioPath } from '../../domain/sentence-audio';
import { SpeakerIcon } from '../../ui/icons';
import { FOCUS_RING } from '../../ui/magazine';

export interface SentenceAudioButtonProps {
  /** La frase in kanji dell'esercizio: ne deriva il file audio. */
  readonly kanji: string;
}

export function SentenceAudioButton({ kanji }: SentenceAudioButtonProps) {
  const { t } = useTranslation();
  const audio = useRef<HTMLAudioElement | null>(null);

  // Cambio di frase o uscita dalla sessione: l'audio in corso si ferma.
  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    [kanji],
  );

  function play() {
    audio.current ??= new Audio(sentenceAudioPath(kanji));
    audio.current.currentTime = 0;
    // Un rifiuto (file non raggiungibile offline, riproduzione bloccata) non è un
    // errore dello studente: il pulsante semplicemente non suona.
    audio.current.play().catch(() => {});
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
