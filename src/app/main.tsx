import '../ui/theme.css';
// Init i18n PRIMA del render (side-effect al load del modulo): l'istanza
// singleton di i18next è pronta quando <App/> chiama useTranslation (AD-14).
import '../i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { createSupabaseClient } from '../data/supabaseClient';
import { createSupabaseAuthGateway } from '../data/authGateway';
import { createSupabaseSettingsRepository } from '../data/settingsRepository';
import { createSupabaseAccountGateway } from '../data/accountGateway';
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
// <BrowserRouter> abilita il routing per URL e i deep link: il rewrite di
// vercel.json (/(.*) → /index.html, fissato da deploy-config.test.ts) serve
// ogni deep link a index.html, poi BrowserRouter prende il controllo lato client
// e applica il guard (nessun 404).
createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthRoot gateway={gateway} settings={settings} account={account} />
    </BrowserRouter>
  </StrictMode>,
);
