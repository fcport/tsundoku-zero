import '../ui/theme.css';
// Init i18n PRIMA del render (side-effect al load del modulo): l'istanza
// singleton di i18next è pronta quando <App/> chiama useTranslation (AD-14).
import '../i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createSupabaseClient } from '../data/supabaseClient';
import { createSupabaseAuthGateway } from '../data/authGateway';
import { createSupabaseSettingsRepository } from '../data/settingsRepository';
import { createSupabaseAccountGateway } from '../data/accountGateway';
import { createSupabaseReviewRepository } from '../data/reviewRepository';
import { createSupabaseProgressRepository } from '../data/progressRepository';
import { createSupabaseContentRepository } from '../data/contentRepository';
import { systemClock } from '../data/clock';
import type { Ports } from '../features/ports/PortsContext';
import { AuthRoot } from './AuthRoot';
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

// decision.config è il punto d'iniezione degli adattatori (AD-1/AD-2). UN SOLO
// client Supabase è creato qui e condiviso fra le due porte: una sola sessione /
// un solo GoTrueClient (storia 1.9). Le schermate (features) non conoscono
// @supabase/supabase-js: ricevono solo le interfacce del dominio (AuthGateway,
// SettingsRepository).
const client = createSupabaseClient(decision.config);
const gateway = createSupabaseAuthGateway(client);
const settings = createSupabaseSettingsRepository(client);
const account = createSupabaseAccountGateway(client);

// Le porte del ciclo di ripasso (dashboard 3.12+), raccolte in un solo oggetto
// iniettato: gli stessi adattatori Supabase (client condiviso) più l'orologio di
// sistema. `features` le riceve via PortsProvider senza conoscere data (AD-1).
const ports: Ports = {
  clock: systemClock,
  review: createSupabaseReviewRepository(client),
  progress: createSupabaseProgressRepository(client),
  content: createSupabaseContentRepository(client),
};

// UN solo QueryClient per l'app (il read-model di AD-5). `retry: false`: nessun
// refetch fantasma, test deterministici — un errore di porta risale subito allo
// stato di errore invece di ritentare in silenzio.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

// <BrowserRouter> abilita il routing per URL e i deep link: il rewrite di
// vercel.json (/(.*) → /index.html, fissato da deploy-config.test.ts) serve
// ogni deep link a index.html, poi BrowserRouter prende il controllo lato client
// e applica il guard (nessun 404).
createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthRoot
          gateway={gateway}
          settings={settings}
          account={account}
          ports={ports}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
