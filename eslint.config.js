// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      // Deno-runtime, geen app-code: de URL-imports (`https://esm.sh/...`)
      // en de `Deno`-global zijn hier niet op te lossen. Om dezelfde reden
      // staan ze ook in de `exclude` van tsconfig.json.
      'supabase/functions/**',
    ],
  },
  {
    // De service worker draait in een eigen scope met eigen globals.
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        clients: 'readonly',
        caches: 'readonly',
        self: 'readonly',
      },
    },
  },
  {
    // Nederlandse copy zit vol apostrofs ("foto's", "'s avonds"). De regel
    // is bedoeld om per ongeluk niet-afgesloten tekens te vangen; we houden
    // hem aan voor `>` en `}`, die écht dubbelzinnig zijn, en laten quotes
    // met rust in plaats van elke zin met `&apos;` te vervuilen.
    rules: {
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    },
  },
]);
