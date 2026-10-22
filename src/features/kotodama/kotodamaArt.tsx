// Livello features/kotodama: le IMMAGINI del gioco, disegnate con Google Flow e
// ritagliate con lo sfondo trasparente (`_screenshots/kotodama-2026-10-16/cut.py`).
// Stanno in `./art/` coi nomi dei prompt (`prompts.md` nella stessa cartella):
// `tanuki-<veste>-<posa>.png`, `enemy-<id>.png`. Le prende tutte da sé: un file
// nuovo nella cartella compare nel gioco senza toccare il codice.
//
// Finché un'immagine manca: per il tanuki la posa più vicina da mago (o, se non ce
// n'è nessuna, una delle sue pose di tutti i giorni); per il nemico il suo nome
// giapponese in un riquadro tratteggiato. Decorative come la mascotte (alt vuoto,
// `aria-hidden`): i fatti li dicono le scritte accanto.
import type { CSSProperties } from 'react';
import type { KotodamaEnemy, Outfit } from '../../domain/kotodama';
import { Tanuki } from '../../ui/Tanuki';

const FILES: Readonly<Record<string, string>> = import.meta.glob<string>('./art/*.png', {
  eager: true,
  import: 'default',
});

export type WizardPose = 'idle' | 'cast' | 'win';

/**
 * L'altezza dell'immagine: `height` sul telefono, `tallHeight` da 640px. Passano
 * come variabili CSS, perché un'altezza scritta nello stile vincerebbe sulle classi
 * e non cambierebbe più con lo schermo.
 */
function sizeVars(height: number, tallHeight: number | undefined): CSSProperties {
  return { '--art-h': `${height}px`, '--art-h-sm': `${tallHeight ?? height}px` } as CSSProperties;
}

// `max-w-none`: una posa larga (le scintille del lancio) sporge dalla sua colonna
// invece di essere schiacciata.
const ART_SIZE = 'h-(--art-h) w-auto max-w-none sm:h-(--art-h-sm)';

export function TanukiWizard({
  outfit,
  pose,
  height,
  tallHeight,
  className = '',
}: {
  readonly outfit: Outfit;
  readonly pose: WizardPose;
  readonly height: number;
  readonly tallHeight?: number;
  readonly className?: string;
}) {
  // La posa nella veste di adesso; se manca, la stessa veste ferma, poi l'apprendista
  // (in quella posa, poi fermo): il cappello resta anche quando una posa non c'è ancora.
  const src = [
    `./art/tanuki-${outfit}-${pose}.png`,
    `./art/tanuki-${outfit}-idle.png`,
    `./art/tanuki-apprentice-${pose}.png`,
    './art/tanuki-apprentice-idle.png',
  ]
    .map((file) => FILES[file])
    .find((file) => file !== undefined);
  return (
    <span style={sizeVars(height, tallHeight)} className={`block shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          data-mascot={`wizard-${pose}`}
          className={`block select-none ${ART_SIZE}`}
        />
      ) : (
        <Tanuki pose={pose === 'win' ? 'thumbs-up' : 'ready'} height={height} className={ART_SIZE} />
      )}
    </span>
  );
}

/** Il corpo del nome nel riquadro segnaposto: ci sta in colonna, al massimo 28px. */
function placeholderFont(height: number, length: number): string {
  return `${Math.min(28, Math.floor((height - 24) / (length * 1.3)))}px`;
}

export function EnemyArt({
  enemy,
  height,
  tallHeight,
  className = '',
}: {
  readonly enemy: KotodamaEnemy;
  readonly height: number;
  readonly tallHeight?: number;
  readonly className?: string;
}) {
  const src = FILES[`./art/enemy-${enemy.id}.png`];
  if (!src) {
    const length = Array.from(enemy.jp).length;
    const style = {
      ...sizeVars(height, tallHeight),
      '--art-f': placeholderFont(height, length),
      '--art-f-sm': placeholderFont(tallHeight ?? height, length),
    } as CSSProperties;
    return (
      <div
        aria-hidden="true"
        data-enemy={enemy.id}
        style={style}
        className={`flex aspect-[5/8] h-(--art-h) shrink-0 items-center justify-center border-[1.5px] border-dashed border-ink-secondary bg-surface-raised sm:h-(--art-h-sm) ${className}`}
      >
        <span
          lang="ja"
          className="font-jp text-(length:--art-f) font-extrabold tracking-[0.12em] text-ink-primary [writing-mode:vertical-rl] sm:text-(length:--art-f-sm)"
        >
          {enemy.jp}
        </span>
      </div>
    );
  }
  return (
    <span style={sizeVars(height, tallHeight)} className={`block shrink-0 ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        data-enemy={enemy.id}
        className={`block select-none ${ART_SIZE}`}
      />
    </span>
  );
}
