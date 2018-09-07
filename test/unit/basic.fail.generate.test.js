import { loadFixture, Nuxt, Generator } from '../utils'

describe('basic fail generate', () => {
  test('Fail with routes() which throw an error', async () => {
    const options = await loadFixture('basic', {
      generate: {
        routes() {
          throw new Error('Not today!')
        }
      }
    })

    const nuxt = new Nuxt(options)
    const generator = new Generator(nuxt)

    await generator.generate({ build: false }).catch((e) => {
      expect(e.message).toBe('Not today!')
    })
  })
})
