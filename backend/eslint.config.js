/**
 * ESLint flat config. ESLint 10 no longer reads `.eslintrc*` at all — this file
 * is the only supported form.
 */
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'db/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      // 'latest' so espree parses import attributes (`with { type: 'json' }`,
      // ES2025) used for the contract ABI import in services/blockchain.js.
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': [
        'error',
        // Express error handlers must keep arity 4, so a trailing unused
        // `next` is structural rather than dead code.
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'error', // use the winston logger — it redacts PII
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
    },
  },
  {
    files: ['**/*.test.js', 'tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // Fixtures routinely stub things that go unused in a given assertion.
      'no-unused-vars': 'off',
      // Fake async methods (mimicking supabase-js) return objects without an
      // await — that is the point of a stub, not a defect.
      'require-await': 'off',
    },
  },
  prettier, // last — turns off stylistic rules Prettier owns
];
