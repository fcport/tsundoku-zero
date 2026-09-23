import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';

// Confini architetturali di AD-1 imposti come ERROR (CI rossa, non avviso).
//
// Cinque livelli più i18n: domain → data → ui → features → app.
// Archi ammessi (ogni freccia assente è vietata da `default: 'disallow'`):
//   data     → domain
//   ui       → i18n
//   features → domain | ui | i18n            (MAI data)
//   app      → tutti
//   domain, i18n → nessuno
//
// Non usiamo regole type-aware (nessun `project` in parserOptions): le sonde
// di confine lintano frammenti virtuali con ESLint.lintText su path che non
// esistono nel programma TS. I tipi li verifica `tsc`, non ESLint.
export default tseslint.config(
  {
    // Solo il codice del progetto è vincolato. Restano fuori dallo scope del
    // lint: build, dipendenze, output, e il materiale vendorizzato di BMad.
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'docs/**',
      '.bmad-loop/**',
      '_bmad/**',
      '_bmad-output/**',
      '.claude/**',
      '.vercel/**',
      'supabase/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      'boundaries/include': ['src/**/*'],
      // I file di test non fanno parte del grafo architetturale: possono
      // importare vitest e i moduli che esercitano. Le sonde di confine
      // lintano frammenti VIRTUALI (path __probe__), non questi file.
      'boundaries/ignore': ['src/**/*.test.{ts,tsx}'],
      // mode: 'folder' con pattern `src/<livello>` (senza `/*`) classifica
      // ogni file la cui cartella è dentro il livello, anche quando il
      // modulo sta direttamente in src/<livello>/ senza sottocartelle.
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain', mode: 'folder' },
        { type: 'data', pattern: 'src/data', mode: 'folder' },
        { type: 'ui', pattern: 'src/ui', mode: 'folder' },
        { type: 'features', pattern: 'src/features', mode: 'folder' },
        { type: 'app', pattern: 'src/app', mode: 'folder' },
        { type: 'i18n', pattern: 'src/i18n', mode: 'folder' },
      ],
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      // Matrice degli archi. `default: 'disallow'` => ogni freccia non
      // elencata è un errore.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          // Ogni livello può importare al proprio interno (arco self); la
          // matrice governa le dipendenze FRA livelli (AD-1). domain e i18n
          // non raggiungono alcun altro livello.
          rules: [
            { from: ['domain'], allow: ['domain'] },
            { from: ['i18n'], allow: ['i18n'] },
            { from: ['data'], allow: ['data', 'domain'] },
            { from: ['ui'], allow: ['ui', 'i18n'] },
            { from: ['features'], allow: ['features', 'domain', 'ui', 'i18n'] },
            { from: ['app'], allow: ['app', 'domain', 'data', 'ui', 'features', 'i18n'] },
          ],
        },
      ],
      // Il dominio non importa NESSUN pacchetto esterno (react,
      // @supabase/supabase-js, qualsiasi altro). Gli altri livelli sì.
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          // `*` non attraversa lo `/` degli scope npm: servono entrambi i
          // glob per vietare sia `react` sia `@supabase/supabase-js`.
          rules: [{ from: ['domain'], disallow: ['*', '@*/*'] }],
        },
      ],
      // Regole informative del plugin: silenziate, non fanno parte del
      // contratto di questa storia.
      'boundaries/entry-point': 'off',
      'boundaries/no-private': 'off',
      'boundaries/no-unknown': 'off',
      'boundaries/no-unknown-files': 'off',
      'boundaries/no-ignored': 'off',
    },
  },
  {
    // Il sistema di design come token, non come valori sparsi (storia 1.3,
    // UX-DR1). Nessun componente scrive un colore LETTERALE: solo così la
    // modalità scura è uno scambio di variabili invece di una riscrittura per
    // componente. La regola è ERROR (CI rossa, non avviso).
    //
    // Ambito: SOLO il codice dei componenti (src/ui/**, src/features/**). Lo
    // script di contrasto e i file di token contengono hex legittimi e restano
    // fuori. theme.css è CSS (non lintato da ESLint); questa regola difende il
    // codice JS/TS/JSX dove un colore letterale sostituirebbe un token.
    //
    // Quattro selettori coprono sia gli arbitrary value di Tailwind
    // (className="bg-[#..]", un Literal di stringa) sia gli style inline
    // (style={{ color: '#fff' }}, altro Literal), oltre ai template literal.
    files: ['src/ui/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'Colore esadecimale letterale: usa un token del sistema (bg-*, text-*, border-*), non un valore sparso (UX-DR1).',
        },
        {
          selector:
            'Literal[value=/\\b(rgb|rgba|hsl|hsla|oklch|oklab)\\(/i]',
          message:
            'Funzione colore letterale: usa un token del sistema, non un valore sparso (UX-DR1).',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'Colore esadecimale letterale in template: usa un token del sistema (UX-DR1).',
        },
        {
          selector:
            'TemplateElement[value.raw=/\\b(rgb|rgba|hsl|hsla|oklch|oklab)\\(/i]',
          message:
            'Funzione colore letterale in template: usa un token del sistema (UX-DR1).',
        },
      ],
    },
  },
  {
    // Il dominio è puro: niente accesso ai global di piattaforma (rete,
    // storage). Imposto come ERROR sul solo livello domain.
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Il dominio è puro: nessun accesso di rete (AD-1).' },
        { name: 'localStorage', message: 'Il dominio è puro: nessuno storage (AD-1).' },
        { name: 'sessionStorage', message: 'Il dominio è puro: nessuno storage (AD-1).' },
        { name: 'indexedDB', message: 'Il dominio è puro: nessuno storage (AD-1).' },
      ],
    },
  },
  {
    // I file di configurazione girano in Node.
    files: ['*.config.{ts,js}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Gli script di manutenzione (es. check-contrast) girano in Node: process,
    // console, i moduli node:*. Non fanno parte dell'albero dei componenti,
    // quindi la regola colore di src/ui|features non li tocca.
    files: ['scripts/**/*.{js,mjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Config CommonJS (dependency-cruiser): module.exports, global Node.
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
