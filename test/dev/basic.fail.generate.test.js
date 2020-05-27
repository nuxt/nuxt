import { loadFixture, Nuxt, Builder, Generator } from '../utils'

describe('basic fail generate', () => {
  test('Fail with routes() which throw an error', async () => {
    const options = await loadFixture('basic', {
      generate: {
        routes () {
          throw new Error('Not today!')
        }
      }
    })
    const nuxt = new Nuxt(options)
    await nuxt.ready()

    const builder = new Builder(nuxt)
    builder.build = jest.fn()
    const generator = new Generator(nuxt, builder)

    await generator.generate().catch((e) => {
      expect(e.message).toBe('Not today!')
    })
  })

  test('Fail when generate.dir equals rootDir', async () => {
    const options = await loadFixture('basic', {
      generate: { dir: '../basic' }
    })

    expect(() => {
      new Nuxt(options) /* eslint-disable-line no-new */
    }).toThrow(/options.generate.dir cannot be/)
  })
})
