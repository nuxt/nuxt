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

  test('Fails when generate.dir lower then root dir', async () => {
    const options = await loadFixture('basic', {
      generate: { dir: '.' }
    })

    expect(() => {
      new Nuxt(options) /* eslint-disable-line no-new */
    }).toThrow(
      'options.generate.dir cannot be a parent of or same as rootDir'
    )
  })

  test('generate.dir can be on same level as root', async () => {
    const options = await loadFixture('basic', {
      generate: { dir: '../basic-dist' }
    })

    expect(() => {
      new Nuxt(options) /* eslint-disable-line no-new */
    }).not.toThrow(
      'options.generate.dir cannot be a parent of or same as rootDir'
    )
  })
})
