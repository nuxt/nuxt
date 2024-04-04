// Configs
// import standard from "eslint-config-standard"
// import nuxt from '@nuxt/eslint-config'

// Plugins
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jsdoc from 'eslint-plugin-jsdoc'
import esImport from 'eslint-plugin-import'
import unicorn from 'eslint-plugin-unicorn'
import noOnlyTests from 'eslint-plugin-no-only-tests'

/**
 * eslintrc compatibility
 * @see https://eslint.org/docs/latest/use/configure/migration-guide#using-eslintrc-configs-in-flat-config
 * @see https://github.com/eslint/eslintrc#usage-esm
 */
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended
})

// TODO: Type definition?
export default [
  {
    ignores: [
      '**/dist/**',
      '**/.nuxt/**',
      '**/.nuxt-*/**',
      '**/.output/**',
      '**/.output-*/**',
      '**/public/**',
      '**/node_modules/**',
      'packages/schema/schema',

      // TODO: remove when fully migrated to flat config
      '**/*.d.mts'
    ]
  },
  // standard,
  ...compat.extends('eslint-config-standard'),
  jsdoc.configs['flat/recommended'],
  // nuxt,
  ...compat.extends('@nuxt/eslint-config'),
  esImport.configs.typescript,
  {
    rules: {
      'import/export': 'off'
    }
  },
  {
    files: ['**/*.vue', '**/*.ts', '**/*.mts', '**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      globals: {
        NodeJS: 'readonly',
        $fetch: 'readonly'
      }
    },
    plugins: {
      jsdoc,
      import: esImport,
      unicorn,
      'no-only-tests': noOnlyTests
    },
    rules: {
      // Imports should come first
      'import/first': 'error',
      // Other import rules
      'import/no-mutable-exports': 'error',
      // Allow unresolved imports
      'import/no-unresolved': 'off',
      // Allow paren-less arrow functions only when there's no braces
      'arrow-parens': ['error', 'as-needed', { requireForBlockBody: true }],
      // Allow async-await
      'generator-star-spacing': 'off',
      // Prefer const over let
      'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: false }],
      // No single if in an "else" block
      'no-lonely-if': 'error',
      // Force curly braces for control flow,
      // including if blocks with a single statement
      curly: ['error', 'all'],
      // No async function without await
      'require-await': 'error',
      // Force dot notation when possible
      'dot-notation': 'error',

      'no-var': 'error',
      // Force object shorthand where possible
      'object-shorthand': 'error',
      // No useless destructuring/importing/exporting renames
      'no-useless-rename': 'error',
      /**********************/
      /*   Unicorn Rules    */
      /**********************/
      // Pass error message when throwing errors
      'unicorn/error-message': 'error',
      // Uppercase regex escapes
      'unicorn/escape-case': 'error',
      // Array.isArray instead of instanceof
      'unicorn/no-array-instanceof': 'error',
      // Prevent deprecated `new Buffer()`
      'unicorn/no-new-buffer': 'error',
      // Keep regex literals safe!
      'unicorn/no-unsafe-regex': 'off',
      // Lowercase number formatting for octal, hex, binary (0x12 instead of 0X12)
      'unicorn/number-literal-case': 'error',
      // ** instead of Math.pow()
      'unicorn/prefer-exponentiation-operator': 'error',
      // includes over indexOf when checking for existence
      'unicorn/prefer-includes': 'error',
      // String methods startsWith/endsWith instead of more complicated stuff
      'unicorn/prefer-starts-ends-with': 'error',
      // textContent instead of innerText
      'unicorn/prefer-text-content': 'error',
      // Enforce throwing type error when throwing error while checking typeof
      'unicorn/prefer-type-error': 'error',
      // Use new when throwing error
      'unicorn/throw-new-error': 'error',
      'sort-imports': [
        'error',
        {
          ignoreDeclarationSort: true
        }
      ],
      'no-only-tests/no-only-tests': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
      'vue/one-component-per-file': 'off',
      'vue/require-default-prop': 'off',

      // Vue stylistic rules from `@antfu/eslint-config`
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
        {
          exceptions: ['-']
        }
      ],
      'vue/key-spacing': ['error', { afterColon: true, beforeColon: false }],
      'vue/keyword-spacing': ['error', { after: true, before: true }],
      'vue/object-curly-newline': 'off',
      'vue/object-curly-spacing': ['error', 'always'],
      'vue/object-property-newline': [
        'error',
        { allowMultiplePropertiesPerLine: true }
      ],
      'vue/operator-linebreak': ['error', 'before'],
      'vue/padding-line-between-blocks': ['error', 'always'],
      'vue/quote-props': ['error', 'consistent-as-needed'],
      'vue/space-in-parens': ['error', 'never'],
      'vue/template-curly-spacing': 'error',

      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-param-type': 'off',
      'import/order': [
        'error',
        {
          pathGroups: [
            {
              pattern: '#vue-router',
              group: 'external'
            }
          ]
        }
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              from: 'packages/nuxt/src/!(core)/**/*',
              target: 'packages/nuxt/src/core',
              message: 'core should not directly import from modules.'
            },
            {
              from: 'packages/nuxt/src/!(app)/**/*',
              target: 'packages/nuxt/src/app',
              message: 'app should not directly import from modules.'
            },
            {
              from: 'packages/nuxt/src/app/**/index.ts',
              target: 'packages/nuxt/src',
              message: 'should not import from barrel/index files'
            },
            {
              from: 'packages/nitro',
              target: 'packages/!(nitro)/**/*',
              message: 'nitro should not directly import other packages.'
            }
          ]
        }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: false
        }
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true
        }
      ],
      '@typescript-eslint/prefer-ts-expect-error': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'jsdoc/check-tag-names': [
        'error',
        {
          definedTags: ['__NO_SIDE_EFFECTS__']
        }
      ]
    },
    settings: {
      jsdoc: {
        ignoreInternal: true,
        tagNamePreference: {
          warning: 'warning',
          note: 'note'
        }
      }
    }
  },
  {
    files: ['packages/schema/**'],
    rules: {
      'jsdoc/valid-types': 'off',
      'jsdoc/check-tag-names': [
        'error',
        {
          definedTags: ['experimental']
        }
      ]
    }
  },
  {
    files: ['packages/nuxt/src/app/**', 'test/**', '**/runtime/**', '**/*.test.ts'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['test/fixtures/**'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'vue/valid-v-for': 'off'
    }
  }
]
