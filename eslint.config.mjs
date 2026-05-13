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
      // Forbid barrel index.ts imports (re-introducing barrels).
      // ADR-001 dropped index.ts barrels in favor of direct file imports
      // to eliminate the circular-dependency epidemic. Adding a new
      // barrel must be a deliberate, reviewed change.
      // Pattern matches paths ending in '/index' explicitly. Folder-only
      // imports like '../Helper' would also resolve to a barrel via Node
      // module resolution; those are caught by `no-restricted-imports`
      // patterns that target the exact folder names used as barrels in
      // the past.
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['*/index'],
            message: 'Direct index.ts imports are forbidden (ADR-001). Import the file that declares the symbol instead.',
          },
        ],
        paths: [
          { name: '../Helper', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../Module', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../Service', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../Utils', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../model', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../config', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../i18n', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../Events', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../harem', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../KK', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: '../game', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: './Helper', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: './Module', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: './Service', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          // './Utils' deliberately not restricted: src/Utils/Utils.ts is a real file, sibling
          // imports from src/Utils/HHPopup.ts and src/Utils/LogUtils.ts use './Utils' to refer
          // to that file. The barrel was at src/Utils/index.ts, deleted in this PR.
          { name: './model', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: './config', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: './i18n', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: './Events', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: './harem', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: './KK', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
          { name: './game', message: 'Barrel imports are forbidden (ADR-001). Import the declaring file directly.' },
        ],
      }],
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