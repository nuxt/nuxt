import { getPort, loadFixture, Nuxt } from '../utils'

let port
let nuxt = null

describe('basic ssr', () => {
  beforeAll(async () => {
    const options = await loadFixture('async-config')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('/', async () => {
    expect(nuxt.options.head.title).toBe('Async Config!')
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h1>I am ALIVE!</h1>')
  })
})
