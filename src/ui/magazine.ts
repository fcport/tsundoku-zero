// Livello ui: le classi CONDIVISE della direzione «rivista» (29-09-2026). Come
// `RESPONSIVE_CONTAINER` in `layout.ts`, una sola definizione composta dalle
// schermate, così filetti, testate e barra d'azione non divergono fra loro.
// Solo utility generate dai token di `theme.css`: nessun colore letterale (UX-DR1).

/**
 * ANELLO DI FOCUS visibile (3.22): lo stesso di sessione, card e schermate legali,
 * qui promosso perché ora lo condividono anche testata, dorso e barra d'azione.
 */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

/** Il filetto nero della griglia: 1.5px d'inchiostro, l'unico separatore. */
export const RULE = 'border-border-strong';

/**
 * La TESTATA: Archivo nerissimo, maiuscolo e condensato. Per i titoli di schermata
 * (con `text-display`) e per la barra d'azione.
 */
export const HEADLINE = 'font-sans font-extrabold uppercase font-stretch-condensed';

/**
 * Il TITOLO di schermata a testata: proporzionale alla larghezza del viewport, così
 * anche «ACKNOWLEDGEMENTS» (8,2em, la parola più lunga) sta in una riga a 375px senza
 * sfondare; oltre il limite la parola va comunque a capo invece di uscire.
 */
export const SCREEN_TITLE =
  "font-sans font-extrabold uppercase font-stretch-extra-condensed text-[clamp(28px,8.4vw,56px)] leading-[0.9] hyphens-auto [overflow-wrap:anywhere]";

/** L'OCCHIELLO: etichetta piccola in Plex Mono, sopra un dato o una sezione. */
export const KICKER = 'font-mono text-label-caps uppercase text-ink-secondary';

/**
 * La BARRA D'AZIONE: il button-primary della rivista, una fascia d'inchiostro a
 * tutta larghezza con la freccia rossa. Una sola per schermata (FR3.3). Alta
 * almeno 72px, ben oltre il bersaglio minimo di 56px.
 */
export const ACTION_BAR = `flex min-h-[72px] w-full items-center justify-between gap-4 bg-ink-primary px-5 text-left text-[28px] leading-none text-surface-base *:transition-transform hover:[&>svg]:translate-x-1.5 sm:min-h-[88px] sm:px-8 sm:text-[34px] ${HEADLINE} ${FOCUS_RING}`;

/**
 * «Prossimo esercizio» nei quiz: la barra d'azione, che sotto 640px resta attaccata
 * al fondo dello schermo mentre si legge la spiegazione (niente scroll per andare
 * avanti). Da 640px torna al suo posto, in fila col resto.
 */
export const NEXT_BAR = `${ACTION_BAR} sticky bottom-0 z-10 sm:static`;

/**
 * Il link di SERVIZIO: testo sottolineato, piccolo, senza riempimento. Chiaramente
 * non la barra d'azione.
 */
export const SERVICE_LINK = `text-label font-semibold text-ink-primary underline underline-offset-4 ${FOCUS_RING}`;
