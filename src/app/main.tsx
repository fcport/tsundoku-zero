import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';

// src/app/ è l'unico livello che può dipendere da tutti gli altri (AD-1):
// qui si compone e si monta l'albero React.
const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento root mancante in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
