import { getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + encodeURI(route)

let nuxt = null

describe('unicode', () => {
  beforeAll(async () => {
    const config = await loadFixture('unicode')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('/ö/ (router base)', async () => {
    const { body: response } = await rp(url('/ö/'))

    expect(response).toContain('Unicode base works!')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
