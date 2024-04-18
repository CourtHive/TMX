const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const eslintPluginSonarjs = require('eslint-plugin-sonarjs');
const typescriptEslintParser = require('@typescript-eslint/parser');
const globals = require('globals');

const compat = new FlatCompat({
  recommendedConfig: js.configs.recommended,
  baseDirectory: __dirname,
});

module.exports = [
  js.configs.recommended,
  ...compat.extends('plugin:@typescript-eslint/recommended', 'plugin:sonarjs/recommended'),
  { plugins: { sonarjs: eslintPluginSonarjs } },
  {
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: { project: ['tsconfig.json'] },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es6,
        ...globals.jest,
      },
    },
  },
  {
    rules: {
      'no-unused-expressions': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-collection-size-mischeck': 'warn',
      'sonarjs/no-duplicate-string': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-empty-collection': 'warn',
      'sonarjs/no-extra-arguments': 'warn',
      'sonarjs/no-gratuitous-expressions': 'warn',
      'sonarjs/no-identical-expressions': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-ignored-return': 'off',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/no-redundant-boolean': 'warn',
      'sonarjs/no-redundant-jump': 'warn',
      'sonarjs/no-small-switch': 'warn',
      'sonarjs/no-unused-collection': 'warn',
      'sonarjs/prefer-object-literal': 'warn',
      'sonarjs/prefer-single-boolean-return': 'warn',
      '@typescript-eslint/no-useless-escape': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-unresolved': 'off',
      'no-prototype-builtins': 'off',
    },
  },
  {
    ignores: ['**/*.mjs', 'vite.config.ts', '**/*.cy.ts', 'cypress', 'cypress.config.ts'],
  },
];
