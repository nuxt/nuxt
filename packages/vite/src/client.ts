import type { IncomingMessage, ServerResponse } from 'node:http'
import { join, resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import type { BuildOptions, ServerOptions } from 'vite'
import { logger } from '@nuxt/kit'
import { getPort } from 'get-port-please'
import { joinURL, withoutLeadingSlash } from 'ufo'
import { defu } from 'defu'
import { env, nodeless } from 'unenv'
import { appendCorsHeaders, appendCorsPreflightHeaders, defineEventHandler } from 'h3'
import type { ViteConfig } from '@nuxt/schema'
import { chunkErrorPlugin } from './plugins/chunk-error'
import type { ViteBuildContext } from './vite'
import { devStyleSSRPlugin } from './plugins/dev-ssr-css'
import { runtimePathsPlugin } from './plugins/paths'
import { typeCheckPlugin } from './plugins/type-check'
import { viteNodePlugin } from './vite-node'
import { createViteLogger } from './utils/logger'

export async function buildClient (ctx: ViteBuildContext) {
  const options = ctx.nuxt.options
  const nodeCompat = options.experimental.clientNodeCompat
    ? {
        alias: env(nodeless).alias,
        define: {
          global: 'globalThis',
        },
      }
    : { alias: {}, define: {} }
  const buildAssetsDir = options.app.buildAssetsDir
  const clientSourcemap = options.sourcemap.client
  const clientConfig: ViteConfig = vite.mergeConfig(ctx.config, vite.mergeConfig({
    configFile: false,
    base: options.dev
      ? joinURL(options.app.baseURL.replace(/^\.\//, '/') || '/', buildAssetsDir)
      : './',
    experimental: {
      renderBuiltUrl: (filename, { type, hostType }) => {
        if (hostType !== 'js' || type === 'asset') {
          // In CSS we only use relative paths until we craft a clever runtime CSS hack
          return { relative: true }
        }
        return { runtime: `globalThis.__publicAssetsURL(${JSON.stringify(filename)})` }
      },
    },
    css: {
      devSourcemap: !!clientSourcemap,
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
      ],
    },
    resolve: {
      alias: {
        ...nodeCompat.alias,
        ...ctx.config.resolve?.alias,
        '#internal/nuxt/paths': resolve(options.buildDir, 'paths.mjs'),
        '#build/plugins': resolve(options.buildDir, 'plugins/client'),
        '#internal/nitro': resolve(options.buildDir, 'nitro.client.mjs'),
      },
      dedupe: [
        'vue',
      ],
    },
    cacheDir: resolve(options.rootDir, 'node_modules/.cache/vite', 'client'),
    build: {
      sourcemap: clientSourcemap ? ctx.config.build?.sourcemap ?? clientSourcemap : false,
      manifest: 'manifest.json',
      outDir: resolve(options.buildDir, 'dist/client'),
      rollupOptions: {
        input: { entry: ctx.entry },
      },
    },
    plugins: [
      devStyleSSRPlugin({
        srcDir: options.srcDir,
        buildAssetsURL: joinURL(options.app.baseURL, buildAssetsDir),
      }),
      runtimePathsPlugin({
        sourcemap: !!clientSourcemap,
      }),
      viteNodePlugin(ctx),
    ],
    appType: 'custom',
    server: {
      middlewareMode: true,
    },
  } satisfies vite.InlineConfig, options.vite.$client || {}))

  clientConfig.customLogger = createViteLogger(clientConfig)

  // In build mode we explicitly override any vite options that vite is relying on
  // to detect whether to inject production or development code (such as HMR code)
  if (!options.dev) {
    clientConfig.server!.hmr = false
  }

  // Emit chunk errors if the user has opted in to `experimental.emitRouteChunkError`
  if (options.experimental.emitRouteChunkError) {
    clientConfig.plugins!.push(chunkErrorPlugin({ sourcemap: !!clientSourcemap }))
  }

  // Inject an h3-based CORS handler in preference to vite's
  const useViteCors = clientConfig.server?.cors !== undefined
  if (!useViteCors) {
    clientConfig.server!.cors = false
  }

  // We want to respect users' own rollup output options
  const fileNames = withoutLeadingSlash(join(buildAssetsDir, '[hash].js'))
  clientConfig.build!.rollupOptions = defu(clientConfig.build!.rollupOptions!, {
    output: {
      chunkFileNames: options.dev ? undefined : fileNames,
      entryFileNames: options.dev ? 'entry.js' : fileNames,
    } satisfies NonNullable<BuildOptions['rollupOptions']>['output'],
  }) as any

  if (clientConfig.server && clientConfig.server.hmr !== false) {
    const serverDefaults: Omit<ServerOptions, 'hmr'> & { hmr: Exclude<ServerOptions['hmr'], boolean> } = {
      hmr: {
        protocol: options.devServer.https ? 'wss' : 'ws',
      },
    }
    if (typeof clientConfig.server.hmr !== 'object' || !clientConfig.server.hmr.server) {
      const hmrPortDefault = 24678 // Vite's default HMR port
      serverDefaults.hmr!.port = await getPort({
        port: hmrPortDefault,
        ports: Array.from({ length: 20 }, (_, i) => hmrPortDefault + 1 + i),
      })
    }
    if (options.devServer.https) {
      serverDefaults.https = options.devServer.https === true ? {} : options.devServer.https
    }
    clientConfig.server = defu(clientConfig.server, serverDefaults as ViteConfig['server'])
  }

  // Add analyze plugin if needed
  if (!options.test && options.build.analyze && (options.build.analyze === true || options.build.analyze.enabled)) {
    clientConfig.plugins!.push(...await import('./plugins/analyze').then(r => r.analyzePlugin(ctx)))
  }

  // Add type checking client panel
  if (!options.test && options.typescript.typeCheck === true && options.dev) {
    clientConfig.plugins!.push(typeCheckPlugin({ sourcemap: !!clientSourcemap }))
  }

  await ctx.nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  clientConfig.plugins!.unshift(
    vuePlugin(clientConfig.vue),
    viteJsxPlugin(clientConfig.vueJsx),
  )

  await ctx.nuxt.callHook('vite:configResolved', clientConfig, { isClient: true, isServer: false })

  // Prioritize `optimizeDeps.exclude`. If same dep is in `include` and `exclude`, remove it from `include`
  clientConfig.optimizeDeps!.include = clientConfig.optimizeDeps!.include!
    .filter(dep => !clientConfig.optimizeDeps!.exclude!.includes(dep))

  if (options.dev) {
    // Dev
    const viteServer = await vite.createServer(clientConfig)
    ctx.clientServer = viteServer
    await ctx.nuxt.callHook('vite:serverCreated', viteServer, { isClient: true, isServer: false })
    const transformHandler = viteServer.middlewares.stack.findIndex(m => m.handle instanceof Function && m.handle.name === 'viteTransformMiddleware')
    viteServer.middlewares.stack.splice(transformHandler, 0, {
      route: '',
      handle: (req: IncomingMessage & { _skip_transform?: boolean }, res: ServerResponse, next: (err?: any) => void) => {
        // 'Skip' the transform middleware
        if (req._skip_transform) { req.url = joinURL('/__skip_vite', req.url!) }
        next()
      },
    })

    const viteMiddleware = defineEventHandler(async (event) => {
      const viteRoutes = []
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
        if (event.method === 'OPTIONS') {
          appendCorsPreflightHeaders(event, {})
          return null
        }
        appendCorsHeaders(event, {})
      }

      // Workaround: vite devmiddleware modifies req.url
      const _originalPath = event.node.req.url
      await new Promise((resolve, reject) => {
        viteServer.middlewares.handle(event.node.req, event.node.res, (err: Error) => {
          event.node.req.url = _originalPath
          return err ? reject(err) : resolve(null)
        })
      })
    })
    await ctx.nuxt.callHook('server:devHandler', viteMiddleware)

    ctx.nuxt.hook('close', async () => {
      await viteServer.close()
    })
  } else {
    // Build
    logger.info('Building client...')
    const start = Date.now()
    logger.restoreAll()
    await vite.build(clientConfig)
    logger.wrapAll()
    await ctx.nuxt.callHook('vite:compiled')
    logger.success(`Client built in ${Date.now() - start}ms`)
  }
}
