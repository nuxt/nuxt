import * as vite from 'vite'
import { resolve } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import type { InlineConfig, SSROptions } from 'vite'
import { logger, isIgnored } from '@nuxt/kit'
import type { Options } from '@vitejs/plugin-vue'
import { sanitizeFilePath } from 'mlly'
import { getPort } from 'get-port-please'
import { buildClient } from './client'
import { buildServer } from './server'
import virtual from './plugins/virtual'
import { warmupViteServer } from './utils/warmup'
import { resolveCSSOptions } from './css'

export interface ViteOptions extends InlineConfig {
  vue?: Options
  ssr?: SSROptions
}

export interface ViteBuildContext {
  nuxt: Nuxt
  config: ViteOptions
  clientServer?: vite.ViteDevServer
  ssrServer?: vite.ViteDevServer
}

export async function bundle (nuxt: Nuxt) {
  // TODO: After nitropack refactor, try if we can resuse the same server port as Nuxt
  const hmrPortDefault = 24678 // Vite's default HMR port
  const hmrPort = await getPort({
    port: hmrPortDefault,
    ports: Array.from({ length: 20 }, (_, i) => hmrPortDefault + 1 + i)
  })

  const ctx: ViteBuildContext = {
    nuxt,
    config: vite.mergeConfig(
      {
        resolve: {
          alias: {
            ...nuxt.options.alias,
            '#app': nuxt.options.appDir,
            // We need this resolution to be present before the following entry, but it
            // will be filled in client/server configs
            '#build/plugins': '',
            '#build': nuxt.options.buildDir,
            '/entry.mjs': resolve(nuxt.options.appDir, nuxt.options.experimental.asyncEntry ? 'entry.async' : 'entry'),
            'web-streams-polyfill/ponyfill/es2018': 'unenv/runtime/mock/empty',
            // Cannot destructure property 'AbortController' of ..
            'abort-controller': 'unenv/runtime/mock/empty'
          }
        },
        optimizeDeps: {
          entries: [
            resolve(nuxt.options.appDir, 'entry.ts')
          ]
        },
        css: resolveCSSOptions(nuxt),
        build: {
          rollupOptions: {
            output: { sanitizeFileName: sanitizeFilePath },
            input: resolve(nuxt.options.appDir, 'entry')
          }
        },
        plugins: [
          virtual(nuxt.vfs)
        ],
        vue: {
          reactivityTransform: nuxt.options.experimental.reactivityTransform
        },
        server: {
          watch: {
            ignored: isIgnored
          },
          hmr: {
            clientPort: hmrPort,
            port: hmrPort
          },
          fs: {
            allow: [
              nuxt.options.appDir
            ]
          }
        }
      } as ViteOptions,
      nuxt.options.vite
    )
  }

  await nuxt.callHook('vite:extend', ctx)

  nuxt.hook('vite:serverCreated', (server: vite.ViteDevServer, env) => {
    // Invalidate virtual modules when templates are re-generated
    ctx.nuxt.hook('app:templatesGenerated', () => {
      for (const [id, mod] of server.moduleGraph.idToModuleMap) {
        if (id.startsWith('\x00virtual:')) {
          server.moduleGraph.invalidateModule(mod)
        }
      }
    })

    const start = Date.now()
    warmupViteServer(server, ['/entry.mjs'])
      .then(() => logger.info(`Vite ${env.isClient ? 'client' : 'server'} warmed up in ${Date.now() - start}ms`))
      .catch(logger.error)
  })

  await buildClient(ctx)
  await buildServer(ctx)
}
