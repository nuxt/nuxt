import { dirname, isAbsolute, join, relative, resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import type { BuildOptions } from 'vite'
import { logger, useNitro } from '@nuxt/kit'
import { joinURL, withoutLeadingSlash } from 'ufo'
import { defu } from 'defu'
import { defineEnv } from 'unenv'
import { resolveModulePath } from 'exsolve'
import type { Nuxt, ViteConfig } from '@nuxt/schema'

import type { ViteBuildContext } from './vite'
import { DevStyleSSRPlugin } from './plugins/dev-style-ssr'
import { RuntimePathsPlugin } from './plugins/runtime-paths'
import { TypeCheckPlugin } from './plugins/type-check'
import { ModulePreloadPolyfillPlugin } from './plugins/module-preload-polyfill'
import { ViteNodePlugin } from './plugins/vite-node'
import { createViteLogger } from './utils/logger'
import { StableEntryPlugin } from './plugins/stable-entry'
import { AnalyzePlugin } from './plugins/analyze'
import { DevServerPlugin } from './plugins/dev-server'

export async function buildClient (nuxt: Nuxt, ctx: ViteBuildContext) {
  const nodeCompat = nuxt.options.experimental.clientNodeCompat
    ? {
        alias: defineEnv({ nodeCompat: true, resolve: true }).env.alias,
        define: { global: 'globalThis' },
      }
    : { alias: {}, define: {} }

  const clientConfig: ViteConfig = vite.mergeConfig(ctx.config, vite.mergeConfig({
    configFile: false,
    base: nuxt.options.dev
      ? joinURL(nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', nuxt.options.app.buildAssetsDir)
      : './',
    css: {
      devSourcemap: !!nuxt.options.sourcemap.client,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(ctx.config.mode),
      'process.server': false,
      'process.client': true,
      'process.browser': true,
      'process.nitro': false,
      'process.prerender': false,
      'import.meta.server': false,
      'import.meta.client': true,
      'import.meta.browser': true,
      'import.meta.nitro': false,
      'import.meta.prerender': false,
      'module.hot': false,
      ...nodeCompat.define,
    },
    optimizeDeps: {
      entries: [ctx.entry],
      include: [],
      // We exclude Vue and Nuxt common dependencies from optimization
      // as they already ship ESM.
      //
      // This will help to reduce the chance for users to encounter
      // common chunk conflicts that causing browser reloads.
      // We should also encourage module authors to add their deps to
      // `exclude` if they ships bundled ESM.
      //
      // Also since `exclude` is inert, it's safe to always include
      // all possible deps even if they are not used yet.
      //
      // @see https://github.com/antfu/nuxt-better-optimize-deps#how-it-works
      exclude: [
        // Vue
        'vue',
        '@vue/runtime-core',
        '@vue/runtime-dom',
        '@vue/reactivity',
        '@vue/shared',
        '@vue/devtools-api',
        'vue-router',
        'vue-demi',

        // Nuxt
        'nuxt',
        'nuxt/app',

        // Nuxt Deps
        '@unhead/vue',
        'consola',
        'defu',
        'devalue',
        'h3',
        'hookable',
        'klona',
        'ofetch',
        'pathe',
        'ufo',
        'unctx',
        'unenv',

        // these will never be imported on the client
        '#app-manifest',
      ],
    },
    resolve: {
      alias: {
        // user aliases
        ...nodeCompat.alias,
        ...ctx.config.resolve?.alias,
        'nitro/runtime': join(nuxt.options.buildDir, 'nitro.client.mjs'),
        // TODO: remove in v5
        '#internal/nitro': join(ctx.nuxt.options.buildDir, 'nitro.client.mjs'),
        'nitropack/runtime': join(ctx.nuxt.options.buildDir, 'nitro.client.mjs'),
        // work around vite optimizer bug
        '#app-manifest': resolveModulePath('mocked-exports/empty', { from: import.meta.url }),
      },
    },
    cacheDir: resolve(nuxt.options.rootDir, ctx.config.cacheDir ?? 'node_modules/.cache/vite', 'client'),
    build: {
      sourcemap: nuxt.options.sourcemap.client ? ctx.config.build?.sourcemap ?? nuxt.options.sourcemap.client : false,
      manifest: 'manifest.json',
      outDir: resolve(nuxt.options.buildDir, 'dist/client'),
      rollupOptions: {
        input: { entry: ctx.entry },
      },
    },
    plugins: [
      DevStyleSSRPlugin({
        srcDir: nuxt.options.srcDir,
        buildAssetsURL: joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir),
      }),
      RuntimePathsPlugin(),
      ViteNodePlugin(nuxt),
      // Type checking client panel
      TypeCheckPlugin(nuxt),
      ModulePreloadPolyfillPlugin(),
      // ensure changes in chunks do not invalidate whole build
      StableEntryPlugin(nuxt),
      AnalyzePlugin(nuxt),
      DevServerPlugin(nuxt),
    ],
    appType: 'custom',
    server: {
      warmup: {
        clientFiles: [ctx.entry],
      },
      middlewareMode: true,
    },
  } satisfies vite.InlineConfig, nuxt.options.vite.$client || {}))

  clientConfig.customLogger = createViteLogger(clientConfig)

  // We want to respect users' own rollup output options
  const fileNames = withoutLeadingSlash(join(nuxt.options.app.buildAssetsDir, '[hash].js'))
  const clientOutputDir = join(useNitro().options.output.publicDir, nuxt.options.app.buildAssetsDir)
  clientConfig.build!.rollupOptions = defu(clientConfig.build!.rollupOptions!, {
    output: {
      chunkFileNames: nuxt.options.dev ? undefined : fileNames,
      entryFileNames: nuxt.options.dev ? 'entry.js' : fileNames,
      sourcemapPathTransform (relativeSourcePath, sourcemapPath) {
        // client build is running in a temporary build directory, like `.nuxt/dist/client`
        // so we need to transform the sourcemap path to be relative to the final build directory
        if (!isAbsolute(relativeSourcePath)) {
          const absoluteSourcePath = resolve(dirname(sourcemapPath), relativeSourcePath)
          return relative(clientOutputDir, absoluteSourcePath)
        }
        return relativeSourcePath
      },
    } satisfies NonNullable<BuildOptions['rollupOptions']>['output'],
  }) as any

  await nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  clientConfig.plugins!.unshift(
    vuePlugin(clientConfig.vue),
    viteJsxPlugin(clientConfig.vueJsx),
  )

  await nuxt.callHook('vite:configResolved', clientConfig, { isClient: true, isServer: false })

  if (nuxt.options.dev) {
    // Dev
    const viteServer = await vite.createServer(clientConfig)
    ctx.clientServer = viteServer
    nuxt.hook('close', () => viteServer.close())
    await nuxt.callHook('vite:serverCreated', viteServer, { isClient: true, isServer: false })
  } else {
    // Build
    logger.info('Building client...')
    const start = Date.now()
    logger.restoreAll()
    await vite.build(clientConfig)
    logger.wrapAll()
    await nuxt.callHook('vite:compiled')
    logger.success(`Client built in ${Date.now() - start}ms`)
  }
}
