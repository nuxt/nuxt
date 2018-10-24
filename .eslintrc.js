module.exports = {
  root: true,
  parserOptions: {
    parser: 'babel-eslint',
    sourceType: 'module'
  },
  extends: [
    '@nuxtjs'
  ],
  overrides: [{
    files: [ 'test/fixtures/*/.nuxt*/**' ],
    rules: {
      'vue/name-property-casing': ['error', 'kebab-case']
    }
  }, {
    files: [ 'test/fixtures/*/.nuxt*/**/+(App|index).js' ],
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
  }]
}
