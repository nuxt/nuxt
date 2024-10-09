import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { logger, resolvePath, tryImportModule } from '@nuxt/kit'
import { joinURL, withTrailingSlash, withoutLeadingSlash } from 'ufo'
import type { ViteConfig } from '@nuxt/schema'
import defu from 'defu'
import type { Nitro } from 'nitro/types'
import type { ViteBuildContext } from './vite'
import { createViteLogger } from './utils/logger'
import { initViteNodeServer } from './vite-node'
import { writeManifest } from './manifest'
import { transpile } from './utils/transpile'
import { createSourcemapPreserver } from './plugins/nitro-sourcemap'

export async function buildServer (ctx: ViteBuildContext) {
  const helper = ctx.nuxt.options.nitro.imports !== false ? '' : 'globalThis.'
  const entry = ctx.nuxt.options.ssr ? ctx.entry : await resolvePath(resolve(ctx.nuxt.options.appDir, 'entry-spa'))
  const serverConfig: ViteConfig = vite.mergeConfig(ctx.config, vite.mergeConfig({
    configFile: false,
    base: ctx.nuxt.options.dev
      ? joinURL(ctx.nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', ctx.nuxt.options.app.buildAssetsDir)
      : undefined,
    experimental: {
      renderBuiltUrl: (filename, { type, hostType }) => {
        if (hostType !== 'js') {
          // In CSS we only use relative paths until we craft a clever runtime CSS hack
          return { relative: true }
        }
        if (type === 'public') {
          return { runtime: `${helper}__publicAssetsURL(${JSON.stringify(filename)})` }
        }
        if (type === 'asset') {
          const relativeFilename = filename.replace(withTrailingSlash(withoutLeadingSlash(ctx.nuxt.options.app.buildAssetsDir)), '')
          return { runtime: `${helper}__buildAssetsURL(${JSON.stringify(relativeFilename)})` }
        }
      },
    },
    css: {
      devSourcemap: !!ctx.nuxt.options.sourcemap.server,
    },
    define: {
      'process.server': true,
      'process.client': false,
      'process.browser': false,
      'import.meta.server': true,
      'import.meta.client': false,
      'import.meta.browser': false,
      'window': 'undefined',
      'document': 'undefined',
      'navigator': 'undefined',
      'location': 'undefined',
      'XMLHttpRequest': 'undefined',
    },
    optimizeDeps: {
      noDiscovery: true,
    },
    resolve: {
      conditions: ((ctx.nuxt as any)._nitro as Nitro)?.options.exportConditions,
    },
    ssr: {
      external: [
        'nitro/runtime',
      ],
      noExternal: [
        ...transpile({ isServer: true, isDev: ctx.nuxt.options.dev }),
        '/__vue-jsx',
        '#app',
        /^nuxt(\/|$)/,
        /(nuxt|nuxt3|nuxt-nightly)\/(dist|src|app)/,
      ],
    },
    cacheDir: resolve(ctx.nuxt.options.rootDir, ctx.config.cacheDir ?? 'node_modules/.cache/vite', 'server'),
    build: {
      // we'll display this in nitro build output
      reportCompressedSize: false,
      sourcemap: ctx.nuxt.options.sourcemap.server ? ctx.config.build?.sourcemap ?? ctx.nuxt.options.sourcemap.server : false,
      outDir: resolve(ctx.nuxt.options.buildDir, 'dist/server'),
      ssr: true,
      rollupOptions: {
        input: { server: entry },
        external: ['nitro/runtime', '#internal/nuxt/paths', '#internal/nuxt/app-config'],
        output: {
          entryFileNames: '[name].mjs',
          format: 'module',
          generatedCode: {
            symbols: true, // temporary fix for https://github.com/vuejs/core/issues/8351,
            constBindings: true,
          },
        },
        onwarn (warning, rollupWarn) {
          if (warning.code && ['UNUSED_EXTERNAL_IMPORT'].includes(warning.code)) {
            return
          }
          rollupWarn(warning)
        },
      },
    },
    server: {
      warmup: {
        ssrFiles: [ctx.entry],
      },
      // https://github.com/vitest-dev/vitest/issues/229#issuecomment-1002685027
      preTransformRequests: false,
      hmr: false,
    },
  } satisfies vite.InlineConfig, ctx.nuxt.options.vite.$server || {}))

  if (!ctx.nuxt.options.dev) {
    const { runtimeDependencies = [] } = await tryImportModule<typeof import('nitro/runtime/meta')>('nitro/runtime/meta', {
      paths: ctx.nuxt.options.modulesDir,
    }) || {}
    if (Array.isArray(serverConfig.ssr!.external)) {
      serverConfig.ssr!.external.push(
        // explicit dependencies we use in our ssr renderer - these can be inlined (if necessary) in the nitro build
        'unhead', '@unhead/ssr', 'unctx', 'h3', 'devalue', '@nuxt/devalue', 'radix3', 'rou3', 'unstorage', 'hookable',
        // ensure we only have one version of vue if nitro is going to inline anyway
        ...((ctx.nuxt as any)._nitro as Nitro).options.inlineDynamicImports ? ['vue', '@vue/server-renderer', '@unhead/vue'] : [],
        // dependencies we might share with nitro - these can be inlined (if necessary) in the nitro build
        ...runtimeDependencies,
      )
    }
  }

  // tell rollup's nitro build about the original sources of the generated vite server build
  if (ctx.nuxt.options.sourcemap.server && !ctx.nuxt.options.dev) {
    const { vitePlugin, nitroPlugin } = createSourcemapPreserver()
    serverConfig.plugins!.push(vitePlugin)
    ctx.nuxt.hook('nitro:build:before', (nitro) => {
      nitro.options.rollupConfig = defu(nitro.options.rollupConfig, {
        plugins: [nitroPlugin],
      })
    })
  }

  serverConfig.customLogger = createViteLogger(serverConfig)

  await ctx.nuxt.callHook('vite:extendConfig', serverConfig, { isClient: false, isServer: true })

  serverConfig.plugins!.unshift(
    vuePlugin(serverConfig.vue),
    viteJsxPlugin(serverConfig.vueJsx),
  )

  if (!ctx.nuxt.options.dev) {
    serverConfig.plugins!.push({
      name: 'nuxt:nitro:vue-feature-flags',
      configResolved (config) {
        for (const key in config.define) {
          if (key.startsWith('__VUE')) {
            // tree-shake vue feature flags for non-node targets
            ((ctx.nuxt as any)._nitro as Nitro).options.replace[key] = config.define[key]
          }
        }
      },
    })
  }

  await ctx.nuxt.callHook('vite:configResolved', serverConfig, { isClient: false, isServer: true })

  const onBuild = () => ctx.nuxt.callHook('vite:compiled')

  // Production build
  if (!ctx.nuxt.options.dev) {
    const start = Date.now()
    logger.info('Building server...')
    logger.restoreAll()
    await vite.build(serverConfig)
    logger.wrapAll()
    // Write production client manifest
    await writeManifest(ctx)
    await onBuild()
    logger.success(`Server built in ${Date.now() - start}ms`)
    return
  }

  if (!ctx.nuxt.options.ssr) {
    await writeManifest(ctx)
    await onBuild()
    return
  }

  // Start development server
  const viteServer = await vite.createServer(serverConfig)
  ctx.ssrServer = viteServer

  // Close server on exit
  ctx.nuxt.hook('close', () => viteServer.close())

  await ctx.nuxt.callHook('vite:serverCreated', viteServer, { isClient: false, isServer: true })

  // Initialize plugins
  await viteServer.pluginContainer.buildStart({})

  await initViteNodeServer(ctx)
}
