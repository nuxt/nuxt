import { Builder, getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null
let transpile = null

describe('basic dev', () => {
  beforeAll(async () => {
    const config = await loadFixture('basic', {
      dev: true,
      debug: true,
      buildDir: '.nuxt-dev',
      build: {
        transpile: [
          'vue\\.test\\.js',
          /vue-test/
        ],
        extend({ module: { rules } }, { isClient }) {
          if (isClient) {
            const babelLoader = rules.find(loader => loader.test.test('.jsx'))
            transpile = file => !babelLoader.exclude(file)
          }
        }
      }
    })
    nuxt = new Nuxt(config)
    await new Builder(nuxt).build()
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('Config: build.transpile', () => {
    expect(transpile('vue-test')).toBe(true)
    expect(transpile('node_modules/test.js')).toBe(false)
    expect(transpile('node_modules/vue-test')).toBe(true)
    expect(transpile('node_modules/vue.test.js')).toBe(true)
    expect(transpile('node_modules/test.vue.js')).toBe(true)
  })

  test('/stateless', async () => {
    const window = await nuxt.renderAndGetWindow(url('/stateless'))
    const html = window.document.body.innerHTML
    expect(html.includes('<h1>My component!</h1>')).toBe(true)
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
