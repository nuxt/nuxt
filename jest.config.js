module.exports = {
  'testEnvironment': 'node',
  'coverageDirectory': './coverage/',
  'collectCoverage': false,
  'setupTestFrameworkScriptFile': './test/utils/setup',
  'testMatch': [
    '<rootDir>/test/*.test.js'
  ],
  'projects': [
    // {
    //   'displayName': 'Lint',
    //   'runner': 'jest-runner-eslint',
    //   'testMatch': [
    //     '<rootDir>/lib/*.js'
    //   ]
    // },
    {
      'displayName': 'Test'
    }
  ]
}
