import { getPort, loadFixture, Nuxt } from '../utils'

let port
let nuxt = null

describe('custom-app-template', () => {
  beforeAll(async () => {
    const options = await loadFixture('custom-app-template')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })
  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<p>My Template</p>')
    expect(html).toContain('<h1>Custom!</h1>')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
