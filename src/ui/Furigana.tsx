// Livello ui: la furigana del giapponese FISSO dell'interfaccia (marchio, data,
// timbri, punti grammaticali, parole nelle spiegazioni), comandata dalla STESSA
// casella del dorso che governa frasi e opzioni (`furiganaPreference`). Accesa ⇒ la
// lettura sopra i kanji; spenta ⇒ solo il testo.
//
// La lettura è fuori dal nome accessibile (`<rt aria-hidden>`, niente `<rp>`): l'AT
// legge il testo com'è, come per le opzioni della card. Dimensione e colore della
// lettura li fissa la regola `rt` di `theme.css`, uguale per tutta l'app.
import type { RubySegment } from './JapaneseText';
import { useFuriganaPreference, usePreferenceShown } from './furiganaPreference';

export interface FuriganaProps {
  /** Il testo a segmenti; `ruby: null` ⇒ segmento senza lettura. */
  readonly segments: readonly RubySegment[];
}

export function Furigana({ segments }: FuriganaProps) {
  const show = usePreferenceShown(useFuriganaPreference);
  return (
    <>
      {segments.map((seg, i) =>
        show && seg.ruby ? (
          <ruby key={i}>
            {seg.text}
            <rt aria-hidden="true">
              {seg.ruby}
            </rt>
          </ruby>
        ) : (
          seg.text
        ),
      )}
    </>
  );
}
