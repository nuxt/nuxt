import type { IncomingMessage, ServerResponse } from 'node:http'
import { performance } from 'node:perf_hooks'
import type { NuxtBuilder } from '@nuxt/schema'
import { logger } from '@nuxt/kit'
import { toNastiConfig } from './config'

// Local event-handler shim, mirroring @nuxt/vite-builder's DevServerPlugin.
// Avoids depending on a specific h3 major: Nuxt/Nitro accepts a bare handler
// tagged with `__is_handler__`, and the `server:devHandler` hook only needs it
// to be callable with the request event.
type GenericHandler = (event: any) => unknown | Promise<unknown>
function defineEventHandler (handler: GenericHandler): GenericHandler {
  return Object.assign(handler, { __is_handler__: true })
}

/**
 * Nasti builder for Nuxt — M0 proof-of-concept.
 *
 * Scope of M0 (see packages/nasti/README.md): prove the seam, not ship a
 * working app. Concretely it proves that:
 *   1. Nuxt loads `@nuxt/nasti-builder` through the `builder` option and calls
 *      `bundle(nuxt)` (the `NuxtBuilder` contract).
 *   2. The Nuxt config translates into a Nasti config.
 *   3. The Vite plugin list survives the Vite->Nasti plugin bridge (and we learn
 *      exactly which hooks don't, via the bridge's summary warning).
 *   4. A Nasti dev server boots in middleware mode and its connect stack is
 *      registered into Nuxt's dev server via `server:devHandler`.
 *
 * NOT in M0 (tracked as later milestones):
 *   - M1: full Rollup `PluginContext`, so Nuxt's 22 first-party Vite plugins
 *     actually run (client-manifest, ssr-styles, module-preload, …).
 *   - M2: dev-mode SSR through Nasti's RunnableEnvironment + the Nitro
 *     `vite-node` bridge.
 *   - M3: production `createBuilder`-equivalent multi-environment build +
 *     client manifest.
 *
 * As a result, M0 will NOT render a working Nuxt page — it is expected to boot
 * the server and then 404 / error on the app entry. That is the honest state.
 */
export const bundle: NuxtBuilder['bundle'] = async (nuxt) => {
  logger.warn(
    '[nasti-builder] EXPERIMENTAL M0 — boots a Nasti dev server and exercises ' +
    'the builder seam only. SSR, the client manifest, and most Nuxt Vite ' +
    'plugins are not wired yet, so the app will not render. See packages/nasti/README.md.',
  )

  // Resolve Nasti lazily so a project without it installed gets a clear error
  // only when it actually opts into this builder.
  let nasti: typeof import('@nasti-toolchain/nasti')
  try {
    nasti = await import('@nasti-toolchain/nasti')
  } catch (err) {
    throw new Error(
      'Could not load `@nasti-toolchain/nasti`. Add it to your project ' +
      'dependencies (`npm i -D @nasti-toolchain/nasti`) to use `@nuxt/nasti-builder`.',
      { cause: err },
    )
  }

  const config = await toNastiConfig(nuxt)

  // ---- Production build -----------------------------------------------------
  if (!nuxt.options.dev) {
    const start = performance.now()
    await nasti.build(config)
    logger.success(`[nasti-builder] client build done in ${Math.round(performance.now() - start)}ms`)
    return
  }

  // ---- Dev server (middleware mode) -----------------------------------------
  const start = performance.now()
  const server = await nasti.createServer(config)
  nuxt.hook('close', () => server.close())

  // Mirror @nuxt/vite-builder's DevServerPlugin: wrap the Nasti connect stack in
  // an h3 handler and hand it to Nitro via `server:devHandler`.
  const middlewares = server.middlewares as (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ) => void

  const nastiHandler = defineEventHandler(async (event: any) => {
    const { req, res } = ('runtime' in event ? event.runtime?.node : event.node) as {
      req: IncomingMessage
      res: ServerResponse
    }
    const originalUrl = req.url
    await new Promise<void>((resolve, reject) => {
      middlewares(req, res, (err?: unknown) => {
        req.url = originalUrl
        return err ? reject(err) : resolve()
      })
    })
  })

  await nuxt.callHook('server:devHandler', nastiHandler, { cors: () => false })

  logger.success(`[nasti-builder] Nasti dev server booted in ${Math.round(performance.now() - start)}ms`)
}
