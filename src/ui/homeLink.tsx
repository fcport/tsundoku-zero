// Livello ui: il marchio sul dorso porta sempre alla home. È un vero <a href="/">
// (si apre anche in una nuova scheda), ma react-router resta nel livello app: è
// l'app a fornire, con questo contesto, la navigazione interna senza ricaricare la
// pagina. Senza provider (test, SSR) il link resta un link normale.

import { createContext, useContext, type MouseEvent, type ReactNode } from 'react';

interface HomeLink {
  readonly href: string;
  readonly go?: () => void;
}

const HomeLinkContext = createContext<HomeLink>({ href: '/' });

export function HomeLinkProvider({
  href,
  go,
  children,
}: HomeLink & { readonly children: ReactNode }) {
  return <HomeLinkContext.Provider value={{ href, go }}>{children}</HomeLinkContext.Provider>;
}

/** `href` e `onClick` per il link alla home: il clic semplice resta nell'app. */
export function useHomeLink() {
  const { href, go } = useContext(HomeLinkContext);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!go || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go();
  };
  return { href, onClick };
}
