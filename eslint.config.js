// ESLint flat config for the whole monorepo (server = CommonJS/Node, client = React/Vite).
// Deliberately moderate: real bugs are errors, style is left to Prettier.
const js = require('@eslint/js');
const globals = require('globals');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const prettier = require('eslint-config-prettier');

const sharedRules = {
  'no-unused-vars': [
    'error',
    { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }
  ],
  'no-empty': ['error', { allowEmptyCatch: true }],
  eqeqeq: ['error', 'smart'],
  'no-var': 'error',
  'prefer-const': 'warn'
};

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'client/test-results/**',
      'client/playwright-report/**',
      'backups/**'
    ]
  },
  js.configs.recommended,

  // Server + root tooling: Node, CommonJS
  {
    files: ['server/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: sharedRules
  },

  // Client: browser, ES modules, React
  {
    files: ['client/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...sharedRules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      // Quotes/apostrophes in Arabic UI text are intentional, not bugs.
      'react/no-unescaped-entities': 'off'
    }
  },

  // Client tooling and Node-side test code
  {
    files: ['client/*.config.js', 'client/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node } }
  },

  // Turn off rules that conflict with Prettier (must stay last)
  prettier
];
