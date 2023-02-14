import { existsSync, promises as fsp } from 'node:fs'
import { resolve, join } from 'pathe'
import { createNitro, createDevServer, build, prepare, copyPublicAssets, writeTypes, scanHandlers, prerender } from 'nitropack'
import type { NitroConfig, Nitro } from 'nitropack'
import { logger, resolvePath } from '@nuxt/kit'
import escapeRE from 'escape-string-regexp'
import { defu } from 'defu'
import fsExtra from 'fs-extra'
import { dynamicEventHandler } from 'h3'
import { createHeadCore } from 'unhead'
import { renderSSRHead } from '@unhead/ssr'
import { distDir } from '../dirs'
import { ImportProtectionPlugin } from './plugins/import-protection'
import type { Nuxt } from 'nuxt/schema'

export async function initNitro (nuxt: Nuxt & { _nitro?: Nitro }) {
  // Resolve config
  const _nitroConfig = ((nuxt.options as any).nitro || {}) as NitroConfig

  const excludePaths = nuxt.options._layers
    .flatMap(l => [
      l.cwd.match(/(?<=\/)node_modules\/(.+)$/)?.[1],
      l.cwd.match(/\.pnpm\/.+\/node_modules\/(.+)$/)?.[1]
    ])
    .filter((dir): dir is string => Boolean(dir))
    .map(dir => escapeRE(dir))
  const excludePattern = excludePaths.length
    ? [new RegExp(`node_modules\\/(?!${excludePaths.join('|')})`)]
    : [/node_modules/]

  const nitroConfig: NitroConfig = defu(_nitroConfig, <NitroConfig>{
    debug: nuxt.options.debug,
    rootDir: nuxt.options.rootDir,
    workspaceDir: nuxt.options.workspaceDir,
    srcDir: nuxt.options.serverDir,
    dev: nuxt.options.dev,
    buildDir: nuxt.options.buildDir,
    imports: {
      imports: [
        {
          as: '__buildAssetsURL',
          name: 'buildAssetsURL',
          from: resolve(distDir, 'core/runtime/nitro/paths')
        },
        {
          as: '__publicAssetsURL',
          name: 'publicAssetsURL',
          from: resolve(distDir, 'core/runtime/nitro/paths')
        }
      ],
      exclude: [...excludePattern, /[\\/]\.git[\\/]/]
    },
    esbuild: {
      options: { exclude: excludePattern }
    },
    analyze: nuxt.options.build.analyze && {
      template: 'treemap',
      projectRoot: nuxt.options.rootDir,
      filename: join(nuxt.options.rootDir, '.nuxt/stats', '{name}.html')
    },
    scanDirs: nuxt.options._layers.map(layer => (layer.config.serverDir || layer.config.srcDir) && resolve(layer.cwd, layer.config.serverDir || resolve(layer.config.srcDir, 'server'))).filter(Boolean),
    renderer: resolve(distDir, 'core/runtime/nitro/renderer'),
    errorHandler: resolve(distDir, 'core/runtime/nitro/error'),
    nodeModulesDirs: nuxt.options.modulesDir,
    handlers: nuxt.options.serverHandlers,
    devHandlers: [],
    baseURL: nuxt.options.app.baseURL,
    virtual: {
      '#internal/nuxt.config.mjs': () => nuxt.vfs['#build/nuxt.config']
    },
    routeRules: {
      '/__nuxt_error': { cache: false }
    },
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
      nuxt.options.dev
        ? { dir: resolve(nuxt.options.buildDir, 'dist/client') }
        : {
            dir: join(nuxt.options.buildDir, 'dist/client', nuxt.options.app.buildAssetsDir),
            maxAge: 30 * 24 * 60 * 60,
            baseURL: nuxt.options.app.buildAssetsDir
          },
      ...nuxt.options._layers
        .map(layer => join(layer.config.srcDir, layer.config.dir?.public || 'public'))
        .filter(dir => existsSync(dir))
        .map(dir => ({ dir }))
    ],
    prerender: {
      crawlLinks: nuxt.options._generate ?? undefined,
      routes: ([] as string[])
        .concat(nuxt.options.generate.routes)
        .concat(nuxt.options._generate ? [nuxt.options.ssr ? '/' : '/index.html', '/200.html', '/404.html'] : [])
    },
    sourceMap: nuxt.options.sourcemap.server,
    externals: {
      inline: [
        ...(nuxt.options.dev
          ? []
          : [
              ...nuxt.options.experimental.externalVue ? [] : ['vue', '@vue/'],
              '@nuxt/',
              nuxt.options.buildDir
            ]),
        ...nuxt.options.build.transpile.filter(i => typeof i === 'string'),
        'nuxt/dist',
        'nuxt3/dist',
        distDir
      ]
    },
    alias: {
      ...nuxt.options.experimental.externalVue
        ? {}
        : {
            'vue/compiler-sfc': 'vue/compiler-sfc',
            'vue/server-renderer': 'vue/server-renderer',
            vue: await resolvePath(`vue/dist/vue.cjs${nuxt.options.dev ? '' : '.prod'}.js`)
          },
      // Vue 3 mocks
      'estree-walker': 'unenv/runtime/mock/proxy',
      '@babel/parser': 'unenv/runtime/mock/proxy',
      '@vue/compiler-core': 'unenv/runtime/mock/proxy',
      '@vue/compiler-dom': 'unenv/runtime/mock/proxy',
      '@vue/compiler-ssr': 'unenv/runtime/mock/proxy',
      '@vue/devtools-api': 'vue-devtools-stub',

      // Paths
      '#paths': resolve(distDir, 'core/runtime/nitro/paths'),

      // Nuxt aliases
      ...nuxt.options.alias
    },
    replace: {
      'process.env.NUXT_NO_SSR': nuxt.options.ssr === false,
      'process.env.NUXT_EARLY_HINTS': nuxt.options.experimental.writeEarlyHints !== false,
      'process.env.NUXT_NO_SCRIPTS': !!nuxt.options.experimental.noScripts && !nuxt.options.dev,
      'process.env.NUXT_INLINE_STYLES': !!nuxt.options.experimental.inlineSSRStyles,
      'process.env.NUXT_PAYLOAD_EXTRACTION': !!nuxt.options.experimental.payloadExtraction,
      'process.env.NUXT_COMPONENT_ISLANDS': !!nuxt.options.experimental.componentIslands,
      'process.dev': nuxt.options.dev,
      __VUE_PROD_DEVTOOLS__: false
    },
    rollupConfig: {
      output: {},
      plugins: []
    }
  })

  // Add head chunk for SPA renders
  const head = createHeadCore()
  head.push(nuxt.options.app.head)
  const headChunk = await renderSSRHead(head)
  nitroConfig.virtual!['#head-static'] = `export default ${JSON.stringify(headChunk)}`

  // Add fallback server for `ssr: false`
  if (!nuxt.options.ssr) {
    nitroConfig.virtual!['#build/dist/server/server.mjs'] = 'export default () => {}'
    // In case a non-normalized absolute path is called for on Windows
    if (process.platform === 'win32') {
      nitroConfig.virtual!['#build/dist/server/server.mjs'.replace(/\//g, '\\')] = 'export default () => {}'
    }
  }

  if (!nuxt.options.experimental.inlineSSRStyles) {
    nitroConfig.virtual!['#build/dist/server/styles.mjs'] = 'export default {}'
    // In case a non-normalized absolute path is called for on Windows
    if (process.platform === 'win32') {
      nitroConfig.virtual!['#build/dist/server/styles.mjs'.replace(/\//g, '\\')] = 'export default {}'
    }
  }

  // Register nuxt protection patterns
  nitroConfig.rollupConfig!.plugins = await nitroConfig.rollupConfig!.plugins || []
  nitroConfig.rollupConfig!.plugins = Array.isArray(nitroConfig.rollupConfig!.plugins) ? nitroConfig.rollupConfig!.plugins : [nitroConfig.rollupConfig!.plugins]
  nitroConfig.rollupConfig!.plugins!.push(
    ImportProtectionPlugin.rollup({
      rootDir: nuxt.options.rootDir,
      patterns: [
        ...['#app', /^#build(\/|$)/]
          .map(p => [p, 'Vue app aliases are not allowed in server routes.']) as [RegExp | string, string][]
      ],
      exclude: [/core[\\/]runtime[\\/]nitro[\\/]renderer/]
    })
  )

  // Extend nitro config with hook
  await nuxt.callHook('nitro:config', nitroConfig)

  // Init nitro
  const nitro = await createNitro(nitroConfig)

  // Expose nitro to modules and kit
  nuxt._nitro = nitro
  await nuxt.callHook('nitro:init', nitro)

  // Connect vfs storages
  nitro.vfs = nuxt.vfs = nitro.vfs || nuxt.vfs || {}

  // Connect hooks
  nuxt.hook('close', () => nitro.hooks.callHook('close'))
  nitro.hooks.hook('prerender:routes', (routes) => {
    nuxt.callHook('prerender:routes', { routes })
  })

  // Setup handlers
  const devMiddlewareHandler = dynamicEventHandler()
  nitro.options.devHandlers.unshift({ handler: devMiddlewareHandler })
  nitro.options.devHandlers.push(...nuxt.options.devServerHandlers)
  nitro.options.handlers.unshift({
    route: '/__nuxt_error',
    lazy: true,
    handler: resolve(distDir, 'core/runtime/nitro/renderer')
  })

  // Add typed route responses
  nuxt.hook('prepare:types', async (opts) => {
    if (!nuxt.options.dev) {
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
        logger.restoreAll()
        await build(nitro)
        logger.wrapAll()
      } else {
        const distDir = resolve(nuxt.options.rootDir, 'dist')
        if (!existsSync(distDir)) {
          await fsp.symlink(nitro.options.output.publicDir, distDir, 'junction').catch(() => { })
        }
      }
    }
  })

  // nuxt dev
  if (nuxt.options.dev) {
    nuxt.hook('webpack:compile', ({ compiler }) => { compiler.outputFileSystem = { ...fsExtra, join } as any })
    nuxt.hook('webpack:compiled', () => { nuxt.server.reload() })
    nuxt.hook('vite:compiled', () => { nuxt.server.reload() })

    nuxt.hook('server:devHandler', (h) => { devMiddlewareHandler.set(h) })
    nuxt.server = createDevServer(nitro)

    const waitUntilCompile = new Promise<void>(resolve => nitro.hooks.hook('compiled', () => resolve()))
    nuxt.hook('build:done', () => waitUntilCompile)
  }
}
