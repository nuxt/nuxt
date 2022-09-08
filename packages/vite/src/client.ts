import { join, resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import type { Connect, HmrOptions } from 'vite'
import { logger } from '@nuxt/kit'
import { getPort } from 'get-port-please'
import { joinURL, withLeadingSlash, withoutLeadingSlash, withTrailingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import defu from 'defu'
import { sanitizeFilePath } from 'mlly'
import { filename } from 'pathe/utils'
import type { OutputOptions } from 'rollup'
import { cacheDirPlugin } from './plugins/cache-dir'
import { wpfs } from './utils/wpfs'
import type { ViteBuildContext, ViteOptions } from './vite'
import { devStyleSSRPlugin } from './plugins/dev-ssr-css'
import { viteNodePlugin } from './vite-node'

export async function buildClient (ctx: ViteBuildContext) {
  const useAsyncEntry = ctx.nuxt.options.experimental.asyncEntry
  ctx.entry = resolve(ctx.nuxt.options.appDir, useAsyncEntry ? 'entry.async' : 'entry')

  const clientConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
    entry: ctx.entry,
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
        input: ctx.entry
      }
    },
    plugins: [
      cacheDirPlugin(ctx.nuxt.options.rootDir, 'client'),
      vuePlugin(ctx.config.vue),
      viteJsxPlugin(),
      devStyleSSRPlugin({
        srcDir: ctx.nuxt.options.srcDir,
        buildAssetsURL: joinURL(ctx.nuxt.options.app.baseURL, ctx.nuxt.options.app.buildAssetsDir)
      }),
      viteNodePlugin(ctx)
    ],
    appType: 'custom',
    server: {
      middlewareMode: true
    }
  } as ViteOptions)

  // In build mode we explicitly override any vite options that vite is relying on
  // to detect whether to inject production or development code (such as HMR code)
  if (!ctx.nuxt.options.dev) {
    clientConfig.server!.hmr = false
  }

  // We want to respect users' own rollup output options
  clientConfig.build!.rollupOptions = defu(clientConfig.build!.rollupOptions!, {
    output: {
      // https://github.com/vitejs/vite/tree/main/packages/vite/src/node/build.ts#L464-L478
      assetFileNames: ctx.nuxt.options.dev
        ? undefined
        : chunk => withoutLeadingSlash(join(ctx.nuxt.options.app.buildAssetsDir, `${sanitizeFilePath(filename(chunk.name!))}.[hash].[ext]`)),
      chunkFileNames: ctx.nuxt.options.dev ? undefined : withoutLeadingSlash(join(ctx.nuxt.options.app.buildAssetsDir, '[name].[hash].js')),
      entryFileNames: ctx.nuxt.options.dev ? 'entry.js' : withoutLeadingSlash(join(ctx.nuxt.options.app.buildAssetsDir, '[name].[hash].js'))
    } as OutputOptions
  }) as any

  if (clientConfig.server && clientConfig.server.hmr !== false) {
    const hmrPortDefault = 24678 // Vite's default HMR port
    const hmrPort = await getPort({
      port: hmrPortDefault,
      ports: Array.from({ length: 20 }, (_, i) => hmrPortDefault + 1 + i)
    })
    clientConfig.server.hmr = defu(clientConfig.server.hmr as HmrOptions, {
      // https://github.com/nuxt/framework/issues/4191
      protocol: 'ws',
      port: hmrPort
    })
  }

  // Add analyze plugin if needed
  if (ctx.nuxt.options.build.analyze) {
    clientConfig.plugins!.push(...await import('./plugins/analyze').then(r => r.analyzePlugin(ctx)))
  }

  await ctx.nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  if (ctx.nuxt.options.dev) {
    // Dev
    const viteServer = await vite.createServer(clientConfig)
    ctx.clientServer = viteServer
    await ctx.nuxt.callHook('vite:serverCreated', viteServer, { isClient: true, isServer: false })
    const baseURL = joinURL(ctx.nuxt.options.app.baseURL.replace(/^\./, '') || '/', ctx.nuxt.options.app.buildAssetsDir)
    const BASE_RE = new RegExp(`^${escapeRE(withTrailingSlash(withLeadingSlash(baseURL)))}`)
    const viteMiddleware: Connect.NextHandleFunction = (req, res, next) => {
      // Workaround: vite devmiddleware modifies req.url
      const originalURL = req.url!
      req.url = originalURL.replace(BASE_RE, '/')
      viteServer.middlewares.handle(req, res, (err: unknown) => {
        req.url = originalURL
        next(err)
      })
    }
    await ctx.nuxt.callHook('server:devMiddleware', viteMiddleware)

    ctx.nuxt.hook('close', async () => {
      await viteServer.close()
    })
  } else {
    // Build
    const start = Date.now()
    await vite.build(clientConfig)
    await ctx.nuxt.callHook('build:resources', wpfs)
    logger.info(`Client built in ${Date.now() - start}ms`)
  }
}
