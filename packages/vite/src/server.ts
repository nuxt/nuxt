import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { logger, resolvePath } from '@nuxt/kit'
import { joinURL } from 'ufo'
import type { Nuxt, ViteConfig } from '@nuxt/schema'
import type { Nitro } from 'nitropack/types'
import { getPort } from 'get-port-please'

import type { ViteBuildContext } from './vite.ts'
import { createViteLogger } from './utils/logger.ts'
import { writeDevServer } from './plugins/vite-node.ts'
import { writeManifest } from './manifest.ts'
import { SourcemapPreserverPlugin } from './plugins/sourcemap-preserver.ts'
import { VueFeatureFlagsPlugin } from './plugins/vue-feature-flags.ts'
import { VitePluginCheckerPlugin } from './plugins/vite-plugin-checker.ts'
import { ssr, ssrEnvironment } from './shared/server.ts'

export async function buildServer (nuxt: Nuxt, ctx: ViteBuildContext) {
  const serverEntry = nuxt.options.ssr ? ctx.entry : await resolvePath(resolve(nuxt.options.appDir, 'entry-spa'))
  const serverConfig: ViteConfig = vite.mergeConfig(ctx.config, vite.mergeConfig({
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
      VitePluginCheckerPlugin(nuxt, 'ssr'),
    ],
    environments: {
      ssr: {
        resolve: {
          conditions: ((nuxt as any)._nitro as Nitro)?.options.exportConditions,
        },
      },
    },
    ssr: ssr(nuxt),
    cacheDir: resolve(nuxt.options.rootDir, ctx.config.cacheDir ?? 'node_modules/.cache/vite', 'server'),
    server: {
      warmup: {
        ssrFiles: [serverEntry],
      },
      // https://github.com/vitest-dev/vitest/issues/229#issuecomment-1002685027
      preTransformRequests: false,
    },
    ...ssrEnvironment(nuxt, serverEntry),
  } satisfies vite.InlineConfig, nuxt.options.vite.$server || {}))

  serverConfig.server ||= {}
  serverConfig.server.hmr ||= {}
  if (nuxt.options.dev && typeof serverConfig.server.hmr !== 'boolean') {
    const hmrPortDefault = 24678
    serverConfig.server.hmr.port ||= await getPort({
      verbose: false,
      portRange: [hmrPortDefault, hmrPortDefault + 20],
    })
  }

  serverConfig.customLogger = createViteLogger(serverConfig, { hideOutput: !nuxt.options.dev })

  await nuxt.callHook('vite:extendConfig', serverConfig, { isClient: false, isServer: true })

  serverConfig.plugins!.unshift(
    vuePlugin(serverConfig.vue),
    viteJsxPlugin(serverConfig.vueJsx),
  )

  await nuxt.callHook('vite:configResolved', serverConfig, { isClient: false, isServer: true })

  // Production build
  if (!nuxt.options.dev) {
    const start = Date.now()
    logger.info('Building server...')
    logger.restoreAll()
    await vite.build(serverConfig)
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

  // Invalidate virtual modules when templates are re-generated
  nuxt.hook('app:templatesGenerated', async (_app, changedTemplates) => {
    await Promise.all(changedTemplates.map(async (template) => {
      for (const mod of ssrServer.moduleGraph.getModulesByFile(`virtual:nuxt:${encodeURIComponent(template.dst)}`) || []) {
        ssrServer.moduleGraph.invalidateModule(mod)
        await ssrServer.reloadModule(mod)
      }
    }))
  })

  // Initialize plugins
  await ssrServer.pluginContainer.buildStart({})

  await writeDevServer(nuxt)
}
