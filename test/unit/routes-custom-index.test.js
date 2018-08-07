import { loadFixture, getPort, Nuxt } from '../utils'

let port
let nuxt = null

describe('pick up custom router index', () => {
  beforeAll(async () => {
    const options = loadFixture('routes-custom-index')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
  })

  test('/ (custom router index)', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>Custom Page Route</h1>')).toBe(true)
    await nuxt.close()
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
