import { defineConfig, devices } from '@playwright/test';

// Config Playwright (storia 7.4): il toolchain e2e vive FUORI da `src/`, isolato
// dal toolchain unit. Questo file cade nell'override eslint `*.config.{ts,js}`
// (globals Node) e resta FUORI da `tsconfig.include` (`["src","scripts",
// "vite.config.ts","vitest.config.ts"]`), quindi non è toccato da `tsc --noEmit`.
// Playwright transpila i propri spec col suo transpiler; `npx playwright test
// --list` è il controllo offline che lo spec compila senza eseguire nulla contro
// il Supabase reale.
//
// L'e2e pilota SOLO le superfici reali dell'app dal browser (rotte pubbliche/
// private, ruoli accessibili + testo i18n, gli id `#auth-email`/`#auth-password`):
// non importa moduli di `src/` (nessun accoppiamento ai confini AD-1) e gira
// contro il progetto Supabase REALE (AD-12/AD-13: un solo progetto reale, mai un
// mock né `supabase start`). Le credenziali arrivano dall'ambiente
// (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, l'anon pubblica) — MAI la
// `service_role` né altri secret privilegiati.

// La porta del `vite preview`: fissata così `baseURL` e `webServer` concordano.
const PORT = 4173;

export default defineConfig({
  // Gli spec vivono in `e2e/`, FUORI da `src/`: non raccolti da Vitest
  // (`src/**/*.test.*`), non inclusi in `tsc --noEmit`.
  testDir: 'e2e',
  // Confini realistici per un e2e che parla col Supabase reale in rete.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Nessun `.only` sfugge in CI (fallisce il run se presente).
  forbidOnly: !!process.env.CI,
  // Determinismo: un solo worker (nessuna corsa fra utenti unici e teardown) e
  // retry 0 in locale / 1 in CI (una flakiness di rete non rende rosso un merge).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Contesto browser pulito per test (nessuna sessione preesistente ⇒
    // atterraggio su `/login`): determinismo del percorso principale.
    storageState: undefined,
    // `retain-on-failure` (non `on-first-retry`): in locale `retries: 0`, quindi
    // un fallimento non viene ritentato e `on-first-retry` non produrrebbe nulla.
    // L'unico test non è eseguibile offline: i primi fallimenti veri (locale o CI)
    // vanno diagnosticati dagli artefatti, che così esistono già al primo errore.
    trace: 'retain-on-failure',
  },
  // Il solo chromium: una superficie basta a coprire il percorso principale;
  // niente matrice di browser (non è lo scopo della storia).
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Avvia l'app REALE (build + preview) con le VITE_* dall'ambiente, così il
  // client Supabase del bundle punta al progetto reale. `reuseExistingServer` in
  // locale evita di ricostruire a ogni run; in CI parte sempre fresco.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
  },
});
