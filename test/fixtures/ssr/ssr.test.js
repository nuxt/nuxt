const { buildFixture } = require('../../utils/build')

describe.skip.appveyor('cli build', () => {
  buildFixture('ssr')
})
