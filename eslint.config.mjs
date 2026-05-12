// ESLint Flat Config (ESLint 10).
// Conservative starter ruleset for HHAuto: TypeScript + Tampermonkey + jQuery
// globals via the `globals` package. Errors are kept narrow on purpose so the
// first lint run stays reviewable. Tighten incrementally once the baseline is
// clean.

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

const tampermonkeyGlobals = {
  unsafeWindow: 'readonly',
  GM: 'readonly',
  GM_getValue: 'readonly',
  GM_setValue: 'readonly',
  GM_deleteValue: 'readonly',
  GM_listValues: 'readonly',
  GM_xmlhttpRequest: 'readonly',
  GM_addStyle: 'readonly',
  GM_info: 'readonly',
  GM_setClipboard: 'readonly',
};

export default [
  {
    ignores: [
      'build/**',
      'coverage/**',
      'node_modules/**',
      'HHAuto.user.js',
      '*.bak_*',
      'docs-internal/**',
      'bonus-scripts/**',
    ],
  },
  {
    files: ['src/**/*.ts', 'spec/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.jquery,
        ...tampermonkeyGlobals,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Start conservative. Error on real bugs, warn on style issues.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-cond-assign': 'error',
      'no-constant-condition': 'warn',
      'no-fallthrough': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'prefer-const': 'warn',
      'no-var': 'off', // Codebase uses `var` heavily; flag later if desired.
    },
  },
  {
    files: ['spec/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];