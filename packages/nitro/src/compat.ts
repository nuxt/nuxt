import fetch from 'node-fetch'
import { resolve } from 'upath'
import { build, generate, prepare } from './build'
import { getSigmaContext, SigmaContext } from './context'
import { createDevServer } from './server'
import { wpfs } from './utils/wpfs'
import { resolveMiddleware } from './middleware'

export default function nuxt2CompatModule () {
  const { nuxt } = this

  // Disable loading-screen
  nuxt.options.build.loadingScreen = false
  nuxt.options.build.indicator = false

  // Create contexts
  const sigmaContext = getSigmaContext(nuxt.options, nuxt.options.sigma || {})
  const sigmaDevContext = getSigmaContext(nuxt.options, { preset: 'local' })

  // Connect hooks
  nuxt.addHooks(sigmaContext.nuxtHooks)
  nuxt.hook('close', () => sigmaContext._internal.hooks.callHook('close'))

  nuxt.addHooks(sigmaDevContext.nuxtHooks)
  nuxt.hook('close', () => sigmaDevContext._internal.hooks.callHook('close'))
  sigmaDevContext._internal.hooks.hook('renderLoading',
    (req, res) => nuxt.callHook('server:nuxt:renderLoading', req, res))

  // Expose process.env.SIGMA_PRESET
  nuxt.options.env.SIGMA_PRESET = sigmaContext.preset

  // .ts is supported for serverMiddleware
  nuxt.options.extensions.push('ts')

  // Replace nuxt server
  if (nuxt.server) {
    nuxt.server.__closed = true
    nuxt.server = createNuxt2DevServer(sigmaDevContext)
  }

  // Sigma client plugin
  this.addPlugin({
    fileName: 'sigma.client.js',
    src: resolve(sigmaContext._internal.runtimeDir, 'app/sigma.client.js')
  })

  // Resolve middleware
  nuxt.hook('modules:done', () => {
    const { middleware, legacyMiddleware } =
      resolveMiddleware(nuxt.options.serverMiddleware, nuxt.resolver.resolvePath)
    nuxt.server.setLegacyMiddleware(legacyMiddleware)
    sigmaContext.middleware.push(...middleware)
    sigmaDevContext.middleware.push(...middleware)
  })

  // nuxt build/dev
  nuxt.options.build._minifyServer = false
  nuxt.options.build.standalone = false
  nuxt.hook('build:done', async () => {
    if (nuxt.options.dev) {
      await build(sigmaDevContext)
    } else if (!sigmaContext._nuxt.isStatic) {
      await prepare(sigmaContext)
      await generate(sigmaContext)
      await build(sigmaContext)
    }
  })

  // nude dev
  if (nuxt.options.dev) {
    sigmaDevContext._internal.hooks.hook('sigma:compiled', () => { nuxt.server.watch() })
    nuxt.hook('build:compile', ({ compiler }) => { compiler.outputFileSystem = wpfs })
    nuxt.hook('server:devMiddleware', (m) => { nuxt.server.setDevMiddleware(m) })
  }

  // nuxt generate
  nuxt.options.generate.dir = sigmaContext.output.publicDir
  nuxt.options.generate.manifest = false
  nuxt.hook('generate:cache:ignore', (ignore: string[]) => {
    ignore.push(sigmaContext.output.dir)
    ignore.push(sigmaContext.output.serverDir)
    if (sigmaContext.output.publicDir) {
      ignore.push(sigmaContext.output.publicDir)
    }
    ignore.push(...sigmaContext.ignore)
  })
  nuxt.hook('generate:before', async () => {
    await prepare(sigmaContext)
  })
  nuxt.hook('generate:extendRoutes', async () => {
    await build(sigmaDevContext)
    await nuxt.server.reload()
  })
  nuxt.hook('generate:done', async () => {
    await nuxt.server.close()
    await build(sigmaContext)
  })
}

function createNuxt2DevServer (sigmaContext: SigmaContext) {
  const server = createDevServer(sigmaContext)

  const listeners = []
  async function listen (port) {
    const listener = await server.listen(port)
    listeners.push(listener)
    return listeners
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
