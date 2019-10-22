import { loadFixture, Nuxt, Generator } from '../utils'

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

    const generator = new Generator(nuxt)

    await generator.generate({ build: false }).catch((e) => {
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
