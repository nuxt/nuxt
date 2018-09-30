module.exports = {
  root: true,
  parserOptions: {
    parser: 'babel-eslint',
    sourceType: 'module'
  },
  env: {
    browser: true,
    node: true,
    'jest/globals': true
  },
  extends: [
    'standard',
    'standard-jsx',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:vue/recommended'
  ],
  plugins: [
    'vue',
    'jest'
  ],
  settings: {
    'import/resolver': {
      node: { extensions: ['.js', '.mjs'] }
    }
  },
  rules: {
    // Enforce import order
    'import/order': 2,

    // Imports should come first
    'import/first': 2,

    // Other import rules
    'import/no-mutable-exports': 2,

    // Allow unresolved imports
    'import/no-unresolved': 0,

    // Allow paren-less arrow functions only when there's no braces
    'arrow-parens': [2, 'as-needed', { requireForBlockBody: true }],

    // Allow async-await
    'generator-star-spacing': 0,

    // Allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,

    // Prefer const over let
    'prefer-const': [2, {
      'destructuring': 'any',
      'ignoreReadBeforeAssign': false
    }],

    // No single if in an "else" block
    'no-lonely-if': 2,

    // Force curly braces for control flow
    curly: 2,

    // No async function without await
    'require-await': 2,

    // Force dot notation when possible
    'dot-notation': 2,

    'no-var': 2,

    // Do not allow console.logs etc...
    'no-console': 2,
    'space-before-function-paren': [2, {
      anonymous: 'always',
      named: 'never'
    }],
    'vue/no-parsing-error': [2, {
      'x-invalid-end-tag': false
    }],
    'vue/max-attributes-per-line': [2, {
      'singleline': 5
    }]
  },
  overrides: [{
    files: [ 'test/fixtures/*/.nuxt*/**' ],
    rules: {
      'import/order': 1,
      'no-multiple-empty-lines': [1, { max: 2, maxEOF: 1 }],
      'no-trailing-spaces': [2, { skipBlankLines: true }],
      'padded-blocks': 1
    }
  }, {
    files: [ 'test/fixtures/*/.nuxt*/**/client.js' ],
    rules: {
      'no-console': [2, { allow: ['error'] }]
    }
  }, {
    files: [ 'test/fixtures/*/.nuxt*/**/router.js' ],
    rules: {
      'no-console': [2, { allow: ['warn'] }]
    }
  }],
  globals: {}
}
