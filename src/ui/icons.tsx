// Livello ui: le due frecce della rivista, disegnate in SVG invece che scritte con
// un carattere (→, ↗). Sono decorative (`aria-hidden`): il testo del controllo resta
// esattamente la copy di t(), senza un simbolo in coda che l'AT leggerebbe e che
// romperebbe la copy ASCII dell'inglese. Il colore è `currentColor`.

/** La freccia della barra d'azione: lunga, tratto pieno. */
export function ArrowIcon({ className = '' }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 34 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className={`h-[0.5em] w-[1.1em] shrink-0 ${className}`}
    >
      <path d="M0 8h31M23 1l8 7-8 7" />
    </svg>
  );
}

/** La freccia obliqua dei collegamenti che escono dall'app. */
export function ExternalIcon({ className = '' }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`inline-block size-[0.7em] align-baseline ${className}`}
    >
      <path d="M2 10L10 2M4 2h6v6" />
    </svg>
  );
}
