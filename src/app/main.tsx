import '../ui/theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';
import { decideBoot } from './env';

// src/app/ è l'unico livello che può dipendere da tutti gli altri (AD-1):
// qui si compone e si monta l'albero React.
const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento root mancante in index.html');
}

// Fail-fast: la DECISIONE di boot (config valida vs ConfigError) è calcolata
// da decideBoot() — testata in isolamento, senza DOM (storia 1.2). Qui resta
// solo l'effetto sul DOM. Se la config è invalida l'app non parte in stato
// parzialmente configurato: mostriamo il messaggio tecnico (developer-facing,
// non copy da t()) e NON montiamo <App/>.
const decision = decideBoot();
if (decision.kind === 'config-error') {
  const pre = document.createElement('pre');
  pre.textContent = decision.error.message;
  container.replaceChildren(pre);
  // Il boot si interrompe qui: React non monta.
  throw decision.error;
}

// decision.config è il punto d'iniezione per il client Supabase (storia 1.5):
// i consumatori riceveranno questa config tipizzata, non leggeranno import.meta.env.
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
