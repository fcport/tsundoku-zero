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

/** Il marchio di GitHub, davanti ai collegamenti al codice del sito. */
export function GitHubIcon({ className = '' }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`inline-block size-[1.1em] shrink-0 align-[-0.2em] ${className}`}
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

/** L'altoparlante del pulsante che fa ascoltare la frase. */
export function SpeakerIcon({ className = '' }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      className={`size-[1em] shrink-0 ${className}`}
    >
      <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
      <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13.5 3.5a6.5 6.5 0 0 1 0 9" strokeLinecap="round" />
    </svg>
  );
}
