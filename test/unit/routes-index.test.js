import consola from 'consola'
import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('basic ssr', () => {
  beforeAll(async () => {
    const options = loadFixture('routes-index')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
  })

  test('/', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>Custom Route</h1>')).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
