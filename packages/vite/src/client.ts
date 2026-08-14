import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { logger, recoverThrottledChanges } from '@nuxt/kit'
import { joinURL } from 'ufo'
import type { Nuxt, ViteConfig } from '@nuxt/schema'

import type { ViteBuildContext } from './vite.ts'
import { DevStyleSSRPlugin } from './plugins/dev-style-ssr.ts'
import { RuntimePathsPlugin } from './plugins/runtime-paths.ts'
import { TypeCheckPlugin } from './plugins/type-check.ts'
import { ModulePreloadPolyfillPlugin } from './plugins/module-preload-polyfill.ts'
import { ViteNodePlugin } from './plugins/vite-node.ts'
import { createViteLogger } from './utils/logger.ts'
import { OptimizeDepsHintPlugin, optimizerCallbacks } from './plugins/optimize-deps-hint.ts'
import { StableEntryPlugin } from './plugins/stable-entry.ts'
import { AnalyzePlugin } from './plugins/analyze.ts'
import { DevServerPlugin } from './plugins/dev-server.ts'
import { TemplateHMRPlugin } from './plugins/template-hmr.ts'
import { VitePluginCheckerPlugin } from './plugins/vite-plugin-checker.ts'
import { clientEnvironment } from './shared/client.ts'

const resolvedClientBuild = new WeakMap<Nuxt, { outDir: string, manifest: string | boolean | undefined }>()

/**
 * The client `build` options as resolved by Vite, including any overrides applied
 * by a plugin `config`/`configEnvironment` hook. Available once the client build
 * has started.
 */
export function getResolvedClientBuild (nuxt: Nuxt) {
  return resolvedClientBuild.get(nuxt)
}

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
      TemplateHMRPlugin(nuxt),
      VitePluginCheckerPlugin(nuxt, 'client'),
      OptimizeDepsHintPlugin(nuxt),
      {
        name: 'nuxt:capture-client-build',
        configResolved (config) {
          const build = config.environments.client?.build ?? config.build
          resolvedClientBuild.set(nuxt, { outDir: build.outDir, manifest: build.manifest })
        },
      },
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

  const callbacks = optimizerCallbacks.get(nuxt)
  clientConfig.customLogger = createViteLogger(clientConfig, { onNewDeps: callbacks?.onNewDeps, onStaleDep: callbacks?.onStaleDep })

  await nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  clientConfig.plugins!.unshift(
    vuePlugin(clientConfig.vue),
    viteJsxPlugin(clientConfig.vueJsx),
  )

  await nuxt.callHook('vite:configResolved', clientConfig, { isClient: true, isServer: false })

  if (nuxt.options.dev) {
    // Dev
    const viteServer = await vite.createServer(clientConfig)
    ctx.clientServer = viteServer
    const disposeWatchRecovery = recoverThrottledChanges(viteServer.watcher)
    nuxt.hook('close', () => {
      disposeWatchRecovery()
      return viteServer.close()
    })
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
