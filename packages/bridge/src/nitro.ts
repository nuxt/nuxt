import { promises as fsp } from 'fs'
import fetch from 'node-fetch'
import { addPluginTemplate, useNuxt } from '@nuxt/kit'
import { stringifyQuery } from 'ufo'
import { resolve } from 'pathe'
import { build, generate, prepare, getNitroContext, NitroContext, createDevServer, wpfs, resolveMiddleware } from '@nuxt/nitro'
import { AsyncLoadingPlugin } from './async-loading'
import { distDir } from './dirs'

export function setupNitroBridge () {
  const nuxt = useNuxt()

  // Ensure we're not just building with 'static' target
  if (!nuxt.options.dev && nuxt.options.target === 'static' && !nuxt.options._export && !nuxt.options._legacyGenerate) {
    throw new Error('[nitro] Please use `nuxt generate` for static target')
  }

  // Disable loading-screen
  // @ts-ignore
  nuxt.options.build.loadingScreen = false
  // @ts-ignore
  nuxt.options.build.indicator = false

  // Disable fetch polyfill (nitro provides it)
  nuxt.options.fetch.server = false

  // Create contexts
  const nitroOptions = (nuxt.options as any).nitro || {}
  const nitroContext = getNitroContext(nuxt.options, nitroOptions)
  const nitroDevContext = getNitroContext(nuxt.options, { ...nitroOptions, preset: 'dev' })

  // Normalize Nuxt directories
  for (const context of [nitroContext, nitroDevContext]) {
    context._nuxt.rootDir = resolve(context._nuxt.rootDir)
    context._nuxt.srcDir = resolve(context._nuxt.srcDir)
    context._nuxt.buildDir = resolve(context._nuxt.buildDir)
    context._nuxt.generateDir = resolve(context._nuxt.generateDir)
  }

  // Connect hooks
  nuxt.addHooks(nitroContext.nuxtHooks)
  nuxt.hook('close', () => nitroContext._internal.hooks.callHook('close'))
  nitroContext._internal.hooks.hook('nitro:document', template => nuxt.callHook('nitro:document', template))

  nuxt.addHooks(nitroDevContext.nuxtHooks)
  nuxt.hook('close', () => nitroDevContext._internal.hooks.callHook('close'))
  nitroDevContext._internal.hooks.hook('nitro:document', template => nuxt.callHook('nitro:document', template))

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
    if (serverConfig) {
      serverConfig.devtool = false
    }
  })

  // Set up webpack plugin for node async loading
  nuxt.hook('webpack:config', (webpackConfigs) => {
    const serverConfig = webpackConfigs.find(config => config.name === 'server')
    if (serverConfig) {
      serverConfig.plugins = serverConfig.plugins || []
      serverConfig.plugins.push(new AsyncLoadingPlugin({
        modulesDir: nuxt.options.modulesDir
      }) as any)
    }
  })

  // Nitro client plugin
  addPluginTemplate({
    filename: 'nitro.client.mjs',
    src: resolve(nitroContext._internal.runtimeDir, 'app/nitro.client.mjs')
  })

  // Nitro server plugin (for vue-meta)
  addPluginTemplate({
    filename: 'nitro-bridge.server.mjs',
    src: resolve(distDir, 'runtime/nitro-bridge.server.mjs')
  })

  // Fix module resolution
  nuxt.hook('webpack:config', (configs) => {
    for (const config of configs) {
      // We use only object form of alias in base config
      if (Array.isArray(config.resolve.alias)) { return }
      config.resolve.alias.ufo = 'ufo/dist/index.mjs'
      config.resolve.alias.ohmyfetch = 'ohmyfetch/dist/index.mjs'
    }
  })

  // Generate mjs resources
  nuxt.hook('build:compiled', async ({ name }) => {
    if (name === 'server') {
      const jsServerEntry = resolve(nuxt.options.buildDir, 'dist/server/server.js')
      await fsp.writeFile(jsServerEntry.replace(/.js$/, '.cjs'), 'module.exports = require("./server.js")', 'utf8')
      await fsp.writeFile(jsServerEntry.replace(/.js$/, '.mjs'), 'export { default } from "./server.cjs"', 'utf8')
    } else if (name === 'client') {
      const manifest = await fsp.readFile(resolve(nuxt.options.buildDir, 'dist/server/client.manifest.json'), 'utf8')
      await fsp.writeFile(resolve(nuxt.options.buildDir, 'dist/server/client.manifest.mjs'), 'export default ' + manifest, 'utf8')
    }
  })

  // Wait for all modules to be ready
  nuxt.hook('modules:done', async () => {
    // Extend nitro with modules
    await nuxt.callHook('nitro:context', nitroContext)
    await nuxt.callHook('nitro:context', nitroDevContext)

    // Resolve middleware
    const { middleware, legacyMiddleware } = resolveMiddleware(nuxt)
    if (nuxt.server) {
      nuxt.server.setLegacyMiddleware(legacyMiddleware)
    }
    nitroContext.middleware.push(...middleware)
    nitroDevContext.middleware.push(...middleware)
  })

  // Add typed route responses
  nuxt.hook('prepare:types', (opts) => {
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'nitro.d.ts') })

    for (const stub of ['#storage', '#assets']) {
      // The `@nuxt/nitro` types will be overwritten by packages/nitro/types/shims.d.ts
      opts.tsConfig.compilerOptions.paths[stub] = ['@nuxt/nitro']
    }
  })

  // nuxt build/dev
  // @ts-ignore
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
      headers: { 'nuxt-render-context': stringifyQuery(renderContext) }
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
