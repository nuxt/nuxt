import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ServerOptions, UserConfig } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { joinURL } from 'ufo'
import { useNitro } from '@nuxt/kit'
import { createError, defineEventHandler, handleCors, setHeader } from 'h3'
import defu from 'defu'
import { getPort } from 'get-port-please'

import { initViteNodeServer } from '../vite-node'

export function DevServerPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:dev-server',
    apply: 'serve',
    async config (config) {
      const overrides: UserConfig = {}
      overrides.server ||= {}

      // In build mode we explicitly override any vite options that vite is relying on
      // to detect whether to inject production or development code (such as HMR code)
      if (!nuxt.options.dev) {
        overrides.server.hmr = false
      }

      // Inject an h3-based CORS handler in preference to vite's
      const useViteCors = config.server?.cors !== undefined
      if (!useViteCors) {
        overrides.server.cors = false
      }

      if (config.server && config.server.hmr !== false) {
        const serverDefaults: Omit<ServerOptions, 'hmr'> & { hmr: Exclude<ServerOptions['hmr'], boolean> } = {
          hmr: {
            protocol: nuxt.options.devServer.https ? 'wss' : undefined,
          },
        }
        if (typeof config.server.hmr !== 'object' || !config.server.hmr.server) {
          const hmrPortDefault = 24678 // Vite's default HMR port
          serverDefaults.hmr!.port = await getPort({
            port: hmrPortDefault,
            ports: Array.from({ length: 20 }, (_, i) => hmrPortDefault + 1 + i),
          })
        }
        if (nuxt.options.devServer.https) {
          serverDefaults.https = nuxt.options.devServer.https === true ? {} : nuxt.options.devServer.https
        }
        overrides.server = defu(overrides.server, serverDefaults as UserConfig['server'])
      }
      return overrides
    },
    async configureServer (viteServer) {
      nuxt.hook('close', () => viteServer.close())

      await nuxt.callHook('vite:serverCreated', viteServer, { isClient: true, isServer: true })

      // Initialize plugins
      // await viteServer.pluginContainer.buildStart({})
      await initViteNodeServer(nuxt, viteServer)

      const transformHandler = viteServer.middlewares.stack.findIndex(m => m.handle instanceof Function && m.handle.name === 'viteTransformMiddleware')
      viteServer.middlewares.stack.splice(transformHandler, 0, {
        route: '',
        handle: (req: IncomingMessage & { _skip_transform?: boolean }, res: ServerResponse, next: (err?: any) => void) => {
          // 'Skip' the transform middleware
          if (req._skip_transform) { req.url = joinURL('/__skip_vite', req.url!.replace(/\?.*/, '')) }
          next()
        },
      })

      const staticBases: string[] = []
      for (const folder of useNitro().options.publicAssets) {
        if (folder.baseURL && folder.baseURL !== '/' && folder.baseURL.startsWith(nuxt.options.app.buildAssetsDir)) {
          staticBases.push(folder.baseURL.replace(/\/?$/, '/'))
        }
      }

      const devHandlerRegexes: RegExp[] = []
      for (const handler of nuxt.options.devServerHandlers) {
        if (handler.route && handler.route !== '/' && handler.route.startsWith(nuxt.options.app.buildAssetsDir)) {
          devHandlerRegexes.push(new RegExp(
            `^${handler.route
              .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex syntax characters
              .replace(/:[^/]+/g, '[^/]+') // dynamic segments (:param)
              .replace(/\*\*/g, '.*') // double wildcard (**) to match any path
              .replace(/\*/g, '[^/]*')}$`, // single wildcard (*) to match any segment
          ))
        }
      }

      const useViteCors = viteServer.config.server.cors !== undefined
      const viteMiddleware = defineEventHandler(async (event) => {
        const viteRoutes: string[] = []
        for (const viteRoute of viteServer.middlewares.stack) {
          const m = viteRoute.route
          if (m.length > 1) {
            viteRoutes.push(m)
          }
        }
        if (!event.path.startsWith(viteServer.config.base!) && !viteRoutes.some(route => event.path.startsWith(route))) {
          // @ts-expect-error _skip_transform is a private property
          event.node.req._skip_transform = true
        } else if (!useViteCors) {
          const isPreflight = handleCors(event, nuxt.options.devServer.cors)
          if (isPreflight) {
            return null
          }
          setHeader(event, 'Vary', 'Origin')
        }

        // Workaround: vite devmiddleware modifies req.url
        const _originalPath = event.node.req.url
        await new Promise((resolve, reject) => {
          viteServer.middlewares.handle(event.node.req, event.node.res, (err: Error) => {
            event.node.req.url = _originalPath
            return err ? reject(err) : resolve(null)
          })
        })

        // if vite has not handled the request, we want to send a 404 for paths which are not in any static base or dev server handlers
        if (!event.handled && event.path.startsWith(nuxt.options.app.buildAssetsDir) && !staticBases.some(baseURL => event.path.startsWith(baseURL)) && !devHandlerRegexes.some(regex => regex.test(event.path))) {
          throw createError({
            statusCode: 404,
          })
        }
      })
      await nuxt.callHook('server:devHandler', viteMiddleware)
    },
  }
}
