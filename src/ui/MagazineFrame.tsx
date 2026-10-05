// Livello ui: la CORNICE della direzione «rivista» (29-09-2026). Un dorso verticale a
// sinistra, come il dorso di un numero da collezione, porta il marchio 積ん読ゼロ
// scritto in verticale (縦書き), il punto rosso e, in fondo, un piede opzionale; a
// destra il contenuto della schermata. Nessuna porta: l'unico stato che legge è la
// preferenza della furigana, quando la schermata chiede l'interruttore.
//
// Non contiene il <main>: l'invariante è UN solo landmark <main> per schermata, e
// ciascuna schermata compone il proprio dentro `children`. Il marchio è un <p> di
// default; la schermata che non ha altro titolo di primo livello lo chiede come <h1>.
import type { ReactNode } from 'react';
import { resolveLocale, useTranslation } from '../i18n';
import { Translation } from './Translation';
import {
  useFuriganaPreference,
  useTranslationPreference,
  usePreferenceShown,
  type TogglePreference,
} from './furiganaPreference';
import { FOCUS_RING } from './magazine';
import { Furigana } from './Furigana';

// Il marchio a segmenti, con la lettura di 積ん読 (つんどく) per la furigana.
const BRAND = [
  { text: '積', ruby: 'つ' },
  { text: 'ん', ruby: null },
  { text: '読', ruby: 'どく' },
  { text: 'ゼロ', ruby: null },
] as const;

export interface MagazineFrameProps {
  /** Il contenuto a destra del dorso: testata e <main> della schermata. */
  readonly children: ReactNode;
  /** Il piede del dorso, scritto in verticale (per esempio «VOL. 02/13»). */
  readonly foot?: ReactNode;
  /** `true` ⇒ il marchio è l'<h1> della pagina. */
  readonly brandAsHeading?: boolean;
  /**
   * `true` ⇒ in fondo al dorso gli interruttori «Furigana» e «Traduzioni», scritti
   * in verticale. Lo chiedono le schermate dell'app autenticata: le preferenze
   * valgono ovunque.
   */
  readonly furiganaToggle?: boolean;
}

/**
 * Un interruttore del dorso: una casella nativa (tastiera e AT gratis) con
 * l'etichetta scritta di traverso lungo il dorso. Tutta l'etichetta è il
 * bersaglio, larga quanto il dorso e alta oltre 44px.
 */
function SpineToggle({
  label,
  usePreference,
}: {
  readonly label: string;
  readonly usePreference: TogglePreference;
}) {
  const show = usePreferenceShown(usePreference);
  const setShow = usePreference((s) => s.setShow);
  return (
    <label className="flex min-w-[44px] cursor-pointer items-center justify-center gap-2 py-1 font-mono text-label-caps uppercase tracking-[0.08em] text-ink-primary [writing-mode:vertical-rl]">
      <input
        type="checkbox"
        checked={show}
        onChange={(e) => setShow(e.target.checked)}
        className={`size-5 accent-ink-primary ${FOCUS_RING}`}
      />
      {label}
    </label>
  );
}

export function MagazineFrame({
  children,
  foot,
  brandAsHeading = false,
  furiganaToggle = false,
}: MagazineFrameProps) {
  const { t, i18n } = useTranslation();
  const Brand = brandAsHeading ? 'h1' : 'p';
  return (
    <div className="flex min-h-dvh">
      {/* Il dorso resta fermo mentre la pagina scorre: la colonna col filetto destro
          corre per tutta la pagina, dentro il contenuto è `sticky` e alto quanto il
          viewport PICCOLO (`svh`, con la barra del browser visibile). Non `dvh`: su
          telefono `dvh` cambia quando la barra compare o sparisce, ma il browser lo
          ricalcola solo a fine scroll, e gli interruttori in fondo inseguivano la
          pagina con un secondo di ritardo. */}
      <aside className="w-[52px] shrink-0 border-r-[1.5px] border-border-strong sm:w-[72px]">
        <div className="sticky top-0 flex h-svh flex-col items-center justify-between py-5">
          <Brand className="font-jp text-[20px] font-extrabold tracking-[0.2em] text-ink-primary [writing-mode:vertical-rl] sm:text-[24px]">
            <span lang="ja">
              <Furigana segments={BRAND} />
            </span>
            <span className="sr-only"> · {t('app.name')}</span>
            {/* La traduzione del marchio, con «Traduzioni» acceso: di traverso sul
                dorso come il marchio. */}
            <Translation
              text={t('app.brandMeaning')}
              lang={resolveLocale(i18n.language)}
              className="mt-2 block font-mono text-[11px] font-medium normal-case tracking-normal text-ink-secondary"
            />
          </Brand>
          <span aria-hidden="true" className="size-3.5 rounded-full bg-accent" />
          {furiganaToggle ? (
            <div className="flex flex-col items-center gap-3">
              <SpineToggle label={t('app.translationsToggle')} usePreference={useTranslationPreference} />
              <SpineToggle label={t('app.furiganaToggle')} usePreference={useFuriganaPreference} />
            </div>
          ) : (
            <div className="min-h-[1em] font-mono text-label-caps uppercase tracking-[0.08em] text-ink-primary [writing-mode:vertical-rl]">
              {foot}
            </div>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
