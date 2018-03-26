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
      const config = loadFixture(fixture, {
        test: true,
        minimalCLI: true,
        build: {
          stats: false
        }
      })
      const nuxt = new Nuxt(config)
      const buildDone = jest.fn()
      nuxt.hook('build:done', buildDone)
      const builder = await new Builder(nuxt).build()
      // 2: BUILD_DONE
      expect(builder._buildStatus).toBe(2)
      expect(buildDone).toHaveBeenCalledTimes(1)
    })
  }

  for (const fixture of fixtures) {
    build(fixture)
  }
})
