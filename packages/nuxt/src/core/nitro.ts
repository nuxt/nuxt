import { existsSync, promises as fsp } from 'node:fs'
import { resolve, join } from 'pathe'
import { createNitro, createDevServer, build, prepare, copyPublicAssets, writeTypes, scanHandlers, prerender } from 'nitropack'
import type { NitroEventHandler, NitroDevEventHandler, NitroConfig } from 'nitropack'
import type { Nuxt } from '@nuxt/schema'
import { resolvePath } from '@nuxt/kit'
import defu from 'defu'
import fsExtra from 'fs-extra'
import { toEventHandler, dynamicEventHandler } from 'h3'
import { distDir } from '../dirs'
import { ImportProtectionPlugin } from './plugins/import-protection'

export async function initNitro (nuxt: Nuxt) {
  // Resolve handlers
  const { handlers, devHandlers } = await resolveHandlers(nuxt)

  // Resolve config
  const _nitroConfig = ((nuxt.options as any).nitro || {}) as NitroConfig
  const nitroConfig: NitroConfig = defu(_nitroConfig, <NitroConfig>{
    rootDir: nuxt.options.rootDir,
    srcDir: join(nuxt.options.srcDir, 'server'),
    dev: nuxt.options.dev,
    preset: nuxt.options.dev ? 'nitro-dev' : undefined,
    buildDir: nuxt.options.buildDir,
    scanDirs: nuxt.options._layers.map(layer => join(layer.config.srcDir, 'server')),
    renderer: resolve(distDir, 'core/runtime/nitro/renderer'),
    errorHandler: resolve(distDir, 'core/runtime/nitro/error'),
    nodeModulesDirs: nuxt.options.modulesDir,
    handlers,
    devHandlers: [],
    baseURL: nuxt.options.app.baseURL,
    runtimeConfig: {
      ...nuxt.options.runtimeConfig,
      nitro: {
        envPrefix: 'NUXT_',
        ...nuxt.options.runtimeConfig.nitro
      }
    },
    typescript: {
      generateTsConfig: false
    },
    publicAssets: [
      {
        baseURL: nuxt.options.app.buildAssetsDir,
        dir: resolve(nuxt.options.buildDir, 'dist/client')
      },
      ...nuxt.options._layers
        .map(layer => join(layer.config.srcDir, layer.config.dir?.public || 'public'))
        .filter(dir => existsSync(dir))
        .map(dir => ({ dir }))
    ],
    prerender: {
      crawlLinks: nuxt.options._generate ? nuxt.options.generate.crawler : false,
      routes: []
        .concat(nuxt.options._generate ? ['/', ...nuxt.options.generate.routes] : [])
        .concat(nuxt.options.ssr === false ? ['/', '/200', '/404'] : [])
    },
    sourcemap: nuxt.options.sourcemap,
    externals: {
      inline: [
        ...(nuxt.options.dev ? [] : ['vue', '@vue/', '@nuxt/', nuxt.options.buildDir]),
        'nuxt/dist',
        'nuxt3/dist'
      ]
    },
    alias: {
      // TODO: #590
      'vue/server-renderer': 'vue/server-renderer',
      'vue/compiler-sfc': 'vue/compiler-sfc',
      vue: await resolvePath(`vue/dist/vue.cjs${nuxt.options.dev ? '' : '.prod'}.js`),

      // Vue 3 mocks
      'estree-walker': 'unenv/runtime/mock/proxy',
      '@babel/parser': 'unenv/runtime/mock/proxy',
      '@vue/compiler-core': 'unenv/runtime/mock/proxy',
      '@vue/compiler-dom': 'unenv/runtime/mock/proxy',
      '@vue/compiler-ssr': 'unenv/runtime/mock/proxy',
      '@vue/devtools-api': 'unenv/runtime/mock/proxy',

      // Renderer
      '#vue-renderer': resolve(distDir, 'core/runtime/nitro/vue3'),

      // Paths
      '#paths': resolve(distDir, 'core/runtime/nitro/paths'),

      // Nuxt aliases
      ...nuxt.options.alias
    },
    replace: {
      'process.env.NUXT_NO_SSR': nuxt.options.ssr === false ? true : undefined
    },
    rollupConfig: {
      plugins: []
    }
  })

  // Extend nitro config with hook
  await nuxt.callHook('nitro:config', nitroConfig)

  // Init nitro
  const nitro = await createNitro(nitroConfig)

  // Expose nitro to modules
  await nuxt.callHook('nitro:init', nitro)

  // Connect vfs storages
  nitro.vfs = nuxt.vfs = nitro.vfs || nuxt.vfs || {}

  // Connect hooks
  nuxt.hook('close', () => nitro.hooks.callHook('close'))

  // Register nuxt protection patterns
  nitro.hooks.hook('rollup:before', (nitro) => {
    const plugin = ImportProtectionPlugin.rollup({
      rootDir: nuxt.options.rootDir,
      patterns: [
        ...['#app', /^#build(\/|$)/]
          .map(p => [p, 'Vue app aliases are not allowed in server routes.']) as [RegExp | string, string][]
      ]
    })
    nitro.options.rollupConfig.plugins.push(plugin)
  })

  // Setup handlers
  const devMidlewareHandler = dynamicEventHandler()
  nitro.options.devHandlers.unshift({ handler: devMidlewareHandler })
  nitro.options.devHandlers.push(...devHandlers)
  nitro.options.handlers.unshift({
    route: '/__nuxt_error',
    lazy: true,
    handler: resolve(distDir, 'core/runtime/nitro/renderer')
  })

  // Add typed route responses
  nuxt.hook('prepare:types', async (opts) => {
    if (nuxt.options._prepare) {
      await scanHandlers(nitro)
      await writeTypes(nitro)
    }
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/nitro.d.ts') })
  })

  // nuxt build/dev
  nuxt.hook('build:done', async () => {
    await nuxt.callHook('nitro:build:before', nitro)
    if (nuxt.options.dev) {
      await build(nitro)
    } else {
      await prepare(nitro)
      await copyPublicAssets(nitro)
      await prerender(nitro)
      if (!nuxt.options._generate) {
        await build(nitro)
      } else {
        const distDir = resolve(nuxt.options.rootDir, 'dist')
        if (!existsSync(distDir)) {
          await fsp.symlink(nitro.options.output.publicDir, distDir, 'junction').catch(() => {})
        }
      }
    }
  })

  // nuxt dev
  if (nuxt.options.dev) {
    nuxt.hook('build:compile', ({ compiler }) => {
      compiler.outputFileSystem = { ...fsExtra, join } as any
    })
    nuxt.hook('server:devMiddleware', (m) => { devMidlewareHandler.set(toEventHandler(m)) })
    nuxt.server = createDevServer(nitro)
    nuxt.hook('build:resources', () => {
      nuxt.server.reload()
    })
    const waitUntilCompile = new Promise<void>(resolve => nitro.hooks.hook('compiled', () => resolve()))
    nuxt.hook('build:done', () => waitUntilCompile)
  }
}

async function resolveHandlers (nuxt: Nuxt) {
  const handlers: NitroEventHandler[] = [...nuxt.options.serverHandlers]
  const devHandlers: NitroDevEventHandler[] = [...nuxt.options.devServerHandlers]

  // Map legacy serverMiddleware to handlers
  for (let m of nuxt.options.serverMiddleware) {
    if (typeof m === 'string' || typeof m === 'function' /* legacy middleware */) { m = { handler: m } }
    const route = m.path || m.route || '/'
    const handler = m.handler || m.handle
    if (typeof handler !== 'string' || typeof route !== 'string') {
      devHandlers.push({ route, handler })
    } else {
      delete m.handler
      delete m.path
      handlers.push({
        ...m,
        route,
        middleware: true,
        handler: await resolvePath(handler)
      })
    }
  }

  return {
    handlers,
    devHandlers
  }
}
