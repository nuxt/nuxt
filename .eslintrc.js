module.exports = {
  root: true,
  parserOptions: {
    parser: 'babel-eslint',
    sourceType: 'module',
    ecmaFeatures: {
      legacyDecorators: true
    }
  },
  extends: [
    '@nuxtjs'
  ],
  overrides: [{
    files: [ 'test/fixtures/*/.nuxt*/**' ],
    rules: {
      'vue/name-property-casing': 'error',
      'no-unused-vars': 'warn'
    }
  }, {
    files: [
      'examples/storybook/**',
      'examples/with-element-ui/**',
      'examples/with-museui/**',
      'examples/with-vue-material/**',
      'examples/with-vuetify/**',
      'examples/with-vuikit/**',
      'examples/with-vux/**',
    ],
    rules: {
      'vue/component-name-in-template-casing': ['warn', 'kebab-case']
    }
  }, {
    files: [ 'test/fixtures/*/.nuxt*/**/+(App|index|server|client).js' ],
    rules: {
      'import/order': 'ignore'
    }
  }, {
    files: [ 'test/fixtures/*/.nuxt*/**/client.js' ],
    rules: {
      'no-console': ['error', { allow: ['error'] }]
    }
  }, {
    files: [ 'test/fixtures/*/.nuxt*/**/router.js' ],
    rules: {
      'no-console': ['error', { allow: ['warn'] }]
    }
  }, {
    files: [ 'test/fixtures/*/.nuxt*/**/*.html' ],
    rules: {
      'semi': ['error', 'always', { 'omitLastInOneLineBlock': true }],
      'no-var': 'warn'
    }
  }, {
    // might be removed in the future, see https://github.com/standard/eslint-plugin-standard/issues/27
    files: [ 'test/fixtures/*/.nuxt*/**/nuxt-link.client.js' ],
    rules: {
      'standard/no-callback-literal': 'ignore'
    }
  }]
}
