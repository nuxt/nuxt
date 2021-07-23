import * as vite from 'vite'
import { resolve } from 'upath'
import { mkdirp, writeFile } from 'fs-extra'
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
    resolve: {
      alias: {
        '#build/plugins': resolve(ctx.nuxt.options.buildDir, 'plugins/client')
      }
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

  const clientManifest = {
    publicPath: ctx.nuxt.options.build.publicPath,
    all: [],
    initial: [ctx.nuxt.options.dev && '@vite/client', 'entry.mjs'].filter(Boolean),
    async: [],
    modules: {}
  }

  const serverDist = resolve(ctx.nuxt.options.buildDir, 'dist/server')
  await mkdirp(serverDist)
  await writeFile(resolve(serverDist, 'client.manifest.json'), JSON.stringify(clientManifest, null, 2), 'utf8')
  await writeFile(resolve(serverDist, 'client.manifest.mjs'), 'export default ' + JSON.stringify(clientManifest, null, 2), 'utf8')

  const viteServer = await vite.createServer(clientConfig)
  await ctx.nuxt.callHook('vite:serverCreated', viteServer)

  const viteMiddleware = (req, res, next) => {
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
}
