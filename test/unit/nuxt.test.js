import { resolve } from 'path'
import { loadFixture, getPort, Nuxt, Builder } from '../utils'

describe('nuxt', () => {
  test('Nuxt.js Class', () => {
    expect(typeof Nuxt).toBe('function')
  })

  test('Nuxt.js Instance', async () => {
    const config = await loadFixture('empty')
    const nuxt = new Nuxt(config)
    await nuxt.ready()

    expect(typeof nuxt).toBe('object')
    expect(nuxt.options.dev).toBe(false)
    expect(typeof nuxt._ready.then).toBe('function')
    expect(nuxt._initCalled).toBe(true)
  })

  test('Fail to build when no pages/ directory but is in the parent', async () => {
    const config = await loadFixture('empty')
    const nuxt = new Nuxt({
      ...config,
      rootDir: resolve(__dirname, '..', 'fixtures', 'empty', 'pages')
    })

    try {
      await new Builder(nuxt).build()
    } catch (err) {
      expect(err.message).toContain('No `pages` directory found')
      expect(err.message).toContain('Did you mean to run `nuxt` in the parent (`../`) directory?')
    }
    expect.hasAssertions()
  })

  test('Build with default page when no pages/ directory', async () => {
    const config = await loadFixture('missing-pages-dir')
    const nuxt = new Nuxt(config)
    await nuxt.ready()

    const port = await getPort()
    await nuxt.server.listen(port, 'localhost')

    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h2 class="Landscape__Title">')
    expect(/Landscape__Page__Explanation/.test(html)).toBe(true)

    await nuxt.close()
  })

  test('Fail to build when specified plugin isn\'t found', async () => {
    const config = await loadFixture('missing-plugin')
    const nuxt = new Nuxt(config)
    await nuxt.ready()

    await expect(new Builder(nuxt).build()).rejects.toThrow('Plugin not found')
  })

  test('Warn when styleResource isn\'t found', async () => {
    const config = await loadFixture('missing-style-resource')
    const nuxt = new Nuxt(config)
    await nuxt.ready()

    await expect(new Builder(nuxt).build()).rejects.toThrow('Style Resource not found')
  })
})
