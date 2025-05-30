import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { joinURL } from 'ufo'
import type { Nuxt, ViteConfig } from '@nuxt/schema'
import type { ViteBuildContext } from './vite'
import { createViteLogger } from './utils/logger'

export async function getServerConfig (nuxt: Nuxt, config: ViteConfig) {
  const serverConfig: ViteConfig = vite.mergeConfig(config, vite.mergeConfig({
    configFile: false,
    base: nuxt.options.dev
      ? joinURL(nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', nuxt.options.app.buildAssetsDir)
      : undefined,
    css: {
      devSourcemap: !!nuxt.options.sourcemap.server,
    },
    server: {
      hmr: false,
    },
  } satisfies vite.InlineConfig, nuxt.options.vite.$server || {}))

  await nuxt.callHook('vite:extendConfig', serverConfig, { isClient: false, isServer: true })

  // serverConfig.plugins!.unshift(
  //   vuePlugin(serverConfig.vue),
  //   viteJsxPlugin(serverConfig.vueJsx),
  // )

  await nuxt.callHook('vite:configResolved', serverConfig, { isClient: false, isServer: true })

  return serverConfig
}

export async function startServerDevServer (nuxt: Nuxt, ctx: ViteBuildContext) {
  const serverConfig = await getServerConfig(nuxt, ctx.config)

  // Start development server
  const ssrServer = await vite.createServer(serverConfig)
  ctx.ssrServer = ssrServer
}
