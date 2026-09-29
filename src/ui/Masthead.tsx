// Livello ui: la TESTATA della direzione «rivista». Una riga fra due filetti: a
// sinistra la collocazione (la data, o il ritorno alla dashboard), a destra le
// azioni di servizio. PRESENTAZIONALE: riceve i due lati già composti.
import type { ReactNode } from 'react';

export interface MastheadProps {
  readonly start: ReactNode;
  readonly end?: ReactNode;
}

export function Masthead({ start, end }: MastheadProps) {
  return (
    <header className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b-[1.5px] border-border-strong px-4 py-2 font-sans text-[13px] font-semibold uppercase tracking-[0.06em] font-stretch-condensed text-ink-primary sm:px-6">
      <div className="flex items-center gap-3">{start}</div>
      {end ? <div className="flex items-center gap-1 sm:gap-3">{end}</div> : null}
    </header>
  );
}
