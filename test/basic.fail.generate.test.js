import { resolve } from 'path'

import { Nuxt, Builder, Generator } from '..'

describe('basic fail generate', () => {
  test('Fail with routes() which throw an error', async () => {
    const options = {
      rootDir: resolve(__dirname, 'fixtures/basic'),
      buildDir: '.nuxt-fail',
      dev: false,
      build: {
        stats: false
      },
      generate: {
        async routes() {
          throw new Error('Not today!')
        }
      }
    }
    const nuxt = new Nuxt(options)
    const builder = new Builder(nuxt)
    const generator = new Generator(nuxt, builder)

    await generator.generate().catch(e => {
      expect(e.message === 'Not today!').toBe(true)
    })
  }, 30000)
})
