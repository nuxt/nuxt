import { Nuxt, Builder } from '..'
import { loadConfig } from './helpers/config'

let nuxt = null

const port = 4012
const url = route => 'http://localhost:' + port + route

describe('spa', () => {
  const renderRoute = async _url => {
    const window = await nuxt.renderAndGetWindow(url(_url))
    const head = window.document.head.innerHTML
    const html = window.document.body.innerHTML
    return { window, head, html }
  }

  // Init nuxt.js and create server listening on localhost:4000
  beforeAll(async () => {
    const config = loadConfig('spa')

    nuxt = new Nuxt(config)
    new Builder(nuxt).build()
    await nuxt.listen(port, 'localhost')
  }, 30000)

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
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
