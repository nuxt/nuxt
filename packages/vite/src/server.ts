import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { logger, resolvePath } from '@nuxt/kit'
import { joinURL, withTrailingSlash } from 'ufo'
import type { Nuxt, ViteConfig } from '@nuxt/schema'
import type { Nitro } from 'nitropack/types'
import escapeStringRegexp from 'escape-string-regexp'
import type { ViteBuildContext } from './vite'
import { createViteLogger } from './utils/logger'
import { writeDevServer } from './vite-node'
import { writeManifest } from './manifest'
import { transpile } from './utils/transpile'
import { SourcemapPreserverPlugin } from './plugins/sourcemap-preserver'
import { VueFeatureFlagsPlugin } from './plugins/vue-feature-flags'

export async function buildServer (nuxt: Nuxt, ctx: ViteBuildContext) {
  const serverEntry = nuxt.options.ssr ? ctx.entry : await resolvePath(resolve(nuxt.options.appDir, 'entry-spa'))
  const serverConfig: ViteConfig = vite.mergeConfig(ctx.config, vite.mergeConfig({
    configFile: false,
    base: nuxt.options.dev
      ? joinURL(nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', nuxt.options.app.buildAssetsDir)
      : undefined,
    css: {
      devSourcemap: !!nuxt.options.sourcemap.server,
    },
    plugins: [
      VueFeatureFlagsPlugin(nuxt),
      // tell rollup's nitro build about the original sources of the generated vite server build
      SourcemapPreserverPlugin(nuxt),
    ],
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
      include: undefined,
    },
    resolve: {
      conditions: ((nuxt as any)._nitro as Nitro)?.options.exportConditions,
    },
    ssr: {
      external: [
        'nitro/runtime',
        // TODO: remove in v5
        '#internal/nitro',
        '#internal/nitro/utils',
      ],
      noExternal: [
        ...transpile({ isServer: true, isDev: nuxt.options.dev }),
        '/__vue-jsx',
        '#app',
        /^nuxt(\/|$)/,
        /(nuxt|nuxt3|nuxt-nightly)\/(dist|src|app)/,
      ],
    },
    cacheDir: resolve(nuxt.options.rootDir, ctx.config.cacheDir ?? 'node_modules/.cache/vite', 'server'),
    build: {
      // we'll display this in nitro build output
      reportCompressedSize: false,
      sourcemap: nuxt.options.sourcemap.server ? ctx.config.build?.sourcemap ?? nuxt.options.sourcemap.server : false,
      outDir: resolve(nuxt.options.buildDir, 'dist/server'),
      ssr: true,
      rollupOptions: {
        input: { server: serverEntry },
        external: [
          'nitro/runtime',
          // TODO: remove in v5
          '#internal/nitro',
          'nitropack/runtime',
          '#internal/nuxt/paths',
          '#internal/nuxt/app-config',
          '#app-manifest',
          '#shared',
          new RegExp('^' + escapeStringRegexp(withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))),
        ],
        output: {
          entryFileNames: '[name].mjs',
          format: 'module',

          ...(vite.rolldownVersion
            // Wait for https://github.com/rolldown/rolldown/issues/206
            ? {}
            : {
                generatedCode: {
                  symbols: true, // temporary fix for https://github.com/vuejs/core/issues/8351,
                  constBindings: true,
                  // temporary fix for https://github.com/rollup/rollup/issues/5975
                  arrowFunctions: true,
                },
              }),
        },
        onwarn (warning, rollupWarn) {
          if (warning.code && 'UNUSED_EXTERNAL_IMPORT' === warning.code) {
            return
          }
          rollupWarn(warning)
        },
      },
    },
    server: {
      warmup: {
        ssrFiles: [serverEntry],
      },
      // https://github.com/vitest-dev/vitest/issues/229#issuecomment-1002685027
      preTransformRequests: false,
      hmr: false,
    },
  } satisfies vite.InlineConfig, nuxt.options.vite.$server || {}))

  if (serverConfig.build?.rollupOptions?.output && !Array.isArray(serverConfig.build.rollupOptions.output)) {
    serverConfig.build.rollupOptions.output.manualChunks = undefined

    if (vite.rolldownVersion) {
      serverConfig.build.rollupOptions.output.advancedChunks = undefined
    }
  }

  serverConfig.customLogger = createViteLogger(serverConfig, { hideOutput: !nuxt.options.dev })

  await nuxt.callHook('vite:extendConfig', serverConfig, { isClient: false, isServer: true })

  serverConfig.plugins!.unshift(
    vuePlugin(serverConfig.vue),
    viteJsxPlugin(serverConfig.vueJsx),
  )

  await nuxt.callHook('vite:configResolved', serverConfig, { isClient: false, isServer: true })

  // Production build
  if (!nuxt.options.dev) {
    const start = Date.now()
    logger.info('Building server...')
    logger.restoreAll()
    await vite.build(serverConfig)
    logger.wrapAll()
    // Write production client manifest
    await writeManifest(ctx)
    await nuxt.callHook('vite:compiled')
    logger.success(`Server built in ${Date.now() - start}ms`)
    return
  }

  if (!nuxt.options.ssr) {
    await writeManifest(ctx)
    await nuxt.callHook('vite:compiled')
    return
  }

  // Start development server
  const ssrServer = await vite.createServer(serverConfig)
  ctx.ssrServer = ssrServer

  // Close server on exit
  nuxt.hook('close', () => ssrServer.close())

  await nuxt.callHook('vite:serverCreated', ssrServer, { isClient: false, isServer: true })

  // Initialize plugins
  await ssrServer.pluginContainer.buildStart({})

  await writeDevServer(nuxt)
}
