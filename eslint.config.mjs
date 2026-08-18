import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'storybook-static/**',
      '**/*.mjs',
      'vite.config.ts',
      'electron.vite.config.ts',
      'vite.shared.ts',
      '**/*.cy.ts',
      'cypress/**',
      'cypress.config.ts',
      'src/legacy/**',
      'src/components/charts/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['tsconfig.json', 'electron/tsconfig.json', 'e2e/tsconfig.json'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        ...globals.jest,
        NodeJS: 'readonly',
        // Injected by TMX at runtime and declared in e2e/global.d.ts; ESLint's no-undef
        // cannot see ambient TypeScript declarations.
        dev: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      sonarjs: sonarjs,
    },
    rules: {
      ...tseslint.configs.recommended.rules,

      // ── CourtHive coding standards, machine-enforced ────────────────────
      // Prose in Mentat/standards/coding-standards.md drifts because lint,
      // types AND prettier all pass while the code violates it. Three PRs on
      // 2026-08-18 shipped such deviations; one merged before review caught it.
      //
      // Never `import type` — plain `import` covers types and values. tsconfig
      // sets isolatedModules WITHOUT verbatimModuleSyntax, so types still
      // elide. `disallowTypeAnnotations: false` keeps inline `import('...')`
      // annotations available as cycle-breakers.
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'no-type-imports', disallowTypeAnnotations: false },
      ],
      // DOM data attributes are read via `.dataset`, never `.getAttribute`.
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.property.name='getAttribute'][arguments.0.value=/^data-/]",
          message: 'Use .dataset.propName instead of .getAttribute("data-*") — Mentat coding standards.',
        },
      ],
      'no-unused-expressions': 'off',
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'off',
      'prefer-const': 'off',
      'no-prototype-builtins': 'off',
      'sonarjs/cognitive-complexity': ['warn', 30],
      'sonarjs/no-commented-code': 'off',
      'sonarjs/no-nested-functions': ['error', { threshold: 4 }],
      'sonarjs/no-hardcoded-passwords': 'off',
      'sonarjs/regex-complexity': 'off',
      'sonarjs/todo-tag': 'off',
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
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-unresolved': 'off',
    },
  },
  {
    // Playwright journeys and their page objects. Test files carry the ecosystem's
    // standard test overrides: repeated selector/label literals are the clearest way
    // to write an assertion, and empty functions are common as no-op callbacks.
    files: ['e2e/**/*.ts'],
    rules: {
      'sonarjs/no-duplicate-string': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      // `toISOString().slice(0, 10)` is the UTC calendar day; TMX's scheduling surfaces render
      // and filter by the LOCAL one. A spec seeding the UTC day silently targets a day the grid
      // is not showing whenever the two differ, and the resulting timeout looks like a broken
      // drag-and-drop rather than a calendar bug. 21 specs had this before it was caught.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
          message:
            'Seed calendar days with todayLocal() from e2e/helpers/dates — toISOString() is UTC, but TMX renders the local day. See Mentat/planning/E2E_SCHEDULE2_UTC_LOCAL_DAY_MISMATCH.md',
        },
      ],
    },
  },
];
