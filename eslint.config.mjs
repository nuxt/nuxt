// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'
// @ts-expect-error missing types
import noOnlyTests from 'eslint-plugin-no-only-tests'
import typegen from 'eslint-typegen'
import perfectionist from 'eslint-plugin-perfectionist'

import { runtimeDependencies } from './packages/nuxt/src/meta.mjs'

export default createConfigForNuxt({
  features: {
    stylistic: {
      commaDangle: 'always-multiline',
    },
    tooling: true,
  },
})
  .prepend(
    {
      // Ignores have to be a separate object to be treated as global ignores
      // Don't add other attributes to this object
      ignores: [
        'packages/schema/schema/**',
        'packages/nuxt/src/app/components/welcome.vue',
        'packages/nuxt/src/app/components/error-*.vue',
        'packages/nuxt/src/core/runtime/nitro/templates/error-*',
      ],
    },
    {
      languageOptions: {
        globals: {
          $fetch: 'readonly',
          NodeJS: 'readonly',
        },
      },
      name: 'local/settings',
      settings: {
        jsdoc: {
          ignoreInternal: true,
          tagNamePreference: {
            note: 'note',
            warning: 'warning',
          },
        },
      },
    },
  )

  .override('nuxt/javascript', {
    rules: {
      'curly': ['error', 'all'], // Including if blocks with a single statement
      'dot-notation': 'error',
      'logical-assignment-operators': ['error', 'always', { enforceForIfStatements: true }],
      'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
      'no-lonely-if': 'error', // No single if in an "else" block
      'no-useless-rename': 'error',
      'object-shorthand': 'error',
      'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: false }],
      'require-await': 'error',
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
    },
  })

  .override('nuxt/typescript/rules', {
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
        },
      ],
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '',
        },
      ],
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/unified-signatures': 'off',
      ...{
        // TODO: Discuss if we want to enable this
        '@typescript-eslint/ban-types': 'off',
        // TODO: Discuss if we want to enable this
        '@typescript-eslint/no-explicit-any': 'off',
        // TODO: Discuss if we want to enable this
        '@typescript-eslint/no-invalid-void-type': 'off',
      },
    },
  })

  .override('nuxt/tooling/unicorn', {
    rules: {
      'unicorn/no-new-array': 'off',
      'unicorn/prefer-dom-node-text-content': 'off',
    },
  })

  .override('nuxt/vue/rules', {
    rules: {

    },
  })

  // Stylistic rules
  .override('nuxt/stylistic', {
    rules: {
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/max-statements-per-line': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/quote-props': ['error', 'consistent'],
      '@stylistic/space-before-function-paren': ['error', 'always'],
    },
  })

  // Append local rules
  .append(
    {
      files: ['**/*.vue', '**/*.ts', '**/*.mts', '**/*.js', '**/*.cjs', '**/*.mjs'],
      name: 'local/rules',
      rules: {
        'import/no-restricted-paths': [
          'error',
          {
            zones: [
              {
                from: 'packages/nuxt/src/!(core)/**/*',
                message: 'core should not directly import from modules.',
                target: 'packages/nuxt/src/core',
              },
              {
                from: 'packages/nuxt/src/!(app)/**/*',
                message: 'app should not directly import from modules.',
                target: 'packages/nuxt/src/app',
              },
              {
                from: 'packages/nuxt/src/app/**/index.ts',
                message: 'should not import from barrel/index files',
                target: 'packages/nuxt/src',
              },
              {
                from: 'packages/nitro',
                message: 'nitro should not directly import other packages.',
                target: 'packages/!(nitro)/**/*',
              },
            ],
          },
        ],
        'jsdoc/check-tag-names': [
          'error',
          {
            definedTags: [
              'experimental',
              '__NO_SIDE_EFFECTS__',
            ],
          },
        ],
      },
    },
    {
      files: ['packages/nuxt/src/app/**', 'test/**', '**/runtime/**', '**/*.test.ts'],
      name: 'local/disables/client-console',
      rules: {
        'no-console': 'off',
      },
    },
    // manually specify dependencies for nuxt browser app
    {
      files: ['packages/nuxt/src/app/**', 'packages/nuxt/src/(components,head,imports,pages)/runtime/**'],
      name: 'local/client-packages',
      rules: {
        '@typescript-eslint/no-restricted-imports': ['error', {
          'patterns': [
            {
              allowTypeImports: true,
              group: [
                // disallow everything
                '[@a-z]*',
                // except certain dependencies
                ...[
                  // vue ecosystem
                  '@unhead',
                  '@vue',
                  '@vue/shared',
                  'vue/server-renderer',
                  'vue',
                  'vue-router',
                  ...runtimeDependencies,
                  'errx', /* only used in dev */
                  // internal deps
                  'nuxt/app',
                ].map(r => `!${r}`),
                '!#[a-z]*/**', // aliases
                '!.*/**', // relative imports
              ],
            },
          ],
        }],
      },
    },
    {
      files: ['**/fixtures/**', '**/fixture/**', '**/*-fixture/**'],
      name: 'local/disables/fixtures',
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/triple-slash-reference': 'off',
        'vue/multi-word-component-names': 'off',
        'vue/valid-v-for': 'off',
      },
    },
    {
      files: ['test/**', '**/*.test.ts'],
      name: 'local/disables/tests',
      plugins: {
        'no-only-tests': noOnlyTests,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
        'no-only-tests/no-only-tests': 'error',
      },
    },
    // Sort rule keys in eslint config
    // @ts-expect-error type issues in eslint
    {
      files: ['**/eslint.config.mjs'],
      name: 'local/sort-eslint-config',
      plugins: {
        perfectionist,
      },
      rules: {
        'perfectionist/sort-objects': 'error',
      },
    },
    {
      files: ['packages/nuxt/src/app/components/welcome.vue'],
      rules: {
        'vue/multi-word-component-names': 'off',
      },
    },
  )

  // Generate type definitions for the eslint config
  // @ts-expect-error type issues in eslint
  .onResolved((configs) => {
    // @ts-expect-error type issues in eslint
    return typegen(configs)
  })
