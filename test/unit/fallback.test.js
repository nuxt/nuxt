import { getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('fallback', () => {
  beforeAll(async () => {
    const config = await loadFixture('with-config')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('robots.txt handled', async () => {
    await expect(rp(url('/test/robots.txt')))
      .rejects.toMatchObject({
        statusCode: 404,
        response: { body: '' }
      })
  })

  test('normal html routes should be rendered using SSR', async () => {
    await expect(rp(url('/test/index.html')))
      .rejects.toMatchObject({
        statusCode: 404,
        response: { body: expect.stringContaining('data-n-head-ssr') }
      })
  })

  test('uknown assets handled in dist', async () => {
    await expect(rp(url('/test/orion/foo.xyz')))
      .rejects.toMatchObject({
        statusCode: 404,
        response: { body: '' }
      })
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
