// Livello ui: la TRADUZIONE sotto il giapponese (29-09-2026), resa solo quando
// l'interruttore «Traduzioni» del dorso è acceso. Il giapponese resta SEMPRE: questo
// componente aggiunge, non sostituisce. `lang` sulla lingua effettiva del testo
// (WCAG 3.1.2: una traduzione di ripiego in inglese non va letta con pronuncia
// italiana).
import { usePreferenceShown, useTranslationPreference } from './furiganaPreference';

export interface TranslationProps {
  /** Il testo tradotto; vuoto o assente ⇒ niente. */
  readonly text: string | null | undefined;
  /** La lingua effettiva del testo (`it`/`en`). */
  readonly lang: string;
  readonly className?: string;
}

export function Translation({
  text,
  lang,
  className = 'block text-label italic text-ink-secondary',
}: TranslationProps) {
  const show = usePreferenceShown(useTranslationPreference);
  if (!show || !text) return null;
  return (
    <span lang={lang} className={className}>
      {text}
    </span>
  );
}
