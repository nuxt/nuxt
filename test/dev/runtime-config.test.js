import { loadFixture, getPort, Nuxt } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('basic ssr', () => {
  beforeAll(async () => {
    const options = await loadFixture('runtime-config')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('SSR payload', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/'))
    const payload = window.__NUXT__

    expect(payload.config).toMatchObject({
      baseURL: '/api'
    })

    expect(payload.data[0].serverConfig).toMatchObject({
      baseURL: 'https://google.com/api',
      API_SECRET: 1234
    })
  })

  test('SPA payload ', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/?spa'))
    const payload = window.__NUXT__

    expect(payload.config).toMatchObject({
      baseURL: '/api'
    })
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
