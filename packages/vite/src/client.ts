import * as vite from 'vite'
import vitePlugin from '@vitejs/plugin-vue'
import { cacheDirPlugin } from './plugins/cache-dir'
import { replace } from './plugins/replace'
import { ViteBuildContext, ViteOptions } from './vite'
import { transformNuxtSetup } from './plugins/transformSetup'

export async function buildClient (ctx: ViteBuildContext) {
  const clientConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
    define: {
      'process.server': false,
      'process.client': true,
      'module.hot': false,
      global: 'globalThis'
    },
    build: {
      outDir: 'dist/client',
      assetsDir: '.'
    },
    plugins: [
      replace({ 'process.env': 'import.meta.env' }),
      cacheDirPlugin(ctx.nuxt.options.rootDir, 'client'),
      vitePlugin(ctx.config.vue),
      transformNuxtSetup()
    ],
    server: {
      middlewareMode: true
    }
  } as ViteOptions)

  await ctx.nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  const viteServer = await vite.createServer(clientConfig)
  await ctx.nuxt.callHook('vite:serverCreated', viteServer)

  const viteMiddleware = (req, res, next) => {
    // Workaround: vite devmiddleware modifies req.url
    const originalURL = req.url
    if (req.url === '/_nuxt/client.js') {
      return res.end('')
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
