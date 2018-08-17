import consola from 'consola'
import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('basic ssr', () => {
  beforeAll(async () => {
    const options = await loadFixture('basic')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
  })

  test('/stateless', async () => {
    const { html } = await nuxt.renderRoute('/stateless')
    expect(html.includes('<h1>My component!</h1>')).toBe(true)
  })

  /*
  ** Example of testing via dom checking
  */
  test('/css', async () => {
    const window = await nuxt.renderAndGetWindow(url('/css'))

    const headHtml = window.document.head.innerHTML
    expect(headHtml.includes('color:red')).toBe(true)

    const element = window.document.querySelector('.red')
    expect(element).not.toBe(null)
    expect(element.textContent).toBe('This is red')
    expect(element.className).toBe('red')
    // t.is(window.getComputedStyle(element).color, 'red')
  })

  test('/postcss', async () => {
    const window = await nuxt.renderAndGetWindow(url('/css'))

    const headHtml = window.document.head.innerHTML
    expect(headHtml.includes('background-color:#00f')).toBe(true)

    // const element = window.document.querySelector('div.red')
    // t.is(window.getComputedStyle(element)['background-color'], 'blue')
  })

  test('/stateful', async () => {
    const { html } = await nuxt.renderRoute('/stateful')
    expect(html.includes('<div><p>The answer is 42</p></div>')).toBe(true)
  })

  test('/store', async () => {
    const { html } = await nuxt.renderRoute('/store')
    expect(html.includes('<h1>Vuex Nested Modules</h1>')).toBe(true)
    expect(html.includes('<p>1</p>')).toBe(true)
  })

  test('/head', async () => {
    const window = await nuxt.renderAndGetWindow(url('/head'))
    expect(window.document.title).toBe('My title - Nuxt.js')

    const html = window.document.body.innerHTML
    expect(html.includes('<div><h1>I can haz meta tags</h1></div>')).toBe(true)
    expect(
      html.includes('<script data-n-head="true" src="/body.js" data-body="true">')
    ).toBe(true)

    const metas = window.document.getElementsByTagName('meta')
    expect(metas[0].getAttribute('content')).toBe('my meta')
    expect(consola.log).toHaveBeenCalledWith('Body script!')
  })

  test('/async-data', async () => {
    const { html } = await nuxt.renderRoute('/async-data')
    expect(html.includes('<p>Nuxt.js</p>')).toBe(true)
  })

  test('/await-async-data', async () => {
    const { html } = await nuxt.renderRoute('/await-async-data')
    expect(html.includes('<p>Await Nuxt.js</p>')).toBe(true)
  })

  test('/callback-async-data', async () => {
    const { html } = await nuxt.renderRoute('/callback-async-data')
    expect(html.includes('<p>Callback Nuxt.js</p>')).toBe(true)
  })

  test('/users/1', async () => {
    const { html } = await nuxt.renderRoute('/users/1')
    expect(html.includes('<h1>User: 1</h1>')).toBe(true)
  })

  test('/validate should display a 404', async () => {
    const { html } = await nuxt.renderRoute('/validate')
    expect(html.includes('This page could not be found')).toBe(true)
  })

  test('/validate?valid=true', async () => {
    const { html } = await nuxt.renderRoute('/validate?valid=true')
    expect(html.includes('<h1>I am valid</h1>')).toBe(true)
  })

  test('/redirect', async () => {
    const { html, redirected } = await nuxt.renderRoute('/redirect')
    expect(html.includes('<div id="__nuxt"></div>')).toBe(true)
    expect(redirected.path === '/').toBe(true)
    expect(redirected.status === 302).toBe(true)
  })

  test('/redirect -> check redirected source', async () => {
    // there are no transition properties in jsdom, ignore the error log
    const window = await nuxt.renderAndGetWindow(url('/redirect'))
    const html = window.document.body.innerHTML
    expect(html.includes('<h1>Index page</h1>')).toBe(true)
  })

  test('/redirect -> external link', async () => {
    let _headers, _status
    const { html } = await nuxt.renderRoute('/redirect-external', {
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
    expect(html.includes('<div data-server-rendered="true"></div>')).toBe(true)
  })

  test('/special-state -> check window.__NUXT__.test = true', async () => {
    const window = await nuxt.renderAndGetWindow(url('/special-state'))
    expect(window.document.title).toBe('Nuxt.js')
    expect(window.__NUXT__.test).toBe(true)
  })

  test('/error', async () => {
    await expect(nuxt.renderRoute('/error', { req: {}, res: {} }))
      .rejects.toThrow('Error mouahahah')
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
    const { html, error } = await nuxt.renderRoute('/error2')
    expect(html.includes('Custom error')).toBe(true)
    expect(error.message.includes('Custom error')).toBe(true)
    expect(error.statusCode === undefined).toBe(true)
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
    const { html, redirected } = await nuxt.renderRoute('/redirect-name')
    expect(html.includes('<div id="__nuxt"></div>')).toBe(true)
    expect(redirected.path === '/stateless').toBe(true)
    expect(redirected.status === 302).toBe(true)
  })

  test('/no-ssr', async () => {
    const { html } = await nuxt.renderRoute('/no-ssr')
    expect(html.includes(
      '<div class="no-ssr-placeholder">&lt;p&gt;Loading...&lt;/p&gt;</div>'
    )).toBe(true)
  })

  test('/no-ssr (client-side)', async () => {
    const window = await nuxt.renderAndGetWindow(url('/no-ssr'))
    const html = window.document.body.innerHTML
    expect(html.includes('Displayed only on client-side</h1>')).toBe(true)
  })

  test('ETag Header', async () => {
    const { headers: { etag } } = await rp(url('/stateless'), {
      resolveWithFullResponse: true
    })
    // Verify functionality
    await expect(rp(url('/stateless'), { headers: { 'If-None-Match': etag } }))
      .rejects.toMatchObject({ statusCode: 304 })
  })

  test('/_nuxt/server-bundle.json should return 404', async () => {
    await expect(rp(url('/_nuxt/server-bundle.json')))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  test('/_nuxt/ should return 404', async () => {
    await expect(rp(url('/_nuxt/')))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  test('/meta', async () => {
    const { html } = await nuxt.renderRoute('/meta')
    expect(html.includes('"meta":[{"works":true}]')).toBe(true)
  })

  test('/fn-midd', async () => {
    await expect(rp(url('/fn-midd')))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  test('/fn-midd?please=true', async () => {
    const { html } = await nuxt.renderRoute('/fn-midd?please=true')
    expect(html.includes('<h1>Date:')).toBe(true)
  })

  test('/router-guard', async () => {
    const { html } = await nuxt.renderRoute('/router-guard')
    expect(html.includes('<p>Nuxt.js</p>')).toBe(true)
    expect(html.includes('Router Guard')).toBe(false)
  })

  test('/jsx', async () => {
    const { html } = await nuxt.renderRoute('/jsx')
    expect(html.includes('<h1>JSX Page</h1>')).toBe(true)
  })

  test('/jsx-link', async () => {
    const { html } = await nuxt.renderRoute('/jsx-link')
    expect(html.includes('<h1>JSX Link Page</h1>')).toBe(true)
  })

  test('/js-link', async () => {
    const { html } = await nuxt.renderRoute('/js-link')
    expect(html.includes('<h1>vue file is first-class</h1>')).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
