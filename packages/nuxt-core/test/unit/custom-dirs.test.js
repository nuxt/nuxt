import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('custom-dirs', () => {
  beforeAll(async () => {
    const config = await loadFixture('custom-dirs')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test.skip('custom assets directory', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html).toContain('.global-css-selector')
  })

  test('custom layouts directory', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<p>I have custom layouts directory</p>')).toBe(true)
  })

  test('custom middleware directory', async () => {
    const window = await nuxt.renderAndGetWindow(url('/user-agent'))
    const html = window.document.body.innerHTML
    expect(html.includes('<pre>Mozilla')).toBe(true)
  })

  test('custom pages directory', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>I have custom pages directory</h1>')).toBe(true)
  })

  test('custom static directory', async () => {
    const { headers } = await rp(url('/test.txt'), {
      resolveWithFullResponse: true
    })
    expect(headers['cache-control']).toBe('public, max-age=0')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
