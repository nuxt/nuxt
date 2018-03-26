import { Nuxt, Builder } from '../../'
import { loadFixture } from '../utils'

const fixtures = [
  'children',
  'custom-dirs',
  'debug',
  'deprecate',
  'dynamic-routes',
  'empty',
  'error',
  'module',
  'ssr',
  'with-config',
  'basic'
]

describe('build fixtures', () => {
  function build(fixture) {
    test.concurrent(`building ${fixture}`, async () => {
      const config = loadFixture(fixture)
      config.test = true
      config.minimalCLI = true
      if (!config.build) {
        config.build = {}
      }
      config.build.stats = 'errors-only'
      const nuxt = new Nuxt(config)
      await new Builder(nuxt).build()
    })
  }

  for (const fixture of fixtures) {
    build(fixture)
  }
})
