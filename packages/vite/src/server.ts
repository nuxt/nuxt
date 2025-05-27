import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { logger } from '@nuxt/kit'
import { joinURL } from 'ufo'
import type { Nuxt, ViteConfig } from '@nuxt/schema'
import type { ViteBuildContext } from './vite'
import { createViteLogger } from './utils/logger'
import { initViteNodeServer } from './vite-node'
import { writeManifest } from './manifest'
import { transpile } from './utils/transpile'
import { SourcemapPreserverPlugin } from './plugins/sourcemap-preserver'
import { VueFeatureFlagsPlugin } from './plugins/vue-feature-flags'

export async function getServerConfig (nuxt: Nuxt, config: ViteConfig) {
  const serverConfig: ViteConfig = vite.mergeConfig(config, vite.mergeConfig({
    configFile: false,
    base: nuxt.options.dev
      ? joinURL(nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', nuxt.options.app.buildAssetsDir)
      : undefined,
    css: {
      devSourcemap: !!nuxt.options.sourcemap.server,
    },
    plugins: [
      VueFeatureFlagsPlugin(nuxt),
      // tell rollup's nitro build about the original sources of the generated vite server build
      SourcemapPreserverPlugin(nuxt),
    ],
    define: {},
    ssr: {
      external: [
        'nitro/runtime',
        // TODO: remove in v5
        '#internal/nitro',
        '#internal/nitro/utils',
      ],
      noExternal: [
        ...transpile({ isServer: true, isDev: nuxt.options.dev }),
        '/__vue-jsx',
        '#app',
        /^nuxt(\/|$)/,
        /(nuxt|nuxt3|nuxt-nightly)\/(dist|src|app)/,
      ],
    },
    cacheDir: resolve(nuxt.options.rootDir, config.cacheDir ?? 'node_modules/.cache/vite', 'server'),
    server: {
      hmr: false,
    },
  } satisfies vite.InlineConfig, nuxt.options.vite.$server || {}))

  if (serverConfig.build?.rollupOptions?.output && !Array.isArray(serverConfig.build.rollupOptions.output)) {
    delete serverConfig.build.rollupOptions.output.manualChunks
  }

  serverConfig.customLogger = createViteLogger(serverConfig, { hideOutput: !nuxt.options.dev })

  await nuxt.callHook('vite:extendConfig', serverConfig, { isClient: false, isServer: true })

  serverConfig.plugins!.unshift(
    vuePlugin(serverConfig.vue),
    viteJsxPlugin(serverConfig.vueJsx),
  )

  await nuxt.callHook('vite:configResolved', serverConfig, { isClient: false, isServer: true })

  return serverConfig
}

export async function buildServer (nuxt: Nuxt, ctx: ViteBuildContext) {
  const serverConfig = await getServerConfig(nuxt, ctx.config)

  // Production build
  if (!nuxt.options.dev) {
    const start = Date.now()
    logger.restoreAll()
    const builder = await vite.createBuilder(serverConfig)
    await builder.build(builder.environments.ssr!)
    logger.wrapAll()
    // Write production client manifest
    await writeManifest(ctx)
    await nuxt.callHook('vite:compiled')
    logger.success(`Server built in ${Date.now() - start}ms`)
    return
  }

  if (!nuxt.options.ssr) {
    await writeManifest(ctx)
    await nuxt.callHook('vite:compiled')
    return
  }

  // Start development server
  const ssrServer = await vite.createServer(serverConfig)
  ctx.ssrServer = ssrServer

  // Close server on exit
  nuxt.hook('close', () => ssrServer.close())

  await nuxt.callHook('vite:serverCreated', ssrServer, { isClient: false, isServer: true })

  // Initialize plugins
  await ssrServer.pluginContainer.buildStart({})

  await initViteNodeServer(nuxt, ssrServer)
}
