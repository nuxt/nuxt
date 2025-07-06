import type { IncomingMessage, ServerResponse } from 'node:http'
import { join, resolve } from 'pathe'
import * as vite from 'vite'
 import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import type { BuildOptions, ServerOptions } from 'vite'
import { logger, useNitro } from '@nuxt/kit'
import { getPort } from 'get-port-please'
import { joinURL, withoutLeadingSlash } from 'ufo'
import { defu } from 'defu'
import { defineEnv } from 'unenv'
import { resolveModulePath } from 'exsolve'
import { createError, defineEventHandler, handleCors, setHeader } from 'h3'
import type { Nuxt, ViteConfig } from '@nuxt/schema'

import type { ViteBuildContext } from './vite'
import { DevStyleSSRPlugin } from './plugins/dev-style-ssr'
import { RuntimePathsPlugin } from './plugins/runtime-paths'
import { TypeCheckPlugin } from './plugins/type-check'
import { ModulePreloadPolyfillPlugin } from './plugins/module-preload-polyfill'
import { ViteNodePlugin } from './vite-node'
import { createViteLogger } from './utils/logger'

export async function buildClient (nuxt: Nuxt, ctx: ViteBuildContext, vue: any) {
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

  // In build mode we explicitly override any vite options that vite is relying on
  // to detect whether to inject production or development code (such as HMR code)
  if (!nuxt.options.dev) {
    clientConfig.server!.hmr = false
  }

  // Inject an h3-based CORS handler in preference to vite's
  const useViteCors = clientConfig.server?.cors !== undefined
  if (!useViteCors) {
    clientConfig.server!.cors = false
  }

  // We want to respect users' own rollup output options
  const fileNames = withoutLeadingSlash(join(nuxt.options.app.buildAssetsDir, '[hash].js'))
  clientConfig.build!.rollupOptions = defu(clientConfig.build!.rollupOptions!, {
    output: {
      chunkFileNames: nuxt.options.dev ? undefined : fileNames,
      entryFileNames: nuxt.options.dev ? 'entry.js' : fileNames,
    } satisfies NonNullable<BuildOptions['rollupOptions']>['output'],
  }) as any

  if (clientConfig.server && clientConfig.server.hmr !== false) {
    const serverDefaults: Omit<ServerOptions, 'hmr'> & { hmr: Exclude<ServerOptions['hmr'], boolean> } = {
      hmr: {
        protocol: nuxt.options.devServer.https ? 'wss' : undefined,
      },
    }
    if (typeof clientConfig.server.hmr !== 'object' || !clientConfig.server.hmr.server) {
      const hmrPortDefault = 24678 // Vite's default HMR port
      serverDefaults.hmr!.port = await getPort({
        port: hmrPortDefault,
        ports: Array.from({ length: 20 }, (_, i) => hmrPortDefault + 1 + i),
      })
    }
    if (nuxt.options.devServer.https) {
      serverDefaults.https = nuxt.options.devServer.https === true ? {} : nuxt.options.devServer.https
    }
    clientConfig.server = defu(clientConfig.server, serverDefaults as ViteConfig['server'])
  }

  // Add analyze plugin if needed
  if (!nuxt.options.test && nuxt.options.build.analyze && (nuxt.options.build.analyze === true || nuxt.options.build.analyze.enabled)) {
    clientConfig.plugins!.push(...await import('./plugins/analyze').then(r => r.AnalyzePlugin(nuxt)))
  }

  await nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  clientConfig.plugins!.unshift(
    ...vue(clientConfig.vue),
    viteJsxPlugin(clientConfig.vueJsx),
  )

  await nuxt.callHook('vite:configResolved', clientConfig, { isClient: true, isServer: false })

  // Prioritize `optimizeDeps.exclude`. If same dep is in `include` and `exclude`, remove it from `include`
  const exclude = new Set(clientConfig.optimizeDeps!.exclude)
  clientConfig.optimizeDeps!.include = clientConfig.optimizeDeps!.include!
    .filter(dep => !exclude.has(dep))

  if (nuxt.options.dev) {
    // Dev
    const viteServer = await vite.createServer(clientConfig)
    ctx.clientServer = viteServer
    nuxt.hook('close', () => viteServer.close())
    await nuxt.callHook('vite:serverCreated', viteServer, { isClient: true, isServer: false })
    const transformHandler = viteServer.middlewares.stack.findIndex(m => m.handle instanceof Function && m.handle.name === 'viteTransformMiddleware')
    viteServer.middlewares.stack.splice(transformHandler, 0, {
      route: '',
      handle: (req: IncomingMessage & { _skip_transform?: boolean }, res: ServerResponse, next: (err?: any) => void) => {
        // 'Skip' the transform middleware
        if (req._skip_transform) { req.url = joinURL('/__skip_vite', req.url!.replace(/\?.*/, '')) }
        next()
      },
    })

    const staticBases: string[] = []
    for (const folder of useNitro().options.publicAssets) {
      if (folder.baseURL && folder.baseURL !== '/' && folder.baseURL.startsWith(nuxt.options.app.buildAssetsDir)) {
        staticBases.push(folder.baseURL.replace(/\/?$/, '/'))
      }
    }

    const devHandlerRegexes: RegExp[] = []
    for (const handler of nuxt.options.devServerHandlers) {
      if (handler.route && handler.route !== '/' && handler.route.startsWith(nuxt.options.app.buildAssetsDir)) {
        devHandlerRegexes.push(new RegExp(
          `^${handler.route
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex syntax characters
            .replace(/:[^/]+/g, '[^/]+') // dynamic segments (:param)
            .replace(/\*\*/g, '.*') // double wildcard (**) to match any path
            .replace(/\*/g, '[^/]*')}$`, // single wildcard (*) to match any segment
        ))
      }
    }

    const viteMiddleware = defineEventHandler(async (event) => {
      const viteRoutes: string[] = []
      for (const viteRoute of viteServer.middlewares.stack) {
        const m = viteRoute.route
        if (m.length > 1) {
          viteRoutes.push(m)
        }
      }
      if (!event.path.startsWith(clientConfig.base!) && !viteRoutes.some(route => event.path.startsWith(route))) {
        // @ts-expect-error _skip_transform is a private property
        event.node.req._skip_transform = true
      } else if (!useViteCors) {
        const isPreflight = handleCors(event, nuxt.options.devServer.cors)
        if (isPreflight) {
          return null
        }
        setHeader(event, 'Vary', 'Origin')
      }

      // Workaround: vite devmiddleware modifies req.url
      const _originalPath = event.node.req.url
      await new Promise((resolve, reject) => {
        viteServer.middlewares.handle(event.node.req, event.node.res, (err: Error) => {
          event.node.req.url = _originalPath
          return err ? reject(err) : resolve(null)
        })
      })

      // if vite has not handled the request, we want to send a 404 for paths which are not in any static base or dev server handlers
      if (!event.handled && event.path.startsWith(nuxt.options.app.buildAssetsDir) && !staticBases.some(baseURL => event.path.startsWith(baseURL)) && !devHandlerRegexes.some(regex => regex.test(event.path))) {
        throw createError({
          statusCode: 404,
        })
      }
    })
    await nuxt.callHook('server:devHandler', viteMiddleware)
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
