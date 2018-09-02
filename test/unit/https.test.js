import { loadFixture, getPort, Nuxt } from '../utils'

let nuxt = null

describe('basic https', () => {
  beforeAll(async () => {
    const options = await loadFixture('https')
    nuxt = new Nuxt(options)
    const port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
  })

  test('/', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>Served over HTTPS!</h1>')).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
