// Livello features/settings: componente PRESENTAZIONALE della scelta «audio
// automatico dopo la risposta». Nessuno stato: riceve `current` e `onSelect` per
// props, come `LanguageOptions`, e ne ripete la forma (gruppo etichettato da
// un'etichetta VISIBILE, scelta corrente marcata con `aria-pressed`). La preferenza
// vive su questo dispositivo (`useAutoplayAudioPreference`): la collega il container.
import { useTranslation } from '../../i18n';

export interface AutoplayAudioOptionsProps {
  /** `true` ⇒ l'audio parte da solo a risposta data. */
  readonly current: boolean;
  /** Invocata con la scelta al click di un bottone. */
  readonly onSelect: (autoplay: boolean) => void;
}

const OPTIONS = [
  { value: false, key: 'settings.autoplayAudio.off' },
  { value: true, key: 'settings.autoplayAudio.on' },
] as const;

export function AutoplayAudioOptions({ current, onSelect }: AutoplayAudioOptionsProps) {
  const { t } = useTranslation();

  return (
    <div role="group" aria-labelledby="autoplay-audio-label" className="flex flex-col gap-3">
      <span id="autoplay-audio-label" className="font-mono text-label-caps uppercase text-ink-secondary">
        {t('settings.autoplayAudio.label')}
      </span>
      <div className="grid auto-cols-fr grid-flow-col border-[1.5px] border-border-strong">
        {OPTIONS.map(({ value, key }) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === current}
            onClick={() => onSelect(value)}
            className="min-h-[56px] border-l-[1.5px] border-border-strong bg-surface-raised px-3 text-body font-semibold text-ink-primary first:border-l-0 hover:bg-surface-sunken aria-pressed:bg-ink-primary aria-pressed:text-surface-base"
          >
            {t(key)}
          </button>
        ))}
      </div>
    </div>
  );
}
