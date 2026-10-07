// Livello ui: il TIMBRO da impaginato (07-10-2026), lo stesso del 正/誤 della
// spiegazione: un quadrato rosso inclinato col carattere e la sua furigana, e sotto
// la traduzione con «Traduzioni» acceso. Lo usano la libreria (習得, «imparata») e i
// traguardi. Decorativo (`aria-hidden`): il fatto lo dice sempre il testo accanto.
import { Furigana } from './Furigana';
import type { RubySegment } from './JapaneseText';
import { Translation } from './Translation';

export interface StampProps {
  /** Il carattere (o i caratteri) del timbro, con la furigana. */
  readonly segments: readonly RubySegment[];
  /** La traduzione sotto il timbro, nella lingua dell'interfaccia; assente ⇒ niente. */
  readonly meaning?: string;
  readonly meaningLang?: string;
  /** `md` come il timbro della spiegazione; `sm` dentro un elenco. */
  readonly size?: 'sm' | 'md';
  /** Un traguardo non ancora preso: filetto sottile e inchiostro spento. */
  readonly faded?: boolean;
}

const SIZE = {
  sm: 'size-11 border-[2.5px] text-[18px]',
  md: 'size-14 border-[3px] text-[24px]',
} as const;

// Più di un carattere (習得): il timbro si scrive in verticale, come un hanko, con
// la furigana a destra. Largo come quello quadrato, alto quanto serve.
const VERTICAL_SIZE = {
  sm: 'w-11 py-1.5 border-[2.5px] text-[18px] [writing-mode:vertical-rl]',
  md: 'w-14 py-2 border-[3px] text-[24px] [writing-mode:vertical-rl]',
} as const;

export function Stamp({ segments, meaning, meaningLang, size = 'md', faded = false }: StampProps) {
  const vertical = segments.reduce((chars, segment) => chars + segment.text.length, 0) > 1;
  return (
    <span aria-hidden="true" className="flex shrink-0 flex-col items-center gap-1">
      <span
        lang="ja"
        className={`flex -rotate-6 items-center justify-center font-extrabold leading-none ${
          vertical ? VERTICAL_SIZE[size] : SIZE[size]
        } ${
          faded ? 'border-border-hairline text-ink-muted' : 'border-accent text-accent'
        }`}
      >
        <span className="whitespace-nowrap">
          <Furigana segments={segments} />
        </span>
      </span>
      <Translation
        text={meaning}
        lang={meaningLang ?? 'en'}
        className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-ink-secondary"
      />
    </span>
  );
}
