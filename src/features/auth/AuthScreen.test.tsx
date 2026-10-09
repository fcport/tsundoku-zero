import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import type { AuthGateway, Unsubscribe } from '../../domain/ports/authGateway';
import { AuthScreen } from './AuthScreen';

// 3.23 — parità di schermata: il <main> di AuthScreen compone il contenitore
// responsive condiviso (`src/ui/layout.ts`). Ambiente `node`: `renderToStaticMarkup`
// NON esegue effetti né eventi — la resa statica basta per ancorare le classi del
// landmark. Il gateway è uno STUB inerte (nessuna rete): i suoi metodi non sono
// invocati al primo render (partono solo su submit, che qui non avviene).

const stubGateway: AuthGateway = {
  signUp: async () => ({ ok: true }),
  signIn: async () => ({ ok: true }),
  signOut: async () => {},
  isAuthenticated: async () => false,
  currentUserId: async () => null,
  onAuthStateChange: (): Unsubscribe => () => {},
};

const NOOP = () => {};

function render(): string {
  return renderToStaticMarkup(
    <AuthScreen
      gateway={stubGateway}
      onAuthenticated={NOOP}
      onViewPrivacy={NOOP}
      onViewAcknowledgements={NOOP}
      onViewAbout={NOOP}
    />,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('AuthScreen — contenitore responsive condiviso (3.23)', () => {
  const markup = render();

  it('ha un solo landmark <main>', () => {
    const mains = markup.match(/<main/g) ?? [];
    expect(mains.length).toBe(1);
  });

  it('il tanuki saluta chi arriva', () => {
    expect(markup).toContain('data-mascot="waving"');
  });

  it('il <main> porta max-w-measure, px-gutter-mobile, sm:px-gutter-desktop', () => {
    // La classe di `src/ui/layout.ts` (`RESPONSIVE_CONTAINER`): colonna centrata a
    // `measure`, gutter 20/32px. Un test qui evita che la schermata perda il
    // contenitore senza che alcun test fallisca.
    expect(markup).toMatch(/<main[^>]*class="[^"]*max-w-measure[^"]*"/);
    expect(markup).toMatch(/<main[^>]*class="[^"]*px-gutter-mobile[^"]*"/);
    expect(markup).toMatch(/<main[^>]*class="[^"]*sm:px-gutter-desktop[^"]*"/);
  });
});
