// Livello ui: la MASCOTTE (07-10-2026), il gatto della libreria. Inchiostro su
// carta, col collare rosso da cui pende un nastrino come quello di un segnalibro.
// Due pose: seduto (aspetta, al primo avvio) e addormentato (la pila è a zero, la
// lezione è imparata).
//
// Compare solo nei momenti che contano, mai sulla dashboard di tutti i giorni; è
// muto e decorativo (`aria-hidden`): i fatti li dicono sempre le scritte accanto.
// Colori dai token del tema, come il resto della rivista (nessun colore letterale).

export type CatPose = 'sitting' | 'sleeping';

export interface CatProps {
  readonly pose: CatPose;
  /** L'altezza in px; la larghezza segue le proporzioni della posa. */
  readonly height: number;
  readonly className?: string;
}

const VIEWBOX: Readonly<Record<CatPose, readonly [number, number]>> = {
  sitting: [70, 72],
  sleeping: [98, 52],
};

const LINE = 'stroke-ink-primary';
const PAPER = 'fill-surface-raised';

function Sitting() {
  return (
    <>
      <path d="M52 64 C66 62 66 46 58 44" fill="none" className={LINE} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 66 C14 52 18 38 35 36 C52 38 56 52 50 66 Z" className={`${PAPER} ${LINE}`} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M17 20 L19 4 L29 13 Z M41 13 L51 4 L53 20 Z" className={`${PAPER} ${LINE}`} strokeWidth="2.4" strokeLinejoin="round" />
      <ellipse cx="35" cy="24" rx="18" ry="15" className={`${PAPER} ${LINE}`} strokeWidth="2.4" />
      <path d="M20.5 11 L21.6 7 L25 10.6 Z M45 10.6 L48.4 7 L49.5 11 Z" className="fill-accent-subtle" />
      <ellipse cx="28" cy="23" rx="2" ry="2.8" className="fill-ink-primary" />
      <ellipse cx="42" cy="23" rx="2" ry="2.8" className="fill-ink-primary" />
      <circle cx="28.6" cy="22" r="0.7" className="fill-surface-raised" />
      <circle cx="42.6" cy="22" r="0.7" className="fill-surface-raised" />
      <path d="M33.5 28 h3 l-1.5 1.8 Z" className="fill-ink-primary" />
      <path d="M35 29.8 q-2 2.2 -4 0.6 M35 29.8 q2 2.2 4 0.6" fill="none" className={LINE} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14 26 h-7 M14 29 l-6 2 M56 26 h7 M56 29 l6 2" className={LINE} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M23 37 Q35 42 47 37" fill="none" className="stroke-accent" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M35 40 l-3.2 10 l3.2 -2.4 l3.2 2.4 Z" className={`fill-accent ${LINE}`} strokeWidth="1" strokeLinejoin="round" />
      <path d="M28 66 v-6 M42 66 v-6" className={LINE} strokeWidth="1.6" strokeLinecap="round" />
    </>
  );
}

function Sleeping() {
  return (
    <>
      <path d="M85 44 C97 42 97 26 86 27 C81 27.5 80 33 84 34" fill="none" className={LINE} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14 46 C8 30 26 18 50 18 C76 18 90 30 86 46 Z" className={`${PAPER} ${LINE}`} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M14 28 L15 14 L23 21 Z M30 20 L37 13 L39 26 Z" className={`${PAPER} ${LINE}`} strokeWidth="2.4" strokeLinejoin="round" />
      <ellipse cx="27" cy="33" rx="15" ry="12.5" className={`${PAPER} ${LINE}`} strokeWidth="2.4" />
      <path d="M16.2 19.5 L16.8 16.4 L19.6 19 Z M33 19 L35.6 16.2 L36.2 19.8 Z" className="fill-accent-subtle" />
      <path d="M18.5 33 q2.5 2.4 5 0 M30.5 33 q2.5 2.4 5 0" fill="none" className={LINE} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M26 38 h2.4 l-1.2 1.4 Z" className="fill-ink-primary" />
      <path d="M17 45 Q27 49 37 44" fill="none" className="stroke-accent" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

export function Cat({ pose, height, className }: CatProps) {
  const [w, h] = VIEWBOX[pose];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-mascot={pose}
      viewBox={`0 0 ${w} ${h}`}
      width={Math.round((height * w) / h)}
      height={height}
      className={`block shrink-0 overflow-visible ${className ?? ''}`}
    >
      {pose === 'sitting' ? <Sitting /> : <Sleeping />}
    </svg>
  );
}
