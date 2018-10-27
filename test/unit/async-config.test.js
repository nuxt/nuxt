import { getPort, loadFixture, Nuxt } from '../utils'

let port
let nuxt = null

describe('basic ssr', () => {
  beforeAll(async () => {
    const options = await loadFixture('async-config')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
  })

  test('/', async () => {
    expect(nuxt.options.head.title).toBe('Async Config!')
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>I am ALIVE!</h1>')).toBe(true)
  })
})
