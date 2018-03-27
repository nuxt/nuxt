import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('with-config', () => {
  beforeAll(async () => {
    const config = loadFixture('with-config')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('/', async () => {
    // const logSpy = await interceptLog()
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>I have custom configurations</h1>')).toBe(true)
    // release()
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
  })

  test('/ (global styles inlined)', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('.global-css-selector')).toBe(true)
  })

  test.skip('/ (preload fonts)', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes(
      '<link rel="preload" href="/test/orion/fonts/roboto.7cf5d7c.woff2" as="font" type="font/woff2" crossorigin'
    )).toBe(true)
  })

  test('/ (custom app.html)', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<p>Made by Nuxt.js team</p>')).toBe(true)
  })

  test('/ (custom build.publicPath)', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<script src="/test/orion/')).toBe(true)
  })

  test('/ (custom postcss.config.js)', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('::-webkit-input-placeholder')).toBe(true)
  })

  test('/test/ (router base)', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/test/'))

    const html = window.document.body.innerHTML
    expect(window.__NUXT__.layout).toBe('default')
    expect(html.includes('<h1>Default layout</h1>')).toBe(true)
    expect(html.includes('<h1>I have custom configurations</h1>')).toBe(true)
    // release()
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
  })

  test('/test/about (custom layout)', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/test/about'))
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
    // release()

    const html = window.document.body.innerHTML
    expect(window.__NUXT__.layout).toBe('custom')
    expect(html.includes('<h1>Custom layout</h1>')).toBe(true)
    expect(html.includes('<h1>About page</h1>')).toBe(true)
  })

  test('/test/desktop (custom layout in desktop folder)', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/test/desktop'))
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
    // release()

    const html = window.document.body.innerHTML
    expect(window.__NUXT__.layout).toBe('desktop/default')
    expect(html.includes('<h1>Default desktop layout</h1>')).toBe(true)
    expect(html.includes('<h1>Desktop page</h1>')).toBe(true)
  })

  test('/test/mobile (custom layout in mobile folder)', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/test/mobile'))
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
    // release()

    const html = window.document.body.innerHTML
    expect(window.__NUXT__.layout).toBe('mobile/default')
    expect(html.includes('<h1>Default mobile layout</h1>')).toBe(true)
    expect(html.includes('<h1>Mobile page</h1>')).toBe(true)
  })

  test('/test/env', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/test/env'))
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
    // release()

    const html = window.document.body.innerHTML
    expect(html.includes('<h1>Custom env layout</h1>')).toBe(true)
    expect(html.includes('"bool": true')).toBe(true)
    expect(html.includes('"num": 23')).toBe(true)
    expect(html.includes('"string": "Nuxt.js"')).toBe(true)
    expect(html.includes('"bool": false')).toBe(true)
    expect(html.includes('"string": "ok"')).toBe(true)
    expect(html.includes('"num2": 8.23')).toBe(true)
    expect(html.includes('"obj": {')).toBe(true)
  })

  test('/test/error', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/test/error'))
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
    // release()

    const html = window.document.body.innerHTML
    expect(html.includes('Error page')).toBe(true)
  })

  test('/test/user-agent', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/test/user-agent'))
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
    // release()

    const html = window.document.body.innerHTML
    expect(html.includes('<pre>Mozilla')).toBe(true)
  })

  test('/test/about-bis (added with extendRoutes)', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/test/about-bis'))
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
    // release()

    const html = window.document.body.innerHTML
    expect(html.includes('<h1>Custom layout</h1>')).toBe(true)
    expect(html.includes('<h1>About page</h1>')).toBe(true)
  })

  test('/test/redirect/about-bis (redirect with extendRoutes)', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/test/redirect/about-bis'))
    // expect(logSpy.calledOnce).toBe(true)
    // expect(logSpy.args[0][0]).toBe('Test plugin!')
    // release()

    const windowHref = window.location.href
    expect(windowHref.includes('/test/about-bis')).toBe(true)

    const html = window.document.body.innerHTML
    expect(html.includes('<h1>Custom layout</h1>')).toBe(true)
    expect(html.includes('<h1>About page</h1>')).toBe(true)
  })

  test('Check /test/test.txt with custom serve-static options', async () => {
    const { headers } = await rp(url('/test/test.txt'), {
      resolveWithFullResponse: true
    })
    expect(headers['cache-control']).toBe('public, max-age=31536000')
  })

  test('Check /test.txt should return 404', async () => {
    await expect(rp(url('/test.txt')))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
