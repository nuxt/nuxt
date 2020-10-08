import { loadFixture, getPort, Nuxt } from '../utils'

let port

let nuxt = null

describe('shared context ssr', () => {
  beforeAll(async () => {
    const options = await loadFixture('context')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('does not share state', async () => {
    const [page1, page2] = await Promise.all([
      nuxt.server.renderRoute('/about'),
      nuxt.server.renderRoute('/about/another')
    ])

    expect(page1.html).toContain('vm: /about')
    expect(page1.html).toContain('context: /about')

    expect(page2.html).toContain('vm: /about/another')
    expect(page2.html).toContain('context: /about/another')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
