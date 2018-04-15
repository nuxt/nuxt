import { loadFixture, getPort, Nuxt, Builder, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('basic dev', () => {
  beforeAll(async () => {
    const config = loadFixture('basic', {
      dev: true,
      debug: true,
      buildDir: '.nuxt-dev',
      build: {
        stats: 'none'
      }
    })
    nuxt = new Nuxt(config)
    new Builder(nuxt).build()
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  // TODO: enable test when style-loader.js:60 was resolved
  // test.serial('/extractCSS', async t => {
  //   const window = await nuxt.renderAndGetWindow(url('/extractCSS'))
  //   const html = window.document.head.innerHTML
  //   t.true(html.includes('vendor.css'))
  //   t.true(!html.includes('30px'))
  //   t.is(window.getComputedStyle(window.document.body).getPropertyValue('font-size'), '30px')
  // })

  test('/stateless', async () => {
    // const spies = await intercept()
    const window = await nuxt.renderAndGetWindow(url('/stateless'))
    const html = window.document.body.innerHTML
    expect(html.includes('<h1>My component!</h1>')).toBe(true)
    // expect(spies.info.calledWithMatch('You are running Vue in development mode.')).toBe(true)
    // release()
  })

  // test('/_nuxt/test.hot-update.json should returns empty html', async t => {
  //   try {
  //     await rp(url('/_nuxt/test.hot-update.json'))
  //   } catch (err) {
  //     t.is(err.statusCode, 404)
  //     t.is(err.response.body, '')
  //   }
  // })

  test('/__open-in-editor (open-in-editor)', async () => {
    const { body } = await rp(
      url('/__open-in-editor?file=pages/index.vue'),
      { resolveWithFullResponse: true }
    )
    expect(body).toBe('')
  })

  test('/__open-in-editor should return error (open-in-editor)', async () => {
    await expect(rp(url('/__open-in-editor?file='))).rejects.toMatchObject({
      statusCode: 500,
      error: 'launch-editor-middleware: required query param "file" is missing.'
    })
  })

  test('/error should return error stack trace (Youch)', async () => {
    await expect(nuxt.renderAndGetWindow(url('/error'))).rejects.toMatchObject({
      statusCode: 500
    })
  })

  test('/error no source-map (Youch)', async () => {
    const sourceMaps = nuxt.renderer.resources.serverBundle.maps
    nuxt.renderer.resources.serverBundle.maps = {}

    // const errorSpy = await interceptError()
    await expect(nuxt.renderAndGetWindow(url('/error'))).rejects.toMatchObject({
      statusCode: 500
    })

    nuxt.renderer.resources.serverBundle.maps = sourceMaps
  })

  test('/error should return json format error (Youch)', async () => {
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

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
