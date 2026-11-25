import { join } from 'pathe'
import { build, copyPublicAssets, createDevServer, prepare, prerender } from 'nitro/builder'
import type { Nitro } from 'nitro/types'
import type { Nuxt } from '@nuxt/schema'
import { logger } from '@nuxt/kit'
import { startBuildEnvironment } from '@nuxt/kit/internal'
import { defineEventHandler, dynamicEventHandler, handleCors } from 'nitro/h3'

import { linkStaticDist } from './utils.ts'

export function setupLegacyDevAndBuild (nuxt: Nuxt & { _nitro?: Nitro }, nitro: Nitro): void {
  const devMiddlewareHandler = dynamicEventHandler()
  nitro.options.devHandlers.unshift({ route: '', handler: devMiddlewareHandler })

  // Copy public assets after prerender so app manifest can be present
  if (!nuxt.options.dev) {
    nitro.hooks.hook('build:config', async (nitro) => {
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
          nitro.options.virtual['nuxt/internal/entry'] = () => (compiler.outputFileSystem as typeof import('node:fs')).readFileSync(join(nuxt.options.buildDir, 'dist/server/server.mjs'), 'utf-8')
        }
      })
    }
    for (const builder of ['webpack', 'rspack', 'rsbuild'] as const) {
      nuxt.hook(`${builder}:compiled`, () => {
        if (nitroBuilt) { nitro.hooks.callHook('build:reload') }
      })
    }
    nuxt.hook('vite:compiled', () => {
      if (nitroBuilt) { nuxt.server.reload() }
    })
    // the renderer config re-exports the head entries hoisted from the app component
    nuxt.hook('app:templatesGenerated', async (_app, templates) => {
      if (nitroBuilt && templates.some(template => template.filename === 'unhead.config.mjs')) {
        await nitro.hooks.callHook('build:reload')
      }
    })

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
      try {
        const report = nitro.options.static
          ? undefined
          : await startBuildEnvironment({ name: 'nitro', consumer: 'server', builder: nitro.options.builder || 'nitro' }, nuxt)
        await build(nitro)
        await report?.done(nitro.options.output.serverDir)
      } finally {
        logger.wrapAll()
      }

      if (nitro.options.static) {
        await linkStaticDist(nuxt.options.rootDir, nitro.options.output.publicDir)
      }
    } finally {
      nuxt._perf?.endPhase('nitro:build')
    }
  })
}
