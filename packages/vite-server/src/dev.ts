import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Nuxt } from '@nuxt/schema'
import { NodeRequest, sendNodeResponse } from 'srvx/node'
import { serveStatic } from 'srvx/static'
import type { Plugin, ViteDevServer } from 'vite'

import { resolveDocument } from './document.ts'
import { publicDirs } from './output.ts'

/**
 * Vite runs in middleware mode, so it creates no HTTP server of its own and leaves
 * `server.httpServer` null. Nuxt does listen, and its middlewares are served from that
 * listener, so the listener is exposed to Vite for other plugins to attach to.
 */
export function DevServerListenerPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:vite-server:dev-listener',
    enforce: 'pre',
    apply: 'serve',
    configureServer: {
      order: 'pre',
      handler (server) {
        server.httpServer ||= nuxt._devServerListener ?? null
      },
    },
  }
}

export function setupDevServer (nuxt: Nuxt): void {
  let viteServer: ViteDevServer | undefined
  nuxt.hook('vite:serverCreated', (server) => {
    viteServer = server as ViteDevServer
  })

  const staticMiddleware = publicDirs(nuxt).map(dir => serveStatic({ dir }))

  // the same document the client build takes as its HTML input, minus the build
  const shell = async (url: string) => {
    const html = await resolveDocument(nuxt)
    return new Response(viteServer ? await viteServer.transformIndexHtml(url, html) : html, {
      headers: { 'content-type': 'text/html;charset=utf-8' },
    })
  }

  nuxt.server = {
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (viteServer && await handledByVite(viteServer, req, res)) {
        return
      }

      // every path that vite does not serve is either a public asset or a route
      // the client router resolves from the app shell
      const request = new NodeRequest({ req, res })
      const next = (index: number): Response | Promise<Response> => {
        const middleware = staticMiddleware[index]
        return middleware ? middleware(request, () => next(index + 1)) : shell(req.url || '/')
      }
      await sendNodeResponse(res, await next(0))
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
