import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Scaffold minimo Vite + React (AD-20). Nessuna configurazione runtime qui:
// la validazione delle VITE_* vive in src/app/ (storia 1.2).
//
// Tailwind v4 è CSS-first (storia 1.3): il plugin compila src/ui/theme.css.
// Nessun tailwind.config.js — i token vivono solo nel blocco @theme di theme.css.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
