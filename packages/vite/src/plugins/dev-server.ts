import type { Connect, Plugin, ServerOptions } from 'vite'
import type { Nuxt, ViteConfig } from '@nuxt/schema'
import { existsSync, statSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { getPort } from 'get-port-please'
import { defu } from 'defu'
import type { H3Event as H3V2Event } from 'h3-next'
import type { H3Event as H3V1Event } from 'h3'
import { useNitro } from '@nuxt/kit'
import { join } from 'pathe'
import { joinURL } from 'ufo'
import type { IncomingMessage, ServerResponse } from 'node:http'

function isFile (path: string) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

async function findWorkerAssetInPackage (packageDir: string, relativeAssetPath: string) {
  const packageRelativePath = relativeAssetPath.replace(/^assets\//, '')
  for (const candidate of [
    join(packageDir, relativeAssetPath),
    join(packageDir, 'dist', relativeAssetPath),
    join(packageDir, 'dist', 'assets', packageRelativePath),
  ]) {
    if (isFile(candidate)) {
      return candidate
    }
  }
  return null
}

export async function resolveNodeModuleWorkerAssetPath (
  url: string,
  moduleRoots: string[],
  cache?: Map<string, string | null>,
) {
  const pathname = String(url).split(/[?#]/)[0]
  if (!/^\/?assets\/.*worker.*\.js$/i.test(pathname)) {
    return null
  }

  if (cache?.has(pathname)) {
    return cache.get(pathname) || null
  }

  const relativeAssetPath = pathname.replace(/^\/+/, '')
  const uniqueRoots = [...new Set(moduleRoots)]

  for (const root of uniqueRoots) {
    if (!existsSync(root)) {
      continue
    }

    if (isFile(join(root, relativeAssetPath))) {
      const path = join(root, relativeAssetPath)
      cache?.set(pathname, path)
      return path
    }

    const packages = await readdir(root, { withFileTypes: true }).catch(() => [])
    for (const pkg of packages) {
      if (!pkg.isDirectory() || pkg.name.startsWith('.')) {
        continue
      }

      if (pkg.name.startsWith('@')) {
        const scopedPackages = await readdir(join(root, pkg.name), { withFileTypes: true }).catch(() => [])
        for (const scopedPackage of scopedPackages) {
          if (!scopedPackage.isDirectory()) {
            continue
          }
          const found = await findWorkerAssetInPackage(join(root, pkg.name, scopedPackage.name), relativeAssetPath)
          if (found) {
            cache?.set(pathname, found)
            return found
          }
        }
        continue
      }

      const found = await findWorkerAssetInPackage(join(root, pkg.name), relativeAssetPath)
      if (found) {
        cache?.set(pathname, found)
        return found
      }
    }
  }

  cache?.set(pathname, null)
  return null
}

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
            verbose: false,
            portRange: [hmrPortDefault, hmrPortDefault + 20],
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

      await nuxt.callHook('vite:serverCreated', viteServer, { isClient: true, isServer: true })

      const staticBases: string[] = []
      for (const folder of nitro.options.publicAssets) {
        if (folder.baseURL && folder.baseURL !== '/' && folder.baseURL.startsWith(nuxt.options.app.buildAssetsDir)) {
          staticBases.push(folder.baseURL.replace(/\/?$/, '/'))
        }
      }

      const workerAssetCache = new Map<string, string | null>()
      const workerSearchRoots = [
        join(nuxt.options.rootDir, 'node_modules'),
        join(nuxt.options.workspaceDir, 'node_modules'),
        ...nuxt.options.modulesDir,
      ]

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

      let _isProxyPath: ((url: string) => boolean) | undefined

      function isProxyPath (url: string) {
        if (_isProxyPath) {
          return _isProxyPath(url)
        }

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

        _isProxyPath = function isProxyPath (path: string) {
          for (const pattern of proxyPatterns) {
            if (pattern.type === 'regex' && (pattern.value as RegExp).test(path)) {
              return true
            } else if (pattern.type === 'string' && path.startsWith(pattern.value as string)) {
              return true
            }
          }
          return false
        }

        return _isProxyPath(url)
      }

      const viteMiddleware = defineEventHandler(async (event: H3V1Event | H3V2Event) => {
        const url = 'url' in event ? event.url.pathname + event.url.search + event.url.hash : event.path
        const isBasePath = url.startsWith(viteServer.config.base!)

        // Check if this is a vite-handled route or proxy path
        let isViteRoute = isBasePath
        if (!isViteRoute) {
          // Check vite middleware routes (must be done per-request as middleware stack can change)
          for (const viteRoute of viteServer.middlewares.stack) {
            if (viteRoute.route.length > 1 && url.startsWith(viteRoute.route)) {
              isViteRoute = true
              break
            }
          }
          // Check proxy paths
          isViteRoute ||= isProxyPath(url)
        }

        const { req, res } = 'runtime' in event ? event.runtime!.node! : event.node

        if (!isViteRoute) {
          const workerAssetPath = await resolveNodeModuleWorkerAssetPath(url, workerSearchRoots, workerAssetCache)
          if (workerAssetPath) {
            const contents = await readFile(workerAssetPath)
            res!.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            res!.statusCode = 200
            res!.end(contents)
            return
          }
        }

        if (!isViteRoute) {
          // @ts-expect-error _skip_transform is a private property
          req._skip_transform = true
        }

        // Workaround: vite devmiddleware modifies req.url
        const _originalPath = req.url
        await new Promise((resolve, reject) => {
          viteServer.middlewares.handle(req as IncomingMessage, res as ServerResponse, (err: Error) => {
            req.url = _originalPath
            return err ? reject(err) : resolve(null)
          })
        })

        // if vite has not handled the request, we want to send a 404 for paths which are not in any static base or dev server handlers
        if (url.startsWith(nuxt.options.app.buildAssetsDir) && !staticBases.some(baseURL => url.startsWith(baseURL)) && !devHandlerRegexes.some(regex => regex.test(url))) {
          res!.statusCode = 404
          res!.end('Not Found')
          return
        }
      })
      await nuxt.callHook('server:devHandler', viteMiddleware, {
        cors: (url) => {
          if (useViteCors) {
            return false
          }

          if (url.startsWith(viteServer.config.base!)) {
            return true
          }

          // Check vite middleware routes (must be done per-request as middleware stack can change)
          for (const viteRoute of viteServer.middlewares.stack) {
            if (viteRoute.route.length > 1 && url.startsWith(viteRoute.route)) {
              return true
            }
          }

          // Check proxy paths
          return isProxyPath(url)
        },
      })

      // Use a post-hook so this runs after Vite registers its internal middleware.
      // This ensures the URL rewrite to /__skip_vite runs after the proxy middleware.
      return () => {
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
      }
    },
  }
}

type GenericHandler = (event: H3V1Event | H3V2Event) => unknown | Promise<unknown>

function defineEventHandler (handler: GenericHandler): GenericHandler {
  return Object.assign(handler, { __is_handler__: true })
}
