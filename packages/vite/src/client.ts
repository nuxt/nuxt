import { join, resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import type { BuildOptions, ServerOptions } from 'vite'
import { getPort } from 'get-port-please'
import { joinURL, withoutLeadingSlash } from 'ufo'
import { defu } from 'defu'
import { defineEnv } from 'unenv'
import { resolveModulePath } from 'exsolve'
import type { Nuxt, ViteConfig } from '@nuxt/schema'

import type { ViteBuildContext } from './vite'

export async function getClientConfig (nuxt: Nuxt, config: ViteConfig) {
  const clientConfig: ViteConfig = vite.mergeConfig(config, vite.mergeConfig({
    base: nuxt.options.dev
      ? joinURL(nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', nuxt.options.app.buildAssetsDir)
      : './',
    css: {
      devSourcemap: !!nuxt.options.sourcemap.client,
    },
    optimizeDeps: {
      include: [],
    },
    define: {},
    resolve: {
      alias: {
        // user aliases
        ...nuxt.options.experimental.clientNodeCompat ? defineEnv({ nodeCompat: true, resolve: true }).env.alias : {},
        // TODO:?
        // ...config.resolve?.alias,
        'nitro/runtime': join(nuxt.options.buildDir, 'nitro.client.mjs'),
        // TODO: remove in v5
        '#internal/nitro': join(ctx.nuxt.options.buildDir, 'nitro.client.mjs'),
        'nitropack/runtime': join(ctx.nuxt.options.buildDir, 'nitro.client.mjs'),
        // work around vite optimizer bug
        '#app-manifest': resolveModulePath('mocked-exports/empty', { from: import.meta.url }),
      },
    },
    plugins: [],
  } satisfies vite.InlineConfig, nuxt.options.vite.$client || {}))

  await nuxt.callHook('vite:extendConfig', clientConfig, { isClient: true, isServer: false })

  // clientConfig.plugins!.unshift(
  //   vuePlugin(nuxt.options.vite.vue),
  //   viteJsxPlugin(nuxt.options.vite.vueJsx),
  // )

  await nuxt.callHook('vite:configResolved', clientConfig, { isClient: true, isServer: false })

  return clientConfig
}

export async function startClientDevServer (nuxt: Nuxt, ctx: ViteBuildContext) {
  const clientConfig = await getClientConfig(nuxt, ctx.config)

  // Dev
  const viteServer = await vite.createServer(clientConfig)
  ctx.clientServer = viteServer
}
