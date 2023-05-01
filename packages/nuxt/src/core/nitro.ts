import { existsSync, promises as fsp } from 'node:fs'
import { join, relative, resolve } from 'pathe'
import { build, copyPublicAssets, createDevServer, createNitro, prepare, prerender, scanHandlers, writeTypes } from 'nitropack'
import type { Nitro, NitroConfig } from 'nitropack'
import { logger, resolvePath } from '@nuxt/kit'
import escapeRE from 'escape-string-regexp'
import { defu } from 'defu'
import fsExtra from 'fs-extra'
import { dynamicEventHandler } from 'h3'
import { createHeadCore } from '@unhead/vue'
import { renderSSRHead } from '@unhead/ssr'
import type { Nuxt } from 'nuxt/schema'

import { distDir } from '../dirs'
import { ImportProtectionPlugin } from './plugins/import-protection'

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
      autoImports: nuxt.options.imports.autoImport,
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
        },
        {
          // TODO: Remove after https://github.com/unjs/nitro/issues/1049
          as: 'defineAppConfig',
          name: 'defineAppConfig',
          from: resolve(distDir, 'core/runtime/nitro/config'),
          priority: -1
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
    appConfig: nuxt.options.appConfig,
    appConfigFiles: nuxt.options._layers.map(
      layer => resolve(layer.config.srcDir, 'app.config')
    ),
    typescript: {
      generateTsConfig: false
    },
    publicAssets: [
      nuxt.options.dev
        ? { dir: resolve(nuxt.options.buildDir, 'dist/client') }
        : {
            dir: join(nuxt.options.buildDir, 'dist/client', nuxt.options.app.buildAssetsDir),
            maxAge: 31536000 /* 1 year */,
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
      ],
      traceInclude: [
        // force include files used in generated code from the runtime-compiler
        ...(nuxt.options.vue.runtimeCompiler && !nuxt.options.experimental.externalVue)
          ? [
              ...nuxt.options.modulesDir.reduce<string[]>((targets, path) => {
                const serverRendererPath = resolve(path, 'vue/server-renderer/index.js')
                if (existsSync(serverRendererPath)) { targets.push(serverRendererPath) }
                return targets
              }, [])
            ]
          : []
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
      ...nuxt.options.vue.runtimeCompiler || nuxt.options.experimental.externalVue
        ? {}
        : {
            'estree-walker': 'unenv/runtime/mock/proxy',
            '@babel/parser': 'unenv/runtime/mock/proxy',
            '@vue/compiler-core': 'unenv/runtime/mock/proxy',
            '@vue/compiler-dom': 'unenv/runtime/mock/proxy',
            '@vue/compiler-ssr': 'unenv/runtime/mock/proxy'
          },
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
      'process.env.NUXT_JSON_PAYLOADS': !!nuxt.options.experimental.renderJsonPayloads,
      'process.env.NUXT_COMPONENT_ISLANDS': !!nuxt.options.experimental.componentIslands,
      'process.dev': nuxt.options.dev,
      __VUE_PROD_DEVTOOLS__: false
    },
    rollupConfig: {
      output: {},
      plugins: []
    }
  })

  // Resolve user-provided paths
  nitroConfig.srcDir = resolve(nuxt.options.rootDir, nuxt.options.srcDir, nitroConfig.srcDir!)

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

  // Add backward-compatible middleware to respect `x-nuxt-no-ssr` header
  if (nuxt.options.experimental.respectNoSSRHeader) {
    nitroConfig.handlers = nitroConfig.handlers || []
    nitroConfig.handlers.push({
      handler: resolve(distDir, 'core/runtime/nitro/no-ssr'),
      middleware: true
    })
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

  // Enable runtime compiler client side
  if (nuxt.options.vue.runtimeCompiler) {
    nuxt.hook('vite:extendConfig', (config, { isClient }) => {
      if (isClient) {
        if (Array.isArray(config.resolve!.alias)) {
          config.resolve!.alias.push({
            find: 'vue',
            replacement: 'vue/dist/vue.esm-bundler'
          })
        } else {
          config.resolve!.alias = {
            ...config.resolve!.alias,
            vue: 'vue/dist/vue.esm-bundler'
          }
        }
      }
    })
    nuxt.hook('webpack:config', (configuration) => {
      const clientConfig = configuration.find(config => config.name === 'client')
      if (!clientConfig!.resolve) { clientConfig!.resolve!.alias = {} }
      if (Array.isArray(clientConfig!.resolve!.alias)) {
        clientConfig!.resolve!.alias.push({
          name: 'vue',
          alias: 'vue/dist/vue.esm-bundler'
        })
      } else {
        clientConfig!.resolve!.alias!.vue = 'vue/dist/vue.esm-bundler'
      }
    })
  }

  // Setup handlers
  const devMiddlewareHandler = dynamicEventHandler()
  nitro.options.devHandlers.unshift({ handler: devMiddlewareHandler })
  nitro.options.devHandlers.push(...nuxt.options.devServerHandlers)
  nitro.options.handlers.unshift({
    route: '/__nuxt_error',
    lazy: true,
    handler: resolve(distDir, 'core/runtime/nitro/renderer')
  })

  if (nuxt.options.experimental.noVueServer) {
    nitro.hooks.hook('rollup:before', (nitro) => {
      if (nitro.options.preset === 'nitro-prerender') { return }
      const nuxtErrorHandler = nitro.options.handlers.findIndex(h => h.route === '/__nuxt_error')
      if (nuxtErrorHandler >= 0) {
        nitro.options.handlers.splice(nuxtErrorHandler, 1)
      }

      nitro.options.renderer = undefined
      nitro.options.errorHandler = '#internal/nitro/error'
    })
  }

  // Add typed route responses
  nuxt.hook('prepare:types', async (opts) => {
    if (!nuxt.options.dev) {
      await scanHandlers(nitro)
      await writeTypes(nitro)
    }
    // Exclude nitro output dir from typescript
    opts.tsConfig.exclude = opts.tsConfig.exclude || []
    opts.tsConfig.exclude.push(relative(nuxt.options.buildDir, resolve(nuxt.options.rootDir, nitro.options.output.dir)))
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
      await nuxt.callHook('nitro:build:public-assets', nitro)
      await prerender(nitro)
      if (!nuxt.options._generate) {
        logger.restoreAll()
        await build(nitro)
        logger.wrapAll()
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
    nuxt.hook('webpack:compile', ({ compiler }) => { compiler.outputFileSystem = { ...fsExtra, join } as any })
    nuxt.hook('webpack:compiled', () => { nuxt.server.reload() })
    nuxt.hook('vite:compiled', () => { nuxt.server.reload() })

    nuxt.hook('server:devHandler', (h) => { devMiddlewareHandler.set(h) })
    nuxt.server = createDevServer(nitro)

    const waitUntilCompile = new Promise<void>(resolve => nitro.hooks.hook('compiled', () => resolve()))
    nuxt.hook('build:done', () => waitUntilCompile)
  }
}
