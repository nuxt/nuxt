import { getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + encodeURI(route)

let nuxt = null

describe('encoding', () => {
  beforeAll(async () => {
    const config = await loadFixture('encoding')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('/ö/ (router base)', async () => {
    const { body: response } = await rp(url('/ö/'))

    expect(response).toContain('Unicode base works!')
  })

  test('/ö/dynamic?q=food,coffee (encodeURIComponent)', async () => {
    const { body: response } = await rp(url('/ö/dynamic?q=food%252Ccoffee'))

    expect(response).toContain('food,coffee')
  })

  test('/ö/@about', async () => {
    const { body: response } = await rp(url('/ö/@about'))

    expect(response).toContain('About')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
