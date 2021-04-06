import fetch from 'node-fetch'
import { resolve } from 'upath'
import { resolveModule } from '@nuxt/kit'
import { build, generate, prepare } from './build'
import { getNitroContext, NitroContext } from './context'
import { createDevServer } from './server/dev'
import { wpfs } from './utils/wpfs'
import { resolveMiddleware } from './server/middleware'

export default function nuxt2CompatModule () {
  const { nuxt } = this

  // Ensure we're not just building with 'static' target
  if (!nuxt.options.dev && nuxt.options.target === 'static' && !nuxt.options._export && !nuxt.options._legacyGenerate) {
    throw new Error('[nitro] Please use `nuxt generate` for static target')
  }

  // Disable loading-screen
  nuxt.options.build.loadingScreen = false
  nuxt.options.build.indicator = false

  // Create contexts
  const nitroContext = getNitroContext(nuxt.options, nuxt.options.nitro || {})
  const nitroDevContext = getNitroContext(nuxt.options, { preset: 'dev' })

  // Connect hooks
  nuxt.addHooks(nitroContext.nuxtHooks)
  nuxt.hook('close', () => nitroContext._internal.hooks.callHook('close'))

  nuxt.addHooks(nitroDevContext.nuxtHooks)
  nuxt.hook('close', () => nitroDevContext._internal.hooks.callHook('close'))
  nitroDevContext._internal.hooks.hook('renderLoading',
    (req, res) => nuxt.callHook('server:nuxt:renderLoading', req, res))

  // Expose process.env.NITRO_PRESET
  nuxt.options.env.NITRO_PRESET = nitroContext.preset

  // .ts is supported for serverMiddleware
  nuxt.options.extensions.push('ts')

  // Replace nuxt server
  if (nuxt.server) {
    nuxt.server.__closed = true
    nuxt.server = createNuxt2DevServer(nitroDevContext)
  }

  // Disable server sourceMap, esbuild will generate for it.
  nuxt.hook('webpack:config', (webpackConfigs) => {
    const serverConfig = webpackConfigs.find(config => config.name === 'server')
    serverConfig.devtool = false
  })

  // Nitro client plugin
  this.addPlugin({
    fileName: 'nitro.client.js',
    src: resolve(nitroContext._internal.runtimeDir, 'app/nitro.client.js')
  })

  // Fix module resolution
  nuxt.hook('webpack:config', (configs) => {
    for (const config of configs) {
      if (config.name === 'client') {
        config.resolve.alias.ufo = resolveModule('ufo/dist/index.mjs')
      }
    }
  })

  // Resolve middleware
  nuxt.hook('modules:done', () => {
    const { middleware, legacyMiddleware } = resolveMiddleware(nuxt)
    if (nuxt.server) {
      nuxt.server.setLegacyMiddleware(legacyMiddleware)
    }
    nitroContext.middleware.push(...middleware)
    nitroDevContext.middleware.push(...middleware)
  })

  // nuxt build/dev
  nuxt.options.build._minifyServer = false
  nuxt.options.build.standalone = false
  nuxt.hook('build:done', async () => {
    if (nuxt.options.dev) {
      await build(nitroDevContext)
    } else if (!nitroContext._nuxt.isStatic) {
      await prepare(nitroContext)
      await generate(nitroContext)
      await build(nitroContext)
    }
  })

  // nude dev
  if (nuxt.options.dev) {
    nitroDevContext._internal.hooks.hook('nitro:compiled', () => { nuxt.server.watch() })
    nuxt.hook('build:compile', ({ compiler }) => { compiler.outputFileSystem = wpfs })
    nuxt.hook('server:devMiddleware', (m) => { nuxt.server.setDevMiddleware(m) })
  }

  // nuxt generate
  nuxt.options.generate.dir = nitroContext.output.publicDir
  nuxt.options.generate.manifest = false
  nuxt.hook('generate:cache:ignore', (ignore: string[]) => {
    ignore.push(nitroContext.output.dir)
    ignore.push(nitroContext.output.serverDir)
    if (nitroContext.output.publicDir) {
      ignore.push(nitroContext.output.publicDir)
    }
    ignore.push(...nitroContext.ignore)
  })
  nuxt.hook('generate:before', async () => {
    await prepare(nitroContext)
  })
  nuxt.hook('generate:extendRoutes', async () => {
    await build(nitroDevContext)
    await nuxt.server.reload()
  })
  nuxt.hook('generate:done', async () => {
    await nuxt.server.close()
    await build(nitroContext)
  })
}

function createNuxt2DevServer (nitroContext: NitroContext) {
  const server = createDevServer(nitroContext)

  const listeners = []
  async function listen (port) {
    const listener = await server.listen(port, {
      showURL: false,
      isProd: true
    })
    listeners.push(listener)
    return listener
  }

  async function renderRoute (route = '/', renderContext = {}) {
    const [listener] = listeners
    if (!listener) {
      throw new Error('There is no server listener to call `server.renderRoute()`')
    }
    const html = await fetch(listener.url + route, {
      headers: { 'nuxt-render-context': encodeQuery(renderContext) }
    }).then(r => r.text())

    return { html }
  }

  return {
    ...server,
    listeners,
    renderRoute,
    listen,
    serverMiddlewarePaths () { return [] },
    ready () { }
  }
}

function encodeQuery (obj) {
  return Object.entries(obj).map(
    ([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(val))}`
  ).join('&')
}
