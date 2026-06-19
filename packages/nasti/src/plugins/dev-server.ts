import type { IncomingMessage, ServerResponse } from 'node:http'
import { getPort } from 'get-port-please'
import { joinURL } from 'ufo'
import type { Nuxt } from '@nuxt/schema'
import type { NastiEnvironment, NastiPlugin } from '@nasti-toolchain/nasti'

// Nuxt/Nitro accepts a bare handler tagged with `__is_handler__` for `server:devHandler`;
// this avoids depending on a specific h3 major. Mirrors `@nuxt/vite-builder`.
type GenericHandler = (event: any) => unknown | Promise<unknown>
function defineEventHandler (handler: GenericHandler): GenericHandler {
  return Object.assign(handler, { __is_handler__: true })
}

const HMR_PORT_DEFAULT = 24678 // Vite's default HMR port; keep range-compatible for tooling.

/**
 * Registers the Nasti dev server's connect middleware stack into Nuxt's dev server.
 *
 * Mirrors `@nuxt/vite-builder`'s `DevServerPlugin`, adapted to Nasti:
 *  - `config` sets HMR/CORS defaults (and disables HMR for production builds).
 *  - `configureServer` (invoked by `createServer`) wraps Nasti's connect stack in an h3
 *    handler and hands it to Nitro via `server:devHandler`, invalidates template-derived
 *    modules on `app:templatesGenerated`, and emits `nasti:serverCreated`.
 */
export function NastiDevServerPlugin (nuxt: Nuxt): NastiPlugin {
  // CORS for the dev server is handled by Nuxt/Nitro, so we tell Nasti to skip its own
  // unless the user explicitly configured it.
  let useNastiCors = false
  const base = joinURL(nuxt.options.app.baseURL || '/', nuxt.options.app.buildAssetsDir)

  return {
    name: 'nuxt:nasti:dev-server',
    async config (config, env) {
      config.server ||= {}

      // In build mode, force HMR off so no dev/HMR code is injected.
      if (env.command === 'build') {
        config.server.hmr = false
        return
      }

      useNastiCors = config.server.cors !== undefined
      if (!useNastiCors) {
        config.server.cors = false
      }

      if (config.server.hmr !== false) {
        const port = await getPort({
          verbose: false,
          portRange: [HMR_PORT_DEFAULT, HMR_PORT_DEFAULT + 20],
        })
        const protocol = nuxt.options.devServer.https ? 'wss' : 'ws'
        config.server.hmr = typeof config.server.hmr === 'object'
          ? { port, protocol, ...config.server.hmr }
          : { port, protocol }
      }
    },
    async configureServer (server) {
      // Invalidate template-derived modules in the client graph when templates regenerate,
      // so the next request re-transforms them. (Nasti has no `reloadModule` equivalent.)
      const clientEnv = server.environments.client as NastiEnvironment | undefined
      const moduleGraph = clientEnv?.moduleGraph
      nuxt.hook('app:templatesGenerated', (_app, changedTemplates) => {
        if (!moduleGraph) {
          return
        }
        for (const template of changedTemplates) {
          for (const mod of moduleGraph.getModulesByFile(template.dst) || []) {
            moduleGraph.invalidateModule(mod)
          }
        }
      })

      await nuxt.callHook('nasti:serverCreated', server)

      const nastiMiddleware = defineEventHandler(async (event: any) => {
        const { req, res } = ('runtime' in event ? event.runtime?.node : event.node) as {
          req: IncomingMessage
          res: ServerResponse
        }
        // Nasti's connect stack mutates req.url; restore it once it has run.
        const originalUrl = req.url
        await new Promise<void>((resolve, reject) => {
          server.middlewares(req, res, (err?: unknown) => {
            req.url = originalUrl
            return err ? reject(err) : resolve()
          })
        })
      })

      await nuxt.callHook('server:devHandler', nastiMiddleware, {
        cors: (url: string) => {
          // Let Nuxt apply CORS to Nasti-served asset requests unless the user opted into
          // Nasti's own CORS handling.
          if (useNastiCors) {
            return false
          }
          return url.startsWith(base)
        },
      })
    },
  }
}
