import { defineConfig } from 'vitest/config';

// I test unitari e le sonde di confine girano in ambiente Node: le sonde
// istanziano l'API programmatica di ESLint, che richiede il filesystem.
export default defineConfig({
  test: {
    environment: 'node',
    // Anche i .test.tsx: il livello ui è .tsx, un futuro test di componente
    // non deve essere saltato in silenzio.
    include: ['src/**/*.test.{ts,tsx}'],
    // Le sonde di confine istanziano l'API programmatica di ESLint: la prima
    // invocazione paga a freddo il caricamento della flat config e il bootstrap
    // del resolver TypeScript, che su un runner CI freddo supera i 5s di default
    // (osservato ~6s). Il riscaldamento vive nel beforeAll, perciò alziamo il
    // limite dell'hook; testTimeout resta come rete di sicurezza.
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
