import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Nuxt } from '@nuxt/schema'
import { NodeRequest, sendNodeResponse } from 'srvx/node'
import { staticMiddleware as createStaticMiddleware } from 'srvx/static'
import { joinURL } from 'ufo'
import type { Connect, ViteDevServer } from 'vite'

import { resolveDocument } from './document.ts'
import { publicDirs } from './output.ts'

export function setupDevServer (nuxt: Nuxt, serverEntry?: string): void {
  let viteServer: ViteDevServer | undefined
  nuxt.hook('vite:serverCreated', (server) => {
    viteServer = server as ViteDevServer
  })

  const staticMiddleware = publicDirs(nuxt).map(dir => createStaticMiddleware({ dir }))

  // the same document the client build takes as its HTML input, minus the build
  const shell = async (url: string) => {
    const html = await resolveDocument(nuxt)
    return new Response(viteServer ? await viteServer.transformIndexHtml(url, html) : html, {
      headers: { 'content-type': 'text/html;charset=utf-8' },
    })
  }

  const errorChannel = joinURL(nuxt.options.app.baseURL, nuxt.options.devServer.errorChannel)

  // loaded from the dev module graph, so an edit is picked up by the next render
  const render = async (request: Request) => {
    const module = await viteServer!.ssrLoadModule(serverEntry!) as {
      fetch: (request: Request) => Promise<Response>
      setDevErrorContext?: (context: { server: ViteDevServer, cwd: string, channel: string }) => void
    }
    // set per render, since the module holding it is re-evaluated with the graph
    module.setDevErrorContext?.({ server: viteServer!, cwd: nuxt.options.rootDir, channel: errorChannel })
    return module.fetch(request)
  }

  const respond = (request: Request, url: string) => {
    return serverEntry && viteServer ? render(request) : shell(url)
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
    configureServer: {
      order: 'pre',
      handler (server) {
        // vite runs in middleware mode, so plugins attach to Nuxt's listener instead
        server.httpServer ||= nuxt._devServerListener ?? null
        // ahead of other plugins' post middlewares, which may respond to every request
        return () => {
          server.middlewares.use(async function nuxtDevMiddleware (req: Connect.IncomingMessage, res, next) {
            const viteUrl = req.url
            const url = req.url = req.originalUrl || req.url || '/'
            try {
              const request = new NodeRequest({ req, res })
              const response = await serveStatic(request) ?? (isDocumentRequest(req) ? await shell(url) : undefined)
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
      if (viteServer && await handledByVite(viteServer, req, res)) {
        return
      }
      await sendNodeResponse(res, await respond(new NodeRequest({ req, res }), req.url || '/'))
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
