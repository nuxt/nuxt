import { existsSync, promises as fsp } from 'node:fs'
import { join, resolve } from 'pathe'
import { build, copyPublicAssets, createDevServer, prepare, prerender } from 'nitro/builder'
import type { Nitro } from 'nitro/types'
import type { Nuxt } from '@nuxt/schema'
import { logger } from '@nuxt/kit'
import { defineEventHandler, dynamicEventHandler, handleCors } from 'nitro/h3'

export function setupLegacyDevAndBuild (nuxt: Nuxt & { _nitro?: Nitro }, nitro: Nitro): void {
  const devMiddlewareHandler = dynamicEventHandler()
  nitro.options.devHandlers.unshift({ route: '', handler: devMiddlewareHandler })

  // Copy public assets after prerender so app manifest can be present
  if (!nuxt.options.dev) {
    nitro.hooks.hook('rollup:before', async (nitro) => {
      await copyPublicAssets(nitro)
      await nuxt.callHook('nitro:build:public-assets', nitro)
    })
  }

  let waitUntilCompile: Promise<void> | undefined
  if (nuxt.options.dev) {
    let nitroBuilt = false
    for (const builder of ['webpack', 'rspack'] as const) {
      nuxt.hook(`${builder}:compile`, ({ name, compiler }) => {
        if (name === 'server') {
          nitro.options.virtual['nuxt/entry'] = () => (compiler.outputFileSystem as typeof import('node:fs')).readFileSync(join(nuxt.options.buildDir, 'dist/server/server.mjs'), 'utf-8')
        }
      })
      nuxt.hook(`${builder}:compiled`, () => {
        if (nitroBuilt) { nitro.hooks.callHook('rollup:reload') }
      })
    }
    nuxt.hook('vite:compiled', () => { nuxt.server.reload() })

    nuxt.hook('server:devHandler', (h, options) => {
      devMiddlewareHandler.set(defineEventHandler((event) => {
        if (options.cors(event.url.pathname)) {
          const isPreflight = handleCors(event, nuxt.options.devServer.cors)
          if (isPreflight) {
            return null
          }
          event.res.headers.set('Vary', 'Origin')
        }
        return h(event)
      }))
    })
    nuxt.server = createDevServer(nitro)

    waitUntilCompile = new Promise<void>(resolve => nitro.hooks.hook('compiled', () => {
      nitroBuilt = true
      resolve()
    }))
  }

  nuxt.hook('build:done', async () => {
    nuxt._perf?.startPhase('nitro:build')
    try {
      await nuxt.callHook('nitro:build:before', nitro)
      await prepare(nitro)
      if (nuxt.options.dev) {
        await build(nitro)
        await waitUntilCompile
        return
      }

      await prerender(nitro)

      logger.restoreAll()
      await build(nitro)
      logger.wrapAll()

      if (nitro.options.static) {
        const dist = resolve(nuxt.options.rootDir, 'dist')
        if (!existsSync(dist)) {
          await fsp.symlink(nitro.options.output.publicDir, dist, 'junction').catch(() => {})
        }
      }
    } finally {
      nuxt._perf?.endPhase('nitro:build')
    }
  })
}
