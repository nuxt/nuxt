import consola from 'consola'
import { loadFixture, getPort, Nuxt } from '../utils'

let nuxt, port
const url = route => 'http://localhost:' + port + route

const renderRoute = async (_url) => {
  const window = await nuxt.server.renderAndGetWindow(url(_url))
  const head = window.document.head.innerHTML
  const html = window.document.body.innerHTML
  return { window, head, html }
}

describe('spa', () => {
  beforeAll(async () => {
    const config = await loadFixture('spa')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('/ (basic spa)', async () => {
    const { html } = await renderRoute('/')
    expect(html).toMatch('Hello SPA!')
    expect(consola.log).not.toHaveBeenCalledWith('created')
    expect(consola.log).toHaveBeenCalledWith('mounted')
    consola.log.mockClear()
  })

  test('/custom (custom layout)', async () => {
    const { html } = await renderRoute('/custom')
    expect(html).toMatch('Custom layout')
    expect(consola.log).toHaveBeenCalledWith('created')
    expect(consola.log).toHaveBeenCalledWith('mounted')
    consola.log.mockClear()
  })

  test('/mounted', async () => {
    const { html } = await renderRoute('/mounted')
    expect(html).toMatch('<h1>Test: updated</h1>')
  })

  test('/error-handler', async () => {
    const { html } = await renderRoute('/error-handler')
    expect(html).toMatch('error handler triggered: fetch error!')
  })

  test('/error-handler-object', async () => {
    const { html } = await renderRoute('/error-handler-object')
    expect(html).toMatch('error handler triggered: fetch error!')
  })

  test('/error-handler-string', async () => {
    const { html } = await renderRoute('/error-handler-string')
    expect(html).toMatch('error handler triggered: fetch error!')
  })

  test('/error-handler-async', async () => {
    const { html } = await renderRoute('/error-handler-async')
    expect(html).toMatch('error handler triggered: asyncData error!')
  })

  test('/тест雨 (test non ascii route)', async () => {
    const { html } = await renderRoute('/тест雨')
    expect(html).toMatch('Hello unicode SPA!')
    expect(consola.log).not.toHaveBeenCalledWith('created')
    expect(consola.log).toHaveBeenCalledWith('mounted')
    consola.log.mockClear()
  })
  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
