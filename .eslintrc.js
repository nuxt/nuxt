module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module'
  },
  env: {
    browser: true,
    node: true
  },
  extends: [
    'standard',
    'standard-jsx',
    'plugin:import/errors',
    'plugin:import/warnings'
  ],
  // required to lint *.vue files
  plugins: [
    'html'
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
    "import/no-mutable-exports": 2,

    // Allow unresolved imports
    'import/no-unresolved': 0,

    // Allow paren-less arrow functions
    'arrow-parens': 0,

    // Allow async-await
    'generator-star-spacing': 0,

    // Allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,

    // Do not allow console.logs etc...
    'no-console': 2,
    'space-before-function-paren': [
			2,
			{
				anonymous: 'always',
				named: 'never'
			}
		],
  },

  globals: {}
}
