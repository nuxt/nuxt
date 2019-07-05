import consola from 'consola'
import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('basic ssr', () => {
  beforeAll(async () => {
    const options = await loadFixture('basic')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('/stateless', async () => {
    const { html } = await nuxt.server.renderRoute('/stateless')
    expect(html).toContain('<h1>My component!</h1>')
  })

  test('/store-module', async () => {
    const { html } = await nuxt.server.renderRoute('/store-module')
    expect(html).toContain('<h1>mutated</h1>')
  })

  /*
  ** Example of testing via dom checking
  */
  test('/css', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/css'))

    const headHtml = window.document.head.innerHTML
    expect(headHtml).toContain('color:red')

    const element = window.document.querySelector('.red')
    expect(element).not.toBe(null)
    expect(element.textContent).toContain('This is red')
    expect(element.className).toBe('red')
    // t.is(window.getComputedStyle(element).color, 'red')
  })

  test('/postcss', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/css'))

    const headHtml = window.document.head.innerHTML
    expect(headHtml).toContain('color:red')

    const element = window.document.querySelector('.red')
    expect(element).not.toBe(null)
    expect(element.textContent).toContain('This is red')
    expect(element.className).toBe('red')
    // t.is(window.getComputedStyle(element).color, 'red')
  })

  test('/postcss', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/css'))

    const headHtml = window.document.head.innerHTML
    expect(headHtml).toContain('background-color:#00f')

    // const element = window.document.querySelector('div.red')
    // t.is(window.getComputedStyle(element)['background-color'], 'blue')
  })

  test('/stateful', async () => {
    const { html } = await nuxt.server.renderRoute('/stateful')
    expect(html).toContain('<div><p>The answer is 42</p></div>')
  })

  test('/store', async () => {
    const { html } = await nuxt.server.renderRoute('/store')
    expect(html).toContain('<h1>foo/bar/baz: Vuex Nested Modules</h1>')
    expect(html).toContain('<h2>index/counter: 1</h2>')
    expect(html).toContain('<h3>foo/blarg/getVal: 4</h3>')
    expect(html).toContain('<h4>foo/bab/getBabVal: 10</h4>')
  })

  test('/head', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/head'))
    expect(window.document.title).toBe('My title - Nuxt.js')

    const html = window.document.body.innerHTML
    expect(html).toContain('<div><h1>I can haz meta tags</h1></div>')
    expect(html).toContain('<script data-n-head="ssr" src="/body.js" data-body="true">')

    const metas = window.document.getElementsByTagName('meta')
    expect(metas[0].getAttribute('content')).toBe('my meta')
    expect(consola.log).toHaveBeenCalledWith('Body script!')
  })

  test('/async-data', async () => {
    const { html } = await nuxt.server.renderRoute('/async-data')
    expect(html).toContain('<p>Nuxt.js</p>')
  })

  test('/await-async-data', async () => {
    const { html } = await nuxt.server.renderRoute('/await-async-data')
    expect(html).toContain('<p>Await Nuxt.js</p>')
  })

  test('/callback-async-data', async () => {
    const { html } = await nuxt.server.renderRoute('/callback-async-data')
    expect(html).toContain('<p>Callback Nuxt.js</p>')
  })

  test('/users/1', async () => {
    const { html } = await nuxt.server.renderRoute('/users/1')
    expect(html).toContain('<h1>User: 1</h1>')
  })

  test('/validate should display a 404', async () => {
    const { html } = await nuxt.server.renderRoute('/validate')
    expect(html).toContain('This page could not be found')
  })

  test('/validate-async should display a 404', async () => {
    const { html } = await nuxt.server.renderRoute('/validate-async')
    expect(html).toContain('This page could not be found')
  })

  test('/validate?valid=true', async () => {
    const { html } = await nuxt.server.renderRoute('/validate?valid=true')
    expect(html).toContain('<h1>I am valid</h1>')
  })

  test('/validate-async?valid=true', async () => {
    const { html } = await nuxt.server.renderRoute('/validate-async?valid=true')
    expect(html).toContain('<h1>I am valid</h1>')
  })

  test('/validate?error=403', async () => {
    const { html, error } = await nuxt.server.renderRoute('/validate?error=403')
    expect(error).toMatchObject({ statusCode: 403, message: 'Custom Error' })
    expect(html).toContain('Custom Error')
  })

  test('/validate-async?error=503', async () => {
    const { html, error } = await nuxt.server.renderRoute('/validate-async?error=503')
    expect(error).toMatchObject({ statusCode: 503, message: 'Custom Error' })
    expect(html).toContain('Custom Error')
  })

  test('/before-enter', async () => {
    const { html } = await nuxt.server.renderRoute('/before-enter')
    expect(html).toContain('<h1>Index page</h1>')
  })

  test('/redirect', async () => {
    const { html, redirected } = await nuxt.server.renderRoute('/redirect')
    expect(html).toContain('<div id="__nuxt"></div>')
    expect(redirected.path === '/').toBe(true)
    expect(redirected.status === 302).toBe(true)
  })

  test('/redirect -> check redirected source', async () => {
    // there are no transition properties in jsdom, ignore the error log
    const window = await nuxt.server.renderAndGetWindow(url('/redirect'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>Index page</h1>')
  })

  test('/redirect -> external link', async () => {
    let _headers, _status
    const { html } = await nuxt.server.renderRoute('/redirect-external', {
      res: {
        writeHead(status, headers) {
          _status = status
          _headers = headers
        },
        end() { }
      }
    })
    expect(_status).toBe(302)
    expect(_headers.Location).toBe('https://nuxtjs.org')
    expect(html).toContain('<div data-server-rendered="true"></div>')
  })

  test('/special-state -> check window.__NUXT__.test = true', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/special-state'))
    expect(window.document.title).toBe('Nuxt.js')
    expect(window.__NUXT__.test).toBe(true)
  })

  test('/error', async () => {
    await expect(nuxt.server.renderRoute('/error', { req: {}, res: {} }))
      .rejects.toThrow('Error mouahahah')
  })

  test('/error-string', async () => {
    let error
    try {
      await nuxt.server.renderRoute('/error-string', { req: {}, res: {} })
    } catch (e) {
      error = e
    }
    await expect(error).toEqual('fetch error!')
  })

  test('/error-object', async () => {
    let error
    try {
      await nuxt.server.renderRoute('/error-object', { req: {}, res: {} })
    } catch (e) {
      error = e
    }
    await expect(error).toEqual({ error: 'fetch error!' })
  })

  test('/error status code', async () => {
    await expect(rp(url('/error'))).rejects.toMatchObject({
      statusCode: 500
    })
  })

  test('/error json format error', async () => {
    const opts = {
      headers: {
        accept: 'application/json'
      },
      resolveWithFullResponse: true
    }
    await expect(rp(url('/error'), opts)).rejects.toMatchObject({
      statusCode: 500,
      response: {
        headers: {
          'content-type': 'text/json; charset=utf-8'
        }
      }
    })
  })

  test('/error2', async () => {
    const { html, error } = await nuxt.server.renderRoute('/error2')
    expect(html).toContain('Custom error')
    expect(error.message).toContain('Custom error')
    expect(error.statusCode).toBe(500)
    expect(error.customProp).toBe('ezpz')
  })

  test('/error2 status code', async () => {
    await expect(rp(url('/error2'))).rejects.toMatchObject({
      statusCode: 500,
      message: expect.stringContaining('Custom error')
    })
  })

  test('/error-midd', async () => {
    await expect(rp(url('/error-midd'))).rejects.toMatchObject({ statusCode: 505 })
  })

  test('/redirect-middleware', async () => {
    await expect(rp(url('/redirect-middleware'))).resolves.toBeTruthy()
  })

  test('/redirect-name', async () => {
    const { html, redirected } = await nuxt.server.renderRoute('/redirect-name')
    expect(html).toContain('<div id="__nuxt"></div>')
    expect(redirected.path === '/stateless').toBe(true)
    expect(redirected.status === 302).toBe(true)
  })

  test('/no-ssr', async () => {
    const { html } = await nuxt.server.renderRoute('/no-ssr')
    expect(html.includes(
      '<p class="no-ssr-placeholder">Loading...</p>'
    )).toBe(true)
  })

  test('/no-ssr (client-side)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/no-ssr'))
    const html = window.document.body.innerHTML
    expect(html).toContain('Displayed only on client-side</h1>')
  })

  test('ETag Header', async () => {
    const { headers: { etag } } = await rp(url('/stateless'), {
      resolveWithFullResponse: true
    })
    // Verify functionality
    await expect(rp(url('/stateless'), { headers: { 'If-None-Match': etag } }))
      .rejects.toMatchObject({ statusCode: 304 })
  })

  test('/_nuxt/ should return 404', async () => {
    await expect(rp(url('/_nuxt/')))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  test('/meta', async () => {
    const { html } = await nuxt.server.renderRoute('/meta')
    expect(/<pre>.*&quot;works&quot;: true.*<\/pre>/s.test(html)).toBe(true)
  })

  test('/fn-midd', async () => {
    await expect(rp(url('/fn-midd')))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  test('/fn-midd?please=true', async () => {
    const { html } = await nuxt.server.renderRoute('/fn-midd?please=true')
    expect(html).toContain('<h1>Date:')
  })

  test('/router-guard', async () => {
    const { html } = await nuxt.server.renderRoute('/router-guard')
    expect(html).toContain('<p>Nuxt.js</p>')
    expect(html.includes('Router Guard')).toBe(false)
  })

  test('/jsx', async () => {
    const { html } = await nuxt.server.renderRoute('/jsx')
    expect(html).toContain('<h1>JSX Page</h1>')
  })

  test('/jsx-link', async () => {
    const { html } = await nuxt.server.renderRoute('/jsx-link')
    expect(html).toContain('<h1>JSX Link Page</h1>')
  })

  test('/js-link', async () => {
    const { html } = await nuxt.server.renderRoute('/js-link')
    expect(html).toContain('<h1>vue file is first-class</h1>')
  })

  test('/тест雨 (test non ascii route)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/тест雨'))
    const html = window.document.body.innerHTML
    expect(html).toMatch('Hello unicode')
  })

  test('/custom (js layout)', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/custom'))
    const html = window.document.body.innerHTML
    expect(html).toMatch('<h1>JS Layout</h1>')
    expect(html).toMatch('<h2>custom page</h2>')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
