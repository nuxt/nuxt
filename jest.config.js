module.exports = {
  testEnvironment: 'node',
  transform: {
    '\\.[jt]sx?$': './scripts/jest-transform.mjs'
  },
  testPathIgnorePatterns: [
    '.output/.*'
  ]
}
