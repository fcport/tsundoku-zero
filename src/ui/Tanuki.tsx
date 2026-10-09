// Livello ui: la MASCOTTE (09-10-2026), il tanuki della libreria, al posto del
// gatto. Le pose sono ritagli di immagini generate con Gemini (sfondo reso
// trasparente, palette ridotta): mascherina nera sugli occhi, coda ad anelli,
// sciarpa rossa. Ogni posa ha il suo momento:
// - seduto: aspetta, al primo avvio;
// - addormentato: per oggi hai finito (pila a zero senza lezioni da sbloccare), la
//   lezione è imparata (scaffale);
// - legge: la pila è a zero e c'è una lezione nuova da aprire;
// - pollice alzato: hai appena finito la pila;
// - timbro: hai appena finito la pila, e nella sessione hai imparato una lezione o
//   preso un traguardo;
// - si stiracchia: hai saltato un giorno senza perdere la serie (statistiche);
// - saluta: la pagina di accesso;
// - pila di libri: «Come funziona?»;
// - foglia in testa: pronta, ancora senza un posto.
//
// Compare solo nei momenti che contano, mai sulla dashboard di tutti i giorni; è
// muto e decorativo (alt vuoto, `aria-hidden`): i fatti li dicono sempre le
// scritte accanto.
import books from './mascot/tanuki-books.png';
import leaf from './mascot/tanuki-leaf.png';
import reading from './mascot/tanuki-reading.png';
import sitting from './mascot/tanuki-sitting.png';
import sleeping from './mascot/tanuki-sleeping.png';
import stamp from './mascot/tanuki-stamp.png';
import stretch from './mascot/tanuki-stretch.png';
import thumbsUp from './mascot/tanuki-thumbs-up.png';
import waving from './mascot/tanuki-waving.png';

export type TanukiPose =
  | 'sitting'
  | 'sleeping'
  | 'reading'
  | 'thumbs-up'
  | 'stamp'
  | 'stretch'
  | 'waving'
  | 'books'
  | 'leaf';

export interface TanukiProps {
  readonly pose: TanukiPose;
  /** L'altezza in px; la larghezza segue le proporzioni della posa. */
  readonly height: number;
  readonly className?: string;
}

// Il file e le sue dimensioni in pixel. I ritagli sono stretti attorno al disegno,
// così la base della posa addormentata coincide col fondo dell'immagine (sullo
// scaffale poggia sui libri).
const POSES: Readonly<Record<TanukiPose, { readonly src: string; readonly w: number; readonly h: number }>> = {
  sitting: { src: sitting, w: 197, h: 199 },
  sleeping: { src: sleeping, w: 228, h: 172 },
  reading: { src: reading, w: 413, h: 400 },
  'thumbs-up': { src: thumbsUp, w: 492, h: 439 },
  stamp: { src: stamp, w: 356, h: 400 },
  stretch: { src: stretch, w: 402, h: 400 },
  waving: { src: waving, w: 404, h: 400 },
  books: { src: books, w: 412, h: 400 },
  leaf: { src: leaf, w: 347, h: 400 },
};

export function Tanuki({ pose, height, className }: TanukiProps) {
  const { src, w, h } = POSES[pose];
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-mascot={pose}
      width={Math.round((height * w) / h)}
      height={height}
      className={`block shrink-0 select-none ${className ?? ''}`}
    />
  );
}
