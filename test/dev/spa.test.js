import consola from 'consola'
import { loadFixture, getPort, Nuxt, wChunk } from '../utils'

// Runs tests in specified router mode (either "hash" or "history").
function spaTests ({ isHashMode }) {
  let nuxt, port
  const url = route => `http://localhost:${port}${isHashMode ? '/#' : ''}${route}`

  const renderRoute = async (_url) => {
    const window = await nuxt.server.renderAndGetWindow(url(_url))
    const head = window.document.head.innerHTML
    const html = window.document.body.innerHTML
    return { window, head, html }
  }

  describe(`spa${isHashMode ? ' (hash)' : ''}`, () => {
    beforeAll(async () => {
      const fixture = isHashMode ? 'spa-hash' : 'spa'
      const config = await loadFixture(fixture)
      nuxt = new Nuxt(config)
      await nuxt.ready()

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

    test('/ (include preload and prefetch resources)', async () => {
      const { head } = await renderRoute('/')
      expect(head).toMatch('<link rel="preload" href="/_nuxt/runtime.js" as="script">')
      expect(head).toMatch('<link rel="preload" href="/_nuxt/commons/app.js" as="script">')
      expect(head).toMatch('<link rel="preload" href="/_nuxt/app.js" as="script">')
      expect(head).toMatch(`<link rel="prefetch" href="/_nuxt/${wChunk('pages/custom.js')}">`)
      expect(head).toMatch(`<link rel="prefetch" href="/_nuxt/${wChunk('pages/error-handler-async.js')}">`)
      expect(head).toMatch(`<link rel="prefetch" href="/_nuxt/${wChunk('pages/error-handler-object.js')}">`)
      expect(head).toMatch(`<link rel="prefetch" href="/_nuxt/${wChunk('pages/error-handler-string.js')}">`)
      expect(head).toMatch(`<link rel="prefetch" href="/_nuxt/${wChunk('pages/error-handler.js')}">`)
      expect(head).toMatch(`<link rel="prefetch" href="/_nuxt/${wChunk('pages/index.js')}">`)
      expect(head).toMatch(`<link rel="prefetch" href="/_nuxt/${wChunk('pages/mounted.js')}">`)
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

    test('Initial route has correct fullPath', async () => {
      const { html } = await renderRoute('/route-path')
      expect(html).toContain('<div>Route path: /route-path</div>')
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

    const testRunner = isHashMode ? test.skip : test
    testRunner('/тест雨 (test non ascii route)', async () => {
      const { html } = await renderRoute('/тест雨')
      expect(html).toMatch('Hello unicode SPA!')
      expect(consola.log).not.toHaveBeenCalledWith('created')
      expect(consola.log).toHaveBeenCalledWith('mounted')
      consola.log.mockClear()
    })

    test('/async no asyncData leak', async () => {
      const window = await nuxt.server.renderAndGetWindow(url('/async'))

      const navigate = url => new Promise((resolve, reject) => {
        window.$nuxt.$router.push(url, resolve, reject)
      })

      for (let i = 0; i < 3; i++) {
        await navigate('/')
        await navigate('/async')
      }

      const { $data } = window.$nuxt.$route.matched[0].instances.default
      expect(Object.keys($data).length).toBe(1)
      consola.log.mockClear()
    })

    test('/redirect-done (no redirect)', async () => {
      const { html } = await renderRoute('/redirect-done')
      expect(html).toContain('<div>Redirect Done Page</div>')
      expect(consola.log).toHaveBeenCalledWith('redirect-done created')
      expect(consola.log).toHaveBeenCalledWith('redirect-done mounted')
      expect(consola.log).toHaveBeenCalledTimes(2)
      consola.log.mockClear()
    })

    test('/redirect1 (redirect 1 time)', async () => {
      const { html } = await renderRoute('/redirect1')
      expect(html).toContain('<div>Redirect Done Page</div>')
      expect(consola.log).toHaveBeenCalledWith('redirect-done created')
      expect(consola.log).toHaveBeenCalledWith('redirect-done mounted')
      expect(consola.log).toHaveBeenCalledTimes(2)
      consola.log.mockClear()
    })

    test('/redirect2 (redirect 2 times)', async () => {
      const { html } = await renderRoute('/redirect2')
      expect(html).toContain('<div>Redirect Done Page</div>')
      expect(consola.log).toHaveBeenCalledWith('redirect-done created')
      expect(consola.log).toHaveBeenCalledWith('redirect-done mounted')
      expect(consola.log).toHaveBeenCalledTimes(2)
      consola.log.mockClear()
    })

    test('/redirect10 (redirect 10 times)', async () => {
      const { html } = await renderRoute('/redirect10')
      expect(html).toContain('<div>Redirect Done Page</div>')
      expect(consola.log).toHaveBeenCalledWith('redirect-done created')
      expect(consola.log).toHaveBeenCalledWith('redirect-done mounted')
      expect(consola.log).toHaveBeenCalledTimes(2)
      consola.log.mockClear()
    })

    test('render:route hook does not corrupt the cache', async () => {
      const window1 = await nuxt.server.renderAndGetWindow(url('/'))
      const html1 = window1.document.body.innerHTML
      expect(html1).toContain('extra html from render:route hook')
      expect(html1.match(/render:route/g).length).toBe(1)

      window1.close()

      const window2 = await nuxt.server.renderAndGetWindow(url('/'))
      const html2 = window2.document.body.innerHTML
      expect(html2).toContain('extra html from render:route hook')
      expect(html2.match(/render:route/g).length).toBe(1)

      window2.close()
    })

    // Close server and ask nuxt to stop listening to file changes
    afterAll(async () => {
      await nuxt.close()
    })
  })
}

spaTests({})
spaTests({ isHashMode: true })
