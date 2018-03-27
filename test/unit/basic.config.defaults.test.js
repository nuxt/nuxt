const { resolve } = require('path')
const { Nuxt, Options, version } = require('../utils')

describe('basic config defaults', () => {
  test('Nuxt.version is same as package', () => {
    expect(Nuxt.version).toBe(version)
  })

  test('modulesDir uses /node_modules as default if not set', async () => {
    const options = Options.from({})
    const currentNodeModulesDir = resolve(__dirname, '..', '..', 'node_modules')
    expect(options.modulesDir.includes(currentNodeModulesDir)).toBe(true)
  })
})
