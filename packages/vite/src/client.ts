import { resolve } from 'pathe'
import * as vite from 'vite'
import fse from 'fs-extra'
import consola from 'consola'
import vitePlugin from '@vitejs/plugin-vue'

import { cacheDirPlugin } from './plugins/cache-dir'
import { replace } from './plugins/replace'
import { wpfs } from './utils/wpfs'
import type { ViteBuildContext, ViteOptions } from './vite'

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
      replace({ 'process.env': 'import.meta.env' }),
      cacheDirPlugin(ctx.nuxt.options.rootDir, 'client'),
      vitePlugin(ctx.config.vue)
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

  // Write client manifest for use in vue-bundle-renderer
  const clientDist = resolve(ctx.nuxt.options.buildDir, 'dist/client')
  const serverDist = resolve(ctx.nuxt.options.buildDir, 'dist/server')

  // Legacy dev manifest
  const devClientManifest = {
    publicPath: ctx.nuxt.options.build.publicPath,
    all: ['@vite/client', 'entry.mjs'],
    initial: ['@vite/client', 'entry.mjs'],
    async: [],
    modules: {}
  }

  const clientManifest = ctx.nuxt.options.dev
    ? devClientManifest
    : await fse.readJSON(resolve(clientDist, 'manifest.json'))

  await fse.mkdirp(serverDist)
  await fse.writeFile(resolve(serverDist, 'client.manifest.json'), JSON.stringify(clientManifest, null, 2), 'utf8')
  await fse.writeFile(resolve(serverDist, 'client.manifest.mjs'), 'export default ' + JSON.stringify(clientManifest, null, 2), 'utf8')
}
