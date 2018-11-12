import consola from 'consola'
import { Builder, BundleBuilder, getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null
let builder = null
let transpile = null
let output = null
let loadersOptions
let vueLoader
let postcssLoader

describe('basic dev', () => {
  beforeAll(async () => {
    const config = await loadFixture('basic', {
      dev: true,
      debug: true,
      buildDir: '.nuxt-dev',
      build: {
        filenames: {
          app: ({ isDev }) => {
            return isDev ? 'test-app.js' : 'test-app.[contenthash].js'
          },
          chunk: 'test-[name].[contenthash].js'
        },
        transpile: [
          'vue\\.test\\.js',
          /vue-test/
        ],
        loaders: {
          cssModules: {
            localIdentName: '[hash:base64:6]'
          }
        },
        extend({ module: { rules }, output: wpOutput }, { isClient, loaders }) {
          if (isClient) {
            const babelLoader = rules.find(loader => loader.test.test('.jsx'))
            transpile = file => !babelLoader.exclude(file)
            output = wpOutput
            loadersOptions = loaders
            vueLoader = rules.find(loader => loader.test.test('.vue'))
            const cssLoaders = rules.find(loader => loader.test.test('.css')).oneOf[0].use
            postcssLoader = cssLoaders[cssLoaders.length - 1]
          }
        }
      }
    })
    nuxt = new Nuxt(config)
    builder = new Builder(nuxt, BundleBuilder)
    await builder.build()
    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('Check build:done hook called', () => {
    expect(builder.__hook_built_called__).toBe(true)
  })

  test('Config: build.transpile', () => {
    expect(transpile('vue-test')).toBe(true)
    expect(transpile('node_modules/test.js')).toBe(false)
    expect(transpile('node_modules/vue-test')).toBe(true)
    expect(transpile('node_modules/vue.test.js')).toBe(true)
    expect(transpile('node_modules/test.vue.js')).toBe(true)
  })

  test('Config: build.filenames', () => {
    expect(output.filename).toBe('test-app.js')
    expect(output.chunkFilename).toBe('test-[name].[contenthash].js')
    expect(consola.warn).toBeCalledWith(
      'Notice: Please do not use contenthash in dev mode to prevent memory leak'
    )
  })

  test('Config: build.loaders', () => {
    expect(Object.keys(loadersOptions)).toHaveLength(12)
    expect(loadersOptions).toHaveProperty(
      'file', 'fontUrl', 'imgUrl', 'pugPlain', 'vue',
      'css', 'cssModules', 'less', 'sass', 'scss', 'stylus', 'vueStyle'
    )
    const { cssModules, vue } = loadersOptions
    expect(cssModules.localIdentName).toBe('[hash:base64:6]')
    expect(vueLoader.options).toBe(vue)
  })

  test('Config: cssnano is at then end of postcss plugins', () => {
    const plugins = postcssLoader.options.plugins.map((plugin) => {
      return plugin.postcssPlugin
    })
    expect(plugins).toEqual([
      'postcss-import',
      'postcss-url',
      'postcss-preset-env',
      'nuxt-test',
      'cssnano'
    ])
  })

  test('/stateless', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/stateless'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>My component!</h1>')
  })

  test('Check render:routeDone hook called', () => {
    expect(nuxt.__hook_render_routeDone__).toBe('/stateless')
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
    await expect(nuxt.server.renderAndGetWindow(url('/error'))).rejects.toMatchObject({
      statusCode: 500
    })
  })

  test('/error no source-map (Youch)', async () => {
    const sourceMaps = nuxt.renderer.resources.serverBundle.maps
    nuxt.renderer.resources.serverBundle.maps = {}

    await expect(nuxt.server.renderAndGetWindow(url('/error'))).rejects.toMatchObject({
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
