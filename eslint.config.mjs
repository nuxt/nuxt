/// <reference path="eslint-typegen.d.ts" />

// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'
// @ts-expect-error missing types
import noOnlyTests from 'eslint-plugin-no-only-tests'
import typegen from 'eslint-typegen'
// @ts-expect-error missing types
import perfectionist from 'eslint-plugin-perfectionist'

export default createConfigForNuxt({
  features: {
    stylistic: {
      // TODO: Discuss if we want set this to 'always'
      commaDangle: 'never'
    },
    tooling: true
  }
})
  .prepend({
    ignores: [
      'packages/schema/schema/**'
    ]
  })
  .override('nuxt/stylistic', {
    rules: {
      '@stylistic/brace-style': 'off',
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/max-statements-per-line': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/quote-props': ['error', 'as-needed'],
      '@stylistic/space-before-function-paren': 'off'
    }
  })
  .override('nuxt/typescript/rules', {
    rules: {
      // TODO: Discuss if we want to enable this
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      // TODO: Discuss if we want to enable this
      '@typescript-eslint/no-explicit-any': 'off',
      // TODO: Discuss if we want to enable this
      '@typescript-eslint/no-invalid-void-type': 'off'
    }
  })
  .override('nuxt/tooling/unicorn', {
    rules: {
      'unicorn/no-new-array': 'off',
      'unicorn/prefer-dom-node-text-content': 'off'
    }
  })
  .override('nuxt/vue/rules', {
    rules: {
      'vue/array-bracket-spacing': ['error', 'never'],
      'vue/arrow-spacing': ['error', { after: true, before: true }],
      'vue/block-spacing': ['error', 'always'],
      'vue/block-tag-newline': [
        'error',
        {
          multiline: 'always',
          singleline: 'always'
        }
      ],
      'vue/brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
      'vue/comma-dangle': ['error', 'always-multiline'],
      'vue/comma-spacing': ['error', { after: true, before: false }],
      'vue/comma-style': ['error', 'last'],
      'vue/html-comment-content-spacing': [
        'error',
        'always',
        { exceptions: ['-'] }
      ],
      'vue/key-spacing': ['error', { afterColon: true, beforeColon: false }],
      'vue/keyword-spacing': ['error', { after: true, before: true }],
      'vue/object-curly-newline': 'off',
      'vue/object-curly-spacing': ['error', 'always'],
      'vue/object-property-newline': [
        'error',
        { allowMultiplePropertiesPerLine: true }
      ],
      'vue/one-component-per-file': 'off',
      'vue/operator-linebreak': ['error', 'before'],
      'vue/padding-line-between-blocks': ['error', 'always'],
      'vue/quote-props': ['error', 'consistent-as-needed'],
      'vue/require-default-prop': 'off',
      'vue/space-in-parens': ['error', 'never'],
      'vue/template-curly-spacing': 'error'
    }
  })
  .append(
    {
      languageOptions: {
        globals: {
          $fetch: 'readonly',
          NodeJS: 'readonly'
        }
      },
      name: 'local/settings',
      settings: {
        jsdoc: {
          ignoreInternal: true,
          tagNamePreference: {
            note: 'note',
            warning: 'warning'
          }
        }
      }
    },
    {
      files: ['**/*.vue', '**/*.ts', '**/*.mts', '**/*.js', '**/*.cjs', '**/*.mjs'],
      name: 'local/rules',
      plugins: {
        'no-only-tests': noOnlyTests
      },
      rules: {
        '@typescript-eslint/ban-ts-comment': [
          'error',
          {
            'ts-expect-error': 'allow-with-description',
            'ts-ignore': true
          }
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            ignoreRestSiblings: true,
            varsIgnorePattern: '^_'
          }
        ],
        // including if blocks with a single statement
        curly: ['error', 'all'],
        // Force dot notation when possible
        'dot-notation': 'error',

        'import/no-restricted-paths': [
          'error',
          {
            zones: [
              {
                from: 'packages/nuxt/src/!(core)/**/*',
                message: 'core should not directly import from modules.',
                target: 'packages/nuxt/src/core'
              },
              {
                from: 'packages/nuxt/src/!(app)/**/*',
                message: 'app should not directly import from modules.',
                target: 'packages/nuxt/src/app'
              },
              {
                from: 'packages/nuxt/src/app/**/index.ts',
                message: 'should not import from barrel/index files',
                target: 'packages/nuxt/src'
              },
              {
                from: 'packages/nitro',
                message: 'nitro should not directly import other packages.',
                target: 'packages/!(nitro)/**/*'
              }
            ]
          }
        ],
        'import/order': [
          'error',
          {
            pathGroups: [
              {
                group: 'external',
                pattern: '#vue-router'
              }
            ]
          }
        ],

        'jsdoc/check-tag-names': [
          'error',
          {
            definedTags: [
              'experimental',
              '__NO_SIDE_EFFECTS__'
            ]
          }
        ],

        'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
        'no-lonely-if': 'error', // No single if in an "else" block
        'no-only-tests/no-only-tests': 'error',
        'no-useless-rename': 'error',
        'object-shorthand': 'error',
        'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: false }],
        'require-await': 'error',
        'sort-imports': [
          'error',
          {
            ignoreDeclarationSort: true
          }
        ]

      }
    },
    {
      files: ['packages/nuxt/src/app/**', 'test/**', '**/runtime/**', '**/*.test.ts'],
      name: 'local/disables/client-console',
      rules: {
        'no-console': 'off'
      }
    },
    {
      files: ['test/fixtures/**'],
      name: 'local/disables/fixtures',
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/triple-slash-reference': 'off',
        'vue/multi-word-component-names': 'off',
        'vue/valid-v-for': 'off'
      }
    },
    {
      files: ['test/**'],
      name: 'local/disables/tests',
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    },
    {
      files: ['**/eslint.config.mjs'],
      name: 'local/sort-eslint-config',
      plugins: {
        perfectionist
      },
      rules: {
        'perfectionist/sort-objects': 'error'
      }
    }
  )
  .onResolved((configs) => {
    return typegen(configs)
  })
