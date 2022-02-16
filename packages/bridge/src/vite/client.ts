import { resolve } from 'pathe'
import * as vite from 'vite'
import { createVuePlugin } from 'vite-plugin-vue2'
import PluginLegacy from '@vitejs/plugin-legacy'
import { logger } from '@nuxt/kit'
import { joinURL } from 'ufo'
import { devStyleSSRPlugin } from '../../../vite/src/plugins/dev-ssr-css'
import { jsxPlugin } from './plugins/jsx'
import { ViteBuildContext, ViteOptions } from './types'

export async function buildClient (ctx: ViteBuildContext) {
  const alias = {}
  for (const p of ctx.builder.plugins) {
    alias[p.name] = p.mode === 'server'
      ? `defaultexport:${resolve(ctx.nuxt.options.buildDir, 'empty.js')}`
      : `defaultexport:${p.src}`
  }

  const clientConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
    define: {
      'process.client': 'true',
      'process.server': 'false',
      'process.static': 'false',
      'module.hot': 'false'
    },
    cacheDir: resolve(ctx.nuxt.options.rootDir, 'node_modules/.cache/vite/client'),
    resolve: {
      alias
    },
    build: {
      outDir: resolve(ctx.nuxt.options.buildDir, 'dist/client'),
      rollupOptions: {
        input: resolve(ctx.nuxt.options.buildDir, 'client.js')
      },
      manifest: true,
      ssrManifest: true
    },
    plugins: [
      jsxPlugin(),
      createVuePlugin(ctx.config.vue),
      PluginLegacy(),
      devStyleSSRPlugin({
        rootDir: ctx.nuxt.options.rootDir,
        buildAssetsURL: joinURL(ctx.nuxt.options.app.baseURL, ctx.nuxt.options.app.buildAssetsDir)
      })
    ],
    server: {
      middlewareMode: true
    }
  } as ViteOptions)

  await ctx.nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  // Production build
  if (!ctx.nuxt.options.dev) {
    const start = Date.now()
    logger.info('Building client...')
    await vite.build(clientConfig)
    logger.success(`Client built in ${Date.now() - start}ms`)
    return
  }

  // Create development server
  const viteServer = await vite.createServer(clientConfig)
  await ctx.nuxt.callHook('vite:serverCreated', viteServer)

  const viteMiddleware = (req, res, next) => {
    // Workaround: vite devmiddleware modifies req.url
    const originalURL = req.url
    req.url = req.url.replace('/_nuxt/', '/.nuxt/')
    if (req.url.includes('@vite/client')) {
      req.url = '/@vite/client'
    }
    viteServer.middlewares.handle(req, res, (err) => {
      req.url = originalURL
      next(err)
    })
  }
  await ctx.nuxt.callHook('server:devMiddleware', viteMiddleware)

  ctx.nuxt.hook('close', async () => {
    await viteServer.close()
  })
}
