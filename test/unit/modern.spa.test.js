import chalk from 'chalk'
import consola from 'consola'
import { loadFixture, getPort, Nuxt, rp } from '../utils'

let nuxt, port, options
const url = route => 'http://localhost:' + port + route
const modernInfo = mode => `Modern bundles are detected. Modern mode (${chalk.green.bold(mode)}) is enabled now.`

describe('modern client mode (SPA)', () => {
  beforeAll(async () => {
    options = await loadFixture('modern', { render: { ssr: false } })
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('should detect client modern mode', async () => {
    await nuxt.server.renderAndGetWindow(url('/'))
    expect(consola.info).toHaveBeenCalledWith(modernInfo('client'))
  })

  test('should contain nomodule legacy resources', async () => {
    const response = await rp(url('/'))
    expect(response).toContain('src="/_nuxt/app.js" crossorigin="use-credentials" nomodule')
    expect(response).toContain('src="/_nuxt/commons.app.js" crossorigin="use-credentials" nomodule')
  })

  test('should contain module modern resources', async () => {
    const response = await rp(url('/'))
    expect(response).toContain('<script type="module" src="/_nuxt/modern-app.js" crossorigin="use-credentials"')
    expect(response).toContain('<script type="module" src="/_nuxt/modern-commons.app.js" crossorigin="use-credentials"')
  })

  test.skip('should contain module preload resources', async () => {
    const response = await rp(url('/'))
    expect(response).toContain('<link rel="modulepreload" crossorigin="use-credentials" href="/_nuxt/modern-app.js" as="script">')
    expect(response).toContain('<link rel="modulepreload" crossorigin="use-credentials" href="/_nuxt/modern-commons.app.js" as="script">')
  })

  test('should contain module http2 pushed resources', async () => {
    const { headers: { link } } = await rp(url('/'), { resolveWithFullResponse: true })
    expect(link).toEqual([
      '</_nuxt/modern-runtime.js>; rel=modulepreload; crossorigin=use-credentials; as=script',
      '</_nuxt/modern-commons.app.js>; rel=modulepreload; crossorigin=use-credentials; as=script',
      '</_nuxt/modern-app.js>; rel=modulepreload; crossorigin=use-credentials; as=script'
    ].join(', '))
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
