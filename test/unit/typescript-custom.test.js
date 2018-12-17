import { loadFixture, getPort, Nuxt } from '../utils'

let nuxt = null

describe('typescript-custom', () => {
  beforeAll(async () => {
    const options = await loadFixture('typescript-custom')
    nuxt = new Nuxt(options)
    const port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<div>Index Page</div>')
  })

  test('/about', async () => {
    const { html } = await nuxt.server.renderRoute('/about')
    expect(html).toContain('<div>About Page</div>')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
