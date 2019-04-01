import { getPort, loadFixture, Nuxt } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('unicode-base', () => {
  beforeAll(async () => {
    const config = await loadFixture('unicode-base')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('/ö/ (router base)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/ö/'))

    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>Unicode base works!</h1>')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
