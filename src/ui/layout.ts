// Livello ui: la classe CONDIVISA del contenitore responsive (3.23). Una sola
// definizione, riusata da ogni `<main>` delle feature (AD-1: `features → ui`),
// così le schermate non divergono — stesso spirito del `CONTAINER_HEIGHT` e del
// `FOCUS_RING` già usati inline, ma promosso a `src/ui/` perché lo condividono
// SEI schermate (session, dashboard, auth, stats, privacy, acknowledgements).
//
// NON esiste un `<main>` condiviso: l'invariante è UN solo landmark <main> per
// schermata, quindi ogni schermata compone questa stringa nella classe del
// PROPRIO `<main>`. Non è uno shell.
//
// Il contratto responsive (UX-DR3/UX-DR-responsive, DESIGN.md §Layout):
// - COLONNA SINGOLA centrata: `mx-auto w-full`.
// - Larghezza massima = `measure` (34rem): `max-w-measure`. Da 640px in su la
//   colonna resta limitata a `measure` e centrata; a ≥1024px NON si allarga a
//   riempire (il cap è `measure`, non `100%`): mobile-first, nessun ramo che
//   riporti a piena larghezza sopra un breakpoint.
// - GUTTER orizzontale: `px-gutter-mobile` (20px) sotto 640px, che diventa
//   `px-gutter-desktop` (32px) da 640px in su (variante `sm:`, che in Tailwind
//   v4 è la media query `min-width: 640px`, GENERATA da Tailwind — nessun
//   media-query scritto a mano nel CSS del sistema).
//
// I token (`measure`, `gutter-mobile`, `gutter-desktop`) vivono in `theme.css`
// (UX-DR1): qui si compongono solo le utility che Tailwind genera da quei token,
// nessun valore letterale.

/**
 * La classe del contenitore responsive condiviso: colonna singola centrata,
 * limitata a `measure` (mai allargata sopra), con gutter `gutter-mobile` sotto
 * 640px e `gutter-desktop` da 640px in su. Composta nella classe del `<main>`
 * di ogni schermata.
 */
export const RESPONSIVE_CONTAINER =
  'mx-auto w-full max-w-measure px-gutter-mobile sm:px-gutter-desktop';

/**
 * Il `<main>` dei QUIZ (sessione e ripasso di una lezione), condiviso così le due
 * schermate non divergono. Sotto 640px è alto quanto il viewport PICCOLO (`svh`,
 * con la barra del browser visibile: `vh` è quello grande e spingeva le opzioni
 * sotto il bordo) e spinge il blocco interattivo in basso, verso il pollice, con
 * spaziature strette: domanda e opzioni devono stare in uno schermo di telefono
 * senza scorrere. Da 640px torna centrato con le spaziature larghe.
 */
export const QUIZ_MAIN = `min-h-svh sm:min-h-[24rem] ${RESPONSIVE_CONTAINER} flex flex-col items-center justify-end gap-4 pt-4 pb-4 sm:justify-center sm:gap-6 sm:py-6`;

/**
 * Riporta la pagina in cima: al passaggio all'esercizio seguente, che altrimenti
 * su telefono si apriva scorso in basso, dov'era il «Prossimo esercizio».
 */
export function scrollToTop(): void {
  window.scrollTo({ top: 0 });
}
