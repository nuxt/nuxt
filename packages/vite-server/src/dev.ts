import type { IncomingMessage, ServerResponse } from 'node:http'
import { inspect } from 'node:util'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import { NodeRequest, sendNodeResponse } from 'srvx/node'
import { staticMiddleware as createStaticMiddleware } from 'srvx/static'
import { joinURL } from 'ufo'
import type { Connect, ViteDevServer } from 'vite'

import { errorChannelAccess, listenForRemoteDevErrors, reportFileAccess, serveErrorChannel, withDevBadge } from './dev-errors.ts'
import type { DevErrorContext } from './runtime/dev-error.ts'
import { resolveDocument } from './document.ts'
import { publicDirs } from './output.ts'

/**
 * The ESM dependencies of the render, which a deploy target's environment loads as they
 * are rather than discovering and pre-bundling them as it reaches them. `nuxt` is one, since
 * its internals import modules that Nuxt's build provides.
 */
const SERVER_RUNTIME_DEPS = [
  'nuxt',
  'vue',
  'vue-router',
  '@vue/shared',
  '@unhead/vue',
  'unhead',
  'vue-bundle-renderer',
  'cookie-es',
  'defu',
  'destr',
  'devalue',
  'errx',
  'hookable',
  'iron-webcrypto',
  'klona',
  'my-bad',
  'nostics',
  'ofetch',
  'pathe',
  'ufo',
  'unctx',
]

export function setupDevServer (nuxt: Nuxt, serverEntry?: string): void {
  let viteServer: ViteDevServer | undefined
  nuxt.hook('vite:serverCreated', (server) => {
    viteServer = server as ViteDevServer
  })

  const staticMiddleware = publicDirs(nuxt).map(dir => createStaticMiddleware({ dir }))

  const errorChannel = joinURL(nuxt.options.app.baseURL, nuxt.options.devServer.errorChannel)

  // the same document the client build takes as its HTML input, minus the build
  const shell = async (url: string, request: Request) => {
    const html = await resolveDocument(nuxt)
    const transformed = viteServer ? await viteServer.transformIndexHtml(url, html) : html
    return new Response(await withDevBadge(nuxt, transformed, errorChannel, request), {
      headers: { 'content-type': 'text/html;charset=utf-8' },
    })
  }

  // loaded from the dev module graph, so an edit is picked up by the next render
  const render = async (request: Request) => {
    const module = await viteServer!.ssrLoadModule(serverEntry!) as {
      fetch: (request: Request) => Promise<Response>
      setDevErrorContext?: (context: DevErrorContext) => void
    }
    // set per render, since the module holding it is re-evaluated with the graph
    module.setDevErrorContext?.({
      server: viteServer!,
      cwd: nuxt.options.rootDir,
      channel: errorChannel,
      canRead: reportFileAccess(viteServer!),
      access: errorChannelAccess(nuxt, viteServer!),
    })
    return module.fetch(request)
  }

  let reportedFallthrough = false
  const respond = (request: Request, url: string) => {
    if (!serverEntry || !viteServer) {
      return shell(url, request)
    }
    if (!('runner' in viteServer.environments.ssr)) {
      if (!reportedFallthrough) {
        reportedFallthrough = true
        bundlerDiagnostics.NUXT_B7037()
      }
      return new Response('Internal Server Error', { status: 500 })
    }
    return render(request)
  }

  const serveStatic = (request: Request): Promise<Response | undefined> => {
    const next = (index: number): Promise<Response | undefined> => {
      const middleware = staticMiddleware[index]
      return Promise.resolve(middleware?.(request, () => next(index + 1) as Promise<Response>))
    }
    return next(0)
  }

  // with SSR, a deploy target renders documents through `#server-entry`
  const isDocumentRequest = (req: IncomingMessage) => !serverEntry
    && (req.method === 'GET' || req.method === 'HEAD')
    && (req.headers['sec-fetch-mode'] === 'navigate' || !!req.headers.accept?.includes('text/html'))

  nuxt.options.vite.plugins ||= []
  nuxt.options.vite.plugins.push({
    name: 'nuxt:vite-server:dev',
    enforce: 'pre',
    apply: 'serve',
    configEnvironment (name, config) {
      if (serverEntry && name !== 'client' && (config.consumer ?? 'server') === 'server') {
        return { optimizeDeps: { exclude: [...SERVER_RUNTIME_DEPS] } }
      }
    },
    configureServer: {
      order: 'pre',
      handler (server) {
        if (serverEntry) {
          listenForRemoteDevErrors(nuxt, server, errorChannel)
        }
        // with no server entry, nothing else serves the channel
        const serveChannel = serverEntry ? undefined : serveErrorChannel(nuxt, server, errorChannel)
        // ahead of other plugins' post middlewares, which may respond to every request
        return () => {
          server.middlewares.use(async function nuxtDevMiddleware (req: Connect.IncomingMessage, res, next) {
            const viteUrl = req.url
            const url = req.url = req.originalUrl || req.url || '/'
            try {
              if (serveChannel && await serveChannel(req, res)) {
                return
              }
              const request = new NodeRequest({ req, res })
              const response = await serveStatic(request) ?? (isDocumentRequest(req) ? await shell(url, request) : undefined)
              if (response) {
                return await sendNodeResponse(res, response)
              }
              req.url = viteUrl
              next()
            } catch (error) {
              next(error)
            }
          })
        }
      },
    },
  })

  nuxt.server = {
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      try {
        if (viteServer && await handledByVite(viteServer, req, res)) {
          return
        }
        await sendNodeResponse(res, await respond(new NodeRequest({ req, res }), req.url || '/'))
      } catch (error) {
        if (!viteServer?.config.logger.hasErrorLogged(error as Error)) {
          bundlerDiagnostics.NUXT_B7036({ method: req.method!, url: req.url!, error: inspect(error), headersSent: res.headersSent, cause: error }, { method: 'error' })
        }
        if (res.headersSent) {
          res.destroy()
        } else {
          res.statusCode = 500
          res.end('Internal Server Error')
        }
      }
    },
  }
}

function handledByVite (server: ViteDevServer, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  return new Promise<boolean>((resolvePromise, reject) => {
    const originalUrl = req.url
    server.middlewares.handle(req, res, (error?: unknown) => {
      req.url = originalUrl
      if (error) { return reject(error) }
      resolvePromise(false)
    })
    // vite ends the response itself for anything it handles, and then never calls
    // the fallthrough above
    res.on('close', () => resolvePromise(true))
  }).then(handled => handled || res.writableEnded)
}
