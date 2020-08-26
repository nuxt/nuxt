import { loadFixture, getPort, Nuxt, rp } from '../utils'

let nuxt, port
const url = route => 'http://localhost:' + port + route

describe('modern client mode (SSR)', () => {
  beforeAll(async () => {
    const options = await loadFixture('modern', { modern: 'client' })
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('should contain nomodule legacy resources', async () => {
    const { body: response } = await rp(url('/'))
    expect(response).toContain('script nomodule crossorigin="use-credentials" src="/_nuxt/app.js')
    expect(response).toContain('script nomodule crossorigin="use-credentials" src="/_nuxt/vendors/commons.js')
  })

  test('should contain module modern resources', async () => {
    const { body: response } = await rp(url('/'))
    expect(response).toContain('<script type="module" crossorigin="use-credentials" src="/_nuxt/app.modern.js"')
    expect(response).toContain('<script type="module" crossorigin="use-credentials" src="/_nuxt/vendors/commons.modern.js"')
  })

  test('should contain module preload resources', async () => {
    const { body: response } = await rp(url('/'))
    expect(response).toContain('<link rel="modulepreload" crossorigin="use-credentials" href="/_nuxt/app.modern.js" as="script">')
    expect(response).toContain('<link rel="modulepreload" crossorigin="use-credentials" href="/_nuxt/vendors/commons.modern.js" as="script">')
  })

  test('should contain module http2 pushed resources', async () => {
    const { headers: { link } } = await rp(url('/'))
    expect(link).toEqual([
      '</_nuxt/runtime.modern.js>; rel=modulepreload; crossorigin=use-credentials; as=script',
      '</_nuxt/vendors/commons.modern.js>; rel=modulepreload; crossorigin=use-credentials; as=script',
      '</_nuxt/app.modern.js>; rel=modulepreload; crossorigin=use-credentials; as=script',
      `</_nuxt/pages/index.modern.js>; rel=modulepreload; crossorigin=use-credentials; as=script`
    ].join(', '))
  })

  test('should contain safari fix script', async () => {
    const { body: response } = await rp(url('/'))
    expect(response).toContain('"noModule"')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
