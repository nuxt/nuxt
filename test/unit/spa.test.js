import { loadFixture, getPort, Nuxt } from '../utils'

let nuxt = null

let port
const url = route => 'http://localhost:' + port + route

const renderRoute = async _url => {
  const window = await nuxt.renderAndGetWindow(url(_url))
  const head = window.document.head.innerHTML
  const html = window.document.body.innerHTML
  return { window, head, html }
}

describe.skip('spa', () => {
  beforeAll(async () => {
    const config = loadFixture('spa')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('/ (basic spa)', async () => {
    // const logSpy = await interceptLog()
    const { html } = await renderRoute('/')
    expect(html.includes('Hello SPA!')).toBe(true)
    // release()
    // expect(logSpy.withArgs('created').notCalled).toBe(true)
    // expect(logSpy.withArgs('mounted').calledOnce).toBe(true)
  })

  test('/custom (custom layout)', async () => {
    // const logSpy = await interceptLog()
    const { html } = await renderRoute('/custom')
    expect(html.includes('Custom layout')).toBe(true)
    // release()
    // expect(logSpy.withArgs('created').calledOnce).toBe(true)
    // expect(logSpy.withArgs('mounted').calledOnce).toBe(true)
  })

  test('/custom (not default layout)', async () => {
    // const logSpy = await interceptLog()
    const { head } = await renderRoute('/custom')
    expect(head.includes('src="/_nuxt/layouts/default.')).toBe(false)
    // release()
    // expect(logSpy.withArgs('created').calledOnce).toBe(true)
    // expect(logSpy.withArgs('mounted').calledOnce).toBe(true)
  })

  test('/custom (call mounted and created once)', async () => {
    // const logSpy = await interceptLog()
    await renderRoute('/custom')
    // release()
    // expect(logSpy.withArgs('created').calledOnce).toBe(true)
    // expect(logSpy.withArgs('mounted').calledOnce).toBe(true)
  })

  test('/mounted', async () => {
    const { html } = await renderRoute('/mounted')

    expect(html.includes('<h1>Test: updated</h1>')).toBe(true)
  })

  test('/_nuxt/ (access publicPath in spa mode)', async () => {
    await expect(renderRoute('/_nuxt/')).rejects.toMatchObject({
      response: {
        statusCode: 404,
        statusMessage: 'ResourceNotFound'
      }
    })
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
