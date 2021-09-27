import * as vite from 'vite'
import { resolve } from 'pathe'
import consola from 'consola'
import type { Nuxt } from '@nuxt/kit'
import type { InlineConfig, SSROptions } from 'vite'
import type { Options } from '@vitejs/plugin-vue'
import { buildClient } from './client'
import { buildServer } from './server'
import virtual from './plugins/virtual'
import { warmupViteServer } from './utils/warmup'

export interface ViteOptions extends InlineConfig {
  vue?: Options
  ssr?: SSROptions
}

export interface ViteBuildContext {
  nuxt: Nuxt
  config: ViteOptions
}

export async function bundle (nuxt: Nuxt) {
  const ctx: ViteBuildContext = {
    nuxt,
    config: vite.mergeConfig(
      nuxt.options.vite as any || {},
      {
        root: nuxt.options.rootDir,
        mode: nuxt.options.dev ? 'development' : 'production',
        logLevel: 'warn',
        define: {
          'process.dev': nuxt.options.dev
        },
        resolve: {
          extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
          alias: {
            ...nuxt.options.alias,
            '#app': nuxt.options.appDir,
            // We need this resolution to be present before the following entry, but it
            // will be filled in client/server configs
            '#build/plugins': undefined,
            '#build': nuxt.options.buildDir,
            '/build': nuxt.options.buildDir,
            '/app': nuxt.options.appDir,
            '/entry.mjs': resolve(nuxt.options.appDir, 'entry'),
            '~': nuxt.options.srcDir,
            '@': nuxt.options.srcDir,
            'web-streams-polyfill/ponyfill/es2018': 'unenv/runtime/mock/empty',
            // Cannot destructure property 'AbortController' of ..
            'abort-controller': 'unenv/runtime/mock/empty'
          }
        },
        base: nuxt.options.build.publicPath,
        vue: {},
        css: {},
        optimizeDeps: {
          exclude: []
        },
        esbuild: {
          jsxFactory: 'h',
          jsxFragment: 'Fragment'
        },
        clearScreen: false,
        build: {
          emptyOutDir: false,
          rollupOptions: {
            input: resolve(nuxt.options.appDir, 'entry')
          }
        },
        plugins: [
          virtual(nuxt.vfs)
        ],
        server: {
          fs: {
            strict: false,
            allow: [
              nuxt.options.buildDir,
              nuxt.options.appDir,
              nuxt.options.srcDir,
              nuxt.options.rootDir,
              ...nuxt.options.modulesDir
            ]
          }
        }
      } as ViteOptions
    )
  }

  await nuxt.callHook('vite:extend', ctx)

  nuxt.hook('vite:serverCreated', (server: vite.ViteDevServer) => {
    const start = Date.now()
    warmupViteServer(server, ['/app/entry.mjs']).then(() => {
      consola.info(`Vite warmed up in ${Date.now() - start}ms`)
    }).catch(consola.error)
  })

  await buildClient(ctx)
  if (ctx.nuxt.options.ssr) {
    await buildServer(ctx)
  }
}
