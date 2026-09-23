import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';
import { ConfigError, readConfig } from './env';

// src/app/ è l'unico livello che può dipendere da tutti gli altri (AD-1):
// qui si compone e si monta l'albero React.
const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento root mancante in index.html');
}

// Fail-fast: valida le VITE_* PRIMA di montare React (storia 1.2). Se una
// variabile manca o è malformata, l'app non parte in stato parzialmente
// configurato: mostriamo il messaggio tecnico (developer-facing, non copy da
// t()) e NON montiamo <App/>.
try {
  readConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    const pre = document.createElement('pre');
    pre.textContent = error.message;
    container.replaceChildren(pre);
    // Il boot si interrompe qui: React non monta.
    throw error;
  }
  throw error;
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
