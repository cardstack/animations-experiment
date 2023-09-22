'use strict';

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    requireConfigFile: false,
    babelOptions: {
      plugins: [
        ['@babel/plugin-proposal-decorators', { decoratorsBeforeExport: true }],
      ],
    },
  },
  plugins: ['ember', '@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:ember/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:qunit-dom/recommended',
  ],
  env: {
    browser: true,
  },
  rules: {
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'prefer-const': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-this-alias': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
  overrides: [
    // node files
    {
      files: [
        './.eslintrc.js',
        './.percy.js',
        './.prettierrc.js',
        './.stylelintrc.js',
        './.template-lintrc.js',
        './ember-cli-build.js',
        './testem.js',
        './blueprints/*/index.js',
        './config/**/*.js',
        './lib/**/*.js',
        './server/**/*.js',
      ],
      parserOptions: {
        sourceType: 'script',
      },
      env: {
        browser: false,
        node: true,
      },
      extends: ['plugin:n/recommended'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      // test files
      files: ['tests/**/*-test.{js,ts}'],
      extends: ['plugin:qunit/recommended'],
      rules: {
        'qunit/require-expect': 'off',
        'qunit/no-conditional-assertions': 'off',
      },
    },
    {
      // typescript-eslint recommends turning off no-undef for Typescript files since
      // Typescript will better analyse that:
      // https://github.com/typescript-eslint/typescript-eslint/blob/5b0e577f2552e8b2c53a3fb22edc9d219589b937/docs/linting/Troubleshooting.mdx#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      files: ['**/*.ts', '**/*.gts'],
      rules: {
        'no-undef': 'off',
      },
    },
    {
      // don’t enforce import order on blueprint files
      files: ['app/**', 'tests/**'],
      extends: ['plugin:import/recommended', 'plugin:import/typescript'],
      rules: {
        // this doesn't work well with the monorepo. Typescript already complains if you try to import something that's not found
        'import/no-unresolved': 'off',
        'import/order': [
          'error',
          {
            'newlines-between': 'always-and-inside-groups',
            alphabetize: {
              order: 'asc',
            },
            groups: [
              'builtin',
              'external',
              'internal',
              'parent',
              'sibling',
              'index',
              'object',
              'type',
            ],
            pathGroups: [
              {
                pattern: '@ember/**',
                group: 'builtin',
              },
              {
                pattern: '@embroider/**',
                group: 'builtin',
              },
              {
                pattern: '@glimmer/**',
                group: 'builtin',
              },
              {
                pattern: '@cardstack/boxel-ui{*,/**}',
                group: 'internal',
                position: 'before',
              },
              {
                pattern: '@cardstack/runtime-common{*,/**}',
                group: 'internal',
                position: 'before',
              },
              {
                pattern: '@cardstack/host/**',
                group: 'internal',
                position: 'after',
              },
              {
                pattern: '@cardstack**',
                group: 'internal',
              },
              {
                pattern: 'https://cardstack.com/**',
                group: 'internal',
                position: 'after',
              },
            ],
            pathGroupsExcludedImportTypes: [],
          },
        ],
      },
    },
  ],
};
