import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('dist options', () => {
  beforeAll(async () => {
    const options = await loadFixture('basic')
    nuxt = new Nuxt(Object.assign(options, { dev: false }))
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('Specify maxAge/index in render.dist options', async () => {
    const { body } = await rp(url('/'))
    try {
      await rp(url('/_nuxt/'))
    } catch (err) {
      expect(err.toString().includes('StatusCodeError'))
    }
    const distFile = body.match(/\/_nuxt\/.+?\.js/)[0]
    const { headers } = await rp(url(distFile))
    const twoYears = (((60 * 60 * 24 * 365) * 2) / 1000).toString()
    expect(headers['cache-control']).toContain(twoYears)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
