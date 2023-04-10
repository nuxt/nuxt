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
import { defineEventHandler } from 'h3'
import type { ViteConfig } from '@nuxt/schema'
import { cacheDirPlugin } from './plugins/cache-dir'
import { chunkErrorPlugin } from './plugins/chunk-error'
import type { ViteBuildContext } from './vite'
import { devStyleSSRPlugin } from './plugins/dev-ssr-css'
import { runtimePathsPlugin } from './plugins/paths'
import { pureAnnotationsPlugin } from './plugins/pure-annotations'
import { viteNodePlugin } from './vite-node'
import { createViteLogger } from './utils/logger'

export async function buildClient (ctx: ViteBuildContext) {
  const clientConfig: ViteConfig = vite.mergeConfig(ctx.config, {
    base: ctx.nuxt.options.dev
      ? joinURL(ctx.nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', ctx.nuxt.options.app.buildAssetsDir)
      : './',
    experimental: {
      renderBuiltUrl: (filename, { type, hostType }) => {
        if (hostType !== 'js' || type === 'asset') {
          // In CSS we only use relative paths until we craft a clever runtime CSS hack
          return { relative: true }
        }
        return { runtime: `globalThis.__publicAssetsURL(${JSON.stringify(filename)})` }
      }
    },
    css: {
      devSourcemap: ctx.nuxt.options.sourcemap.client
    },
    define: {
      'process.server': false,
      'process.client': true,
      'module.hot': false
    },
    optimizeDeps: {
      entries: [ctx.entry]
    },
    resolve: {
      alias: {
        '#build/plugins': resolve(ctx.nuxt.options.buildDir, 'plugins/client'),
        '#internal/nitro': resolve(ctx.nuxt.options.buildDir, 'nitro.client.mjs')
      },
      dedupe: ['vue']
    },
    build: {
      sourcemap: ctx.nuxt.options.sourcemap.client ? ctx.config.build?.sourcemap ?? true : false,
      manifest: true,
      outDir: resolve(ctx.nuxt.options.buildDir, 'dist/client'),
      rollupOptions: {
        input: { entry: ctx.entry }
      }
    },
    plugins: [
      cacheDirPlugin(ctx.nuxt.options.rootDir, 'client'),
      devStyleSSRPlugin({
        srcDir: ctx.nuxt.options.srcDir,
        buildAssetsURL: joinURL(ctx.nuxt.options.app.baseURL, ctx.nuxt.options.app.buildAssetsDir)
      }),
      runtimePathsPlugin({
        sourcemap: ctx.nuxt.options.sourcemap.client
      }),
      viteNodePlugin(ctx),
      pureAnnotationsPlugin.vite({
        sourcemap: ctx.nuxt.options.sourcemap.client,
        functions: ['defineComponent', 'defineAsyncComponent', 'defineNuxtLink', 'createClientOnly', 'defineNuxtPlugin', 'defineNuxtRouteMiddleware', 'defineNuxtComponent', 'useRuntimeConfig']
      })
    ],
    appType: 'custom',
    server: {
      middlewareMode: true
    }
  } satisfies vite.InlineConfig)

  clientConfig.customLogger = createViteLogger(clientConfig)

  // In build mode we explicitly override any vite options that vite is relying on
  // to detect whether to inject production or development code (such as HMR code)
  if (!ctx.nuxt.options.dev) {
    clientConfig.server!.hmr = false
  }

  // Emit chunk errors if the user has opted in to `experimental.emitRouteChunkError`
  if (ctx.nuxt.options.experimental.emitRouteChunkError) {
    clientConfig.plugins!.push(chunkErrorPlugin({ sourcemap: ctx.nuxt.options.sourcemap.client }))
  }

  // We want to respect users' own rollup output options
  clientConfig.build!.rollupOptions = defu(clientConfig.build!.rollupOptions!, {
    output: {
      chunkFileNames: ctx.nuxt.options.dev ? undefined : withoutLeadingSlash(join(ctx.nuxt.options.app.buildAssetsDir, '[name].[hash].js')),
      entryFileNames: ctx.nuxt.options.dev ? 'entry.js' : withoutLeadingSlash(join(ctx.nuxt.options.app.buildAssetsDir, '[name].[hash].js'))
    } satisfies NonNullable<BuildOptions['rollupOptions']>['output']
  }) as any

  if (clientConfig.server && clientConfig.server.hmr !== false) {
    const hmrPortDefault = 24678 // Vite's default HMR port
    const hmrPort = await getPort({
      port: hmrPortDefault,
      ports: Array.from({ length: 20 }, (_, i) => hmrPortDefault + 1 + i)
    })
    clientConfig.server = defu(clientConfig.server, <ServerOptions> {
      https: ctx.nuxt.options.devServer.https,
      hmr: {
        protocol: ctx.nuxt.options.devServer.https ? 'wss' : 'ws',
        port: hmrPort
      }
    })
  }

  // Add analyze plugin if needed
  if (ctx.nuxt.options.build.analyze) {
    clientConfig.plugins!.push(...await import('./plugins/analyze').then(r => r.analyzePlugin(ctx)))
  }

  await ctx.nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  clientConfig.plugins!.unshift(
    vuePlugin(clientConfig.vue),
    viteJsxPlugin(clientConfig.vueJsx)
  )

  if (ctx.nuxt.options.dev) {
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
      }
    })

    const viteMiddleware = defineEventHandler(async (event) => {
      // Workaround: vite devmiddleware modifies req.url
      const originalURL = event.node.req.url!

      const viteRoutes = viteServer.middlewares.stack.map(m => m.route).filter(r => r.length > 1)
      if (!originalURL.startsWith(clientConfig.base!) && !viteRoutes.some(route => originalURL.startsWith(route))) {
        // @ts-expect-error _skip_transform is a private property
        event.node.req._skip_transform = true
      }

      await new Promise((resolve, reject) => {
        viteServer.middlewares.handle(event.node.req, event.node.res, (err: Error) => {
          event.node.req.url = originalURL
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
