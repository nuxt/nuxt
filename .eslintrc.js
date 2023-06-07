module.exports = {
  root: true,
  extends: [
    '@nuxtjs'
  ],
  globals: {
    BigInt: true
  },
  env: {
    'jest/globals': true
  },
  plugins: [
    'jest'
  ],
  rules: {
    'no-console': 'error',
    'no-debugger': 'error',
    'no-template-curly-in-string': 0,
    quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
    // https://github.com/babel/babel-eslint/issues/799
    'template-curly-spacing': 0,
    indent: ['error', 2, { SwitchCase: 1, ignoredNodes: ['TemplateLiteral'] }],
    'vue/multi-word-component-names': 0
  },
  overrides: [{
    files: ['test/fixtures/*/.nuxt*/**'],
    rules: {
      'vue/name-property-casing': 'error'
    }
  }, {
    files: [
      'examples/storybook/**',
      'examples/with-element-ui/**',
      'examples/with-museui/**',
      'examples/with-vue-material/**',
      'examples/with-vuetify/**',
      'examples/with-vuikit/**',
      'examples/with-vux/**'
    ],
    rules: {
      'vue/component-name-in-template-casing': ['warn', 'kebab-case']
    }
  }, {
    files: ['test/fixtures/*/.nuxt*/**/+(App|index|server|client|nuxt).js'],
    rules: {
      'import/order': 'off'
    }
  }, {
    files: ['test/fixtures/*/.nuxt*/**/client.js'],
    rules: {
      'no-console': ['error', { allow: ['error'] }]
    }
  }, {
    files: ['test/fixtures/*/.nuxt*/**/router.js'],
    rules: {
      'no-console': ['error', { allow: ['warn'] }]
    }
  }, {
    files: ['test/fixtures/*/.nuxt*/**/*.html'],
    rules: {
      semi: ['error', 'always', { omitLastInOneLineBlock: true }],
      'no-var': 'off'
    }
  }, {
    files: ['test/fixtures/*/.nuxt*/**/nuxt-error.vue'],
    rules: {
      'vue/singleline-html-element-content-newline': 'off'
    }
  }, {
    // might be removed in the future, see https://github.com/standard/eslint-plugin-standard/issues/27
    files: ['test/fixtures/*/.nuxt*/**/nuxt-link.client.js'],
    rules: {
      'standard/no-callback-literal': 'off'
    }
  }, {
    files: ['**/*.ts'],
    env: { browser: true, es6: true, node: true },
    extends: [
      '@nuxtjs/eslint-config-typescript'
    ],
    globals: { Atomics: 'readonly', SharedArrayBuffer: 'readonly' },
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaFeatures: { jsx: true },
      ecmaVersion: 2018,
      sourceType: 'module'
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 0
    }
  }]
}
