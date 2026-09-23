import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Scaffold minimo Vite + React (AD-20). Nessuna configurazione runtime qui:
// la validazione delle VITE_* vive in src/app/ (storia 1.2).
export default defineConfig({
  plugins: [react()],
});
