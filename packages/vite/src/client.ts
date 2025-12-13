import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { logger } from '@nuxt/kit'
import { joinURL } from 'ufo'
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
import { VitePluginCheckerPlugin } from './plugins/vite-plugin-checker'
import { clientEnvironment } from './shared/client'
import { getTranspilePatterns } from './utils/transpile'

export async function buildClient (nuxt: Nuxt, ctx: ViteBuildContext) {
  const clientConfig: ViteConfig = vite.mergeConfig(ctx.config, vite.mergeConfig({
    configFile: false,
    base: nuxt.options.dev
      ? joinURL(nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', nuxt.options.app.buildAssetsDir)
      : './',
    css: {
      devSourcemap: !!nuxt.options.sourcemap.client,
    },
    cacheDir: resolve(nuxt.options.rootDir, ctx.config.cacheDir ?? 'node_modules/.cache/vite', 'client'),
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
      VitePluginCheckerPlugin(nuxt, 'client'),
    ],
    appType: 'custom',
    server: {
      warmup: {
        clientFiles: [ctx.entry],
      },
      middlewareMode: true,
    },
    ...clientEnvironment(nuxt, ctx.entry),
  } satisfies vite.InlineConfig, nuxt.options.vite.$client || {}))

  clientConfig.customLogger = createViteLogger(clientConfig)

  await nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  // Add transpile packages to optimizeDeps.exclude to prevent Vite from optimizing them at runtime
  // This must happen after vite:extendConfig since modules may add transpile entries asynchronously
  clientConfig.optimizeDeps ||= {}
  clientConfig.optimizeDeps.exclude ||= []
  const transpilePatterns = getTranspilePatterns({ isDev: nuxt.options.dev, isClient: true })
  clientConfig.optimizeDeps.exclude.push(...transpilePatterns)

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
