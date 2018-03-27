const { loadFixture, Nuxt, Generator } = require('../utils')

describe('basic fail generate', () => {
  test('Fail with routes() which throw an error', async () => {
    const options = loadFixture('basic', {
      generate: {
        async routes() {
          throw new Error('Not today!')
        }
      }
    })

    const nuxt = new Nuxt(options)
    const generator = new Generator(nuxt)

    await generator.generate({ build: false }).catch(e => {
      expect(e.message).toBe('Not today!')
    })
  })
})
