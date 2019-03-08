import { loadFixture, getPort, Nuxt } from '../utils'

let nuxt = null

describe('basic https', () => {
  beforeAll(async () => {
    const options = await loadFixture('https')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    const port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h1>Served over HTTPS!</h1>')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
