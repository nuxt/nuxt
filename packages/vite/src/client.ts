import { resolve } from 'pathe'
import * as vite from 'vite'
import consola from 'consola'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import type { Connect } from 'vite'

import { joinURL, withoutLeadingSlash } from 'ufo'
import { cacheDirPlugin } from './plugins/cache-dir'
import { analyzePlugin } from './plugins/analyze'
import { wpfs } from './utils/wpfs'
import type { ViteBuildContext, ViteOptions } from './vite'
import { writeManifest } from './manifest'
import { devStyleSSRPlugin } from './plugins/dev-ssr-css'
import { DynamicBasePlugin } from './plugins/dynamic-base'

export async function buildClient (ctx: ViteBuildContext) {
  const clientConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
    define: {
      'process.server': false,
      'process.client': true,
      'module.hot': false
    },
    resolve: {
      alias: {
        '#build/plugins': resolve(ctx.nuxt.options.buildDir, 'plugins/client')
      }
    },
    build: {
      assetsDir: ctx.nuxt.options.dev ? withoutLeadingSlash(ctx.nuxt.options.app.buildAssetsDir) : '.',
      rollupOptions: {
        output: {
          chunkFileNames: ctx.nuxt.options.dev ? undefined : '[name]-[hash].mjs',
          entryFileNames: ctx.nuxt.options.dev ? 'entry.mjs' : '[name]-[hash].mjs'
        }
      },
      manifest: true,
      outDir: resolve(ctx.nuxt.options.buildDir, 'dist/client')
    },
    plugins: [
      cacheDirPlugin(ctx.nuxt.options.rootDir, 'client'),
      vuePlugin(ctx.config.vue),
      viteJsxPlugin(),
      DynamicBasePlugin.vite({ env: 'client', devAppConfig: ctx.nuxt.options.app }),
      devStyleSSRPlugin({
        rootDir: ctx.nuxt.options.rootDir,
        buildAssetsURL: joinURL(ctx.nuxt.options.app.baseURL, ctx.nuxt.options.app.buildAssetsDir)
      })
    ],
    server: {
      middlewareMode: true
    }
  } as ViteOptions)

  // Add analyze plugin if needed
  if (ctx.nuxt.options.build.analyze) {
    clientConfig.plugins.push(...analyzePlugin(ctx))
  }

  await ctx.nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  const viteServer = await vite.createServer(clientConfig)
  await ctx.nuxt.callHook('vite:serverCreated', viteServer)

  const viteMiddleware: Connect.NextHandleFunction = (req, res, next) => {
    // Workaround: vite devmiddleware modifies req.url
    const originalURL = req.url
    viteServer.middlewares.handle(req, res, (err) => {
      req.url = originalURL
      next(err)
    })
  }
  await ctx.nuxt.callHook('server:devMiddleware', viteMiddleware)

  ctx.nuxt.hook('close', async () => {
    await viteServer.close()
  })

  if (!ctx.nuxt.options.dev) {
    const start = Date.now()
    await vite.build(clientConfig)
    await ctx.nuxt.callHook('build:resources', wpfs)
    consola.info(`Client built in ${Date.now() - start}ms`)
  }

  await writeManifest(ctx)
}
