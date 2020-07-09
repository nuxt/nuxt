import { resolve } from 'path'
import { existsSync } from 'fs'
import jsdom from 'jsdom'
import Glob from 'glob'
import pify from 'pify'
import { getPort, loadFixture, Nuxt, rp } from '../utils'

const glob = pify(Glob)

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('with-config', () => {
  beforeAll(async () => {
    const config = await loadFixture('with-config')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('client source map generated', async () => {
    const jsFiles = await glob(resolve(__dirname, '..', 'fixtures/with-config/.nuxt/dist/client/*.js'))
    for (const file of jsFiles) {
      expect(existsSync(`${file}.map`)).toBe(true)
    }
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h1>I have custom configurations</h1>')
  })

  test('/ (global styles inlined)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/'))
    const html = window.document.head.innerHTML
    expect(html).toContain('.global-css-selector')
  })

  test('/ (preload fonts)', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain(
      '<link rel="preload" href="/test/orion/fonts/roboto.7cf5d7c.woff2" as="font" type="font/woff2" crossorigin'
    )
  })

  test('/ (styleResources styles inlined)', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('.pre-process-selector')
  })

  test('/ (custom app.html)', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<p>Made by Nuxt.js team</p>')
  })

  test('/ (custom build.publicPath)', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<script src="/test/orion/')
  })

  test('/ (custom postcss.config.js)', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('::-moz-placeholder')
  })

  test('/test/ (custom globalName)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/'))
    const html = window.document.body.innerHTML
    expect(html).toContain('id="custom-nuxt-id">')
    expect(html.includes('id="__nuxt">')).toBe(false)
    expect(window.__NOXXT__).toBeDefined()
    expect(window.__NUXT__).toBeUndefined()
    expect(window.$noxxt).toBeDefined()
    expect(window.$nuxt).toBeDefined() // for Vue Dev Tools detection
  })

  test('/test/ (router base)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/'))

    const html = window.document.body.innerHTML
    expect(window.__NOXXT__.layout).toBe('default')
    expect(html).toContain('<h1>Default layout</h1>')
    expect(html).toContain('<h1>I have custom configurations</h1>')

    expect(window.__test_plugin).toBe(true)
    expect(window.__test_plugin_ext).toBe(true)
    expect(window.__test_plugin_client).toBe('test_plugin_client')
    expect(window.__test_plugin_server).toBeUndefined()
  })

  test('/test/about (custom layout)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/about'))
    const html = window.document.body.innerHTML
    expect(window.__NOXXT__.layout).toBe('custom')
    expect(html).toContain('<h1>Custom layout</h1>')
    expect(html).toContain('<h1>About page</h1>')
  })

  test('/test/desktop (custom layout in desktop folder)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/desktop'))
    const html = window.document.body.innerHTML
    expect(window.__NOXXT__.layout).toBe('desktop/default')
    expect(html).toContain('<h1>Default desktop layout</h1>')
    expect(html).toContain('<h1>Desktop page</h1>')
  })

  test('/test/mobile (custom layout in mobile folder)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/mobile'))
    const html = window.document.body.innerHTML
    expect(window.__NOXXT__.layout).toBe('mobile/default')
    expect(html).toContain('<h1>Default mobile layout</h1>')
    expect(html).toContain('<h1>Mobile page</h1>')
  })

  test('/test/env', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/env'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>Custom env layout</h1>')
    expect(html).toContain('"bool": true')
    expect(html).toContain('"num": 23')
    expect(html).toContain('"string": "Nuxt.js"')
    expect(html).toContain('"bool": false')
    expect(html).toContain('"string": "ok"')
    expect(html).toContain('"num2": 8.23')
    expect(html).toContain('"obj": {')
    expect(html).toContain('"NUXT_ENV_FOO": "manniL"')
  })

  test('/test/error', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/error'))
    const html = window.document.body.innerHTML
    expect(html).toContain('Error page')
  })

  test('/test/user-agent', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/user-agent'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<pre>Mozilla')
  })

  test('/test/about-bis (added with extendRoutes)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/about-bis'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>Custom layout</h1>')
    expect(html).toContain('<h1>About page</h1>')
    expect(html).toContain('<h2>test-meta</h2>')
  })

  test('/test/not-existed should return 404', async () => {
    await expect(rp(url('/test/not-existed')))
      .rejects.toMatchObject({ response: { statusCode: 404 } })
  })

  test('/test/redirect/about-bis (redirect with extendRoutes)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/redirect/about-bis'))
    const windowHref = window.location.href
    expect(windowHref).toContain('/test/about-bis')

    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>Custom layout</h1>')
    expect(html).toContain('<h1>About page</h1>')
  })

  test('Check /test/test.txt with custom serve-static options', async () => {
    const { headers } = await rp(url('/test/test.txt'))
    expect(headers['cache-control']).toBe('public, max-age=31536000')
  })

  test('Check /test.txt should return 404', async () => {
    await expect(rp(url('/test.txt')))
      .rejects.toMatchObject({ response: { statusCode: 404 } })
  })

  test('/test/head', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/test/head'))
    const html = window.document.querySelector('head').innerHTML
    expect(html).toContain('<noscript data-n-head="test-ssr-app-id">noscript</noscript>')
  })

  test('should ignore files in .nuxtignore', async () => {
    await expect(rp(url('/test-ignore')))
      .rejects.toMatchObject({ response: { statusCode: 404 } })
  })

  test('renderAndGetWindow options', async () => {
    const fakeErrorLog = jest.fn()
    const mockOptions = {
      beforeParse: jest.fn((window) => {
        // Mock window.scrollTo
        window.scrollTo = () => {}
        window._virtualConsole.emit('jsdomError', new Error('test'))
      }),
      virtualConsole: new jsdom.VirtualConsole().sendTo({ error: fakeErrorLog })
    }
    try {
      await nuxt.server.renderAndGetWindow(url('/test/error'), mockOptions)
    } catch (e) {}
    expect(mockOptions.beforeParse).toHaveBeenCalled()
    expect(fakeErrorLog).toHaveBeenCalled()
  })

  test('/ with Server-Timing header', async () => {
    const { headers } = await rp(url('/test'))
    expect(headers['server-timing']).toMatch(/total;dur=\d+(\.\d+)?;desc="Nuxt Server Time"/)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})

describe('server config', () => {
  test('opens on port defined in server.port', async () => {
    const config = await loadFixture('with-config')
    config.server.port = port = await getPort()
    nuxt = new Nuxt(config)
    await nuxt.ready()

    await nuxt.server.listen()
    await nuxt.server.renderAndGetWindow(url('/test/'))
  })
  afterAll(async () => {
    await nuxt.close()
  })
})
