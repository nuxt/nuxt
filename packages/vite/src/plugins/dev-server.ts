import type { Connect, Plugin, ServerOptions } from 'vite'
import type { Nuxt, ViteConfig } from '@nuxt/schema'
import { getPort } from 'get-port-please'
import defu from 'defu'
import { createError, defineEventHandler, defineLazyEventHandler, handleCors, setHeader } from 'h3'
import { useNitro } from '@nuxt/kit'
import { joinURL } from 'ufo'
import type { IncomingMessage, ServerResponse } from 'node:http'

export function DevServerPlugin (nuxt: Nuxt): Plugin {
  let useViteCors = false
  const nitro = useNitro()
  return {
    name: 'nuxt:dev-server',
    async config (config) {
      // Prioritize `optimizeDeps.exclude`. If same dep is in `include` and `exclude`, remove it from `include`
      for (const item of [config.optimizeDeps, config.environments?.client?.optimizeDeps, config.environments?.ssr?.optimizeDeps]) {
        if (!item) {
          continue
        }
        const exclude = new Set(item.exclude ?? [])
        item.include = item.include?.filter(dep => !exclude.has(dep))
      }

      // In build mode we explicitly override any vite options that vite is relying on
      // to detect whether to inject production or development code (such as HMR code)
      if (!nuxt.options.dev && config.server) {
        config.server.hmr = false
      }

      // Inject an h3-based CORS handler in preference to vite's
      useViteCors = config.server?.cors !== undefined
      if (!useViteCors) {
        config.server ??= {}
        config.server.cors = false
      }

      if (config.server && config.server.hmr !== false) {
        const serverDefaults: Omit<ServerOptions, 'hmr'> & { hmr: Exclude<ServerOptions['hmr'], boolean> } = {
          hmr: {
            protocol: nuxt.options.devServer.https ? 'wss' : undefined,
          },
        }
        if (typeof config.server.hmr !== 'object' || !config.server.hmr.server) {
          serverDefaults.hmr ??= {}
          const hmrPortDefault = 24678 // Vite's default HMR port
          serverDefaults.hmr.port = await getPort({
            port: hmrPortDefault,
            ports: Array.from({ length: 20 }, (_, i) => hmrPortDefault + 1 + i),
          })
        }
        if (nuxt.options.devServer.https) {
          serverDefaults.https = nuxt.options.devServer.https === true ? {} : nuxt.options.devServer.https
        }
        config.server = defu(config.server, serverDefaults as ViteConfig['server'])
      }
    },
    async configureServer (viteServer) {
      // Invalidate virtual modules when templates are re-generated
      nuxt.hook('app:templatesGenerated', async (_app, changedTemplates) => {
        await Promise.all(changedTemplates.map(async (template) => {
          for (const mod of viteServer.moduleGraph.getModulesByFile(`virtual:nuxt:${encodeURIComponent(template.dst)}`) || []) {
            viteServer.moduleGraph.invalidateModule(mod)
            await viteServer.reloadModule(mod)
          }
        }))
      })

      if (nuxt.options.experimental.viteEnvironmentApi) {
        await nuxt.callHook('vite:serverCreated', viteServer, { isClient: true, isServer: true })
      }

      const mw: Connect.ServerStackItem = {
        route: '',
        handle: (req: IncomingMessage & { _skip_transform?: boolean }, res: ServerResponse, next: (err?: any) => void) => {
          // 'Skip' the transform middleware
          if (req._skip_transform && req.url) {
            req.url = joinURL('/__skip_vite', req.url.replace(/\?.*/, ''))
          }
          next()
        },
      }
      const transformHandler = viteServer.middlewares.stack.findIndex(m => m.handle instanceof Function && m.handle.name === 'viteTransformMiddleware')
      if (transformHandler === -1) {
        viteServer.middlewares.stack.push(mw)
      } else {
        viteServer.middlewares.stack.splice(transformHandler, 0, mw)
      }

      const staticBases: string[] = []
      for (const folder of nitro.options.publicAssets) {
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

      const viteMiddleware = defineLazyEventHandler(() => {
        // Pre-process proxy configuration once
        const proxyConfig = viteServer.config.server.proxy
        const proxyPatterns: Array<{ type: 'string' | 'regex', value: string | RegExp }> = []

        if (proxyConfig) {
          for (const key in proxyConfig) {
            if (key.startsWith('^')) {
              try {
                proxyPatterns.push({ type: 'regex', value: new RegExp(key) })
              } catch {
                // Invalid regex, skip this key
              }
            } else {
              proxyPatterns.push({ type: 'string', value: key })
            }
          }
        }

        function isProxyPath (path: string) {
          for (const pattern of proxyPatterns) {
            if (pattern.type === 'regex' && (pattern.value as RegExp).test(path)) {
              return true
            } else if (pattern.type === 'string' && path.startsWith(pattern.value as string)) {
              return true
            }
          }
          return false
        }

        return defineEventHandler(async (event) => {
          const isBasePath = event.path.startsWith(viteServer.config.base!)

          // Check if this is a vite-handled route or proxy path
          let isViteRoute = isBasePath
          if (!isViteRoute) {
            // Check vite middleware routes (must be done per-request as middleware stack can change)
            for (const viteRoute of viteServer.middlewares.stack) {
              if (viteRoute.route.length > 1 && event.path.startsWith(viteRoute.route)) {
                isViteRoute = true
                break
              }
            }
            // Check proxy paths
            isViteRoute ||= isProxyPath(event.path)
          }

          if (!isViteRoute) {
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
          const ended = event.node.res.writableEnded || event.handled
          if (!ended && event.path.startsWith(nuxt.options.app.buildAssetsDir) && !staticBases.some(baseURL => event.path.startsWith(baseURL)) && !devHandlerRegexes.some(regex => regex.test(event.path))) {
            throw createError({ statusCode: 404 })
          }
        })
      })
      await nuxt.callHook('server:devHandler', viteMiddleware)
    },
  }
}
