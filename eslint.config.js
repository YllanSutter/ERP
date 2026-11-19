import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'backups/**', 'public/steamList.json', 'src/lib/plugins/steam/steamList.json'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.*', 'src/lib/databaseStorage.ts'],
    rules: {
      'no-restricted-globals': ['error', { name: 'localStorage', message: 'Persist through databaseStorage; localStorage is reserved for legacy import.' }, { name: 'sessionStorage', message: 'Persistent application state belongs in the database.' }],
      'no-restricted-properties': ['error', { property: 'localStorage', message: 'Use databaseStorage for persistent application state.' }, { property: 'sessionStorage', message: 'Use databaseStorage for persistent application state.' }],
    },
  },
  prettier,
);
