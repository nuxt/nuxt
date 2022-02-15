import { resolve, join } from 'pathe'
import { createNitro, createDevServer, build, scanMiddleware, writeTypes, prepare, copyPublicAssets } from 'nitropack'
import type { NitroConfig, ServerMiddleware } from 'nitropack'
import type { Nuxt } from '@nuxt/schema'
import { resolvePath } from '@nuxt/kit'
import fsExtra from 'fs-extra'
import { ImportProtectionPlugin } from './plugins/import-protection'

export async function initNitro (nuxt: Nuxt) {
  // Create contexts
  const nitroOptions = ((nuxt.options as any).nitro || {}) as NitroConfig
  const nitro = await createNitro({
    ...nitroOptions,
    rootDir: nuxt.options.rootDir,
    srcDir: join(nuxt.options.srcDir, 'server'),
    buildDir: nuxt.options.buildDir,
    generateDir: join(nuxt.options.buildDir, 'dist'),
    publicDir: nuxt.options.dir.public,
    publicPath: nuxt.options.app.buildAssetsDir,
    renderer: '#nitro/vue/render',
    modulesDir: nuxt.options.modulesDir,
    runtimeConfig: {
      public: nuxt.options.publicRuntimeConfig,
      private: nuxt.options.privateRuntimeConfig
    },
    output: {
      dir: nuxt.options.dev
        ? join(nuxt.options.buildDir, 'nitro')
        : resolve(nuxt.options.rootDir, '.output')
    },
    dev: nuxt.options.dev,
    preset: nuxt.options.dev ? 'dev' : undefined
  })

  const nitroDevServer = nuxt.server = createDevServer(nitro)

  nitro.vfs = nuxt.vfs = nitro.vfs || nuxt.vfs || {}

  // Connect hooks
  const nitroHooks = [
    'nitro:document'
  ]
  nuxt.hook('close', () => nitro.hooks.callHook('close'))
  for (const hook of nitroHooks) {
    nitro.hooks.hook(hook as any, (...args) => nuxt.callHook(hook as any, ...args))
  }

  // @ts-ignore
  nuxt.hook('close', () => nitro.hooks.callHook('close'))
  nitro.hooks.hook('nitro:document', template => nuxt.callHook('nitro:document', template))

  // Register nuxt3 protection patterns
  nitro.hooks.hook('nitro:rollup:before', (nitro) => {
    nitro.options.rollupConfig.plugins.push(ImportProtectionPlugin.rollup({
      rootDir: nuxt.options.rootDir,
      patterns: [
        ...['#app', /^#build(\/|$)/]
          .map(p => [p, 'Vue app aliases are not allowed in server routes.']) as [RegExp | string, string][]
      ]
    }))
  })

  // Add typed route responses
  nuxt.hook('prepare:types', (opts) => {
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/nitro.d.ts') })
  })

  // Wait for all modules to be ready
  nuxt.hook('modules:done', async () => {
    // Extend nitro with modules
    await nuxt.callHook('nitro:context', nitro)

    // Resolve middleware
    const { middleware, legacyMiddleware } = await resolveMiddleware(nuxt)
    nuxt.server.setLegacyMiddleware(legacyMiddleware)
    nitro.options.middleware.push(...middleware)
  })

  // nuxt build/dev
  nuxt.hook('build:done', async () => {
    if (nuxt.options.dev) {
      await build(nitro)
    } else {
      await prepare(nitro)
      await copyPublicAssets(nitro)
      await build(nitro)
    }
  })

  nuxt.hook('build:before', async () => {
    nitro.scannedMiddleware = await scanMiddleware(nitro.options.srcDir)
    await writeTypes(nitro)
  })

  // nuxt dev
  if (nuxt.options.dev) {
    nitro.hooks.hook('nitro:compiled', () => { nitroDevServer.watch() })
    nuxt.hook('build:compile', ({ compiler }) => {
      compiler.outputFileSystem = { ...fsExtra, join } as any
    })
    nuxt.hook('server:devMiddleware', (m) => { nitroDevServer.setDevMiddleware(m) })
  }
}

async function resolveMiddleware (nuxt: Nuxt) {
  const middleware: ServerMiddleware[] = []
  const legacyMiddleware: ServerMiddleware[] = []

  for (let m of nuxt.options.serverMiddleware) {
    if (typeof m === 'string' || typeof m === 'function' /* legacy middleware */) { m = { handler: m } }
    const route = m.path || m.route || '/'
    const handle = m.handler || m.handle
    if (typeof handle !== 'string' || typeof route !== 'string') {
      legacyMiddleware.push(m)
    } else {
      delete m.handler
      delete m.path
      middleware.push({
        ...m,
        handle: await resolvePath(handle),
        route
      })
    }
  }

  return {
    middleware,
    legacyMiddleware
  }
}
