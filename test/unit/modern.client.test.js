import { loadFixture, getPort, Nuxt, rp } from '../utils'

let nuxt, port
const url = route => 'http://localhost:' + port + route

describe('modern client mode', () => {
  beforeAll(async () => {
    const options = await loadFixture('modern', { modern: 'client' })
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('should contain nomodule legacy resources', async () => {
    const response = await rp(url('/'))
    expect(response).toContain('script nomodule src="/_nuxt/app.js')
    expect(response).toContain('script nomodule src="/_nuxt/commons.app.js')
  })

  test('should contain module modern resources', async () => {
    const response = await rp(url('/'))
    expect(response).toContain('<script type="module" src="/_nuxt/modern-app.js"')
    expect(response).toContain('<script type="module" src="/_nuxt/modern-commons.app.js"')
  })

  test('should contain module preload resources', async () => {
    const response = await rp(url('/'))
    expect(response).toContain('<link rel="modulepreload" href="/_nuxt/modern-app.js" as="script">')
    expect(response).toContain('<link rel="modulepreload" href="/_nuxt/modern-commons.app.js" as="script">')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
