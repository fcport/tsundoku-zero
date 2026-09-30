// Livello features/study: un testo in PROSA (italiano o inglese) con dentro parole
// giapponesi. Le corse di kanji con una lettura certa prendono la furigana, in un
// nodo `lang="ja"`; il resto resta testo. La lettura la decide il dominio
// (`annotateKnownKanji`), l'interruttore del dorso la può spegnere (`Furigana`).
// Lo usano la domanda dell'esercizio e la spiegazione.
import { annotateKnownKanji } from '../../domain/option-furigana';
import { Furigana } from '../../ui/Furigana';

export interface ProseWithFuriganaProps {
  readonly text: string;
  /** Le letture certe (`corsa → lettura`); assente ⇒ testo semplice. */
  readonly readings?: ReadonlyMap<string, string>;
}

export function ProseWithFurigana({ text, readings }: ProseWithFuriganaProps) {
  if (!readings) return <>{text}</>;
  return (
    <>
      {annotateKnownKanji(text, readings).map((seg, i) =>
        seg.ruby ? (
          <span key={i} lang="ja">
            <Furigana segments={[seg]} />
          </span>
        ) : (
          seg.text
        ),
      )}
    </>
  );
}
