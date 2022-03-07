import { promises as fsp } from 'fs'
import fetch from 'node-fetch'
import fse from 'fs-extra'
import { addPluginTemplate, useNuxt } from '@nuxt/kit'
import { joinURL, stringifyQuery, withoutTrailingSlash } from 'ufo'
import { resolve, join } from 'pathe'
import { build, generate, prepare, getNitroContext, NitroContext, createDevServer, wpfs, resolveMiddleware, scanMiddleware, writeTypes } from '@nuxt/nitro'
import { AsyncLoadingPlugin } from './async-loading'
import { distDir } from './dirs'
import { isDirectory, readDirRecursively } from './vite/utils/fs'

export function setupNitroBridge () {
  const nuxt = useNuxt()

  // Ensure we're not just building with 'static' target
  if (!nuxt.options.dev && nuxt.options.target === 'static' && !nuxt.options._prepare && !nuxt.options._export && !nuxt.options._legacyGenerate) {
    throw new Error('[nitro] Please use `nuxt generate` for static target')
  }

  // Handle legacy property name `assetsPath`
  nuxt.options.app.buildAssetsDir = nuxt.options.app.buildAssetsDir || nuxt.options.app.assetsPath
  nuxt.options.app.assetsPath = nuxt.options.app.buildAssetsDir
  nuxt.options.app.baseURL = nuxt.options.app.baseURL || (nuxt.options.app as any).basePath
  // Nitro expects app config on `config.app` rather than `config._app`
  nuxt.options.publicRuntimeConfig.app = nuxt.options.publicRuntimeConfig.app || {}
  Object.assign(nuxt.options.publicRuntimeConfig.app, nuxt.options.publicRuntimeConfig._app)

  // Disable loading-screen
  // @ts-ignore
  nuxt.options.build.loadingScreen = false
  // @ts-ignore
  nuxt.options.build.indicator = false

  if (nuxt.options.build.analyze === true) {
    const { rootDir } = nuxt.options
    nuxt.options.build.analyze = {
      template: 'treemap',
      projectRoot: rootDir,
      filename: join(rootDir, '.nuxt/stats', '{name}.html')
    }
  }

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
  nitroContext._internal.hooks.hook('nitro:generate', ctx => nuxt.callHook('nitro:generate', ctx))

  nuxt.addHooks(nitroDevContext.nuxtHooks)
  nuxt.hook('close', () => nitroDevContext._internal.hooks.callHook('close'))
  nitroDevContext._internal.hooks.hook('nitro:document', template => nuxt.callHook('nitro:document', template))

  // Use custom document template if provided
  if (nuxt.options.appTemplatePath) {
    nuxt.hook('nitro:document', async (template) => {
      template.src = nuxt.options.appTemplatePath
      template.contents = await fsp.readFile(nuxt.options.appTemplatePath, 'utf-8')
    })
  }

  nuxt.hook('nitro:generate', async () => {
    const clientDist = resolve(nuxt.options.buildDir, 'dist/client')

    // Remove public files that have been duplicated into buildAssetsDir
    // TODO: Add option to configure this behaviour in vite
    const publicDir = join(nuxt.options.srcDir, nuxt.options.dir.static)
    let publicFiles: string[] = []
    if (await isDirectory(publicDir)) {
      publicFiles = readDirRecursively(publicDir).map(r => r.replace(publicDir, ''))
      for (const file of publicFiles) {
        try {
          fse.rmSync(join(clientDist, file))
        } catch {}
      }
    }

    // Copy doubly-nested /_nuxt/_nuxt files into buildAssetsDir
    // TODO: Workaround vite issue
    if (await isDirectory(clientDist)) {
      const nestedAssetsPath = withoutTrailingSlash(join(clientDist, nuxt.options.app.buildAssetsDir))

      if (await isDirectory(nestedAssetsPath)) {
        await fse.copy(nestedAssetsPath, clientDist, { recursive: true })
        await fse.remove(nestedAssetsPath)
      }
    }
  })

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
    if (nuxt.options._prepare) { return }
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
    const { middleware, legacyMiddleware } = await resolveMiddleware(nuxt)
    if (nuxt.server) {
      nuxt.server.setLegacyMiddleware(legacyMiddleware)
    }
    nitroContext.middleware.push(...middleware)
    nitroDevContext.middleware.push(...middleware)
  })

  // Add typed route responses
  nuxt.hook('prepare:types', (opts) => {
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/nitro.d.ts') })
  })

  // nuxt prepare
  nuxt.hook('build:done', async () => {
    nitroDevContext.scannedMiddleware = await scanMiddleware(nitroDevContext._nuxt.serverDir)
    await writeTypes(nitroDevContext)
  })

  // nuxt build/dev
  // @ts-ignore
  nuxt.options.build._minifyServer = false
  nuxt.options.build.standalone = false
  nuxt.hook('build:done', async () => {
    if (nuxt.options._prepare) { return }
    if (nuxt.options.dev) {
      await build(nitroDevContext)
    } else if (!nitroContext._nuxt.isStatic) {
      await prepare(nitroContext)
      await generate(nitroContext)
      await build(nitroContext)
    }
  })

  // nuxt dev
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
    const res = await fetch(joinURL(listener.url, route), {
      headers: { 'nuxt-render-context': stringifyQuery(renderContext) }
    })

    const html = await res.text()

    if (!res.ok) { return { html, error: res.statusText } }

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
