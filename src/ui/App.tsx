// Placeholder presentazionale minimo (AD-1: livello ui).
// Il confine a tre di AD-14 (vedi docs/i18n-boundary.md):
//  - INTERFACCIA da t(): la tagline passa dal traduttore tipizzato.
//  - GIAPPONESE da nessuno dei due: 積ん読ゼロ è il nome proprio del prodotto,
//    è DATO, non stringa d'interfaccia — reso con lang="ja", mai da t(), e
//    nessun carattere CJK vive nei cataloghi.
import { useTranslation } from '../i18n';

export function App() {
  const { t } = useTranslation();
  return (
    <main>
      <h1 lang="ja">積ん読ゼロ</h1>
      <p>{t('app.tagline')}</p>
    </main>
  );
}
