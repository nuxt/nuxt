const skipWords = require('./.spellcheckignore.json')

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
    'jest',
    'spellcheck'
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
      'singleline': 5,
    }],

    // https://github.com/aotaduy/eslint-plugin-spellcheck
    "spellcheck/spell-checker": [1,
      {
        "comments": true,
        "strings": true,
        "identifiers": true,
        "lang": "en_US",
        // yarn `lint | grep -Eio ':\s\w+' | sed 's/: //' | sort | uniq | sed 's/.*/"&",/'`
        "skipWords": skipWords,
        "skipIfMatch": [
          "http://[^s]*",
          "[0-9]+(px|vw|vh|bd|xl)",
          "#[0-9a-f]+"
        ],
        "skipWordIfMatch": [],
        "minLength": 3
      }
    ]
  },

  globals: {}
}
