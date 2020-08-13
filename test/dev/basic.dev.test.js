import path from 'path'
import jsdom from 'jsdom'
import consola from 'consola'
import { Builder, BundleBuilder, getPort, loadFixture, Nuxt, rp, waitFor } from '../utils'

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
          '@scoped/packageA',
          '@scoped\\packageB',
          'vue.test.js',
          /vue-test/,
          ({ isModern }) => isModern ? 'modern-test' : 'normal-test'
        ],
        loaders: {
          cssModules: {
            modules: {
              localIdentName: '[hash:base64:6]'
            }
          }
        },
        extend ({ module: { rules }, output: wpOutput }, { isClient, loaders }) {
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
      },
      hooks: {
        'vue-renderer:ssr:context': ({ nuxt }) => {
          nuxt.logs = [{ type: 'log', args: ['This is a test ssr log'] }]
        }
      },
      render: {
        ssrLog: 'collapsed'
      }
    })

    nuxt = new Nuxt(config)
    await nuxt.ready()

    builder = new Builder(nuxt, BundleBuilder)

    await builder.build()
    await waitFor(2000) // TODO: Find a better way

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('Check build:done hook called', () => {
    expect(builder.__hook_built_called__).toBe(true)
  })

  test('Config: build.transpile', () => {
    expect(transpile('vue-test')).toBe(true)
    expect(transpile(path.normalize('node_modules/test.js'))).toBe(false)
    expect(transpile(path.normalize('node_modules/vue-test'))).toBe(true)
    expect(transpile(path.normalize('node_modules/vue.test.js'))).toBe(true)
    expect(transpile(path.normalize('node_modules/test.vue.js'))).toBe(true)
    expect(transpile(path.normalize('node_modules/@scoped/packageA/src/index.js'))).toBe(true)
    expect(transpile(path.normalize('node_modules/@scoped/packageB/src/index.js'))).toBe(true)
    expect(transpile(path.normalize('node_modules/normal-test'))).toBe(true)
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
    expect(cssModules.modules.localIdentName).toBe('[hash:base64:6]')
    expect(vueLoader.options).toBe(vue)
  })

  test('Config: preset-env and cssnano are at then end of postcss plugins', () => {
    const plugins = postcssLoader.options.plugins.map((plugin) => {
      return plugin.postcssPlugin
    })
    expect(plugins).toEqual([
      'postcss-import',
      'postcss-url',
      'nuxt-test',
      'postcss-preset-env',
      'cssnano'
    ])
  })

  test('/stateless', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/stateless'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>My component!</h1>')
    // Check render:routeDone hook called
    expect(nuxt.__hook_render_routeDone__).toBe('/stateless')
    window.close()
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
    const { body } = await rp(url('/__open-in-editor?file=pages/index.vue'))
    expect(body).toBe('')
  })

  test('/__open-in-editor should return error (open-in-editor)', async () => {
    await expect(rp(url('/__open-in-editor?file='))).rejects.toMatchObject({
      response: {
        statusCode: 500,
        body: 'launch-editor-middleware: required query param "file" is missing.'
      }
    })
  })

  test('/error should return error stack trace (Youch)', async () => {
    await expect(nuxt.server.renderAndGetWindow(url('/error'))).rejects.toMatchObject({
      response: { statusCode: 500 }
    })
  })

  test('/error should return json format error (Youch)', async () => {
    const opts = {
      headers: {
        accept: 'application/json'
      }
    }
    await expect(rp(url('/error'), opts)).rejects.toMatchObject({
      response: {
        statusCode: 500,
        headers: {
          'content-type': 'text/json; charset=utf-8'
        }
      }
    })
  })

  test('/ should display ssr log in collapsed group', async () => {
    const virtualConsole = new jsdom.VirtualConsole()
    const groupCollapsed = jest.fn()
    const groupEnd = jest.fn()
    const log = jest.fn()
    virtualConsole.on('groupCollapsed', groupCollapsed)
    virtualConsole.on('groupEnd', groupEnd)
    virtualConsole.on('log', log)

    await nuxt.server.renderAndGetWindow(url('/'), {
      virtualConsole
    })

    expect(groupCollapsed).toHaveBeenCalledWith(
      '%cNuxt SSR',
      'background: #2E495E;border-radius: 0.5em;color: white;font-weight: bold;padding: 2px 0.5em;'
    )
    expect(groupEnd).toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith('This is a test ssr log')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await builder.close()
  })
})
