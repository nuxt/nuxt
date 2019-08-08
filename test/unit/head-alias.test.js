import { loadFixture, getPort, Nuxt } from '../utils'

let nuxt = null

describe('head-alias', () => {
  beforeAll(async () => {
    const options = await loadFixture('head-alias')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    await nuxt.server.listen(await getPort(), '0.0.0.0')
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<link data-n-head="ssr" rel="icon" type="image/png" href="/_nuxt/favicon.png">')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
