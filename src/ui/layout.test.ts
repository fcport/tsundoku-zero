import { describe, expect, it } from 'vitest';
import { RESPONSIVE_CONTAINER } from './layout';

// La costante CONDIVISA del contenitore responsive (3.23). Un test FOCALIZZATO:
// `RESPONSIVE_CONTAINER` è composto nei `<main>` di sei schermate, ma un typo in
// una singola utility qui darebbe un fallimento DIFFUSO e ambiguo nei test di
// schermata. Asserire la stringa esatta localizza il guasto a questa riga.
//
// Contratto (DESIGN.md §Layout, UX-DR3): colonna singola centrata (`mx-auto`
// `w-full`), larghezza massima = `measure` mai allargata (`max-w-measure`), gutter
// `gutter-mobile` (20px) sotto 640px che diventa `gutter-desktop` (32px) da 640px
// (variante `sm:`, che in Tailwind v4 è la media query `min-width: 640px`).
describe('RESPONSIVE_CONTAINER — la classe condivisa del contenitore (3.23)', () => {
  it('porta ognuna delle utility del contratto responsive', () => {
    for (const utility of [
      'mx-auto',
      'w-full',
      'max-w-measure',
      'px-gutter-mobile',
      'sm:px-gutter-desktop',
    ]) {
      expect(RESPONSIVE_CONTAINER).toContain(utility);
    }
  });

  it('è ESATTAMENTE la stringa attesa (un typo dà UN fallimento localizzato)', () => {
    expect(RESPONSIVE_CONTAINER).toBe(
      'mx-auto w-full max-w-measure px-gutter-mobile sm:px-gutter-desktop',
    );
  });
});
