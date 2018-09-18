import { getPort, loadFixture, Nuxt } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('with-config', () => {
  beforeAll(async () => {
    const config = await loadFixture('basic')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('/', async () => {
    const window = await nuxt.renderAndGetWindow(url('/'))
    expect(window.__test_plugin).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
